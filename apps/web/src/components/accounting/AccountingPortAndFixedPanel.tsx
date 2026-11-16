'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AccountingFixedCost,
  AccountingPortExpense,
  API_URL,
  Vessel,
} from '@/lib/api';
import { Anchor, Plus, Trash2 } from 'lucide-react';
import { currentYearMonth, formatMoney, mergeVesselCodes } from './accountingUtils';

const PORT_CATEGORIES: Record<AccountingPortExpense['category'], string> = {
  PORT_AUTH: 'Cảng vụ',
  BERTH: 'Cầu bến',
  ALLOWANCE: 'Bồi dưỡng',
  OTHER: 'Chi phí khác',
};

export function AccountingPortAndFixedPanel({ vessels }: { vessels: Vessel[] }) {
  const [periodMonth, setPeriodMonth] = useState(currentYearMonth());
  const [fixedRows, setFixedRows] = useState<AccountingFixedCost[]>([]);
  const [portRows, setPortRows] = useState<AccountingPortExpense[]>([]);
  const bargeCodes = mergeVesselCodes(vessels);

  const [fixedForm, setFixedForm] = useState({
    vessel_code: 'NV18',
    charter_fee: '',
    crew_salary: '',
    social_insurance: '',
    hull_insurance: '',
    storage_fee: '',
    notes: '',
  });

  const [portForm, setPortForm] = useState({
    expense_date: `${currentYearMonth()}-01`,
    vessel_code: 'NV36',
    trip_no: '',
    category: 'PORT_AUTH' as AccountingPortExpense['category'],
    amount: '',
    description: '',
  });

  const loadData = useCallback(async () => {
    const [fRes, pRes] = await Promise.all([
      fetch(`${API_URL}/orders/accounting/fixed-costs?month=${periodMonth}`, { cache: 'no-store' }),
      fetch(`${API_URL}/orders/accounting/port-expenses?month=${periodMonth}`, { cache: 'no-store' }),
    ]);
    if (fRes.ok) setFixedRows(await fRes.json());
    if (pRes.ok) setPortRows(await pRes.json());
  }, [periodMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddFixed = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/orders/accounting/fixed-costs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period_month: periodMonth,
        vessel_code: fixedForm.vessel_code,
        charter_fee: Number(fixedForm.charter_fee || 0),
        crew_salary: Number(fixedForm.crew_salary || 0),
        social_insurance: Number(fixedForm.social_insurance || 0),
        hull_insurance: Number(fixedForm.hull_insurance || 0),
        storage_fee: Number(fixedForm.storage_fee || 0),
        notes: fixedForm.notes || null,
      }),
    });
    if (res.ok) {
      setFixedForm({ ...fixedForm, charter_fee: '', crew_salary: '', social_insurance: '', hull_insurance: '', storage_fee: '', notes: '' });
      loadData();
    }
  };

  const handleAddPort = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/orders/accounting/port-expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period_month: periodMonth,
        expense_date: portForm.expense_date,
        vessel_code: portForm.vessel_code,
        trip_no: portForm.trip_no || null,
        category: portForm.category,
        amount: Number(portForm.amount || 0),
        description: portForm.description || null,
      }),
    });
    if (res.ok) {
      setPortForm({ ...portForm, trip_no: '', amount: '', description: '' });
      loadData();
    }
  };

  const handleDelete = async (kind: 'fixed-costs' | 'port-expenses', id: string) => {
    await fetch(`${API_URL}/orders/accounting/${kind}/${id}`, { method: 'DELETE' });
    loadData();
  };

  const totalFixed = fixedRows.reduce(
    (s, r) => s + Number(r.charter_fee || 0) + Number(r.crew_salary || 0) + Number(r.social_insurance || 0) + Number(r.hull_insurance || 0) + Number(r.storage_fee || 0),
    0,
  );
  const totalPort = portRows.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Anchor className="w-5 h-5 text-maritime-600" />
            Chi phí Cố định Tháng &amp; Cảng vụ / Cầu bến / Bồi dưỡng
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Theo dõi Lương thuyền viên, Thuê sà lan, BHXH, Bảo hiểm Sà lan và lệ phí Cảng vụ/Biên phòng từng chuyến.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-600">Kỳ kế toán:</label>
          <input
            type="month"
            value={periodMonth}
            onChange={(e) => setPeriodMonth(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm bg-white"
          />
        </div>
      </div>

      {/* Section 1: Fixed Monthly Costs per Barge */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">1. Chi phí Cố định Theo Sà Lan Tháng {periodMonth}</h3>
          <span className="text-sm font-bold text-maritime-700">Tổng: {formatMoney(totalFixed)} đ</span>
        </div>

        <form onSubmit={handleAddFixed} className="grid grid-cols-2 md:grid-cols-7 gap-2 items-end bg-slate-50 p-3 rounded-lg">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Sà lan</label>
            <select
              value={fixedForm.vessel_code}
              onChange={(e) => setFixedForm({ ...fixedForm, vessel_code: e.target.value })}
              className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm bg-white"
            >
              {bargeCodes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Lương &amp; SH TV</label>
            <input type="number" placeholder="0" value={fixedForm.crew_salary} onChange={(e) => setFixedForm({ ...fixedForm, crew_salary: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Thuê Sà lan</label>
            <input type="number" placeholder="0" value={fixedForm.charter_fee} onChange={(e) => setFixedForm({ ...fixedForm, charter_fee: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">BHXH</label>
            <input type="number" placeholder="0" value={fixedForm.social_insurance} onChange={(e) => setFixedForm({ ...fixedForm, social_insurance: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Bảo hiểm Tàu</label>
            <input type="number" placeholder="0" value={fixedForm.hull_insurance} onChange={(e) => setFixedForm({ ...fixedForm, hull_insurance: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Lưu bãi &amp; Khác</label>
            <input type="number" placeholder="0" value={fixedForm.storage_fee} onChange={(e) => setFixedForm({ ...fixedForm, storage_fee: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
          </div>
          <button type="submit" className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded bg-navy-900 text-white text-sm font-medium hover:bg-navy-800">
            <Plus className="w-4 h-4" /> Lưu
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase bg-slate-50">
                <th className="px-3 py-2 text-left">Sà lan</th>
                <th className="px-3 py-2 text-right">Lương &amp; SH TV</th>
                <th className="px-3 py-2 text-right">Thuê Sà lan</th>
                <th className="px-3 py-2 text-right">BHXH</th>
                <th className="px-3 py-2 text-right">Bảo hiểm Tàu</th>
                <th className="px-3 py-2 text-right">Lưu bãi &amp; Khác</th>
                <th className="px-3 py-2 text-right">Tổng Cộng</th>
                <th className="px-3 py-2 text-right w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fixedRows.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-400">Chưa nhập định phí tháng {periodMonth}.</td></tr>
              ) : fixedRows.map((r) => {
                const rowSum = Number(r.crew_salary || 0) + Number(r.charter_fee || 0) + Number(r.social_insurance || 0) + Number(r.hull_insurance || 0) + Number(r.storage_fee || 0);
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-semibold text-navy-900">{r.vessel_code}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.crew_salary)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.charter_fee)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.social_insurance)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.hull_insurance)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.storage_fee)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-900">{formatMoney(rowSum)}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => handleDelete('fixed-costs', r.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Per-Trip Port Expenses */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">2. Chi phí Cảng vụ, Cầu bến, Bồi dưỡng theo Chuyến</h3>
          <span className="text-sm font-bold text-amber-700">Tổng: {formatMoney(totalPort)} đ</span>
        </div>

        <form onSubmit={handleAddPort} className="grid grid-cols-2 md:grid-cols-7 gap-2 items-end bg-slate-50 p-3 rounded-lg">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Ngày</label>
            <input type="date" value={portForm.expense_date} onChange={(e) => setPortForm({ ...portForm, expense_date: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Sà lan</label>
            <select value={portForm.vessel_code} onChange={(e) => setPortForm({ ...portForm, vessel_code: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm bg-white">
              {bargeCodes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Số chuyến</label>
            <input type="text" placeholder="V.36-049..." value={portForm.trip_no} onChange={(e) => setPortForm({ ...portForm, trip_no: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Khoản mục</label>
            <select value={portForm.category} onChange={(e) => setPortForm({ ...portForm, category: e.target.value as any })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm bg-white">
              {Object.entries(PORT_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Số tiền (VNĐ)</label>
            <input type="number" required placeholder="500000" value={portForm.amount} onChange={(e) => setPortForm({ ...portForm, amount: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">Diễn giải</label>
            <input type="text" placeholder="Biên phòng, xe lấy giấy..." value={portForm.description} onChange={(e) => setPortForm({ ...portForm, description: e.target.value })} className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
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
                <th className="px-3 py-2 text-left">Chuyến</th>
                <th className="px-3 py-2 text-left">Loại chi phí</th>
                <th className="px-3 py-2 text-left">Diễn giải</th>
                <th className="px-3 py-2 text-right">Số tiền</th>
                <th className="px-3 py-2 text-right w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {portRows.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Chưa có chi phí cảng vụ / cầu bến kỳ {periodMonth}.</td></tr>
              ) : portRows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-600">{r.expense_date || r.period_month}</td>
                  <td className="px-3 py-2 font-semibold text-navy-900">{r.vessel_code}</td>
                  <td className="px-3 py-2 text-slate-600">{r.trip_no || '—'}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                      {PORT_CATEGORIES[r.category] || r.category}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.description || '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">{formatMoney(r.amount)}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => handleDelete('port-expenses', r.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
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
