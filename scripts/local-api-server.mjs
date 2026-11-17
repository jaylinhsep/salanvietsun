#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  decodeBase64DataUrl,
  deleteTallyImageBinary,
  getAiConfig,
  getR2Config,
  readTallyImageBinary,
  runAiContainerExtraction,
  uploadTallyImage,
} from './r2-ai-helper.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.resolve(__dirname, '../apps/api/.local-db.json');
const PORT = Number(process.env.LOCAL_API_PORT || 4005);

function uuid() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function computeTeus(c20e = 0, c20f = 0, c40e = 0, c40f = 0) {
  return Number(c20e || 0) + Number(c20f || 0) + (Number(c40e || 0) + Number(c40f || 0)) * 2;
}

function generateNextVoyageNo(db, vesselId, receivedDate) {
  const vessel = (db.vessels || []).find((v) => v.id === vesselId);
  if (!vessel) {
    return `VOY-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  }
  const rawCode = String(vessel.code || '').trim().toUpperCase();
  const rawName = String(vessel.name || '').trim().toUpperCase();
  const dateStr =
    receivedDate && /^\d{4}-\d{2}-\d{2}/.test(String(receivedDate))
      ? String(receivedDate).slice(0, 10)
      : nowIso().slice(0, 10);
  const yy = dateStr.slice(2, 4);
  const mm = dateStr.slice(5, 7);
  const dd = dateStr.slice(8, 10);

  const existingForVessel = (db.voyages || [])
    .filter((vy) => vy.vessel_id === vesselId)
    .map((vy) => vy.voyage_no);
  const usedSet = new Set(existingForVessel.map((n) => String(n || '').trim().toUpperCase()).filter(Boolean));

  let bargeNum = null;
  const codeMatch = rawCode.match(/^NV(\d+)$/);
  if (codeMatch) bargeNum = codeMatch[1];
  else {
    const nameMatch = rawName.match(/(?:NHẬT VIỆT|NHAT VIET)\s*(\d+)/);
    if (nameMatch) bargeNum = nameMatch[1];
  }

  if (bargeNum) {
    const tripPattern = new RegExp(`^V\\.?${bargeNum}-0*(\\d+)(\\d{2})([WE])(?:\\s*-\\s*[WE])?$`, 'i');
    let maxRank = -1;
    for (const rawNo of existingForVessel) {
      const no = String(rawNo || '').trim().toUpperCase();
      const m = no.match(tripPattern);
      if (!m) continue;
      const seq = parseInt(m[1], 10);
      const rowYy = m[2];
      const dir = m[3].toUpperCase();
      if (rowYy !== yy) continue;
      const rank = seq * 2 + (dir === 'E' ? 1 : 0);
      if (rank > maxRank) maxRank = rank;
    }
    let nextRank = maxRank >= 0 ? maxRank + 1 : 2;
    while (true) {
      const seq = Math.floor(nextRank / 2);
      const dir = nextRank % 2 === 1 ? 'E' : 'W';
      const candidate = `V${bargeNum}-${String(seq).padStart(2, '0')}${yy}${dir}`;
      if (!usedSet.has(candidate)) return candidate;
      nextRank++;
    }
  }

  const prefix = rawCode || 'SL';
  const base = `${prefix}-${yy}${mm}${dd}`;
  if (!usedSet.has(base)) return base;
  let suffix = 2;
  while (usedSet.has(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
}

function defaultSeedDb() {
  const port1 = { id: '11111111-1111-1111-1111-111111111101', code: 'SPITC', name: 'SPITC', region: 'TP. Hồ Chí Minh', port_type: 'PORT', geofence_radius_m: 800, lat: 10.75, lng: 106.78 };
  const port2 = { id: '11111111-1111-1111-1111-111111111102', code: 'BN', name: 'BẾN NGHÉ', region: 'TP. Hồ Chí Minh', port_type: 'PORT', geofence_radius_m: 600, lat: 10.7615, lng: 106.715 };
  const port3 = { id: '11111111-1111-1111-1111-111111111103', code: 'TN', name: 'TRÀ NÓC', region: 'Cần Thơ', port_type: 'PORT', geofence_radius_m: 700, lat: 10.105, lng: 105.702 };
  const port4 = { id: '11111111-1111-1111-1111-111111111104', code: 'TCCC', name: 'TÂN CẢNG CÁI CUI', region: 'Cần Thơ', port_type: 'PORT', geofence_radius_m: 800, lat: 10.0028, lng: 105.8142 };

  const cust1 = { id: '33333333-3333-3333-3333-333333333301', code: 'PT', name: 'Phước Tạo', contact_person: 'Phước Tạo', phone: '0901234567', tax_code: '', address: '', outstanding_debt: 0 };
  const cust2 = { id: '33333333-3333-3333-3333-333333333302', code: 'DPT', name: 'ĐA PHƯƠNG THỨC VSHO', contact_person: '', phone: '', tax_code: '', address: '', outstanding_debt: 0 };

  const vessel1 = {
    id: '22222222-2222-2222-2222-222222222201',
    code: 'NV36',
    name: 'NHẬT VIỆT 36',
    registration_no: 'SG-6868',
    vessel_type: 'SELF_PROPELLED',
    capacity_tons: 999,
    capacity_teu: 54,
    length_m: 76,
    width_m: 15.2,
    max_draft_m: 4.1,
    main_engine_hp: 750,
    fuel_norm_l_per_hour: 45,
    status: 'AVAILABLE',
    inspection_expiry: '2027-05-15',
    lat: 10.6721,
    lng: 106.8542,
    current_speed_knots: 0,
    current_fuel_liters: 8450,
    captain_name: 'Nguyễn Văn Tuấn',
    captain_phone: '0903112233',
    nearby_port: 'BẾN NGHÉ',
  };

  return {
    vessels: [vessel1],
    equipment: [],
    ports: [port1, port2, port3, port4],
    customers: [cust1, cust2],
    bookings: [
      {
        id: uuid(),
        booking_no: 'BK-MSC-26011',
        cargo_direction: 'EXPORT',
        customer_id: cust1.id,
        customer_name: cust1.name,
        origin_port_id: port1.id,
        origin_name: port1.name,
        destination_port_id: port3.id,
        dest_name: port3.name,
        cont_20e: 8,
        cont_20f: 4,
        cont_40e: 0,
        cont_40f: 2,
        total_teus: 16,
        closing_time: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
        voyage_id: null,
        status: 'PENDING',
        estimated_freight: 14500000,
        notes: 'Ưu tiên cắt máng tàu mẹ MSC tại SPITC',
        created_at: nowIso(),
      },
      {
        id: uuid(),
        booking_no: 'BK-ONE-88240',
        cargo_direction: 'IMPORT',
        customer_id: cust2.id,
        customer_name: cust2.name,
        origin_port_id: port2.id,
        origin_name: port2.name,
        destination_port_id: port4.id,
        dest_name: port4.name,
        cont_20e: 0,
        cont_20f: 6,
        cont_40e: 0,
        cont_40f: 3,
        total_teus: 12,
        closing_time: new Date(Date.now() + 10 * 3600 * 1000).toISOString(),
        voyage_id: null,
        status: 'PENDING',
        estimated_freight: 13800000,
        notes: 'Hàng nhập kiểm tra hạn lệnh & seal',
        created_at: nowIso(),
      },
    ],
    voyages: [],
    voyageContainers: [],
    orders: [],
    invoices: [],
    fuelLogs: [],
    maintenance: [],
    accountingFixedCosts: [],
    accountingPortExpenses: [],
    accountingFuelEntries: [],
    accountingSupplies: [],
    accountingVendorCosts: [],
    accountingHistoricalMonthly: [],
  };
}

const CAPTAIN_TOKEN_SECRET = process.env.CAPTAIN_AUTH_SECRET || 'vietsun-captain-secret-2026-hmac';
const CAPTAIN_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const DEFAULT_CAPTAIN_SEEDS = [
  {
    username: 'nv18',
    password: process.env.CAPTAIN_NV18_PASSWORD || 'nv18@2026',
    full_name: 'Thuyền trưởng NHẬT VIỆT 18',
    vessel_code: 'NV18',
  },
  {
    username: 'nv36',
    password: process.env.CAPTAIN_NV36_PASSWORD || 'nv36@2026',
    full_name: 'Thuyền trưởng NHẬT VIỆT 36',
    vessel_code: 'NV36',
  },
  {
    username: 'nv38',
    password: process.env.CAPTAIN_NV38_PASSWORD || 'nv38@2026',
    full_name: 'Thuyền trưởng NHẬT VIỆT 38',
    vessel_code: 'NV38',
  },
];

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expectedHex] = String(storedHash || '').split(':');
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(password, salt, 32);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function signCaptainToken(user) {
  const payload = {
    sub: user.id,
    username: user.username,
    full_name: user.full_name,
    vessel_code: user.vessel_code,
    role: user.role || 'CAPTAIN',
    exp: Date.now() + CAPTAIN_TOKEN_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', CAPTAIN_TOKEN_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function ensureCaptainAccounts(db) {
  if (!Array.isArray(db.captainAccounts)) db.captainAccounts = [];
  let changed = false;
  for (const seed of DEFAULT_CAPTAIN_SEEDS) {
    if (!db.captainAccounts.some((a) => a.username === seed.username)) {
      db.captainAccounts.push({
        id: uuid(),
        username: seed.username,
        password_hash: hashPassword(seed.password),
        full_name: seed.full_name,
        vessel_code: seed.vessel_code,
        role: 'CAPTAIN',
        is_active: true,
        created_at: nowIso(),
      });
      changed = true;
    }
  }
  return changed;
}

function requireCaptainAuth(req, res, db) {
  const raw = String(req.headers.authorization || '').trim();
  if (!raw.toLowerCase().startsWith('bearer ')) {
    send(res, 401, { message: 'Vui lòng đăng nhập tài khoản Thuyền trưởng.' });
    return null;
  }
  const token = raw.slice(7).trim();
  const dot = token.indexOf('.');
  if (dot <= 0) {
    send(res, 401, { message: 'Token đăng nhập không hợp lệ.' });
    return null;
  }
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expectedSig = crypto.createHmac('sha256', CAPTAIN_TOKEN_SECRET).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    send(res, 401, { message: 'Chữ ký phiên đăng nhập không hợp lệ.' });
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    send(res, 401, { message: 'Phiên đăng nhập bị lỗi.' });
    return null;
  }
  if (!payload?.username || !payload?.vessel_code || !payload?.exp || Date.now() > Number(payload.exp)) {
    send(res, 401, { message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' });
    return null;
  }
  const acc = (db.captainAccounts || []).find(
    (a) => a.username === String(payload.username).trim().toLowerCase(),
  );
  if (!acc || acc.is_active === false) {
    send(res, 401, { message: 'Tài khoản Thuyền trưởng không tồn tại hoặc đã bị khóa.' });
    return null;
  }
  const vessel = (db.vessels || []).find(
    (v) => String(v.code || '').toUpperCase() === String(acc.vessel_code || '').toUpperCase(),
  );
  if (!vessel) {
    send(res, 403, { message: `Không tìm thấy sà lan được phân công (${acc.vessel_code}).` });
    return null;
  }
  return {
    captain: {
      id: acc.id,
      username: acc.username,
      full_name: acc.full_name,
      vessel_code: acc.vessel_code,
      role: acc.role || 'CAPTAIN',
    },
    vessel,
  };
}

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    const seed = defaultSeedDb();
    ensureCaptainAccounts(seed);
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf8');
    return seed;
  }
  const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const db = {
    ...parsed,
    accountingFixedCosts: parsed.accountingFixedCosts || [],
    accountingPortExpenses: parsed.accountingPortExpenses || [],
    accountingFuelEntries: parsed.accountingFuelEntries || [],
    accountingSupplies: parsed.accountingSupplies || [],
    accountingVendorCosts: parsed.accountingVendorCosts || [],
    accountingHistoricalMonthly: parsed.accountingHistoricalMonthly || [],
    captainAccounts: parsed.captainAccounts || [],
  };
  if (ensureCaptainAccounts(db)) {
    saveDb(db);
  }
  return db;
}

function saveDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function hydrateVoyage(db, vy) {
  const vessel = db.vessels.find((v) => v.id === vy.vessel_id);
  const cust = db.customers.find((c) => c.id === vy.customer_id);
  const op = db.ports.find((p) => p.id === vy.origin_port_id);
  const dp = db.ports.find((p) => p.id === vy.destination_port_id);
  const details = db.voyageContainers.filter((c) => c.voyage_id === vy.id);
  const linkedBookings = db.bookings.filter((b) => b.voyage_id === vy.id);

  const namedContCount = details.filter(
    (c) => String(c.container_no || '').trim().length > 0,
  ).length;
  const detailTeus = details.reduce(
    (s, c) => s + (c.cont_type === '40E' || c.cont_type === '40F' ? 2 : 1),
    0,
  );
  const detailRev = details.reduce((s, c) => s + Number(c.total_amount || 0), 0);
  const estFreight = linkedBookings.reduce((s, b) => s + Number(b.estimated_freight || 0), 0);
  const totalWeightTons =
    Math.round(linkedBookings.reduce((s, b) => s + Number(b.total_weight_tons || 0), 0) * 100) / 100;
  const bookingNos =
    linkedBookings.length > 0 ? linkedBookings.map((b) => b.booking_no).join(', ') : vy.booking_nos;
  const earliestClosing =
    linkedBookings
      .map((b) => b.closing_time)
      .filter(Boolean)
      .sort()[0] || vy.earliest_closing_time;
  const tallyCount = (db.voyageTallyPhotos || []).filter((tp) => tp.voyage_id === vy.id).length;

  return {
    ...vy,
    customer_code: cust?.code ?? vy.customer_code ?? null,
    customer_name: cust?.name ?? vy.customer_name ?? null,
    vessel_code: vessel?.code ?? vy.vessel_code ?? '',
    vessel_name: vessel?.name ?? vy.vessel_name ?? '',
    captain_name: vessel?.captain_name ?? vy.captain_name ?? '',
    origin_code: op?.code ?? vy.origin_code ?? null,
    origin_name: op?.name ?? vy.origin_name ?? '',
    origin_lat: op?.lat ?? vy.origin_lat ?? null,
    origin_lng: op?.lng ?? vy.origin_lng ?? null,
    dest_code: dp?.code ?? vy.dest_code ?? null,
    dest_name: dp?.name ?? vy.dest_name ?? '',
    dest_lat: dp?.lat ?? vy.dest_lat ?? null,
    dest_lng: dp?.lng ?? vy.dest_lng ?? null,
    detail_count: details.length,
    named_cont_count: namedContCount,
    detail_teus: detailTeus,
    detail_revenue: detailRev,
    booking_nos: bookingNos,
    earliest_closing_time: earliestClosing,
    estimated_freight: estFreight || vy.estimated_freight || 0,
    total_weight_tons: totalWeightTons || Number(vy.total_weight_tons || 0),
    tally_photo_count: tallyCount,
  };
}

function hydrateBooking(db, b) {
  const cust = db.customers.find((c) => c.id === b.customer_id);
  const op = db.ports.find((p) => p.id === b.origin_port_id);
  const dp = db.ports.find((p) => p.id === b.destination_port_id);
  const vy = db.voyages.find((v) => v.id === b.voyage_id);
  return {
    ...b,
    cargo_direction: b.cargo_direction === 'IMPORT' ? 'IMPORT' : 'EXPORT',
    resolved_customer_name: cust?.name || b.customer_name || null,
    customer_code: cust?.code || null,
    resolved_origin_name: op?.name || b.origin_name || null,
    resolved_dest_name: dp?.name || b.dest_name || null,
    voyage_no: vy?.voyage_no || null,
  };
}

function normalizeContainerPayload(dto) {
  const unitPrice = Number(dto.unit_price || 0);
  const baf = Number(dto.baf || 0);
  const hasExplicitTotal =
    dto.total_amount !== undefined && dto.total_amount !== null && dto.total_amount !== '';
  const totalAmount = hasExplicitTotal ? Number(dto.total_amount) : unitPrice + baf;
  const rawType = String(dto.cont_type || '20F').trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
  const contType = ['20E', '20F', '40E', '40F'].includes(rawType) ? rawType : '20F';
  return {
    barge_code: dto.barge_code ? String(dto.barge_code).trim() : null,
    trip_no: dto.trip_no ? String(dto.trip_no).trim() : null,
    container_no: String(dto.container_no || '').trim().toUpperCase(),
    seal_no: dto.seal_no ? String(dto.seal_no).trim().toUpperCase() : null,
    booking_no: dto.booking_no ? String(dto.booking_no).trim().toUpperCase() : null,
    origin_name: dto.origin_name ? String(dto.origin_name).trim() : null,
    destination_name: dto.destination_name ? String(dto.destination_name).trim() : null,
    shipper_name: dto.shipper_name ? String(dto.shipper_name).trim() : null,
    departure_date: dto.departure_date ? String(dto.departure_date).trim().slice(0, 10) : null,
    cont_type: contType,
    unit_price: Number.isFinite(unitPrice) ? unitPrice : 0,
    baf: Number.isFinite(baf) ? baf : 0,
    total_amount: Number.isFinite(totalAmount) ? totalAmount : 0,
    fuel_price_no_vat: Number(dto.fuel_price_no_vat || 0) || 0,
    notes: dto.notes ? String(dto.notes).trim() : null,
  };
}

const ACC_COLLECTION_MAP = {
  'fixed-costs': 'accountingFixedCosts',
  'port-expenses': 'accountingPortExpenses',
  'fuel-entries': 'accountingFuelEntries',
  supplies: 'accountingSupplies',
  'vendor-costs': 'accountingVendorCosts',
};

function computeAccountingPnl(db, year, month) {
  const mm = String(month).padStart(2, '0');
  const periodMonth = `${year}-${mm}`;
  const yearPrefix = `${year}-`;
  const normBarge = (c) => (c ? String(c).trim().toUpperCase() : 'CHUNG');

  const bargeCodes = new Set(['NV18', 'NV36', 'NV38']);
  for (const v of db.vessels || []) if (v.code) bargeCodes.add(normBarge(v.code));
  for (const c of db.voyageContainers || []) if (c.barge_code) bargeCodes.add(normBarge(c.barge_code));
  for (const r of db.accountingFixedCosts || []) if (r.vessel_code) bargeCodes.add(normBarge(r.vessel_code));
  for (const r of db.accountingPortExpenses || []) if (r.vessel_code) bargeCodes.add(normBarge(r.vessel_code));
  for (const r of db.accountingFuelEntries || []) if (r.vessel_code) bargeCodes.add(normBarge(r.vessel_code));
  for (const r of db.accountingSupplies || []) if (r.vessel_code) bargeCodes.add(normBarge(r.vessel_code));

  const emptyBucket = (code) => ({
    vessel_code: code,
    revenue: 0,
    crew_salary: 0,
    charter_fee: 0,
    port_auth: 0,
    berth: 0,
    allowance: 0,
    other_port: 0,
    fuel_do: 0,
    vendor_cost: 0,
    hull_insurance: 0,
    supplies: 0,
    repair_drydock: 0,
    social_insurance: 0,
    storage_fee: 0,
    total_cost: 0,
    net_profit: 0,
  });

  const monthlyMap = new Map();
  for (const c of bargeCodes) monthlyMap.set(c, emptyBucket(c));
  const ensure = (code) => {
    if (!monthlyMap.has(code)) monthlyMap.set(code, emptyBucket(code));
    return monthlyMap.get(code);
  };

  const ytdMatrix = new Map();
  const addYtd = (code, ym, revDelta, costDelta) => {
    if (!ym || !String(ym).startsWith(yearPrefix)) return;
    const mNum = Number(String(ym).slice(5, 7));
    if (!mNum || mNum < 1 || mNum > 12) return;
    if (!ytdMatrix.has(code)) ytdMatrix.set(code, {});
    const row = ytdMatrix.get(code);
    if (!row[mNum]) row[mNum] = { revenue: 0, cost: 0, profit: 0 };
    row[mNum].revenue += revDelta;
    row[mNum].cost += costDelta;
    row[mNum].profit = row[mNum].revenue - row[mNum].cost;
  };

  for (const c of db.voyageContainers || []) {
    const ym = String(c.accounting_month || c.departure_date || c.created_at || '').slice(0, 7);
    if (!ym.startsWith(yearPrefix)) continue;
    const barge = normBarge(c.barge_code);
    const rev = Number(c.total_amount || 0);
    addYtd(barge, ym, rev, 0);
    if (ym === periodMonth) ensure(barge).revenue += rev;
  }

  for (const r of db.accountingFixedCosts || []) {
    if (!String(r.period_month || '').startsWith(yearPrefix)) continue;
    const barge = normBarge(r.vessel_code);
    const sum =
      Number(r.charter_fee || 0) +
      Number(r.crew_salary || 0) +
      Number(r.social_insurance || 0) +
      Number(r.hull_insurance || 0) +
      Number(r.storage_fee || 0);
    addYtd(barge, r.period_month, 0, sum);
    if (r.period_month === periodMonth) {
      const b = ensure(barge);
      b.charter_fee += Number(r.charter_fee || 0);
      b.crew_salary += Number(r.crew_salary || 0);
      b.social_insurance += Number(r.social_insurance || 0);
      b.hull_insurance += Number(r.hull_insurance || 0);
      b.storage_fee += Number(r.storage_fee || 0);
    }
  }

  for (const r of db.accountingPortExpenses || []) {
    if (!String(r.period_month || '').startsWith(yearPrefix)) continue;
    const barge = normBarge(r.vessel_code);
    const amt = Number(r.amount || 0);
    addYtd(barge, r.period_month, 0, amt);
    if (r.period_month === periodMonth) {
      const b = ensure(barge);
      const cat = String(r.category || 'PORT_AUTH').toUpperCase();
      if (cat === 'PORT_AUTH') b.port_auth += amt;
      else if (cat === 'BERTH') b.berth += amt;
      else if (cat === 'ALLOWANCE') b.allowance += amt;
      else b.other_port += amt;
    }
  }

  for (const r of db.accountingFuelEntries || []) {
    if (!String(r.period_month || '').startsWith(yearPrefix)) continue;
    const et = String(r.entry_type || '').toUpperCase();
    if (et !== 'BUNKERING' && et !== 'CARRY_OVER' && Number(r.total_amount || 0) === 0) continue;
    const barge = normBarge(r.vessel_code);
    const amt = Number(r.total_amount || 0);
    addYtd(barge, r.period_month, 0, amt);
    if (r.period_month === periodMonth) ensure(barge).fuel_do += amt;
  }

  for (const r of db.accountingSupplies || []) {
    if (!String(r.period_month || '').startsWith(yearPrefix)) continue;
    const barge = normBarge(r.vessel_code);
    const amt = Number(r.total_amount || 0);
    addYtd(barge, r.period_month, 0, amt);
    if (r.period_month === periodMonth) {
      const b = ensure(barge);
      if (String(r.category || '').toUpperCase() === 'SUPPLIES') b.supplies += amt;
      else b.repair_drydock += amt;
    }
  }

  for (const r of db.accountingVendorCosts || []) {
    if (!String(r.period_month || '').startsWith(yearPrefix)) continue;
    const amt = Number(r.total_amount || 0);
    addYtd('VENDOR', r.period_month, 0, amt);
    if (r.period_month === periodMonth) ensure('VENDOR').vendor_cost += amt;
  }

  const byBarge = Array.from(monthlyMap.values()).map((b) => {
    b.total_cost =
      b.crew_salary +
      b.charter_fee +
      b.port_auth +
      b.berth +
      b.allowance +
      b.other_port +
      b.fuel_do +
      b.vendor_cost +
      b.hull_insurance +
      b.supplies +
      b.repair_drydock +
      b.social_insurance +
      b.storage_fee;
    b.net_profit = b.revenue - b.total_cost;
    return b;
  });

  const summary = byBarge.reduce(
    (acc, b) => {
      acc.revenue += b.revenue;
      acc.crew_salary += b.crew_salary;
      acc.charter_fee += b.charter_fee;
      acc.port_auth += b.port_auth;
      acc.berth += b.berth;
      acc.allowance += b.allowance;
      acc.other_port += b.other_port;
      acc.fuel_do += b.fuel_do;
      acc.vendor_cost += b.vendor_cost;
      acc.hull_insurance += b.hull_insurance;
      acc.supplies += b.supplies;
      acc.repair_drydock += b.repair_drydock;
      acc.social_insurance += b.social_insurance;
      acc.storage_fee += b.storage_fee;
      acc.total_cost += b.total_cost;
      acc.net_profit += b.net_profit;
      return acc;
    },
    emptyBucket('TOTAL'),
  );

  // Merge imported historical monthly summary (e.g. T1..T9 from Excel TOTAL) when no detailed ledger exists
  for (const h of db.accountingHistoricalMonthly || []) {
    if (Number(h.year) !== Number(year)) continue;
    const mNum = Number(h.month);
    if (!mNum || mNum < 1 || mNum > 12) continue;
    const code = normBarge(h.vessel_code);
    if (!ytdMatrix.has(code)) ytdMatrix.set(code, {});
    const row = ytdMatrix.get(code);
    if (!row[mNum]) {
      row[mNum] = {
        revenue: Number(h.revenue || 0),
        cost: Number(h.cost || 0),
        profit: Number(h.profit ?? Number(h.revenue || 0) - Number(h.cost || 0)),
      };
    }
  }

  const yearlyByBarge = Array.from(ytdMatrix.entries()).map(([vessel_code, months]) => ({
    vessel_code,
    months,
    total_revenue: Object.values(months).reduce((s, x) => s + x.revenue, 0),
    total_cost: Object.values(months).reduce((s, x) => s + x.cost, 0),
    total_profit: Object.values(months).reduce((s, x) => s + x.profit, 0),
  }));

  return { period_month: periodMonth, year, month, summary, by_barge: byBarge, yearly_by_barge: yearlyByBarge };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Ai-Api-Key',
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});

  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  const p = url.pathname.replace(/\/+$/, '');
  const m = req.method || 'GET';
  const db = loadDb();

  try {
    // Health
    if (m === 'GET' && p === '/api/health') {
      return send(res, 200, {
        status: 'ok',
        service: 'salanvietsun-local-api',
        databaseConnected: true,
        mode: 'LOCALHOST_JSON',
        timestamp: nowIso(),
      });
    }

    // --- FLEET ---
    if (m === 'GET' && p === '/api/fleet/vessels') {
      return send(res, 200, db.vessels);
    }
    if (m === 'POST' && p === '/api/fleet/vessels') {
      const body = await readBody(req);
      const item = {
        id: uuid(),
        code: String(body.code || '').trim().toUpperCase(),
        name: String(body.name || '').trim(),
        registration_no: body.registration_no || '',
        vessel_type: body.vessel_type || 'SELF_PROPELLED',
        capacity_tons: Number(body.capacity_tons || 0),
        capacity_teu: Number(body.capacity_teu || 0),
        main_engine_hp: Number(body.main_engine_hp || 0),
        fuel_norm_l_per_hour: Number(body.fuel_norm_l_per_hour || 0),
        status: body.status || 'AVAILABLE',
        inspection_expiry: body.inspection_expiry || null,
        lat: Number(body.lat ?? 10.7615),
        lng: Number(body.lng ?? 106.7918),
        current_speed_knots: Number(body.current_speed_knots || 0),
        current_fuel_liters: Number(body.current_fuel_liters || 0),
        captain_name: body.captain_name || '',
        captain_phone: body.captain_phone || '',
        nearby_port: null,
      };
      db.vessels.push(item);
      saveDb(db);
      return send(res, 201, item);
    }
    const vesselMatch = p.match(/^\/api\/fleet\/vessels\/([^/]+)$/);
    if (vesselMatch && m === 'PATCH') {
      const body = await readBody(req);
      const idx = db.vessels.findIndex((v) => v.id === vesselMatch[1]);
      if (idx < 0) return send(res, 404, { message: 'Vessel not found' });
      db.vessels[idx] = { ...db.vessels[idx], ...body };
      saveDb(db);
      return send(res, 200, db.vessels[idx]);
    }
    if (vesselMatch && m === 'DELETE') {
      db.vessels = db.vessels.filter((v) => v.id !== vesselMatch[1]);
      saveDb(db);
      return send(res, 200, { ok: true });
    }

    if (m === 'GET' && p === '/api/fleet/equipment') {
      return send(res, 200, db.equipment || []);
    }
    if (m === 'POST' && p === '/api/fleet/equipment') {
      const body = await readBody(req);
      const v = db.vessels.find((x) => x.id === body.vessel_id);
      const eq = {
        id: uuid(),
        ...body,
        vessel_code: v?.code || '',
        vessel_name: v?.name || '',
      };
      db.equipment.push(eq);
      saveDb(db);
      return send(res, 201, eq);
    }
    const eqMatch = p.match(/^\/api\/fleet\/equipment\/([^/]+)$/);
    if (eqMatch && m === 'PATCH') {
      const body = await readBody(req);
      const idx = db.equipment.findIndex((e) => e.id === eqMatch[1]);
      if (idx < 0) return send(res, 404, { message: 'Equipment not found' });
      db.equipment[idx] = { ...db.equipment[idx], ...body };
      saveDb(db);
      return send(res, 200, db.equipment[idx]);
    }
    if (eqMatch && m === 'DELETE') {
      db.equipment = db.equipment.filter((e) => e.id !== eqMatch[1]);
      saveDb(db);
      return send(res, 200, { ok: true });
    }

    // --- PORTS ---
    if (m === 'GET' && p === '/api/dispatch/ports') {
      return send(res, 200, db.ports);
    }
    if (m === 'POST' && p === '/api/dispatch/ports') {
      const body = await readBody(req);
      const port = {
        id: uuid(),
        code: String(body.code || '').trim().toUpperCase(),
        name: String(body.name || '').trim(),
        region: body.region || 'TP. Hồ Chí Minh',
        port_type: body.port_type || 'PORT',
        geofence_radius_m: Number(body.geofence_radius_m || 600),
        lat: Number(body.lat ?? 10.7615),
        lng: Number(body.lng ?? 106.7918),
      };
      db.ports.push(port);
      saveDb(db);
      return send(res, 201, port);
    }
    const portMatch = p.match(/^\/api\/dispatch\/ports\/([^/]+)$/);
    if (portMatch && m === 'PATCH') {
      const body = await readBody(req);
      const idx = db.ports.findIndex((x) => x.id === portMatch[1]);
      if (idx < 0) return send(res, 404, { message: 'Port not found' });
      db.ports[idx] = { ...db.ports[idx], ...body };
      saveDb(db);
      return send(res, 200, db.ports[idx]);
    }
    if (portMatch && m === 'DELETE') {
      db.ports = db.ports.filter((x) => x.id !== portMatch[1]);
      saveDb(db);
      return send(res, 200, { ok: true });
    }

    // --- SAILING SCHEDULE (LỊCH SÀ LAN & PUBLIC /lich) ---
    if (m === 'GET' && p === '/api/dispatch/sailing-schedule') {
      if (db.sailingSchedule && Array.isArray(db.sailingSchedule.sheets) && db.sailingSchedule.sheets.length > 0) {
        return send(res, 200, db.sailingSchedule);
      }
      return send(res, 200, { active_month: '2026-11', sheets: [] });
    }
    if (m === 'PUT' && p === '/api/dispatch/sailing-schedule') {
      const body = await readBody(req);
      if (!body || !Array.isArray(body.sheets) || body.sheets.length === 0) {
        return send(res, 400, { message: 'Dữ liệu lịch chạy sà lan không hợp lệ.' });
      }
      db.sailingSchedule = {
        active_month: String(body.active_month || body.sheets[0].month_key || '2026-11'),
        sheets: body.sheets,
        updated_at: nowIso(),
      };
      saveDb(db);
      return send(res, 200, db.sailingSchedule);
    }

    // --- BOOKINGS ---
    if (m === 'GET' && p === '/api/dispatch/bookings') {
      return send(
        res,
        200,
        db.bookings.map((b) => hydrateBooking(db, b)),
      );
    }
    if (m === 'POST' && p === '/api/dispatch/bookings') {
      const body = await readBody(req);
      const c20e = Number(body.cont_20e || 0);
      const c20f = Number(body.cont_20f || 0);
      const c40e = Number(body.cont_40e || 0);
      const c40f = Number(body.cont_40f || 0);
      const w20e = Math.max(0, Number(body.weight_per_20e || 0));
      const w20f = Math.max(0, Number(body.weight_per_20f || 0));
      const w40e = Math.max(0, Number(body.weight_per_40e || 0));
      const w40f = Math.max(0, Number(body.weight_per_40f || 0));
      const computedWeight =
        Math.round((c20e * w20e + c20f * w20f + c40e * w40e + c40f * w40f) * 100) / 100;
      const totalWeightTons =
        w20e > 0 || w20f > 0 || w40e > 0 || w40f > 0
          ? computedWeight
          : Math.max(0, Number(body.total_weight_tons || 0));
      const bk = {
        id: uuid(),
        booking_no: String(body.booking_no || `BK-${Date.now().toString().slice(-5)}`)
          .trim()
          .toUpperCase(),
        cargo_direction: body.cargo_direction === 'IMPORT' ? 'IMPORT' : 'EXPORT',
        customer_id: body.customer_id || null,
        customer_name: body.customer_name || null,
        origin_port_id: body.origin_port_id || null,
        origin_name: body.origin_name || null,
        destination_port_id: body.destination_port_id || null,
        dest_name: body.dest_name || null,
        cont_20e: c20e,
        cont_20f: c20f,
        cont_40e: c40e,
        cont_40f: c40f,
        weight_per_20e: w20e,
        weight_per_20f: w20f,
        weight_per_40e: w40e,
        weight_per_40f: w40f,
        total_weight_tons: totalWeightTons,
        total_teus: computeTeus(c20e, c20f, c40e, c40f),
        closing_time: body.closing_time || null,
        voyage_id: null,
        status: 'PENDING',
        estimated_freight: Number(body.estimated_freight || 0),
        notes: body.notes || null,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      db.bookings.unshift(bk);
      saveDb(db);
      return send(res, 201, hydrateBooking(db, bk));
    }
    if (m === 'POST' && p === '/api/dispatch/bookings/assign') {
      const body = await readBody(req);
      const ids = Array.isArray(body.booking_ids) ? body.booking_ids : [];
      const selected = db.bookings.filter((b) => ids.includes(b.id));
      if (selected.length === 0) return send(res, 400, { ok: false, message: 'Chưa chọn booking nào.' });

      const vessel = db.vessels.find((v) => v.id === body.vessel_id);
      if (!vessel) return send(res, 404, { ok: false, message: 'Không tìm thấy sà lan.' });

      const sum20e = selected.reduce((s, b) => s + Number(b.cont_20e || 0), 0);
      const sum20f = selected.reduce((s, b) => s + Number(b.cont_20f || 0), 0);
      const sum40e = selected.reduce((s, b) => s + Number(b.cont_40e || 0), 0);
      const sum40f = selected.reduce((s, b) => s + Number(b.cont_40f || 0), 0);
      const sumTeus = computeTeus(sum20e, sum20f, sum40e, sum40f);
      const first = selected[0];

      let targetVoyageId = body.voyage_id || null;
      let existingTeus = 0;
      const existingVy = targetVoyageId ? db.voyages.find((v) => v.id === targetVoyageId) : null;
      if (targetVoyageId) {
        if (!existingVy) return send(res, 404, { message: 'Không tìm thấy chuyến cần ghép.' });
        if (existingVy.status !== 'PLANNED') {
          return send(res, 400, {
            message: 'Chỉ được ghép thêm booking vào chuyến đang gom/xếp hàng (PLANNED).',
          });
        }
        existingTeus = Number(existingVy.total_teus || 0);
      }

      const maxTeu = Number(vessel.capacity_teu || 0);
      const projectedTeus = existingTeus + sumTeus;
      if (projectedTeus > maxTeu) {
        return send(res, 400, {
          message: `Vượt sức chở của sà lan ${vessel.name} (${projectedTeus} TEU > tối đa ${maxTeu} TEU). Không thể ghép!`,
        });
      }

      if (existingVy) {
        existingVy.cont_20e = Number(existingVy.cont_20e || 0) + sum20e;
        existingVy.cont_20f = Number(existingVy.cont_20f || 0) + sum20f;
        existingVy.cont_40e = Number(existingVy.cont_40e || 0) + sum40e;
        existingVy.cont_40f = Number(existingVy.cont_40f || 0) + sum40f;
        existingVy.total_teus = projectedTeus;
      } else {
        targetVoyageId = uuid();
        const todayDate = nowIso().slice(0, 10);
        const voyageNo =
          body.voyage_no && String(body.voyage_no).trim()
            ? String(body.voyage_no).trim().toUpperCase()
            : generateNextVoyageNo(db, body.vessel_id, todayDate);
        db.voyages.unshift({
          id: targetVoyageId,
          voyage_no: voyageNo,
          status: 'PLANNED',
          vessel_id: body.vessel_id,
          customer_id: first.customer_id || null,
          origin_port_id: first.origin_port_id || null,
          destination_port_id: first.destination_port_id || null,
          received_date: nowIso().slice(0, 10),
          cont_20e: sum20e,
          cont_20f: sum20f,
          cont_40e: sum40e,
          cont_40f: sum40f,
          total_teus: sumTeus,
          workflow_step: 0,
          fuel_start_liters: Number(vessel?.current_fuel_liters || 5000),
          fuel_added_liters: 0,
          fuel_end_liters: 0,
          fuel_unit_price: 21500,
          port_fee: 0,
          crew_salary: 0,
          other_cost: 0,
          captain_report_log: [],
          created_at: nowIso(),
        });
      }

      const assignedVy = db.voyages.find((v) => v.id === targetVoyageId);
      const depDate = String(assignedVy?.received_date || nowIso()).slice(0, 10);
      const accMonth = depDate.slice(0, 7);

      for (const b of db.bookings) {
        if (ids.includes(b.id)) {
          b.voyage_id = targetVoyageId;
          b.status = 'ASSIGNED';
          b.updated_at = nowIso();

          const bCust = db.customers.find((c) => c.id === b.customer_id);
          const bOrig = db.ports.find((pt) => pt.id === b.origin_port_id);
          const bDest = db.ports.find((pt) => pt.id === b.destination_port_id);
          for (const [ct, cnt] of [
            ['20E', Number(b.cont_20e || 0)],
            ['20F', Number(b.cont_20f || 0)],
            ['40E', Number(b.cont_40e || 0)],
            ['40F', Number(b.cont_40f || 0)],
          ]) {
            for (let i = 0; i < cnt; i++) {
              db.voyageContainers.push({
                id: uuid(),
                voyage_id: targetVoyageId,
                barge_code: vessel?.code || vessel?.name || '',
                trip_no: assignedVy?.voyage_no || '',
                container_no: '',
                seal_no: null,
                booking_no: b.booking_no || null,
                origin_name: bOrig?.name || b.origin_name || '',
                destination_name: bDest?.name || b.dest_name || '',
                shipper_name: bCust?.name || b.customer_name || '',
                departure_date: depDate,
                accounting_month: accMonth,
                status: assignedVy?.status || 'PLANNED',
                cont_type: ct,
                unit_price: 0,
                baf: 0,
                total_amount: 0,
                fuel_price_no_vat: 0,
                notes: null,
                created_at: nowIso(),
                updated_at: nowIso(),
              });
            }
          }
        }
      }
      saveDb(db);
      return send(res, 200, { ok: true, voyage_id: targetVoyageId, assignedCount: selected.length });
    }

    const bkUnassignMatch = p.match(/^\/api\/dispatch\/bookings\/([^/]+)\/unassign$/);
    if (bkUnassignMatch && m === 'POST') {
      const bk = db.bookings.find((b) => b.id === bkUnassignMatch[1]);
      if (!bk) return send(res, 404, { message: 'Booking not found' });
      if (bk.voyage_id) {
        const vy = db.voyages.find((v) => v.id === bk.voyage_id);
        if (vy && vy.status !== 'PLANNED') {
          return send(res, 400, {
            message: 'Chỉ được gỡ booking khi chuyến đang ở trạng thái Đang gom/xếp hàng.',
          });
        }
        if (vy) {
          vy.cont_20e = Math.max(0, Number(vy.cont_20e || 0) - Number(bk.cont_20e || 0));
          vy.cont_20f = Math.max(0, Number(vy.cont_20f || 0) - Number(bk.cont_20f || 0));
          vy.cont_40e = Math.max(0, Number(vy.cont_40e || 0) - Number(bk.cont_40e || 0));
          vy.cont_40f = Math.max(0, Number(vy.cont_40f || 0) - Number(bk.cont_40f || 0));
          vy.total_teus = Math.max(0, Number(vy.total_teus || 0) - Number(bk.total_teus || 0));
        }
        db.voyageContainers = db.voyageContainers.filter(
          (c) =>
            !(
              c.voyage_id === bk.voyage_id &&
              c.booking_no === bk.booking_no &&
              String(c.container_no || '').trim() === ''
            ),
        );
        bk.voyage_id = null;
        bk.status = 'PENDING';
        bk.updated_at = nowIso();
        saveDb(db);
      }
      return send(res, 200, { ok: true });
    }

    const vyReleaseMatch = p.match(/^\/api\/dispatch\/voyages\/([^/]+)\/release$/);
    if (vyReleaseMatch && m === 'POST') {
      const vy = db.voyages.find((v) => v.id === vyReleaseMatch[1]);
      if (!vy) return send(res, 404, { message: 'Voyage not found' });
      if (vy.status !== 'PLANNED') {
        return send(res, 400, {
          message: 'Chỉ có thể nhả chuyến khi đang ở trạng thái Đang gom/xếp hàng (PLANNED).',
        });
      }
      let releasedCount = 0;
      for (const b of db.bookings) {
        if (b.voyage_id === vy.id) {
          b.voyage_id = null;
          b.status = 'PENDING';
          b.updated_at = nowIso();
          releasedCount++;
        }
      }
      db.voyageContainers = db.voyageContainers.filter(
        (c) => !(c.voyage_id === vy.id && String(c.container_no || '').trim() === ''),
      );
      const hasContainers = db.voyageContainers.some((c) => c.voyage_id === vy.id);
      if (!hasContainers) {
        db.voyages = db.voyages.filter((v) => v.id !== vy.id);
      } else {
        vy.cont_20e = 0;
        vy.cont_20f = 0;
        vy.cont_40e = 0;
        vy.cont_40f = 0;
        vy.total_teus = 0;
      }
      saveDb(db);
      return send(res, 200, { ok: true, releasedCount, deletedVoyage: !hasContainers });
    }
    const bkMatch = p.match(/^\/api\/dispatch\/bookings\/([^/]+)$/);
    if (bkMatch && m === 'PATCH') {
      const body = await readBody(req);
      const idx = db.bookings.findIndex((b) => b.id === bkMatch[1]);
      if (idx < 0) return send(res, 404, { message: 'Booking not found' });
      const prev = db.bookings[idx];
      const next = {
        ...prev,
        ...body,
        booking_no: String(body.booking_no || prev.booking_no).trim().toUpperCase(),
        cargo_direction:
          (body.cargo_direction ?? prev.cargo_direction) === 'IMPORT' ? 'IMPORT' : 'EXPORT',
        cont_20e: Number(body.cont_20e ?? prev.cont_20e ?? 0),
        cont_20f: Number(body.cont_20f ?? prev.cont_20f ?? 0),
        cont_40e: Number(body.cont_40e ?? prev.cont_40e ?? 0),
        cont_40f: Number(body.cont_40f ?? prev.cont_40f ?? 0),
        weight_per_20e: Math.max(0, Number(body.weight_per_20e ?? prev.weight_per_20e ?? 0)),
        weight_per_20f: Math.max(0, Number(body.weight_per_20f ?? prev.weight_per_20f ?? 0)),
        weight_per_40e: Math.max(0, Number(body.weight_per_40e ?? prev.weight_per_40e ?? 0)),
        weight_per_40f: Math.max(0, Number(body.weight_per_40f ?? prev.weight_per_40f ?? 0)),
        estimated_freight: Number(body.estimated_freight ?? prev.estimated_freight ?? 0),
        updated_at: nowIso(),
      };
      next.total_teus = computeTeus(next.cont_20e, next.cont_20f, next.cont_40e, next.cont_40f);
      const nextComputedW =
        Math.round(
          (next.cont_20e * next.weight_per_20e +
            next.cont_20f * next.weight_per_20f +
            next.cont_40e * next.weight_per_40e +
            next.cont_40f * next.weight_per_40f) *
            100,
        ) / 100;
      next.total_weight_tons =
        next.weight_per_20e > 0 ||
        next.weight_per_20f > 0 ||
        next.weight_per_40e > 0 ||
        next.weight_per_40f > 0
          ? nextComputedW
          : Math.max(0, Number(body.total_weight_tons ?? prev.total_weight_tons ?? 0));
      if (prev.voyage_id) {
        const vy = db.voyages.find((v) => v.id === prev.voyage_id);
        if (vy) {
          const vessel = db.vessels.find((v) => v.id === vy.vessel_id);
          const d20e = next.cont_20e - Number(prev.cont_20e || 0);
          const d20f = next.cont_20f - Number(prev.cont_20f || 0);
          const d40e = next.cont_40e - Number(prev.cont_40e || 0);
          const d40f = next.cont_40f - Number(prev.cont_40f || 0);
          const dTeus = next.total_teus - Number(prev.total_teus || 0);
          const projected = Number(vy.total_teus || 0) + dTeus;
          const maxTeu = Number(vessel?.capacity_teu || 0);
          if (dTeus > 0 && vessel && projected > maxTeu) {
            return send(res, 400, {
              message: `Vượt sức chở của sà lan ${vessel.name} (${projected} TEU > tối đa ${maxTeu} TEU).`,
            });
          }
          vy.cont_20e = Math.max(0, Number(vy.cont_20e || 0) + d20e);
          vy.cont_20f = Math.max(0, Number(vy.cont_20f || 0) + d20f);
          vy.cont_40e = Math.max(0, Number(vy.cont_40e || 0) + d40e);
          vy.cont_40f = Math.max(0, Number(vy.cont_40f || 0) + d40f);
          vy.total_teus = Math.max(0, projected);
        }
      }
      db.bookings[idx] = next;
      saveDb(db);
      return send(res, 200, hydrateBooking(db, next));
    }
    if (bkMatch && m === 'DELETE') {
      db.bookings = db.bookings.filter((b) => b.id !== bkMatch[1]);
      saveDb(db);
      return send(res, 200, { ok: true });
    }

    // --- VOYAGES & CONTAINERS ---
    if (m === 'GET' && p === '/api/dispatch/storage-ai-status') {
      const r2 = getR2Config();
      const ai = getAiConfig();
      return send(res, 200, {
        r2Configured: r2.configured,
        r2Bucket: r2.configured ? r2.bucket : null,
        aiConfigured: ai.configured,
        aiProvider: ai.provider,
      });
    }
    const tallyListMatch = p.match(/^\/api\/dispatch\/voyages\/([^/]+)\/tally-photos$/);
    if (tallyListMatch && m === 'GET') {
      const list = (db.voyageTallyPhotos || [])
        .filter((tp) => tp.voyage_id === tallyListMatch[1])
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return send(res, 200, list);
    }
    if (tallyListMatch && m === 'POST') {
      const body = await readBody(req);
      const vy = (db.voyages || []).find((x) => x.id === tallyListMatch[1]);
      if (!vy) return send(res, 404, { message: 'Không tìm thấy chuyến.' });
      if (!body?.image_data_url) return send(res, 400, { message: 'Thiếu dữ liệu ảnh Tally.' });
      const decoded = decodeBase64DataUrl(body.image_data_url);
      const photoId = uuid();
      const uploaded = await uploadTallyImage({
        photoId,
        voyageCodeOrId: vy.voyage_no || vy.id,
        buffer: decoded.buffer,
        mimeType: decoded.mimeType,
        ext: decoded.ext,
      });
      const rec = {
        id: photoId,
        voyage_id: vy.id,
        vessel_id: body.vessel_id || vy.vessel_id || null,
        image_url: uploaded.image_url,
        r2_key: uploaded.r2_key,
        storage_provider: uploaded.storage_provider,
        mime_type: decoded.mimeType,
        original_size_bytes: Number(body.original_size_bytes || decoded.buffer.length),
        compressed_size_bytes: decoded.buffer.length,
        uploaded_by: body.uploaded_by || 'Điều độ viên',
        notes: body.notes || null,
        ai_status: 'PENDING',
        ai_provider: null,
        ai_raw_text: null,
        ai_extracted_containers: [],
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      db.voyageTallyPhotos = [rec, ...(db.voyageTallyPhotos || [])];
      saveDb(db);
      return send(res, 201, rec);
    }
    const tallyImgMatch = p.match(/^\/api\/dispatch\/tally-photos\/([^/]+)\/image$/);
    if (tallyImgMatch && m === 'GET') {
      const rec = (db.voyageTallyPhotos || []).find((tp) => tp.id === tallyImgMatch[1]);
      if (!rec) return send(res, 404, { message: 'Not found' });
      const bin = await readTallyImageBinary(rec);
      if (!bin) return send(res, 404, { message: 'Image binary missing' });
      res.writeHead(200, {
        'Content-Type': bin.mimeType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      });
      return res.end(bin.buffer);
    }
    const tallyExtractMatch = p.match(/^\/api\/dispatch\/tally-photos\/([^/]+)\/extract-ai$/);
    if (tallyExtractMatch && m === 'POST') {
      const body = await readBody(req);
      const rec = (db.voyageTallyPhotos || []).find((tp) => tp.id === tallyExtractMatch[1]);
      if (!rec) return send(res, 404, { message: 'Không tìm thấy ảnh Tally.' });
      try {
        const bin = await readTallyImageBinary(rec);
        if (!bin) return send(res, 400, { message: 'Không đọc được ảnh để xử lý AI.' });
        const aiRes = await runAiContainerExtraction({
          imageBuffer: bin.buffer,
          mimeType: bin.mimeType,
          overrideApiKey: body?.api_key || req.headers['x-ai-api-key'],
        });
        if (!aiRes.ai_configured) {
          return send(res, 200, { ai_configured: false, message: aiRes.message, photo: rec });
        }
        rec.ai_status = 'EXTRACTED';
        rec.ai_provider = aiRes.provider;
        rec.ai_raw_text = aiRes.raw_text;
        rec.ai_extracted_containers = aiRes.containers;
        rec.updated_at = nowIso();
        saveDb(db);
        return send(res, 200, {
          ai_configured: true,
          provider: aiRes.provider,
          containers: aiRes.containers,
          photo: rec,
        });
      } catch (err) {
        return send(res, 400, { message: err?.message || 'Lỗi khi gọi AI phân tích ảnh Tally.' });
      }
    }
    const tallyEditedMatch = p.match(/^\/api\/dispatch\/tally-photos\/([^/]+)\/extracted$/);
    if (tallyEditedMatch && m === 'PATCH') {
      const body = await readBody(req);
      const rec = (db.voyageTallyPhotos || []).find((tp) => tp.id === tallyEditedMatch[1]);
      if (!rec) return send(res, 404, { message: 'Không tìm thấy ảnh Tally.' });
      if (rec.ai_status === 'PENDING') rec.ai_status = 'EDITED';
      rec.ai_extracted_containers = Array.isArray(body?.containers) ? body.containers : [];
      rec.updated_at = nowIso();
      saveDb(db);
      return send(res, 200, rec);
    }
    const tallyDelMatch = p.match(/^\/api\/dispatch\/tally-photos\/([^/]+)$/);
    if (tallyDelMatch && m === 'DELETE') {
      const rec = (db.voyageTallyPhotos || []).find((tp) => tp.id === tallyDelMatch[1]);
      db.voyageTallyPhotos = (db.voyageTallyPhotos || []).filter((tp) => tp.id !== tallyDelMatch[1]);
      saveDb(db);
      if (rec) await deleteTallyImageBinary(rec);
      return send(res, 200, { ok: true });
    }

    if (m === 'GET' && p === '/api/dispatch/voyages') {
      return send(
        res,
        200,
        db.voyages.map((vy) => hydrateVoyage(db, vy)),
      );
    }
    if (m === 'POST' && p === '/api/dispatch/voyages') {
      const body = await readBody(req);
      const total_teus = computeTeus(body.cont_20e, body.cont_20f, body.cont_40e, body.cont_40f);
      const recDate = body.received_date || nowIso().slice(0, 10);
      const voyageNo =
        body.voyage_no && String(body.voyage_no).trim()
          ? String(body.voyage_no).trim().toUpperCase()
          : generateNextVoyageNo(db, body.vessel_id, recDate);
      const vy = {
        id: uuid(),
        ...body,
        voyage_no: voyageNo,
        cont_20e: Number(body.cont_20e || 0),
        cont_20f: Number(body.cont_20f || 0),
        cont_40e: Number(body.cont_40e || 0),
        cont_40f: Number(body.cont_40f || 0),
        total_teus,
        status: body.status || 'PLANNED',
        received_date: body.received_date || nowIso().slice(0, 10),
        workflow_step: 0,
        fuel_start_liters: 0,
        fuel_added_liters: 0,
        fuel_end_liters: 0,
        fuel_unit_price: 21500,
        port_fee: 0,
        crew_salary: 0,
        other_cost: 0,
        captain_report_log: [],
        created_at: nowIso(),
      };
      db.voyages.unshift(vy);
      if (total_teus > 0) {
        const vessel = db.vessels.find((v) => v.id === vy.vessel_id);
        const cust = db.customers.find((c) => c.id === vy.customer_id);
        const op = db.ports.find((pt) => pt.id === vy.origin_port_id);
        const dp = db.ports.find((pt) => pt.id === vy.destination_port_id);
        const depDate = String(vy.received_date || nowIso()).slice(0, 10);
        const accMonth = depDate.slice(0, 7);
        for (const [ct, cnt] of [
          ['20E', vy.cont_20e],
          ['20F', vy.cont_20f],
          ['40E', vy.cont_40e],
          ['40F', vy.cont_40f],
        ]) {
          for (let i = 0; i < cnt; i++) {
            db.voyageContainers.push({
              id: uuid(),
              voyage_id: vy.id,
              barge_code: vessel?.code || vessel?.name || '',
              trip_no: vy.voyage_no || '',
              container_no: '',
              seal_no: null,
              booking_no: null,
              origin_name: op?.name || '',
              destination_name: dp?.name || '',
              shipper_name: cust?.name || '',
              departure_date: depDate,
              accounting_month: accMonth,
              status: vy.status || 'PLANNED',
              cont_type: ct,
              unit_price: 0,
              baf: 0,
              total_amount: 0,
              fuel_price_no_vat: 0,
              notes: null,
              created_at: nowIso(),
              updated_at: nowIso(),
            });
          }
        }
      }
      saveDb(db);
      return send(res, 201, hydrateVoyage(db, vy));
    }

    const vyContainersMatch = p.match(/^\/api\/dispatch\/voyages\/([^/]+)\/containers$/);
    if (vyContainersMatch && m === 'GET') {
      return send(
        res,
        200,
        db.voyageContainers.filter((c) => c.voyage_id === vyContainersMatch[1]),
      );
    }
    if (vyContainersMatch && m === 'POST') {
      const body = await readBody(req);
      const row = {
        id: uuid(),
        voyage_id: vyContainersMatch[1],
        ...normalizeContainerPayload(body),
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      db.voyageContainers.push(row);
      saveDb(db);
      return send(res, 201, row);
    }

    const vyBulkMatch = p.match(/^\/api\/dispatch\/voyages\/([^/]+)\/containers\/bulk$/);
    if (vyBulkMatch && m === 'POST') {
      const body = await readBody(req);
      if (body.replace) {
        db.voyageContainers = db.voyageContainers.filter((c) => c.voyage_id !== vyBulkMatch[1]);
      }
      const inserted = [];
      for (const r of Array.isArray(body.rows) ? body.rows : []) {
        const norm = normalizeContainerPayload(r);
        if (!norm.container_no && !norm.cont_type) continue;
        const row = {
          id: uuid(),
          voyage_id: vyBulkMatch[1],
          ...norm,
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        db.voyageContainers.push(row);
        inserted.push(row);
      }
      saveDb(db);
      return send(res, 201, { insertedCount: inserted.length, rows: inserted });
    }

    const vySyncMatch = p.match(/^\/api\/dispatch\/voyages\/([^/]+)\/sync-containers$/);
    if (vySyncMatch && m === 'POST') {
      const vy = db.voyages.find((x) => x.id === vySyncMatch[1]);
      if (!vy) return send(res, 404, { message: 'Voyage not found' });
      const rows = db.voyageContainers.filter((c) => c.voyage_id === vy.id);
      vy.cont_20e = rows.filter((r) => r.cont_type === '20E').length;
      vy.cont_20f = rows.filter((r) => r.cont_type === '20F').length;
      vy.cont_40e = rows.filter((r) => r.cont_type === '40E').length;
      vy.cont_40f = rows.filter((r) => r.cont_type === '40F').length;
      vy.total_teus = computeTeus(vy.cont_20e, vy.cont_20f, vy.cont_40e, vy.cont_40f);
      saveDb(db);
      return send(res, 200, vy);
    }

    if (m === 'GET' && p === '/api/dispatch/containers') {
      const enriched = db.voyageContainers.map((c) => {
        const vy = db.voyages.find((x) => x.id === c.voyage_id);
        const v = vy ? db.vessels.find((vs) => vs.id === vy.vessel_id) : null;
        return {
          ...c,
          barge_code: c.barge_code || v?.code || v?.name || '',
          trip_no: c.trip_no || vy?.voyage_no || '',
          departure_date: c.departure_date || vy?.received_date || (c.created_at || '').slice(0, 10),
        };
      });
      enriched.sort((a, b) => {
        const dA = String(a.departure_date || '').slice(0, 10);
        const dB = String(b.departure_date || '').slice(0, 10);
        if (dA !== dB) return dA.localeCompare(dB);
        const bA = String(a.barge_code || '');
        const bB = String(b.barge_code || '');
        if (bA !== bB) return bA.localeCompare(bB, 'vi');
        const tA = String(a.trip_no || '');
        const tB = String(b.trip_no || '');
        if (tA !== tB) return tA.localeCompare(tB, 'vi');
        return String(a.created_at || '').localeCompare(String(b.created_at || ''));
      });
      return send(res, 200, enriched);
    }

    const contMatch = p.match(/^\/api\/dispatch\/containers\/([^/]+)$/);
    if (contMatch && m === 'PATCH') {
      const body = await readBody(req);
      const idx = db.voyageContainers.findIndex((c) => c.id === contMatch[1]);
      if (idx < 0) return send(res, 404, { message: 'Container not found' });
      const prev = db.voyageContainers[idx];
      const merged = {
        ...prev,
        ...body,
        total_amount:
          body.total_amount !== undefined
            ? body.total_amount
            : body.unit_price !== undefined || body.baf !== undefined
              ? Number(body.unit_price ?? prev.unit_price ?? 0) + Number(body.baf ?? prev.baf ?? 0)
              : prev.total_amount,
      };
      db.voyageContainers[idx] = {
        ...prev,
        ...normalizeContainerPayload(merged),
        updated_at: nowIso(),
      };
      saveDb(db);
      return send(res, 200, db.voyageContainers[idx]);
    }
    if (contMatch && m === 'DELETE') {
      db.voyageContainers = db.voyageContainers.filter((c) => c.id !== contMatch[1]);
      saveDb(db);
      return send(res, 200, { ok: true });
    }

    const vyStatusMatch = p.match(/^\/api\/dispatch\/voyages\/([^/]+)\/status$/);
    if (vyStatusMatch && m === 'PATCH') {
      const body = await readBody(req);
      const vy = db.voyages.find((x) => x.id === vyStatusMatch[1]);
      if (!vy) return send(res, 404, { message: 'Voyage not found' });
      vy.status = body.status;
      if (body.status === 'IN_TRANSIT') vy.atd = vy.atd || nowIso();
      if (body.status === 'COMPLETED' || body.status === 'ARRIVED') vy.ata = vy.ata || nowIso();
      saveDb(db);
      return send(res, 200, vy);
    }

    const vySettlementMatch = p.match(/^\/api\/dispatch\/voyages\/([^/]+)\/settlement$/);
    if (vySettlementMatch && m === 'PATCH') {
      const body = await readBody(req);
      const idx = db.voyages.findIndex((x) => x.id === vySettlementMatch[1]);
      if (idx < 0) return send(res, 404, { message: 'Voyage not found' });
      db.voyages[idx] = { ...db.voyages[idx], ...body };
      saveDb(db);
      return send(res, 200, db.voyages[idx]);
    }

    const vyMatch = p.match(/^\/api\/dispatch\/voyages\/([^/]+)$/);
    if (vyMatch && m === 'PATCH') {
      const body = await readBody(req);
      const idx = db.voyages.findIndex((x) => x.id === vyMatch[1]);
      if (idx < 0) return send(res, 404, { message: 'Voyage not found' });
      const merged = { ...db.voyages[idx], ...body };
      merged.total_teus = computeTeus(
        merged.cont_20e,
        merged.cont_20f,
        merged.cont_40e,
        merged.cont_40f,
      );
      db.voyages[idx] = merged;
      saveDb(db);
      return send(res, 200, merged);
    }
    if (vyMatch && m === 'DELETE') {
      const vid = vyMatch[1];
      const vy = db.voyages.find((x) => x.id === vid);
      if (!vy) return send(res, 404, { message: 'Voyage not found' });

      let releasedBookings = 0;
      for (const b of db.bookings || []) {
        if (b.voyage_id === vid) {
          b.voyage_id = null;
          b.status = 'PENDING';
          b.updated_at = nowIso();
          releasedBookings++;
        }
      }
      for (const c of db.voyageContainers || []) {
        if (c.voyage_id === vid) c.voyage_id = null;
      }
      for (const pe of db.accountingPortExpenses || []) {
        if (pe.voyage_id === vid) pe.voyage_id = null;
      }
      for (const fe of db.accountingFuelEntries || []) {
        if (fe.voyage_id === vid) fe.voyage_id = null;
      }
      db.voyages = db.voyages.filter((x) => x.id !== vid);

      if (vy.vessel_id) {
        const stillRunning = db.voyages.some(
          (x) => x.vessel_id === vy.vessel_id && ['IN_TRANSIT', 'DEPARTED'].includes(x.status),
        );
        if (!stillRunning) {
          const vs = db.vessels.find((x) => x.id === vy.vessel_id);
          if (vs && vs.status === 'IN_VOYAGE') vs.status = 'AVAILABLE';
        }
      }
      saveDb(db);
      return send(res, 200, { ok: true, releasedBookings });
    }

    // --- ORDERS & CUSTOMERS ---
    if (m === 'GET' && p === '/api/orders/customers') {
      return send(res, 200, db.customers);
    }
    if (m === 'POST' && p === '/api/orders/customers') {
      const body = await readBody(req);
      const cust = {
        id: uuid(),
        code: String(body.code || '').trim().toUpperCase(),
        name: String(body.name || '').trim(),
        tax_code: body.tax_code || '',
        address: body.address || '',
        contact_person: body.contact_person || '',
        phone: body.phone || '',
        email: body.email || null,
        outstanding_debt: 0,
      };
      db.customers.push(cust);
      saveDb(db);
      return send(res, 201, cust);
    }
    const custMatch = p.match(/^\/api\/orders\/customers\/([^/]+)$/);
    if (custMatch && m === 'PATCH') {
      const body = await readBody(req);
      const idx = db.customers.findIndex((c) => c.id === custMatch[1]);
      if (idx < 0) return send(res, 404, { message: 'Customer not found' });
      db.customers[idx] = { ...db.customers[idx], ...body };
      saveDb(db);
      return send(res, 200, db.customers[idx]);
    }
    if (custMatch && m === 'DELETE') {
      const cid = custMatch[1];
      db.voyages.forEach((v) => {
        if (v.customer_id === cid) v.customer_id = null;
      });
      db.bookings.forEach((b) => {
        if (b.customer_id === cid) b.customer_id = null;
      });
      db.customers = db.customers.filter((c) => c.id !== cid);
      saveDb(db);
      return send(res, 200, { ok: true });
    }

    if (m === 'GET' && p === '/api/orders') return send(res, 200, db.orders || []);
    if (m === 'GET' && p === '/api/orders/invoices') return send(res, 200, db.invoices || []);
    const payMatch = p.match(/^\/api\/orders\/invoices\/([^/]+)\/payment$/);
    if (payMatch && m === 'PATCH') {
      const body = await readBody(req);
      const inv = db.invoices.find((i) => i.id === payMatch[1]);
      if (inv) {
        inv.paid_amount = Number(inv.paid_amount || 0) + Number(body.amount || 0);
        inv.balance_due = Math.max(0, Number(inv.total_amount) - inv.paid_amount);
        inv.payment_status = inv.balance_due <= 0 ? 'PAID' : 'PARTIAL';
        saveDb(db);
      }
      return send(res, 200, inv || { ok: true });
    }

    // --- ACCOUNTING MODULES ---
    if (m === 'GET' && p === '/api/orders/accounting/pnl') {
      const now = new Date();
      const y = Number(url.searchParams.get('year')) || now.getFullYear();
      const mo = Number(url.searchParams.get('month')) || now.getMonth() + 1;
      return send(res, 200, computeAccountingPnl(db, y, mo));
    }

    const accListMatch = p.match(/^\/api\/orders\/accounting\/([^/]+)$/);
    if (accListMatch && m === 'GET' && ACC_COLLECTION_MAP[accListMatch[1]]) {
      const key = ACC_COLLECTION_MAP[accListMatch[1]];
      let rows = [...(db[key] || [])];
      const fMonth = url.searchParams.get('month');
      const fVessel = url.searchParams.get('vessel_code');
      const fCat = url.searchParams.get('category');
      if (fMonth) rows = rows.filter((r) => r.period_month === fMonth);
      if (fVessel) rows = rows.filter((r) => String(r.vessel_code || '').toUpperCase() === fVessel.toUpperCase());
      if (fCat) rows = rows.filter((r) => String(r.category || '').toUpperCase() === fCat.toUpperCase());
      return send(res, 200, rows);
    }

    const accDelMatch = p.match(/^\/api\/orders\/accounting\/([^/]+)\/([^/]+)$/);
    if (accDelMatch && m === 'DELETE' && ACC_COLLECTION_MAP[accDelMatch[1]]) {
      const key = ACC_COLLECTION_MAP[accDelMatch[1]];
      db[key] = (db[key] || []).filter((r) => r.id !== accDelMatch[2]);
      saveDb(db);
      return send(res, 200, { ok: true });
    }

    if (m === 'POST' && p === '/api/orders/accounting/fixed-costs') {
      const body = await readBody(req);
      const periodMonth = String(body.period_month || new Date().toISOString().slice(0, 7));
      const vesselCode = body.vessel_code ? String(body.vessel_code).trim().toUpperCase() : null;
      const payload = {
        period_month: periodMonth,
        vessel_id: body.vessel_id || null,
        vessel_code: vesselCode,
        vessel_name: body.vessel_name || vesselCode,
        charter_fee: Number(body.charter_fee || 0),
        crew_salary: Number(body.crew_salary || 0),
        social_insurance: Number(body.social_insurance || 0),
        hull_insurance: Number(body.hull_insurance || 0),
        storage_fee: Number(body.storage_fee || 0),
        notes: body.notes || null,
        updated_at: nowIso(),
      };
      if (body.id) {
        const idx = db.accountingFixedCosts.findIndex((r) => r.id === body.id);
        if (idx >= 0) {
          db.accountingFixedCosts[idx] = { ...db.accountingFixedCosts[idx], ...payload };
          saveDb(db);
          return send(res, 200, db.accountingFixedCosts[idx]);
        }
      }
      const created = { id: uuid(), ...payload, created_at: nowIso() };
      db.accountingFixedCosts.unshift(created);
      saveDb(db);
      return send(res, 201, created);
    }

    if (m === 'POST' && p === '/api/orders/accounting/port-expenses') {
      const body = await readBody(req);
      const expDate = body.expense_date ? String(body.expense_date).slice(0, 10) : null;
      const vesselCode = body.vessel_code ? String(body.vessel_code).trim().toUpperCase() : null;
      const created = {
        id: uuid(),
        period_month: String(body.period_month || (expDate ? expDate.slice(0, 7) : new Date().toISOString().slice(0, 7))),
        expense_date: expDate,
        trip_no: body.trip_no || null,
        vessel_id: body.vessel_id || null,
        vessel_code: vesselCode,
        vessel_name: body.vessel_name || vesselCode,
        category: String(body.category || 'PORT_AUTH').toUpperCase(),
        amount: Number(body.amount || 0),
        description: body.description || null,
        created_at: nowIso(),
      };
      db.accountingPortExpenses.unshift(created);
      saveDb(db);
      return send(res, 201, created);
    }

    if (m === 'POST' && p === '/api/orders/accounting/fuel-entries') {
      const body = await readBody(req);
      const entryDate = body.entry_date ? String(body.entry_date).slice(0, 10) : null;
      const vesselCode = body.vessel_code ? String(body.vessel_code).trim().toUpperCase() : null;
      const litersBunkered = Number(body.liters_bunkered || 0);
      const unitPrice = Number(body.unit_price || 0);
      const discount = Number(body.discount || 0);
      const total =
        body.total_amount !== undefined && body.total_amount !== ''
          ? Number(body.total_amount)
          : Math.max(0, litersBunkered * unitPrice - discount);
      const created = {
        id: uuid(),
        period_month: String(body.period_month || (entryDate ? entryDate.slice(0, 7) : new Date().toISOString().slice(0, 7))),
        entry_date: entryDate,
        vessel_id: body.vessel_id || null,
        vessel_code: vesselCode,
        vessel_name: body.vessel_name || vesselCode,
        entry_type: String(body.entry_type || 'CONSUMPTION').toUpperCase(),
        route_label: body.route_label || null,
        liters_consumed: Number(body.liters_consumed || 0),
        liters_bunkered: litersBunkered,
        unit_price: unitPrice,
        discount,
        total_amount: total,
        notes: body.notes || null,
        created_at: nowIso(),
      };
      db.accountingFuelEntries.unshift(created);
      saveDb(db);
      return send(res, 201, created);
    }

    if (m === 'POST' && p === '/api/orders/accounting/supplies') {
      const body = await readBody(req);
      const entryDate = body.entry_date ? String(body.entry_date).slice(0, 10) : null;
      const vesselCode = body.vessel_code ? String(body.vessel_code).trim().toUpperCase() : null;
      const qty = Number(body.quantity ?? 1);
      const price = Number(body.unit_price || 0);
      const vat = Number(body.vat_rate ?? 8);
      const total =
        body.total_amount !== undefined && body.total_amount !== ''
          ? Number(body.total_amount)
          : Math.round(qty * price * (1 + vat / 100));
      const created = {
        id: uuid(),
        period_month: String(body.period_month || (entryDate ? entryDate.slice(0, 7) : new Date().toISOString().slice(0, 7))),
        entry_date: entryDate,
        vessel_id: body.vessel_id || null,
        vessel_code: vesselCode,
        vessel_name: body.vessel_name || vesselCode,
        category: String(body.category || 'SUPPLIES').toUpperCase(),
        item_name: String(body.item_name || '').trim() || 'Vật tư sà lan',
        unit: body.unit || null,
        quantity: qty,
        unit_price: price,
        vat_rate: vat,
        total_amount: total,
        invoice_no: body.invoice_no || null,
        notes: body.notes || null,
        created_at: nowIso(),
      };
      db.accountingSupplies.unshift(created);
      saveDb(db);
      return send(res, 201, created);
    }

    if (m === 'POST' && p === '/api/orders/accounting/vendor-costs') {
      const body = await readBody(req);
      const pickupDate = body.pickup_date ? String(body.pickup_date).slice(0, 10) : null;
      const unitPrice = Number(body.unit_price || 0);
      const fuelSurcharge = Number(body.fuel_surcharge || 0);
      const vat = Number(body.vat_rate ?? 8);
      const total =
        body.total_amount !== undefined && body.total_amount !== ''
          ? Number(body.total_amount)
          : Math.round((unitPrice + fuelSurcharge) * (1 + vat / 100));
      const created = {
        id: uuid(),
        period_month: String(body.period_month || (pickupDate ? pickupDate.slice(0, 7) : new Date().toISOString().slice(0, 7))),
        pickup_date: pickupDate,
        vendor_name: body.vendor_name || null,
        shipping_line: body.shipping_line || null,
        booking_no: body.booking_no ? String(body.booking_no).trim().toUpperCase() : null,
        container_no: body.container_no ? String(body.container_no).trim().toUpperCase() : null,
        cont_type: String(body.cont_type || '20F').toUpperCase(),
        vendor_barge: body.vendor_barge || null,
        origin_name: body.origin_name || null,
        destination_name: body.destination_name || null,
        freight_term: body.freight_term || 'FI-FO',
        fuel_surcharge: fuelSurcharge,
        unit_price: unitPrice,
        vat_rate: vat,
        total_amount: total,
        invoice_no: body.invoice_no || null,
        notes: body.notes || null,
        created_at: nowIso(),
      };
      db.accountingVendorCosts.unshift(created);
      saveDb(db);
      return send(res, 201, created);
    }

    // --- TRACKING / FUEL / MAINTENANCE / MOBILE ---
    if (m === 'GET' && p === '/api/tracking/fuel-logs') return send(res, 200, db.fuelLogs || []);
    if (m === 'POST' && p === '/api/tracking/fuel-logs') {
      const body = await readBody(req);
      const v = db.vessels.find((x) => x.id === body.vessel_id);
      const log = {
        id: uuid(),
        ...body,
        vessel_code: v?.code || '',
        vessel_name: v?.name || '',
        logged_at: nowIso(),
      };
      db.fuelLogs.unshift(log);
      if (v) {
        if (body.log_type === 'BUNKERING') {
          v.current_fuel_liters = Number(v.current_fuel_liters || 0) + Number(body.quantity_liters || 0);
        } else if (body.log_type === 'CONSUMPTION') {
          v.current_fuel_liters = Math.max(
            0,
            Number(v.current_fuel_liters || 0) - Number(body.quantity_liters || 0),
          );
        }
      }
      saveDb(db);
      return send(res, 201, log);
    }

    if (m === 'GET' && p === '/api/maintenance') return send(res, 200, db.maintenance || []);
    if (m === 'POST' && p === '/api/maintenance') {
      const body = await readBody(req);
      const v = db.vessels.find((x) => x.id === body.vessel_id);
      const ticket = {
        id: uuid(),
        ...body,
        vessel_code: v?.code || '',
        vessel_name: v?.name || '',
        status: 'OPEN',
        created_at: nowIso(),
      };
      db.maintenance.unshift(ticket);
      saveDb(db);
      return send(res, 201, ticket);
    }
    const mntMatch = p.match(/^\/api\/maintenance\/([^/]+)$/);
    if (mntMatch && m === 'PATCH') {
      const body = await readBody(req);
      const idx = db.maintenance.findIndex((x) => x.id === mntMatch[1]);
      if (idx < 0) return send(res, 404, { message: 'Not found' });
      db.maintenance[idx] = { ...db.maintenance[idx], ...body };
      saveDb(db);
      return send(res, 200, db.maintenance[idx]);
    }

    if (m === 'POST' && p === '/api/mobile/login') {
      const body = await readBody(req);
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!username || !password) {
        return send(res, 401, { message: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
      }
      const acc = (db.captainAccounts || []).find((a) => a.username === username);
      if (!acc || acc.is_active === false || !verifyPassword(password, acc.password_hash)) {
        return send(res, 401, { message: 'Sai tên đăng nhập hoặc mật khẩu.' });
      }
      const vessel = (db.vessels || []).find(
        (v) => String(v.code || '').toUpperCase() === String(acc.vessel_code || '').toUpperCase(),
      ) || null;
      const captain = {
        id: acc.id,
        username: acc.username,
        full_name: acc.full_name,
        vessel_code: acc.vessel_code,
        role: acc.role || 'CAPTAIN',
      };
      return send(res, 200, { token: signCaptainToken(captain), captain, vessel });
    }

    if (m === 'GET' && p === '/api/mobile/workspace') {
      const auth = requireCaptainAuth(req, res, db);
      if (!auth) return;
      const voyages = (db.voyages || [])
        .filter((vy) => vy.vessel_id === auth.vessel.id)
        .sort((a, b) =>
          String(b.received_date || b.created_at || '').localeCompare(
            String(a.received_date || a.created_at || ''),
          ),
        )
        .slice(0, 60)
        .map((vy) => hydrateVoyage(db, vy));
      const fuelLogs = (db.fuelLogs || []).filter((fl) => fl.vessel_id === auth.vessel.id);
      const maintenanceOrders = (db.maintenance || []).filter(
        (mt) => mt.vessel_id === auth.vessel.id,
      );
      const tallyPhotos = (db.voyageTallyPhotos || [])
        .filter((tp) => tp.vessel_id === auth.vessel.id)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .slice(0, 50);
      return send(res, 200, {
        captain: auth.captain,
        vessel: auth.vessel,
        voyages,
        fuelLogs,
        maintenanceOrders,
        tallyPhotos,
      });
    }

    if (m === 'GET' && p === '/api/mobile/captain-summary') {
      const auth = requireCaptainAuth(req, res, db);
      if (!auth) return;
      const activeVoyage =
        db.voyages.find(
          (vy) =>
            vy.vessel_id === auth.vessel.id &&
            ['PLANNED', 'DEPARTED', 'IN_TRANSIT', 'ARRIVED'].includes(vy.status),
        ) || null;
      return send(res, 200, {
        captain: auth.captain,
        vessel: auth.vessel,
        activeVoyage: activeVoyage ? hydrateVoyage(db, activeVoyage) : null,
      });
    }

    if (m === 'POST' && p === '/api/mobile/fuel') {
      const auth = requireCaptainAuth(req, res, db);
      if (!auth) return;
      const body = await readBody(req);
      if (body.vessel_id && body.vessel_id !== auth.vessel.id) {
        return send(res, 403, { message: 'Không được phép nhập dầu cho sà lan khác.' });
      }
      if (body.voyage_id) {
        const vy = db.voyages.find((x) => x.id === body.voyage_id);
        if (!vy || vy.vessel_id !== auth.vessel.id) {
          return send(res, 403, { message: 'Chuyến không thuộc sà lan của bạn.' });
        }
      }
      const qty = Number(body.quantity_liters || 0);
      const log = {
        id: uuid(),
        ...body,
        vessel_id: auth.vessel.id,
        vessel_code: auth.vessel.code || '',
        vessel_name: auth.vessel.name || '',
        reported_by: body.reported_by || auth.captain.full_name,
        logged_at: nowIso(),
      };
      db.fuelLogs.unshift(log);
      if (body.log_type === 'BUNKERING') {
        auth.vessel.current_fuel_liters = Number(auth.vessel.current_fuel_liters || 0) + qty;
      } else if (body.log_type === 'CONSUMPTION') {
        auth.vessel.current_fuel_liters = Math.max(0, Number(auth.vessel.current_fuel_liters || 0) - qty);
      } else if (body.log_type === 'ROB') {
        auth.vessel.current_fuel_liters = qty;
      }
      saveDb(db);
      return send(res, 201, log);
    }

    if (m === 'POST' && p === '/api/mobile/maintenance') {
      const auth = requireCaptainAuth(req, res, db);
      if (!auth) return;
      const body = await readBody(req);
      if (body.vessel_id && body.vessel_id !== auth.vessel.id) {
        return send(res, 403, { message: 'Không được phép báo sự cố cho sà lan khác.' });
      }
      const ticket = {
        id: uuid(),
        ticket_no: `MNT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
        ...body,
        vessel_id: auth.vessel.id,
        vessel_code: auth.vessel.code || '',
        vessel_name: auth.vessel.name || '',
        reported_by: body.reported_by || auth.captain.full_name,
        status: 'OPEN',
        created_at: nowIso(),
      };
      db.maintenance.unshift(ticket);
      saveDb(db);
      return send(res, 201, ticket);
    }

    if (m === 'POST' && p === '/api/mobile/tally-photos') {
      const auth = requireCaptainAuth(req, res, db);
      if (!auth) return;
      const body = await readBody(req);
      if (!body?.voyage_id) return send(res, 400, { message: 'Thiếu mã chuyến.' });
      if (body.vessel_id && body.vessel_id !== auth.vessel.id) {
        return send(res, 403, { message: 'Không được phép gửi ảnh Tally cho sà lan khác.' });
      }
      const vy = (db.voyages || []).find((x) => x.id === body.voyage_id);
      if (!vy || vy.vessel_id !== auth.vessel.id) {
        return send(res, 403, { message: 'Chuyến không thuộc sà lan của bạn.' });
      }
      if (!body?.image_data_url) return send(res, 400, { message: 'Thiếu dữ liệu ảnh Tally.' });
      const decoded = decodeBase64DataUrl(body.image_data_url);
      const photoId = uuid();
      const uploaded = await uploadTallyImage({
        photoId,
        voyageCodeOrId: vy.voyage_no || vy.id,
        buffer: decoded.buffer,
        mimeType: decoded.mimeType,
        ext: decoded.ext,
      });
      const rec = {
        id: photoId,
        voyage_id: vy.id,
        vessel_id: auth.vessel.id,
        image_url: uploaded.image_url,
        r2_key: uploaded.r2_key,
        storage_provider: uploaded.storage_provider,
        mime_type: decoded.mimeType,
        original_size_bytes: Number(body.original_size_bytes || decoded.buffer.length),
        compressed_size_bytes: decoded.buffer.length,
        uploaded_by: body.uploaded_by || auth.captain.full_name,
        notes: body.notes || null,
        ai_status: 'PENDING',
        ai_provider: null,
        ai_raw_text: null,
        ai_extracted_containers: [],
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      db.voyageTallyPhotos = [rec, ...(db.voyageTallyPhotos || [])];
      saveDb(db);
      return send(res, 201, rec);
    }

    if (m === 'POST' && p === '/api/mobile/checkin') {
      const auth = requireCaptainAuth(req, res, db);
      if (!auth) return;
      const body = await readBody(req);
      if (body.vessel_id && body.vessel_id !== auth.vessel.id) {
        return send(res, 403, { message: 'Không được phép Check-in cho sà lan khác.' });
      }
      if (body.voyage_id) {
        const vy = db.voyages.find((x) => x.id === body.voyage_id);
        if (!vy || vy.vessel_id !== auth.vessel.id) {
          return send(res, 403, { message: 'Bạn không có quyền thao tác chuyến của sà lan khác.' });
        }
        if (body.action === 'DEPART') vy.status = 'IN_TRANSIT';
        if (body.action === 'ARRIVE') vy.status = 'ARRIVED';
      }
      if (body.lat !== undefined && body.lng !== undefined) {
        auth.vessel.lat = Number(body.lat);
        auth.vessel.lng = Number(body.lng);
      }
      saveDb(db);
      return send(res, 200, { ok: true, action: body.action || 'CHECKPOINT' });
    }

    if (m === 'POST' && p === '/api/mobile/step') {
      const auth = requireCaptainAuth(req, res, db);
      if (!auth) return;
      const body = await readBody(req);
      if (body.vessel_id && body.vessel_id !== auth.vessel.id) {
        return send(res, 403, { message: 'Bạn không có quyền báo cáo cho sà lan khác.' });
      }
      const ts = body.timestamp || nowIso();
      const vy = db.voyages.find((x) => x.id === body.voyage_id);
      if (!vy || vy.vessel_id !== auth.vessel.id) {
        return send(res, 403, { message: 'Không tìm thấy chuyến thuộc sà lan của bạn.' });
      }
      vy.workflow_step = Math.max(Number(vy.workflow_step || 0), Number(body.step || 0));
      if (body.step === 2) vy.loading_completed_at = vy.loading_completed_at || ts;
      if (body.step === 3) {
        vy.status = 'IN_TRANSIT';
        vy.atd = vy.atd || ts;
      }
      if (body.step === 4) {
        vy.status = 'ARRIVED';
        vy.ata = vy.ata || ts;
        vy.laytime_start_at = vy.laytime_start_at || ts;
      }
      if (body.step === 5) {
        vy.status = 'COMPLETED';
        vy.completed_unloading_at = vy.completed_unloading_at || ts;
        db.bookings.forEach((b) => {
          if (b.voyage_id === vy.id) b.status = 'COMPLETED';
        });
      }
      if (body.fuel_start_liters !== undefined) vy.fuel_start_liters = Number(body.fuel_start_liters);
      if (body.fuel_added_liters !== undefined) vy.fuel_added_liters = Number(body.fuel_added_liters);
      if (body.fuel_end_liters !== undefined) vy.fuel_end_liters = Number(body.fuel_end_liters);
      if (body.fuel_start_photo_url) vy.fuel_start_photo_url = body.fuel_start_photo_url;
      if (body.pod_photo_url) vy.pod_photo_url = body.pod_photo_url;
      vy.captain_report_log = [
        ...(vy.captain_report_log || []),
        { step: body.step, timestamp: ts, lat: body.lat ?? null, lng: body.lng ?? null, notes: body.notes ?? null },
      ];
      const v = auth.vessel;
      if (v) {
        if (body.step === 3) v.status = 'IN_VOYAGE';
        if (body.step === 5) v.status = 'AVAILABLE';
        if (body.step === 1 && body.fuel_start_liters !== undefined) {
          v.current_fuel_liters = Number(body.fuel_start_liters);
        }
        if (body.step === 5 && body.fuel_end_liters !== undefined) {
          v.current_fuel_liters = Number(body.fuel_end_liters);
        }
      }
      saveDb(db);
      return send(res, 200, { ok: true, voyage: vy });
    }

    return send(res, 404, { message: `Unknown local API route: ${m} ${p}` });
  } catch (err) {
    console.error(err);
    return send(res, 500, { message: err?.message || 'Local API error' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`VietSun TMS Local API running at http://127.0.0.1:${PORT}/api (DB: ${DB_FILE})`);
});
