'use client';

import React, { useEffect, useState } from 'react';
import { Compass, Plus } from 'lucide-react';
import {
  API_URL,
  FALLBACK_PORTS,
  FALLBACK_VESSELS,
  FALLBACK_VOYAGES,
  fetchApi,
  type Port,
  type Vessel,
  type Voyage,
} from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';

export default function DispatchPage() {
  const [voyages, setVoyages] = useState<Voyage[]>(FALLBACK_VOYAGES);
  const [vessels, setVessels] = useState<Vessel[]>(FALLBACK_VESSELS);
  const [ports, setPorts] = useState<Port[]>(FALLBACK_PORTS);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    voyage_no: `VOY-2026-00${Math.floor(84 + Math.random() * 15)}`,
    vessel_id: FALLBACK_VESSELS[2].id,
    origin_port_id: FALLBACK_PORTS[0].id,
    destination_port_id: FALLBACK_PORTS[1].id,
    etd: new Date().toISOString().slice(0, 16),
    eta: new Date(Date.now() + 12 * 3600 * 1000).toISOString().slice(0, 16),
    captain_notes: '',
  });

  const load = () => {
    fetchApi<Voyage[]>('/dispatch/voyages', FALLBACK_VOYAGES).then((r) => setVoyages(r.data));
    fetchApi<Vessel[]>('/fleet/vessels', FALLBACK_VESSELS).then((r) => setVessels(r.data));
    fetchApi<Port[]>('/dispatch/ports', FALLBACK_PORTS).then((r) => setPorts(r.data));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch(`${API_URL}/dispatch/voyages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      load();
    } catch {
      const v = vessels.find((x) => x.id === form.vessel_id);
      const op = ports.find((x) => x.id === form.origin_port_id);
      const dp = ports.find((x) => x.id === form.destination_port_id);
      setVoyages((prev) => [
        {
          id: `local-${Date.now()}`,
          voyage_no: form.voyage_no,
          status: 'PLANNED',
          etd: form.etd,
          eta: form.eta,
          planned_distance_nm: 42.5,
          captain_notes: form.captain_notes,
          vessel_id: form.vessel_id,
          vessel_code: v?.code || '',
          vessel_name: v?.name || '',
          captain_name: v?.captain_name,
          origin_name: op?.name || '',
          dest_name: dp?.name || '',
        },
        ...prev,
      ]);
    }
    setShowModal(false);
  };

  const advanceStatus = async (vy: Voyage, nextStatus: string) => {
    try {
      await fetch(`${API_URL}/dispatch/voyages/${vy.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      load();
    } catch {
      setVoyages((prev) => prev.map((x) => (x.id === vy.id ? { ...x, status: nextStatus as any } : x)));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Điều độ & Lập kế hoạch chuyến</h1>
          <p className="text-sm text-slate-500">Phân bổ sà lan, đầu kéo, tính hải lý PostGIS & theo dõi ETD/ETA</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-maritime-600 text-white text-sm font-medium hover:bg-maritime-500"
        >
          <Plus className="w-4 h-4" /> Lập lệnh điều độ
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {voyages.map((vy) => (
          <div key={vy.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <Compass className="w-4 h-4 text-maritime-600" />
                <span className="font-bold text-navy-900">{vy.voyage_no}</span>
                <StatusBadge status={vy.status} />
                {vy.order_no && (
                  <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    Đơn: {vy.order_no}
                  </span>
                )}
              </div>
              <div className="text-sm font-medium text-slate-900">
                {vy.origin_name} <span className="text-maritime-600 mx-1">→</span> {vy.dest_name}{' '}
                <span className="text-xs text-slate-500">({vy.planned_distance_nm} hải lý)</span>
              </div>
              <div className="text-xs text-slate-500">
                Tàu: <strong className="text-slate-700">{vy.vessel_name}</strong> • Thuyền trưởng: {vy.captain_name || 'N/A'}
                {vy.captain_notes && ` • Ghi chú: "${vy.captain_notes}"`}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {vy.status === 'PLANNED' && (
                <button
                  onClick={() => advanceStatus(vy, 'IN_TRANSIT')}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-medium hover:bg-sky-500"
                >
                  Xuất bến
                </button>
              )}
              {vy.status === 'IN_TRANSIT' && (
                <button
                  onClick={() => advanceStatus(vy, 'COMPLETED')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500"
                >
                  Hoàn tất chuyến
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Tạo Lệnh Điều độ Chuyến</h2>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mã chuyến</label>
                <input
                  required
                  className="w-full border rounded-lg px-3 py-2"
                  value={form.voyage_no}
                  onChange={(e) => setForm({ ...form, voyage_no: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Chọn Sà lan</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={form.vessel_id}
                  onChange={(e) => setForm({ ...form, vessel_id: e.target.value })}
                >
                  {vessels.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code} — {v.name} ({v.capacity_tons}T)
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Cảng đi</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2"
                    value={form.origin_port_id}
                    onChange={(e) => setForm({ ...form, origin_port_id: e.target.value })}
                  >
                    {ports.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Cảng đến</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2"
                    value={form.destination_port_id}
                    onChange={(e) => setForm({ ...form, destination_port_id: e.target.value })}
                  >
                    {ports.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ghi chú cho Thuyền trưởng</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="VD: Lưu ý thủy triều kênh Chợ Gạo..."
                  value={form.captain_notes}
                  onChange={(e) => setForm({ ...form, captain_notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border text-sm">
                Hủy
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-maritime-600 text-white text-sm font-medium">
                Phát lệnh điều độ
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
