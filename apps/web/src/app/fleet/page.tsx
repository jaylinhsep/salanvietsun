'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Ship } from 'lucide-react';
import { API_URL, FALLBACK_VESSELS, fetchApi, type Vessel } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';

export default function FleetPage() {
  const [vessels, setVessels] = useState<Vessel[]>(FALLBACK_VESSELS);
  const [filter, setFilter] = useState<string>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    registration_no: '',
    vessel_type: 'SELF_PROPELLED',
    capacity_tons: 2000,
    capacity_teu: 80,
    main_engine_hp: 1000,
    captain_name: '',
    captain_phone: '',
  });

  const load = () => {
    fetchApi<Vessel[]>('/fleet/vessels', FALLBACK_VESSELS).then((r) => setVessels(r.data));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch(`${API_URL}/fleet/vessels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      load();
    } catch {
      // Offline demo add
      setVessels((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          ...form,
          fuel_norm_l_per_hour: 55,
          status: 'AVAILABLE',
          lat: 10.7615,
          lng: 106.7918,
          current_speed_knots: 0,
          current_fuel_liters: 5000,
        } as Vessel,
      ]);
    }
    setShowModal(false);
  };

  const filtered = filter === 'ALL' ? vessels : vessels.filter((v) => v.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý Đội tàu & Thiết bị</h1>
          <p className="text-sm text-slate-500">Hồ sơ sà lan tự hành, sà lan boong, tàu kéo, đăng kiểm & định mức</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-maritime-600 text-white text-sm font-medium hover:bg-maritime-500"
        >
          <Plus className="w-4 h-4" /> Thêm phương tiện
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {['ALL', 'AVAILABLE', 'IN_VOYAGE', 'MAINTENANCE'].map((st) => (
          <button
            key={st}
            onClick={() => setFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
              filter === st
                ? 'bg-navy-900 text-white border-navy-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {st === 'ALL' ? 'Tất cả' : st === 'AVAILABLE' ? 'Sẵn sàng' : st === 'IN_VOYAGE' ? 'Đang chạy' : 'Bảo trì'}
          </button>
        ))}
      </div>

      {/* Vessel Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((v) => (
          <div key={v.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center text-maritime-600">
                  <Ship className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">{v.name}</div>
                  <div className="text-xs text-slate-500">
                    {v.code} • Đăng ký: {v.registration_no}
                  </div>
                </div>
              </div>
              <StatusBadge status={v.status} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-lg">
              <div>
                <span className="text-slate-500">Trọng tải:</span>{' '}
                <strong className="text-slate-900">{v.capacity_tons.toLocaleString('vi-VN')} tấn</strong>
              </div>
              <div>
                <span className="text-slate-500">Sức chở:</span>{' '}
                <strong className="text-slate-900">{v.capacity_teu} TEU</strong>
              </div>
              <div>
                <span className="text-slate-500">Máy chính:</span>{' '}
                <strong className="text-slate-900">{v.main_engine_hp} HP</strong>
              </div>
              <div>
                <span className="text-slate-500">Định mức dầu:</span>{' '}
                <strong className="text-slate-900">{v.fuel_norm_l_per_hour} L/h</strong>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
              <div>
                <div className="text-slate-500">Thuyền trưởng</div>
                <div className="font-medium text-slate-800">{v.captain_name || 'Chưa gán'}</div>
              </div>
              <div className="text-right">
                <div className="text-slate-500">Hạn đăng kiểm</div>
                <div className="font-medium text-slate-800">{v.inspection_expiry || '2027-06-01'}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Thêm Sà lan / Tàu kéo mới</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <input
                required
                placeholder="Mã tàu (VD: VS-SL-06)"
                className="border rounded-lg px-3 py-2"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
              <input
                required
                placeholder="Số đăng ký (SG-8899)"
                className="border rounded-lg px-3 py-2"
                value={form.registration_no}
                onChange={(e) => setForm({ ...form, registration_no: e.target.value })}
              />
              <input
                required
                placeholder="Tên phương tiện"
                className="border rounded-lg px-3 py-2 col-span-2"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <select
                className="border rounded-lg px-3 py-2 col-span-2"
                value={form.vessel_type}
                onChange={(e) => setForm({ ...form, vessel_type: e.target.value })}
              >
                <option value="SELF_PROPELLED">Sà lan tự hành</option>
                <option value="DUMB_BARGE">Sà lan boong (không tự hành)</option>
                <option value="TUGBOAT">Tàu kéo</option>
              </select>
              <input
                type="number"
                placeholder="Trọng tải (tấn)"
                className="border rounded-lg px-3 py-2"
                value={form.capacity_tons}
                onChange={(e) => setForm({ ...form, capacity_tons: Number(e.target.value) })}
              />
              <input
                type="number"
                placeholder="Công suất (HP)"
                className="border rounded-lg px-3 py-2"
                value={form.main_engine_hp}
                onChange={(e) => setForm({ ...form, main_engine_hp: Number(e.target.value) })}
              />
              <input
                placeholder="Thuyền trưởng"
                className="border rounded-lg px-3 py-2"
                value={form.captain_name}
                onChange={(e) => setForm({ ...form, captain_name: e.target.value })}
              />
              <input
                placeholder="SĐT Thuyền trưởng"
                className="border rounded-lg px-3 py-2"
                value={form.captain_phone}
                onChange={(e) => setForm({ ...form, captain_phone: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border text-sm">
                Hủy
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-maritime-600 text-white text-sm font-medium">
                Lưu phương tiện
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
