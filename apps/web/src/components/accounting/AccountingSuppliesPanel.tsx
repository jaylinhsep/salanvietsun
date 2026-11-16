'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AccountingSupply, API_URL, Vessel } from '@/lib/api';
import { Plus, Trash2, Wrench } from 'lucide-react';
import { currentYearMonth, findLatestPeriodMonth, formatMoney, mergeVesselCodes } from './accountingUtils';

const SUPPLY_CATEGORIES: Record<AccountingSupply['category'], string> = {
  SUPPLIES: 'Mua vật tư',
  REPAIR: 'Sửa chữa',
  DRYDOCK: 'Lên đà định kỳ',
};

export function AccountingSuppliesPanel({ vessels }: { vessels: Vessel[] }) {
  const [periodMonth, setPeriodMonth] = useState(currentYearMonth());
  const [rows, setRows] = useState<AccountingSupply[]>([]);
  const bargeCodes = mergeVesselCodes(vessels);
  const didAutoPick = useRef(false);

  const [form, setForm] = useState({
    entry_date: `${currentYearMonth()}-01`,
    vessel_code: 'NV18',
    category: 'SUPPLIES' as AccountingSupply['category'],
    item_name: '',
    unit: 'Cái',
    quantity: '1',
    unit_price: '',
    vat_rate: '8',
    invoice_no: '',
  });

  const loadData = useCallback(async () => {
    const res = await fetch(`${API_URL}/orders/accounting/supplies?month=${periodMonth}`, { cache: 'no-store' });
    const data = res.ok ? await res.json() : [];
    if (!didAutoPick.current && data.length === 0) {
      didAutoPick.current = true;
      const latest = await findLatestPeriodMonth(API_URL, 'supplies');
      if (latest && latest !== periodMonth) {
        setPeriodMonth(latest);
        return;
      }
    }
    didAutoPick.current = true;
    setRows(data);
  }, [periodMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/orders/accounting/supplies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period_month: periodMonth,
        entry_date: form.entry_date,
        vessel_code: form.vessel_code,
        category: form.category,
        item_name: form.item_name,
        unit: form.unit || null,
        quantity: Number(form.quantity || 1),
        unit_price: Number(form.unit_price || 0),
        vat_rate: Number(form.vat_rate || 0),
        invoice_no: form.invoice_no || null,
      }),
    });
    if (res.ok) {
      setForm({ ...form, item_name: '', unit_price: '', invoice_no: '' });
      loadData();
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`${API_URL}/orders/accounting/supplies/${id}`, { method: 'DELETE' });
    loadData();
  };

  const totalAmount = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-maritime-600" />
            Chi phí Vật tư, Sửa chữa &amp; Lên đà Sà Lan
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Hạch toán tự động theo nhóm Mua vật tư hoặc Lên đà &amp; Sửa chữa kèm VAT và số Hóa đơn.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-800">Tổng kỳ: {formatMoney(totalAmount)} đ</span>
          <input type="month" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm bg-white" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-9 gap-2 items-end bg-slate-50 p-3 rounded-lg">
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
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Nhóm</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as any })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm bg-white">
              {Object.entries(SUPPLY_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Nội dung / Tên vật tư</label>
            <input type="text" required placeholder="Nhớt máy chính / Bạc đạn / Lên đà..." value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">SL</label>
            <input type="number" step="0.1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Đơn giá</label>
            <input type="number" required placeholder="0" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">VAT % / HĐ</label>
            <div className="flex gap-1">
              <input type="number" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })} className="w-14 px-1.5 py-1.5 rounded border border-slate-300 text-sm" title="VAT %" />
              <input type="text" placeholder="HĐ" value={form.invoice_no} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
            </div>
          </div>
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
                <th className="px-3 py-2 text-left">Loại</th>
                <th className="px-3 py-2 text-left">Nội dung</th>
                <th className="px-3 py-2 text-right">SL</th>
                <th className="px-3 py-2 text-right">Đơn giá</th>
                <th className="px-3 py-2 text-right">VAT</th>
                <th className="px-3 py-2 text-right">Thành tiền</th>
                <th className="px-3 py-2 text-left">Số HĐ</th>
                <th className="px-3 py-2 text-right w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-6 text-center text-slate-400">Chưa có phát sinh vật tư / sửa chữa kỳ {periodMonth}.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-600">{r.entry_date || r.period_month}</td>
                  <td className="px-3 py-2 font-semibold text-navy-900">{r.vessel_code}</td>
                  <td className="px-3 py-2 text-xs">{SUPPLY_CATEGORIES[r.category]}</td>
                  <td className="px-3 py-2 text-slate-800 font-medium">{r.item_name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.quantity} {r.unit || ''}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.unit_price)}</td>
                  <td className="px-3 py-2 text-right">{r.vat_rate}%</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-900">{formatMoney(r.total_amount)}</td>
                  <td className="px-3 py-2 text-slate-500">{r.invoice_no || '—'}</td>
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
