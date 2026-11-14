#!/bin/bash
set -e

echo "=== 1. Pulling latest code from GitHub ==="
git pull origin main

echo "=== 2. Building Backend (NestJS) ==="
cd apps/api
npm install
npm run build

echo "=== 3. Building Frontend (Next.js) ==="
cd ../web
npm install
NEXT_TELEMETRY_DISABLED=1 npm run build

echo "=== 4. Restarting PM2 services ==="
pm2 restart salanvietsun-api salanvietsun-web

echo "=== Deploy completed! ==="
pm2 status
