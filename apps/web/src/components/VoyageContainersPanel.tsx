'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ClipboardPaste,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import {
  API_URL,
  type ContType,
  type Customer,
  type Port,
  type Vessel,
  type Voyage,
  type VoyageContainer,
} from '@/lib/api';

interface Props {
  voyage: Voyage;
  ports: Port[];
  customers: Customer[];
  vessels: Vessel[];
  onBack: () => void;
  onVoyageUpdated: () => void;
}

interface DraftRow {
  barge_code: string;
  trip_no: string;
  container_no: string;
  seal_no: string;
  origin_name: string;
  destination_name: string;
  shipper_name: string;
  departure_date: string;
  cont_type: ContType;
  unit_price: number;
  baf: number;
  total_amount: number;
  fuel_price_no_vat: number;
  notes: string;
}

const CONT_TYPES: ContType[] = ['20E', '20F', '40E', '40F'];

function parseNum(raw?: string | number | null): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  if (!raw) return 0;
  const cleaned = String(raw).replace(/,/g, '').replace(/\s+/g, '').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseExcelDate(raw?: string): string {
  if (!raw) return '';
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!m) return '';
  const a = Number(m[1]);
  const b = Number(m[2]);
  const y = m[3];
  // Support US MM/DD/YYYY (from Excel sample 10/21/2026) and DD/MM/YYYY when first part > 12
  const month = a > 12 ? b : a;
  const day = a > 12 ? a : b;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatMoney(n?: number | null): string {
  return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function makeDefaultDraft(voyage: Voyage): DraftRow {
  return {
    barge_code: voyage.vessel_code || voyage.vessel_name || '',
    trip_no: voyage.voyage_no || '',
    container_no: '',
    seal_no: '',
    origin_name: voyage.origin_name || '',
    destination_name: voyage.dest_name || '',
    shipper_name: voyage.customer_name || voyage.customer_code || '',
    departure_date: voyage.received_date
      ? voyage.received_date.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    cont_type: '20E',
    unit_price: 0,
    baf: 0,
    total_amount: 0,
    fuel_price_no_vat: 0,
    notes: '',
  };
}

function parseExcelPaste(text: string, fallback: DraftRow): DraftRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim().length > 0);

  const parsed: DraftRow[] = [];
  for (const line of lines) {
    const cols = line.split('\t').map((c) => c.trim());
    if (cols.length < 2) continue;

    // Skip Excel header rows
    const joined = cols.slice(0, 4).join(' ').toUpperCase();
    if (
      joined.includes('SÀLAN') ||
      joined.includes('SÀ LAN') ||
      joined.includes('SỐCONT') ||
      joined.includes('SỐ CONT') ||
      joined.includes('20E')
    ) {
      continue;
    }

    // Standard 16-col Excel layout matching user's template:
    // 0: SÀLAN, 1: SỐ CHUYẾN, 2: SỐCONT, 3: CẢNG ĐI, 4: CẢNG ĐẾN, 5: CHỦ HÀNG, 6: NGÀY ĐI,
    // 7: 20E, 8: 20F, 9: 40E, 10: 40F, 11: ĐƠN GIÁ, 12: BAF, 13: THÀNH TIỀN, 14: GIÁ NL K VAT, 15: GHI CHÚ
    const containerNo = (cols[2] || '').toUpperCase().trim();
    if (!containerNo) continue;

    let contType: ContType = '20F';
    if (parseNum(cols[7]) > 0) contType = '20E';
    else if (parseNum(cols[8]) > 0) contType = '20F';
    else if (parseNum(cols[9]) > 0) contType = '40E';
    else if (parseNum(cols[10]) > 0) contType = '40F';
    else {
      const explicit = cols.slice(7, 11).find((c) => /^(20E|20F|40E|40F)$/i.test(c));
      if (explicit) contType = explicit.toUpperCase() as ContType;
    }

    const unitPrice = parseNum(cols[11]);
    const baf = parseNum(cols[12]);
    const totalAmount = cols[13] ? parseNum(cols[13]) : unitPrice + baf;
    const fuelPrice = parseNum(cols[14]);

    parsed.push({
      barge_code: cols[0] || fallback.barge_code,
      trip_no: cols[1] || fallback.trip_no,
      container_no: containerNo,
      seal_no: cols[16] || '',
      origin_name: cols[3] || fallback.origin_name,
      destination_name: cols[4] || fallback.destination_name,
      shipper_name: cols[5] || fallback.shipper_name,
      departure_date: parseExcelDate(cols[6]) || fallback.departure_date,
      cont_type: contType,
      unit_price: unitPrice,
      baf,
      total_amount: totalAmount,
      fuel_price_no_vat: fuelPrice,
      notes: cols[15] || '',
    });
  }
  return parsed;
}

export function VoyageContainersPanel({
  voyage,
  ports,
  customers,
  vessels,
  onBack,
  onVoyageUpdated,
}: Props) {
  const [rows, setRows] = useState<VoyageContainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newRow, setNewRow] = useState<DraftRow>(() => makeDefaultDraft(voyage));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<DraftRow>(() => makeDefaultDraft(voyage));

  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [replaceOnPaste, setReplaceOnPaste] = useState(false);

  const contNoInputRef = useRef<HTMLInputElement>(null);

  const loadContainers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/dispatch/voyages/${voyage.id}/containers`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data: VoyageContainer[] = await res.json();
        setRows(data);
        if (data.length > 0) {
          const last = data[data.length - 1];
          setNewRow((prev) => ({
            ...prev,
            barge_code: last.barge_code || prev.barge_code,
            trip_no: last.trip_no || prev.trip_no,
            origin_name: last.origin_name || prev.origin_name,
            destination_name: last.destination_name || prev.destination_name,
            shipper_name: last.shipper_name || prev.shipper_name,
            departure_date: last.departure_date ? last.departure_date.slice(0, 10) : prev.departure_date,
            cont_type: last.cont_type || prev.cont_type,
            unit_price: Number(last.unit_price || 0),
            baf: Number(last.baf || 0),
            total_amount: Number(last.unit_price || 0) + Number(last.baf || 0),
            fuel_price_no_vat: Number(last.fuel_price_no_vat || 0),
          }));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setNewRow(makeDefaultDraft(voyage));
    loadContainers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voyage.id]);

  // Duplicate container check (matches red highlights in Excel template)
  const duplicateSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const key = (r.container_no || '').trim().toUpperCase();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    const dups = new Set<string>();
    for (const [k, v] of counts.entries()) {
      if (v > 1) dups.add(k);
    }
    return dups;
  }, [rows]);

  const stats = useMemo(() => {
    let c20e = 0,
      c20f = 0,
      c40e = 0,
      c40f = 0,
      sumUnit = 0,
      sumBaf = 0,
      sumTotal = 0;
    for (const r of rows) {
      if (r.cont_type === '20E') c20e++;
      else if (r.cont_type === '20F') c20f++;
      else if (r.cont_type === '40E') c40e++;
      else if (r.cont_type === '40F') c40f++;
      sumUnit += Number(r.unit_price || 0);
      sumBaf += Number(r.baf || 0);
      sumTotal += Number(r.total_amount || 0);
    }
    const totalTeus = c20e + c20f + (c40e + c40f) * 2;
    return { c20e, c20f, c40e, c40f, totalTeus, sumUnit, sumBaf, sumTotal };
  }, [rows]);

  const updateDraftPrice = (
    setter: React.Dispatch<React.SetStateAction<DraftRow>>,
    field: 'unit_price' | 'baf',
    value: number,
  ) => {
    setter((prev) => {
      const next = { ...prev, [field]: value };
      next.total_amount = Number(next.unit_price || 0) + Number(next.baf || 0);
      return next;
    });
  };

  const handleAddRow = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newRow.container_no.trim()) {
      alert('Vui lòng nhập SỐ CONT.');
      contNoInputRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/dispatch/voyages/${voyage.id}/containers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRow),
      });
      if (!res.ok) {
        alert(`Không thể thêm container (${res.status}): ${await res.text()}`);
        return;
      }
      setNewRow((prev) => ({ ...prev, container_no: '', seal_no: '', notes: '' }));
      await loadContainers();
      onVoyageUpdated();
      setTimeout(() => contNoInputRef.current?.focus(), 50);
    } finally {
      setSaving(false);
    }
  };

  const startEditRow = (r: VoyageContainer) => {
    setEditingId(r.id);
    setEditRow({
      barge_code: r.barge_code || '',
      trip_no: r.trip_no || '',
      container_no: r.container_no || '',
      seal_no: r.seal_no || '',
      origin_name: r.origin_name || '',
      destination_name: r.destination_name || '',
      shipper_name: r.shipper_name || '',
      departure_date: r.departure_date ? r.departure_date.slice(0, 10) : '',
      cont_type: r.cont_type,
      unit_price: Number(r.unit_price || 0),
      baf: Number(r.baf || 0),
      total_amount: Number(r.total_amount || 0),
      fuel_price_no_vat: Number(r.fuel_price_no_vat || 0),
      notes: r.notes || '',
    });
  };

  const handleSaveEdit = async (containerId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/dispatch/containers/${containerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editRow),
      });
      if (!res.ok) {
        alert(`Không thể cập nhật (${res.status}): ${await res.text()}`);
        return;
      }
      setEditingId(null);
      await loadContainers();
      onVoyageUpdated();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRow = async (containerId: string) => {
    if (!confirm('Xóa dòng container này khỏi chuyến?')) return;
    await fetch(`${API_URL}/dispatch/containers/${containerId}`, { method: 'DELETE' });
    await loadContainers();
    onVoyageUpdated();
  };

  const handleSyncVoyageCounts = async () => {
    const res = await fetch(`${API_URL}/dispatch/voyages/${voyage.id}/sync-containers`, {
      method: 'POST',
    });
    if (res.ok) {
      onVoyageUpdated();
      alert(
        `Đã đồng bộ số lượng lên lệnh chuyến ${voyage.voyage_no}: ${stats.c20e}×20E, ${stats.c20f}×20F, ${stats.c40e}×40E, ${stats.c40f}×40F (${stats.totalTeus} TEUs).`,
      );
    }
  };

  const parsedPasteRows = useMemo(
    () => parseExcelPaste(pasteText, makeDefaultDraft(voyage)),
    [pasteText, voyage],
  );

  const handleImportPaste = async () => {
    if (parsedPasteRows.length === 0) {
      alert('Không nhận diện được dòng container hợp lệ. Hãy kiểm tra định dạng copy từ Excel.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/dispatch/voyages/${voyage.id}/containers/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsedPasteRows, replace: replaceOnPaste }),
      });
      if (!res.ok) {
        alert(`Lỗi nhập hàng loạt (${res.status}): ${await res.text()}`);
        return;
      }
      setShowPasteModal(false);
      setPasteText('');
      await loadContainers();
      onVoyageUpdated();
    } finally {
      setSaving(false);
    }
  };

  const handleExportCsv = () => {
    const header = [
      'SALAN',
      'SO CHUYEN',
      'SO CONT',
      'SO SEAL',
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
    const lines = [
      header.join(','),
      ...rows.map((r) =>
        [
          r.barge_code || '',
          r.trip_no || '',
          r.container_no,
          r.seal_no || '',
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
      ),
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chi-tiet-chuyen-${voyage.voyage_no}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            onClick={onBack}
            className="mt-0.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-navy-900">
                Bảng kê Chi tiết Chuyến: {voyage.voyage_no}
              </h2>
              <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-xs font-semibold">
                Sà lan: {voyage.vessel_name || voyage.vessel_code || 'Chưa gán'}
              </span>
              {voyage.pic_name && (
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                  PIC: {voyage.pic_name}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Tuyến: {voyage.origin_name || '—'} → {voyage.dest_name || '—'} • Khách hàng chính:{' '}
              {voyage.customer_name || '—'} • Kế hoạch: {voyage.total_teus || 0} TEUs
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowPasteModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500"
          >
            <ClipboardPaste className="w-4 h-4" /> Dán hàng loạt từ Excel
          </button>
          <button
            onClick={handleSyncVoyageCounts}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-maritime-300 bg-maritime-50 text-maritime-700 text-xs font-medium hover:bg-maritime-100"
            title="Cập nhật lại số lượng 20E/20F/40E/40F và Tổng TEU trên bảng điều độ tổng"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Đồng bộ SL về chuyến
          </button>
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50"
          >
            <Download className="w-3.5 h-3.5" /> Xuất Excel
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="text-[11px] uppercase text-slate-500 font-medium">Tổng số Cont</div>
          <div className="text-xl font-bold text-slate-900 mt-0.5">{rows.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="text-[11px] uppercase text-slate-500 font-medium">Cơ cấu Cont</div>
          <div className="text-xs font-semibold text-slate-800 mt-1">
            20E: {stats.c20e} • 20F: {stats.c20f} • 40E: {stats.c40e} • 40F: {stats.c40f}
          </div>
        </div>
        <div className="bg-rose-50 rounded-xl border border-rose-200 p-3">
          <div className="text-[11px] uppercase text-rose-700 font-medium">Tổng TEUs chi tiết</div>
          <div className="text-xl font-bold text-rose-700 mt-0.5">{stats.totalTeus} TEUs</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="text-[11px] uppercase text-slate-500 font-medium">Tổng Đơn giá</div>
          <div className="text-base font-bold text-slate-900 mt-1">{formatMoney(stats.sumUnit)} đ</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="text-[11px] uppercase text-slate-500 font-medium">Tổng BAF</div>
          <div className="text-base font-bold text-slate-900 mt-1">{formatMoney(stats.sumBaf)} đ</div>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-3">
          <div className="text-[11px] uppercase text-emerald-700 font-medium">Tổng Thành tiền</div>
          <div className="text-lg font-bold text-emerald-700 mt-0.5">{formatMoney(stats.sumTotal)} đ</div>
        </div>
      </div>

      {/* Autocomplete datalists */}
      <datalist id="dl-ports">
        {ports.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>
      <datalist id="dl-customers">
        {customers.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
      <datalist id="dl-vessels">
        {vessels.map((v) => (
          <option key={v.id} value={v.code} />
        ))}
      </datalist>

      {/* Excel-style Detail Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {duplicateSet.size > 0 && (
          <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 text-xs text-rose-700 font-medium">
            Cảnh báo: phát hiện {duplicateSet.size} số container bị trùng lặp (được tô đỏ giống file Excel).
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left whitespace-nowrap border-collapse">
            <thead className="bg-cyan-50 text-slate-800 font-bold border-b border-slate-300">
              <tr>
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
                  SỐ SEAL
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

            <tbody className="divide-y divide-slate-200">
              {/* Quick Add Row (Always visible for fast spreadsheet-like entry) */}
              <tr className="bg-amber-50/70 border-b-2 border-amber-200">
                <td className="px-2 py-1.5 border-r border-slate-200 text-center text-[11px] font-bold text-amber-700">
                  + Mới
                </td>
                <td className="px-1 py-1.5 border-r border-slate-200">
                  <input
                    list="dl-vessels"
                    className="w-20 border border-slate-300 rounded px-1.5 py-1 bg-white text-xs"
                    value={newRow.barge_code}
                    onChange={(e) => setNewRow({ ...newRow, barge_code: e.target.value })}
                    placeholder="NV36"
                  />
                </td>
                <td className="px-1 py-1.5 border-r border-slate-200">
                  <input
                    className="w-28 border border-slate-300 rounded px-1.5 py-1 bg-white text-xs"
                    value={newRow.trip_no}
                    onChange={(e) => setNewRow({ ...newRow, trip_no: e.target.value })}
                    placeholder="V.36-..."
                  />
                </td>
                <td className="px-1 py-1.5 border-r border-slate-200">
                  <input
                    ref={contNoInputRef}
                    className="w-32 border-2 border-maritime-400 rounded px-1.5 py-1 bg-white text-xs font-mono font-semibold uppercase"
                    value={newRow.container_no}
                    onChange={(e) => setNewRow({ ...newRow, container_no: e.target.value.toUpperCase() })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddRow();
                      }
                    }}
                    placeholder="MSMU1758748"
                  />
                </td>
                <td className="px-1 py-1.5 border-r border-slate-200">
                  <input
                    className="w-24 border border-slate-300 rounded px-1.5 py-1 bg-white text-xs font-mono uppercase"
                    value={newRow.seal_no}
                    onChange={(e) => setNewRow({ ...newRow, seal_no: e.target.value.toUpperCase() })}
                    placeholder="SL12345"
                  />
                </td>
                <td className="px-1 py-1.5 border-r border-slate-200">
                  <input
                    list="dl-ports"
                    className="w-28 border border-slate-300 rounded px-1.5 py-1 bg-white text-xs"
                    value={newRow.origin_name}
                    onChange={(e) => setNewRow({ ...newRow, origin_name: e.target.value })}
                    placeholder="SPITC"
                  />
                </td>
                <td className="px-1 py-1.5 border-r border-slate-200">
                  <input
                    list="dl-ports"
                    className="w-28 border border-slate-300 rounded px-1.5 py-1 bg-white text-xs"
                    value={newRow.destination_name}
                    onChange={(e) => setNewRow({ ...newRow, destination_name: e.target.value })}
                    placeholder="Trà Nóc"
                  />
                </td>
                <td className="px-1 py-1.5 border-r border-slate-200">
                  <input
                    list="dl-customers"
                    className="w-32 border border-slate-300 rounded px-1.5 py-1 bg-white text-xs"
                    value={newRow.shipper_name}
                    onChange={(e) => setNewRow({ ...newRow, shipper_name: e.target.value })}
                    placeholder="Phước Tạo"
                  />
                </td>
                <td className="px-1 py-1.5 border-r border-slate-200">
                  <input
                    type="date"
                    className="border border-slate-300 rounded px-1 py-1 bg-white text-xs"
                    value={newRow.departure_date}
                    onChange={(e) => setNewRow({ ...newRow, departure_date: e.target.value })}
                  />
                </td>
                {CONT_TYPES.map((ct) => (
                  <td
                    key={ct}
                    onClick={() => setNewRow({ ...newRow, cont_type: ct })}
                    className={`px-2 py-1.5 border-r border-slate-200 text-center cursor-pointer select-none font-bold ${
                      newRow.cont_type === ct
                        ? 'bg-maritime-600 text-white'
                        : 'bg-white text-slate-300 hover:bg-slate-100'
                    }`}
                    title={`Chọn loại ${ct}`}
                  >
                    {newRow.cont_type === ct ? '1' : '0'}
                  </td>
                ))}
                <td className="px-1 py-1.5 border-r border-slate-200">
                  <input
                    type="number"
                    className="w-24 border border-slate-300 rounded px-1.5 py-1 bg-white text-xs text-right"
                    value={newRow.unit_price || ''}
                    onChange={(e) => updateDraftPrice(setNewRow, 'unit_price', Number(e.target.value))}
                    placeholder="638182"
                  />
                </td>
                <td className="px-1 py-1.5 border-r border-slate-200">
                  <input
                    type="number"
                    className="w-24 border border-slate-300 rounded px-1.5 py-1 bg-white text-xs text-right"
                    value={newRow.baf || ''}
                    onChange={(e) => updateDraftPrice(setNewRow, 'baf', Number(e.target.value))}
                    placeholder="129600"
                  />
                </td>
                <td className="px-1 py-1.5 border-r border-slate-200">
                  <input
                    type="number"
                    className="w-24 border border-slate-300 rounded px-1.5 py-1 bg-emerald-50 font-semibold text-xs text-right"
                    value={newRow.total_amount || ''}
                    onChange={(e) => setNewRow({ ...newRow, total_amount: Number(e.target.value) })}
                  />
                </td>
                <td className="px-1 py-1.5 border-r border-slate-200">
                  <input
                    type="number"
                    className="w-24 border border-slate-300 rounded px-1.5 py-1 bg-white text-xs text-right"
                    value={newRow.fuel_price_no_vat || ''}
                    onChange={(e) =>
                      setNewRow({ ...newRow, fuel_price_no_vat: Number(e.target.value) })
                    }
                    placeholder="28800"
                  />
                </td>
                <td className="px-1 py-1.5 border-r border-slate-200">
                  <input
                    className="w-28 border border-slate-300 rounded px-1.5 py-1 bg-white text-xs"
                    value={newRow.notes}
                    onChange={(e) => setNewRow({ ...newRow, notes: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddRow();
                      }
                    }}
                    placeholder="Ghi chú"
                  />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleAddRow()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-maritime-600 text-white font-medium hover:bg-maritime-500 disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm
                  </button>
                </td>
              </tr>

              {/* Existing Rows */}
              {loading ? (
                <tr>
                  <td colSpan={18} className="px-4 py-8 text-center text-slate-400">
                    Đang tải danh sách chi tiết container...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={18} className="px-4 py-8 text-center text-slate-500">
                    Chuyến này chưa có dữ liệu chi tiết container. Bạn hãy nhập trực tiếp ở dòng màu vàng phía trên hoặc bấm <strong>Dán hàng loạt từ Excel</strong>.
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => {
                  const isEditing = editingId === r.id;
                  const isDup = duplicateSet.has((r.container_no || '').trim().toUpperCase());

                  if (isEditing) {
                    return (
                      <tr key={r.id} className="bg-sky-50/70">
                        <td className="px-2 py-1.5 border-r border-slate-200 text-center text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="px-1 py-1.5 border-r border-slate-200">
                          <input
                            list="dl-vessels"
                            className="w-20 border rounded px-1.5 py-1 bg-white text-xs"
                            value={editRow.barge_code}
                            onChange={(e) => setEditRow({ ...editRow, barge_code: e.target.value })}
                          />
                        </td>
                        <td className="px-1 py-1.5 border-r border-slate-200">
                          <input
                            className="w-28 border rounded px-1.5 py-1 bg-white text-xs"
                            value={editRow.trip_no}
                            onChange={(e) => setEditRow({ ...editRow, trip_no: e.target.value })}
                          />
                        </td>
                        <td className="px-1 py-1.5 border-r border-slate-200">
                          <input
                            className="w-32 border rounded px-1.5 py-1 bg-white text-xs font-mono font-semibold uppercase"
                            value={editRow.container_no}
                            onChange={(e) =>
                              setEditRow({ ...editRow, container_no: e.target.value.toUpperCase() })
                            }
                          />
                        </td>
                        <td className="px-1 py-1.5 border-r border-slate-200">
                          <input
                            className="w-24 border rounded px-1.5 py-1 bg-white text-xs font-mono uppercase"
                            value={editRow.seal_no}
                            onChange={(e) =>
                              setEditRow({ ...editRow, seal_no: e.target.value.toUpperCase() })
                            }
                          />
                        </td>
                        <td className="px-1 py-1.5 border-r border-slate-200">
                          <input
                            list="dl-ports"
                            className="w-28 border rounded px-1.5 py-1 bg-white text-xs"
                            value={editRow.origin_name}
                            onChange={(e) => setEditRow({ ...editRow, origin_name: e.target.value })}
                          />
                        </td>
                        <td className="px-1 py-1.5 border-r border-slate-200">
                          <input
                            list="dl-ports"
                            className="w-28 border rounded px-1.5 py-1 bg-white text-xs"
                            value={editRow.destination_name}
                            onChange={(e) =>
                              setEditRow({ ...editRow, destination_name: e.target.value })
                            }
                          />
                        </td>
                        <td className="px-1 py-1.5 border-r border-slate-200">
                          <input
                            list="dl-customers"
                            className="w-32 border rounded px-1.5 py-1 bg-white text-xs"
                            value={editRow.shipper_name}
                            onChange={(e) => setEditRow({ ...editRow, shipper_name: e.target.value })}
                          />
                        </td>
                        <td className="px-1 py-1.5 border-r border-slate-200">
                          <input
                            type="date"
                            className="border rounded px-1 py-1 bg-white text-xs"
                            value={editRow.departure_date}
                            onChange={(e) => setEditRow({ ...editRow, departure_date: e.target.value })}
                          />
                        </td>
                        {CONT_TYPES.map((ct) => (
                          <td
                            key={ct}
                            onClick={() => setEditRow({ ...editRow, cont_type: ct })}
                            className={`px-2 py-1.5 border-r border-slate-200 text-center cursor-pointer font-bold ${
                              editRow.cont_type === ct
                                ? 'bg-maritime-600 text-white'
                                : 'bg-white text-slate-300'
                            }`}
                          >
                            {editRow.cont_type === ct ? '1' : '0'}
                          </td>
                        ))}
                        <td className="px-1 py-1.5 border-r border-slate-200">
                          <input
                            type="number"
                            className="w-24 border rounded px-1.5 py-1 bg-white text-xs text-right"
                            value={editRow.unit_price}
                            onChange={(e) => updateDraftPrice(setEditRow, 'unit_price', Number(e.target.value))}
                          />
                        </td>
                        <td className="px-1 py-1.5 border-r border-slate-200">
                          <input
                            type="number"
                            className="w-24 border rounded px-1.5 py-1 bg-white text-xs text-right"
                            value={editRow.baf}
                            onChange={(e) => updateDraftPrice(setEditRow, 'baf', Number(e.target.value))}
                          />
                        </td>
                        <td className="px-1 py-1.5 border-r border-slate-200">
                          <input
                            type="number"
                            className="w-24 border rounded px-1.5 py-1 bg-emerald-50 font-semibold text-xs text-right"
                            value={editRow.total_amount}
                            onChange={(e) =>
                              setEditRow({ ...editRow, total_amount: Number(e.target.value) })
                            }
                          />
                        </td>
                        <td className="px-1 py-1.5 border-r border-slate-200">
                          <input
                            type="number"
                            className="w-24 border rounded px-1.5 py-1 bg-white text-xs text-right"
                            value={editRow.fuel_price_no_vat}
                            onChange={(e) =>
                              setEditRow({ ...editRow, fuel_price_no_vat: Number(e.target.value) })
                            }
                          />
                        </td>
                        <td className="px-1 py-1.5 border-r border-slate-200">
                          <input
                            className="w-28 border rounded px-1.5 py-1 bg-white text-xs"
                            value={editRow.notes}
                            onChange={(e) => setEditRow({ ...editRow, notes: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right space-x-1">
                          <button
                            onClick={() => handleSaveEdit(r.id)}
                            disabled={saving}
                            className="inline-flex items-center gap-0.5 px-2 py-1 rounded bg-emerald-600 text-white"
                          >
                            <Check className="w-3.5 h-3.5" /> Lưu
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="inline-flex items-center px-2 py-1 rounded border bg-white text-slate-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
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
                        {r.container_no}
                      </td>
                      <td className="px-2.5 py-2 border-r border-slate-200 font-mono text-slate-600">
                        {r.seal_no || '—'}
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
                            r.cont_type === ct ? 'font-bold text-slate-900 bg-sky-50' : 'text-slate-300'
                          }`}
                        >
                          {r.cont_type === ct ? '1' : ''}
                        </td>
                      ))}
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
                      <td className="px-2.5 py-2 border-r border-slate-200 text-slate-500 max-w-[180px] truncate">
                        {r.notes || ''}
                      </td>
                      <td className="px-2.5 py-2 text-right space-x-1">
                        <button
                          onClick={() => startEditRow(r)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-100"
                        >
                          <Pencil className="w-3 h-3 text-maritime-600" />
                        </button>
                        <button
                          onClick={() => handleDeleteRow(r.id)}
                          className="inline-flex items-center px-2 py-1 rounded border border-slate-200 text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {rows.length > 0 && (
              <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={9} className="px-3 py-2.5 text-right border-r border-slate-300">
                    TỔNG CỘNG ({rows.length} cont / {stats.totalTeus} TEUs):
                  </td>
                  <td className="px-2 py-2.5 text-center border-r border-slate-300">{stats.c20e}</td>
                  <td className="px-2 py-2.5 text-center border-r border-slate-300">{stats.c20f}</td>
                  <td className="px-2 py-2.5 text-center border-r border-slate-300">{stats.c40e}</td>
                  <td className="px-2 py-2.5 text-center border-r border-slate-300">{stats.c40f}</td>
                  <td className="px-2.5 py-2.5 text-right border-r border-slate-300 tabular-nums">
                    {formatMoney(stats.sumUnit)}
                  </td>
                  <td className="px-2.5 py-2.5 text-right border-r border-slate-300 tabular-nums">
                    {formatMoney(stats.sumBaf)}
                  </td>
                  <td className="px-2.5 py-2.5 text-right border-r border-slate-300 text-emerald-700 tabular-nums">
                    {formatMoney(stats.sumTotal)}
                  </td>
                  <td colSpan={3} className="px-3 py-2.5"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Bulk Paste from Excel Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-lg text-slate-900">
                  Dán dữ liệu chi tiết trực tiếp từ Excel
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Copy các dòng trong file Excel theo đúng thứ tự 16 cột mẫu: SÀ LAN | SỐ CHUYẾN | SỐ CONT | CẢNG ĐI | CẢNG ĐẾN | CHỦ HÀNG | NGÀY ĐI | 20E | 20F | 40E | 40F | ĐƠN GIÁ | BAF | THÀNH TIỀN | GIÁ NL K VAT | GHI CHÚ
                </p>
              </div>
              <button
                onClick={() => setShowPasteModal(false)}
                className="p-1.5 rounded hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <textarea
              rows={8}
              className="w-full border border-slate-300 rounded-lg p-3 font-mono text-xs"
              placeholder={'NV36\tV.36-04926W\tMSMU1758748\tSPITC\tTrà Nóc\tPhước Tạo\t10/21/2026\t1\t\t\t\t638,182\t129,600\t767,782\t28,800\t'}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <label className="inline-flex items-center gap-2 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={replaceOnPaste}
                  onChange={(e) => setReplaceOnPaste(e.target.checked)}
                />
                <span>Thay thế toàn bộ danh sách hiện tại của chuyến này</span>
              </label>

              <span className="font-semibold text-maritime-700">
                Đã nhận diện: {parsedPasteRows.length} dòng container hợp lệ
              </span>
            </div>

            {parsedPasteRows.length > 0 && (
              <div className="border rounded-lg overflow-x-auto max-h-52">
                <table className="w-full text-[11px] text-left whitespace-nowrap">
                  <thead className="bg-slate-100 font-semibold border-b">
                    <tr>
                      <th className="px-2 py-1.5">Sà lan</th>
                      <th className="px-2 py-1.5">Số chuyến</th>
                      <th className="px-2 py-1.5">Số Cont</th>
                      <th className="px-2 py-1.5">Cảng đi → Đến</th>
                      <th className="px-2 py-1.5">Chủ hàng</th>
                      <th className="px-2 py-1.5">Ngày đi</th>
                      <th className="px-2 py-1.5 text-center">Loại</th>
                      <th className="px-2 py-1.5 text-right">Đơn giá</th>
                      <th className="px-2 py-1.5 text-right">BAF</th>
                      <th className="px-2 py-1.5 text-right">Thành tiền</th>
                      <th className="px-2 py-1.5 text-right">NL K VAT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {parsedPasteRows.slice(0, 15).map((r, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1">{r.barge_code}</td>
                        <td className="px-2 py-1">{r.trip_no}</td>
                        <td className="px-2 py-1 font-mono font-semibold">{r.container_no}</td>
                        <td className="px-2 py-1">
                          {r.origin_name} → {r.destination_name}
                        </td>
                        <td className="px-2 py-1">{r.shipper_name}</td>
                        <td className="px-2 py-1">{r.departure_date}</td>
                        <td className="px-2 py-1 text-center font-bold">{r.cont_type}</td>
                        <td className="px-2 py-1 text-right">{formatMoney(r.unit_price)}</td>
                        <td className="px-2 py-1 text-right">{formatMoney(r.baf)}</td>
                        <td className="px-2 py-1 text-right font-semibold text-emerald-700">
                          {formatMoney(r.total_amount)}
                        </td>
                        <td className="px-2 py-1 text-right">{formatMoney(r.fuel_price_no_vat)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 border rounded-lg text-sm"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={saving || parsedPasteRows.length === 0}
                onClick={handleImportPaste}
                className="px-4 py-2 rounded-lg bg-maritime-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Đang lưu...' : `Lưu ${parsedPasteRows.length} dòng vào chuyến`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
