#!/bin/bash
set -e

WITH_WEB=0
SYNC_DB=0
FORCE=0
LOCAL_BUILD=0

for arg in "$@"; do
  case "$arg" in
    --with-web) WITH_WEB=1 ;;
    --sync-db) SYNC_DB=1 ;;
    --force) FORCE=1 ;;
    --api-only) WITH_WEB=0 ;;
    --local-build) LOCAL_BUILD=1 ;;
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

# Deploy Backend API using prebuilt artifact from GitHub Actions when possible (zero compile load on VPS)
if echo "$CHANGED_FILES" | grep -q "^apps/api/" || [ "$FORCE" -eq 1 ]; then
  echo "=== 2. Deploying Backend (NestJS) ==="
  if echo "$CHANGED_FILES" | grep -q "^apps/api/package"; then
    (cd apps/api && npm install --no-audit --no-fund)
  fi

  TARGET_API_SHA=$(git log -n 1 --format=%H -- apps/api)
  RELEASE_BASE="https://github.com/jaylinhsep/salanvietsun/releases/download/api-latest"
  PREBUILT_OK=0

  if [ "$LOCAL_BUILD" -eq 0 ] && command -v curl >/dev/null 2>&1; then
    echo "Checking prebuilt API on GitHub Actions (target commit ${TARGET_API_SHA:0:7})..."
    for attempt in 1 2 3 4 5 6 7 8 9 10; do
      REMOTE_SHA=$(curl -fsSL --max-time 8 "${RELEASE_BASE}/api-dist.sha" 2>/dev/null | tr -d '[:space:]' || true)
      if [ "$REMOTE_SHA" = "$TARGET_API_SHA" ]; then
        TMP_TAR="/tmp/salanvietsun-api-dist.tar.gz"
        if curl -fsSL --max-time 30 -o "$TMP_TAR" "${RELEASE_BASE}/api-dist.tar.gz"; then
          rm -rf apps/api/dist.new
          mkdir -p apps/api/dist.new
          if tar -xzf "$TMP_TAR" -C apps/api/dist.new && [ -f apps/api/dist.new/dist/main.js ]; then
            rm -rf apps/api/dist
            mv apps/api/dist.new/dist apps/api/dist
            rm -rf apps/api/dist.new "$TMP_TAR"
            echo "Applied prebuilt API dist from GitHub Actions (skipped slow VPS compile)!"
            PREBUILT_OK=1
            break
          fi
          rm -rf apps/api/dist.new "$TMP_TAR"
        fi
      fi
      if [ "$attempt" -lt 10 ]; then
        echo "  Prebuilt not ready yet (remote=${REMOTE_SHA:0:7}), waiting 5s ($attempt/10)..."
        sleep 5
      fi
    done
  fi

  if [ "$PREBUILT_OK" -eq 0 ]; then
    echo "Prebuilt unavailable — falling back to local nest build..."
    (cd apps/api && NODE_OPTIONS="--max-old-space-size=512" npm run build)
  fi

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
