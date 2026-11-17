'use client';

import React, { useEffect, useState } from 'react';
import {
  CalendarDays,
  Check,
  ClipboardPaste,
  Copy,
  Download,
  ExternalLink,
  Plus,
  RotateCcw,
  Save,
  X,
} from 'lucide-react';
import { API_URL, FALLBACK_VESSELS, fetchApi, type Vessel } from '@/lib/api';
import { SailingScheduleSheetView } from '@/components/SailingScheduleSheetView';
import {
  DEFAULT_SAILING_SCHEDULE,
  exportSheetToCsv,
  normalizeDateCellDisplay,
  normalizeSchedulePayload,
  type SailingSchedulePayload,
  type SailingScheduleRow,
  type SailingScheduleSheet,
} from '@/lib/sailing-schedule';

const PUBLIC_URL = 'https://salan.vietsun.site/lich';

function parsePastedExcelRows(text: string): SailingScheduleRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  const parsed: SailingScheduleRow[] = [];
  for (const line of lines) {
    const rawCols = line.includes('\t')
      ? line.split('\t').map((c) => c.trim())
      : line.split(',').map((c) => c.trim());
    // Excel CSV exports sometimes have an empty leading column A
    const cols = rawCols[0] === '' && rawCols.length >= 8 ? rawCols.slice(1) : rawCols;
    if (cols.length < 2) continue;
    const first = cols[0].toUpperCase();
    if (
      first === 'TÊN PHƯƠNG TIỆN' ||
      first === 'VOY' ||
      first.startsWith('*ABOVE') ||
      first.startsWith('CONTACT')
    ) {
      continue;
    }
    parsed.push({
      id: `imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      vessel_name: cols[0] || '',
      hcm_voy: cols[1] || '',
      hcm_etd: normalizeDateCellDisplay(cols[2] || ''),
      ct_eta: normalizeDateCellDisplay(cols[3] || ''),
      ct_voy: cols[4] || '',
      ct_etd: normalizeDateCellDisplay(cols[5] || ''),
      hcm_eta: normalizeDateCellDisplay(cols[6] || ''),
    });
  }
  return parsed;
}

export default function ScheduleAdminPage() {
  const [payload, setPayload] = useState<SailingSchedulePayload>(() =>
    structuredClone(DEFAULT_SAILING_SCHEDULE),
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(
    DEFAULT_SAILING_SCHEDULE.active_month,
  );
  const [vesselFilter, setVesselFilter] = useState<string>('ALL');
  const [vesselNames, setVesselNames] = useState<string[]>([
    'NHẬT VIỆT 18',
    'NHẬT VIỆT 36',
    'NHẬT VIỆT 38',
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Paste from Excel modal
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteMode, setPasteMode] = useState<'append' | 'replace'>('replace');

  // Create new month modal
  const [showNewMonthModal, setShowNewMonthModal] = useState(false);
  const [newMonthKey, setNewMonthKey] = useState('2026-12');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/dispatch/sailing-schedule`, {
          cache: 'no-store',
        });
        if (res.ok && active) {
          const raw = await res.json();
          const norm = normalizeSchedulePayload(raw);
          setPayload(norm);
          setSelectedMonth(norm.active_month);
        }
      } catch {
        // fall back to default template
      } finally {
        if (active) setLoading(false);
      }
    })();

    fetchApi<Vessel[]>('/fleet/vessels', FALLBACK_VESSELS).then((r) => {
      if (!active) return;
      const names = (r.data || [])
        .filter((v) => !(v as any).is_vendor_barge)
        .map((v) => v.name);
      if (names.length > 0) setVesselNames(names);
    });

    return () => {
      active = false;
    };
  }, []);

  const currentSheet =
    payload.sheets.find((s) => s.month_key === selectedMonth) || payload.sheets[0];

  const handleUpdateCurrentSheet = (
    updater: (prev: SailingScheduleSheet) => SailingScheduleSheet,
  ) => {
    setPayload((prev) => ({
      ...prev,
      sheets: prev.sheets.map((sh) =>
        sh.month_key === currentSheet.month_key ? updater(sh) : sh,
      ),
    }));
    setDirty(true);
    setStatusMsg('');
  };

  const handleSave = async (nextPayload?: SailingSchedulePayload) => {
    const toSave = nextPayload || payload;
    setSaving(true);
    setStatusMsg('');
    try {
      const res = await fetch(`${API_URL}/dispatch/sailing-schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSave),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `HTTP ${res.status}`);
      }
      const saved = await res.json();
      const norm = normalizeSchedulePayload(saved);
      setPayload(norm);
      setDirty(false);
      setStatusMsg('Đã lưu & cập nhật lên trang Public /lich!');
    } catch (err: any) {
      alert(err?.message || 'Không thể lưu lịch chạy sà lan lên máy chủ.');
    } finally {
      setSaving(false);
    }
  };

  const handleSetPublicActiveMonth = async () => {
    const next: SailingSchedulePayload = {
      ...payload,
      active_month: currentSheet.month_key,
    };
    setPayload(next);
    await handleSave(next);
  };

  const handleCreateNewMonth = (e: React.FormEvent) => {
    e.preventDefault();
    const key = newMonthKey.trim();
    if (!key) return;
    if (payload.sheets.some((s) => s.month_key === key)) {
      setSelectedMonth(key);
      setShowNewMonthModal(false);
      return;
    }
    const [yyyy, mm] = key.split('-');
    const monthLabel = mm && yyyy ? `${mm}/${yyyy}` : key;
    const today = new Date();
    const ddStr = String(today.getDate()).padStart(2, '0');
    const mmStr = String(today.getMonth() + 1).padStart(2, '0');
    const newSheet: SailingScheduleSheet = {
      ...structuredClone(currentSheet),
      month_key: key,
      title: `LỊCH CHẠY SÀ LAN THÁNG ${monthLabel} (Update:${ddStr}/${mmStr}/${today.getFullYear()})`,
      rows: [],
    };
    setPayload((prev) => ({
      ...prev,
      active_month: key,
      sheets: [...prev.sheets, newSheet],
    }));
    setSelectedMonth(key);
    setDirty(true);
    setShowNewMonthModal(false);
  };

  const handleApplyPaste = () => {
    const rows = parsePastedExcelRows(pasteText);
    if (rows.length === 0) {
      alert('Không nhận diện được dòng dữ liệu hợp lệ. Vui lòng copy đủ các cột từ Excel.');
      return;
    }
    handleUpdateCurrentSheet((prev) => ({
      ...prev,
      rows: pasteMode === 'replace' ? rows : [...prev.rows, ...rows],
    }));
    setShowPasteModal(false);
    setPasteText('');
  };

  const handleCopyPublicLink = async () => {
    try {
      await navigator.clipboard.writeText(PUBLIC_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('Copy link Public bên dưới:', PUBLIC_URL);
    }
  };

  const handleResetTemplate = () => {
    if (!confirm('Khôi phục bảng lịch tháng 11/2026 về đúng mẫu Excel gốc?')) return;
    const reset = structuredClone(DEFAULT_SAILING_SCHEDULE);
    setPayload(reset);
    setSelectedMonth(reset.active_month);
    setDirty(true);
    setStatusMsg('Đã khôi phục mẫu gốc — bấm Lưu thay đổi để cập nhật.');
  };

  const distinctSheetVessels = Array.from(
    new Set(currentSheet.rows.map((r) => r.vessel_name.trim()).filter(Boolean)),
  );

  return (
    <div className="space-y-4">
      {/* Header & Public Sharing Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-maritime-600" />
            Lịch chạy Sà lan (Form Excel &amp; Public)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Chỉnh sửa trực tiếp từng ô như Excel • Khách hàng &amp; đối tác xem bản chỉ đọc tại{' '}
            <a
              href="/lich"
              target="_blank"
              rel="noreferrer"
              className="text-maritime-600 font-semibold hover:underline"
            >
              {PUBLIC_URL}
            </a>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyPublicLink}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Đã copy link' : 'Copy link /lich'}
          </button>

          <a
            href="/lich"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-sky-300 bg-sky-50 text-xs sm:text-sm font-semibold text-sky-800 hover:bg-sky-100"
          >
            <ExternalLink className="w-4 h-4" /> Xem chế độ Public (/lich)
          </a>

          <button
            type="button"
            onClick={() => exportSheetToCsv(currentSheet)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-xs sm:text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            <Download className="w-4 h-4" /> Xuất Excel (.csv)
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave()}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white shadow-sm transition-colors ${
              dirty
                ? 'bg-maritime-600 hover:bg-maritime-500'
                : 'bg-navy-900 hover:bg-navy-800'
            } disabled:opacity-60`}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Đang lưu...' : dirty ? 'Lưu & Đồng bộ Public*' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>

      {/* Controls & Status Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Bảng tháng:</span>
          {payload.sheets.map((sh) => (
            <button
              key={sh.month_key}
              type="button"
              onClick={() => setSelectedMonth(sh.month_key)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                sh.month_key === currentSheet.month_key
                  ? 'bg-navy-900 text-white border-navy-900'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {sh.month_key}
              {sh.month_key === payload.active_month && ' (Public)'}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowNewMonthModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm tháng mới
          </button>
          {currentSheet.month_key !== payload.active_month && (
            <button
              type="button"
              onClick={handleSetPublicActiveMonth}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500"
            >
              Chọn tháng này làm mặc định Public
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPasteModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            <ClipboardPaste className="w-3.5 h-3.5 text-maritime-600" /> Dán từ Excel
          </button>
          <button
            type="button"
            onClick={handleResetTemplate}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Mẫu gốc T11/2026
          </button>
        </div>
      </div>

      {/* Filter Pills + Save Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500 mr-1">Lọc theo sà lan:</span>
          {['ALL', ...distinctSheetVessels].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVesselFilter(v)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                vesselFilter === v
                  ? 'bg-maritime-600 text-white border-maritime-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {v === 'ALL' ? 'Tất cả' : v}
            </button>
          ))}
        </div>

        <div className="text-xs">
          {loading ? (
            <span className="text-slate-500">Đang tải dữ liệu...</span>
          ) : statusMsg ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              <Check className="w-3.5 h-3.5" /> {statusMsg}
            </span>
          ) : dirty ? (
            <span className="text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              Có thay đổi chưa lưu — bấm &quot;Lưu &amp; Đồng bộ Public&quot; để xuất bản
            </span>
          ) : payload.updated_at ? (
            <span className="text-slate-500">
              Cập nhật lần cuối: {new Date(payload.updated_at).toLocaleString('vi-VN')}
            </span>
          ) : null}
        </div>
      </div>

      {/* Editable Excel Form */}
      <SailingScheduleSheetView
        sheet={currentSheet}
        editable={true}
        filterVessel={vesselFilter}
        vesselSuggestions={vesselNames}
        onChangeSheet={handleUpdateCurrentSheet}
      />

      {/* Paste from Excel Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Dán dữ liệu lịch chạy từ Excel</h3>
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Copy 7 cột trong Excel (<code>TÊN PHƯƠNG TIỆN | VOY | ETD | ETA | VOY | ETD | ETA</code>) rồi dán vào khung bên dưới:
            </p>
            <textarea
              rows={8}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'NHẬT VIỆT 18\tV18 - 4626W\t29/10\t30/10\tV18 - 4626E\t01/11\t02/11'}
              className="w-full border border-slate-300 rounded-lg p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <div className="flex items-center gap-4 text-xs">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  checked={pasteMode === 'replace'}
                  onChange={() => setPasteMode('replace')}
                />
                Thay thế toàn bộ bảng tháng hiện tại
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  checked={pasteMode === 'append'}
                  onChange={() => setPasteMode('append')}
                />
                Thêm tiếp vào cuối bảng
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleApplyPaste}
                className="px-4 py-2 rounded-lg bg-maritime-600 text-white text-xs font-semibold hover:bg-maritime-500"
              >
                Áp dụng vào bảng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Month Modal */}
      {showNewMonthModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateNewMonth}
            className="bg-white rounded-xl max-w-sm w-full p-5 space-y-4 shadow-xl"
          >
            <h3 className="font-bold text-slate-900">Tạo lịch chạy tháng mới</h3>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Tháng (YYYY-MM)
              </label>
              <input
                type="month"
                required
                value={newMonthKey}
                onChange={(e) => setNewMonthKey(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewMonthModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-maritime-600 text-white text-xs font-semibold"
              >
                Tạo tháng mới
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
