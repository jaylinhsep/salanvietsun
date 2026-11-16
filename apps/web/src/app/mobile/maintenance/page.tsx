'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Ship, Wrench } from 'lucide-react';
import { type MaintenanceOrder, type Vessel } from '@/lib/api';
import {
  CAPTAIN_SESSION_EVENT,
  fetchCaptainWorkspace,
  reportCaptainMaintenance,
} from '@/lib/captain-auth';

export default function MobileMaintenancePage() {
  const [vessel, setVessel] = useState<Vessel | null>(null);
  const [orders, setOrders] = useState<MaintenanceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [desc, setDesc] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const ws = await fetchCaptainWorkspace();
      setVessel(ws.vessel);
      setOrders(ws.maintenanceOrders || []);
    } catch (err: any) {
      setError(err?.message || 'Không tải được dữ liệu bảo trì của tàu.');
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
      await reportCaptainMaintenance({
        vessel_id: vessel.id,
        title,
        maintenance_type: 'CORRECTIVE',
        priority,
        description: desc,
      });
      setSubmitted(true);
      setTitle('');
      setDesc('');
      await loadWorkspace();
    } catch (err: any) {
      setError(err?.message || 'Không thể gửi phiếu bảo trì.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !vessel) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center text-sm text-slate-500">
        Đang tải dữ liệu bảo trì...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {vessel && (
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ship className="w-4 h-4 text-maritime-600" />
            <div>
              <div className="text-xs font-bold text-slate-900">
                {vessel.name} ({vessel.code})
              </div>
              <div className="text-[11px] text-slate-500">Báo cáo sự cố riêng cho tàu này</div>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
            {orders.length} phiếu
          </span>
        </div>
      )}

      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Wrench className="w-5 h-5 text-amber-600" />
          <h2 className="font-bold text-slate-900">Báo sự cố / Yêu cầu Sửa chữa</h2>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs mb-3 font-medium">
            {error}
          </div>
        )}

        {submitted && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Đã gửi phiếu yêu cầu bảo trì cho Bộ phận Kỹ thuật!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Hạng mục hư hỏng *</label>
            <input
              required
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
              placeholder="VD: Rò rỉ két làm mát máy chính..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Mức độ khẩn cấp</label>
            <select
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white"
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
            >
              <option value="CRITICAL">Khẩn cấp (Ngưng chạy tàu)</option>
              <option value="HIGH">Cao (Cần xử lý ngay khi cập cảng)</option>
              <option value="MEDIUM">Trung bình</option>
              <option value="LOW">Thấp</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Mô tả chi tiết</label>
            <textarea
              rows={3}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
              placeholder="Mô tả triệu chứng, vật tư cần mang xuống tàu..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !vessel}
            className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white font-bold text-sm"
          >
            {submitting ? 'Đang gửi...' : 'Gửi phiếu Bảo trì / Sửa chữa'}
          </button>
        </form>
      </div>

      {/* Scoped Maintenance Tickets */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-2.5">
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">
          Lịch sử bảo trì ({vessel?.code})
        </div>
        {orders.length === 0 ? (
          <div className="text-xs text-slate-400 text-center py-3">Chưa có phiếu bảo trì nào.</div>
        ) : (
          <div className="space-y-2">
            {orders.slice(0, 8).map((o) => (
              <div key={o.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{o.title}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {o.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {o.ticket_no} • Mức: {o.priority}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
