import { API_URL, FuelLog, MaintenanceOrder, Vessel, Voyage } from './api';

export interface CaptainAccountUser {
  id: string;
  username: string;
  full_name: string;
  vessel_code: string;
  role: string;
}

export interface CaptainSession {
  token: string;
  captain: CaptainAccountUser;
  vessel?: Vessel | null;
}

export interface CaptainWorkspace {
  captain: CaptainAccountUser;
  vessel: Vessel;
  voyages: Voyage[];
  fuelLogs: FuelLog[];
  maintenanceOrders: MaintenanceOrder[];
}

const CAPTAIN_SESSION_KEY = 'vietsun_captain_session_v1';
const LEGACY_VESSEL_KEY = 'vietsun_mobile_selected_vessel_v1';
export const CAPTAIN_SESSION_EVENT = 'vietsun_captain_session_changed';

function emitSessionChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CAPTAIN_SESSION_EVENT));
  }
}

export function getCaptainSession(): CaptainSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CAPTAIN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CaptainSession;
    if (!parsed?.token || !parsed?.captain?.vessel_code) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setCaptainSession(session: CaptainSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CAPTAIN_SESSION_KEY, JSON.stringify(session));
    window.localStorage.removeItem(LEGACY_VESSEL_KEY);
    emitSessionChanged();
  } catch {
    // ignore storage errors
  }
}

export function clearCaptainSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CAPTAIN_SESSION_KEY);
    window.localStorage.removeItem(LEGACY_VESSEL_KEY);
    emitSessionChanged();
  } catch {
    // ignore storage errors
  }
}

export function captainAuthHeaders(): Record<string, string> {
  const session = getCaptainSession();
  if (!session?.token) return {};
  return { Authorization: `Bearer ${session.token}` };
}

export async function loginCaptain(username: string, password: string): Promise<CaptainSession> {
  const res = await fetch(`${API_URL}/mobile/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại.');
  }
  const session: CaptainSession = {
    token: data.token,
    captain: data.captain,
    vessel: data.vessel ?? null,
  };
  setCaptainSession(session);
  return session;
}

export async function fetchCaptainWorkspace(): Promise<CaptainWorkspace> {
  const session = getCaptainSession();
  if (!session?.token) {
    throw new Error('UNAUTHENTICATED');
  }
  const res = await fetch(`${API_URL}/mobile/workspace`, {
    headers: {
      ...captainAuthHeaders(),
    },
    cache: 'no-store',
  });
  if (res.status === 401 || res.status === 403) {
    clearCaptainSession();
    throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || `Không thể tải dữ liệu (${res.status})`);
  }
  return (await res.json()) as CaptainWorkspace;
}

export async function reportCaptainFuel(payload: {
  vessel_id?: string;
  voyage_id?: string;
  log_type: 'BUNKERING' | 'CONSUMPTION' | 'ROB';
  quantity_liters: number;
  unit_price_vnd?: number;
  engine_hours?: number;
  location_name?: string;
  reported_by?: string;
  notes?: string;
}) {
  const res = await fetch(`${API_URL}/mobile/fuel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...captainAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    clearCaptainSession();
    throw new Error('Phiên đăng nhập đã hết hạn.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || `Lỗi gửi báo cáo dầu (${res.status})`);
  }
  return res.json();
}

export async function reportCaptainMaintenance(payload: {
  vessel_id?: string;
  title: string;
  maintenance_type: 'CORRECTIVE' | 'PREVENTIVE' | 'INSPECTION';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reported_by?: string;
  description?: string;
}) {
  const res = await fetch(`${API_URL}/mobile/maintenance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...captainAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    clearCaptainSession();
    throw new Error('Phiên đăng nhập đã hết hạn.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || `Lỗi gửi phiếu bảo trì (${res.status})`);
  }
  return res.json();
}

export async function reportCaptainCheckIn(payload: {
  vessel_id?: string;
  voyage_id?: string;
  lat: number;
  lng: number;
  action: 'DEPART' | 'ARRIVE' | 'CHECKPOINT';
  notes?: string;
}) {
  const res = await fetch(`${API_URL}/mobile/checkin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...captainAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    clearCaptainSession();
    throw new Error('Phiên đăng nhập đã hết hạn.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || `Lỗi Check-in GPS (${res.status})`);
  }
  return res.json();
}
