'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Download,
  Pencil,
  Sparkles,
  X,
} from 'lucide-react';
import {
  API_URL,
  type ContType,
  type VoyageContainer,
} from '@/lib/api';
import { getBargeColorStyle } from '@/lib/barge-colors';

const CONT_TYPES: ContType[] = ['20E', '20F', '40E', '40F'];

function formatMoney(n?: number | null): string {
  return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function AccountingOutputReportPanel() {
  const [rows, setRows] = useState<VoyageContainer[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters matching BÁO CÁO SẢN LƯỢNG workflow
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterBarge, setFilterBarge] = useState<string>('');
  const [filterTrip, setFilterTrip] = useState<string>('');
  const [filterShipper, setFilterShipper] = useState<string>('');

  // Inline Price & Container No Editing (Accounting / Dispatch)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [priceForm, setPriceForm] = useState({
    container_no: '',
    unit_price: 0,
    baf: 0,
    total_amount: 0,
    fuel_price_no_vat: 0,
    notes: '',
  });

  // Bulk Apply Price to Filtered Rows
  const [showBulkApply, setShowBulkApply] = useState(false);
  const [bulkContType, setBulkContType] = useState<'' | ContType>('');
  const [bulkUnitPrice, setBulkUnitPrice] = useState<number>(638182);
  const [bulkBaf, setBulkBaf] = useState<number>(172800);
  const [bulkFuelPrice, setBulkFuelPrice] = useState<number>(29250);
  const [busy, setBusy] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState<number>(100);

  const loadAllContainers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/dispatch/containers`, { cache: 'no-store' });
      if (res.ok) {
        setRows(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllContainers();
  }, []);

  const bargeOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.barge_code || '').filter(Boolean))).sort(),
    [rows],
  );
  const shipperOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.shipper_name || '').filter(Boolean))).sort(),
    [rows],
  );

  // Filter AND sort strictly by: Ngày đi -> Tên Sà lan -> Số chuyến
  const filteredAndSorted = useMemo(() => {
    const filtered = rows.filter((r) => {
      const dep = (r.departure_date || '').slice(0, 10);
      const rawAccMonth = (r as any).accounting_month ? String((r as any).accounting_month).slice(0, 7) : '';
      const accMonth = rawAccMonth || dep.slice(0, 7);
      if (filterMonth) {
        if (rawAccMonth ? accMonth !== filterMonth : !dep.startsWith(filterMonth)) return false;
      }
      if (filterBarge && (r.barge_code || '') !== filterBarge) return false;
      if (
        filterTrip &&
        !(r.trip_no || '').toLowerCase().includes(filterTrip.toLowerCase())
      ) {
        return false;
      }
      if (
        filterShipper &&
        !(r.shipper_name || '').toLowerCase().includes(filterShipper.toLowerCase())
      ) {
        return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      const dA = (a.departure_date || '').slice(0, 10);
      const dB = (b.departure_date || '').slice(0, 10);
      if (dA !== dB) return dA.localeCompare(dB);
      const bA = a.barge_code || '';
      const bB = b.barge_code || '';
      if (bA !== bB) return bA.localeCompare(bB, 'vi');
      const tA = a.trip_no || '';
      const tB = b.trip_no || '';
      if (tA !== tB) return tA.localeCompare(tB, 'vi');
      return (a.container_no || '').localeCompare(b.container_no || '');
    });
  }, [rows, filterMonth, filterBarge, filterTrip, filterShipper]);

  const duplicateSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of filteredAndSorted) {
      const key = (r.container_no || '').trim().toUpperCase();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    const dups = new Set<string>();
    for (const [k, v] of counts.entries()) {
      if (v > 1) dups.add(k);
    }
    return dups;
  }, [filteredAndSorted]);

  const totals = useMemo(() => {
    let c20e = 0,
      c20f = 0,
      c40e = 0,
      c40f = 0,
      unitPrice = 0,
      baf = 0,
      totalAmount = 0;
    for (const r of filteredAndSorted) {
      if (r.cont_type === '20E') c20e++;
      else if (r.cont_type === '20F') c20f++;
      else if (r.cont_type === '40E') c40e++;
      else if (r.cont_type === '40F') c40f++;
      unitPrice += Number(r.unit_price || 0);
      baf += Number(r.baf || 0);
      totalAmount += Number(r.total_amount || 0);
    }
    return {
      c20e,
      c20f,
      c40e,
      c40f,
      totalTeus: c20e + c20f + (c40e + c40f) * 2,
      unitPrice,
      baf,
      totalAmount,
    };
  }, [filteredAndSorted]);

  const startEdit = (r: VoyageContainer) => {
    setEditingId(r.id);
    setPriceForm({
      container_no: r.container_no || '',
      unit_price: Number(r.unit_price || 0),
      baf: Number(r.baf || 0),
      total_amount: Number(r.total_amount || 0),
      fuel_price_no_vat: Number(r.fuel_price_no_vat || 0),
      notes: r.notes || '',
    });
  };

  const handleSavePrice = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/dispatch/containers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(priceForm),
      });
      if (!res.ok) {
        alert(`Không lưu được đơn giá (${res.status}): ${await res.text()}`);
        return;
      }
      setEditingId(null);
      await loadAllContainers();
    } finally {
      setBusy(false);
    }
  };

  const handleBulkApplyPrice = async () => {
    const targets = filteredAndSorted.filter(
      (r) => !bulkContType || r.cont_type === bulkContType,
    );
    if (targets.length === 0) return;
    if (
      !confirm(
        `Áp Đơn giá ${formatMoney(bulkUnitPrice)} đ + BAF ${formatMoney(bulkBaf)} đ + Giá NL ${formatMoney(bulkFuelPrice)} đ cho ${targets.length} container đang lọc?`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const totalAmt = Number(bulkUnitPrice || 0) + Number(bulkBaf || 0);
      await Promise.all(
        targets.map((t) =>
          fetch(`${API_URL}/dispatch/containers/${t.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              unit_price: bulkUnitPrice,
              baf: bulkBaf,
              total_amount: totalAmt,
              fuel_price_no_vat: bulkFuelPrice,
            }),
          }),
        ),
      );
      setShowBulkApply(false);
      await loadAllContainers();
    } finally {
      setBusy(false);
    }
  };

  const handleExportReportCsv = () => {
    const header = [
      'STT',
      'SA LAN',
      'SO CHUYEN',
      'SO CONT',
      'CANG DI',
      'CANG DEN',
      'CHU HANG',
      'NGAY DI',
      '20E',
      '20F',
      '40E',
      '40F',
      'DON GIA',
      'BAF',
      'THANH TIEN',
      'GIA NHIEN LIEU K VAT',
      'GHI CHU',
    ];
    const bodyLines = filteredAndSorted.map((r, i) =>
      [
        i + 1,
        r.barge_code || '',
        r.trip_no || '',
        r.container_no,
        r.origin_name || '',
        r.destination_name || '',
        r.shipper_name || '',
        r.departure_date ? r.departure_date.slice(0, 10) : '',
        r.cont_type === '20E' ? 1 : '',
        r.cont_type === '20F' ? 1 : '',
        r.cont_type === '40E' ? 1 : '',
        r.cont_type === '40F' ? 1 : '',
        r.unit_price || 0,
        r.baf || 0,
        r.total_amount || 0,
        r.fuel_price_no_vat || 0,
        (r.notes || '').replace(/"/g, '""'),
      ]
        .map((v) => `"${v}"`)
        .join(','),
    );
    const totalLine = [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'TONG CONG',
      totals.c20e,
      totals.c20f,
      totals.c40e,
      totals.c40f,
      totals.unitPrice,
      totals.baf,
      totals.totalAmount,
      '',
      '',
    ].join(',');
    const csv = '\uFEFF' + [header.join(','), ...bodyLines, totalLine].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bao-cao-san-luong-salan-${filterMonth || 'tat-ca'}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Report Title Banner matching Excel sample */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-blue-800 uppercase tracking-tight">
            Báo cáo Sản lượng & Giá cước Sà lan ({filteredAndSorted.length} Cont •{' '}
            {totals.totalTeus} TEUs)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Dữ liệu tự động sắp xếp theo: <b>Ngày đi → Tên Sà lan → Số chuyến</b> • Kế toán nhập/sửa Đơn giá, BAF, Thành tiền & Giá NL K VAT để quyết toán
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowBulkApply((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500"
          >
            <Sparkles className="w-4 h-4" /> Áp giá hàng loạt
          </button>
          <button
            type="button"
            onClick={handleExportReportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500"
          >
            <Download className="w-4 h-4" /> Xuất Báo cáo Sản lượng (.csv)
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div>
          <label className="text-slate-500 font-medium">Lọc theo Tháng</label>
          <input
            type="month"
            className="w-full border rounded-lg px-2.5 py-1.5 mt-1"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          />
        </div>
        <div>
          <label className="text-slate-500 font-medium">Sà lan</label>
          <select
            className="w-full border rounded-lg px-2.5 py-1.5 mt-1"
            value={filterBarge}
            onChange={(e) => setFilterBarge(e.target.value)}
          >
            <option value="">Tất cả sà lan</option>
            {bargeOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-slate-500 font-medium">Số chuyến</label>
          <input
            className="w-full border rounded-lg px-2.5 py-1.5 mt-1"
            placeholder="VD: V.36-04926W"
            value={filterTrip}
            onChange={(e) => setFilterTrip(e.target.value)}
          />
        </div>
        <div>
          <label className="text-slate-500 font-medium">Chủ hàng</label>
          <select
            className="w-full border rounded-lg px-2.5 py-1.5 mt-1"
            value={filterShipper}
            onChange={(e) => setFilterShipper(e.target.value)}
          >
            <option value="">Tất cả chủ hàng</option>
            {shipperOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bulk Price Helper */}
      {showBulkApply && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-5 gap-3 items-end text-xs">
          <div>
            <label className="font-semibold text-indigo-900">Áp dụng cho loại cont</label>
            <select
              className="w-full border rounded-lg px-2.5 py-2 mt-1 bg-white"
              value={bulkContType}
              onChange={(e) => setBulkContType(e.target.value as '' | ContType)}
            >
              <option value="">Tất cả loại đang lọc ({filteredAndSorted.length})</option>
              {CONT_TYPES.map((ct) => (
                <option key={ct} value={ct}>
                  Chỉ loại {ct} ({filteredAndSorted.filter((r) => r.cont_type === ct).length})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-semibold text-indigo-900">Đơn giá (đ)</label>
            <input
              type="number"
              className="w-full border rounded-lg px-2.5 py-2 mt-1 bg-white text-right font-semibold"
              value={bulkUnitPrice}
              onChange={(e) => setBulkUnitPrice(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="font-semibold text-indigo-900">BAF (đ)</label>
            <input
              type="number"
              className="w-full border rounded-lg px-2.5 py-2 mt-1 bg-white text-right font-semibold"
              value={bulkBaf}
              onChange={(e) => setBulkBaf(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="font-semibold text-indigo-900">Giá NL K VAT (đ)</label>
            <input
              type="number"
              className="w-full border rounded-lg px-2.5 py-2 mt-1 bg-white text-right font-semibold"
              value={bulkFuelPrice}
              onChange={(e) => setBulkFuelPrice(Number(e.target.value))}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleBulkApplyPrice}
              className="flex-1 py-2 px-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-500 disabled:opacity-50"
            >
              Áp giá ngay
            </button>
          </div>
        </div>
      )}

      {/* Accounting Yield Table matching Excel Sample */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left whitespace-nowrap border-collapse">
            <thead>
              {/* Blue Summary Row at Top exactly like Excel Report Header */}
              <tr className="bg-white text-blue-700 font-extrabold text-xs border-b border-slate-300">
                <td colSpan={8} className="px-3 py-2 text-right uppercase">
                  Tổng sản lượng & Doanh thu đang lọc:
                </td>
                <td className="px-2 py-2 text-center">{totals.c20e}</td>
                <td className="px-2 py-2 text-center">{totals.c20f}</td>
                <td className="px-2 py-2 text-center">{totals.c40e}</td>
                <td className="px-2 py-2 text-center">{totals.c40f}</td>
                <td className="px-2.5 py-2 text-right tabular-nums">
                  {formatMoney(totals.unitPrice)}
                </td>
                <td className="px-2.5 py-2 text-right tabular-nums">{formatMoney(totals.baf)}</td>
                <td className="px-2.5 py-2 text-right tabular-nums">
                  {formatMoney(totals.totalAmount)}
                </td>
                <td colSpan={3}></td>
              </tr>

              <tr className="bg-cyan-50 text-slate-800 font-bold border-b border-slate-300">
                <th rowSpan={2} className="px-2 py-2 border-r border-slate-300 text-center">
                  STT
                </th>
                <th rowSpan={2} className="px-2.5 py-2 border-r border-slate-300">
                  SÀ LAN
                </th>
                <th rowSpan={2} className="px-2.5 py-2 border-r border-slate-300">
                  SỐ CHUYẾN
                </th>
                <th rowSpan={2} className="px-2.5 py-2 border-r border-slate-300">
                  SỐ CONT
                </th>
                <th rowSpan={2} className="px-2.5 py-2 border-r border-slate-300">
                  CẢNG ĐI
                </th>
                <th rowSpan={2} className="px-2.5 py-2 border-r border-slate-300">
                  CẢNG ĐẾN
                </th>
                <th rowSpan={2} className="px-2.5 py-2 border-r border-slate-300">
                  CHỦ HÀNG
                </th>
                <th rowSpan={2} className="px-2.5 py-2 border-r border-slate-300">
                  NGÀY ĐI
                </th>
                <th colSpan={4} className="px-2 py-1.5 border-r border-b border-slate-300 text-center">
                  LOẠI CONT
                </th>
                <th rowSpan={2} className="px-2.5 py-2 border-r border-slate-300 text-right">
                  ĐƠN GIÁ
                </th>
                <th rowSpan={2} className="px-2.5 py-2 border-r border-slate-300 text-right">
                  BAF
                </th>
                <th rowSpan={2} className="px-2.5 py-2 border-r border-slate-300 text-right">
                  THÀNH TIỀN
                </th>
                <th rowSpan={2} className="px-2.5 py-2 border-r border-slate-300 text-right">
                  GIÁ NHIÊN LIỆU K VAT
                </th>
                <th rowSpan={2} className="px-2.5 py-2 border-r border-slate-300">
                  GHI CHÚ
                </th>
                <th rowSpan={2} className="px-2.5 py-2 text-right">
                  THAO TÁC
                </th>
              </tr>
              <tr className="bg-cyan-100/70 text-[11px]">
                <th className="px-2 py-1 border-r border-slate-300 text-center">20E</th>
                <th className="px-2 py-1 border-r border-slate-300 text-center">20F</th>
                <th className="px-2 py-1 border-r border-slate-300 text-center">40E</th>
                <th className="px-2 py-1 border-r border-slate-300 text-center">40F</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-300/80">
              {loading ? (
                <tr>
                  <td colSpan={18} className="px-4 py-8 text-center text-slate-400">
                    Đang tải dữ liệu sản lượng container...
                  </td>
                </tr>
              ) : filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={18} className="px-4 py-8 text-center text-slate-500">
                    Chưa có dữ liệu container phù hợp bộ lọc. (Điều độ viên nhập danh sách container ở mục <strong>2. Chi tiết Cont & Danh mục</strong> để tự động đổ sang báo cáo Sản lượng).
                  </td>
                </tr>
              ) : (
                filteredAndSorted.slice(0, visibleLimit).map((r, idx) => {
                  const isEditing = editingId === r.id;
                  const isDup = duplicateSet.has((r.container_no || '').trim().toUpperCase());
                  const bargeStyle = getBargeColorStyle(r.barge_code);

                  return (
                    <tr key={r.id} className={isEditing ? 'bg-amber-50/70' : `${bargeStyle.rowClass} transition-colors`}>
                      <td className="px-2 py-2 border-r border-slate-200 text-center text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="px-2.5 py-2 border-r border-slate-200 font-medium">
                        {r.barge_code || '—'}
                      </td>
                      <td className="px-2.5 py-2 border-r border-slate-200">{r.trip_no || '—'}</td>
                      <td
                        className={`px-2.5 py-2 border-r border-slate-200 font-mono font-semibold ${
                          isDup ? 'bg-rose-200 text-rose-900' : 'text-navy-900'
                        }`}
                      >
                        {isEditing ? (
                          <input
                            className="w-28 border rounded px-1.5 py-1 bg-white text-xs font-mono uppercase"
                            placeholder="Để trống nếu chưa có"
                            value={priceForm.container_no}
                            onChange={(e) =>
                              setPriceForm({ ...priceForm, container_no: e.target.value.toUpperCase() })
                            }
                          />
                        ) : (
                          r.container_no || ''
                        )}
                      </td>
                      <td className="px-2.5 py-2 border-r border-slate-200">{r.origin_name || '—'}</td>
                      <td className="px-2.5 py-2 border-r border-slate-200">
                        {r.destination_name || '—'}
                      </td>
                      <td className="px-2.5 py-2 border-r border-slate-200 font-medium">
                        {r.shipper_name || '—'}
                      </td>
                      <td className="px-2.5 py-2 border-r border-slate-200 text-slate-600">
                        {r.departure_date ? r.departure_date.slice(0, 10) : '—'}
                      </td>
                      {CONT_TYPES.map((ct) => (
                        <td
                          key={ct}
                          className={`px-2 py-2 border-r border-slate-200 text-center ${
                            r.cont_type === ct
                              ? 'font-bold text-slate-900 bg-sky-50'
                              : 'text-slate-300'
                          }`}
                        >
                          {r.cont_type === ct ? '1' : ''}
                        </td>
                      ))}

                      {isEditing ? (
                        <>
                          <td className="px-1 py-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              className="w-24 border rounded px-1.5 py-1 bg-white text-xs text-right"
                              value={priceForm.unit_price}
                              onChange={(e) => {
                                const u = Number(e.target.value);
                                setPriceForm((p) => ({
                                  ...p,
                                  unit_price: u,
                                  total_amount: u + Number(p.baf || 0),
                                }));
                              }}
                            />
                          </td>
                          <td className="px-1 py-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              className="w-24 border rounded px-1.5 py-1 bg-white text-xs text-right"
                              value={priceForm.baf}
                              onChange={(e) => {
                                const b = Number(e.target.value);
                                setPriceForm((p) => ({
                                  ...p,
                                  baf: b,
                                  total_amount: Number(p.unit_price || 0) + b,
                                }));
                              }}
                            />
                          </td>
                          <td className="px-1 py-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              className="w-24 border rounded px-1.5 py-1 bg-emerald-50 font-semibold text-xs text-right"
                              value={priceForm.total_amount}
                              onChange={(e) =>
                                setPriceForm({ ...priceForm, total_amount: Number(e.target.value) })
                              }
                            />
                          </td>
                          <td className="px-1 py-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              className="w-24 border rounded px-1.5 py-1 bg-white text-xs text-right"
                              value={priceForm.fuel_price_no_vat}
                              onChange={(e) =>
                                setPriceForm({
                                  ...priceForm,
                                  fuel_price_no_vat: Number(e.target.value),
                                })
                              }
                            />
                          </td>
                          <td className="px-1 py-1.5 border-r border-slate-200">
                            <input
                              className="w-28 border rounded px-1.5 py-1 bg-white text-xs"
                              value={priceForm.notes}
                              onChange={(e) => setPriceForm({ ...priceForm, notes: e.target.value })}
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right space-x-1">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleSavePrice(r.id)}
                              className="inline-flex items-center gap-0.5 px-2 py-1 rounded bg-emerald-600 text-white"
                            >
                              <Check className="w-3.5 h-3.5" /> Lưu
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="inline-flex items-center px-2 py-1 rounded border bg-white text-slate-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-2.5 py-2 border-r border-slate-200 text-right tabular-nums">
                            {formatMoney(r.unit_price)}
                          </td>
                          <td className="px-2.5 py-2 border-r border-slate-200 text-right tabular-nums">
                            {formatMoney(r.baf)}
                          </td>
                          <td className="px-2.5 py-2 border-r border-slate-200 text-right font-semibold text-emerald-700 tabular-nums">
                            {formatMoney(r.total_amount)}
                          </td>
                          <td className="px-2.5 py-2 border-r border-slate-200 text-right tabular-nums text-slate-600">
                            {formatMoney(r.fuel_price_no_vat)}
                          </td>
                          <td className="px-2.5 py-2 border-r border-slate-200 text-slate-500 max-w-[160px] truncate">
                            {r.notes || ''}
                          </td>
                          <td className="px-2.5 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => startEdit(r)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-100"
                            >
                              <Pencil className="w-3 h-3 text-maritime-600" /> Sửa giá
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredAndSorted.length > visibleLimit && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>
              Đang hiển thị {Math.min(visibleLimit, filteredAndSorted.length)} / {filteredAndSorted.length} container
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVisibleLimit((v) => v + 200)}
                className="px-3 py-1 rounded border border-slate-300 bg-white font-medium hover:bg-slate-100"
              >
                Xem thêm 200 dòng
              </button>
              <button
                type="button"
                onClick={() => setVisibleLimit(filteredAndSorted.length)}
                className="px-3 py-1 rounded bg-navy-900 text-white font-medium hover:bg-navy-800"
              >
                Hiện tất cả ({filteredAndSorted.length})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
