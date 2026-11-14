'use client';

import React, { useState } from 'react';
import { Fuel } from 'lucide-react';
import { API_URL, FALLBACK_VESSELS } from '@/lib/api';

export default function MobileFuelPage() {
  const [logType, setLogType] = useState<'BUNKERING' | 'CONSUMPTION' | 'ROB'>('CONSUMPTION');
  const [liters, setLiters] = useState(400);
  const [engineHours, setEngineHours] = useState(4132.5);
  const [location, setLocation] = useState('Sông Lòng Tàu');
  const [savedMsg, setSavedMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch(`${API_URL}/tracking/fuel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vessel_id: FALLBACK_VESSELS[0].id,
          log_type: logType,
          quantity_liters: liters,
          engine_hours: engineHours,
          location_name: location,
          reported_by: 'Thuyền trưởng (PWA)',
        }),
      });
      setSavedMsg(`Đã gửi báo cáo ${logType} (${liters} lít) về trung tâm!`);
    } catch {
      setSavedMsg(`[Offline/Demo] Đã lưu báo cáo ${logType} (${liters} lít).`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Fuel className="w-5 h-5 text-emerald-600" />
        <h1 className="text-lg font-bold text-slate-900">Báo cáo Nhiên liệu & Giờ máy</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3 text-sm">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Loại báo cáo</label>
          <select
            className="w-full border rounded-xl px-3 py-2.5"
            value={logType}
            onChange={(e) => setLogType(e.target.value as any)}
          >
            <option value="CONSUMPTION">Tiêu thụ trong ca / chuyến</option>
            <option value="BUNKERING">Nhận cấp dầu (Bunkering)</option>
            <option value="ROB">Đo tồn két thực tế (ROB)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Số lượng dầu DO (Lít)</label>
          <input
            type="number"
            required
            className="w-full border rounded-xl px-3 py-2.5"
            value={liters}
            onChange={(e) => setLiters(Number(e.target.value))}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Số giờ máy chính hiện tại</label>
          <input
            type="number"
            step="0.1"
            className="w-full border rounded-xl px-3 py-2.5"
            value={engineHours}
            onChange={(e) => setEngineHours(Number(e.target.value))}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Vị trí / Trạm dầu</label>
          <input
            className="w-full border rounded-xl px-3 py-2.5"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="w-full py-3 rounded-xl bg-maritime-600 text-white font-semibold text-sm"
        >
          Gửi báo cáo dầu
        </button>
      </form>

      {savedMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl p-3 font-medium">
          {savedMsg}
        </div>
      )}
    </div>
  );
}
