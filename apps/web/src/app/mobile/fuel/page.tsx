'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Fuel, Ship } from 'lucide-react';
import { type FuelLog, type Vessel, type Voyage } from '@/lib/api';
import {
  CAPTAIN_SESSION_EVENT,
  fetchCaptainWorkspace,
  reportCaptainFuel,
} from '@/lib/captain-auth';

export default function MobileFuelPage() {
  const [vessel, setVessel] = useState<Vessel | null>(null);
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [logType, setLogType] = useState<'CONSUMPTION' | 'BUNKERING' | 'ROB'>('CONSUMPTION');
  const [voyageId, setVoyageId] = useState('');
  const [qty, setQty] = useState('');
  const [hours, setHours] = useState('');
  const [location, setLocation] = useState('Khu vực Sài Gòn / Bến Nghé');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const ws = await fetchCaptainWorkspace();
      setVessel(ws.vessel);
      setVoyages(ws.voyages || []);
      setFuelLogs(ws.fuelLogs || []);
      const active = (ws.voyages || []).find((vy) =>
        ['PLANNED', 'DEPARTED', 'IN_TRANSIT', 'ARRIVED'].includes(vy.status),
      );
      if (active) setVoyageId((prev) => prev || active.id);
    } catch (err: any) {
      setError(err?.message || 'Không tải được dữ liệu dầu của tàu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspace();
    window.addEventListener(CAPTAIN_SESSION_EVENT, loadWorkspace);
    return () => window.removeEventListener(CAPTAIN_SESSION_EVENT, loadWorkspace);
  }, [loadWorkspace]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vessel) return;
    setError('');
    setSubmitting(true);
    try {
      await reportCaptainFuel({
        vessel_id: vessel.id,
        voyage_id: voyageId || undefined,
        log_type: logType,
        quantity_liters: Number(qty),
        unit_price_vnd: 21500,
        engine_hours: hours ? Number(hours) : undefined,
        location_name: location,
        notes,
      });
      setSubmitted(true);
      setQty('');
      setHours('');
      setNotes('');
      await loadWorkspace();
    } catch (err: any) {
      setError(err?.message || 'Không thể gửi báo cáo dầu.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !vessel) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center text-sm text-slate-500">
        Đang tải dữ liệu nhiên liệu...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {vessel && (
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Ship className="w-4 h-4 text-maritime-600 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">
                {vessel.name} ({vessel.code})
              </div>
              <div className="text-[11px] text-slate-500">Chỉ ghi nhận cho tàu này</div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[10px] text-slate-400 uppercase">Tồn dầu hiện tại</div>
            <div className="text-sm font-bold text-emerald-700">
              {Number(vessel.current_fuel_liters || 0).toLocaleString('vi-VN')} L
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Fuel className="w-5 h-5 text-emerald-600" />
          <h2 className="font-bold text-slate-900">Báo cáo Dầu DO / Định mức</h2>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs mb-3 font-medium">
            {error}
          </div>
        )}

        {submitted && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Đã gửi báo cáo nhiên liệu về hệ thống điều độ!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Loại báo cáo</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'CONSUMPTION', label: 'Tiêu thụ ca' },
                { key: 'BUNKERING', label: 'Cấp dầu' },
                { key: 'ROB', label: 'Kiểm kê ROB' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setLogType(opt.key as any)}
                  className={`py-2 px-2 rounded-lg text-xs font-semibold border ${
                    logType === opt.key
                      ? 'bg-maritime-600 text-white border-maritime-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {voyages.length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                Gắn vào chuyến (tuỳ chọn)
              </label>
              <select
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white"
                value={voyageId}
                onChange={(e) => setVoyageId(e.target.value)}
              >
                <option value="">-- Không gắn chuyến cụ thể --</option>
                {voyages.slice(0, 10).map((vy) => (
                  <option key={vy.id} value={vy.id}>
                    {vy.voyage_no} ({vy.origin_name || '—'} → {vy.dest_name || '—'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Số lít dầu DO *</label>
            <input
              type="number"
              required
              min="1"
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-base font-bold"
              placeholder="VD: 350"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Số giờ máy chạy</label>
              <input
                type="number"
                step="0.1"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                placeholder="VD: 8.5"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Vị trí / Trạm</label>
              <input
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Ghi chú</label>
            <textarea
              rows={2}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
              placeholder="VD: Máy chạy êm, không hao dầu bất thường..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !vessel}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-sm"
          >
            {submitting ? 'Đang gửi...' : 'Gửi báo cáo Dầu DO'}
          </button>
        </form>
      </div>

      {/* Scoped Fuel Logs for this Vessel */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-2.5">
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">
          Lịch sử dầu gần đây ({vessel?.code})
        </div>
        {fuelLogs.length === 0 ? (
          <div className="text-xs text-slate-400 text-center py-3">Chưa có bản ghi dầu nào.</div>
        ) : (
          <div className="space-y-2">
            {fuelLogs.slice(0, 8).map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-800">{log.log_type}</div>
                  <div className="text-[11px] text-slate-500">
                    {log.location_name || '—'} • {new Date(log.logged_at).toLocaleString('vi-VN')}
                  </div>
                </div>
                <div className="font-bold text-slate-900">
                  {Number(log.quantity_liters || 0).toLocaleString('vi-VN')} L
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
