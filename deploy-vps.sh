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
  pm2 restart salanvietsun-api
  cd ../..
fi

if echo "$CHANGED_FILES" | grep -q "^apps/web/" || [ "$1" = "--force" ]; then
  echo "=== 3. Building Frontend (Next.js) ==="
  cd apps/web
  if echo "$CHANGED_FILES" | grep -q "apps/web/package"; then
    npm install
  fi
  NEXT_TELEMETRY_DISABLED=1 npm run build
  pm2 restart salanvietsun-web
  cd ../..
fi

echo "=== Deploy completed! ==="
pm2 status
