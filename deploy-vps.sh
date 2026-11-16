#!/bin/bash
set -e

PREV_COMMIT=$(git rev-parse HEAD)

echo "=== 1. Pulling latest code from GitHub ==="
git pull origin main

NEW_COMMIT=$(git rev-parse HEAD)
CHANGED_FILES=$(git diff --name-only "$PREV_COMMIT" "$NEW_COMMIT" || true)

if [ -z "$CHANGED_FILES" ] && [ "$1" != "--force" ]; then
  echo "No new changes. Use 'bash deploy-vps.sh --force' to force rebuild."
  exit 0
fi

if echo "$CHANGED_FILES" | grep -q "^apps/api/" || [ "$1" = "--force" ]; then
  echo "=== 2. Building Backend (NestJS) ==="
  cd apps/api
  if echo "$CHANGED_FILES" | grep -q "apps/api/package"; then
    npm install
  fi
  npm run build
  cd ../..
  echo "=== 2b. Syncing schema & snapshot data to PostgreSQL ==="
  node scripts/sync-snapshot-to-pg.mjs || true
  pm2 restart salanvietsun-api
fi

if echo "$CHANGED_FILES" | grep -q "^apps/web/" || [ "$1" = "--force" ]; then
  echo "=== 3. Building Frontend (Next.js) ==="
  cd apps/web
  if echo "$CHANGED_FILES" | grep -q "apps/web/package"; then
    npm install
  fi
  rm -rf .next
  NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS="--max-old-space-size=1024" npx next build --no-lint
  pm2 restart salanvietsun-web
  # Clear Nginx proxy cache (aaPanel / standard Linux paths) so stale HTML is never served
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
fi

echo "=== Deploy completed! ==="
pm2 status
