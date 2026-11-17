import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Lịch chạy Sà lan — VietSun Corporation - VietSun Lines',
  description:
    'Lịch chạy sà lan tuyến Hồ Chí Minh (Tân Thuận / Bến Nghé / VICT) — Cảng Cần Thơ & Cảng TC Sa Đéc',
};

export default function PublicScheduleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
