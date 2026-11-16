'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AccountingFuelEntry, API_URL, Vessel } from '@/lib/api';
import { Fuel, Plus, Trash2 } from 'lucide-react';
import { currentYearMonth, findLatestPeriodMonth, formatMoney, mergeVesselCodes } from './accountingUtils';

const ENTRY_LABELS: Record<AccountingFuelEntry['entry_type'], string> = {
  CARRY_OVER: 'Tồn / Nợ kỳ trước',
  BUNKERING: 'Đã đổ Dầu DO',
  CONSUMPTION: 'Định mức / Tiêu thụ chặng',
};

export function AccountingFuelReportPanel({ vessels }: { vessels: Vessel[] }) {
  const [periodMonth, setPeriodMonth] = useState(currentYearMonth());
  const [vesselFilter, setVesselFilter] = useState('ALL');
  const [rows, setRows] = useState<AccountingFuelEntry[]>([]);
  const bargeCodes = mergeVesselCodes(vessels);
  const didAutoPick = useRef(false);

  const [form, setForm] = useState({
    entry_date: `${currentYearMonth()}-01`,
    vessel_code: 'NV36',
    entry_type: 'CONSUMPTION' as AccountingFuelEntry['entry_type'],
    route_label: '',
    liters_consumed: '',
    liters_bunkered: '',
    unit_price: '18500',
    discount: '0',
    notes: '',
  });

  const loadData = useCallback(async () => {
    const qs = new URLSearchParams({ month: periodMonth });
    if (vesselFilter !== 'ALL') qs.set('vessel_code', vesselFilter);
    const res = await fetch(`${API_URL}/orders/accounting/fuel-entries?${qs.toString()}`, { cache: 'no-store' });
    const data = res.ok ? await res.json() : [];
    if (!didAutoPick.current && data.length === 0) {
      didAutoPick.current = true;
      const latest = await findLatestPeriodMonth(API_URL, 'fuel-entries');
      if (latest && latest !== periodMonth) {
        setPeriodMonth(latest);
        return;
      }
    }
    didAutoPick.current = true;
    setRows(data);
  }, [periodMonth, vesselFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isBunkering = form.entry_type === 'BUNKERING';
    const bunkered = isBunkering ? Number(form.liters_bunkered || 0) : form.entry_type === 'CARRY_OVER' ? Number(form.liters_bunkered || 0) : 0;
    const consumed = form.entry_type === 'CONSUMPTION' ? Number(form.liters_consumed || 0) : 0;
    const unitPrice = isBunkering ? Number(form.unit_price || 0) : 0;
    const discount = isBunkering ? Number(form.discount || 0) : 0;
    const res = await fetch(`${API_URL}/orders/accounting/fuel-entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period_month: periodMonth,
        entry_date: form.entry_date,
        vessel_code: form.vessel_code,
        entry_type: form.entry_type,
        route_label: form.route_label || null,
        liters_consumed: consumed,
        liters_bunkered: bunkered,
        unit_price: unitPrice,
        discount,
        total_amount: isBunkering ? Math.max(0, bunkered * unitPrice - discount) : 0,
        notes: form.notes || null,
      }),
    });
    if (res.ok) {
      setForm({ ...form, route_label: '', liters_consumed: '', liters_bunkered: '', notes: '' });
      loadData();
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`${API_URL}/orders/accounting/fuel-entries/${id}`, { method: 'DELETE' });
    loadData();
  };

  const totalCarryOver = rows.filter((r) => r.entry_type === 'CARRY_OVER').reduce((s, r) => s + Number(r.liters_bunkered || 0) - Number(r.liters_consumed || 0), 0);
  const totalBunkered = rows.filter((r) => r.entry_type === 'BUNKERING').reduce((s, r) => s + Number(r.liters_bunkered || 0), 0);
  const totalConsumed = rows.filter((r) => r.entry_type === 'CONSUMPTION').reduce((s, r) => s + Number(r.liters_consumed || 0), 0);
  const endingBalance = totalCarryOver + totalBunkered - totalConsumed;
  const totalMoney = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Fuel className="w-5 h-5 text-maritime-600" />
            Báo cáo Dầu DO Sà Lan Tháng {periodMonth}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Theo dõi Dầu tồn đầu kỳ, Đã đổ DO (Lít, Đơn giá, Chiết khấu), Tiêu thụ định mức theo chặng &amp; Tồn/Nợ cuối kỳ.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={vesselFilter} onChange={(e) => setVesselFilter(e.target.value)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm bg-white">
            <option value="ALL">Tất cả Sà lan</option>
            {bargeCodes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="month" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm bg-white" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase font-semibold">Đã đổ trong kỳ</p>
          <p className="text-xl font-bold text-sky-700 mt-1">{formatMoney(totalBunkered)} L</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase font-semibold">Tiêu thụ theo chặng</p>
          <p className="text-xl font-bold text-amber-700 mt-1">{formatMoney(totalConsumed)} L</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase font-semibold">Còn Tồn / Nợ cuối kỳ</p>
          <p className={`text-xl font-bold mt-1 ${endingBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatMoney(endingBalance)} L
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase font-semibold">Tổng Tiền Dầu DO</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatMoney(totalMoney)} đ</p>
        </div>
      </div>

      {/* Entry Form + Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-8 gap-2 items-end bg-slate-50 p-3 rounded-lg">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Ngày</label>
            <input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Sà lan</label>
            <select value={form.vessel_code} onChange={(e) => setForm({ ...form, vessel_code: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm bg-white">
              {bargeCodes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Loại phát sinh</label>
            <select value={form.entry_type} onChange={(e) => setForm({ ...form, entry_type: e.target.value as any })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm bg-white">
              {Object.entries(ENTRY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Tuyến chạy / Kho dầu</label>
            <input type="text" placeholder="TCCC - Cát Lái / Cây dầu..." value={form.route_label} onChange={(e) => setForm({ ...form, route_label: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
          </div>
          {form.entry_type === 'CONSUMPTION' ? (
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Lít tiêu thụ</label>
              <input type="number" required placeholder="450" value={form.liters_consumed} onChange={(e) => setForm({ ...form, liters_consumed: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Số Lít đổ / tồn</label>
              <input type="number" required placeholder="5000" value={form.liters_bunkered} onChange={(e) => setForm({ ...form, liters_bunkered: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
            </div>
          )}
          {form.entry_type === 'BUNKERING' ? (
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Đơn giá (đ/L)</label>
              <input type="number" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Ghi chú</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
            </div>
          )}
          <button type="submit" className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded bg-navy-900 text-white text-sm font-medium hover:bg-navy-800">
            <Plus className="w-4 h-4" /> Thêm
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase bg-slate-50">
                <th className="px-3 py-2 text-left">Ngày</th>
                <th className="px-3 py-2 text-left">Sà lan</th>
                <th className="px-3 py-2 text-left">Phân loại</th>
                <th className="px-3 py-2 text-left">Tuyến / Mô tả</th>
                <th className="px-3 py-2 text-right">Đã đổ / Tồn (L)</th>
                <th className="px-3 py-2 text-right">Tiêu thụ (L)</th>
                <th className="px-3 py-2 text-right">Đơn giá</th>
                <th className="px-3 py-2 text-right">Thành tiền</th>
                <th className="px-3 py-2 text-right w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-400">Chưa có sổ dầu DO tháng {periodMonth}.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-600">{r.entry_date || r.period_month}</td>
                  <td className="px-3 py-2 font-semibold text-navy-900">
                    {r.vessel_name || r.vessel_code}
                  </td>
                  <td className="px-3 py-2 text-xs">{ENTRY_LABELS[r.entry_type]}</td>
                  <td className="px-3 py-2 text-slate-700">
                    <div>{r.route_label || r.notes || '—'}</div>
                    {(r as any).linked_trip_no && (
                      <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 text-[10px] font-semibold">
                        Link: {(r as any).linked_trip_no}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-sky-700 font-medium">{r.liters_bunkered ? formatMoney(r.liters_bunkered) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-amber-700 font-medium">{r.liters_consumed ? formatMoney(r.liters_consumed) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.unit_price ? formatMoney(r.unit_price) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold">{r.total_amount ? formatMoney(r.total_amount) : '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => handleDelete(r.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
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
