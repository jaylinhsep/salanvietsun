'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Anchor,
  Compass,
  Eye,
  EyeOff,
  Fuel,
  Lock,
  LogOut,
  ShieldCheck,
  User,
  Wrench,
} from 'lucide-react';
import {
  CAPTAIN_SESSION_EVENT,
  clearCaptainSession,
  getCaptainSession,
  loginCaptain,
  type CaptainSession,
} from '@/lib/captain-auth';

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<CaptainSession | null>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const sync = () => setSession(getCaptainSession());
    setMounted(true);
    sync();
    window.addEventListener(CAPTAIN_SESSION_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CAPTAIN_SESSION_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setSubmitting(true);
    try {
      const nextSession = await loginCaptain(username, password);
      setSession(nextSession);
      setPassword('');
    } catch (err: any) {
      setLoginError(err?.message || 'Đăng nhập thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    clearCaptainSession();
    setSession(null);
    setUsername('');
    setPassword('');
  };

  const navItems = [
    { href: '/mobile', label: 'Hành trình', icon: Compass },
    { href: '/mobile/fuel', label: 'Dầu DO', icon: Fuel },
    { href: '/mobile/maintenance', label: 'Bảo trì', icon: Wrench },
    { href: '/mobile/profile', label: 'Hồ sơ tàu', icon: User },
  ];

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-100 flex justify-center">
        <div className="w-full max-w-md bg-slate-50 min-h-screen flex flex-col shadow-xl">
          <header className="bg-navy-900 text-white px-4 py-3.5 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-maritime-500 flex items-center justify-center">
              <Anchor className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">VietSun Captain</div>
              <div className="text-[11px] text-sky-300">PWA Hiện trường</div>
            </div>
          </header>
          <div className="p-6 text-center text-sm text-slate-500">Đang khởi tạo...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-100 flex justify-center">
        <div className="w-full max-w-md bg-slate-50 min-h-screen flex flex-col shadow-xl">
          <header className="bg-navy-900 text-white px-4 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-maritime-500 flex items-center justify-center">
                <Anchor className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="font-bold text-sm leading-tight">VietSun Captain</div>
                <div className="text-[11px] text-sky-300">Đăng nhập Thuyền trưởng</div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] bg-white/10 px-2.5 py-1 rounded-full text-sky-200">
              <ShieldCheck className="w-3.5 h-3.5" /> Bảo mật
            </span>
          </header>

          <main className="flex-1 flex flex-col justify-center p-5">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
              <div className="text-center space-y-1.5">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-navy-900 text-white flex items-center justify-center shadow-sm">
                  <Lock className="w-5 h-5" />
                </div>
                <h1 className="text-lg font-bold text-slate-900">Đăng nhập Sà lan</h1>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Mỗi tài khoản chỉ xem và thao tác dữ liệu của đúng sà lan được phân công (NV18, NV36, NV38).
                </p>
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Tên đăng nhập (Mã tàu)
                  </label>
                  <input
                    required
                    autoComplete="username"
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-maritime-500"
                    placeholder="VD: nv18"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <input
                      required
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-maritime-500"
                      placeholder="Nhập mật khẩu được cấp"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-maritime-600 hover:bg-maritime-500 disabled:opacity-60 text-white font-bold text-sm shadow-sm transition-colors"
                >
                  {submitting ? 'Đang xác thực...' : 'Đăng nhập vào tàu'}
                </button>
              </form>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center">
      <div className="w-full max-w-md bg-slate-50 min-h-screen flex flex-col shadow-xl relative pb-20">
        {/* Mobile Header */}
        <header className="bg-navy-900 text-white px-4 py-3.5 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-maritime-500 flex items-center justify-center flex-shrink-0">
              <Anchor className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm leading-tight truncate">
                {session.vessel?.name || session.captain.vessel_code}
              </div>
              <div className="text-[11px] text-sky-300 truncate">
                {session.captain.full_name} • {session.captain.vessel_code}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-lg flex-shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" /> Đăng xuất
          </button>
        </header>

        {/* Main Mobile Content */}
        <main className="flex-1 p-4 space-y-4">{children}</main>

        {/* Bottom Tab Navigation */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 flex items-center justify-around py-2 z-20">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 text-[11px] font-medium px-3 py-1 rounded-lg ${
                  active ? 'text-maritime-600' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
