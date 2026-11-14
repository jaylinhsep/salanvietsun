'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Wrench } from 'lucide-react';
import {
  API_URL,
  FALLBACK_MAINTENANCE,
  FALLBACK_VESSELS,
  fetchApi,
  formatVND,
  type MaintenanceOrder,
  type Vessel,
} from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';

export default function MaintenancePage() {
  const [items, setItems] = useState<MaintenanceOrder[]>(FALLBACK_MAINTENANCE);
  const [vessels, setVessels] = useState<Vessel[]>(FALLBACK_VESSELS);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    vessel_id: FALLBACK_VESSELS[0].id,
    title: '',
    maintenance_type: 'PREVENTIVE',
    priority: 'MEDIUM',
    estimated_cost: 10000000,
    description: '',
  });

  const load = () => {
    fetchApi<MaintenanceOrder[]>('/maintenance', FALLBACK_MAINTENANCE).then((r) => setItems(r.data));
    fetchApi<Vessel[]>('/fleet/vessels', FALLBACK_VESSELS).then((r) => setVessels(r.data));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch(`${API_URL}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      load();
    } catch {
      const v = vessels.find((x) => x.id === form.vessel_id);
      setItems((prev) => [
        {
          id: `local-${Date.now()}`,
          ticket_no: `MNT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
          vessel_id: form.vessel_id,
          vessel_code: v?.code || '',
          vessel_name: v?.name || '',
          title: form.title,
          maintenance_type: form.maintenance_type,
          priority: form.priority as any,
          status: 'OPEN',
          estimated_cost: form.estimated_cost,
          actual_cost: 0,
          description: form.description,
        },
        ...prev,
      ]);
    }
    setShowModal(false);
  };

  const markCompleted = async (m: MaintenanceOrder) => {
    try {
      await fetch(`${API_URL}/maintenance/${m.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED', actual_cost: m.estimated_cost }),
      });
      load();
    } catch {
      setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: 'COMPLETED' } : x)));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bảo trì & Sửa chữa Đội tàu</h1>
          <p className="text-sm text-slate-500">Quản lý lịch bảo dưỡng định kỳ, lên triền (dry-dock), sửa chữa sự cố & chi phí vật tư</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-maritime-600 text-white text-sm font-medium hover:bg-maritime-500"
        >
          <Plus className="w-4 h-4" /> Tạo phiếu bảo trì
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {items.map((m) => (
          <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <Wrench className="w-4 h-4 text-amber-600" />
                <span className="font-bold text-slate-900">{m.ticket_no}</span>
                <StatusBadge status={m.priority} />
                <StatusBadge status={m.status} />
                <span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-medium">{m.vessel_name}</span>
              </div>
              <div className="text-base font-semibold text-slate-900">{m.title}</div>
              <div className="text-xs text-slate-600">{m.description}</div>
              <div className="text-xs text-slate-500">
                Dự toán: <strong className="text-slate-800">{formatVND(m.estimated_cost)}</strong> • Người báo cáo:{' '}
                {m.reported_by || 'Kỹ thuật'}
              </div>
            </div>

            {m.status !== 'COMPLETED' && (
              <button
                onClick={() => markCompleted(m)}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 self-start md:self-center"
              >
                Nghiệm thu hoàn tất
              </button>
            )}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Tạo Phiếu Bảo trì / Sửa chữa</h2>
            <div className="space-y-3 text-sm">
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={form.vessel_id}
                onChange={(e) => setForm({ ...form, vessel_id: e.target.value })}
              >
                {vessels.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.code} — {v.name}
                  </option>
                ))}
              </select>
              <input
                required
                placeholder="Hạng mục bảo trì / sửa chữa"
                className="w-full border rounded-lg px-3 py-2"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  className="border rounded-lg px-3 py-2"
                  value={form.maintenance_type}
                  onChange={(e) => setForm({ ...form, maintenance_type: e.target.value })}
                >
                  <option value="PREVENTIVE">Định kỳ</option>
                  <option value="CORRECTIVE">Sửa chữa sự cố</option>
                  <option value="DRY_DOCK">Lên triền</option>
                  <option value="INSPECTION">Đăng kiểm</option>
                </select>
                <select
                  className="border rounded-lg px-3 py-2"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  <option value="LOW">Thấp</option>
                  <option value="MEDIUM">Trung bình</option>
                  <option value="HIGH">Cao</option>
                  <option value="CRITICAL">Khẩn cấp</option>
                </select>
              </div>
              <input
                type="number"
                placeholder="Chi phí dự toán (VNĐ)"
                className="w-full border rounded-lg px-3 py-2"
                value={form.estimated_cost}
                onChange={(e) => setForm({ ...form, estimated_cost: Number(e.target.value) })}
              />
              <textarea
                placeholder="Mô tả chi tiết tình trạng..."
                className="w-full border rounded-lg px-3 py-2"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border text-sm">
                Hủy
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-maritime-600 text-white text-sm font-medium">
                Tạo phiếu
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
