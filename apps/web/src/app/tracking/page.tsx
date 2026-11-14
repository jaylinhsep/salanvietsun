'use client';

import React, { useEffect, useState } from 'react';
import { Fuel, Navigation, Plus } from 'lucide-react';
import {
  API_URL,
  FALLBACK_FUEL_LOGS,
  FALLBACK_PORTS,
  FALLBACK_VESSELS,
  fetchApi,
  formatVND,
  type FuelLog,
  type Port,
  type Vessel,
} from '@/lib/api';
import { MapView } from '@/components/MapView';
import { StatusBadge } from '@/components/StatusBadge';

export default function TrackingPage() {
  const [vessels, setVessels] = useState<Vessel[]>(FALLBACK_VESSELS);
  const [ports, setPorts] = useState<Port[]>(FALLBACK_PORTS);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>(FALLBACK_FUEL_LOGS);
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [form, setForm] = useState({
    vessel_id: FALLBACK_VESSELS[0].id,
    log_type: 'BUNKERING' as 'BUNKERING' | 'CONSUMPTION' | 'ROB',
    quantity_liters: 3000,
    unit_price_vnd: 21800,
    location_name: 'Cảng Cát Lái',
    notes: '',
  });

  const load = () => {
    fetchApi<Vessel[]>('/tracking/live', FALLBACK_VESSELS).then((r) => setVessels(r.data));
    fetchApi<Port[]>('/dispatch/ports', FALLBACK_PORTS).then((r) => setPorts(r.data));
    fetchApi<FuelLog[]>('/tracking/fuel', FALLBACK_FUEL_LOGS).then((r) => setFuelLogs(r.data));
  };

  useEffect(() => {
    load();
  }, []);

  const handleAddFuel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch(`${API_URL}/tracking/fuel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      load();
    } catch {
      const v = vessels.find((x) => x.id === form.vessel_id);
      setFuelLogs((prev) => [
        {
          id: `local-${Date.now()}`,
          vessel_id: form.vessel_id,
          vessel_code: v?.code || '',
          vessel_name: v?.name || '',
          log_type: form.log_type,
          quantity_liters: form.quantity_liters,
          unit_price_vnd: form.unit_price_vnd,
          location_name: form.location_name,
          notes: form.notes,
          reported_by: 'Điều độ viên',
          logged_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
    setShowFuelModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Giám sát Hành trình AIS/GPS & Nhiên liệu</h1>
          <p className="text-sm text-slate-500">Theo dõi tọa độ PostGIS, tốc độ hải lý, geofence cảng & nhật ký dầu DO</p>
        </div>
        <button
          onClick={() => setShowFuelModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-maritime-600 text-white text-sm font-medium hover:bg-maritime-500"
        >
          <Plus className="w-4 h-4" /> Ghi nhận Cấp / Tiêu thụ dầu
        </button>
      </div>

      <MapView vessels={vessels} ports={ports} heightClass="h-[360px]" />

      {/* Live Vessel Telemetry */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 font-semibold text-slate-900 flex items-center gap-2">
          <Navigation className="w-4 h-4 text-maritime-600" /> Tín hiệu AIS / Tồn két dầu (ROB) hiện tại
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3">Tàu</th>
                <th className="px-4 py-3">Tọa độ (Lat, Lng)</th>
                <th className="px-4 py-3">Vùng cảng (Geofence)</th>
                <th className="px-4 py-3">Tốc độ</th>
                <th className="px-4 py-3">Dầu tồn (ROB)</th>
                <th className="px-4 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vessels.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-3 font-medium">
                    {v.code} — {v.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {v.lat?.toFixed(4)}, {v.lng?.toFixed(4)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{v.nearby_port || 'Đang trên tuyến sông'}</td>
                  <td className="px-4 py-3">{v.current_speed_knots} kn</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {v.current_fuel_liters.toLocaleString('vi-VN')} L
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={v.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fuel Logs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 font-semibold text-slate-900 flex items-center gap-2">
          <Fuel className="w-4 h-4 text-emerald-600" /> Nhật ký Cấp dầu & Tiêu thụ Nhiên liệu
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3">Tàu</th>
                <th className="px-4 py-3">Loại</th>
                <th className="px-4 py-3">Số lượng</th>
                <th className="px-4 py-3">Thành tiền</th>
                <th className="px-4 py-3">Vị trí / Ghi chú</th>
                <th className="px-4 py-3">Người báo cáo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fuelLogs.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-3 font-medium">{f.vessel_code}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={f.log_type} />
                  </td>
                  <td className="px-4 py-3 font-semibold">{Number(f.quantity_liters).toLocaleString('vi-VN')} L</td>
                  <td className="px-4 py-3">{formatVND(Number(f.quantity_liters) * Number(f.unit_price_vnd || 0))}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <div className="font-medium text-slate-800">{f.location_name}</div>
                    <div>{f.notes}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{f.reported_by || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showFuelModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={handleAddFuel} className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Ghi nhận Nhiên liệu (DO)</h2>
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
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={form.log_type}
                onChange={(e) => setForm({ ...form, log_type: e.target.value as any })}
              >
                <option value="BUNKERING">Cấp dầu (Bunkering)</option>
                <option value="CONSUMPTION">Tiêu thụ chuyến</option>
                <option value="ROB">Kiểm kê tồn két (ROB)</option>
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  required
                  placeholder="Số lít"
                  className="border rounded-lg px-3 py-2"
                  value={form.quantity_liters}
                  onChange={(e) => setForm({ ...form, quantity_liters: Number(e.target.value) })}
                />
                <input
                  type="number"
                  placeholder="Đơn giá (VNĐ/lít)"
                  className="border rounded-lg px-3 py-2"
                  value={form.unit_price_vnd}
                  onChange={(e) => setForm({ ...form, unit_price_vnd: Number(e.target.value) })}
                />
              </div>
              <input
                placeholder="Vị trí cấp/đo dầu"
                className="w-full border rounded-lg px-3 py-2"
                value={form.location_name}
                onChange={(e) => setForm({ ...form, location_name: e.target.value })}
              />
              <input
                placeholder="Ghi chú"
                className="w-full border rounded-lg px-3 py-2"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowFuelModal(false)} className="px-4 py-2 rounded-lg border text-sm">
                Hủy
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-maritime-600 text-white text-sm font-medium">
                Lưu nhật ký dầu
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
