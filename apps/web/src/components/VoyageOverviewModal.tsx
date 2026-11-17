'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock,
  ListChecks,
  Minus,
  Plus,
  RotateCcw,
  Ship,
  X,
} from 'lucide-react';
import type { Booking, Vessel, Voyage } from '@/lib/api';
import {
  assignBookingsToBargeAction,
  getClosingUrgency,
  unassignBookingAction,
  updateBookingAction,
} from '@/lib/workflow-store';
import { StatusBadge } from '@/components/StatusBadge';

interface Props {
  voyage: Voyage;
  vessel?: Vessel | null;
  allBookings: Booking[];
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}

interface CountEdit {
  cont_20e: number;
  cont_20f: number;
  cont_40e: number;
  cont_40f: number;
}

function calcTeus(c: CountEdit): number {
  return Number(c.cont_20e || 0) + Number(c.cont_20f || 0) + (Number(c.cont_40e || 0) + Number(c.cont_40f || 0)) * 2;
}

export function VoyageOverviewModal({
  voyage,
  vessel,
  allBookings,
  onClose,
  onChanged,
}: Props) {
  const attachedBookings = useMemo(
    () => allBookings.filter((b) => b.voyage_id === voyage.id),
    [allBookings, voyage.id],
  );
  const pendingBookings = useMemo(
    () => allBookings.filter((b) => !b.voyage_id && b.status === 'PENDING'),
    [allBookings],
  );

  const [drafts, setDrafts] = useState<Record<string, CountEdit>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const init: Record<string, CountEdit> = {};
    for (const b of attachedBookings) {
      init[b.id] = {
        cont_20e: Number(b.cont_20e || 0),
        cont_20f: Number(b.cont_20f || 0),
        cont_40e: Number(b.cont_40e || 0),
        cont_40f: Number(b.cont_40f || 0),
      };
    }
    setDrafts(init);
  }, [attachedBookings]);

  const maxTeu = Number(vessel?.capacity_teu || 0);
  const maxTons = Number(vessel?.capacity_tons || 0);
  const limit85Tons = Math.round(maxTons * 0.85 * 10) / 10;
  const totalWeightTons =
    Math.round(attachedBookings.reduce((s, b) => s + Number(b.total_weight_tons || 0), 0) * 100) /
    100 || Number(voyage.total_weight_tons || 0);
  const weightPct = maxTons > 0 ? Math.round((totalWeightTons / maxTons) * 100) : 0;
  const isOver85Weight = maxTons > 0 && totalWeightTons > limit85Tons;
  const isPlanned = voyage.status === 'PLANNED';

  // Compute live projected voyage TEUs based on any unsaved inline count adjustments
  const savedAttachedTeus = attachedBookings.reduce((s, b) => s + Number(b.total_teus || 0), 0);
  const draftAttachedTeus = attachedBookings.reduce((s, b) => {
    const d = drafts[b.id];
    return s + (d ? calcTeus(d) : Number(b.total_teus || 0));
  }, 0);
  const nonBookingBaseTeus = Math.max(0, Number(voyage.total_teus || 0) - savedAttachedTeus);
  const projectedVoyageTeus = nonBookingBaseTeus + draftAttachedTeus;
  const isOverCapacity = projectedVoyageTeus > maxTeu;
  const pct = maxTeu > 0 ? Math.min(100, Math.round((projectedVoyageTeus / maxTeu) * 100)) : 100;

  const adjustCount = (bookingId: string, field: keyof CountEdit, delta: number) => {
    setDrafts((prev) => {
      const cur = prev[bookingId] || { cont_20e: 0, cont_20f: 0, cont_40e: 0, cont_40f: 0 };
      const nextVal = Math.max(0, Number(cur[field] || 0) + delta);
      return {
        ...prev,
        [bookingId]: { ...cur, [field]: nextVal },
      };
    });
  };

  const setCount = (bookingId: string, field: keyof CountEdit, value: number) => {
    setDrafts((prev) => {
      const cur = prev[bookingId] || { cont_20e: 0, cont_20f: 0, cont_40e: 0, cont_40f: 0 };
      return {
        ...prev,
        [bookingId]: { ...cur, [field]: Math.max(0, Number(value || 0)) },
      };
    });
  };

  const isRowDirty = (bk: Booking) => {
    const d = drafts[bk.id];
    if (!d) return false;
    return (
      d.cont_20e !== Number(bk.cont_20e || 0) ||
      d.cont_20f !== Number(bk.cont_20f || 0) ||
      d.cont_40e !== Number(bk.cont_40e || 0) ||
      d.cont_40f !== Number(bk.cont_40f || 0)
    );
  };

  const handleSaveBookingCounts = async (bk: Booking) => {
    const d = drafts[bk.id];
    if (!d) return;
    if (isOverCapacity) {
      alert(
        `Không thể lưu vì vượt sức chở của sà lan ${vessel?.name || ''} (${projectedVoyageTeus} / ${maxTeu} TEU).`,
      );
      return;
    }
    setBusyId(bk.id);
    try {
      await updateBookingAction(bk.id, d);
      await onChanged();
    } catch (err: any) {
      alert(err?.message || 'Không thể cập nhật số TEU cho booking.');
    } finally {
      setBusyId(null);
    }
  };

  const handleUnassign = async (bk: Booking) => {
    setBusyId(bk.id);
    try {
      await unassignBookingAction(bk.id);
      await onChanged();
    } catch (err: any) {
      alert(err?.message || 'Không thể nhả booking về hàng chờ.');
    } finally {
      setBusyId(null);
    }
  };

  const handleAttachPending = async (bk: Booking) => {
    if (!vessel) {
      alert('Chuyến này chưa gắn sà lan.');
      return;
    }
    setBusyId(bk.id);
    try {
      await assignBookingsToBargeAction({
        bookings: [bk],
        vessel,
        targetVoyage: voyage,
      });
      await onChanged();
    } catch (err: any) {
      alert(err?.message || 'Không thể ghép booking vào chuyến.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/55 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-navy-900 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold">Tổng thể Chuyến: {voyage.voyage_no}</h3>
              <StatusBadge status={voyage.status} />
              {vessel && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/15 text-sky-200 text-xs font-semibold">
                  <Ship className="w-3.5 h-3.5" /> {vessel.name} ({vessel.code})
                </span>
              )}
            </div>
            <p className="text-xs text-sky-200 mt-1">
              Tuyến chính: <b>{voyage.origin_name || '—'}</b> → <b>{voyage.dest_name || '—'}</b> • Khách hàng:{' '}
              <b>{voyage.customer_name || 'Nhiều khách / Theo booking'}</b>
              {voyage.pic_name ? ` • PIC: ${voyage.pic_name}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/dispatch?voyageId=${voyage.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-maritime-500 text-white text-xs font-semibold hover:bg-maritime-400"
            >
              <ListChecks className="w-4 h-4" /> Mở bảng kê Cont ({voyage.detail_count || 0})
            </Link>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white"
              title="Đóng popup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Capacity Strip */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-4">
              <span>
                Số Booking đang ghép: <strong className="text-navy-900">{attachedBookings.length}</strong>
              </span>
              <span>
                Sức chở sà lan: <strong className="text-slate-900">{maxTeu} TEU</strong>
              </span>
              {nonBookingBaseTeus > 0 && (
                <span className="text-slate-500">
                  (Gồm {nonBookingBaseTeus} TEU nhập tay trực tiếp trên chuyến)
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div
                className={`font-bold text-sm ${
                  isOverCapacity ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                Tổng TEU chuyến: {projectedVoyageTeus} / {maxTeu} TEU ({pct}%)
              </div>
              <div className="px-2.5 py-1 rounded-md bg-rose-50 border border-rose-300 text-rose-700 font-bold text-xs">
                Trọng lượng đã nhận: {totalWeightTons.toLocaleString('vi-VN')} /{' '}
                {maxTons.toLocaleString('vi-VN')} Tấn ({weightPct}%)
                {isOver85Weight ? ` • ⚠️ >85% (${limit85Tons}T)` : ''}
              </div>
            </div>
          </div>

          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                isOverCapacity
                  ? 'bg-rose-600'
                  : pct >= 85
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>

          {isOverCapacity && (
            <div className="rounded-lg bg-rose-50 border border-rose-300 px-3 py-2 text-xs text-rose-800 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>
                Cảnh báo vượt tải sức chở sà lan ({projectedVoyageTeus} &gt; {maxTeu} TEU)! Vui lòng giảm số cont hoặc nhả bớt booking về chờ.
              </span>
            </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Attached Bookings Breakdown */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-sm text-slate-900">
                1. Chi tiết từng Booking trên chuyến (Chỉnh thêm/bớt trực tiếp số Cont / TEU)
              </h4>
              <span className="text-[11px] text-slate-500">
                Thay đổi số cont ở từng dòng rồi bấm Lưu để cập nhật tổng TEU chuyến
              </span>
            </div>

            {attachedBookings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500 bg-slate-50/50">
                Chuyến này hiện chưa gắn Booking riêng lẻ nào (Tổng khai báo trên chuyến: <b>{voyage.total_teus || 0} TEU</b> — 20E:{voyage.cont_20e || 0}, 20F:{voyage.cont_20f || 0}, 40E:{voyage.cont_40e || 0}, 40F:{voyage.cont_40f || 0}). Bạn có thể ghép thêm Booking chờ ngay ở mục 2 bên dưới.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Số Booking</th>
                      <th className="px-3 py-2.5">Khách hàng</th>
                      <th className="px-3 py-2.5">Cảng đi → Cảng đến</th>
                      <th className="px-3 py-2.5">Cắt máng / Hạn lệnh</th>
                      <th className="px-2 py-2.5 text-center">20E</th>
                      <th className="px-2 py-2.5 text-center">20F</th>
                      <th className="px-2 py-2.5 text-center">40E</th>
                      <th className="px-2 py-2.5 text-center">40F</th>
                      <th className="px-3 py-2.5 text-center text-rose-700 bg-rose-50">TEUs</th>
                      <th className="px-3 py-2.5 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attachedBookings.map((bk) => {
                      const d = drafts[bk.id] || {
                        cont_20e: Number(bk.cont_20e || 0),
                        cont_20f: Number(bk.cont_20f || 0),
                        cont_40e: Number(bk.cont_40e || 0),
                        cont_40f: Number(bk.cont_40f || 0),
                      };
                      const rowTeus = calcTeus(d);
                      const dirty = isRowDirty(bk);
                      const urgency = getClosingUrgency(bk.closing_time);
                      const isHot = urgency.level === 'URGENT' || urgency.level === 'OVERDUE';

                      return (
                        <tr key={bk.id} className={dirty ? 'bg-amber-50/60' : 'hover:bg-slate-50'}>
                          <td className="px-3 py-2.5">
                            <div className="font-bold text-navy-900">{bk.booking_no}</div>
                            <span
                              className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                bk.cargo_direction === 'IMPORT'
                                  ? 'bg-violet-100 text-violet-800'
                                  : 'bg-sky-100 text-sky-800'
                              }`}
                            >
                              {bk.cargo_direction === 'IMPORT' ? 'Hàng Nhập' : 'Hàng Xuất'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-medium text-slate-800">
                            {bk.resolved_customer_name || bk.customer_name || '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1 font-medium text-maritime-700">
                              <span>{bk.resolved_origin_name || bk.origin_name || '—'}</span>
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                              <span>{bk.resolved_dest_name || bk.dest_name || '—'}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                isHot ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              <Clock className="w-3 h-3" /> {urgency.label}
                            </span>
                          </td>

                          {(['cont_20e', 'cont_20f', 'cont_40e', 'cont_40f'] as const).map((field) => (
                            <td key={field} className="px-1.5 py-2 text-center">
                              <div className="inline-flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden">
                                <button
                                  type="button"
                                  disabled={!isPlanned || d[field] <= 0}
                                  onClick={() => adjustCount(bk.id, field, -1)}
                                  className="px-1.5 py-1 hover:bg-slate-100 disabled:opacity-30 text-slate-600"
                                  title="Giảm 1"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <input
                                  type="number"
                                  min={0}
                                  disabled={!isPlanned}
                                  className="w-10 text-center font-bold py-1 focus:outline-none bg-transparent"
                                  value={d[field]}
                                  onChange={(e) => setCount(bk.id, field, Number(e.target.value))}
                                />
                                <button
                                  type="button"
                                  disabled={!isPlanned}
                                  onClick={() => adjustCount(bk.id, field, 1)}
                                  className="px-1.5 py-1 hover:bg-slate-100 disabled:opacity-30 text-slate-600"
                                  title="Tăng 1"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          ))}

                          <td className="px-3 py-2.5 text-center font-extrabold text-rose-700 bg-rose-50/60">
                            {rowTeus}
                          </td>

                          <td className="px-3 py-2.5 text-right space-x-1.5">
                            {isPlanned && dirty && (
                              <button
                                type="button"
                                disabled={busyId === bk.id || isOverCapacity}
                                onClick={() => handleSaveBookingCounts(bk)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-500 disabled:opacity-40"
                              >
                                <Check className="w-3.5 h-3.5" /> Lưu
                              </button>
                            )}
                            {isPlanned && (
                              <button
                                type="button"
                                disabled={busyId === bk.id}
                                onClick={() => handleUnassign(bk)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 font-medium"
                                title="Nhả booking này khỏi chuyến về danh sách chờ"
                              >
                                <RotateCcw className="w-3 h-3" /> Nhả
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add More Pending Bookings right inside the Popup */}
          {isPlanned && (
            <div>
              <h4 className="font-bold text-sm text-slate-900 mb-2">
                2. Thêm nhanh Booking đang chờ vào chuyến này ({pendingBookings.length})
              </h4>
              {pendingBookings.length === 0 ? (
                <div className="text-xs text-slate-400 italic">
                  Không còn booking nào đang chờ xếp tàu.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {pendingBookings.map((bk) => {
                    const willExceed = projectedVoyageTeus + Number(bk.total_teus || 0) > maxTeu;
                    return (
                      <div
                        key={bk.id}
                        className={`rounded-xl border p-3 flex items-center justify-between gap-3 text-xs ${
                          willExceed ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-navy-900">{bk.booking_no}</span>
                            <span className="px-1.5 py-0.5 rounded bg-navy-900 text-white text-[10px] font-bold">
                              {bk.total_teus} TEU
                            </span>
                            {bk.cargo_direction === 'IMPORT' && (
                              <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 text-[10px] font-semibold">
                                Hàng Nhập
                              </span>
                            )}
                          </div>
                          <div className="text-slate-700 font-medium truncate mt-0.5">
                            {bk.resolved_customer_name || bk.customer_name || '—'}
                          </div>
                          <div className="text-maritime-700 text-[11px]">
                            {bk.resolved_origin_name || bk.origin_name} →{' '}
                            {bk.resolved_dest_name || bk.dest_name} (20E:{bk.cont_20e} • 20F:{bk.cont_20f} • 40E:{bk.cont_40e} • 40F:{bk.cont_40f})
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={busyId === bk.id || willExceed}
                          onClick={() => handleAttachPending(bk)}
                          className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                            willExceed
                              ? 'bg-rose-100 text-rose-700 cursor-not-allowed'
                              : 'bg-indigo-600 text-white hover:bg-indigo-500'
                          }`}
                        >
                          {willExceed ? (
                            <>Vượt {maxTeu} TEU</>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" /> Ghép
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
