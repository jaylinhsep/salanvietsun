'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Anchor, Compass, Fuel, User, Wrench, ArrowLeft } from 'lucide-react';

const TABS = [
  { href: '/mobile', label: 'Chuyến đi', icon: Compass },
  { href: '/mobile/fuel', label: 'Nhiên liệu', icon: Fuel },
  { href: '/mobile/maintenance', label: 'Báo hỏng', icon: Wrench },
  { href: '/mobile/profile', label: 'Tàu', icon: User },
];

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => null);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center">
      <div className="w-full max-w-md bg-slate-50 min-h-screen flex flex-col shadow-xl relative pb-20">
        {/* Mobile Header */}
        <header className="bg-navy-900 text-white px-4 py-3.5 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-maritime-500 flex items-center justify-center">
              <Anchor className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">VietSun Captain</div>
              <div className="text-[11px] text-sky-300">PWA Hiện trường • VS-SL-01</div>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-lg"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Web Điều độ
          </Link>
        </header>

        <main className="flex-1 p-4 space-y-4">{children}</main>

        {/* Bottom Tab Bar */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 flex justify-around py-2 px-1 z-30">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-medium ${
                  active ? 'text-maritime-600' : 'text-slate-500'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-maritime-600' : 'text-slate-400'}`} />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
