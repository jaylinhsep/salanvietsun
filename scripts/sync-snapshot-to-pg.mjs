#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

// Load pg from apps/api/node_modules cleanly on VPS/Windows
const { Pool } = require(path.resolve(rootDir, 'apps/api/node_modules/pg'));

function readEnvDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const envFile of [
    path.resolve(rootDir, 'apps/api/.env'),
    path.resolve(rootDir, '.env'),
  ]) {
    if (!fs.existsSync(envFile)) continue;
    const text = fs.readFileSync(envFile, 'utf8');
    const m = text.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  return 'postgresql://vietsun:vietsun_secret_password@localhost:5432/salanvietsun_tms';
}

const SNAPSHOT_FILE = path.resolve(rootDir, 'database/snapshot-local.json');
if (!fs.existsSync(SNAPSHOT_FILE)) {
  console.log('No snapshot file found at', SNAPSHOT_FILE);
  process.exit(0);
}

const snap = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
const pool = new Pool({ connectionString: readEnvDatabaseUrl() });

async function ensureSchema(client) {
  await client.query(`
    ALTER TABLE voyages DROP CONSTRAINT IF EXISTS voyages_voyage_no_key;
    ALTER TABLE voyages ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
    ALTER TABLE voyages ADD COLUMN IF NOT EXISTS received_date DATE DEFAULT CURRENT_DATE;
    ALTER TABLE voyages ADD COLUMN IF NOT EXISTS pic_name VARCHAR(100);
    ALTER TABLE voyages ADD COLUMN IF NOT EXISTS cont_20e INT DEFAULT 0;
    ALTER TABLE voyages ADD COLUMN IF NOT EXISTS cont_20f INT DEFAULT 0;
    ALTER TABLE voyages ADD COLUMN IF NOT EXISTS cont_40e INT DEFAULT 0;
    ALTER TABLE voyages ADD COLUMN IF NOT EXISTS cont_40f INT DEFAULT 0;
    ALTER TABLE voyages ADD COLUMN IF NOT EXISTS total_teus INT DEFAULT 0;
    ALTER TABLE voyages ADD COLUMN IF NOT EXISTS vessel_berth_date DATE;
    ALTER TABLE voyages ADD COLUMN IF NOT EXISTS order_deadline DATE;
    ALTER TABLE voyages ADD COLUMN IF NOT EXISTS workflow_step INT DEFAULT 0;

    ALTER TABLE vessels ADD COLUMN IF NOT EXISTS is_vendor_barge BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE vessels ADD COLUMN IF NOT EXISTS notes TEXT;

    CREATE TABLE IF NOT EXISTS bookings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_no VARCHAR(80) NOT NULL,
      cargo_direction VARCHAR(20) NOT NULL DEFAULT 'EXPORT',
      customer_id UUID REFERENCES customers(id),
      customer_name VARCHAR(150),
      origin_port_id UUID REFERENCES ports(id),
      origin_name VARCHAR(150),
      destination_port_id UUID REFERENCES ports(id),
      dest_name VARCHAR(150),
      cont_20e INT NOT NULL DEFAULT 0,
      cont_20f INT NOT NULL DEFAULT 0,
      cont_40e INT NOT NULL DEFAULT 0,
      cont_40f INT NOT NULL DEFAULT 0,
      total_teus INT NOT NULL DEFAULT 0,
      closing_time TIMESTAMPTZ,
      voyage_id UUID REFERENCES voyages(id) ON DELETE SET NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      estimated_freight NUMERIC(14, 2) NOT NULL DEFAULT 0,
      pic_name VARCHAR(100),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cargo_direction VARCHAR(20) NOT NULL DEFAULT 'EXPORT';
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pic_name VARCHAR(100);

    CREATE TABLE IF NOT EXISTS voyage_containers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      voyage_id UUID REFERENCES voyages(id) ON DELETE CASCADE,
      barge_code VARCHAR(80),
      trip_no VARCHAR(80),
      container_no VARCHAR(40) NOT NULL,
      seal_no VARCHAR(60),
      booking_no VARCHAR(80),
      origin_name VARCHAR(150),
      destination_name VARCHAR(150),
      shipper_name VARCHAR(150),
      departure_date DATE,
      accounting_month VARCHAR(7),
      status VARCHAR(30) DEFAULT 'PLANNED',
      cont_type VARCHAR(10) NOT NULL DEFAULT '20F',
      unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
      baf NUMERIC(14, 2) NOT NULL DEFAULT 0,
      total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
      fuel_price_no_vat NUMERIC(14, 2) NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE voyage_containers ALTER COLUMN voyage_id DROP NOT NULL;
    ALTER TABLE voyage_containers ADD COLUMN IF NOT EXISTS seal_no VARCHAR(60);
    ALTER TABLE voyage_containers ADD COLUMN IF NOT EXISTS booking_no VARCHAR(80);
    ALTER TABLE voyage_containers ADD COLUMN IF NOT EXISTS accounting_month VARCHAR(7);
    ALTER TABLE voyage_containers ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'PLANNED';

    CREATE TABLE IF NOT EXISTS accounting_fixed_costs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      period_month VARCHAR(7) NOT NULL,
      vessel_id UUID REFERENCES vessels(id) ON DELETE CASCADE,
      vessel_code VARCHAR(80),
      vessel_name VARCHAR(150),
      charter_fee NUMERIC(14, 2) NOT NULL DEFAULT 0,
      crew_salary NUMERIC(14, 2) NOT NULL DEFAULT 0,
      social_insurance NUMERIC(14, 2) NOT NULL DEFAULT 0,
      hull_insurance NUMERIC(14, 2) NOT NULL DEFAULT 0,
      storage_fee NUMERIC(14, 2) NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS accounting_port_expenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      period_month VARCHAR(7) NOT NULL,
      expense_date DATE,
      trip_no VARCHAR(80),
      voyage_id UUID REFERENCES voyages(id) ON DELETE SET NULL,
      linked_trip_no VARCHAR(80),
      vessel_id UUID REFERENCES vessels(id) ON DELETE SET NULL,
      vessel_code VARCHAR(80),
      vessel_name VARCHAR(150),
      category VARCHAR(30) NOT NULL DEFAULT 'PORT_AUTH',
      amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE accounting_port_expenses ADD COLUMN IF NOT EXISTS voyage_id UUID REFERENCES voyages(id) ON DELETE SET NULL;
    ALTER TABLE accounting_port_expenses ADD COLUMN IF NOT EXISTS linked_trip_no VARCHAR(80);

    CREATE TABLE IF NOT EXISTS accounting_fuel_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      period_month VARCHAR(7) NOT NULL,
      entry_date DATE,
      vessel_id UUID REFERENCES vessels(id) ON DELETE SET NULL,
      vessel_code VARCHAR(80),
      vessel_name VARCHAR(150),
      entry_type VARCHAR(20) NOT NULL DEFAULT 'CONSUMPTION',
      route_label VARCHAR(200),
      voyage_id UUID REFERENCES voyages(id) ON DELETE SET NULL,
      linked_trip_no VARCHAR(80),
      liters_consumed NUMERIC(12, 2) NOT NULL DEFAULT 0,
      liters_bunkered NUMERIC(12, 2) NOT NULL DEFAULT 0,
      unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
      discount NUMERIC(14, 2) NOT NULL DEFAULT 0,
      total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE accounting_fuel_entries ADD COLUMN IF NOT EXISTS voyage_id UUID REFERENCES voyages(id) ON DELETE SET NULL;
    ALTER TABLE accounting_fuel_entries ADD COLUMN IF NOT EXISTS linked_trip_no VARCHAR(80);

    CREATE TABLE IF NOT EXISTS accounting_supplies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      period_month VARCHAR(7) NOT NULL,
      entry_date DATE,
      vessel_id UUID REFERENCES vessels(id) ON DELETE SET NULL,
      vessel_code VARCHAR(80),
      vessel_name VARCHAR(150),
      category VARCHAR(30) NOT NULL DEFAULT 'SUPPLIES',
      item_name VARCHAR(255) NOT NULL,
      unit VARCHAR(40),
      quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
      unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
      vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 8,
      total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
      invoice_no VARCHAR(80),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS accounting_vendor_costs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      period_month VARCHAR(7) NOT NULL,
      pickup_date DATE,
      vendor_name VARCHAR(150),
      shipping_line VARCHAR(80),
      booking_no VARCHAR(80),
      container_no VARCHAR(40),
      cont_type VARCHAR(10) NOT NULL DEFAULT '20F',
      vendor_barge VARCHAR(120),
      origin_name VARCHAR(120),
      destination_name VARCHAR(120),
      freight_term VARCHAR(30) DEFAULT 'FI-FO',
      fuel_surcharge NUMERIC(14, 2) NOT NULL DEFAULT 0,
      unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
      vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 8,
      total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
      invoice_no VARCHAR(80),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS accounting_historical_monthly (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      year INT NOT NULL,
      month INT NOT NULL,
      vessel_code VARCHAR(80) NOT NULL,
      revenue NUMERIC(14, 2) NOT NULL DEFAULT 0,
      cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
      profit NUMERIC(14, 2) NOT NULL DEFAULT 0,
      UNIQUE(year, month, vessel_code)
    );
  `);
}

async function run() {
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    await client.query('BEGIN');

    // 1. Vessels (map code -> existing or new ID)
    const vesselIdMap = new Map();
    for (const v of snap.vessels || []) {
      const existing = await client.query(
        `SELECT id FROM vessels WHERE UPPER(code) = UPPER($1) OR id = $2 LIMIT 1`,
        [v.code, v.id],
      );
      if (existing.rows[0]) {
        const realId = existing.rows[0].id;
        vesselIdMap.set(v.id, realId);
        await client.query(
          `UPDATE vessels SET name = $2, capacity_tons = $3, capacity_teu = $4, is_vendor_barge = $5 WHERE id = $1`,
          [realId, v.name, Number(v.capacity_tons || 0), Number(v.capacity_teu || 0), Boolean(v.is_vendor_barge)],
        );
      } else {
        await client.query(
          `INSERT INTO vessels (
            id, code, name, registration_no, vessel_type, capacity_tons, capacity_teu,
            main_engine_hp, fuel_norm_l_per_hour, status, current_location,
            current_speed_knots, current_fuel_liters, captain_name, captain_phone,
            is_vendor_barge, notes
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,ST_SetSRID(ST_MakePoint($11,$12),4326)::geography,$13,$14,$15,$16,$17,$18)
          ON CONFLICT (id) DO NOTHING`,
          [
            v.id, v.code, v.name, v.registration_no || v.code, v.vessel_type || 'DUMB_BARGE',
            Number(v.capacity_tons || 0), Number(v.capacity_teu || 0),
            Number(v.main_engine_hp || 600), Number(v.fuel_norm_l_per_hour || 40),
            v.status || 'AVAILABLE', Number(v.lng || 106.78), Number(v.lat || 10.75),
            Number(v.current_speed_knots || 0), Number(v.current_fuel_liters || 0),
            v.captain_name || null, v.captain_phone || null,
            Boolean(v.is_vendor_barge), v.notes || null,
          ],
        );
        vesselIdMap.set(v.id, v.id);
      }
    }
    const mapV = (id) => (id && vesselIdMap.has(id) ? vesselIdMap.get(id) : null);

    // 2. Ports
    const portIdMap = new Map();
    for (const p of snap.ports || []) {
      const existing = await client.query(
        `SELECT id FROM ports WHERE UPPER(code) = UPPER($1) OR id = $2 LIMIT 1`,
        [p.code, p.id],
      );
      if (existing.rows[0]) {
        portIdMap.set(p.id, existing.rows[0].id);
      } else {
        await client.query(
          `INSERT INTO ports (id, code, name, region, port_type, location, geofence_radius_m)
           VALUES ($1,$2,$3,$4,$5,ST_SetSRID(ST_MakePoint($6,$7),4326)::geography,$8)
           ON CONFLICT (id) DO NOTHING`,
          [
            p.id, p.code, p.name, p.region || 'TP. Hồ Chí Minh', p.port_type || 'PORT',
            Number(p.lng || 106.78), Number(p.lat || 10.75), Number(p.geofence_radius_m || 600),
          ],
        );
        portIdMap.set(p.id, p.id);
      }
    }
    const mapP = (id) => (id && portIdMap.has(id) ? portIdMap.get(id) : null);

    // 3. Customers
    const custIdMap = new Map();
    for (const c of snap.customers || []) {
      const existing = await client.query(
        `SELECT id FROM customers WHERE UPPER(code) = UPPER($1) OR id = $2 LIMIT 1`,
        [c.code, c.id],
      );
      if (existing.rows[0]) {
        custIdMap.set(c.id, existing.rows[0].id);
      } else {
        await client.query(
          `INSERT INTO customers (id, code, name, tax_code, address, contact_person, phone, email)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
          [c.id, c.code, c.name, c.tax_code || '', c.address || '', c.contact_person || '', c.phone || '', c.email || null],
        );
        custIdMap.set(c.id, c.id);
      }
    }
    const mapC = (id) => (id && custIdMap.has(id) ? custIdMap.get(id) : null);

    // 0. Remove legacy demo/sample records so old data does not pollute live production reports
    await client.query(`
      DELETE FROM voyage_containers
      WHERE trip_no IN ('VOY-2026-3239', 'VOY-2026-0081', 'VOY-2026-7871')
         OR (trip_no = 'V.36-04926E' AND accounting_month IS NULL)
         OR container_no IN ('MSBU1514898', 'VIMU6254878', 'VIMU6245006', 'VIMU6254651', 'VIMU6253249', 'SELU4741276', 'VIMU6254395');
    `);
    await client.query(`
      DELETE FROM bookings
      WHERE booking_no LIKE 'BK-26-%'
         OR voyage_id IN ('a1b80c3a-c150-48ee-8f2a-0ccf9c738311', '55555555-5555-5555-5555-555555555501', 'e10a9e5a-5671-4aa0-88e4-24661dc3bb23');
    `);
    await client.query(`
      DELETE FROM voyages
      WHERE voyage_no IN ('VOY-2026-3239', 'VOY-2026-0081', 'V.36-04926E', 'VOY-2026-7871')
         OR id IN ('a1b80c3a-c150-48ee-8f2a-0ccf9c738311', '55555555-5555-5555-5555-555555555501', 'e10a9e5a-5671-4aa0-88e4-24661dc3bb23');
    `);
    await client.query(`
      DELETE FROM invoices WHERE invoice_no IN ('INV-2026-0041', 'INV-2026-0042');
      DELETE FROM orders WHERE order_no IN ('ORD-2026-0101', 'ORD-2026-0102', 'ORD-2026-0103');
    `);

    // 4. Voyages
    for (const vy of snap.voyages || []) {
      await client.query(
        `INSERT INTO voyages (
          id, voyage_no, vessel_id, customer_id, origin_port_id, destination_port_id,
          etd, eta, status, received_date, pic_name, cont_20e, cont_20f, cont_40e, cont_40f,
          total_teus, vessel_berth_date, order_deadline, captain_notes, workflow_step
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        ON CONFLICT (id) DO UPDATE SET
          cont_20e = EXCLUDED.cont_20e,
          cont_20f = EXCLUDED.cont_20f,
          cont_40e = EXCLUDED.cont_40e,
          cont_40f = EXCLUDED.cont_40f,
          total_teus = EXCLUDED.total_teus`,
        [
          vy.id, vy.voyage_no, mapV(vy.vessel_id), mapC(vy.customer_id),
          mapP(vy.origin_port_id), mapP(vy.destination_port_id),
          vy.etd || null, vy.eta || null, vy.status || 'COMPLETED',
          vy.received_date ? String(vy.received_date).slice(0, 10) : null,
          vy.pic_name || null, Number(vy.cont_20e || 0), Number(vy.cont_20f || 0),
          Number(vy.cont_40e || 0), Number(vy.cont_40f || 0), Number(vy.total_teus || 0),
          vy.vessel_berth_date ? String(vy.vessel_berth_date).slice(0, 10) : null,
          vy.order_deadline ? String(vy.order_deadline).slice(0, 10) : null,
          vy.captain_notes || null, Number(vy.workflow_step || 0),
        ],
      );
    }

    // 5. Bookings
    for (const bk of snap.bookings || []) {
      await client.query(
        `INSERT INTO bookings (
          id, booking_no, cargo_direction, customer_id, customer_name,
          origin_port_id, origin_name, destination_port_id, dest_name,
          cont_20e, cont_20f, cont_40e, cont_40f, total_teus,
          closing_time, voyage_id, status, estimated_freight, pic_name, notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        ON CONFLICT (id) DO NOTHING`,
        [
          bk.id, bk.booking_no, bk.cargo_direction || 'EXPORT', mapC(bk.customer_id),
          bk.customer_name || null, mapP(bk.origin_port_id), bk.origin_name || null,
          mapP(bk.destination_port_id), bk.dest_name || null,
          Number(bk.cont_20e || 0), Number(bk.cont_20f || 0),
          Number(bk.cont_40e || 0), Number(bk.cont_40f || 0), Number(bk.total_teus || 0),
          bk.closing_time || null, bk.voyage_id || null, bk.status || 'COMPLETED',
          Number(bk.estimated_freight || 0), bk.pic_name || null, bk.notes || null,
        ],
      );
    }

    // 6. Voyage Containers (verified 2026-10 + 2026-11 placeholder rows)
    for (const vc of snap.voyageContainers || []) {
      await client.query(
        `INSERT INTO voyage_containers (
          id, voyage_id, barge_code, trip_no, container_no, seal_no, booking_no,
          origin_name, destination_name, shipper_name, departure_date, accounting_month,
          status, cont_type, unit_price, baf, total_amount, fuel_price_no_vat, notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        ON CONFLICT (id) DO UPDATE SET
          voyage_id = COALESCE(voyage_containers.voyage_id, EXCLUDED.voyage_id),
          accounting_month = COALESCE(voyage_containers.accounting_month, EXCLUDED.accounting_month),
          status = COALESCE(voyage_containers.status, EXCLUDED.status)`,
        [
          vc.id, vc.voyage_id || null, vc.barge_code || null, vc.trip_no || null,
          vc.container_no ?? '', vc.seal_no || null, vc.booking_no || null,
          vc.origin_name || null, vc.destination_name || null, vc.shipper_name || null,
          vc.departure_date ? String(vc.departure_date).slice(0, 10) : null,
          vc.accounting_month || null, vc.status || 'COMPLETED',
          vc.cont_type || '20F', Number(vc.unit_price || 0), Number(vc.baf || 0),
          Number(vc.total_amount || 0), Number(vc.fuel_price_no_vat || 0), vc.notes || null,
        ],
      );
    }

    // 7. Accounting ledgers
    for (const r of snap.accountingFixedCosts || []) {
      await client.query(
        `INSERT INTO accounting_fixed_costs (
          id, period_month, vessel_id, vessel_code, vessel_name,
          charter_fee, crew_salary, social_insurance, hull_insurance, storage_fee, notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
        [
          r.id, r.period_month, mapV(r.vessel_id), r.vessel_code || null, r.vessel_name || null,
          Number(r.charter_fee || 0), Number(r.crew_salary || 0), Number(r.social_insurance || 0),
          Number(r.hull_insurance || 0), Number(r.storage_fee || 0), r.notes || null,
        ],
      );
    }
    for (const r of snap.accountingPortExpenses || []) {
      await client.query(
        `INSERT INTO accounting_port_expenses (
          id, period_month, expense_date, trip_no, voyage_id, linked_trip_no,
          vessel_id, vessel_code, vessel_name, category, amount, description
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
        [
          r.id, r.period_month, r.expense_date ? String(r.expense_date).slice(0, 10) : null,
          r.trip_no || null, r.voyage_id || null, r.linked_trip_no || null,
          mapV(r.vessel_id), r.vessel_code || null, r.vessel_name || null,
          r.category || 'PORT_AUTH', Number(r.amount || 0), r.description || null,
        ],
      );
    }
    for (const r of snap.accountingFuelEntries || []) {
      await client.query(
        `INSERT INTO accounting_fuel_entries (
          id, period_month, entry_date, vessel_id, vessel_code, vessel_name,
          entry_type, route_label, voyage_id, linked_trip_no,
          liters_consumed, liters_bunkered, unit_price, discount, total_amount, notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT (id) DO NOTHING`,
        [
          r.id, r.period_month, r.entry_date ? String(r.entry_date).slice(0, 10) : null,
          mapV(r.vessel_id), r.vessel_code || null, r.vessel_name || null,
          r.entry_type || 'CONSUMPTION', r.route_label || null,
          r.voyage_id || null, r.linked_trip_no || null,
          Number(r.liters_consumed || 0), Number(r.liters_bunkered || 0),
          Number(r.unit_price || 0), Number(r.discount || 0), Number(r.total_amount || 0), r.notes || null,
        ],
      );
    }
    for (const r of snap.accountingSupplies || []) {
      await client.query(
        `INSERT INTO accounting_supplies (
          id, period_month, entry_date, vessel_id, vessel_code, vessel_name,
          category, item_name, unit, quantity, unit_price, vat_rate, total_amount, invoice_no, notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (id) DO NOTHING`,
        [
          r.id, r.period_month, r.entry_date ? String(r.entry_date).slice(0, 10) : null,
          mapV(r.vessel_id), r.vessel_code || null, r.vessel_name || null,
          r.category || 'SUPPLIES', r.item_name || 'Vật tư', r.unit || null,
          Number(r.quantity ?? 1), Number(r.unit_price || 0), Number(r.vat_rate ?? 8),
          Number(r.total_amount || 0), r.invoice_no || null, r.notes || null,
        ],
      );
    }
    for (const r of snap.accountingVendorCosts || []) {
      await client.query(
        `INSERT INTO accounting_vendor_costs (
          id, period_month, pickup_date, vendor_name, shipping_line, booking_no,
          container_no, cont_type, vendor_barge, origin_name, destination_name,
          freight_term, fuel_surcharge, unit_price, vat_rate, total_amount, invoice_no, notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) ON CONFLICT (id) DO NOTHING`,
        [
          r.id, r.period_month, r.pickup_date ? String(r.pickup_date).slice(0, 10) : null,
          r.vendor_name || null, r.shipping_line || null, r.booking_no || null,
          r.container_no || null, r.cont_type || '20F', r.vendor_barge || null,
          r.origin_name || null, r.destination_name || null, r.freight_term || 'FI-FO',
          Number(r.fuel_surcharge || 0), Number(r.unit_price || 0), Number(r.vat_rate ?? 8),
          Number(r.total_amount || 0), r.invoice_no || null, r.notes || null,
        ],
      );
    }
    for (const h of snap.accountingHistoricalMonthly || []) {
      await client.query(
        `INSERT INTO accounting_historical_monthly (year, month, vessel_code, revenue, cost, profit)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (year, month, vessel_code) DO NOTHING`,
        [Number(h.year), Number(h.month), h.vessel_code, Number(h.revenue || 0), Number(h.cost || 0), Number(h.profit || 0)],
      );
    }

    await client.query('COMMIT');
    console.log('Successfully synced snapshot to PostgreSQL!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Snapshot sync failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
