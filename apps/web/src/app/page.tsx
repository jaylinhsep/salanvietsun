'use client';

import React, { useEffect, useState } from 'react';
import { Ship, Compass, AlertTriangle, Wallet, Fuel } from 'lucide-react';
import {
  FALLBACK_INVOICES,
  FALLBACK_MAINTENANCE,
  FALLBACK_PORTS,
  FALLBACK_VESSELS,
  FALLBACK_VOYAGES,
  fetchApi,
  formatVND,
  type Invoice,
  type MaintenanceOrder,
  type Port,
  type Vessel,
  type Voyage,
} from '@/lib/api';
import { MapView } from '@/components/MapView';
import { StatusBadge } from '@/components/StatusBadge';

export default function DashboardPage() {
  const [vessels, setVessels] = useState<Vessel[]>(FALLBACK_VESSELS);
  const [ports, setPorts] = useState<Port[]>(FALLBACK_PORTS);
  const [voyages, setVoyages] = useState<Voyage[]>(FALLBACK_VOYAGES);
  const [invoices, setInvoices] = useState<Invoice[]>(FALLBACK_INVOICES);
  const [maintenance, setMaintenance] = useState<MaintenanceOrder[]>(FALLBACK_MAINTENANCE);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchApi<Vessel[]>('/fleet/vessels', FALLBACK_VESSELS),
      fetchApi<Port[]>('/dispatch/ports', FALLBACK_PORTS),
      fetchApi<Voyage[]>('/dispatch/voyages', FALLBACK_VOYAGES),
      fetchApi<Invoice[]>('/orders/invoices', FALLBACK_INVOICES),
      fetchApi<MaintenanceOrder[]>('/maintenance', FALLBACK_MAINTENANCE),
    ]).then(([v, p, vy, inv, mnt]) => {
      setVessels(v.data);
      setPorts(p.data);
      setVoyages(vy.data);
      setInvoices(inv.data);
      setMaintenance(mnt.data);
      setIsLive(v.live);
    });
  }, []);

  const inVoyageCount = vessels.filter((v) => v.status === 'IN_VOYAGE').length;
  const totalDebt = invoices.reduce((acc, i) => acc + Number(i.balance_due || 0), 0);
  const openMaintenance = maintenance.filter((m) => m.status !== 'COMPLETED').length;
  const totalFuel = vessels.reduce((acc, v) => acc + Number(v.current_fuel_liters || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Trung tâm Điều hành Đội Sà lan</h1>
          <p className="text-sm text-slate-500">Theo dõi vị trí AIS/GPS, tiến độ chuyến, nhiên liệu & công nợ realtime</p>
        </div>
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
            isLive
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {isLive ? 'Đang kết nối API + PostGIS' : 'Chế độ Demo (chưa kết nối DB)'}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Đội tàu hoạt động</span>
            <Ship className="w-5 h-5 text-maritime-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {inVoyageCount} / {vessels.length} tàu
          </div>
          <div className="mt-1 text-xs text-slate-500">Đang chạy chuyến trên tuyến</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Tổng tồn dầu (ROB)</span>
            <Fuel className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {totalFuel.toLocaleString('vi-VN')} lít
          </div>
          <div className="mt-1 text-xs text-slate-500">Dầu DO trên toàn đội sà lan</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Công nợ phải thu</span>
            <Wallet className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{formatVND(totalDebt)}</div>
          <div className="mt-1 text-xs text-slate-500">{invoices.length} hóa đơn đang theo dõi</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Phiếu bảo trì mở</span>
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{openMaintenance} phiếu</div>
          <div className="mt-1 text-xs text-slate-500">Kiểm tra đăng kiểm & sửa chữa</div>
        </div>
      </div>

      {/* Live Map */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Compass className="w-4 h-4 text-maritime-600" />
            Bản đồ Hành trình Sà lan (AIS/GPS + OpenSeaMap)
          </h2>
          <span className="text-xs text-slate-500">Cát Lái • Cái Mép • Long An • Cần Thơ</span>
        </div>
        <MapView vessels={vessels} ports={ports} voyages={voyages} heightClass="h-[380px]" />
      </div>

      {/* Active Voyages Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 font-semibold text-slate-900">
          Các chuyến vận tải đang điều độ
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Mã chuyến</th>
                <th className="px-4 py-3">Phương tiện</th>
                <th className="px-4 py-3">Tuyến cảng</th>
                <th className="px-4 py-3">Hàng hóa</th>
                <th className="px-4 py-3">Hải lý</th>
                <th className="px-4 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {voyages.map((vy) => (
                <tr key={vy.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-navy-900">{vy.voyage_no}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{vy.vessel_name}</div>
                    <div className="text-xs text-slate-500">Thuyền trưởng: {vy.captain_name || 'N/A'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-900">{vy.origin_name}</div>
                    <div className="text-xs text-maritime-600">→ {vy.dest_name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{vy.cargo_type || 'Tổng hợp'}</div>
                    <div className="text-xs text-slate-500">{vy.cargo_weight_tons || 0} tấn</div>
                  </td>
                  <td className="px-4 py-3">{vy.planned_distance_nm} NM</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={vy.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
