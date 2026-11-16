export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? '/api'
    : 'http://localhost:4000/api');

export interface Vessel {
  id: string;
  code: string;
  name: string;
  registration_no: string;
  vessel_type: 'SELF_PROPELLED' | 'DUMB_BARGE' | 'TUGBOAT';
  capacity_tons: number;
  capacity_teu: number;
  main_engine_hp: number;
  fuel_norm_l_per_hour: number;
  status: 'AVAILABLE' | 'IN_VOYAGE' | 'MAINTENANCE' | 'IDLE';
  inspection_expiry?: string;
  lat: number;
  lng: number;
  current_speed_knots: number;
  current_fuel_liters: number;
  captain_name?: string;
  captain_phone?: string;
  nearby_port?: string | null;
}

export interface VesselEquipment {
  id: string;
  vessel_id: string;
  vessel_code?: string;
  vessel_name?: string;
  name: string;
  category: 'MAIN_ENGINE' | 'GENERATOR' | 'GPS_AIS' | 'WINCH' | 'CRANE';
  serial_no?: string;
  running_hours: number;
  next_service_hours?: number;
  status: 'OPERATIONAL' | 'WARNING' | 'FAULTY';
}

export interface Port {
  id: string;
  code: string;
  name: string;
  region: string;
  port_type: string;
  lat: number;
  lng: number;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  tax_code?: string;
  address?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
}

export interface Voyage {
  id: string;
  voyage_no: string;
  status: 'PLANNED' | 'DEPARTED' | 'IN_TRANSIT' | 'ARRIVED' | 'COMPLETED' | 'CANCELLED';
  etd: string;
  eta: string;
  planned_distance_nm: number;
  captain_notes?: string;
  received_date?: string;
  pic_name?: string;
  cont_20e?: number;
  cont_20f?: number;
  cont_40e?: number;
  cont_40f?: number;
  total_teus?: number;
  vessel_berth_date?: string;
  order_deadline?: string;
  customer_id?: string;
  customer_code?: string;
  customer_name?: string;
  vessel_id: string;
  vessel_code: string;
  vessel_name: string;
  captain_name?: string;
  order_no?: string;
  cargo_type?: string;
  cargo_weight_tons?: number;
  origin_port_id?: string;
  origin_code?: string;
  origin_name: string;
  origin_lat?: number;
  origin_lng?: number;
  destination_port_id?: string;
  dest_code?: string;
  dest_name: string;
  dest_lat?: number;
  dest_lng?: number;
  detail_count?: number;
  detail_teus?: number;
  detail_revenue?: number;
  workflow_step?: number;
  fuel_start_liters?: number;
  fuel_added_liters?: number;
  fuel_end_liters?: number;
  fuel_unit_price?: number;
  loading_completed_at?: string;
  atd?: string;
  ata?: string;
  laytime_start_at?: string;
  completed_unloading_at?: string;
  port_fee?: number;
  crew_salary?: number;
  other_cost?: number;
  pod_photo_url?: string;
  fuel_start_photo_url?: string;
  fuel_end_photo_url?: string;
  captain_report_log?: CaptainReportEntry[];
  booking_nos?: string;
  earliest_closing_time?: string;
  estimated_freight?: number;
  created_at?: string;
}

export interface CaptainReportEntry {
  step: number;
  timestamp: string;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
}

export interface Booking {
  id: string;
  booking_no: string;
  customer_id?: string;
  customer_name?: string;
  resolved_customer_name?: string;
  customer_code?: string;
  origin_port_id?: string;
  origin_name?: string;
  resolved_origin_name?: string;
  destination_port_id?: string;
  dest_name?: string;
  resolved_dest_name?: string;
  cont_20e: number;
  cont_20f: number;
  cont_40e: number;
  cont_40f: number;
  total_teus: number;
  closing_time?: string;
  voyage_id?: string | null;
  voyage_no?: string | null;
  status: 'PENDING' | 'ASSIGNED' | 'IN_TRANSIT' | 'COMPLETED';
  estimated_freight?: number;
  notes?: string;
  created_at?: string;
}

export type ContType = '20E' | '20F' | '40E' | '40F';

export interface VoyageContainer {
  id: string;
  voyage_id: string;
  barge_code?: string;
  trip_no?: string;
  container_no: string;
  seal_no?: string;
  booking_no?: string;
  origin_name?: string;
  destination_name?: string;
  shipper_name?: string;
  departure_date?: string;
  cont_type: ContType;
  unit_price: number;
  baf: number;
  total_amount: number;
  fuel_price_no_vat: number;
  notes?: string;
}

export interface Order {
  id: string;
  order_no: string;
  customer_name: string;
  cargo_type: string;
  cargo_weight_tons: number;
  container_count: number;
  origin_name: string;
  dest_name: string;
  unit_price: number;
  total_freight: number;
  surcharge: number;
  status: string;
}

export interface Invoice {
  id: string;
  invoice_no: string;
  order_no: string;
  customer_name: string;
  issue_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  payment_status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE';
}

export interface FuelLog {
  id: string;
  vessel_id: string;
  vessel_code: string;
  vessel_name: string;
  log_type: 'BUNKERING' | 'CONSUMPTION' | 'ROB';
  quantity_liters: number;
  unit_price_vnd: number;
  engine_hours?: number;
  reported_by?: string;
  location_name?: string;
  notes?: string;
  logged_at: string;
}

export interface MaintenanceOrder {
  id: string;
  ticket_no: string;
  vessel_id: string;
  vessel_code: string;
  vessel_name: string;
  title: string;
  maintenance_type: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_PARTS' | 'COMPLETED';
  estimated_cost: number;
  actual_cost: number;
  reported_by?: string;
  scheduled_date?: string;
  description?: string;
}

export async function fetchApi<T>(path: string, fallback: T, init?: RequestInit): Promise<{ data: T; live: boolean }> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as T;
    return { data, live: true };
  } catch {
    return { data: fallback, live: false };
  }
}

export const FALLBACK_PORTS: Port[] = [
  { id: '11111111-1111-1111-1111-111111111101', code: 'CATLAI', name: 'Cảng Tân Cảng Cát Lái', region: 'TP. Hồ Chí Minh', port_type: 'PORT', lat: 10.7615, lng: 106.7918 },
  { id: '11111111-1111-1111-1111-111111111102', code: 'CAIMEP', name: 'Cảng Quốc tế Cái Mép (CMIT)', region: 'Bà Rịa - Vũng Tàu', port_type: 'PORT', lat: 10.5284, lng: 107.0165 },
  { id: '11111111-1111-1111-1111-111111111103', code: 'CANTHO', name: 'Cảng Cái Cui - Cần Thơ', region: 'Cần Thơ', port_type: 'PORT', lat: 10.0028, lng: 105.8142 },
  { id: '11111111-1111-1111-1111-111111111104', code: 'MYTHO', name: 'Cảng Mỹ Tho', region: 'Tiền Giang', port_type: 'PORT', lat: 10.3540, lng: 106.3450 },
  { id: '11111111-1111-1111-1111-111111111106', code: 'LONGAN', name: 'Cảng Quốc tế Long An', region: 'Long An', port_type: 'PORT', lat: 10.5562, lng: 106.7368 },
];

export const FALLBACK_CUSTOMERS: Customer[] = [
  { id: '33333333-3333-3333-3333-333333333301', code: 'KH-TANHOA', name: 'Công ty CP Logistics Tân Hòa', contact_person: 'Chị Lan Anh', phone: '0901234567' },
  { id: '33333333-3333-3333-3333-333333333302', code: 'KH-MEKONGRICE', name: 'Tổng Công ty Lương thực Mekong', contact_person: 'Anh Hoàng', phone: '0918234567' },
  { id: '33333333-3333-3333-3333-333333333303', code: 'KH-INSEE', name: 'Công ty Xi măng Tây Nam', contact_person: 'Anh Dũng', phone: '0987654321' },
];

export const FALLBACK_VESSELS: Vessel[] = [
  {
    id: '22222222-2222-2222-2222-222222222201',
    code: 'VS-SL-01',
    name: 'Sà lan Việt Sun 01',
    registration_no: 'SG-6868',
    vessel_type: 'SELF_PROPELLED',
    capacity_tons: 2400,
    capacity_teu: 96,
    main_engine_hp: 1200,
    fuel_norm_l_per_hour: 62,
    status: 'IN_VOYAGE',
    inspection_expiry: '2027-05-15',
    lat: 10.6721,
    lng: 106.8542,
    current_speed_knots: 8.4,
    current_fuel_liters: 8450,
    captain_name: 'Nguyễn Văn Hùng',
    captain_phone: '0903112233',
    nearby_port: null,
  },
  {
    id: '22222222-2222-2222-2222-222222222202',
    code: 'VS-SL-02',
    name: 'Sà lan Việt Sun 02',
    registration_no: 'SG-7979',
    vessel_type: 'SELF_PROPELLED',
    capacity_tons: 3000,
    capacity_teu: 128,
    main_engine_hp: 1500,
    fuel_norm_l_per_hour: 75,
    status: 'IN_VOYAGE',
    inspection_expiry: '2027-08-10',
    lat: 10.3250,
    lng: 106.4120,
    current_speed_knots: 7.8,
    current_fuel_liters: 11200,
    captain_name: 'Trần Minh Tuấn',
    captain_phone: '0908445566',
    nearby_port: null,
  },
  {
    id: '22222222-2222-2222-2222-222222222203',
    code: 'VS-SL-03',
    name: 'Sà lan Việt Sun 03',
    registration_no: 'SG-5522',
    vessel_type: 'SELF_PROPELLED',
    capacity_tons: 1800,
    capacity_teu: 72,
    main_engine_hp: 900,
    fuel_norm_l_per_hour: 48,
    status: 'AVAILABLE',
    inspection_expiry: '2027-01-25',
    lat: 10.7615,
    lng: 106.7918,
    current_speed_knots: 0,
    current_fuel_liters: 5600,
    captain_name: 'Lê Hoàng Nam',
    captain_phone: '0913778899',
    nearby_port: 'Cảng Tân Cảng Cát Lái',
  },
  {
    id: '22222222-2222-2222-2222-222222222204',
    code: 'VS-SL-04',
    name: 'Sà lan Việt Sun 04 (Boong)',
    registration_no: 'SG-4411',
    vessel_type: 'DUMB_BARGE',
    capacity_tons: 1500,
    capacity_teu: 0,
    main_engine_hp: 0,
    fuel_norm_l_per_hour: 0,
    status: 'MAINTENANCE',
    inspection_expiry: '2026-12-10',
    lat: 10.5562,
    lng: 106.7368,
    current_speed_knots: 0,
    current_fuel_liters: 0,
    captain_name: 'Phạm Quốc Bảo',
    captain_phone: '0938223344',
    nearby_port: 'Cảng Quốc tế Long An',
  },
  {
    id: '22222222-2222-2222-2222-222222222205',
    code: 'VS-DK-01',
    name: 'Tàu kéo Việt Sun 01',
    registration_no: 'SG-9901',
    vessel_type: 'TUGBOAT',
    capacity_tons: 0,
    capacity_teu: 0,
    main_engine_hp: 1800,
    fuel_norm_l_per_hour: 82,
    status: 'AVAILABLE',
    inspection_expiry: '2027-09-30',
    lat: 10.5284,
    lng: 107.0165,
    current_speed_knots: 0,
    current_fuel_liters: 9800,
    captain_name: 'Võ Thành Long',
    captain_phone: '0909667788',
    nearby_port: 'Cảng Quốc tế Cái Mép (CMIT)',
  },
];

export const FALLBACK_VOYAGES: Voyage[] = [
  {
    id: '55555555-5555-5555-5555-555555555501',
    voyage_no: 'VOY-2026-0081',
    status: 'IN_TRANSIT',
    etd: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    eta: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
    planned_distance_nm: 38.5,
    captain_notes: 'Qua phao số 0 sông Lòng Tàu thuận lợi, nước ròng',
    vessel_id: '22222222-2222-2222-2222-222222222201',
    vessel_code: 'VS-SL-01',
    vessel_name: 'Sà lan Việt Sun 01',
    captain_name: 'Nguyễn Văn Hùng',
    order_no: 'ORD-2026-0101',
    cargo_type: 'Container 40ft (Hàng lạnh)',
    cargo_weight_tons: 1920,
    origin_name: 'Cảng Tân Cảng Cát Lái',
    origin_lat: 10.7615,
    origin_lng: 106.7918,
    dest_name: 'Cảng Quốc tế Cái Mép (CMIT)',
    dest_lat: 10.5284,
    dest_lng: 107.0165,
  },
  {
    id: '55555555-5555-5555-5555-555555555502',
    voyage_no: 'VOY-2026-0082',
    status: 'IN_TRANSIT',
    etd: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
    eta: new Date(Date.now() + 16 * 3600 * 1000).toISOString(),
    planned_distance_nm: 105.0,
    captain_notes: 'Đang qua khu vực kênh Chợ Gạo',
    vessel_id: '22222222-2222-2222-2222-222222222202',
    vessel_code: 'VS-SL-02',
    vessel_name: 'Sà lan Việt Sun 02',
    captain_name: 'Trần Minh Tuấn',
    order_no: 'ORD-2026-0102',
    cargo_type: 'Gạo xuất khẩu đóng bao',
    cargo_weight_tons: 2600,
    origin_name: 'Cảng Cái Cui - Cần Thơ',
    origin_lat: 10.0028,
    origin_lng: 105.8142,
    dest_name: 'Cảng Tân Cảng Cát Lái',
    dest_lat: 10.7615,
    dest_lng: 106.7918,
  },
  {
    id: '55555555-5555-5555-5555-555555555503',
    voyage_no: 'VOY-2026-0083',
    status: 'PLANNED',
    etd: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
    eta: new Date(Date.now() + 36 * 3600 * 1000).toISOString(),
    planned_distance_nm: 82.0,
    captain_notes: 'Chờ nhận lệnh xuất bến',
    vessel_id: '22222222-2222-2222-2222-222222222203',
    vessel_code: 'VS-SL-03',
    vessel_name: 'Sà lan Việt Sun 03',
    captain_name: 'Lê Hoàng Nam',
    order_no: 'ORD-2026-0103',
    cargo_type: 'Xi măng bao Jumbo',
    cargo_weight_tons: 1650,
    origin_name: 'Cảng Quốc tế Long An',
    origin_lat: 10.5562,
    origin_lng: 106.7368,
    dest_name: 'Cảng Bình Minh - Vĩnh Long',
    dest_lat: 10.0155,
    dest_lng: 105.8215,
  },
];

export const FALLBACK_ORDERS: Order[] = [
  {
    id: '44444444-4444-4444-4444-444444444401',
    order_no: 'ORD-2026-0101',
    customer_name: 'Công ty CP Logistics Tân Hòa',
    cargo_type: 'Container 40ft (Hàng lạnh)',
    cargo_weight_tons: 1920,
    container_count: 84,
    origin_name: 'Cảng Tân Cảng Cát Lái',
    dest_name: 'Cảng Quốc tế Cái Mép (CMIT)',
    unit_price: 95000,
    total_freight: 182400000,
    surcharge: 12000000,
    status: 'IN_TRANSIT',
  },
  {
    id: '44444444-4444-4444-4444-444444444402',
    order_no: 'ORD-2026-0102',
    customer_name: 'Tổng Công ty Lương thực Mekong',
    cargo_type: 'Gạo xuất khẩu đóng bao',
    cargo_weight_tons: 2600,
    container_count: 0,
    origin_name: 'Cảng Cái Cui - Cần Thơ',
    dest_name: 'Cảng Tân Cảng Cát Lái',
    unit_price: 145000,
    total_freight: 377000000,
    surcharge: 15000000,
    status: 'IN_TRANSIT',
  },
  {
    id: '44444444-4444-4444-4444-444444444403',
    order_no: 'ORD-2026-0103',
    customer_name: 'Công ty Xi măng Tây Nam',
    cargo_type: 'Xi măng bao Jumbo',
    cargo_weight_tons: 1650,
    container_count: 0,
    origin_name: 'Cảng Quốc tế Long An',
    dest_name: 'Cảng Bình Minh - Vĩnh Long',
    unit_price: 118000,
    total_freight: 194700000,
    surcharge: 5000000,
    status: 'CONFIRMED',
  },
];

export const FALLBACK_INVOICES: Invoice[] = [
  {
    id: 'inv-1',
    invoice_no: 'INV-2026-0041',
    order_no: 'ORD-2026-0101',
    customer_name: 'Công ty CP Logistics Tân Hòa',
    issue_date: '2026-11-12',
    due_date: '2026-12-12',
    total_amount: 209952000,
    paid_amount: 100000000,
    balance_due: 109952000,
    payment_status: 'PARTIAL',
  },
  {
    id: 'inv-2',
    invoice_no: 'INV-2026-0042',
    order_no: 'ORD-2026-0102',
    customer_name: 'Tổng Công ty Lương thực Mekong',
    issue_date: '2026-11-13',
    due_date: '2026-11-28',
    total_amount: 423360000,
    paid_amount: 0,
    balance_due: 423360000,
    payment_status: 'UNPAID',
  },
];

export const FALLBACK_FUEL_LOGS: FuelLog[] = [
  {
    id: 'fl-1',
    vessel_id: '22222222-2222-2222-2222-222222222201',
    vessel_code: 'VS-SL-01',
    vessel_name: 'Sà lan Việt Sun 01',
    log_type: 'BUNKERING',
    quantity_liters: 5000,
    unit_price_vnd: 21800,
    engine_hours: 4120.5,
    reported_by: 'Nguyễn Văn Hùng',
    location_name: 'Cảng Cát Lái',
    notes: 'Cấp dầu DO 0.05S trước chuyến',
    logged_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
  },
  {
    id: 'fl-2',
    vessel_id: '22222222-2222-2222-2222-222222222201',
    vessel_code: 'VS-SL-01',
    vessel_name: 'Sà lan Việt Sun 01',
    log_type: 'CONSUMPTION',
    quantity_liters: 360,
    unit_price_vnd: 21800,
    engine_hours: 4126.2,
    reported_by: 'Nguyễn Văn Hùng',
    location_name: 'Sông Lòng Tàu',
    notes: 'Tiêu thụ 5.7 giờ chạy máy',
    logged_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: 'fl-3',
    vessel_id: '22222222-2222-2222-2222-222222222202',
    vessel_code: 'VS-SL-02',
    vessel_name: 'Sà lan Việt Sun 02',
    log_type: 'CONSUMPTION',
    quantity_liters: 980,
    unit_price_vnd: 21800,
    engine_hours: 5890.0,
    reported_by: 'Trần Minh Tuấn',
    location_name: 'Kênh Chợ Gạo',
    notes: 'Chạy ngược nước cường',
    logged_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
  },
];

export const FALLBACK_MAINTENANCE: MaintenanceOrder[] = [
  {
    id: 'mnt-1',
    ticket_no: 'MNT-2026-0018',
    vessel_id: '22222222-2222-2222-2222-222222222204',
    vessel_code: 'VS-SL-04',
    vessel_name: 'Sà lan Việt Sun 04 (Boong)',
    title: 'Lên triền bảo dưỡng định kỳ & sơn chống hà đáy tàu',
    maintenance_type: 'DRY_DOCK',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    estimated_cost: 185000000,
    actual_cost: 120000000,
    reported_by: 'Phạm Quốc Bảo',
    scheduled_date: '2026-11-11',
    description: 'Bảo dưỡng vỏ tàu và kiểm tra van thông biển trước kỳ đăng kiểm',
  },
  {
    id: 'mnt-2',
    ticket_no: 'MNT-2026-0019',
    vessel_id: '22222222-2222-2222-2222-222222222203',
    vessel_code: 'VS-SL-03',
    vessel_name: 'Sà lan Việt Sun 03',
    title: 'Thay lọc nhớt máy chính & kiểm tra bơm cao áp',
    maintenance_type: 'PREVENTIVE',
    priority: 'MEDIUM',
    status: 'OPEN',
    estimated_cost: 14500000,
    actual_cost: 0,
    reported_by: 'Lê Hoàng Nam',
    scheduled_date: '2026-11-16',
    description: 'Đến mốc 500 giờ chạy máy định kỳ',
  },
];

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}
