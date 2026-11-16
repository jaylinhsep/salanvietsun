#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

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
  };
}

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    const seed = defaultSeedDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf8');
    return seed;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
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

  const detailTeus = details.reduce(
    (s, c) => s + (c.cont_type === '40E' || c.cont_type === '40F' ? 2 : 1),
    0,
  );
  const detailRev = details.reduce((s, c) => s + Number(c.total_amount || 0), 0);
  const estFreight = linkedBookings.reduce((s, b) => s + Number(b.estimated_freight || 0), 0);
  const bookingNos =
    linkedBookings.length > 0 ? linkedBookings.map((b) => b.booking_no).join(', ') : vy.booking_nos;
  const earliestClosing =
    linkedBookings
      .map((b) => b.closing_time)
      .filter(Boolean)
      .sort()[0] || vy.earliest_closing_time;

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
    detail_teus: detailTeus,
    detail_revenue: detailRev,
    booking_nos: bookingNos,
    earliest_closing_time: earliestClosing,
    estimated_freight: estFreight || vy.estimated_freight || 0,
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
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
        cont_20e: Number(body.cont_20e || 0),
        cont_20f: Number(body.cont_20f || 0),
        cont_40e: Number(body.cont_40e || 0),
        cont_40f: Number(body.cont_40f || 0),
        total_teus: computeTeus(body.cont_20e, body.cont_20f, body.cont_40e, body.cont_40f),
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
      if (selected.length === 0) return send(res, 400, { ok: false, message: 'No bookings' });

      const sum20e = selected.reduce((s, b) => s + Number(b.cont_20e || 0), 0);
      const sum20f = selected.reduce((s, b) => s + Number(b.cont_20f || 0), 0);
      const sum40e = selected.reduce((s, b) => s + Number(b.cont_40e || 0), 0);
      const sum40f = selected.reduce((s, b) => s + Number(b.cont_40f || 0), 0);
      const sumTeus = computeTeus(sum20e, sum20f, sum40e, sum40f);
      const first = selected[0];

      let targetVoyageId = body.voyage_id || null;
      if (targetVoyageId) {
        const vy = db.voyages.find((v) => v.id === targetVoyageId);
        if (vy) {
          vy.cont_20e = Number(vy.cont_20e || 0) + sum20e;
          vy.cont_20f = Number(vy.cont_20f || 0) + sum20f;
          vy.cont_40e = Number(vy.cont_40e || 0) + sum40e;
          vy.cont_40f = Number(vy.cont_40f || 0) + sum40f;
          vy.total_teus = Number(vy.total_teus || 0) + sumTeus;
        }
      } else {
        targetVoyageId = uuid();
        const vessel = db.vessels.find((v) => v.id === body.vessel_id);
        db.voyages.unshift({
          id: targetVoyageId,
          voyage_no:
            body.voyage_no ||
            `VOY-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
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

      for (const b of db.bookings) {
        if (ids.includes(b.id)) {
          b.voyage_id = targetVoyageId;
          b.status = 'ASSIGNED';
          b.updated_at = nowIso();
        }
      }
      saveDb(db);
      return send(res, 200, { ok: true, voyage_id: targetVoyageId, assignedCount: selected.length });
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
        estimated_freight: Number(body.estimated_freight ?? prev.estimated_freight ?? 0),
        updated_at: nowIso(),
      };
      next.total_teus = computeTeus(next.cont_20e, next.cont_20f, next.cont_40e, next.cont_40f);
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
      const vy = {
        id: uuid(),
        ...body,
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
        if (!norm.container_no) continue;
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

    const contMatch = p.match(/^\/api\/dispatch\/containers\/([^/]+)$/);
    if (contMatch && m === 'PATCH') {
      const body = await readBody(req);
      const idx = db.voyageContainers.findIndex((c) => c.id === contMatch[1]);
      if (idx < 0) return send(res, 404, { message: 'Container not found' });
      db.voyageContainers[idx] = {
        ...db.voyageContainers[idx],
        ...normalizeContainerPayload(body),
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

    if (m === 'GET' && p === '/api/mobile/captain-summary') {
      const vesselCode = url.searchParams.get('vesselCode') || '';
      const vessel = db.vessels.find((v) => v.code === vesselCode) || db.vessels[0] || null;
      const activeVoyage = vessel
        ? db.voyages.find(
            (vy) =>
              vy.vessel_id === vessel.id &&
              ['PLANNED', 'DEPARTED', 'IN_TRANSIT', 'ARRIVED'].includes(vy.status),
          ) || null
        : null;
      return send(res, 200, {
        vessel,
        activeVoyage: activeVoyage ? hydrateVoyage(db, activeVoyage) : null,
      });
    }

    if (m === 'POST' && p === '/api/mobile/step') {
      const body = await readBody(req);
      const ts = body.timestamp || nowIso();
      const vy = db.voyages.find((x) => x.id === body.voyage_id);
      if (vy) {
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
      }
      const v = db.vessels.find((x) => x.id === body.vessel_id);
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
