'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL, MonthlyPnlReport, PnlBucket } from '@/lib/api';
import { Download, RefreshCw, TrendingUp } from 'lucide-react';
import { exportRowsToCsv, formatMoney } from './accountingUtils';

const COST_ITEMS: Array<{ stt: number; key: keyof PnlBucket; label: string }> = [
  { stt: 1, key: 'crew_salary', label: 'Chi phí lương & sinh hoạt thuyền viên' },
  { stt: 2, key: 'charter_fee', label: 'Chi phí thuê sà lan' },
  { stt: 3, key: 'port_auth', label: 'Chi phí Cảng vụ' },
  { stt: 4, key: 'berth', label: 'Chi phí Cầu bến' },
  { stt: 5, key: 'allowance', label: 'Chi phí Bồi dưỡng' },
  { stt: 6, key: 'other_port', label: 'Chi phí khác (Biên phòng, Đối ngoại, Đảo cont...)' },
  { stt: 7, key: 'fuel_do', label: 'Chi phí dầu DO chạy tàu' },
  { stt: 8, key: 'vendor_cost', label: 'Chi phí thuê Vendor (Tàu ngoài)' },
  { stt: 9, key: 'hull_insurance', label: 'Chi phí bảo hiểm Sà lan' },
  { stt: 10, key: 'supplies', label: 'Chi phí mua vật tư' },
  { stt: 11, key: 'repair_drydock', label: 'Chi phí lên đà & sửa chữa' },
  { stt: 12, key: 'social_insurance', label: 'Chi phí BHXH' },
  { stt: 13, key: 'storage_fee', label: 'Phí lưu bãi & phát sinh khác' },
];

export function AccountingPnlSummaryPanel() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<MonthlyPnlReport | null>(null);
  const [loading, setLoading] = useState(true);
  const didAutoPick = useRef(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/orders/accounting/pnl?year=${year}&month=${month}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as MonthlyPnlReport;
        if (
          !didAutoPick.current &&
          data.summary.revenue === 0 &&
          data.summary.total_cost === 0 &&
          data.yearly_by_barge?.length > 0
        ) {
          didAutoPick.current = true;
          let latest = 0;
          for (const row of data.yearly_by_barge) {
            for (const [mStr, cell] of Object.entries(row.months || {})) {
              const mNum = Number(mStr);
              if (mNum > latest && (cell.revenue !== 0 || cell.cost !== 0)) latest = mNum;
            }
          }
          if (latest > 0 && latest !== month) {
            setMonth(latest);
            return;
          }
        }
        didAutoPick.current = true;
        setReport(data);
      }
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const s = report?.summary;
  const activeBarges = (report?.by_barge || []).filter(
    (b) => b.revenue > 0 || b.total_cost > 0 || ['NV18', 'NV36', 'NV38', 'VENDOR'].includes(b.vessel_code),
  );

  const handleExport = () => {
    if (!s) return;
    const rows: (string | number)[][] = [
      ['A', 'DOANH THU SẢN LƯỢNG THÁNG', s.revenue],
      ['B', 'TỔNG CHI PHÍ THÁNG', s.total_cost],
      ...COST_ITEMS.map((c) => [c.stt, c.label, Number(s[c.key] || 0)]),
      ['C', 'LỢI NHUẬN TRƯỚC THUẾ (A - B)', s.net_profit],
    ];
    exportRowsToCsv(`Bao_cao_PNL_T${String(month).padStart(2, '0')}_${year}.csv`, ['STT', 'CHỈ TIÊU', 'SỐ TIỀN (VNĐ)'], rows);
  };

  return (
    <div className="space-y-6">
      {/* Header & Period Selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-maritime-600" />
            Báo cáo Tổng hợp Doanh thu - Chi phí - Lợi nhuận Tháng {String(month).padStart(2, '0')}/{year}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tự động tổng hợp từ Sản lượng Cont, Chi phí cố định, Cảng vụ, Dầu DO, Vật tư &amp; Thuê Vendor.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm bg-white"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm bg-white"
          >
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>Năm {y}</option>
            ))}
          </select>
          <button
            onClick={loadReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới
          </button>
          <button
            onClick={handleExport}
            disabled={!s}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Xuất CSV P&amp;L
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase font-semibold">A. Tổng Doanh thu Sản lượng</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatMoney(s?.revenue)} đ</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase font-semibold">B. Tổng Chi phí Vận hành</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{formatMoney(s?.total_cost)} đ</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase font-semibold">C. Lợi nhuận Tháng (A - B)</p>
          <p className={`text-2xl font-bold mt-1 ${(s?.net_profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatMoney(s?.net_profit)} đ
          </p>
        </div>
      </div>

      {/* Two side-by-side tables matching Sheet 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: 13 Cost Items */}
        <div className="xl:col-span-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-semibold text-sm text-slate-800">
            Bảng Kê Kết quả Kinh doanh Chi tiết (13 Khoản mục)
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase bg-slate-50/50">
                <th className="px-3 py-2 text-left w-12">STT</th>
                <th className="px-3 py-2 text-left">Nội dung</th>
                <th className="px-3 py-2 text-right">Thành tiền (VNĐ)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="bg-sky-50/70 font-bold text-slate-900">
                <td className="px-3 py-2">A</td>
                <td className="px-3 py-2">TỔNG DOANH THU SẢN LƯỢNG</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(s?.revenue)}</td>
              </tr>
              <tr className="bg-amber-50/70 font-bold text-slate-900">
                <td className="px-3 py-2">B</td>
                <td className="px-3 py-2">TỔNG CHI PHÍ TRONG KỲ</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(s?.total_cost)}</td>
              </tr>
              {COST_ITEMS.map((item) => {
                const val = Number(s?.[item.key] || 0);
                return (
                  <tr key={item.key} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-500">{item.stt}</td>
                    <td className="px-3 py-2 text-slate-700">{item.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900">
                      {formatMoney(val)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-emerald-50 font-bold text-slate-900 border-t-2 border-slate-300">
                <td className="px-3 py-2.5">C</td>
                <td className="px-3 py-2.5">LỢI NHUẬN = (A) - (B)</td>
                <td className={`px-3 py-2.5 text-right tabular-nums ${(s?.net_profit || 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {formatMoney(s?.net_profit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Right: Per-Barge Breakdown */}
        <div className="xl:col-span-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-semibold text-sm text-slate-800">
            Hiệu quả Lợi nhuận Theo Từng Sà Lan / Vendor
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase bg-slate-50/50">
                  <th className="px-3 py-2 text-left">Sà lan</th>
                  <th className="px-3 py-2 text-right">Doanh thu</th>
                  <th className="px-3 py-2 text-right">Tổng Chi phí</th>
                  <th className="px-3 py-2 text-right">Lợi nhuận</th>
                  <th className="px-3 py-2 text-right">Tỷ suất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeBarges.map((b) => {
                  const pct = b.revenue > 0 ? ((b.net_profit / b.revenue) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={b.vessel_code} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-semibold text-navy-900">{b.vessel_code}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(b.revenue)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">{formatMoney(b.total_cost)}</td>
                      <td className={`px-3 py-2.5 text-right tabular-nums font-bold ${b.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatMoney(b.net_profit)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-500">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* YTD Cumulative Matrix Jan -> Dec */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-semibold text-sm text-slate-800">
          Bảng Theo Dõi Lũy Kế Lợi Nhuận Năm {year} (T1 → T12)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase bg-slate-50/50">
                <th className="px-3 py-2 text-left sticky left-0 bg-slate-50">Sà Lan</th>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <th key={m} className="px-2 py-2 text-right">T{m}</th>
                ))}
                <th className="px-3 py-2 text-right font-bold text-slate-800">Lũy kế LN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(report?.yearly_by_barge || []).length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-6 text-center text-slate-400">
                    Chưa có phát sinh doanh thu / chi phí trong năm {year}.
                  </td>
                </tr>
              ) : (
                (report?.yearly_by_barge || []).map((row) => (
                  <tr key={row.vessel_code} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-semibold text-navy-900 sticky left-0 bg-white">
                      {row.vessel_code}
                    </td>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                      const val = row.months[m]?.profit || 0;
                      return (
                        <td
                          key={m}
                          className={`px-2 py-2 text-right tabular-nums ${
                            val === 0 ? 'text-slate-300' : val > 0 ? 'text-emerald-700 font-medium' : 'text-red-600 font-medium'
                          }`}
                        >
                          {val === 0 ? '—' : formatMoney(val)}
                        </td>
                      );
                    })}
                    <td className={`px-3 py-2 text-right tabular-nums font-bold ${row.total_profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {formatMoney(row.total_profit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
