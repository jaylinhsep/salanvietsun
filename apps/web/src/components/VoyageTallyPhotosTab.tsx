'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  ImagePlus,
  KeyRound,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  API_URL,
  resolveApiMediaUrl,
  type Booking,
  type ContType,
  type TallyExtractedContainer,
  type Voyage,
  type VoyageTallyPhoto,
} from '@/lib/api';
import { compressTallyImage } from '@/lib/workflow-store';

interface Props {
  voyage: Voyage;
  voyageBookings: Booking[];
  existingContainerNos: string[];
  photos: VoyageTallyPhoto[];
  loading: boolean;
  onRefreshPhotos: () => Promise<void>;
  onContainersAssigned: () => Promise<void>;
}

const CONT_TYPES: ContType[] = ['20E', '20F', '40E', '40F'];
const AI_TEMP_KEY_STORAGE = 'vietsun_temp_ai_vision_key';

function formatBytes(bytes?: number): string {
  const b = Number(bytes || 0);
  if (!b) return '—';
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

export function VoyageTallyPhotosTab({
  voyage,
  voyageBookings,
  existingContainerNos,
  photos,
  loading,
  onRefreshPhotos,
  onContainersAssigned,
}: Props) {
  const [storageStatus, setStorageStatus] = useState<{
    r2Configured: boolean;
    r2Bucket?: string | null;
    aiConfigured: boolean;
    aiProvider?: string;
  } | null>(null);

  const [tempAiKey, setTempAiKey] = useState<string>('');
  const [showKeyBox, setShowKeyBox] = useState<boolean>(false);

  const [uploading, setUploading] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [savingListId, setSavingListId] = useState<string | null>(null);

  // Per-photo editable extracted list & checked rows & selected booking
  const [draftLists, setDraftLists] = useState<Record<string, TallyExtractedContainer[]>>({});
  const [checkedMap, setCheckedMap] = useState<Record<string, Record<number, boolean>>>({});
  const [targetBookingByPhoto, setTargetBookingByPhoto] = useState<Record<string, string>>({});
  const [feedbackByPhoto, setFeedbackByPhoto] = useState<Record<string, string>>({});
  const [zoomPhoto, setZoomPhoto] = useState<VoyageTallyPhoto | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = window.sessionStorage.getItem(AI_TEMP_KEY_STORAGE) || '';
      if (saved) setTempAiKey(saved);
    }
    fetch(`${API_URL}/dispatch/storage-ai-status`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setStorageStatus(d);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const nextDrafts: Record<string, TallyExtractedContainer[]> = {};
    const nextChecks: Record<string, Record<number, boolean>> = {};
    const nextBookings: Record<string, string> = {};
    const defaultBookingId = voyageBookings[0]?.id || '__NONE__';

    for (const p of photos) {
      const list = Array.isArray(p.ai_extracted_containers) ? p.ai_extracted_containers : [];
      nextDrafts[p.id] = list.map((item) => ({
        container_no: String(item.container_no || '').toUpperCase(),
        seal_no: String(item.seal_no || '').toUpperCase(),
        cont_type: (CONT_TYPES.includes(item.cont_type) ? item.cont_type : '20F') as ContType,
        notes: String(item.notes || ''),
        confidence: item.confidence,
      }));
      const checks: Record<number, boolean> = {};
      list.forEach((_, idx) => {
        checks[idx] = true;
      });
      nextChecks[p.id] = checks;
      nextBookings[p.id] = targetBookingByPhoto[p.id] || defaultBookingId;
    }
    setDraftLists(nextDrafts);
    setCheckedMap(nextChecks);
    setTargetBookingByPhoto(nextBookings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, voyageBookings]);

  const existingSet = new Set(
    existingContainerNos.map((c) => String(c || '').trim().toUpperCase()).filter(Boolean),
  );

  const handleSaveTempKey = (val: string) => {
    setTempAiKey(val);
    if (typeof window !== 'undefined') {
      if (val.trim()) window.sessionStorage.setItem(AI_TEMP_KEY_STORAGE, val.trim());
      else window.sessionStorage.removeItem(AI_TEMP_KEY_STORAGE);
    }
  };

  const handleUploadFromDispatcher = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const compressed = await compressTallyImage(file);
        const res = await fetch(`${API_URL}/dispatch/voyages/${voyage.id}/tally-photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vessel_id: voyage.vessel_id,
            image_data_url: compressed.dataUrl,
            original_size_bytes: compressed.originalSize,
            uploaded_by: 'Điều độ viên',
          }),
        });
        if (!res.ok) {
          alert(`Không thể tải ảnh (${res.status}): ${await res.text()}`);
        }
      }
      await onRefreshPhotos();
      await onContainersAssigned();
    } finally {
      setUploading(false);
    }
  };

  const handleExtractAi = async (photo: VoyageTallyPhoto) => {
    setExtractingId(photo.id);
    setFeedbackByPhoto((prev) => ({ ...prev, [photo.id]: '' }));
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (tempAiKey.trim()) headers['X-Ai-Api-Key'] = tempAiKey.trim();
      const res = await fetch(`${API_URL}/dispatch/tally-photos/${photo.id}/extract-ai`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ api_key: tempAiKey.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedbackByPhoto((prev) => ({
          ...prev,
          [photo.id]: `Lỗi AI: ${data?.message || res.status}`,
        }));
        return;
      }
      if (data?.ai_configured === false) {
        setShowKeyBox(true);
        setFeedbackByPhoto((prev) => ({
          ...prev,
          [photo.id]:
            data?.message ||
            'Chưa có API Key AI (GEMINI_API_KEY / OPENAI_API_KEY). Bạn có thể dán key vào ô "Cấu hình AI Key" phía trên hoặc tự thêm dòng cont.',
        }));
        return;
      }
      const count = Array.isArray(data?.containers) ? data.containers.length : 0;
      setFeedbackByPhoto((prev) => ({
        ...prev,
        [photo.id]:
          count > 0
            ? `AI (${data.provider}) đã trích xuất ${count} số container từ ảnh!`
            : `AI (${data.provider}) không tìm thấy số container rõ ràng trong ảnh.`,
      }));
      await onRefreshPhotos();
    } finally {
      setExtractingId(null);
    }
  };

  const updateDraftItem = (
    photoId: string,
    index: number,
    patch: Partial<TallyExtractedContainer>,
  ) => {
    setDraftLists((prev) => {
      const list = [...(prev[photoId] || [])];
      list[index] = { ...list[index], ...patch };
      return { ...prev, [photoId]: list };
    });
  };

  const addManualCandidate = (photoId: string) => {
    setDraftLists((prev) => {
      const list = [...(prev[photoId] || [])];
      const nextIdx = list.length;
      setCheckedMap((cm) => ({
        ...cm,
        [photoId]: { ...(cm[photoId] || {}), [nextIdx]: true },
      }));
      return {
        ...prev,
        [photoId]: [
          ...list,
          { container_no: '', seal_no: '', cont_type: '20F', notes: '', confidence: 'MANUAL' },
        ],
      };
    });
  };

  const removeCandidate = (photoId: string, index: number) => {
    setDraftLists((prev) => ({
      ...prev,
      [photoId]: (prev[photoId] || []).filter((_, i) => i !== index),
    }));
  };

  const handleSaveExtractedEdits = async (photoId: string) => {
    setSavingListId(photoId);
    try {
      const containers = (draftLists[photoId] || [])
        .map((c) => ({
          ...c,
          container_no: c.container_no.trim().toUpperCase(),
          seal_no: (c.seal_no || '').trim().toUpperCase(),
        }))
        .filter((c) => c.container_no.length > 0);
      const res = await fetch(`${API_URL}/dispatch/tally-photos/${photoId}/extracted`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ containers }),
      });
      if (res.ok) {
        setFeedbackByPhoto((prev) => ({ ...prev, [photoId]: 'Đã lưu chỉnh sửa danh sách cont!' }));
        await onRefreshPhotos();
      }
    } finally {
      setSavingListId(null);
    }
  };

  const handleAssignSelectedToBooking = async (photoId: string) => {
    const list = draftLists[photoId] || [];
    const checks = checkedMap[photoId] || {};
    const selected = list
      .filter((c, i) => checks[i] && c.container_no.trim().length > 0)
      .map((c) => ({
        ...c,
        container_no: c.container_no.trim().toUpperCase(),
        seal_no: (c.seal_no || '').trim().toUpperCase(),
      }));

    if (selected.length === 0) {
      alert('Vui lòng tick chọn ít nhất 1 container có SỐ CONT hợp lệ để gán.');
      return;
    }

    const targetBkId = targetBookingByPhoto[photoId];
    const targetBk = voyageBookings.find((b) => b.id === targetBkId) || null;
    const departureDate = voyage.received_date
      ? voyage.received_date.slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const rowsToInsert = selected.map((c) => ({
      barge_code: voyage.vessel_code || voyage.vessel_name || '',
      booking_no: targetBk ? targetBk.booking_no : '',
      trip_no: voyage.voyage_no || '',
      container_no: c.container_no,
      seal_no: c.seal_no || '',
      origin_name:
        targetBk?.resolved_origin_name || targetBk?.origin_name || voyage.origin_name || '',
      destination_name:
        targetBk?.resolved_dest_name || targetBk?.dest_name || voyage.dest_name || '',
      shipper_name:
        targetBk?.resolved_customer_name ||
        targetBk?.customer_name ||
        voyage.customer_name ||
        voyage.customer_code ||
        '',
      departure_date: departureDate,
      cont_type: c.cont_type || '20F',
      notes: c.notes || (targetBk ? `Từ ảnh Tally (${targetBk.booking_no})` : 'Từ ảnh Tally'),
    }));

    setAssigningId(photoId);
    try {
      // Also persist edited extracted list first so edits aren't lost
      await fetch(`${API_URL}/dispatch/tally-photos/${photoId}/extracted`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          containers: list.filter((c) => c.container_no.trim().length > 0),
        }),
      }).catch(() => {});

      const res = await fetch(`${API_URL}/dispatch/voyages/${voyage.id}/containers/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: rowsToInsert, replace: false }),
      });
      if (!res.ok) {
        alert(`Không thể gán container (${res.status}): ${await res.text()}`);
        return;
      }
      setFeedbackByPhoto((prev) => ({
        ...prev,
        [photoId]: `Đã gán ${rowsToInsert.length} container vào ${
          targetBk ? `Booking ${targetBk.booking_no}` : `chuyến ${voyage.voyage_no}`
        }!`,
      }));
      await onContainersAssigned();
      await onRefreshPhotos();
    } finally {
      setAssigningId(null);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Xóa ảnh Tally này khỏi chuyến?')) return;
    await fetch(`${API_URL}/dispatch/tally-photos/${photoId}`, { method: 'DELETE' });
    await onRefreshPhotos();
    await onContainersAssigned();
  };

  return (
    <div className="space-y-4">
      {/* Top Status & Upload Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-sm text-navy-900">
              Hình ảnh Tally từ Thuyền trưởng &amp; Trích xuất AI
            </h3>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                storageStatus?.r2Configured
                  ? 'bg-orange-50 text-orange-800 border-orange-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <Cloud className="w-3 h-3" />
              {storageStatus?.r2Configured
                ? `Cloudflare R2 (${storageStatus.r2Bucket})`
                : 'Lưu máy chủ nội bộ (sẵn sàng R2)'}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                storageStatus?.aiConfigured || tempAiKey.trim()
                  ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              {storageStatus?.aiConfigured
                ? `AI Vision: ${storageStatus.aiProvider}`
                : tempAiKey.trim()
                  ? 'AI Vision: Key tạm thời đang bật'
                  : 'Chưa cấu hình AI Key'}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Ảnh Tally do Thuyền trưởng chụp ở Bước 1 sẽ tự động nén và đẩy về đây để AI đọc list số cont và gán nhanh vào Booking của chuyến.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowKeyBox((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
            {showKeyBox ? 'Ẩn cấu hình AI' : 'Cấu hình AI Key'}
          </button>

          <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-maritime-600 text-white text-xs font-semibold hover:bg-maritime-500 cursor-pointer shadow-sm">
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ImagePlus className="w-4 h-4" />
            )}
            <span>{uploading ? 'Đang nén & tải lên...' : '+ Tải ảnh Tally từ máy'}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              className="hidden"
              onChange={(e) => {
                handleUploadFromDispatcher(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>

      {/* Optional AI Key Config Box */}
      {showKeyBox && (
        <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 space-y-2 text-xs">
          <div className="font-bold text-indigo-900">
            Cấu hình AI Vision (Gemini hoặc OpenAI) &amp; Cloudflare R2
          </div>
          <p className="text-indigo-800">
            Trên VPS, thêm vào <code>apps/api/.env</code>:{' '}
            <code>GEMINI_API_KEY=...</code> (hoặc <code>OPENAI_API_KEY=sk-...</code>) và các biến R2 (<code>R2_ACCOUNT_ID</code>, <code>R2_ACCESS_KEY_ID</code>, <code>R2_SECRET_ACCESS_KEY</code>, <code>R2_BUCKET_NAME</code>, <code>R2_PUBLIC_URL</code>).
            Nếu muốn thử AI ngay trên trình duyệt, bạn có thể nhập tạm API Key Gemini/OpenAI bên dưới:
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={tempAiKey}
              onChange={(e) => handleSaveTempKey(e.target.value)}
              placeholder="Nhập GEMINI_API_KEY (AIza...) hoặc OPENAI_API_KEY (sk-...) để test ngay..."
              className="flex-1 border border-indigo-300 rounded-lg px-3 py-1.5 bg-white text-xs font-mono"
            />
            {tempAiKey && (
              <button
                type="button"
                onClick={() => handleSaveTempKey('')}
                className="px-3 py-1.5 rounded-lg border border-indigo-300 bg-white text-indigo-800 font-medium"
              >
                Xóa key tạm
              </button>
            )}
          </div>
        </div>
      )}

      {/* Photo Cards */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-400">
          Đang tải danh sách hình ảnh Tally...
        </div>
      ) : photos.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center space-y-2">
          <ImagePlus className="w-8 h-8 text-slate-300 mx-auto" />
          <div className="text-sm font-semibold text-slate-600">
            Chưa có hình ảnh Tally nào được gửi cho chuyến {voyage.voyage_no}
          </div>
          <p className="text-xs text-slate-400">
            Thuyền trưởng chụp/gửi ảnh Tally ở Bước 1 trên App Tàu (/mobile), hoặc Điều độ viên tải ảnh trực tiếp bằng nút phía trên.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {photos.map((photo, idx) => {
            const list = draftLists[photo.id] || [];
            const checks = checkedMap[photo.id] || {};
            const selectedCount = list.filter(
              (c, i) => checks[i] && c.container_no.trim().length > 0,
            ).length;
            const imgSrc = resolveApiMediaUrl(photo.image_url);
            const feedback = feedbackByPhoto[photo.id];

            return (
              <div
                key={photo.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12"
              >
                {/* Left: Photo Preview */}
                <div className="lg:col-span-5 bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-200 p-4 flex flex-col justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">
                        Ảnh Tally #{photos.length - idx}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            photo.storage_provider === 'r2'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {photo.storage_provider === 'r2' ? 'Cloudflare R2' : 'Local'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(photo.id)}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                          title="Xóa ảnh"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div
                      onClick={() => setZoomPhoto(photo)}
                      className="relative group rounded-lg overflow-hidden border border-slate-300 bg-white cursor-zoom-in"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imgSrc}
                        alt={`Tally ${photo.id}`}
                        className="w-full max-h-80 object-contain bg-slate-900/5"
                      />
                      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-black/65 text-white text-[11px] font-medium opacity-90 group-hover:opacity-100">
                        <ZoomIn className="w-3.5 h-3.5" /> Phóng to
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 space-y-0.5">
                    <div>
                      Người gửi: <strong className="text-slate-700">{photo.uploaded_by || 'Thuyền trưởng'}</strong> •{' '}
                      {new Date(photo.created_at).toLocaleString('vi-VN')}
                    </div>
                    <div>
                      Dung lượng nén: <strong>{formatBytes(photo.original_size_bytes)}</strong> →{' '}
                      <strong className="text-emerald-700">{formatBytes(photo.compressed_size_bytes)}</strong>
                    </div>
                    {photo.notes && (
                      <div className="text-slate-700 bg-white border border-slate-200 rounded px-2 py-1 mt-1">
                        Ghi chú: {photo.notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: AI Extraction & Booking Assignment */}
                <div className="lg:col-span-7 p-4 flex flex-col justify-between gap-3">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-navy-900">
                          Danh sách Số Cont trích xuất
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            photo.ai_status === 'EXTRACTED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : photo.ai_status === 'EDITED'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {photo.ai_status === 'EXTRACTED'
                            ? `Đã xử lý AI (${list.length} cont)`
                            : photo.ai_status === 'EDITED'
                              ? `Đã chỉnh tay (${list.length} cont)`
                              : 'Chờ AI xử lý'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={extractingId === photo.id}
                          onClick={() => handleExtractAi(photo)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 disabled:opacity-60 shadow-sm"
                        >
                          {extractingId === photo.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          {extractingId === photo.id ? 'AI đang đọc ảnh...' : 'Xử lý ảnh bằng AI'}
                        </button>
                      </div>
                    </div>

                    {feedback && (
                      <div
                        className={`rounded-lg px-3 py-2 text-xs font-medium flex items-start gap-2 ${
                          feedback.includes('Chưa có') || feedback.includes('Lỗi')
                            ? 'bg-amber-50 border border-amber-200 text-amber-900'
                            : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                        }`}
                      >
                        {feedback.includes('Chưa có') || feedback.includes('Lỗi') ? (
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" />
                        )}
                        <span>{feedback}</span>
                      </div>
                    )}

                    {/* Editable Extracted Container Table */}
                    <div className="border border-slate-200 rounded-lg overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="px-2 py-2 w-8 text-center">
                              <input
                                type="checkbox"
                                checked={list.length > 0 && list.every((_, i) => checks[i])}
                                onChange={(e) => {
                                  const next: Record<number, boolean> = {};
                                  list.forEach((_, i) => {
                                    next[i] = e.target.checked;
                                  });
                                  setCheckedMap((prev) => ({ ...prev, [photo.id]: next }));
                                }}
                              />
                            </th>
                            <th className="px-2 py-2">Số Container</th>
                            <th className="px-2 py-2">Số Seal</th>
                            <th className="px-2 py-2 w-24">Loại Cont</th>
                            <th className="px-2 py-2">Ghi chú</th>
                            <th className="px-2 py-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {list.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                                Bấm &quot;Xử lý ảnh bằng AI&quot; để tự động đọc số cont từ ảnh Tally, hoặc bấm &quot;+ Thêm dòng cont&quot; bên dưới.
                              </td>
                            </tr>
                          ) : (
                            list.map((c, rIdx) => {
                              const dupExisting =
                                c.container_no.trim() &&
                                existingSet.has(c.container_no.trim().toUpperCase());
                              return (
                                <tr key={rIdx} className="hover:bg-slate-50">
                                  <td className="px-2 py-1.5 text-center">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(checks[rIdx])}
                                      onChange={(e) =>
                                        setCheckedMap((prev) => ({
                                          ...prev,
                                          [photo.id]: {
                                            ...(prev[photo.id] || {}),
                                            [rIdx]: e.target.checked,
                                          },
                                        }))
                                      }
                                    />
                                  </td>
                                  <td className="px-2 py-1.5">
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="text"
                                        value={c.container_no}
                                        onChange={(e) =>
                                          updateDraftItem(photo.id, rIdx, {
                                            container_no: e.target.value.toUpperCase(),
                                          })
                                        }
                                        placeholder="MSBU1514898"
                                        className="w-32 border border-slate-300 rounded px-2 py-1 font-mono font-semibold text-xs uppercase bg-white"
                                      />
                                      {dupExisting && (
                                        <span
                                          className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold whitespace-nowrap"
                                          title="Số cont này đã có trong bảng kê của chuyến"
                                        >
                                          Đã có
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-2 py-1.5">
                                    <input
                                      type="text"
                                      value={c.seal_no || ''}
                                      onChange={(e) =>
                                        updateDraftItem(photo.id, rIdx, {
                                          seal_no: e.target.value.toUpperCase(),
                                        })
                                      }
                                      placeholder="Seal..."
                                      className="w-24 border border-slate-300 rounded px-2 py-1 font-mono text-xs uppercase bg-white"
                                    />
                                  </td>
                                  <td className="px-2 py-1.5">
                                    <select
                                      value={c.cont_type}
                                      onChange={(e) =>
                                        updateDraftItem(photo.id, rIdx, {
                                          cont_type: e.target.value as ContType,
                                        })
                                      }
                                      className="border border-slate-300 rounded px-1.5 py-1 text-xs font-semibold bg-white"
                                    >
                                      {CONT_TYPES.map((ct) => (
                                        <option key={ct} value={ct}>
                                          {ct}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="px-2 py-1.5">
                                    <input
                                      type="text"
                                      value={c.notes || ''}
                                      onChange={(e) =>
                                        updateDraftItem(photo.id, rIdx, { notes: e.target.value })
                                      }
                                      placeholder="Ghi chú..."
                                      className="w-full min-w-[90px] border border-slate-300 rounded px-2 py-1 text-xs bg-white"
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 text-right">
                                    <button
                                      type="button"
                                      onClick={() => removeCandidate(photo.id, rIdx)}
                                      className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => addManualCandidate(photo.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50"
                      >
                        <Plus className="w-3.5 h-3.5" /> Thêm dòng cont
                      </button>

                      {list.length > 0 && (
                        <button
                          type="button"
                          disabled={savingListId === photo.id}
                          onClick={() => handleSaveExtractedEdits(photo.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-sky-300 bg-sky-50 text-sky-800 font-medium hover:bg-sky-100"
                        >
                          <Save className="w-3.5 h-3.5" />
                          {savingListId === photo.id ? 'Đang lưu...' : 'Lưu chỉnh sửa list'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Assign Extracted List to Booking of this Voyage */}
                  <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3 space-y-2">
                    <div className="text-xs font-bold text-indigo-900">
                      Gán list Cont đã chọn cho Booking của chuyến ({voyage.voyage_no})
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={targetBookingByPhoto[photo.id] || '__NONE__'}
                        onChange={(e) =>
                          setTargetBookingByPhoto((prev) => ({
                            ...prev,
                            [photo.id]: e.target.value,
                          }))
                        }
                        className="flex-1 border border-indigo-300 rounded-lg px-2.5 py-2 text-xs bg-white font-medium text-slate-800"
                      >
                        {voyageBookings.length === 0 ? (
                          <option value="__NONE__">
                            Chuyến chưa gắn Booking — Gán trực tiếp vào chuyến {voyage.voyage_no}
                          </option>
                        ) : (
                          <>
                            {voyageBookings.map((bk) => (
                              <option key={bk.id} value={bk.id}>
                                Booking {bk.booking_no} •{' '}
                                {bk.resolved_customer_name || bk.customer_name || 'KH'} (
                                {bk.resolved_origin_name || bk.origin_name || ''} →{' '}
                                {bk.resolved_dest_name || bk.dest_name || ''} • {bk.total_teus} TEU)
                              </option>
                            ))}
                            <option value="__NONE__">
                              Không gắn Booking cụ thể (Gán chung vào chuyến)
                            </option>
                          </>
                        )}
                      </select>

                      <button
                        type="button"
                        disabled={assigningId === photo.id || selectedCount === 0}
                        onClick={() => handleAssignSelectedToBooking(photo.id)}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 disabled:opacity-50 shadow-sm whitespace-nowrap"
                      >
                        {assigningId === photo.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        Gán {selectedCount} Cont vào Booking
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Zoom Lightbox Modal */}
      {zoomPhoto && (
        <div
          onClick={() => setZoomPhoto(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-xl overflow-hidden shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setZoomPhoto(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-black/70 text-white hover:bg-black"
            >
              <X className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolveApiMediaUrl(zoomPhoto.image_url)}
              alt="Tally Zoom"
              className="max-h-[85vh] w-auto object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
