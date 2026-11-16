'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Anchor,
  Calculator,
  Download,
  Eye,
  FileSpreadsheet,
  Fuel,
  Pencil,
  Check,
  Ship,
  TrendingUp,
  Wrench,
  X,
  Wallet,
} from 'lucide-react';
import {
  API_URL,
  FALLBACK_INVOICES,
  FALLBACK_ORDERS,
  fetchApi,
  formatVND,
  type Customer,
  type Invoice,
  type Order,
  type Vessel,
  type Voyage,
} from '@/lib/api';
import {
  computeVoyagePnl,
  loadWorkflowSnapshot,
  updateSettlementAction,
} from '@/lib/workflow-store';
import { StatusBadge } from '@/components/StatusBadge';
import { getBargeColorStyle } from '@/lib/barge-colors';
import { AccountingOutputReportPanel } from '@/components/AccountingOutputReportPanel';
import { AccountingPnlSummaryPanel } from '@/components/accounting/AccountingPnlSummaryPanel';
import { AccountingPortAndFixedPanel } from '@/components/accounting/AccountingPortAndFixedPanel';
import { AccountingFuelReportPanel } from '@/components/accounting/AccountingFuelReportPanel';
import { AccountingSuppliesPanel } from '@/components/accounting/AccountingSuppliesPanel';
import { AccountingVendorPanel } from '@/components/accounting/AccountingVendorPanel';

type OrdersTab =
  | 'SETTLEMENT'
  | 'YIELD'
  | 'PNL'
  | 'PORT_FIXED'
  | 'FUEL'
  | 'SUPPLIES'
  | 'VENDOR'
  | 'INVOICES';

export default function SettlementAndOrdersPage() {
  const [tab, setTab] = useState<OrdersTab>('SETTLEMENT');
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>(FALLBACK_ORDERS);
  const [invoices, setInvoices] = useState<Invoice[]>(FALLBACK_INVOICES);

  // Filters
  const [filterFrom, setFilterFrom] = useState<string>('');
  const [filterTo, setFilterTo] = useState<string>('');
  const [filterVesselId, setFilterVesselId] = useState<string>('');
  const [filterCustomer, setFilterCustomer] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Inline settlement edit
  const [editingVoyageId, setEditingVoyageId] = useState<string | null>(null);
  const [costForm, setCostForm] = useState({
    fuel_start_liters: 0,
    fuel_added_liters: 0,
    fuel_end_liters: 0,
    fuel_unit_price: 21500,
    port_fee: 0,
    crew_salary: 0,
    other_cost: 0,
  });

  // POD photo preview
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  const loadAll = async () => {
    const [snap, ordRes, invRes] = await Promise.all([
      loadWorkflowSnapshot(),
      fetchApi<Order[]>('/orders', FALLBACK_ORDERS),
      fetchApi<Invoice[]>('/orders/invoices', FALLBACK_INVOICES),
    ]);
    setVoyages(snap.voyages);
    setVessels(snap.vessels);
    setCustomers(snap.customers);
    setOrders(ordRes.data);
    setInvoices(invRes.data);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const filteredVoyages = useMemo(() => {
    return voyages.filter((vy) => {
      const dateStr = (vy.received_date || vy.created_at || '').slice(0, 10);
      if (filterFrom && dateStr && dateStr < filterFrom) return false;
      if (filterTo && dateStr && dateStr > filterTo) return false;
      if (filterVesselId && vy.vessel_id !== filterVesselId) return false;
      if (
        filterCustomer &&
        !(vy.customer_name || '').toLowerCase().includes(filterCustomer.toLowerCase()) &&
        vy.customer_id !== filterCustomer
      ) {
        return false;
      }
      if (filterStatus && vy.status !== filterStatus) return false;
      return true;
    });
  }, [voyages, filterFrom, filterTo, filterVesselId, filterCustomer, filterStatus]);

  const totals = useMemo(() => {
    let revenue = 0,
      fuelConsumed = 0,
      fuelCost = 0,
      otherCosts = 0,
      netProfit = 0;
    for (const vy of filteredVoyages) {
      const p = computeVoyagePnl(vy);
      revenue += p.revenue;
      fuelConsumed += p.fuelConsumed;
      fuelCost += p.fuelCost;
      otherCosts += p.portFee + p.crewSalary + p.otherCost;
      netProfit += p.netProfit;
    }
    return { revenue, fuelConsumed, fuelCost, otherCosts, netProfit };
  }, [filteredVoyages]);

  const startEditSettlement = (vy: Voyage) => {
    setEditingVoyageId(vy.id);
    setCostForm({
      fuel_start_liters: Number(vy.fuel_start_liters || 0),
      fuel_added_liters: Number(vy.fuel_added_liters || 0),
      fuel_end_liters: Number(vy.fuel_end_liters || 0),
      fuel_unit_price: Number(vy.fuel_unit_price || 21500),
      port_fee: Number(vy.port_fee || 0),
      crew_salary: Number(vy.crew_salary || 0),
      other_cost: Number(vy.other_cost || 0),
    });
  };

  const saveSettlement = async (voyageId: string) => {
    await updateSettlementAction(voyageId, costForm);
    setEditingVoyageId(null);
    await loadAll();
  };

  const handleExportSettlementCsv = () => {
    const header = [
      'MA CHUYEN',
      'NGAY',
      'SA LAN',
      'BOOKINGS',
      'KHACH HANG',
      'TUYEN',
      'SO TEUS',
      'DOANH THU',
      'DAU DAU (L)',
      'CAP THEM (L)',
      'DAU CUOI (L)',
      'TIEU HAO (L)',
      'TIEN DAU',
      'PHI CANG',
      'LUONG CHUYEN',
      'CHI PHI KHAC',
      'LOI NHUAN RONG',
      'TRANG THAI',
    ];
    const rows = filteredVoyages.map((vy) => {
      const p = computeVoyagePnl(vy);
      return [
        vy.voyage_no,
        (vy.received_date || '').slice(0, 10),
        vy.vessel_name || '',
        vy.booking_nos || '',
        vy.customer_name || '',
        `${vy.origin_name || ''} -> ${vy.dest_name || ''}`,
        vy.total_teus || 0,
        p.revenue,
        p.fuelStart,
        p.fuelAdded,
        p.fuelEnd,
        p.fuelConsumed,
        p.fuelCost,
        p.portFee,
        p.crewSalary,
        p.otherCost,
        p.netProfit,
        vy.status,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',');
    });
    const csv = '\uFEFF' + [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `quyet-toan-lai-lo-chuyen-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const handlePayFull = async (inv: Invoice) => {
    try {
      await fetch(`${API_URL}/orders/invoices/${inv.id}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: inv.balance_due }),
      });
      loadAll();
    } catch {
      setInvoices((prev) =>
        prev.map((x) =>
          x.id === inv.id
            ? { ...x, paid_amount: x.total_amount, balance_due: 0, payment_status: 'PAID' }
            : x,
        ),
      );
    }
  };

  const totalReceivable = invoices.reduce((s, i) => s + Number(i.balance_due || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Quyết toán Chuyến, Lãi/Lỗ & Công nợ
          </h1>
          <p className="text-sm text-slate-500">
            Tự động chốt doanh thu cont, tiêu hao dầu (Đầu + Cấp - Cuối) & Lợi nhuận ròng trên 1 bảng phẳng
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportSettlementCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs sm:text-sm font-medium hover:bg-emerald-500"
          >
            <Download className="w-4 h-4" /> Xuất file đối soát (.csv)
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {(
          [
            { id: 'PNL', label: 'Tổng hợp Lãi/Lỗ Tháng (P&L)', icon: TrendingUp },
            { id: 'YIELD', label: 'Sản lượng & Giá cước Cont', icon: FileSpreadsheet },
            { id: 'PORT_FIXED', label: 'Định phí & Cảng vụ', icon: Anchor },
            { id: 'FUEL', label: 'Báo cáo Dầu DO', icon: Fuel },
            { id: 'SUPPLIES', label: 'Vật tư & Sửa chữa', icon: Wrench },
            { id: 'VENDOR', label: 'Cước Thuê Vendor', icon: Ship },
            { id: 'SETTLEMENT', label: `Quyết toán Chuyến (${filteredVoyages.length})`, icon: Calculator },
            { id: 'INVOICES', label: `Hóa đơn & Công nợ (${invoices.length})`, icon: Wallet },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                if (t.id === 'SETTLEMENT') loadAll();
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium ${
                tab === t.id
                  ? 'bg-navy-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'PNL' && <AccountingPnlSummaryPanel />}
      {tab === 'PORT_FIXED' && <AccountingPortAndFixedPanel vessels={vessels} />}
      {tab === 'FUEL' && <AccountingFuelReportPanel vessels={vessels} />}
      {tab === 'SUPPLIES' && <AccountingSuppliesPanel vessels={vessels} />}
      {tab === 'VENDOR' && <AccountingVendorPanel />}
      {tab === 'YIELD' && <AccountingOutputReportPanel />}

      {tab === 'SETTLEMENT' && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <div>
              <label className="text-slate-500 font-medium">Từ ngày</label>
              <input
                type="date"
                className="w-full border rounded-lg px-2.5 py-1.5 mt-1"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-slate-500 font-medium">Đến ngày</label>
              <input
                type="date"
                className="w-full border rounded-lg px-2.5 py-1.5 mt-1"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
              />
            </div>
            <div>
              <label className="text-slate-500 font-medium">Lọc theo Sà lan</label>
              <select
                className="w-full border rounded-lg px-2.5 py-1.5 mt-1"
                value={filterVesselId}
                onChange={(e) => setFilterVesselId(e.target.value)}
              >
                <option value="">Tất cả sà lan</option>
                {vessels.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-500 font-medium">Lọc theo Khách hàng</label>
              <select
                className="w-full border rounded-lg px-2.5 py-1.5 mt-1"
                value={filterCustomer}
                onChange={(e) => setFilterCustomer(e.target.value)}
              >
                <option value="">Tất cả khách hàng</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-500 font-medium">Trạng thái chuyến</label>
              <select
                className="w-full border rounded-lg px-2.5 py-1.5 mt-1"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">Tất cả</option>
                <option value="COMPLETED">Hoàn thành (Chờ quyết toán)</option>
                <option value="IN_TRANSIT">Đang chạy</option>
                <option value="ARRIVED">Đã cập cảng</option>
                <option value="PLANNED">Đã lập kế hoạch</option>
              </select>
            </div>
          </div>

          {/* Summary KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-semibold uppercase text-slate-500">Tổng Doanh thu</div>
              <div className="text-xl font-bold text-maritime-700 mt-1">
                {formatVND(totals.revenue)}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-semibold uppercase text-slate-500">
                Tổng tiêu hao dầu DO
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {totals.fuelConsumed.toLocaleString('vi-VN')} L ({formatVND(totals.fuelCost)})
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-[11px] font-semibold uppercase text-slate-500">
                Phí cảng + Lương + Khác
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {formatVND(totals.otherCosts)}
              </div>
            </div>
            <div
              className={`p-4 rounded-xl border shadow-sm ${
                totals.netProfit >= 0
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-rose-50 border-rose-200'
              }`}
            >
              <div className="text-[11px] font-semibold uppercase text-slate-600">
                Lợi nhuận ròng (Lãi/Lỗ)
              </div>
              <div
                className={`text-xl font-extrabold mt-1 ${
                  totals.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatVND(totals.netProfit)}
              </div>
            </div>
          </div>

          {/* Flat Excel-like P&L Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left whitespace-nowrap border-collapse">
                <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">Mã chuyến</th>
                    <th className="px-3 py-2.5">Ngày</th>
                    <th className="px-3 py-2.5">Sà lan</th>
                    <th className="px-3 py-2.5">Tuyến & Khách / Booking</th>
                    <th className="px-2.5 py-2.5 text-center">TEU</th>
                    <th className="px-3 py-2.5 text-right">Doanh thu</th>
                    <th className="px-2.5 py-2.5 text-right">Dầu đầu / Cấp / Cuối (L)</th>
                    <th className="px-2.5 py-2.5 text-right">Tiêu hao (L)</th>
                    <th className="px-3 py-2.5 text-right">Tiền dầu</th>
                    <th className="px-3 py-2.5 text-right">Phí cảng</th>
                    <th className="px-3 py-2.5 text-right">Lương + Khác</th>
                    <th className="px-3 py-2.5 text-right bg-emerald-50 text-emerald-800">
                      Lợi nhuận ròng
                    </th>
                    <th className="px-2.5 py-2.5 text-center">POD</th>
                    <th className="px-3 py-2.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVoyages.map((vy) => {
                    const pnl = computeVoyagePnl(vy);
                    const isEditing = editingVoyageId === vy.id;
                    const bargeStyle = getBargeColorStyle(vy.vessel_code || vy.vessel_name);

                    return (
                      <tr key={vy.id} className={`${bargeStyle.rowClass} transition-colors`}>
                        <td className="px-3 py-2.5">
                          <Link
                            href={`/dispatch?voyageId=${vy.id}`}
                            className="font-bold text-maritime-700 hover:underline"
                          >
                            {vy.voyage_no}
                          </Link>
                          <div className="mt-0.5">
                            <StatusBadge status={vy.status} />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {(vy.received_date || vy.created_at || '').slice(0, 10) || '—'}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-slate-800">
                          {vy.vessel_name || '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-slate-900">
                            {vy.origin_name || '—'} → {vy.dest_name || '—'}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {vy.customer_name || '—'}
                            {vy.booking_nos ? ` • ${vy.booking_nos}` : ''}
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5 text-center font-bold">{vy.total_teus || 0}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-maritime-700 tabular-nums">
                          {formatVND(pnl.revenue)}
                          {pnl.isEstimatedRevenue && (
                            <div className="text-[10px] font-normal text-amber-600">
                              (Ước tính)
                            </div>
                          )}
                        </td>

                        {isEditing ? (
                          <>
                            <td className="px-2 py-2 text-right space-x-1">
                              <input
                                type="number"
                                className="w-16 border rounded px-1 py-0.5 text-right"
                                value={costForm.fuel_start_liters}
                                onChange={(e) =>
                                  setCostForm({ ...costForm, fuel_start_liters: Number(e.target.value) })
                                }
                                title="Đầu (L)"
                              />
                              <input
                                type="number"
                                className="w-16 border rounded px-1 py-0.5 text-right"
                                value={costForm.fuel_added_liters}
                                onChange={(e) =>
                                  setCostForm({ ...costForm, fuel_added_liters: Number(e.target.value) })
                                }
                                title="Cấp thêm (L)"
                              />
                              <input
                                type="number"
                                className="w-16 border rounded px-1 py-0.5 text-right"
                                value={costForm.fuel_end_liters}
                                onChange={(e) =>
                                  setCostForm({ ...costForm, fuel_end_liters: Number(e.target.value) })
                                }
                                title="Cuối (L)"
                              />
                            </td>
                            <td className="px-2.5 py-2 text-right font-semibold">
                              {Math.max(
                                0,
                                costForm.fuel_start_liters +
                                  costForm.fuel_added_liters -
                                  costForm.fuel_end_liters,
                              ).toLocaleString('vi-VN')}{' '}
                              L
                            </td>
                            <td className="px-2 py-2 text-right">
                              <input
                                type="number"
                                className="w-20 border rounded px-1 py-0.5 text-right"
                                value={costForm.fuel_unit_price}
                                onChange={(e) =>
                                  setCostForm({ ...costForm, fuel_unit_price: Number(e.target.value) })
                                }
                                title="Đơn giá dầu đ/L"
                              />
                            </td>
                            <td className="px-2 py-2 text-right">
                              <input
                                type="number"
                                className="w-24 border rounded px-1 py-0.5 text-right"
                                value={costForm.port_fee}
                                onChange={(e) =>
                                  setCostForm({ ...costForm, port_fee: Number(e.target.value) })
                                }
                              />
                            </td>
                            <td className="px-2 py-2 text-right space-x-1">
                              <input
                                type="number"
                                className="w-20 border rounded px-1 py-0.5 text-right"
                                value={costForm.crew_salary}
                                onChange={(e) =>
                                  setCostForm({ ...costForm, crew_salary: Number(e.target.value) })
                                }
                                title="Lương chuyến"
                              />
                              <input
                                type="number"
                                className="w-20 border rounded px-1 py-0.5 text-right"
                                value={costForm.other_cost}
                                onChange={(e) =>
                                  setCostForm({ ...costForm, other_cost: Number(e.target.value) })
                                }
                                title="Chi phí khác"
                              />
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-2.5 py-2.5 text-right tabular-nums text-slate-600">
                              {pnl.fuelStart} / +{pnl.fuelAdded} / {pnl.fuelEnd}
                            </td>
                            <td className="px-2.5 py-2.5 text-right font-semibold tabular-nums">
                              {pnl.fuelConsumed.toLocaleString('vi-VN')} L
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {formatVND(pnl.fuelCost)}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {formatVND(pnl.portFee)}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {formatVND(pnl.crewSalary + pnl.otherCost)}
                            </td>
                          </>
                        )}

                        <td
                          className={`px-3 py-2.5 text-right font-extrabold tabular-nums ${
                            pnl.netProfit >= 0
                              ? 'bg-emerald-50/70 text-emerald-700'
                              : 'bg-rose-50/70 text-rose-700'
                          }`}
                        >
                          {formatVND(pnl.netProfit)}
                        </td>

                        <td className="px-2.5 py-2.5 text-center">
                          {vy.pod_photo_url ? (
                            <button
                              onClick={() => setPreviewPhotoUrl(vy.pod_photo_url || null)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-[11px] font-medium"
                            >
                              <Eye className="w-3 h-3" /> Xem POD
                            </button>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        <td className="px-3 py-2.5 text-right">
                          {isEditing ? (
                            <div className="inline-flex gap-1">
                              <button
                                onClick={() => saveSettlement(vy.id)}
                                className="px-2 py-1 rounded bg-emerald-600 text-white"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingVoyageId(null)}
                                className="px-2 py-1 rounded border bg-white text-slate-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditSettlement(vy)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-700"
                            >
                              <Pencil className="w-3 h-3 text-maritime-600" /> Nhập chi phí
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'INVOICES' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-slate-500 uppercase">Tổng đơn hàng</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{orders.length} đơn</div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-slate-500 uppercase">Doanh thu cước dự kiến</div>
              <div className="mt-1 text-2xl font-bold text-maritime-600">
                {formatVND(orders.reduce((s, o) => s + Number(o.total_freight) + Number(o.surcharge), 0))}
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-slate-500 uppercase">Công nợ chưa thu</div>
              <div className="mt-1 text-2xl font-bold text-rose-600">{formatVND(totalReceivable)}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 font-semibold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-maritime-600" /> Danh sách Đơn hàng Vận tải
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Mã đơn</th>
                    <th className="px-4 py-3">Khách hàng</th>
                    <th className="px-4 py-3">Tuyến đường</th>
                    <th className="px-4 py-3">Hàng hóa</th>
                    <th className="px-4 py-3">Tổng cước + Phụ phí</th>
                    <th className="px-4 py-3">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="px-4 py-3 font-semibold text-navy-900">{o.order_no}</td>
                      <td className="px-4 py-3 font-medium">{o.customer_name}</td>
                      <td className="px-4 py-3 text-xs">
                        <div>{o.origin_name}</div>
                        <div className="text-maritime-600">→ {o.dest_name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{o.cargo_type}</div>
                        <div className="text-xs text-slate-500">
                          {Number(o.cargo_weight_tons).toLocaleString('vi-VN')} tấn
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {formatVND(Number(o.total_freight) + Number(o.surcharge))}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={o.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 font-semibold text-slate-900 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-indigo-600" /> Hóa đơn VAT & Theo dõi Thu hồi Công nợ
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Số hóa đơn</th>
                    <th className="px-4 py-3">Đơn hàng</th>
                    <th className="px-4 py-3">Khách hàng</th>
                    <th className="px-4 py-3">Tổng tiền</th>
                    <th className="px-4 py-3">Còn phải thu</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="px-4 py-3 font-semibold">{inv.invoice_no}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{inv.order_no}</td>
                      <td className="px-4 py-3 font-medium">{inv.customer_name}</td>
                      <td className="px-4 py-3">{formatVND(inv.total_amount)}</td>
                      <td className="px-4 py-3 font-semibold text-rose-600">
                        {formatVND(inv.balance_due)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inv.payment_status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {inv.payment_status !== 'PAID' && (
                          <button
                            onClick={() => handlePayFull(inv)}
                            className="px-3 py-1 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500"
                          >
                            Gạch nợ đủ
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {previewPhotoUrl && (
        <div
          onClick={() => setPreviewPhotoUrl(null)}
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl p-3 max-w-xl w-full space-y-2">
            <div className="flex justify-between items-center text-sm font-bold">
              <span>Ảnh Biên bản Giao nhận (POD)</span>
              <button onClick={() => setPreviewPhotoUrl(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewPhotoUrl} alt="POD" className="w-full rounded-lg max-h-[75vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
