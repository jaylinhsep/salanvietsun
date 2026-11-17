'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
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

export function VoyageTallyPhotosTab({
  voyage,
  voyageBookings,
  existingContainerNos,
  photos,
  loading,
  onRefreshPhotos,
  onContainersAssigned,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [savingListId, setSavingListId] = useState<string | null>(null);

  const [draftLists, setDraftLists] = useState<Record<string, TallyExtractedContainer[]>>({});
  const [checkedMap, setCheckedMap] = useState<Record<string, Record<number, boolean>>>({});
  const [targetBookingByPhoto, setTargetBookingByPhoto] = useState<Record<string, string>>({});
  const [feedbackByPhoto, setFeedbackByPhoto] = useState<Record<string, string>>({});
  const [zoomPhoto, setZoomPhoto] = useState<VoyageTallyPhoto | null>(null);

  useEffect(() => {
    const nextDrafts: Record<string, TallyExtractedContainer[]> = {};
    const nextChecks: Record<string, Record<number, boolean>> = {};
    const nextBookings: Record<string, string> = {};
    const defaultBookingId = voyageBookings[0]?.id || '__NONE__';

    for (const p of photos) {
      const list = Array.isArray(p.ai_extracted_containers) ? p.ai_extracted_containers : [];
      nextDrafts[p.id] = list.map((item) => ({
        container_no: String(item.container_no || '').toUpperCase(),
        cont_type: (CONT_TYPES.includes(item.cont_type) ? item.cont_type : '20F') as ContType,
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
      const res = await fetch(`${API_URL}/dispatch/tally-photos/${photo.id}/extract-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
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
        setFeedbackByPhoto((prev) => ({
          ...prev,
          [photo.id]: data?.message || 'Máy chủ chưa cấu hình API Key AI.',
        }));
        return;
      }
      const count = Array.isArray(data?.containers) ? data.containers.length : 0;
      setFeedbackByPhoto((prev) => ({
        ...prev,
        [photo.id]:
          count > 0
            ? `Đã trích xuất ${count} số container từ ảnh Tally!`
            : 'Không tìm thấy số container rõ ràng trong ảnh.',
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
        [photoId]: [...list, { container_no: '', cont_type: '20F' }],
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
          container_no: c.container_no.trim().toUpperCase(),
          cont_type: c.cont_type || '20F',
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
        container_no: c.container_no.trim().toUpperCase(),
        cont_type: c.cont_type || '20F',
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
      seal_no: '',
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
      notes: '',
    }));

    setAssigningId(photoId);
    try {
      await fetch(`${API_URL}/dispatch/tally-photos/${photoId}/extracted`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          containers: list
            .filter((c) => c.container_no.trim().length > 0)
            .map((c) => ({
              container_no: c.container_no.trim().toUpperCase(),
              cont_type: c.cont_type || '20F',
            })),
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
      {/* Clean Header & Upload Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-bold text-sm text-navy-900">
            Hình ảnh Tally của chuyến {voyage.voyage_no}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Xử lý ảnh bằng AI để lấy Số Container &amp; Loại Cont, sau đó chọn Booking để gán vào chuyến.
          </p>
        </div>

        <label className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-maritime-600 text-white text-xs font-semibold hover:bg-maritime-500 cursor-pointer shadow-sm self-start sm:self-auto">
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ImagePlus className="w-4 h-4" />
          )}
          <span>{uploading ? 'Đang tải lên...' : '+ Tải ảnh Tally từ máy'}</span>
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

      {/* Photo Cards */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-400">
          Đang tải danh sách hình ảnh Tally...
        </div>
      ) : photos.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center space-y-2">
          <ImagePlus className="w-8 h-8 text-slate-300 mx-auto" />
          <div className="text-sm font-semibold text-slate-600">
            Chưa có hình ảnh Tally nào cho chuyến {voyage.voyage_no}
          </div>
          <p className="text-xs text-slate-400">
            Thuyền trưởng gửi ảnh ở Bước 1 trên App Tàu (/mobile), hoặc Điều độ viên bấm tải ảnh ở nút phía trên.
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
                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(photo.id)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-rose-600 hover:bg-rose-50 rounded border border-rose-200 text-[11px]"
                        title="Xóa ảnh"
                      >
                        <Trash2 className="w-3 h-3" /> Xóa
                      </button>
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

                  <div className="text-[11px] text-slate-500 space-y-1">
                    <div>
                      Người gửi: <strong className="text-slate-700">{photo.uploaded_by || 'Thuyền trưởng'}</strong> •{' '}
                      {new Date(photo.created_at).toLocaleString('vi-VN')}
                    </div>
                    {photo.notes && (
                      <div className="text-slate-700 bg-white border border-slate-200 rounded px-2 py-1">
                        Ghi chú: {photo.notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: AI Extraction (Số Cont & Loại Cont only) & Booking Assignment */}
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
                            ? `Đã xử lý (${list.length} cont)`
                            : photo.ai_status === 'EDITED'
                              ? `Đã chỉnh (${list.length} cont)`
                              : 'Chờ xử lý'}
                        </span>
                      </div>

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
                        {extractingId === photo.id ? 'Đang trích xuất...' : 'Xử lý ảnh bằng AI'}
                      </button>
                    </div>

                    {feedback && (
                      <div
                        className={`rounded-lg px-3 py-2 text-xs font-medium flex items-start gap-2 ${
                          feedback.includes('Chưa có') ||
                          feedback.includes('Lỗi') ||
                          feedback.includes('Không tìm')
                            ? 'bg-amber-50 border border-amber-200 text-amber-900'
                            : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                        }`}
                      >
                        {feedback.includes('Chưa có') ||
                        feedback.includes('Lỗi') ||
                        feedback.includes('Không tìm') ? (
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" />
                        )}
                        <span>{feedback}</span>
                      </div>
                    )}

                    {/* Clean Table: Chỉ Số Container & Loại Cont */}
                    <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                          <tr>
                            <th className="px-2.5 py-2 w-9 text-center">
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
                            <th className="px-2.5 py-2 w-10 text-center">#</th>
                            <th className="px-2.5 py-2">Số Container</th>
                            <th className="px-2.5 py-2 w-32">Loại Cont</th>
                            <th className="px-2.5 py-2 w-12 text-right">Xóa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {list.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                                Bấm &quot;Xử lý ảnh bằng AI&quot; để trích xuất Số Container &amp; Loại Cont, hoặc bấm &quot;+ Thêm dòng cont&quot;.
                              </td>
                            </tr>
                          ) : (
                            list.map((c, rIdx) => {
                              const dupExisting =
                                c.container_no.trim() &&
                                existingSet.has(c.container_no.trim().toUpperCase());
                              return (
                                <tr key={rIdx} className="hover:bg-slate-50">
                                  <td className="px-2.5 py-1.5 text-center">
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
                                  <td className="px-2.5 py-1.5 text-center text-slate-500">
                                    {rIdx + 1}
                                  </td>
                                  <td className="px-2.5 py-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="text"
                                        value={c.container_no}
                                        onChange={(e) =>
                                          updateDraftItem(photo.id, rIdx, {
                                            container_no: e.target.value.toUpperCase(),
                                          })
                                        }
                                        placeholder="MSBU1514898"
                                        className="w-40 border border-slate-300 rounded px-2.5 py-1 font-mono font-semibold text-xs uppercase bg-white"
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
                                  <td className="px-2.5 py-1.5">
                                    <select
                                      value={c.cont_type}
                                      onChange={(e) =>
                                        updateDraftItem(photo.id, rIdx, {
                                          cont_type: e.target.value as ContType,
                                        })
                                      }
                                      className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-semibold bg-white"
                                    >
                                      {CONT_TYPES.map((ct) => (
                                        <option key={ct} value={ct}>
                                          {ct}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="px-2.5 py-1.5 text-right">
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
