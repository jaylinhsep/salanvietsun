'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LogOut, Ship, User } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { type Vessel } from '@/lib/api';
import {
  CAPTAIN_SESSION_EVENT,
  clearCaptainSession,
  fetchCaptainWorkspace,
  type CaptainAccountUser,
} from '@/lib/captain-auth';

export default function MobileProfilePage() {
  const [captain, setCaptain] = useState<CaptainAccountUser | null>(null);
  const [vessel, setVessel] = useState<Vessel | null>(null);
  const [voyageCount, setVoyageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const ws = await fetchCaptainWorkspace();
      setCaptain(ws.captain);
      setVessel(ws.vessel);
      setVoyageCount((ws.voyages || []).length);
    } catch (err: any) {
      setError(err?.message || 'Không tải được hồ sơ tàu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspace();
    window.addEventListener(CAPTAIN_SESSION_EVENT, loadWorkspace);
    return () => window.removeEventListener(CAPTAIN_SESSION_EVENT, loadWorkspace);
  }, [loadWorkspace]);

  if (loading && !vessel) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center text-sm text-slate-500">
        Đang tải hồ sơ sà lan...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          {error}
        </div>
      )}

      {vessel && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-maritime-100 text-maritime-700 flex items-center justify-center">
                <Ship className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">{vessel.name}</h2>
                <p className="text-xs text-slate-500">
                  {vessel.code} • Đăng kiểm: {vessel.registration_no || '—'}
                </p>
              </div>
            </div>
            <StatusBadge status={vessel.status} />
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-2 border-t text-xs">
            <div className="bg-slate-50 p-2.5 rounded-xl">
              <div className="text-slate-400">Trọng tải</div>
              <div className="font-bold text-slate-900 mt-0.5">
                {vessel.capacity_teu || 0} TEUs ({vessel.capacity_tons || 0}T)
              </div>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl">
              <div className="text-slate-400">Công suất máy</div>
              <div className="font-bold text-slate-900 mt-0.5">
                {vessel.main_engine_hp || 0} HP ({vessel.fuel_norm_l_per_hour || 0} L/h)
              </div>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl">
              <div className="text-slate-400">Tồn dầu hiện tại</div>
              <div className="font-bold text-emerald-700 mt-0.5">
                {Number(vessel.current_fuel_liters || 0).toLocaleString('vi-VN')} Lít
              </div>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl">
              <div className="text-slate-400">Hạn đăng kiểm</div>
              <div className="font-bold text-slate-900 mt-0.5">
                {vessel.inspection_expiry ? String(vessel.inspection_expiry).slice(0, 10) : '—'}
              </div>
            </div>
          </div>
        </div>
      )}

      {captain && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase">
            <User className="w-4 h-4 text-maritime-600" /> Thông tin tài khoản Thuyền trưởng
          </div>
          <div className="text-sm font-bold text-slate-900">{captain.full_name}</div>
          <div className="text-xs text-slate-500">
            Tài khoản: <strong>{captain.username}</strong> • Gắn cố định tàu:{' '}
            <strong>{captain.vessel_code}</strong> • Số chuyến đã ghi nhận: <strong>{voyageCount}</strong>
          </div>
          <button
            type="button"
            onClick={() => clearCaptainSession()}
            className="mt-2 w-full py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs inline-flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> Đăng xuất khỏi tàu {captain.vessel_code}
          </button>
        </div>
      )}
    </div>
  );
}
