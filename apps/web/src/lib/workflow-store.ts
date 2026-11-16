'use client';

import {
  API_URL,
  FALLBACK_CUSTOMERS,
  FALLBACK_PORTS,
  FALLBACK_VESSELS,
  FALLBACK_VOYAGES,
  fetchApi,
  type Booking,
  type CaptainReportEntry,
  type Customer,
  type Port,
  type Vessel,
  type Voyage,
} from '@/lib/api';

const LOCAL_BOOKINGS_KEY = 'vietsun_tms_local_bookings_v2';
const LOCAL_VOYAGE_PATCHES_KEY = 'vietsun_tms_local_voyage_patches_v2';
const LOCAL_EXTRA_VOYAGES_KEY = 'vietsun_tms_local_extra_voyages_v2';
const MOBILE_OFFLINE_QUEUE_KEY = 'vietsun_mobile_offline_queue_v1';

export interface OfflineCaptainQueueItem {
  queueId: string;
  vessel_id: string;
  vessel_name?: string;
  voyage_id: string;
  voyage_no?: string;
  step: 1 | 2 | 3 | 4 | 5;
  lat?: number;
  lng?: number;
  fuel_start_liters?: number;
  fuel_added_liters?: number;
  fuel_end_liters?: number;
  fuel_start_photo_url?: string;
  fuel_end_photo_url?: string;
  pod_photo_url?: string;
  notes?: string;
  timestamp: string;
}

export const CAPTAIN_STEPS: {
  step: 1 | 2 | 3 | 4 | 5;
  title: string;
  shortTitle: string;
  desc: string;
}[] = [
  {
    step: 1,
    title: '1. Nhận lệnh & Chốt dầu đầu',
    shortTitle: 'Nhận lệnh & Dầu đầu',
    desc: 'Xác nhận lệnh chuyến, nhập tồn dầu đầu (L) & chụp ảnh thước dầu',
  },
  {
    step: 2,
    title: '2. Làm hàng / Xếp xong Cont',
    shortTitle: 'Xếp xong hàng',
    desc: 'Xác nhận sà lan đã bốc/xếp đủ container lên boong',
  },
  {
    step: 3,
    title: '3. Rời bến (ATD)',
    shortTitle: 'Rời bến (ATD)',
    desc: 'Ghi nhận giờ rời cảng đi thực tế & bật theo dõi AIS',
  },
  {
    step: 4,
    title: '4. Cập cảng đích (ATA)',
    shortTitle: 'Cập cảng (ATA)',
    desc: 'Ghi nhận giờ cập cảng đến & bắt đầu tính giờ Laytime',
  },
  {
    step: 5,
    title: '5. Dỡ xong & Chốt POD / Dầu cuối',
    shortTitle: 'Hoàn thành & POD',
    desc: 'Chụp biên bản giao nhận (POD), chốt tồn dầu cuối & đẩy sang Quyết toán',
  },
];

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, val: unknown) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // Ignore storage quota errors
  }
}

function seedLocalBookingsIfEmpty(): Booking[] {
  const existing = readJson<Booking[] | null>(LOCAL_BOOKINGS_KEY, null);
  if (existing !== null) return existing;

  const now = Date.now();
  const seeded: Booking[] = [
    {
      id: 'bk-seed-1',
      booking_no: 'BK-MSC-26011',
      customer_name: 'Phước Tạo Logistics',
      origin_name: 'SPITC',
      dest_name: 'TRÀ NÓC',
      cont_20e: 8,
      cont_20f: 4,
      cont_40e: 0,
      cont_40f: 2,
      total_teus: 16,
      closing_time: new Date(now + 4.5 * 3600 * 1000).toISOString(),
      voyage_id: null,
      status: 'PENDING',
      estimated_freight: 14500000,
      notes: 'Ưu tiên cắt máng tàu mẹ MSC tại SPITC',
    },
    {
      id: 'bk-seed-2',
      booking_no: 'BK-ONE-88240',
      customer_name: 'LINES HO',
      origin_name: 'BẾN NGHÉ',
      dest_name: 'TCCC',
      cont_20e: 0,
      cont_20f: 6,
      cont_40e: 0,
      cont_40f: 3,
      total_teus: 12,
      closing_time: new Date(now + 10 * 3600 * 1000).toISOString(),
      voyage_id: null,
      status: 'PENDING',
      estimated_freight: 13800000,
      notes: 'Cont lạnh kiểm tra seal khi nhận',
    },
    {
      id: 'bk-seed-3',
      booking_no: 'BK-CMA-55102',
      customer_name: 'ĐA PHƯƠNG THỨC VSHO',
      origin_name: 'TÂN CẢNG CÁT LÁI',
      dest_name: 'CÁI MÉP (CMIT)',
      cont_20e: 4,
      cont_20f: 6,
      cont_40e: 2,
      cont_40f: 4,
      total_teus: 22,
      closing_time: new Date(now + 28 * 3600 * 1000).toISOString(),
      voyage_id: null,
      status: 'PENDING',
      estimated_freight: 21400000,
      notes: 'Có thể ghép chung sà lan tuyến Cái Mép',
    },
  ];
  writeJson(LOCAL_BOOKINGS_KEY, seeded);
  return seeded;
}

export function getClosingUrgency(closingTime?: string): {
  level: 'OVERDUE' | 'URGENT' | 'SOON' | 'NORMAL' | 'NONE';
  label: string;
  hoursLeft: number | null;
} {
  if (!closingTime) return { level: 'NONE', label: 'Chưa đặt', hoursLeft: null };
  const diffMs = new Date(closingTime).getTime() - Date.now();
  const hours = diffMs / 3600000;
  if (hours <= 0) {
    return { level: 'OVERDUE', label: `Quá hạn ${Math.abs(Math.round(hours))}h`, hoursLeft: hours };
  }
  if (hours <= 12) {
    return { level: 'URGENT', label: `Còn ${hours.toFixed(1)}h (Gấp)`, hoursLeft: hours };
  }
  if (hours <= 24) {
    return { level: 'SOON', label: `Còn ${Math.round(hours)}h`, hoursLeft: hours };
  }
  return { level: 'NORMAL', label: `Còn ${Math.round(hours / 24)} ngày`, hoursLeft: hours };
}

export function computeVoyagePnl(vy: Voyage) {
  const detailRev = Number(vy.detail_revenue || 0);
  const estFreight = Number(vy.estimated_freight || 0);
  const fallbackEst = Number(vy.total_teus || 0) * 750000;
  const revenue = detailRev > 0 ? detailRev : estFreight > 0 ? estFreight : fallbackEst;
  const isEstimatedRevenue = detailRev <= 0;

  const fuelStart = Number(vy.fuel_start_liters || 0);
  const fuelAdded = Number(vy.fuel_added_liters || 0);
  const fuelEnd = Number(vy.fuel_end_liters || 0);
  const fuelConsumed = Math.max(0, fuelStart + fuelAdded - fuelEnd);
  const fuelUnitPrice = Number(vy.fuel_unit_price || 21500);
  const fuelCost = fuelConsumed * fuelUnitPrice;

  const portFee = Number(vy.port_fee || 0);
  const crewSalary = Number(vy.crew_salary || 0);
  const otherCost = Number(vy.other_cost || 0);
  const totalCost = fuelCost + portFee + crewSalary + otherCost;
  const netProfit = revenue - totalCost;

  return {
    revenue,
    isEstimatedRevenue,
    fuelStart,
    fuelAdded,
    fuelEnd,
    fuelConsumed,
    fuelUnitPrice,
    fuelCost,
    portFee,
    crewSalary,
    otherCost,
    totalCost,
    netProfit,
  };
}

export interface WorkflowSnapshot {
  vessels: Vessel[];
  ports: Port[];
  customers: Customer[];
  voyages: (Voyage & { estimated_freight?: number })[];
  bookings: Booking[];
  backendHasWorkflowApi: boolean;
}

export async function loadWorkflowSnapshot(): Promise<WorkflowSnapshot> {
  const [vRes, pRes, cRes, vyRes] = await Promise.all([
    fetchApi<Vessel[]>('/fleet/vessels', FALLBACK_VESSELS),
    fetchApi<Port[]>('/dispatch/ports', FALLBACK_PORTS),
    fetchApi<Customer[]>('/orders/customers', FALLBACK_CUSTOMERS),
    fetchApi<Voyage[]>('/dispatch/voyages', FALLBACK_VOYAGES),
  ]);

  let bookings: Booking[] = [];
  let backendHasWorkflowApi = false;
  try {
    const bRes = await fetch(`${API_URL}/dispatch/bookings`, { cache: 'no-store' });
    if (bRes.ok) {
      bookings = await bRes.json();
      backendHasWorkflowApi = true;
    } else {
      bookings = seedLocalBookingsIfEmpty();
    }
  } catch {
    bookings = seedLocalBookingsIfEmpty();
  }

  const localExtras = backendHasWorkflowApi
    ? []
    : readJson<(Voyage & { estimated_freight?: number })[]>(LOCAL_EXTRA_VOYAGES_KEY, []);
  const localPatches = backendHasWorkflowApi
    ? {}
    : readJson<Record<string, Partial<Voyage>>>(LOCAL_VOYAGE_PATCHES_KEY, {});

  if (backendHasWorkflowApi && typeof window !== 'undefined') {
    localStorage.removeItem(LOCAL_EXTRA_VOYAGES_KEY);
    localStorage.removeItem(LOCAL_VOYAGE_PATCHES_KEY);
  }

  // Merge bookings freight estimate into voyages when working locally
  const mergedVoyages = [...localExtras, ...vyRes.data].map((vy) => {
    const patch = localPatches[vy.id] || {};
    const linkedBookings = bookings.filter((b) => b.voyage_id === vy.id);
    const bookingEst = linkedBookings.reduce((s, b) => s + Number(b.estimated_freight || 0), 0);
    const earliestClosing =
      linkedBookings
        .map((b) => b.closing_time)
        .filter(Boolean)
        .sort()[0] || vy.earliest_closing_time;
    const bookingNos =
      linkedBookings.length > 0
        ? linkedBookings.map((b) => b.booking_no).join(', ')
        : vy.booking_nos;

    return {
      ...vy,
      ...patch,
      booking_nos: bookingNos,
      earliest_closing_time: earliestClosing,
      estimated_freight: bookingEst,
    };
  });

  return {
    vessels: vRes.data,
    ports: pRes.data,
    customers: cRes.data,
    voyages: mergedVoyages,
    bookings,
    backendHasWorkflowApi,
  };
}

export async function createBookingAction(dto: Partial<Booking>): Promise<Booking> {
  const c20e = Number(dto.cont_20e || 0);
  const c20f = Number(dto.cont_20f || 0);
  const c40e = Number(dto.cont_40e || 0);
  const c40f = Number(dto.cont_40f || 0);
  const total_teus = c20e + c20f + (c40e + c40f) * 2;

  try {
    const res = await fetch(`${API_URL}/dispatch/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (res.ok) return (await res.json()) as Booking;
  } catch {
    // Fallback to local store
  }

  const created: Booking = {
    id: `bk-local-${Date.now()}`,
    booking_no: (dto.booking_no || `BK-${Date.now().toString().slice(-5)}`).toUpperCase(),
    cargo_direction: dto.cargo_direction === 'IMPORT' ? 'IMPORT' : 'EXPORT',
    customer_id: dto.customer_id,
    customer_name: dto.customer_name || 'Khách hàng',
    origin_port_id: dto.origin_port_id,
    origin_name: dto.origin_name || 'SPITC',
    destination_port_id: dto.destination_port_id,
    dest_name: dto.dest_name || 'TRÀ NÓC',
    cont_20e: c20e,
    cont_20f: c20f,
    cont_40e: c40e,
    cont_40f: c40f,
    total_teus,
    closing_time: dto.closing_time,
    voyage_id: null,
    status: 'PENDING',
    estimated_freight: Number(dto.estimated_freight || 0),
    notes: dto.notes,
    created_at: new Date().toISOString(),
  };
  const current = seedLocalBookingsIfEmpty();
  writeJson(LOCAL_BOOKINGS_KEY, [created, ...current]);
  return created;
}

export async function updateBookingAction(
  id: string,
  dto: Partial<Booking>,
): Promise<Booking> {
  const c20e = Number(dto.cont_20e || 0);
  const c20f = Number(dto.cont_20f || 0);
  const c40e = Number(dto.cont_40e || 0);
  const c40f = Number(dto.cont_40f || 0);
  const total_teus = c20e + c20f + (c40e + c40f) * 2;

  try {
    const res = await fetch(`${API_URL}/dispatch/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (res.ok) return (await res.json()) as Booking;
    if (!id.startsWith('bk-')) {
      alert(
        `Không thể lưu thay đổi lên Server API (${res.status}). Hãy cập nhật API mới nhất trên VPS để dùng tính năng Sửa Booking & Hàng Xuất/Nhập.`,
      );
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    if (!id.startsWith('bk-')) throw err;
  }

  let updatedRow: Booking | null = null;
  const updatedList = seedLocalBookingsIfEmpty().map((b) => {
    if (b.id !== id) return b;
    updatedRow = {
      ...b,
      booking_no: (dto.booking_no || b.booking_no).toUpperCase(),
      cargo_direction: dto.cargo_direction === 'IMPORT' ? 'IMPORT' : 'EXPORT',
      customer_id: dto.customer_id,
      customer_name: dto.customer_name ?? b.customer_name,
      origin_port_id: dto.origin_port_id,
      origin_name: dto.origin_name ?? b.origin_name,
      destination_port_id: dto.destination_port_id,
      dest_name: dto.dest_name ?? b.dest_name,
      cont_20e: c20e,
      cont_20f: c20f,
      cont_40e: c40e,
      cont_40f: c40f,
      total_teus,
      closing_time: dto.closing_time,
      estimated_freight: Number(dto.estimated_freight ?? b.estimated_freight ?? 0),
      notes: dto.notes ?? b.notes,
    };
    return updatedRow;
  });
  writeJson(LOCAL_BOOKINGS_KEY, updatedList);
  return updatedRow || ({ id, ...dto } as Booking);
}

export async function deleteBookingAction(id: string): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/dispatch/bookings/${id}`, { method: 'DELETE' });
    if (res.ok) return;
  } catch {
    // Local fallback
  }
  const current = seedLocalBookingsIfEmpty().filter((b) => b.id !== id);
  writeJson(LOCAL_BOOKINGS_KEY, current);
}

export async function assignBookingsToBargeAction(params: {
  bookings: Booking[];
  vessel: Vessel;
  targetVoyage?: Voyage | null;
}): Promise<{ voyage_id: string }> {
  const sumTeus = params.bookings.reduce((s, b) => s + Number(b.total_teus || 0), 0);
  const existingTeus = params.targetVoyage ? Number(params.targetVoyage.total_teus || 0) : 0;
  const maxTeu = Number(params.vessel.capacity_teu || 0);
  const projectedTeus = existingTeus + sumTeus;
  if (projectedTeus > maxTeu) {
    throw new Error(
      `Vượt sức chở của sà lan ${params.vessel.name} (${projectedTeus} TEU > tối đa ${maxTeu} TEU). Không thể ghép!`,
    );
  }

  const bookingIds = params.bookings.map((b) => b.id);
  const res = await fetch(`${API_URL}/dispatch/bookings/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      booking_ids: bookingIds,
      vessel_id: params.vessel.id,
      voyage_id: params.targetVoyage?.id,
    }),
  });
  if (res.ok) {
    const data = await res.json();
    if (data?.voyage_id) return { voyage_id: data.voyage_id };
  }
  const errData = await res.json().catch(() => null);
  throw new Error(errData?.message || `Không thể ghép booking vào tàu (${res.status})`);
}

export async function unassignBookingAction(bookingId: string): Promise<void> {
  const res = await fetch(`${API_URL}/dispatch/bookings/${bookingId}/unassign`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message || `Không thể nhả booking (${res.status})`);
  }
}

export async function releaseVoyageAction(voyageId: string): Promise<void> {
  const res = await fetch(`${API_URL}/dispatch/voyages/${voyageId}/release`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message || `Không thể nhả chuyến về chế độ chờ (${res.status})`);
  }
}

export async function updateVoyageAction(voyageId: string, dto: Partial<Voyage>): Promise<void> {
  const res = await fetch(`${API_URL}/dispatch/voyages/${voyageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message || `Không thể cập nhật chuyến (${res.status})`);
  }
}

export function getOfflineCaptainQueue(): OfflineCaptainQueueItem[] {
  return readJson<OfflineCaptainQueueItem[]>(MOBILE_OFFLINE_QUEUE_KEY, []);
}

function applyCaptainStepLocally(item: Omit<OfflineCaptainQueueItem, 'queueId'>) {
  const patches = readJson<Record<string, Partial<Voyage>>>(LOCAL_VOYAGE_PATCHES_KEY, {});
  const existing = patches[item.voyage_id] || {};
  const logs: CaptainReportEntry[] = [
    ...((existing.captain_report_log as CaptainReportEntry[]) || []),
    {
      step: item.step,
      timestamp: item.timestamp,
      lat: item.lat ?? null,
      lng: item.lng ?? null,
      notes: item.notes ?? null,
    },
  ];
  const nextStatus: Voyage['status'] | undefined =
    item.step === 3
      ? 'IN_TRANSIT'
      : item.step === 4
        ? 'ARRIVED'
        : item.step === 5
          ? 'COMPLETED'
          : undefined;

  patches[item.voyage_id] = {
    ...existing,
    workflow_step: Math.max(Number(existing.workflow_step || 0), item.step),
    ...(nextStatus ? { status: nextStatus } : {}),
    ...(item.fuel_start_liters !== undefined ? { fuel_start_liters: item.fuel_start_liters } : {}),
    ...(item.fuel_added_liters !== undefined ? { fuel_added_liters: item.fuel_added_liters } : {}),
    ...(item.fuel_end_liters !== undefined ? { fuel_end_liters: item.fuel_end_liters } : {}),
    ...(item.fuel_start_photo_url ? { fuel_start_photo_url: item.fuel_start_photo_url } : {}),
    ...(item.fuel_end_photo_url ? { fuel_end_photo_url: item.fuel_end_photo_url } : {}),
    ...(item.pod_photo_url ? { pod_photo_url: item.pod_photo_url } : {}),
    ...(item.step === 2 ? { loading_completed_at: item.timestamp } : {}),
    ...(item.step === 3 ? { atd: item.timestamp } : {}),
    ...(item.step === 4 ? { ata: item.timestamp, laytime_start_at: item.timestamp } : {}),
    ...(item.step === 5 ? { completed_unloading_at: item.timestamp } : {}),
    captain_report_log: logs,
  };
  writeJson(LOCAL_VOYAGE_PATCHES_KEY, patches);
}

export async function submitCaptainStepAction(
  item: Omit<OfflineCaptainQueueItem, 'queueId'>,
  forceOffline = false,
): Promise<{ synced: boolean; queuedCount: number }> {
  applyCaptainStepLocally(item);

  const enqueue = () => {
    const queue = getOfflineCaptainQueue();
    queue.push({ ...item, queueId: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` });
    writeJson(MOBILE_OFFLINE_QUEUE_KEY, queue);
    return { synced: false, queuedCount: queue.length };
  };

  if (forceOffline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return enqueue();
  }

  try {
    const res = await fetch(`${API_URL}/mobile/step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (res.ok) {
      return { synced: true, queuedCount: getOfflineCaptainQueue().length };
    }
    return enqueue();
  } catch {
    return enqueue();
  }
}

export async function syncOfflineCaptainQueue(): Promise<{
  flushed: number;
  remaining: number;
}> {
  const queue = getOfflineCaptainQueue();
  if (queue.length === 0) return { flushed: 0, remaining: 0 };

  const remaining: OfflineCaptainQueueItem[] = [];
  let flushed = 0;
  for (const item of queue) {
    try {
      const res = await fetch(`${API_URL}/mobile/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (res.ok) {
        flushed++;
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }
  writeJson(MOBILE_OFFLINE_QUEUE_KEY, remaining);
  return { flushed, remaining: remaining.length };
}

export async function updateSettlementAction(
  voyageId: string,
  dto: {
    fuel_start_liters?: number;
    fuel_added_liters?: number;
    fuel_end_liters?: number;
    fuel_unit_price?: number;
    port_fee?: number;
    crew_salary?: number;
    other_cost?: number;
  },
) {
  const patches = readJson<Record<string, Partial<Voyage>>>(LOCAL_VOYAGE_PATCHES_KEY, {});
  patches[voyageId] = { ...(patches[voyageId] || {}), ...dto };
  writeJson(LOCAL_VOYAGE_PATCHES_KEY, patches);

  try {
    await fetch(`${API_URL}/dispatch/voyages/${voyageId}/settlement`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
  } catch {
    // Saved locally cleanly
  }
}

export async function compressImageToDataUrl(file: File, maxDim = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(String(reader.result));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.65));
      };
      img.onerror = () => resolve(String(reader.result));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
