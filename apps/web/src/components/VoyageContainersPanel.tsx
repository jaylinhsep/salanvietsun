'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  ClipboardPaste,
  Download,
  ListChecks,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import {
  API_URL,
  type Booking,
  type ContType,
  type Customer,
  type Port,
  type Vessel,
  type Voyage,
  type VoyageContainer,
  type VoyageTallyPhoto,
} from '@/lib/api';
import { VoyageTallyPhotosTab } from '@/components/VoyageTallyPhotosTab';

interface Props {
  voyage: Voyage;
  ports: Port[];
  customers: Customer[];
  vessels: Vessel[];
  initialTab?: 'CONTAINERS' | 'PHOTOS';
  onBack: () => void;
  onVoyageUpdated: () => void;
}

interface DraftRow {
  barge_code: string;
  booking_no: string;
  trip_no: string;
  container_no: string;
  seal_no: string;
  origin_name: string;
  destination_name: string;
  shipper_name: string;
  departure_date: string;
  cont_type: ContType;
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
  const month = a > 12 ? b : a;
  const day = a > 12 ? a : b;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function makeDefaultDraft(voyage: Voyage, defaultBookingNo = ''): DraftRow {
  return {
    barge_code: voyage.vessel_code || voyage.vessel_name || '',
    booking_no: defaultBookingNo,
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
    notes: '',
  };
}

function normalizeContTypeToken(raw?: string): ContType | null {
  if (!raw) return null;
  const up = raw.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (up === '20E' || up === '20F' || up === '40E' || up === '40F') return up;
  if (up === '20DC' || up === '20GP') return '20F';
  if (up === '40HC' || up === '40HQ' || up === '40DC' || up === '40GP') return '40F';
  return null;
}

/**
 * Supports pasting:
 * 1. Single-column list of Container Numbers (e.g. MSBU1514898 one per line, or comma/space separated)
 * 2. Shorthand 2-4 cols (CONT | SEAL | 20E/40F | NOTE)
 * 3. Format A (with Booking & Seal): SALAN | BOOKING | SO CHUYEN | SO CONT | SEAL | CANG DI | CANG DEN | CHU HANG | NGAY DI | 20E | 20F | 40E | 40F | GHI CHU
 * 4. Format B (classic): SALAN | SO CHUYEN | SO CONT | CANG DI | CANG DEN | CHU HANG | NGAY DI | 20E | 20F | 40E | 40F | ... | GHI CHU
 */
function parseExcelPaste(text: string, fallback: DraftRow): DraftRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim().length > 0);

  const looksLikeCont = (s?: string) => /^[A-Z]{3,4}[UJZ]?\d{5,8}$/i.test((s || '').trim());
  const parsed: DraftRow[] = [];

  for (const line of lines) {
    const cols = line.split('\t').map((c) => c.trim());
    if (cols.length === 0) continue;

    const joined = cols.slice(0, 5).join(' ').toUpperCase();
    if (
      joined.includes('SÀLAN') ||
      joined.includes('SÀ LAN') ||
      joined.includes('SỐCONT') ||
      joined.includes('SỐ CONT') ||
      joined.includes('CONTAINER NO') ||
      joined.includes('CONT NO') ||
      joined === '20E'
    ) {
      continue;
    }

    // Case 1: Single column list (e.g. copied 1 column of container numbers from Excel/Zalo)
    if (cols.length === 1) {
      const tokens = cols[0]
        .split(/[\s,;]+/)
        .map((t) => t.trim().toUpperCase())
        .filter((t) => t.length >= 4 && !/^(STT|CONT|CONTAINER|SOCONT)$/i.test(t));

      for (const token of tokens) {
        parsed.push({
          ...fallback,
          container_no: token,
          seal_no: '',
          notes: '',
        });
      }
      continue;
    }

    // Case 2: Shorthand 2-4 columns where first column is container number
    if (cols.length <= 5 && looksLikeCont(cols[0])) {
      let contType: ContType = fallback.cont_type;
      let sealNo = '';
      let notes = '';
      for (const extra of cols.slice(1)) {
        if (!extra) continue;
        const matchedType = normalizeContTypeToken(extra);
        if (matchedType) {
          contType = matchedType;
        } else if (!sealNo) {
          sealNo = extra.toUpperCase();
        } else {
          notes = notes ? `${notes} ${extra}` : extra;
        }
      }
      parsed.push({
        ...fallback,
        container_no: cols[0].toUpperCase(),
        seal_no: sealNo,
        cont_type: contType,
        notes,
      });
      continue;
    }

    // Case 3 & 4: Full Excel rows (Format A with Booking/Seal or Format B classic)
    const isFormatA = looksLikeCont(cols[3]) || Boolean(parseExcelDate(cols[8]));

    const bargeCode = cols[0] || fallback.barge_code;
    const bookingNo = isFormatA ? cols[1] || fallback.booking_no : fallback.booking_no;
    const tripNo = isFormatA ? cols[2] || fallback.trip_no : cols[1] || fallback.trip_no;
    const containerNo = (isFormatA ? cols[3] : cols[2] || '').toUpperCase().trim();
    if (!containerNo) continue;

    const sealNo = isFormatA ? (cols[4] || '').toUpperCase().trim() : '';
    const originName = (isFormatA ? cols[5] : cols[3]) || fallback.origin_name;
    const destName = (isFormatA ? cols[6] : cols[4]) || fallback.destination_name;
    const shipperName = (isFormatA ? cols[7] : cols[5]) || fallback.shipper_name;
    const depDate = parseExcelDate(isFormatA ? cols[8] : cols[6]) || fallback.departure_date;

    const typeStart = isFormatA ? 9 : 7;
    let contType: ContType = fallback.cont_type;
    if (parseNum(cols[typeStart]) > 0) contType = '20E';
    else if (parseNum(cols[typeStart + 1]) > 0) contType = '20F';
    else if (parseNum(cols[typeStart + 2]) > 0) contType = '40E';
    else if (parseNum(cols[typeStart + 3]) > 0) contType = '40F';
    else {
      const explicit = cols
        .slice(typeStart, typeStart + 4)
        .map((c) => normalizeContTypeToken(c))
        .find(Boolean);
      if (explicit) contType = explicit;
    }

    const notes = isFormatA ? cols[13] || '' : cols[15] || cols[11] || '';

    parsed.push({
      barge_code: bargeCode,
      booking_no: bookingNo,
      trip_no: tripNo,
      container_no: containerNo,
      seal_no: sealNo,
      origin_name: originName,
      destination_name: destName,
      shipper_name: shipperName,
      departure_date: depDate,
      cont_type: contType,
      notes,
    });
  }
  return parsed;
}

export function VoyageContainersPanel({
  voyage,
  ports,
  customers,
  vessels,
  initialTab = 'CONTAINERS',
  onBack,
  onVoyageUpdated,
}: Props) {
  const [panelTab, setPanelTab] = useState<'CONTAINERS' | 'PHOTOS'>(initialTab);
  const [rows, setRows] = useState<VoyageContainer[]>([]);
  const [voyageBookings, setVoyageBookings] = useState<Booking[]>([]);
  const [tallyPhotos, setTallyPhotos] = useState<VoyageTallyPhoto[]>([]);
  const [loadingTallyPhotos, setLoadingTallyPhotos] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newRow, setNewRow] = useState<DraftRow>(() => makeDefaultDraft(voyage));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<DraftRow>(() => makeDefaultDraft(voyage));

  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [replaceOnPaste, setReplaceOnPaste] = useState(false);
  const [pasteDefaults, setPasteDefaults] = useState<DraftRow>(() => makeDefaultDraft(voyage));

  const [showManualModal, setShowManualModal] = useState(false);
  const [manualRow, setManualRow] = useState<DraftRow>(() => makeDefaultDraft(voyage));

  const contNoInputRef = useRef<HTMLInputElement>(null);

  const loadContainers = async () => {
    setLoading(true);
    try {
      const [cRes, bRes] = await Promise.all([
        fetch(`${API_URL}/dispatch/voyages/${voyage.id}/containers`, { cache: 'no-store' }),
        fetch(`${API_URL}/dispatch/bookings`, { cache: 'no-store' }).catch(() => null),
      ]);

      let defaultBk = '';
      if (bRes && bRes.ok) {
        const allBks: Booking[] = await bRes.json();
        const linked = allBks.filter((b) => b.voyage_id === voyage.id);
        setVoyageBookings(linked);
        defaultBk = linked[0]?.booking_no || '';
      }

      if (cRes.ok) {
        const data: VoyageContainer[] = await cRes.json();
        setRows(data);
        if (data.length > 0) {
          const last = data[data.length - 1];
          setNewRow((prev) => ({
            ...prev,
            barge_code: last.barge_code || prev.barge_code,
            booking_no: last.booking_no || defaultBk || prev.booking_no,
            trip_no: last.trip_no || prev.trip_no,
            origin_name: last.origin_name || prev.origin_name,
            destination_name: last.destination_name || prev.destination_name,
            shipper_name: last.shipper_name || prev.shipper_name,
            departure_date: last.departure_date
              ? last.departure_date.slice(0, 10)
              : prev.departure_date,
            cont_type: last.cont_type || prev.cont_type,
          }));
        } else if (defaultBk) {
          setNewRow((prev) => ({ ...prev, booking_no: prev.booking_no || defaultBk }));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const loadTallyPhotos = async () => {
    setLoadingTallyPhotos(true);
    try {
      const res = await fetch(`${API_URL}/dispatch/voyages/${voyage.id}/tally-photos`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const list = await res.json();
        setTallyPhotos(Array.isArray(list) ? list : []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingTallyPhotos(false);
    }
  };

  useEffect(() => {
    setPanelTab(initialTab);
  }, [initialTab, voyage.id]);

  useEffect(() => {
    setNewRow(makeDefaultDraft(voyage));
    loadContainers();
    loadTallyPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voyage.id]);

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
      c40f = 0;
    for (const r of rows) {
      if (r.cont_type === '20E') c20e++;
      else if (r.cont_type === '20F') c20f++;
      else if (r.cont_type === '40E') c40e++;
      else if (r.cont_type === '40F') c40f++;
    }
    const totalTeus = c20e + c20f + (c40e + c40f) * 2;
    return { c20e, c20f, c40e, c40f, totalTeus };
  }, [rows]);

  const handleAddRow = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
      booking_no: r.booking_no || '',
      trip_no: r.trip_no || '',
      container_no: r.container_no || '',
      seal_no: r.seal_no || '',
      origin_name: r.origin_name || '',
      destination_name: r.destination_name || '',
      shipper_name: r.shipper_name || '',
      departure_date: r.departure_date ? r.departure_date.slice(0, 10) : '',
      cont_type: r.cont_type,
      notes: r.notes || '',
    });
  };

  const handleSaveEdit = async (containerId: string) => {
    setSaving(true);
    try {
      // Send only operational fields so Accounting unit_price/BAF remain untouched
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
    () => parseExcelPaste(pasteText, pasteDefaults),
    [pasteText, pasteDefaults],
  );

  const openPasteModal = () => {
    setPasteDefaults({
      ...newRow,
      booking_no: newRow.booking_no || voyageBookings[0]?.booking_no || '',
    });
    setShowPasteModal(true);
  };

  const applyBookingPreset = (
    bk: Booking,
    setter: React.Dispatch<React.SetStateAction<DraftRow>>,
  ) => {
    const inferredType: ContType =
      bk.cont_20e > 0 ? '20E' : bk.cont_20f > 0 ? '20F' : bk.cont_40e > 0 ? '40E' : '40F';
    setter((prev) => ({
      ...prev,
      booking_no: bk.booking_no,
      origin_name: bk.resolved_origin_name || bk.origin_name || prev.origin_name,
      destination_name: bk.resolved_dest_name || bk.dest_name || prev.destination_name,
      shipper_name: bk.resolved_customer_name || bk.customer_name || prev.shipper_name,
      cont_type: inferredType,
    }));
  };

  const renderBookingChips = (
    activeBookingNo: string,
    setter: React.Dispatch<React.SetStateAction<DraftRow>>,
  ) => {
    if (voyageBookings.length === 0) return null;
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-slate-600 font-semibold">Booking đã ghép vào chuyến:</span>
        {voyageBookings.map((bk) => {
          const isActive = activeBookingNo.trim().toUpperCase() === bk.booking_no.toUpperCase();
          return (
            <button
              key={bk.id}
              type="button"
              onClick={() => applyBookingPreset(bk, setter)}
              className={`px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-indigo-800 border-indigo-200 hover:bg-indigo-50'
              }`}
              title={`${bk.resolved_customer_name || bk.customer_name || ''} • ${bk.resolved_origin_name || bk.origin_name || ''} → ${bk.resolved_dest_name || bk.dest_name || ''}`}
            >
              {bk.booking_no} ({bk.total_teus} TEU • {bk.resolved_customer_name || bk.customer_name || 'KH'})
            </button>
          );
        })}
      </div>
    );
  };

  const openManualModal = () => {
    setManualRow({
      ...newRow,
      booking_no: newRow.booking_no || voyageBookings[0]?.booking_no || '',
      container_no: '',
      seal_no: '',
      notes: '',
    });
    setShowManualModal(true);
  };

  const handleSaveManualRow = async (keepOpen: boolean) => {
    if (!manualRow.container_no.trim()) {
      alert('Vui lòng nhập SỐ CONT.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/dispatch/voyages/${voyage.id}/containers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualRow),
      });
      if (!res.ok) {
        alert(`Không thể thêm container (${res.status}): ${await res.text()}`);
        return;
      }
      await loadContainers();
      onVoyageUpdated();
      if (keepOpen) {
        setManualRow((prev) => ({ ...prev, container_no: '', seal_no: '', notes: '' }));
      } else {
        setShowManualModal(false);
      }
    } finally {
      setSaving(false);
    }
  };

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
      'SO BOOKING',
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
      'GHI CHU',
    ];
    const lines = [
      header.join(','),
      ...rows.map((r) =>
        [
          r.barge_code || '',
          r.booking_no || '',
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
          (r.notes || '').replace(/"/g, '""'),
        ]
          .map((v) => `"${v}"`)
          .join(','),
      ),
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `van-hanh-cont-${voyage.voyage_no}.csv`;
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
                Bảng Vận hành Container Chuyến: {voyage.voyage_no}
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
              Tuyến: {voyage.origin_name || '—'} → {voyage.dest_name || '—'} • Kế hoạch:{' '}
              {voyage.total_teus || 0} TEUs • (Giá cước được quản lý riêng tại mục Quyết toán → Sản lượng)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={openManualModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-maritime-600 text-white text-xs font-medium hover:bg-maritime-500"
          >
            <Plus className="w-4 h-4" /> Thêm 1 dòng thủ công
          </button>
          <button
            onClick={openPasteModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500"
          >
            <ClipboardPaste className="w-4 h-4" /> Dán list Cont / từ Excel
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

      {/* Operations KPI Summary Strip (No Pricing shown to Dispatchers) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="text-[11px] uppercase text-slate-500 font-medium">Tổng số Cont vận hành</div>
          <div className="text-xl font-bold text-slate-900 mt-0.5">{rows.length} cont</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="text-[11px] uppercase text-slate-500 font-medium">Cơ cấu loại Cont</div>
          <div className="text-sm font-semibold text-slate-800 mt-1">
            20E: {stats.c20e} • 20F: {stats.c20f} • 40E: {stats.c40e} • 40F: {stats.c40f}
          </div>
        </div>
        <div className="bg-rose-50 rounded-xl border border-rose-200 p-3">
          <div className="text-[11px] uppercase text-rose-700 font-medium">Tổng TEUs chi tiết</div>
          <div className="text-xl font-bold text-rose-700 mt-0.5">{stats.totalTeus} TEUs</div>
        </div>
      </div>

      {/* Sub-tabs inside Voyage Dispatch: Danh sách Cont vs Hình ảnh Tally & AI */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setPanelTab('CONTAINERS')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold border transition-colors ${
            panelTab === 'CONTAINERS'
              ? 'bg-navy-900 text-white border-navy-900 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <ListChecks className="w-4 h-4" /> Danh sách Container ({rows.length})
        </button>
        <button
          type="button"
          onClick={() => setPanelTab('PHOTOS')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold border transition-colors ${
            panelTab === 'PHOTOS'
              ? 'bg-navy-900 text-white border-navy-900 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Camera className="w-4 h-4" /> Hình ảnh Tally &amp; AI ({tallyPhotos.length})
        </button>
      </div>

      {panelTab === 'PHOTOS' ? (
        <VoyageTallyPhotosTab
          voyage={voyage}
          voyageBookings={voyageBookings}
          existingContainerNos={rows.map((r) => r.container_no)}
          photos={tallyPhotos}
          loading={loadingTallyPhotos}
          onRefreshPhotos={loadTallyPhotos}
          onContainersAssigned={async () => {
            await loadContainers();
            onVoyageUpdated();
          }}
        />
      ) : (
        <>

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
      <datalist id="dl-voyage-bookings">
        {voyageBookings.map((b) => (
          <option key={b.id} value={b.booking_no} />
        ))}
      </datalist>

      {/* Operations Container Table (No Price Columns, includes SỐ BOOKING after SÀ LAN) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {voyageBookings.length > 0 && (
          <div className="px-4 py-2.5 bg-indigo-50/70 border-b border-indigo-100">
            {renderBookingChips(newRow.booking_no, setNewRow)}
          </div>
        )}
        {duplicateSet.size > 0 && (
          <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 text-xs text-rose-700 font-medium">
            Cảnh báo: phát hiện {duplicateSet.size} số container bị trùng lặp (được tô đỏ).
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
                <th rowSpan={2} className="px-2.5 py-2 border-r border-slate-300 bg-indigo-50/70">
                  SỐ BOOKING
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
              {/* Quick Add Row */}
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
                    list="dl-voyage-bookings"
                    className="w-28 border border-indigo-300 rounded px-1.5 py-1 bg-white text-xs font-semibold uppercase"
                    value={newRow.booking_no}
                    onChange={(e) => setNewRow({ ...newRow, booking_no: e.target.value.toUpperCase() })}
                    placeholder="BK-..."
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
                    className="w-32 border border-slate-300 rounded px-1.5 py-1 bg-white text-xs"
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
                  <td colSpan={16} className="px-4 py-8 text-center text-slate-400">
                    Đang tải danh sách chi tiết container...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-4 py-8 text-center text-slate-500">
                    Chuyến này chưa có danh sách container vận hành. Bạn hãy nhập trực tiếp ở dòng màu vàng phía trên hoặc bấm <strong>Dán hàng loạt từ Excel</strong>.
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
                            list="dl-voyage-bookings"
                            className="w-28 border rounded px-1.5 py-1 bg-white text-xs font-semibold uppercase"
                            value={editRow.booking_no}
                            onChange={(e) =>
                              setEditRow({ ...editRow, booking_no: e.target.value.toUpperCase() })
                            }
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
                            className="w-32 border rounded px-1.5 py-1 bg-white text-xs"
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
                      <td className="px-2.5 py-2 border-r border-slate-200 font-semibold text-indigo-700">
                        {r.booking_no || '—'}
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
                      <td className="px-2.5 py-2 border-r border-slate-200 text-slate-500 max-w-[200px] truncate">
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
                  <td colSpan={10} className="px-3 py-2.5 text-right border-r border-slate-300">
                    TỔNG CỘNG ({rows.length} cont / {stats.totalTeus} TEUs):
                  </td>
                  <td className="px-2 py-2.5 text-center border-r border-slate-300">{stats.c20e}</td>
                  <td className="px-2 py-2.5 text-center border-r border-slate-300">{stats.c20f}</td>
                  <td className="px-2 py-2.5 text-center border-r border-slate-300">{stats.c40e}</td>
                  <td className="px-2 py-2.5 text-center border-r border-slate-300">{stats.c40f}</td>
                  <td colSpan={2} className="px-3 py-2.5"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
        </>
      )}

      {/* Bulk Paste from Excel Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-lg text-slate-900">
                  Dán danh sách Số Cont hoặc bảng Excel
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hỗ trợ: <b>(1) Dán duy nhất 1 cột danh sách Số Cont</b> (mỗi dòng 1 cont), <b>(2) Cont + Seal / Loại Cont</b>, hoặc <b>(3) Copy đầy đủ bảng Excel nhiều cột</b>.
                </p>
              </div>
              <button
                onClick={() => setShowPasteModal(false)}
                className="p-1.5 rounded hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Defaults applied automatically when pasting a 1-column list of container numbers */}
            {voyageBookings.length > 0 && (
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl px-3 py-2.5">
                {renderBookingChips(pasteDefaults.booking_no, setPasteDefaults)}
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Số Booking</label>
                {voyageBookings.length > 0 ? (
                  <>
                    <select
                      className="w-full border rounded px-2 py-1.5 mt-0.5 bg-white font-semibold"
                      value={
                        voyageBookings.some((b) => b.booking_no === pasteDefaults.booking_no)
                          ? pasteDefaults.booking_no
                          : '__CUSTOM__'
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__CUSTOM__') {
                          setPasteDefaults({ ...pasteDefaults, booking_no: '' });
                          return;
                        }
                        const found = voyageBookings.find((b) => b.booking_no === val);
                        if (found) applyBookingPreset(found, setPasteDefaults);
                      }}
                    >
                      {voyageBookings.map((b) => (
                        <option key={b.id} value={b.booking_no}>
                          {b.booking_no} ({b.total_teus}T)
                        </option>
                      ))}
                      <option value="__CUSTOM__">-- Nhập tay khác --</option>
                    </select>
                    {!voyageBookings.some((b) => b.booking_no === pasteDefaults.booking_no) && (
                      <input
                        className="w-full border rounded px-2 py-1 mt-1 bg-white uppercase font-semibold"
                        value={pasteDefaults.booking_no}
                        onChange={(e) =>
                          setPasteDefaults({
                            ...pasteDefaults,
                            booking_no: e.target.value.toUpperCase(),
                          })
                        }
                        placeholder="Nhập số Booking..."
                      />
                    )}
                  </>
                ) : (
                  <input
                    className="w-full border rounded px-2 py-1.5 mt-0.5 bg-white uppercase font-semibold"
                    value={pasteDefaults.booking_no}
                    onChange={(e) =>
                      setPasteDefaults({ ...pasteDefaults, booking_no: e.target.value.toUpperCase() })
                    }
                    placeholder="BK-..."
                  />
                )}
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Loại Cont mặc định</label>
                <select
                  className="w-full border rounded px-2 py-1.5 mt-0.5 bg-white font-bold"
                  value={pasteDefaults.cont_type}
                  onChange={(e) =>
                    setPasteDefaults({ ...pasteDefaults, cont_type: e.target.value as ContType })
                  }
                >
                  {CONT_TYPES.map((ct) => (
                    <option key={ct} value={ct}>
                      {ct}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Cảng đi (POL)</label>
                <input
                  list="dl-ports"
                  className="w-full border rounded px-2 py-1.5 mt-0.5 bg-white"
                  value={pasteDefaults.origin_name}
                  onChange={(e) =>
                    setPasteDefaults({ ...pasteDefaults, origin_name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Cảng đến (POD)</label>
                <input
                  list="dl-ports"
                  className="w-full border rounded px-2 py-1.5 mt-0.5 bg-white"
                  value={pasteDefaults.destination_name}
                  onChange={(e) =>
                    setPasteDefaults({ ...pasteDefaults, destination_name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Chủ hàng</label>
                <input
                  list="dl-customers"
                  className="w-full border rounded px-2 py-1.5 mt-0.5 bg-white"
                  value={pasteDefaults.shipper_name}
                  onChange={(e) =>
                    setPasteDefaults({ ...pasteDefaults, shipper_name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Ngày đi</label>
                <input
                  type="date"
                  className="w-full border rounded px-2 py-1 mt-0.5 bg-white"
                  value={pasteDefaults.departure_date}
                  onChange={(e) =>
                    setPasteDefaults({ ...pasteDefaults, departure_date: e.target.value })
                  }
                />
              </div>
            </div>

            <textarea
              rows={8}
              className="w-full border border-slate-300 rounded-lg p-3 font-mono text-xs"
              placeholder={'Dán danh sách Số Cont (1 dòng 1 cont):\nMSBU1514898\nMSDU1049725\n\nHoặc copy nhiều cột trực tiếp từ Excel...'}
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
                      <th className="px-2 py-1.5">Booking</th>
                      <th className="px-2 py-1.5">Số chuyến</th>
                      <th className="px-2 py-1.5">Số Cont</th>
                      <th className="px-2 py-1.5">Số Seal</th>
                      <th className="px-2 py-1.5">Cảng đi → Đến</th>
                      <th className="px-2 py-1.5">Chủ hàng</th>
                      <th className="px-2 py-1.5">Ngày đi</th>
                      <th className="px-2 py-1.5 text-center">Loại</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {parsedPasteRows.slice(0, 15).map((r, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1">{r.barge_code}</td>
                        <td className="px-2 py-1 font-semibold text-indigo-700">{r.booking_no}</td>
                        <td className="px-2 py-1">{r.trip_no}</td>
                        <td className="px-2 py-1 font-mono font-semibold">{r.container_no}</td>
                        <td className="px-2 py-1 font-mono">{r.seal_no}</td>
                        <td className="px-2 py-1">
                          {r.origin_name} → {r.destination_name}
                        </td>
                        <td className="px-2 py-1">{r.shipper_name}</td>
                        <td className="px-2 py-1">{r.departure_date}</td>
                        <td className="px-2 py-1 text-center font-bold">{r.cont_type}</td>
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

      {/* Dedicated Add 1 Container Manually Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-lg text-slate-900">
                Thêm mới 1 dòng Container thủ công
              </h3>
              <button
                onClick={() => setShowManualModal(false)}
                className="p-1.5 rounded hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {voyageBookings.length > 0 && (
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl px-3 py-2.5">
                {renderBookingChips(manualRow.booking_no, setManualRow)}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <label className="text-xs font-medium text-slate-600">Sà lan</label>
                <input
                  list="dl-vessels"
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  value={manualRow.barge_code}
                  onChange={(e) => setManualRow({ ...manualRow, barge_code: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Số Booking</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 mt-1 uppercase font-semibold"
                  value={manualRow.booking_no}
                  onChange={(e) =>
                    setManualRow({ ...manualRow, booking_no: e.target.value.toUpperCase() })
                  }
                  placeholder="BK-..."
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Số chuyến</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  value={manualRow.trip_no}
                  onChange={(e) => setManualRow({ ...manualRow, trip_no: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <label className="text-xs font-medium text-slate-600">Số Cont *</label>
                <input
                  autoFocus
                  className="w-full border-2 border-maritime-400 rounded-lg px-3 py-2 mt-1 font-mono font-bold uppercase"
                  value={manualRow.container_no}
                  onChange={(e) =>
                    setManualRow({ ...manualRow, container_no: e.target.value.toUpperCase() })
                  }
                  placeholder="MSBU1514898"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Số Seal</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 mt-1 font-mono uppercase"
                  value={manualRow.seal_no}
                  onChange={(e) =>
                    setManualRow({ ...manualRow, seal_no: e.target.value.toUpperCase() })
                  }
                  placeholder="SL12345"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Ngày đi</label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  value={manualRow.departure_date}
                  onChange={(e) => setManualRow({ ...manualRow, departure_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <label className="text-xs font-medium text-slate-600">Cảng đi (POL)</label>
                <input
                  list="dl-ports"
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  value={manualRow.origin_name}
                  onChange={(e) => setManualRow({ ...manualRow, origin_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Cảng đến (POD)</label>
                <input
                  list="dl-ports"
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  value={manualRow.destination_name}
                  onChange={(e) => setManualRow({ ...manualRow, destination_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Chủ hàng</label>
                <input
                  list="dl-customers"
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  value={manualRow.shipper_name}
                  onChange={(e) => setManualRow({ ...manualRow, shipper_name: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">Loại Container</label>
              <div className="grid grid-cols-4 gap-2">
                {CONT_TYPES.map((ct) => (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => setManualRow({ ...manualRow, cont_type: ct })}
                    className={`py-2 rounded-lg font-bold text-sm border ${
                      manualRow.cont_type === ct
                        ? 'bg-maritime-600 text-white border-maritime-600'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {ct}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-sm">
              <label className="text-xs font-medium text-slate-600">Ghi chú</label>
              <input
                className="w-full border rounded-lg px-3 py-2 mt-1"
                value={manualRow.notes}
                onChange={(e) => setManualRow({ ...manualRow, notes: e.target.value })}
                placeholder="Ghi chú cont (nếu có)"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="px-4 py-2 border rounded-lg text-sm"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveManualRow(true)}
                className="px-4 py-2 rounded-lg border border-maritime-600 text-maritime-700 text-sm font-semibold hover:bg-maritime-50 disabled:opacity-50"
              >
                Lưu & Thêm tiếp
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveManualRow(false)}
                className="px-4 py-2 rounded-lg bg-maritime-600 text-white text-sm font-semibold hover:bg-maritime-500 disabled:opacity-50"
              >
                Lưu & Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
