#!/bin/bash
set -e

WITH_WEB=0
SYNC_DB=0
FORCE=0

for arg in "$@"; do
  case "$arg" in
    --with-web) WITH_WEB=1 ;;
    --sync-db) SYNC_DB=1 ;;
    --force) FORCE=1 ;;
    --api-only) WITH_WEB=0 ;;
  esac
done

PREV_COMMIT=$(git rev-parse HEAD)

echo "=== 1. Pulling latest code from GitHub ==="
git pull origin main

NEW_COMMIT=$(git rev-parse HEAD)
CHANGED_FILES=$(git diff --name-only "$PREV_COMMIT" "$NEW_COMMIT" || true)

if [ -z "$CHANGED_FILES" ] && [ "$FORCE" -eq 0 ] && [ "$SYNC_DB" -eq 0 ]; then
  echo "No new changes. Use '--force', '--sync-db', or '--with-web' to rebuild."
  exit 0
fi

# Build API only when apps/api/ changed or --force
if echo "$CHANGED_FILES" | grep -q "^apps/api/" || [ "$FORCE" -eq 1 ]; then
  echo "=== 2. Building Backend (NestJS) ==="
  cd apps/api
  if echo "$CHANGED_FILES" | grep -q "^apps/api/package"; then
    npm install --no-audit --no-fund
  fi
  NODE_OPTIONS="--max-old-space-size=512" npm run build
  cd ../..
  pm2 restart salanvietsun-api || pm2 reload salanvietsun-api || true
fi

# Sync massive snapshot JSON to PostgreSQL ONLY when snapshot or sync script changed (or --sync-db)
if echo "$CHANGED_FILES" | grep -qE "^(database/snapshot-local\.json|scripts/sync-snapshot-to-pg\.mjs)" || [ "$SYNC_DB" -eq 1 ]; then
  echo "=== 2b. Syncing snapshot data to PostgreSQL ==="
  pm2 stop salanvietsun-api >/dev/null 2>&1 || true
  node scripts/sync-snapshot-to-pg.mjs
  pm2 restart salanvietsun-api
else
  echo "=== 2b. Skipping snapshot sync (database/snapshot-local.json unchanged) ==="
fi

# Skip heavy Next.js build on VPS by default (Frontend is hosted on Cloudflare Pages).
# Pass --with-web only if you still serve apps/web directly from this VPS.
if [ "$WITH_WEB" -eq 1 ] && (echo "$CHANGED_FILES" | grep -q "^apps/web/" || [ "$FORCE" -eq 1 ]); then
  echo "=== 3. Building Frontend on VPS (--with-web) ==="
  cd apps/web
  if echo "$CHANGED_FILES" | grep -q "^apps/web/package"; then
    npm install --no-audit --no-fund
  fi
  # Keep .next/cache for faster incremental builds instead of deleting all of .next
  find .next -mindepth 1 -maxdepth 1 ! -name 'cache' -exec rm -rf {} + 2>/dev/null || true
  NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS="--max-old-space-size=1024" npx next build --no-lint
  pm2 restart salanvietsun-web
  rm -rf /www/server/nginx/proxy_cache_dir/* /www/server/nginx/proxy_cache/* /www/server/nginx/cache/* /var/cache/nginx/* /tmp/nginx_cache/* 2>/dev/null || true
  if [ -d /www/server/panel/vhost/nginx ]; then
    for d in $(grep -rh "proxy_cache_path" /www/server/nginx/conf /www/server/panel/vhost/nginx 2>/dev/null | awk '{print $2}'); do
      [ -d "$d" ] && rm -rf "${d:?}"/* 2>/dev/null || true
    done
  fi
  if command -v nginx >/dev/null 2>&1; then
    nginx -s reload || true
  fi
  cd ../..
else
  echo "=== 3. Skipping Next.js build on VPS (handled by Cloudflare Pages; pass --with-web if needed) ==="
fi

echo "=== Deploy completed! ==="
pm2 status
