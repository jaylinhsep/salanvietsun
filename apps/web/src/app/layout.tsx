import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'VietSun Barge TMS — Hệ thống Quản lý Vận tải Sà lan',
  description: 'TMS quản lý đội sà lan, điều độ chuyến, giám sát AIS/GPS, nhiên liệu, công nợ & bảo trì',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#0284c7',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
