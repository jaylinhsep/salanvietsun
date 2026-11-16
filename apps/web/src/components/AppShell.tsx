'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Anchor,
  Compass,
  FileSpreadsheet,
  Fuel,
  LayoutDashboard,
  Ship,
  Smartphone,
  Wrench,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: '1. Bảng Điều độ 1 Chạm', icon: LayoutDashboard },
  { href: '/dispatch', label: '2. Chi tiết Cont & Danh mục', icon: Compass },
  { href: '/orders', label: '3. Quyết toán & Công nợ', icon: FileSpreadsheet },
  { href: '/fleet', label: 'Đội sà lan & Thiết bị', icon: Ship },
  { href: '/tracking', label: 'Bản đồ AIS & Dầu', icon: Fuel },
  { href: '/maintenance', label: 'Bảo trì & Sửa chữa', icon: Wrench },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!pathname.startsWith('/mobile') && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) {
          reg.unregister().catch(() => {});
        }
      });
      if ('caches' in window) {
        caches.keys().then((keys) => {
          for (const k of keys) {
            if (k.startsWith('vietsun-tms-pwa')) caches.delete(k).catch(() => {});
          }
        });
      }
    }
  }, [pathname]);

  // Mobileweb PWA uses its own dedicated mobile-first layout
  if (pathname.startsWith('/mobile')) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-navy-900 text-white flex-shrink-0 hidden md:flex flex-col justify-between">
        <div>
          <div className="px-5 py-5 border-b border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-maritime-500 flex items-center justify-center">
              <Anchor className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-base tracking-tight">VietSun TMS</div>
              <div className="text-[11px] text-sky-300">Quản lý Vận tải Sà lan</div>
            </div>
          </div>

          <nav className="p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-maritime-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-navy-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800">
          <Link
            href="/mobile"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-lg bg-sky-500/20 border border-sky-400/30 text-sky-200 hover:bg-sky-500/30 text-xs font-semibold transition-colors"
          >
            <Smartphone className="w-4 h-4" />
            Mở Mobileweb Thuyền trưởng
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <span className="md:hidden font-bold text-navy-900 flex items-center gap-1.5">
              <Anchor className="w-4 h-4 text-maritime-600" /> VietSun TMS
            </span>
            <span className="hidden md:inline text-sm text-slate-500">
              Hệ thống Điều hành Vận tải Thủy nội địa • TP.HCM — Cái Mép — ĐBSCL
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/mobile"
              className="md:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-maritime-600 text-white text-xs font-medium"
            >
              <Smartphone className="w-3.5 h-3.5" /> App Tàu
            </Link>
            <div className="text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full font-medium">
              Điều độ viên: Admin
            </div>
          </div>
        </header>

        {/* Mobile top horizontal nav for frontweb on small screens */}
        <div className="md:hidden flex overflow-x-auto bg-white border-b border-slate-200 px-3 py-2 gap-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                  active ? 'bg-navy-900 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
