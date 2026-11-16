'use client';

import { useCallback, useEffect, useState } from 'react';
import { AccountingVendorCost, API_URL } from '@/lib/api';
import { Download, Plus, Ship, Trash2 } from 'lucide-react';
import { currentYearMonth, exportRowsToCsv, formatMoney } from './accountingUtils';

export function AccountingVendorPanel() {
  const [periodMonth, setPeriodMonth] = useState(currentYearMonth());
  const [rows, setRows] = useState<AccountingVendorCost[]>([]);

  const [form, setForm] = useState({
    pickup_date: `${currentYearMonth()}-01`,
    vendor_name: 'Phước Tạo',
    shipping_line: 'COSCO',
    booking_no: '',
    container_no: '',
    cont_type: '20F',
    vendor_barge: 'SGL01',
    origin_name: 'SPITC',
    destination_name: 'Trà Nóc',
    freight_term: 'FI-FO',
    unit_price: '',
    fuel_surcharge: '0',
    vat_rate: '8',
    invoice_no: '',
  });

  const loadData = useCallback(async () => {
    const res = await fetch(`${API_URL}/orders/accounting/vendor-costs?month=${periodMonth}`, { cache: 'no-store' });
    if (res.ok) setRows(await res.json());
  }, [periodMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/orders/accounting/vendor-costs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period_month: periodMonth,
        pickup_date: form.pickup_date,
        vendor_name: form.vendor_name,
        shipping_line: form.shipping_line,
        booking_no: form.booking_no || null,
        container_no: form.container_no || null,
        cont_type: form.cont_type,
        vendor_barge: form.vendor_barge || null,
        origin_name: form.origin_name || null,
        destination_name: form.destination_name || null,
        freight_term: form.freight_term,
        unit_price: Number(form.unit_price || 0),
        fuel_surcharge: Number(form.fuel_surcharge || 0),
        vat_rate: Number(form.vat_rate || 8),
        invoice_no: form.invoice_no || null,
      }),
    });
    if (res.ok) {
      setForm({ ...form, booking_no: '', container_no: '', unit_price: '', invoice_no: '' });
      loadData();
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`${API_URL}/orders/accounting/vendor-costs/${id}`, { method: 'DELETE' });
    loadData();
  };

  const totalAmount = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);

  const handleExport = () => {
    exportRowsToCsv(
      `Bang_ke_Vendor_${periodMonth}.csv`,
      ['Ngày nhận', 'Vendor', 'Hãng tàu', 'Booking', 'Số Cont', 'Loại', 'Sà lan Vendor', 'Nơi nhận', 'Nơi giao', 'Điều kiện', 'Đơn giá', 'Phụ thu NL', 'VAT%', 'Thành tiền', 'Số HĐ'],
      rows.map((r) => [
        r.pickup_date || '',
        r.vendor_name || '',
        r.shipping_line || '',
        r.booking_no || '',
        r.container_no || '',
        r.cont_type,
        r.vendor_barge || '',
        r.origin_name || '',
        r.destination_name || '',
        r.freight_term || '',
        r.unit_price,
        r.fuel_surcharge,
        r.vat_rate,
        r.total_amount,
        r.invoice_no || '',
      ]),
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Ship className="w-5 h-5 text-maritime-600" />
            Bảng Kê Cước Thuê Vendor (Tàu Ngoài) Tháng {periodMonth}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Đối chiếu cước sà lan thuê ngoài (Phước Tạo, SGL...), phụ thu nhiên liệu, VAT 8% và Hóa đơn đầu vào.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-amber-700 mr-2">Tổng cộng: {formatMoney(totalAmount)} đ</span>
          <input type="month" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm bg-white" />
          <button onClick={handleExport} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">
            <Download className="w-4 h-4" /> Xuất CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-7 gap-2 items-end bg-slate-50 p-3 rounded-lg">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Ngày nhận</label>
            <input type="date" value={form.pickup_date} onChange={(e) => setForm({ ...form, pickup_date: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Đơn vị Vendor</label>
            <input type="text" required placeholder="Phước Tạo..." value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Hãng tàu</label>
            <input type="text" placeholder="COSCO / MSC" value={form.shipping_line} onChange={(e) => setForm({ ...form, shipping_line: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Booking / Bill</label>
            <input type="text" placeholder="BK..." value={form.booking_no} onChange={(e) => setForm({ ...form, booking_no: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Số Cont</label>
            <input type="text" placeholder="CSNU1234567" value={form.container_no} onChange={(e) => setForm({ ...form, container_no: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm uppercase" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Loại &amp; Sà lan</label>
            <div className="flex gap-1">
              <select value={form.cont_type} onChange={(e) => setForm({ ...form, cont_type: e.target.value })} className="w-20 px-1 py-1.5 rounded border border-slate-300 text-sm bg-white">
                {['20E', '20F', '40E', '40F'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input type="text" placeholder="SGL01" value={form.vendor_barge} onChange={(e) => setForm({ ...form, vendor_barge: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Đơn giá (Chưa VAT)</label>
            <input type="number" required placeholder="1200000" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Cảng nhận</label>
            <input type="text" value={form.origin_name} onChange={(e) => setForm({ ...form, origin_name: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Cảng giao</label>
            <input type="text" value={form.destination_name} onChange={(e) => setForm({ ...form, destination_name: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Điều kiện</label>
            <input type="text" value={form.freight_term} onChange={(e) => setForm({ ...form, freight_term: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Phụ thu NL</label>
            <input type="number" value={form.fuel_surcharge} onChange={(e) => setForm({ ...form, fuel_surcharge: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">VAT (%)</label>
            <input type="number" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Số HĐ</label>
            <input type="text" placeholder="HĐ..." value={form.invoice_no} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
          </div>
          <button type="submit" className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded bg-navy-900 text-white text-sm font-medium hover:bg-navy-800">
            <Plus className="w-4 h-4" /> Thêm Cont
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase bg-slate-50">
                <th className="px-2.5 py-2 text-left">Ngày nhận</th>
                <th className="px-2.5 py-2 text-left">Vendor</th>
                <th className="px-2.5 py-2 text-left">Hãng tàu</th>
                <th className="px-2.5 py-2 text-left">Booking</th>
                <th className="px-2.5 py-2 text-left">Số Cont</th>
                <th className="px-2.5 py-2 text-center">Loại</th>
                <th className="px-2.5 py-2 text-left">Tàu Vendor</th>
                <th className="px-2.5 py-2 text-left">Tuyến</th>
                <th className="px-2.5 py-2 text-right">Đơn giá</th>
                <th className="px-2.5 py-2 text-right">Phụ thu</th>
                <th className="px-2.5 py-2 text-right">VAT</th>
                <th className="px-2.5 py-2 text-right">Thành tiền</th>
                <th className="px-2.5 py-2 text-left">Số HĐ</th>
                <th className="px-2.5 py-2 text-right w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr><td colSpan={14} className="px-3 py-6 text-center text-slate-400">Chưa có bảng kê cước thuê Vendor kỳ {periodMonth}.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-2.5 py-2 text-slate-600">{r.pickup_date || r.period_month}</td>
                  <td className="px-2.5 py-2 font-semibold text-navy-900">{r.vendor_name}</td>
                  <td className="px-2.5 py-2">{r.shipping_line || '—'}</td>
                  <td className="px-2.5 py-2 font-mono">{r.booking_no || '—'}</td>
                  <td className="px-2.5 py-2 font-mono font-semibold">{r.container_no || '—'}</td>
                  <td className="px-2.5 py-2 text-center">{r.cont_type}</td>
                  <td className="px-2.5 py-2">{r.vendor_barge || '—'}</td>
                  <td className="px-2.5 py-2">{r.origin_name} → {r.destination_name}</td>
                  <td className="px-2.5 py-2 text-right tabular-nums">{formatMoney(r.unit_price)}</td>
                  <td className="px-2.5 py-2 text-right tabular-nums">{formatMoney(r.fuel_surcharge)}</td>
                  <td className="px-2.5 py-2 text-right">{r.vat_rate}%</td>
                  <td className="px-2.5 py-2 text-right tabular-nums font-bold text-slate-900">{formatMoney(r.total_amount)}</td>
                  <td className="px-2.5 py-2 text-slate-500">{r.invoice_no || '—'}</td>
                  <td className="px-2.5 py-2 text-right">
                    <button onClick={() => handleDelete(r.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
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
