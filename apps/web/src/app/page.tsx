'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Anchor,
  ArrowRight,
  CheckSquare,
  Clock,
  Fuel,
  ListChecks,
  MapPin,
  PackagePlus,
  Pencil,
  Plus,
  RotateCcw,
  Ship,
  Smartphone,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import type { Booking, Customer, Port, Vessel, Voyage } from '@/lib/api';
import {
  assignBookingsToBargeAction,
  CAPTAIN_STEPS,
  createBookingAction,
  deleteBookingAction,
  getClosingUrgency,
  loadWorkflowSnapshot,
  releaseVoyageAction,
  unassignBookingAction,
  updateBookingAction,
  updateVoyageAction,
} from '@/lib/workflow-store';
import { MapView } from '@/components/MapView';
import { StatusBadge } from '@/components/StatusBadge';
import { VoyageOverviewModal } from '@/components/VoyageOverviewModal';

function toLocalDateTimeInput(iso?: string): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 8 * 3600 * 1000);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function DispatchCenterHomePage() {
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [ports, setPorts] = useState<Port[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);
  const [draggedBookingId, setDraggedBookingId] = useState<string | null>(null);
  const [mapVesselId, setMapVesselId] = useState<string | null>(null);
  const [overviewVoyageId, setOverviewVoyageId] = useState<string | null>(null);
  const [onlyUrgent, setOnlyUrgent] = useState(false);
  const [showVendorBarges, setShowVendorBarges] = useState(false);

  // Quick Create / Edit Booking Modal
  const [showCreateBooking, setShowCreateBooking] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [bookingForm, setBookingForm] = useState({
    booking_no: '',
    cargo_direction: 'EXPORT' as 'EXPORT' | 'IMPORT',
    customer_id: '',
    customer_name: '',
    origin_port_id: '',
    origin_name: '',
    destination_port_id: '',
    dest_name: '',
    cont_20e: 0,
    cont_20f: 4,
    cont_40e: 0,
    cont_40f: 2,
    closing_time: toLocalDateTimeInput(),
    estimated_freight: 12000000,
    notes: '',
  });

  // Edit Planned Voyage Modal
  const [editingVoyage, setEditingVoyage] = useState<Voyage | null>(null);
  const [voyageEditForm, setVoyageEditForm] = useState({
    voyage_no: '',
    vessel_id: '',
    origin_port_id: '',
    destination_port_id: '',
    pic_name: '',
    cont_20e: 0,
    cont_20f: 0,
    cont_40e: 0,
    cont_40f: 0,
    captain_notes: '',
  });

  const refresh = async () => {
    setLoading(true);
    try {
      const snap = await loadWorkflowSnapshot();
      setVessels(snap.vessels);
      setPorts(snap.ports);
      setCustomers(snap.customers);
      setVoyages(snap.voyages);
      setBookings(snap.bookings);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const pendingBookings = useMemo(() => {
    const list = bookings.filter((b) => !b.voyage_id && b.status === 'PENDING');
    if (!onlyUrgent) return list;
    return list.filter((b) => {
      const u = getClosingUrgency(b.closing_time);
      return u.level === 'URGENT' || u.level === 'OVERDUE';
    });
  }, [bookings, onlyUrgent]);

  const urgentCount = useMemo(
    () =>
      bookings.filter((b) => {
        if (b.voyage_id || b.status !== 'PENDING') return false;
        const u = getClosingUrgency(b.closing_time);
        return u.level === 'URGENT' || u.level === 'OVERDUE';
      }).length,
    [bookings],
  );

  const activeVoyageByVessel = useMemo(() => {
    const map = new Map<string, Voyage>();
    for (const vy of voyages) {
      if (
        vy.vessel_id &&
        ['PLANNED', 'DEPARTED', 'IN_TRANSIT', 'ARRIVED'].includes(vy.status) &&
        !map.has(vy.vessel_id)
      ) {
        map.set(vy.vessel_id, vy);
      }
    }
    return map;
  }, [voyages]);

  const toggleBookingSelect = (id: string) => {
    setSelectedBookingIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectedBookings = useMemo(
    () => pendingBookings.filter((b) => selectedBookingIds.includes(b.id)),
    [pendingBookings, selectedBookingIds],
  );

  const selectedTeus = selectedBookings.reduce((s, b) => s + Number(b.total_teus || 0), 0);

  const handleOpenBookingModal = () => {
    setEditingBookingId(null);
    setBookingForm({
      booking_no: `BK-${new Date().getFullYear().toString().slice(-2)}-${Math.floor(1000 + Math.random() * 9000)}`,
      cargo_direction: 'EXPORT',
      customer_id: customers[0]?.id || '',
      customer_name: customers[0]?.name || '',
      origin_port_id: ports[0]?.id || '',
      origin_name: ports[0]?.name || 'SPITC',
      destination_port_id: ports[1]?.id || ports[0]?.id || '',
      dest_name: ports[1]?.name || 'TRÀ NÓC',
      cont_20e: 0,
      cont_20f: 4,
      cont_40e: 0,
      cont_40f: 2,
      closing_time: toLocalDateTimeInput(),
      estimated_freight: 12000000,
      notes: '',
    });
    setShowCreateBooking(true);
  };

  const handleOpenEditBookingModal = (bk: Booking) => {
    setEditingBookingId(bk.id);
    const matchedCust =
      customers.find((c) => c.id === bk.customer_id) ||
      customers.find((c) => c.name === (bk.resolved_customer_name || bk.customer_name));
    const matchedOrigin =
      ports.find((p) => p.id === bk.origin_port_id) ||
      ports.find((p) => p.name === (bk.resolved_origin_name || bk.origin_name));
    const matchedDest =
      ports.find((p) => p.id === bk.destination_port_id) ||
      ports.find((p) => p.name === (bk.resolved_dest_name || bk.dest_name));

    setBookingForm({
      booking_no: bk.booking_no,
      cargo_direction: bk.cargo_direction === 'IMPORT' ? 'IMPORT' : 'EXPORT',
      customer_id: matchedCust?.id || bk.customer_id || customers[0]?.id || '',
      customer_name: bk.resolved_customer_name || bk.customer_name || '',
      origin_port_id: matchedOrigin?.id || bk.origin_port_id || ports[0]?.id || '',
      origin_name: bk.resolved_origin_name || bk.origin_name || '',
      destination_port_id: matchedDest?.id || bk.destination_port_id || ports[1]?.id || '',
      dest_name: bk.resolved_dest_name || bk.dest_name || '',
      cont_20e: Number(bk.cont_20e || 0),
      cont_20f: Number(bk.cont_20f || 0),
      cont_40e: Number(bk.cont_40e || 0),
      cont_40f: Number(bk.cont_40f || 0),
      closing_time: toLocalDateTimeInput(bk.closing_time),
      estimated_freight: Number(bk.estimated_freight || 0),
      notes: bk.notes || '',
    });
    setShowCreateBooking(true);
  };

  const handleSaveBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find((c) => c.id === bookingForm.customer_id);
    const op = ports.find((p) => p.id === bookingForm.origin_port_id);
    const dp = ports.find((p) => p.id === bookingForm.destination_port_id);
    const payload = {
      booking_no: bookingForm.booking_no,
      cargo_direction: bookingForm.cargo_direction,
      customer_id: bookingForm.customer_id || undefined,
      customer_name: cust?.name || bookingForm.customer_name,
      origin_port_id: bookingForm.origin_port_id || undefined,
      origin_name: op?.name || bookingForm.origin_name,
      destination_port_id: bookingForm.destination_port_id || undefined,
      dest_name: dp?.name || bookingForm.dest_name,
      cont_20e: Number(bookingForm.cont_20e || 0),
      cont_20f: Number(bookingForm.cont_20f || 0),
      cont_40e: Number(bookingForm.cont_40e || 0),
      cont_40f: Number(bookingForm.cont_40f || 0),
      closing_time: bookingForm.closing_time
        ? new Date(bookingForm.closing_time).toISOString()
        : undefined,
      estimated_freight: Number(bookingForm.estimated_freight || 0),
      notes: bookingForm.notes,
    };

    if (editingBookingId) {
      await updateBookingAction(editingBookingId, payload);
    } else {
      await createBookingAction(payload);
    }
    setShowCreateBooking(false);
    setEditingBookingId(null);
    await refresh();
  };

  const handleAssignToBarge = async (vessel: Vessel, attachToExisting: boolean) => {
    let targetBookings = selectedBookings;
    if (targetBookings.length === 0 && draggedBookingId) {
      const dragged = pendingBookings.find((b) => b.id === draggedBookingId);
      if (dragged) targetBookings = [dragged];
    }
    if (targetBookings.length === 0) return;

    const existingVoyage = attachToExisting ? activeVoyageByVessel.get(vessel.id) || null : null;
    try {
      await assignBookingsToBargeAction({
        bookings: targetBookings,
        vessel,
        targetVoyage: existingVoyage,
      });
      setSelectedBookingIds([]);
      setDraggedBookingId(null);
      await refresh();
    } catch (err: any) {
      alert(err?.message || 'Không thể ghép booking vào sà lan.');
    }
  };

  const handleUnassignBooking = async (bk: Booking) => {
    try {
      await unassignBookingAction(bk.id);
      await refresh();
    } catch (err: any) {
      alert(err?.message || 'Không thể nhả booking về chờ.');
    }
  };

  const handleReleaseVoyage = async (vy: Voyage) => {
    if (
      !confirm(
        `Nhả chuyến ${vy.voyage_no} về chế độ chờ? Toàn bộ booking thuộc chuyến này sẽ quay lại danh sách chờ xếp tàu.`,
      )
    ) {
      return;
    }
    try {
      await releaseVoyageAction(vy.id);
      await refresh();
    } catch (err: any) {
      alert(err?.message || 'Không thể nhả chuyến về chế độ chờ.');
    }
  };

  const handleOpenEditVoyageModal = (vy: Voyage) => {
    setEditingVoyage(vy);
    setVoyageEditForm({
      voyage_no: vy.voyage_no,
      vessel_id: vy.vessel_id || vessels[0]?.id || '',
      origin_port_id: vy.origin_port_id || ports[0]?.id || '',
      destination_port_id: vy.destination_port_id || ports[1]?.id || '',
      pic_name: vy.pic_name || '',
      cont_20e: Number(vy.cont_20e || 0),
      cont_20f: Number(vy.cont_20f || 0),
      cont_40e: Number(vy.cont_40e || 0),
      cont_40f: Number(vy.cont_40f || 0),
      captain_notes: vy.captain_notes || '',
    });
  };

  const handleSaveVoyageEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVoyage) return;
    const nextTeus =
      voyageEditForm.cont_20e +
      voyageEditForm.cont_20f +
      (voyageEditForm.cont_40e + voyageEditForm.cont_40f) * 2;
    const targetVessel = vessels.find((v) => v.id === voyageEditForm.vessel_id);
    const maxTeu = Number(targetVessel?.capacity_teu || 0);
    if (targetVessel && nextTeus > maxTeu) {
      alert(
        `Vượt sức chở của sà lan ${targetVessel.name} (${nextTeus} TEU > tối đa ${maxTeu} TEU). Vui lòng giảm số cont hoặc chọn sà lan lớn hơn!`,
      );
      return;
    }
    try {
      await updateVoyageAction(editingVoyage.id, voyageEditForm);
      setEditingVoyage(null);
      await refresh();
    } catch (err: any) {
      alert(err?.message || 'Không thể cập nhật chuyến.');
    }
  };

  const mapVessel = useMemo(
    () => vessels.find((v) => v.id === mapVesselId) || null,
    [vessels, mapVesselId],
  );

  // Sort barges cleanly by operational stage: AVAILABLE -> IN_VOYAGE -> IDLE -> MAINTENANCE
  const groupedVessels = useMemo(() => {
    const order: Record<string, number> = {
      AVAILABLE: 1,
      IDLE: 2,
      IN_VOYAGE: 3,
      MAINTENANCE: 4,
    };
    const base = showVendorBarges
      ? vessels
      : vessels.filter((v) => !(v as any).is_vendor_barge);
    return [...base].sort((a, b) => (order[a.status] || 9) - (order[b.status] || 9));
  }, [vessels, showVendorBarges]);

  const bargeStageBadge = (vessel: Vessel, activeVoyage?: Voyage) => {
    if (vessel.status === 'MAINTENANCE') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
          Bảo trì
        </span>
      );
    }
    if (vessel.status === 'IN_VOYAGE' || (activeVoyage && activeVoyage.status === 'IN_TRANSIT')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800">
          Đang chạy chuyến
        </span>
      );
    }
    if (activeVoyage && activeVoyage.status === 'PLANNED') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-800">
          Đang gom/xếp hàng
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
        Đang nằm bến (Trống)
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Action-First Operational Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Bảng Điều độ Trung tâm 1 Chạm
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Tiếp nhận Booking • Gom nhiều đơn vào sà lan • Theo dõi Closing Time & 5 bước Thuyền trưởng
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenBookingModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-maritime-600 text-white text-xs sm:text-sm font-medium hover:bg-maritime-500 shadow-sm"
          >
            <PackagePlus className="w-4 h-4" /> + Nhập Booking mới
          </button>
          <Link
            href="/dispatch"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs sm:text-sm font-medium hover:bg-slate-50"
          >
            <ListChecks className="w-4 h-4 text-indigo-600" /> Bảng kê Cont từng chuyến
          </Link>
          <Link
            href="/mobile"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-navy-900 text-white text-xs sm:text-sm font-medium hover:bg-navy-800"
          >
            <Smartphone className="w-4 h-4 text-sky-300" /> App Tàu (/mobile)
          </Link>
        </div>
      </div>

      {/* Urgent Operational Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          className={`rounded-xl border p-3 flex items-center justify-between ${
            urgentCount > 0
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle
              className={`w-5 h-5 ${urgentCount > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-400'}`}
            />
            <div>
              <div className="text-[11px] uppercase font-semibold opacity-80">
                Đơn sát cắt máng / hạn lệnh (&lt;12h)
              </div>
              <div className="text-lg font-bold">{urgentCount} Booking</div>
            </div>
          </div>
          {urgentCount > 0 && (
            <button
              onClick={() => setOnlyUrgent((v) => !v)}
              className="px-2.5 py-1 rounded bg-rose-600 text-white text-xs font-medium hover:bg-rose-500"
            >
              {onlyUrgent ? 'Hiện tất cả' : 'Lọc đơn gấp'}
            </button>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase font-semibold text-slate-500">
              Booking chờ xếp sà lan
            </div>
            <div className="text-lg font-bold text-slate-900">
              {pendingBookings.length} đơn •{' '}
              {pendingBookings.reduce((s, b) => s + Number(b.total_teus || 0), 0)} TEUs
            </div>
          </div>
          {selectedBookings.length > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-indigo-600 text-white text-xs font-semibold">
              Đang chọn: {selectedBookings.length} đơn ({selectedTeus} TEU)
            </span>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase font-semibold text-slate-500">
              Tình trạng đội sà lan
            </div>
            <div className="text-sm font-bold text-slate-900 mt-0.5">
              <span className="text-emerald-700">
                {vessels.filter((v) => v.status === 'AVAILABLE' || v.status === 'IDLE').length} nằm bến
              </span>{' '}
              •{' '}
              <span className="text-sky-700">
                {vessels.filter((v) => v.status === 'IN_VOYAGE').length} đang chạy
              </span>
            </div>
          </div>
          <span className="text-xs text-slate-400">Tổng {vessels.length} tàu</span>
        </div>
      </div>

      {/* Single-Screen Dispatch Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN: Pending Bookings awaiting Barge */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-sm text-slate-900">
                1. Booking chờ xếp tàu ({pendingBookings.length})
              </h2>
              <p className="text-[11px] text-slate-500">
                Tick chọn nhiều đơn hoặc kéo-thả vào sà lan ở cột giữa
              </p>
            </div>
            <button
              onClick={handleOpenBookingModal}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-maritime-600 text-white text-xs font-medium hover:bg-maritime-500"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm
            </button>
          </div>

          <div className="p-3 space-y-2.5 max-h-[68vh] overflow-y-auto">
            {loading && pendingBookings.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">Đang tải booking...</div>
            ) : pendingBookings.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                Tất cả booking đã được ghép vào sà lan. Bấm <strong>+ Thêm</strong> để nhận booking mới.
              </div>
            ) : (
              pendingBookings.map((bk) => {
                const checked = selectedBookingIds.includes(bk.id);
                const urgency = getClosingUrgency(bk.closing_time);
                const isHot = urgency.level === 'URGENT' || urgency.level === 'OVERDUE';

                return (
                  <div
                    key={bk.id}
                    draggable
                    onDragStart={() => {
                      setDraggedBookingId(bk.id);
                      if (!selectedBookingIds.includes(bk.id)) {
                        setSelectedBookingIds((prev) => [...prev, bk.id]);
                      }
                    }}
                    onClick={() => toggleBookingSelect(bk.id)}
                    className={`rounded-xl border p-3 cursor-pointer transition-all select-none ${
                      checked
                        ? 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-200'
                        : isHot
                          ? 'border-rose-300 bg-rose-50/60 hover:bg-rose-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        )}
                        <span className="font-bold text-sm text-navy-900">{bk.booking_no}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            bk.cargo_direction === 'IMPORT'
                              ? 'bg-violet-100 text-violet-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {bk.cargo_direction === 'IMPORT' ? 'Hàng Nhập' : 'Hàng Xuất'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            isHot
                              ? 'bg-rose-600 text-white'
                              : urgency.level === 'SOON'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                          title={
                            bk.cargo_direction === 'IMPORT'
                              ? 'Thời gian hết hạn lệnh'
                              : 'Giờ cắt máng (Closing Time)'
                          }
                        >
                          <Clock className="w-3 h-3" />{' '}
                          {bk.cargo_direction === 'IMPORT' ? 'Hạn lệnh:' : 'Cắt máng:'}{' '}
                          {urgency.label}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditBookingModal(bk);
                          }}
                          className="p-1 text-slate-400 hover:text-maritime-600"
                          title="Sửa booking"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Xóa booking ${bk.booking_no}?`)) {
                              deleteBookingAction(bk.id).then(refresh);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600"
                          title="Xóa booking"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-1.5 text-xs font-medium text-slate-800">
                      {bk.resolved_customer_name || bk.customer_name || 'Khách hàng'}
                    </div>

                    <div className="mt-1 flex items-center gap-1.5 text-xs text-maritime-700 font-semibold">
                      <span>{bk.resolved_origin_name || bk.origin_name || 'POL'}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span>{bk.resolved_dest_name || bk.dest_name || 'POD'}</span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="text-slate-600">
                        20E: <b>{bk.cont_20e}</b> • 20F: <b>{bk.cont_20f}</b> • 40E:{' '}
                        <b>{bk.cont_40e}</b> • 40F: <b>{bk.cont_40f}</b>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-navy-900 text-white font-bold">
                        {bk.total_teus} TEU
                      </span>
                    </div>

                    {bk.notes && (
                      <div className="mt-1.5 text-[11px] text-slate-500 italic">{bk.notes}</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* CENTER COLUMN: Barges by Status (Drop / 1-Touch Assign Targets) */}
        <div className={`${mapVessel ? 'lg:col-span-5' : 'lg:col-span-8'} space-y-3`}>
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-bold text-sm text-slate-900">
                2. Đội Sà lan theo trạng thái ({groupedVessels.length}/{vessels.length} tàu)
              </h2>
              <p className="text-[11px] text-slate-500">
                {selectedBookings.length > 0
                  ? `Đang chọn ${selectedBookings.length} booking (${selectedTeus} TEUs) — bấm "Ghép vào tàu này" để tạo/ghép chuyến ngay`
                  : 'Chọn Booking ở cột trái để ghép 1 chạm, hoặc bấm Chi tiết Cont / Vị trí AIS trên từng tàu'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {vessels.some((v) => (v as any).is_vendor_barge) && (
                <button
                  type="button"
                  onClick={() => setShowVendorBarges((s) => !s)}
                  className={`text-xs px-2.5 py-1 rounded border ${
                    showVendorBarges
                      ? 'bg-navy-900 text-white border-navy-900'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {showVendorBarges ? 'Ẩn tàu thuê ngoài' : `+ Tàu thuê ngoài (${vessels.length})`}
                </button>
              )}
              {selectedBookings.length > 0 && (
                <button
                  onClick={() => setSelectedBookingIds([])}
                  className="text-xs px-2.5 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Bỏ chọn ({selectedBookings.length})
                </button>
              )}
            </div>
          </div>

          <div
            className={`grid grid-cols-1 ${mapVessel ? 'xl:grid-cols-1' : 'md:grid-cols-2'} gap-3`}
          >
            {groupedVessels.map((v) => {
              const activeVy = activeVoyageByVessel.get(v.id);
              const attachedBookings = activeVy
                ? bookings.filter((b) => b.voyage_id === activeVy.id)
                : [];
              const dragFallbackTeus =
                selectedBookings.length === 0 && draggedBookingId
                  ? Number(pendingBookings.find((b) => b.id === draggedBookingId)?.total_teus || 0)
                  : selectedTeus;
              const canAssign = selectedBookings.length > 0 || draggedBookingId !== null;
              const maxTeu = Number(v.capacity_teu || 0);
              const canAttachPlanned = Boolean(activeVy && activeVy.status === 'PLANNED');
              const projectedAttachTeus = Number(activeVy?.total_teus || 0) + dragFallbackTeus;
              const overAttach = canAssign && canAttachPlanned && projectedAttachTeus > maxTeu;
              const overNew = canAssign && dragFallbackTeus > maxTeu;

              const currentStep = Number(activeVy?.workflow_step || 0);
              const stepLabel =
                currentStep > 0
                  ? CAPTAIN_STEPS.find((s) => s.step === currentStep)?.shortTitle || `Bước ${currentStep}/5`
                  : 'Chưa nhận lệnh';

              return (
                <div
                  key={v.id}
                  onDragOver={(e) => {
                    if (canAssign) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (canAssign) handleAssignToBarge(v, canAttachPlanned);
                  }}
                  className={`bg-white rounded-xl border p-4 shadow-sm transition-all space-y-3 ${
                    overNew && (!canAttachPlanned || overAttach)
                      ? 'border-rose-300 bg-rose-50/30'
                      : canAssign
                        ? 'border-indigo-300 ring-1 ring-indigo-100 hover:border-indigo-500'
                        : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Ship className="w-4 h-4 text-maritime-600" />
                        <span className="font-bold text-slate-900">{v.name}</span>
                        <span className="text-[11px] font-mono text-slate-500">{v.code}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Sức chở: <b>{maxTeu} TEU</b> ({v.capacity_tons}T) •{' '}
                        <Fuel className="w-3 h-3 inline text-emerald-600" /> Dầu:{' '}
                        <b>{Number(v.current_fuel_liters || 0).toLocaleString('vi-VN')} L</b>
                      </div>
                    </div>
                    {bargeStageBadge(v, activeVy)}
                  </div>

                  {/* Overload Warning Banner when Bookings are selected */}
                  {canAssign && (overAttach || overNew) && (
                    <div className="rounded-lg bg-rose-50 border border-rose-300 px-2.5 py-2 text-[11px] text-rose-800 font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      {canAttachPlanned && overAttach ? (
                        <span>
                          Vượt sức chở ghép thêm ({projectedAttachTeus} / {maxTeu} TEU) — Không thể ghép vào{' '}
                          {activeVy?.voyage_no}
                        </span>
                      ) : (
                        <span>
                          Vượt sức chở sà lan ({dragFallbackTeus} / {maxTeu} TEU) — Không thể tạo chuyến mới
                        </span>
                      )}
                    </div>
                  )}

                  {/* Active Voyage Box (Clickable -> opens Voyage Overview & TEU Breakdown Popup) */}
                  {activeVy ? (
                    <div
                      onClick={() => setOverviewVoyageId(activeVy.id)}
                      className="rounded-lg bg-slate-50 border border-slate-200 hover:border-maritime-400 hover:bg-sky-50/40 cursor-pointer transition-colors p-2.5 space-y-2 text-xs"
                      title="Bấm để mở popup tổng thể chuyến & thêm/bớt số TEU từng booking"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-navy-900 underline decoration-dotted">
                          {activeVy.voyage_no}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-medium text-maritime-700 bg-sky-100 px-1.5 py-0.5 rounded">
                            Xem tổng thể
                          </span>
                          <StatusBadge status={activeVy.status} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="font-medium">
                          {activeVy.origin_name || '—'} → {activeVy.dest_name || '—'}
                        </span>
                        <span
                          className={`font-bold ${
                            Number(activeVy.total_teus || 0) > maxTeu ? 'text-rose-700' : 'text-maritime-700'
                          }`}
                        >
                          {activeVy.total_teus || 0} / {maxTeu} TEUs
                        </span>
                      </div>

                      {/* Linked Bookings List with Individual Unassign */}
                      {attachedBookings.length > 0 ? (
                        <div
                          className="flex flex-wrap gap-1.5 pt-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {attachedBookings.map((ab) => (
                            <span
                              key={ab.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-[11px] text-indigo-800 font-medium"
                            >
                              <span>
                                {ab.booking_no} ({ab.total_teus}T)
                              </span>
                              {activeVy.status === 'PLANNED' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnassignBooking(ab);
                                  }}
                                  className="ml-0.5 text-rose-500 hover:text-rose-700 font-bold"
                                  title={`Bớt booking ${ab.booking_no} trả về hàng chờ`}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : activeVy.booking_nos ? (
                        <div className="text-[11px] text-indigo-700 font-medium">
                          Bookings: {activeVy.booking_nos}
                        </div>
                      ) : null}

                      {/* Manage PLANNED Voyage: Edit or Release back to Pending */}
                      {activeVy.status === 'PLANNED' && (
                        <div
                          className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleOpenEditVoyageModal(activeVy)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-300 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                          >
                            <Pencil className="w-3 h-3 text-maritime-600" /> Sửa chuyến
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReleaseVoyage(activeVy)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-50 border border-amber-300 text-[11px] font-medium text-amber-800 hover:bg-amber-100"
                          >
                            <RotateCcw className="w-3 h-3" /> Nhả về chờ
                          </button>
                        </div>
                      )}

                      {/* 5-step progress */}
                      <div className="pt-1 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Thuyền trưởng: {stepLabel}</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((st) => (
                            <span
                              key={st}
                              className={`w-4 h-1.5 rounded-full ${
                                currentStep >= st ? 'bg-emerald-500' : 'bg-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 p-2.5 text-xs text-slate-400 text-center">
                      Sà lan đang trống — sẵn sàng nhận Booking
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5">
                      {activeVy && (
                        <Link
                          href={`/dispatch?voyageId=${activeVy.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-medium hover:bg-indigo-100"
                        >
                          <ListChecks className="w-3.5 h-3.5" /> Chi tiết Cont (
                          {activeVy.detail_count || 0})
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => setMapVesselId(mapVesselId === v.id ? null : v.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
                          mapVesselId === v.id
                            ? 'bg-navy-900 text-white border-navy-900'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5" /> Vị trí AIS
                      </button>
                    </div>

                    {canAssign && v.status !== 'MAINTENANCE' && (
                      <div className="flex items-center gap-1.5">
                        {canAttachPlanned && activeVy ? (
                          <button
                            type="button"
                            disabled={overAttach}
                            onClick={() => handleAssignToBarge(v, true)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            + Ghép vào {activeVy.voyage_no}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={overNew}
                          onClick={() => handleAssignToBarge(v, false)}
                          className="px-3 py-1.5 rounded-lg bg-maritime-600 text-white text-xs font-semibold hover:bg-maritime-500 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {activeVy ? 'Tạo chuyến mới' : `Ghép ${dragFallbackTeus} TEU vào tàu`}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: On-Demand Collapsible AIS Map */}
        {mapVessel && (
          <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden sticky top-16">
            <div className="px-3.5 py-3 bg-navy-900 text-white flex items-center justify-between">
              <div>
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <Anchor className="w-3.5 h-3.5 text-sky-300" /> {mapVessel.name}
                </div>
                <div className="text-[11px] text-sky-200">
                  {mapVessel.current_speed_knots} kn • {Number(mapVessel.lat).toFixed(4)},{' '}
                  {Number(mapVessel.lng).toFixed(4)}
                </div>
              </div>
              <button
                onClick={() => setMapVesselId(null)}
                className="p-1 rounded hover:bg-white/10"
                title="Thu gọn bản đồ"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="h-[400px]">
              <MapView vessels={[mapVessel]} ports={ports} />
            </div>
          </div>
        )}
      </div>

      {/* Quick Create / Edit Booking Modal */}
      {showCreateBooking && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveBooking}
            className="bg-white rounded-xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b pb-2.5">
              <h3 className="font-bold text-lg text-slate-900">
                {editingBookingId ? 'Chỉnh sửa Booking' : 'Tiếp nhận Booking mới (Bước 1)'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowCreateBooking(false);
                  setEditingBookingId(null);
                }}
                className="p-1 rounded hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Export vs Import Toggle */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl text-sm">
              <button
                type="button"
                onClick={() => setBookingForm({ ...bookingForm, cargo_direction: 'EXPORT' })}
                className={`py-2 rounded-lg font-semibold transition-colors ${
                  bookingForm.cargo_direction === 'EXPORT'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hàng Xuất (Cắt máng)
              </button>
              <button
                type="button"
                onClick={() => setBookingForm({ ...bookingForm, cargo_direction: 'IMPORT' })}
                className={`py-2 rounded-lg font-semibold transition-colors ${
                  bookingForm.cargo_direction === 'IMPORT'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hàng Nhập (Hạn lệnh)
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="text-xs font-medium text-slate-600">Số Booking</label>
                <input
                  required
                  className="w-full border rounded-lg px-3 py-2 mt-1 uppercase font-semibold"
                  value={bookingForm.booking_no}
                  onChange={(e) => setBookingForm({ ...bookingForm, booking_no: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">
                  {bookingForm.cargo_direction === 'IMPORT'
                    ? 'Thời gian hết hạn lệnh'
                    : 'Giờ cắt máng (Closing Time)'}
                </label>
                <input
                  type="datetime-local"
                  required
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  value={bookingForm.closing_time}
                  onChange={(e) => setBookingForm({ ...bookingForm, closing_time: e.target.value })}
                />
              </div>
            </div>

            <div className="text-sm">
              <label className="text-xs font-medium text-slate-600">Khách hàng / Chủ hàng</label>
              <select
                className="w-full border rounded-lg px-3 py-2 mt-1"
                value={bookingForm.customer_id}
                onChange={(e) => setBookingForm({ ...bookingForm, customer_id: e.target.value })}
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="text-xs font-medium text-slate-600">Cảng nhận (POL)</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  value={bookingForm.origin_port_id}
                  onChange={(e) =>
                    setBookingForm({ ...bookingForm, origin_port_id: e.target.value })
                  }
                >
                  {ports.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Cảng trả (POD)</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  value={bookingForm.destination_port_id}
                  onChange={(e) =>
                    setBookingForm({ ...bookingForm, destination_port_id: e.target.value })
                  }
                >
                  {ports.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-slate-50 border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Số lượng Container (20E / 20F / 40E / 40F)</span>
                <span className="text-rose-700">
                  Tổng:{' '}
                  {bookingForm.cont_20e +
                    bookingForm.cont_20f +
                    (bookingForm.cont_40e + bookingForm.cont_40f) * 2}{' '}
                  TEUs
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                {(['cont_20e', 'cont_20f', 'cont_40e', 'cont_40f'] as const).map((k) => (
                  <div key={k}>
                    <label className="text-[11px] text-slate-500 uppercase">
                      {k.replace('cont_', '')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="w-full border rounded px-2 py-1.5 mt-0.5 bg-white text-center font-bold"
                      value={bookingForm[k]}
                      onChange={(e) =>
                        setBookingForm({ ...bookingForm, [k]: Number(e.target.value) })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="text-xs font-medium text-slate-600">Cước dự kiến (VNĐ)</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  value={bookingForm.estimated_freight}
                  onChange={(e) =>
                    setBookingForm({ ...bookingForm, estimated_freight: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Ghi chú</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  placeholder="Ưu tiên hạ bãi / cont lạnh..."
                  value={bookingForm.notes}
                  onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => {
                  setShowCreateBooking(false);
                  setEditingBookingId(null);
                }}
                className="px-4 py-2 rounded-lg border text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-maritime-600 text-white text-sm font-medium hover:bg-maritime-500"
              >
                {editingBookingId ? 'Lưu thay đổi Booking' : 'Lưu Booking vào hàng chờ'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Planned Voyage Modal */}
      {editingVoyage && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveVoyageEdit}
            className="bg-white rounded-xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b pb-2.5">
              <h3 className="font-bold text-lg text-slate-900">
                Chỉnh sửa chuyến đang gom: {editingVoyage.voyage_no}
              </h3>
              <button
                type="button"
                onClick={() => setEditingVoyage(null)}
                className="p-1 rounded hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="text-xs font-medium text-slate-600">Số chuyến</label>
                <input
                  required
                  className="w-full border rounded-lg px-3 py-2 mt-1 font-semibold uppercase"
                  value={voyageEditForm.voyage_no}
                  onChange={(e) =>
                    setVoyageEditForm({ ...voyageEditForm, voyage_no: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">PIC điều độ</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  value={voyageEditForm.pic_name}
                  onChange={(e) =>
                    setVoyageEditForm({ ...voyageEditForm, pic_name: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="text-sm">
              <label className="text-xs font-medium text-slate-600">Sà lan thực hiện</label>
              <select
                className="w-full border rounded-lg px-3 py-2 mt-1"
                value={voyageEditForm.vessel_id}
                onChange={(e) =>
                  setVoyageEditForm({ ...voyageEditForm, vessel_id: e.target.value })
                }
              >
                {vessels.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.code}) — Sức chở tối đa {v.capacity_teu || 0} TEU
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="text-xs font-medium text-slate-600">Cảng đi (POL)</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  value={voyageEditForm.origin_port_id}
                  onChange={(e) =>
                    setVoyageEditForm({ ...voyageEditForm, origin_port_id: e.target.value })
                  }
                >
                  {ports.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Cảng đến (POD)</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  value={voyageEditForm.destination_port_id}
                  onChange={(e) =>
                    setVoyageEditForm({ ...voyageEditForm, destination_port_id: e.target.value })
                  }
                >
                  {ports.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-slate-50 border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Sản lượng Cont</span>
                <span className="text-rose-700">
                  Tổng:{' '}
                  {voyageEditForm.cont_20e +
                    voyageEditForm.cont_20f +
                    (voyageEditForm.cont_40e + voyageEditForm.cont_40f) * 2}{' '}
                  / {vessels.find((v) => v.id === voyageEditForm.vessel_id)?.capacity_teu || 0} TEUs
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                {(['cont_20e', 'cont_20f', 'cont_40e', 'cont_40f'] as const).map((k) => (
                  <div key={k}>
                    <label className="text-[11px] text-slate-500 uppercase">
                      {k.replace('cont_', '')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="w-full border rounded px-2 py-1.5 mt-0.5 bg-white text-center font-bold"
                      value={voyageEditForm[k]}
                      onChange={(e) =>
                        setVoyageEditForm({ ...voyageEditForm, [k]: Number(e.target.value) })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="text-sm">
              <label className="text-xs font-medium text-slate-600">Ghi chú chuyến</label>
              <input
                className="w-full border rounded-lg px-3 py-2 mt-1"
                value={voyageEditForm.captain_notes}
                onChange={(e) =>
                  setVoyageEditForm({ ...voyageEditForm, captain_notes: e.target.value })
                }
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setEditingVoyage(null)}
                className="px-4 py-2 rounded-lg border text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-maritime-600 text-white text-sm font-medium hover:bg-maritime-500"
              >
                Lưu chỉnh sửa chuyến
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Voyage Overview & Inline Booking TEU Adjustment Popup */}
      {(() => {
        const overviewVoyage = voyages.find((vy) => vy.id === overviewVoyageId);
        if (!overviewVoyage) return null;
        const overviewVessel = vessels.find((v) => v.id === overviewVoyage.vessel_id) || null;
        return (
          <VoyageOverviewModal
            voyage={overviewVoyage}
            vessel={overviewVessel}
            allBookings={bookings}
            onClose={() => setOverviewVoyageId(null)}
            onChanged={refresh}
          />
        );
      })()}
    </div>
  );
}
