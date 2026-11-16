#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const SNAPSHOT_FILE = path.resolve(rootDir, 'database/snapshot-local.json');
const LOCAL_DB_FILE = path.resolve(rootDir, 'apps/api/.local-db.json');

function detUuid(key) {
  const hex = crypto.createHash('md5').update(String(key)).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const DEMO_VOYAGE_NOS = new Set([
  'VOY-2026-3239',
  'VOY-2026-0081',
  'V.36-04926E',
  'VOY-2026-7871',
]);

const DEMO_VOYAGE_IDS = new Set([
  'a1b80c3a-c150-48ee-8f2a-0ccf9c738311',
  '55555555-5555-5555-5555-555555555501',
  'e10a9e5a-5671-4aa0-88e4-24661dc3bb23',
]);

function computeTeus(c20e = 0, c20f = 0, c40e = 0, c40f = 0) {
  return Number(c20e || 0) + Number(c20f || 0) + (Number(c40e || 0) + Number(c40f || 0)) * 2;
}

function cleanSnapshot(db) {
  const vesselsById = new Map((db.vessels || []).map((v) => [v.id, v]));
  const ports = db.ports || [];
  const portsById = new Map(ports.map((p) => [p.id, p]));
  const custsById = new Map((db.customers || []).map((c) => [c.id, c]));

  const findPort = (codeOrName) => {
    const k = String(codeOrName || '').trim().toUpperCase();
    return ports.find(
      (p) =>
        String(p.code || '').toUpperCase() === k ||
        String(p.name || '').toUpperCase() === k ||
        String(p.name || '').toUpperCase().includes(k),
    );
  };

  // 1. Remove demo voyages, demo bookings, demo orders, demo invoices
  const voyages = (db.voyages || []).filter(
    (v) => !DEMO_VOYAGE_NOS.has(v.voyage_no) && !DEMO_VOYAGE_IDS.has(v.id),
  );
  const validVoyageIds = new Set(voyages.map((v) => v.id));

  let bookings = (db.bookings || []).filter((b) => {
    const bno = String(b.booking_no || '');
    if (bno.startsWith('BK-26-')) return false;
    if (b.voyage_id && DEMO_VOYAGE_IDS.has(b.voyage_id)) return false;
    if (b.voyage_id && !validVoyageIds.has(b.voyage_id)) return false;
    return true;
  });

  // Add the 3 real unassigned bookings from KẾ HOẠCH - ĐIỀU ĐỘNG SÀ LAN NHẬT VIỆT.xlsx (BOOKING_INPUT R109-R111)
  const portBN = findPort('BN') || findPort('BẾN NGHÉ');
  const portTCCC = findPort('TCCC') || findPort('CÁI CUI');
  const portTN = findPort('TN') || findPort('TRÀ NÓC');
  const custLines = (db.customers || []).find((c) =>
    String(c.code || c.name || '').toUpperCase().includes('LINES'),
  );

  const pendingExcelBookings = [
    {
      id: detUuid('booking-excel-r109-2026-11-09'),
      booking_no: 'BK-261109-01',
      cargo_direction: 'EXPORT',
      customer_id: custLines?.id || null,
      customer_name: custLines?.name || 'LINES HP',
      origin_port_id: portBN?.id || null,
      origin_name: portBN?.name || 'BẾN NGHÉ',
      destination_port_id: portTCCC?.id || null,
      dest_name: portTCCC?.name || 'TÂN CẢNG CÁI CUI',
      cont_20e: 0,
      cont_20f: 3,
      cont_40e: 0,
      cont_40f: 0,
      total_teus: 3,
      closing_time: null,
      voyage_id: null,
      status: 'PENDING',
      estimated_freight: 0,
      pic_name: 'Mr Nguyên',
      notes: 'BOOKING_INPUT (09/11/2026) — Chưa phân bổ sà lan',
      created_at: '2026-11-09T08:00:00.000Z',
      updated_at: '2026-11-09T08:00:00.000Z',
    },
    {
      id: detUuid('booking-excel-r110-2026-11-09'),
      booking_no: 'BK-261109-02',
      cargo_direction: 'EXPORT',
      customer_id: custLines?.id || null,
      customer_name: custLines?.name || 'LINES HP',
      origin_port_id: portBN?.id || null,
      origin_name: portBN?.name || 'BẾN NGHÉ',
      destination_port_id: portTN?.id || null,
      dest_name: portTN?.name || 'TRÀ NÓC',
      cont_20e: 0,
      cont_20f: 12,
      cont_40e: 0,
      cont_40f: 0,
      total_teus: 12,
      closing_time: null,
      voyage_id: null,
      status: 'PENDING',
      estimated_freight: 0,
      pic_name: 'Mr Nguyên',
      notes: 'BOOKING_INPUT (09/11/2026) — Chưa phân bổ sà lan',
      created_at: '2026-11-09T08:05:00.000Z',
      updated_at: '2026-11-09T08:05:00.000Z',
    },
    {
      id: detUuid('booking-excel-r111-2026-11-09'),
      booking_no: 'BK-261109-03',
      cargo_direction: 'EXPORT',
      customer_id: custLines?.id || null,
      customer_name: custLines?.name || 'LINES HP',
      origin_port_id: portBN?.id || null,
      origin_name: portBN?.name || 'BẾN NGHÉ',
      destination_port_id: portTCCC?.id || null,
      dest_name: portTCCC?.name || 'TÂN CẢNG CÁI CUI',
      cont_20e: 0,
      cont_20f: 1,
      cont_40e: 0,
      cont_40f: 0,
      total_teus: 1,
      closing_time: null,
      voyage_id: null,
      status: 'PENDING',
      estimated_freight: 0,
      pic_name: 'Mr Nguyên',
      notes: 'BOOKING_INPUT (09/11/2026) — Chưa phân bổ sà lan',
      created_at: '2026-11-09T08:10:00.000Z',
      updated_at: '2026-11-09T08:10:00.000Z',
    },
  ];
  const existingBkNos = new Set(bookings.map((b) => b.booking_no));
  for (const pb of pendingExcelBookings) {
    if (!existingBkNos.has(pb.booking_no)) {
      bookings.unshift(pb);
    }
  }

  // Reconcile voyage cont counts from linked bookings where bookings exist (fixes PT16-261106 1 -> 10 TEU)
  const bksByVoyage = new Map();
  for (const b of bookings) {
    if (!b.voyage_id) continue;
    if (!bksByVoyage.has(b.voyage_id)) bksByVoyage.set(b.voyage_id, []);
    bksByVoyage.get(b.voyage_id).push(b);
  }
  for (const vy of voyages) {
    const linked = bksByVoyage.get(vy.id);
    if (linked && linked.length > 0) {
      const s20e = linked.reduce((s, b) => s + Number(b.cont_20e || 0), 0);
      const s20f = linked.reduce((s, b) => s + Number(b.cont_20f || 0), 0);
      const s40e = linked.reduce((s, b) => s + Number(b.cont_40e || 0), 0);
      const s40f = linked.reduce((s, b) => s + Number(b.cont_40f || 0), 0);
      const sTeus = computeTeus(s20e, s20f, s40e, s40f);
      if (sTeus > 0) {
        vy.cont_20e = s20e;
        vy.cont_20f = s20f;
        vy.cont_40e = s40e;
        vy.cont_40f = s40f;
        vy.total_teus = sTeus;
      }
    }
  }

  // 2. Keep ONLY verified 2026-10 containers from October Revenue Excel (exact 871 conts)
  const octContainers = (db.voyageContainers || []).filter((c) => {
    if (c.accounting_month !== '2026-10') return false;
    if (['VOY-2026-3239', 'VOY-2026-0081', 'VOY-2026-7871'].includes(c.trip_no)) return false;
    return true;
  });

  // 3. Generate container rows (with container_no = '' when not yet updated) for all 2026-11 voyages
  const novContainers = [];
  const novVoyages = voyages
    .filter((vy) => String(vy.received_date || '').slice(0, 7) === '2026-11')
    .sort((a, b) => String(a.received_date || '').localeCompare(String(b.received_date || '')));

  for (const vy of novVoyages) {
    const vessel = vesselsById.get(vy.vessel_id);
    const bargeCode = vessel?.code || vy.vessel_code || '';
    const vesselName = vessel?.name || vy.vessel_name || '';
    const depDate = String(vy.received_date || '').slice(0, 10);
    const linked = bksByVoyage.get(vy.id) || [];

    const sources =
      linked.length > 0
        ? linked.map((bk, idx) => ({
            key: `${vy.id}-${bk.id || idx}`,
            booking_no: bk.booking_no || null,
            origin_name: bk.origin_name || portsById.get(vy.origin_port_id)?.name || '',
            destination_name: bk.dest_name || portsById.get(vy.destination_port_id)?.name || '',
            shipper_name: bk.customer_name || custsById.get(vy.customer_id)?.name || '',
            c20e: Number(bk.cont_20e || 0),
            c20f: Number(bk.cont_20f || 0),
            c40e: Number(bk.cont_40e || 0),
            c40f: Number(bk.cont_40f || 0),
          }))
        : [
            {
              key: `${vy.id}-direct`,
              booking_no: null,
              origin_name: portsById.get(vy.origin_port_id)?.name || vy.origin_name || '',
              destination_name: portsById.get(vy.destination_port_id)?.name || vy.dest_name || '',
              shipper_name: custsById.get(vy.customer_id)?.name || vy.customer_name || '',
              c20e: Number(vy.cont_20e || 0),
              c20f: Number(vy.cont_20f || 0),
              c40e: Number(vy.cont_40e || 0),
              c40f: Number(vy.cont_40f || 0),
            },
          ];

    for (const src of sources) {
      const pairs = [
        ['20E', src.c20e],
        ['20F', src.c20f],
        ['40E', src.c40e],
        ['40F', src.c40f],
      ];
      for (const [ct, count] of pairs) {
        for (let i = 1; i <= count; i++) {
          novContainers.push({
            id: detUuid(`nov-cont-${src.key}-${ct}-${i}`),
            voyage_id: vy.id,
            barge_code: bargeCode,
            trip_no: vy.voyage_no,
            container_no: '',
            seal_no: null,
            booking_no: src.booking_no,
            origin_name: src.origin_name,
            destination_name: src.destination_name,
            shipper_name: src.shipper_name,
            departure_date: depDate,
            accounting_month: '2026-11',
            status: vy.status || 'COMPLETED',
            cont_type: ct,
            unit_price: 0,
            baf: 0,
            total_amount: 0,
            fuel_price_no_vat: 0,
            notes: null,
            created_at: `${depDate}T00:00:00.000Z`,
            updated_at: `${depDate}T00:00:00.000Z`,
            vessel_id: vy.vessel_id,
            vessel_code: bargeCode,
            vessel_name: vesselName,
          });
        }
      }
    }
  }

  return {
    ...db,
    voyages,
    bookings,
    voyageContainers: [...octContainers, ...novContainers],
    orders: [],
    invoices: [],
  };
}

const snap = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
const cleanedSnap = cleanSnapshot(snap);
fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(cleanedSnap, null, 2), 'utf8');

if (fs.existsSync(LOCAL_DB_FILE)) {
  const localDb = JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf8'));
  const cleanedLocal = cleanSnapshot({
    ...cleanedSnap,
    captainAccounts: localDb.captainAccounts || [],
    fuelLogs: localDb.fuelLogs || cleanedSnap.fuelLogs || [],
    maintenance: localDb.maintenance || cleanedSnap.maintenance || [],
  });
  cleanedLocal.captainAccounts = localDb.captainAccounts || [];
  fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(cleanedLocal, null, 2), 'utf8');
}

const statsByMonth = {};
for (const c of cleanedSnap.voyageContainers) {
  const m = c.accounting_month || 'unknown';
  if (!statsByMonth[m]) statsByMonth[m] = { count: 0, c20e: 0, c20f: 0, c40e: 0, c40f: 0, teus: 0, rev: 0 };
  statsByMonth[m].count++;
  if (c.cont_type === '20E') { statsByMonth[m].c20e++; statsByMonth[m].teus += 1; }
  else if (c.cont_type === '20F') { statsByMonth[m].c20f++; statsByMonth[m].teus += 1; }
  else if (c.cont_type === '40E') { statsByMonth[m].c40e++; statsByMonth[m].teus += 2; }
  else if (c.cont_type === '40F') { statsByMonth[m].c40f++; statsByMonth[m].teus += 2; }
  statsByMonth[m].rev += Number(c.total_amount || 0);
}
console.log('Cleaned snapshot counts:', {
  voyages: cleanedSnap.voyages.length,
  bookings: cleanedSnap.bookings.length,
  pendingBookings: cleanedSnap.bookings.filter((b) => b.status === 'PENDING').length,
  voyageContainers: cleanedSnap.voyageContainers.length,
  orders: cleanedSnap.orders.length,
  invoices: cleanedSnap.invoices.length,
});
console.log('Containers by month:', statsByMonth);
