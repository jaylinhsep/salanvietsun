# VietSun Barge TMS (`salanvietsun`)

Hệ thống Quản lý Vận tải Sà lan (Barge Transport Management System) chuyên nghiệp dành cho tuyến TP.HCM — Cái Mép — Đồng bằng Sông Cửu Long.

## Kiến trúc công nghệ
- **Frontweb & Mobileweb PWA**: Next.js 15 (App Router, TypeScript, Tailwind CSS, Leaflet + OpenSeaMap, Service Worker PWA) — `apps/web`
- **Backend API**: NestJS (TypeScript, Swagger OpenAPI `/api/docs`, `pg`) — `apps/api`
- **Database**: PostgreSQL 16 + PostGIS 3.4 (Truy vấn không gian `GEOGRAPHY(Point, 4326)`, `ST_Distance`, `ST_DWithin`) — `database/`

## 6 Phân hệ chính
1. **Quản lý Đội tàu & Thiết bị (`/fleet`)**: Sà lan tự hành, sà lan boong, tàu kéo, thiết bị máy chính, hạn đăng kiểm, định mức nhiên liệu.
2. **Điều độ & Lập kế hoạch chuyến (`/dispatch`)**: Phân bổ sà lan, đầu kéo, tự động tính hải lý tuyến sông qua PostGIS, theo dõi ETD/ETA.
3. **Giám sát hành trình & Nhiên liệu (`/tracking`)**: Bản đồ AIS/GPS realtime + OpenSeaMap, geofence cảng, nhật ký cấp dầu (Bunkering) & tồn két (ROB).
4. **Quản lý Đơn hàng, Cước phí & Công nợ (`/orders`)**: Đơn hàng vận tải, tính cước theo tấn/chuyến, hóa đơn VAT & thu hồi công nợ.
5. **Bảo trì & Sửa chữa (`/maintenance`)**: Lịch bảo dưỡng định kỳ, lên triền (Dry-dock), phiếu báo hỏng & nghiệm thu chi phí.
6. **Ứng dụng Mobileweb PWA cho Thuyền trưởng & Hiện trường (`/mobile`)**: Giao diện mobile-first, cài đặt như app trên điện thoại, check-in GPS rời/cập cảng, báo cáo dầu & báo hỏng tại hiện trường.

---

## Hướng dẫn cài đặt & chạy Local / VPS

### 1. Khởi tạo PostgreSQL + PostGIS
Cách nhanh nhất bằng Docker:
```bash
docker compose up -d
```
Hoặc trên VPS đã cài sẵn PostgreSQL + PostGIS:
```bash
psql -U postgres -c "CREATE DATABASE salanvietsun_tms;"
psql -U postgres -d salanvietsun_tms -f database/01-init-postgis.sql
psql -U postgres -d salanvietsun_tms -f database/02-seed.sql
```

### 2. Chạy Backend (NestJS)
```bash
cd apps/api
cp .env.example .env
# Chỉnh DATABASE_URL trong .env nếu cần
npm install
npm run build
npm run start:prod   # hoặc npm run start:dev khi dev
```
Swagger API Docs: `http://localhost:4000/api/docs`

### 3. Chạy Frontend & Mobileweb PWA (Next.js)
```bash
cd apps/web
cp .env.example .env.local
# Chỉnh NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api khi lên VPS
npm install
npm run build
npm run start
```
- Frontweb Điều độ: `http://localhost:3000`
- Mobileweb PWA Thuyền trưởng: `http://localhost:3000/mobile`

### 4. Deploy lên VPS với PM2
```bash
npm install -g pm2
pm2 start apps/api/dist/main.js --name salanvietsun-api
pm2 start "npm run start" --cwd apps/web --name salanvietsun-web
pm2 save
```
