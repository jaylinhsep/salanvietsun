import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../../database/database.service';
import { DEFAULT_SAILING_SCHEDULE } from './sailing-schedule.seed';
import {
  decodeBase64DataUrl,
  deleteTallyImageBinary,
  getAiConfig,
  getR2Config,
  readTallyImageBinary,
  runAiContainerExtraction,
  uploadTallyImage,
} from './r2-storage.util';

@Injectable()
export class DispatchService implements OnModuleInit {
  private readonly logger = new Logger(DispatchService.name);

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit() {
    // Ensure new dispatch/container columns exist even on existing databases
    try {
      await this.db.query(`
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

        CREATE TABLE IF NOT EXISTS voyage_containers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          voyage_id UUID NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
          barge_code VARCHAR(80),
          trip_no VARCHAR(80),
          container_no VARCHAR(40) NOT NULL,
          origin_name VARCHAR(150),
          destination_name VARCHAR(150),
          shipper_name VARCHAR(150),
          departure_date DATE,
          cont_type VARCHAR(10) NOT NULL DEFAULT '20F',
          unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
          baf NUMERIC(14, 2) NOT NULL DEFAULT 0,
          total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
          fuel_price_no_vat NUMERIC(14, 2) NOT NULL DEFAULT 0,
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_voyage_containers_voyage_id ON voyage_containers(voyage_id);
        CREATE INDEX IF NOT EXISTS idx_voyage_containers_container_no ON voyage_containers(container_no);

        CREATE TABLE IF NOT EXISTS bookings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          booking_no VARCHAR(80) NOT NULL,
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
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_bookings_voyage_id ON bookings(voyage_id);
        CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cargo_direction VARCHAR(20) NOT NULL DEFAULT 'EXPORT';

        ALTER TABLE voyage_containers ADD COLUMN IF NOT EXISTS seal_no VARCHAR(60);
        ALTER TABLE voyage_containers ADD COLUMN IF NOT EXISTS booking_no VARCHAR(80);
        ALTER TABLE voyage_containers ADD COLUMN IF NOT EXISTS accounting_month VARCHAR(7);
        ALTER TABLE voyage_containers ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'PLANNED';
        ALTER TABLE voyage_containers ALTER COLUMN voyage_id DROP NOT NULL;

        ALTER TABLE vessels ADD COLUMN IF NOT EXISTS is_vendor_barge BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE vessels ADD COLUMN IF NOT EXISTS notes TEXT;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pic_name VARCHAR(100);
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS weight_per_20e NUMERIC(10, 2) NOT NULL DEFAULT 0;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS weight_per_20f NUMERIC(10, 2) NOT NULL DEFAULT 0;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS weight_per_40e NUMERIC(10, 2) NOT NULL DEFAULT 0;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS weight_per_40f NUMERIC(10, 2) NOT NULL DEFAULT 0;
        ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_weight_tons NUMERIC(12, 2) NOT NULL DEFAULT 0;
        ALTER TABLE voyages DROP CONSTRAINT IF EXISTS voyages_voyage_no_key;

        ALTER TABLE voyages ADD COLUMN IF NOT EXISTS workflow_step INT DEFAULT 0;
        ALTER TABLE voyages ADD COLUMN IF NOT EXISTS fuel_start_liters NUMERIC(12, 2) DEFAULT 0;
        ALTER TABLE voyages ADD COLUMN IF NOT EXISTS fuel_added_liters NUMERIC(12, 2) DEFAULT 0;
        ALTER TABLE voyages ADD COLUMN IF NOT EXISTS fuel_end_liters NUMERIC(12, 2) DEFAULT 0;
        ALTER TABLE voyages ADD COLUMN IF NOT EXISTS fuel_unit_price NUMERIC(12, 2) DEFAULT 21500;
        ALTER TABLE voyages ADD COLUMN IF NOT EXISTS loading_completed_at TIMESTAMPTZ;
        ALTER TABLE voyages ADD COLUMN IF NOT EXISTS laytime_start_at TIMESTAMPTZ;
        ALTER TABLE voyages ADD COLUMN IF NOT EXISTS completed_unloading_at TIMESTAMPTZ;
        ALTER TABLE voyages ADD COLUMN IF NOT EXISTS port_fee NUMERIC(14, 2) DEFAULT 0;
        ALTER TABLE voyages ADD COLUMN IF NOT EXISTS crew_salary NUMERIC(14, 2) DEFAULT 0;
        ALTER TABLE voyages ADD COLUMN IF NOT EXISTS other_cost NUMERIC(14, 2) DEFAULT 0;
        ALTER TABLE voyages ADD COLUMN IF NOT EXISTS pod_photo_url TEXT;
        ALTER TABLE voyages ADD COLUMN IF NOT EXISTS fuel_start_photo_url TEXT;
        ALTER TABLE voyages ADD COLUMN IF NOT EXISTS fuel_end_photo_url TEXT;
        ALTER TABLE voyages ADD COLUMN IF NOT EXISTS captain_report_log JSONB DEFAULT '[]'::jsonb;

        CREATE TABLE IF NOT EXISTS sailing_schedules (
          id VARCHAR(50) PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS voyage_tally_photos (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          voyage_id UUID NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
          vessel_id UUID REFERENCES vessels(id) ON DELETE SET NULL,
          image_url TEXT NOT NULL,
          r2_key TEXT,
          storage_provider VARCHAR(20) NOT NULL DEFAULT 'local',
          mime_type VARCHAR(60) DEFAULT 'image/jpeg',
          original_size_bytes INT DEFAULT 0,
          compressed_size_bytes INT DEFAULT 0,
          uploaded_by VARCHAR(120),
          notes TEXT,
          ai_status VARCHAR(30) DEFAULT 'PENDING',
          ai_provider TEXT,
          ai_raw_text TEXT,
          ai_extracted_containers JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE voyage_tally_photos ALTER COLUMN ai_provider TYPE TEXT;
        CREATE INDEX IF NOT EXISTS idx_voyage_tally_photos_voyage_id ON voyage_tally_photos(voyage_id);
      `);
    } catch (err: any) {
      this.logger.warn(`Auto-migration voyages skipped: ${err.message}`);
    }
  }

  // --- PORTS CRUD ---
  async listPorts() {
    const res = await this.db.query(`
      SELECT
        id, code, name, region, port_type, geofence_radius_m,
        ST_Y(location::geometry) AS lat,
        ST_X(location::geometry) AS lng
      FROM ports
      ORDER BY name ASC
    `);
    return res.rows;
  }

  async createPort(dto: {
    code: string;
    name: string;
    region?: string;
    port_type?: string;
    lat?: number;
    lng?: number;
    geofence_radius_m?: number;
  }) {
    const lat = dto.lat ?? 10.7615;
    const lng = dto.lng ?? 106.7918;
    const res = await this.db.query(
      `
      INSERT INTO ports (code, name, region, port_type, location, geofence_radius_m)
      VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, $7)
      RETURNING id, code, name, region, port_type, geofence_radius_m,
        ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
      `,
      [
        dto.code.trim().toUpperCase(),
        dto.name.trim(),
        dto.region ?? 'TP. Hồ Chí Minh',
        dto.port_type ?? 'PORT',
        lng,
        lat,
        dto.geofence_radius_m ?? 600,
      ],
    );
    return res.rows[0];
  }

  async updatePort(
    id: string,
    dto: {
      code?: string;
      name?: string;
      region?: string;
      port_type?: string;
      lat?: number;
      lng?: number;
      geofence_radius_m?: number;
    },
  ) {
    const hasCoords = dto.lat !== undefined && dto.lng !== undefined;
    const res = await this.db.query(
      `
      UPDATE ports
      SET
        code = COALESCE($2, code),
        name = COALESCE($3, name),
        region = COALESCE($4, region),
        port_type = COALESCE($5, port_type),
        geofence_radius_m = COALESCE($6, geofence_radius_m)
        ${hasCoords ? ', location = ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography' : ''}
      WHERE id = $1
      RETURNING id, code, name, region, port_type, geofence_radius_m,
        ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
      `,
      hasCoords
        ? [
            id,
            dto.code?.trim().toUpperCase() ?? null,
            dto.name?.trim() ?? null,
            dto.region ?? null,
            dto.port_type ?? null,
            dto.geofence_radius_m ?? null,
            dto.lng,
            dto.lat,
          ]
        : [
            id,
            dto.code?.trim().toUpperCase() ?? null,
            dto.name?.trim() ?? null,
            dto.region ?? null,
            dto.port_type ?? null,
            dto.geofence_radius_m ?? null,
          ],
    );
    return res.rows[0];
  }

  async deletePort(id: string) {
    return this.db.transaction(async (client) => {
      await client.query(`UPDATE voyages SET origin_port_id = NULL WHERE origin_port_id = $1`, [id]);
      await client.query(`UPDATE voyages SET destination_port_id = NULL WHERE destination_port_id = $1`, [id]);
      await client.query(`UPDATE orders SET origin_port_id = NULL WHERE origin_port_id = $1`, [id]);
      await client.query(`UPDATE orders SET destination_port_id = NULL WHERE destination_port_id = $1`, [id]);
      await client.query(`UPDATE bookings SET origin_port_id = NULL WHERE origin_port_id = $1`, [id]);
      await client.query(`UPDATE bookings SET destination_port_id = NULL WHERE destination_port_id = $1`, [id]);
      await client.query(`DELETE FROM ports WHERE id = $1`, [id]);
      return { ok: true };
    });
  }

  // --- VOYAGES CRUD ---
  async listVoyages(scope?: string) {
    const isDispatchScope = scope === 'dispatch';
    const activeFilter = isDispatchScope
      ? `WHERE voyage_id IN (SELECT id FROM voyages WHERE status IN ('PLANNED', 'DEPARTED', 'IN_TRANSIT', 'ARRIVED'))`
      : '';
    const res = await this.db.query(`
      SELECT
        vy.id, vy.voyage_no, vy.status, vy.etd, vy.eta, vy.atd, vy.ata,
        vy.planned_distance_nm::float, vy.captain_notes, vy.created_at,
        vy.received_date, vy.pic_name,
        COALESCE(vy.cont_20e, 0) AS cont_20e,
        COALESCE(vy.cont_20f, 0) AS cont_20f,
        COALESCE(vy.cont_40e, 0) AS cont_40e,
        COALESCE(vy.cont_40f, 0) AS cont_40f,
        COALESCE(vy.total_teus, 0) AS total_teus,
        vy.vessel_berth_date, vy.order_deadline,
        vy.customer_id,
        c.code AS customer_code, c.name AS customer_name,
        v.id AS vessel_id, v.code AS vessel_code, v.name AS vessel_name, v.captain_name,
        o.id AS order_id, o.order_no, o.cargo_type, o.cargo_weight_tons::float,
        vy.origin_port_id, op.code AS origin_code, op.name AS origin_name,
        ST_Y(op.location::geometry) AS origin_lat, ST_X(op.location::geometry) AS origin_lng,
        vy.destination_port_id, dp.code AS dest_code, dp.name AS dest_name,
        ST_Y(dp.location::geometry) AS dest_lat, ST_X(dp.location::geometry) AS dest_lng,
        COALESCE(vc.detail_count, 0) AS detail_count,
        COALESCE(vc.named_cont_count, 0) AS named_cont_count,
        COALESCE(vc.detail_teus, 0) AS detail_teus,
        COALESCE(vc.detail_revenue, 0) AS detail_revenue,
        COALESCE(vy.workflow_step, 0) AS workflow_step,
        COALESCE(vy.fuel_start_liters, 0)::float AS fuel_start_liters,
        COALESCE(vy.fuel_added_liters, 0)::float AS fuel_added_liters,
        COALESCE(vy.fuel_end_liters, 0)::float AS fuel_end_liters,
        COALESCE(vy.fuel_unit_price, 21500)::float AS fuel_unit_price,
        vy.loading_completed_at, vy.laytime_start_at, vy.completed_unloading_at,
        COALESCE(vy.port_fee, 0)::float AS port_fee,
        COALESCE(vy.crew_salary, 0)::float AS crew_salary,
        COALESCE(vy.other_cost, 0)::float AS other_cost,
        vy.pod_photo_url, vy.fuel_start_photo_url, vy.fuel_end_photo_url,
        COALESCE(vy.captain_report_log, '[]'::jsonb) AS captain_report_log,
        bk.booking_nos, bk.earliest_closing_time,
        COALESCE(bk.total_weight_tons, 0)::float AS total_weight_tons,
        COALESCE(tp.tally_photo_count, 0)::int AS tally_photo_count
      FROM voyages vy
      LEFT JOIN customers c ON c.id = vy.customer_id
      LEFT JOIN vessels v ON v.id = vy.vessel_id
      LEFT JOIN orders o ON o.id = vy.order_id
      LEFT JOIN ports op ON op.id = vy.origin_port_id
      LEFT JOIN ports dp ON dp.id = vy.destination_port_id
      LEFT JOIN (
        SELECT voyage_id, COUNT(*)::int AS tally_photo_count
        FROM voyage_tally_photos
        ${activeFilter}
        GROUP BY voyage_id
      ) tp ON tp.voyage_id = vy.id
      LEFT JOIN (
        SELECT
          voyage_id,
          COUNT(*)::int AS detail_count,
          COALESCE(SUM(CASE WHEN COALESCE(TRIM(container_no), '') <> '' THEN 1 ELSE 0 END), 0)::int AS named_cont_count,
          COALESCE(SUM(CASE WHEN cont_type IN ('40E', '40F') THEN 2 ELSE 1 END), 0)::int AS detail_teus,
          COALESCE(SUM(total_amount), 0)::float AS detail_revenue
        FROM voyage_containers
        ${activeFilter}
        GROUP BY voyage_id
      ) vc ON vc.voyage_id = vy.id
      LEFT JOIN (
        SELECT
          voyage_id,
          STRING_AGG(booking_no, ', ' ORDER BY created_at ASC) AS booking_nos,
          MIN(closing_time) AS earliest_closing_time,
          COALESCE(SUM(total_weight_tons), 0) AS total_weight_tons
        FROM bookings
        WHERE voyage_id IS NOT NULL
        ${isDispatchScope ? `AND voyage_id IN (SELECT id FROM voyages WHERE status IN ('PLANNED', 'DEPARTED', 'IN_TRANSIT', 'ARRIVED'))` : ''}
        GROUP BY voyage_id
      ) bk ON bk.voyage_id = vy.id
      ${isDispatchScope ? `WHERE vy.status IN ('PLANNED', 'DEPARTED', 'IN_TRANSIT', 'ARRIVED')` : ''}
      ORDER BY COALESCE(vy.received_date, vy.created_at::date) DESC, vy.created_at DESC
    `);
    return res.rows;
  }

  private computeTeus(c20e = 0, c20f = 0, c40e = 0, c40f = 0): number {
    return Number(c20e || 0) + Number(c20f || 0) + (Number(c40e || 0) + Number(c40f || 0)) * 2;
  }

  private toIsoDateOnly(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
    }
    const str = String(value).trim();
    if (!str) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    const parsed = new Date(str);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }

  private computeNextVoyageNoFromList(params: {
    vesselCode?: string | null;
    vesselName?: string | null;
    existingVoyageNos: Array<string | null | undefined>;
    receivedDate?: string | null;
  }): string {
    const rawCode = String(params.vesselCode || '').trim().toUpperCase();
    const rawName = String(params.vesselName || '').trim().toUpperCase();
    const dateStr =
      this.toIsoDateOnly(params.receivedDate) || new Date().toISOString().slice(0, 10);
    const yy = dateStr.slice(2, 4);
    const mm = dateStr.slice(5, 7);
    const dd = dateStr.slice(8, 10);

    const usedSet = new Set(
      params.existingVoyageNos.map((n) => String(n || '').trim().toUpperCase()).filter(Boolean),
    );

    let bargeNum: string | null = null;
    const codeMatch = rawCode.match(/^NV(\d+)$/);
    if (codeMatch) {
      bargeNum = codeMatch[1];
    } else {
      const nameMatch = rawName.match(/(?:NHẬT VIỆT|NHAT VIET)\s*(\d+)/);
      if (nameMatch) bargeNum = nameMatch[1];
    }

    if (bargeNum) {
      const tripPattern = new RegExp(`^V\\.?${bargeNum}-0*(\\d+)(\\d{2})([WE])(?:\\s*-\\s*[WE])?$`, 'i');
      let maxRank = -1;
      for (const rawNo of params.existingVoyageNos) {
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

  private async getNextVoyageNoForVessel(
    queryable: { query: (text: string, params?: any[]) => Promise<any> },
    vesselId?: string | null,
    receivedDate?: string | null,
  ): Promise<string> {
    if (!vesselId) {
      return `VOY-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    const [vesselRes, vyRes] = await Promise.all([
      queryable.query(`SELECT code, name FROM vessels WHERE id = $1 LIMIT 1`, [vesselId]),
      queryable.query(`SELECT voyage_no FROM voyages WHERE vessel_id = $1`, [vesselId]),
    ]);
    const vessel = vesselRes.rows[0] || {};
    return this.computeNextVoyageNoFromList({
      vesselCode: vessel.code,
      vesselName: vessel.name,
      existingVoyageNos: vyRes.rows.map((r: any) => r.voyage_no),
      receivedDate,
    });
  }

  private async insertPlaceholderContainers(
    queryable: { query: (text: string, params?: any[]) => Promise<any> },
    params: {
      voyageId: string;
      bargeCode: string | null;
      tripNo: string | null;
      bookingNo?: string | null;
      originName?: string | null;
      destinationName?: string | null;
      shipperName?: string | null;
      departureDate: string | null;
      status?: string;
      cont_20e?: number;
      cont_20f?: number;
      cont_40e?: number;
      cont_40f?: number;
    },
  ) {
    const depDate = this.toIsoDateOnly(params.departureDate) || new Date().toISOString().slice(0, 10);
    const accMonth = depDate.slice(0, 7);
    const counts: Array<[string, number]> = [
      ['20E', Number(params.cont_20e || 0)],
      ['20F', Number(params.cont_20f || 0)],
      ['40E', Number(params.cont_40e || 0)],
      ['40F', Number(params.cont_40f || 0)],
    ];
    for (const [ct, n] of counts) {
      for (let i = 0; i < n; i++) {
        await queryable.query(
          `
          INSERT INTO voyage_containers (
            voyage_id, barge_code, trip_no, container_no, booking_no,
            origin_name, destination_name, shipper_name, departure_date,
            accounting_month, status, cont_type, unit_price, baf, total_amount, fuel_price_no_vat
          ) VALUES ($1, $2, $3, '', $4, $5, $6, $7, $8, $9, $10, $11, 0, 0, 0, 0)
          `,
          [
            params.voyageId,
            params.bargeCode,
            params.tripNo,
            params.bookingNo || null,
            params.originName || null,
            params.destinationName || null,
            params.shipperName || null,
            depDate,
            accMonth,
            params.status || 'PLANNED',
            ct,
          ],
        );
      }
    }
  }

  async createVoyage(dto: {
    voyage_no: string;
    vessel_id: string;
    tugboat_id?: string;
    order_id?: string;
    customer_id?: string;
    origin_port_id: string;
    destination_port_id: string;
    etd?: string;
    eta?: string;
    received_date?: string;
    pic_name?: string;
    cont_20e?: number;
    cont_20f?: number;
    cont_40e?: number;
    cont_40f?: number;
    vessel_berth_date?: string;
    order_deadline?: string;
    status?: string;
    captain_notes?: string;
  }) {
    const distRes = await this.db.query(
      `
      SELECT ROUND((ST_Distance(a.location, b.location) / 1852.0 * 1.25)::numeric, 2)::float AS nm
      FROM ports a, ports b
      WHERE a.id = $1 AND b.id = $2
      `,
      [dto.origin_port_id, dto.destination_port_id],
    );
    const plannedNm = distRes.rows[0]?.nm ?? 35.0;
    const totalTeus = this.computeTeus(dto.cont_20e, dto.cont_20f, dto.cont_40e, dto.cont_40f);
    const resolvedReceived = dto.received_date || new Date().toISOString().slice(0, 10);
    const resolvedVoyageNo =
      dto.voyage_no && String(dto.voyage_no).trim()
        ? String(dto.voyage_no).trim().toUpperCase()
        : await this.getNextVoyageNoForVessel(this.db, dto.vessel_id, resolvedReceived);

    const res = await this.db.query(
      `
      INSERT INTO voyages (
        voyage_no, vessel_id, tugboat_id, order_id, customer_id,
        origin_port_id, destination_port_id, etd, eta, planned_distance_nm,
        received_date, pic_name, cont_20e, cont_20f, cont_40e, cont_40f, total_teus,
        vessel_berth_date, order_deadline, status, captain_notes
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21
      )
      RETURNING *
      `,
      [
        resolvedVoyageNo,
        dto.vessel_id || null,
        dto.tugboat_id || null,
        dto.order_id || null,
        dto.customer_id || null,
        dto.origin_port_id,
        dto.destination_port_id,
        dto.etd || null,
        dto.eta || null,
        plannedNm,
        resolvedReceived,
        dto.pic_name || null,
        Number(dto.cont_20e || 0),
        Number(dto.cont_20f || 0),
        Number(dto.cont_40e || 0),
        Number(dto.cont_40f || 0),
        totalTeus,
        dto.vessel_berth_date || null,
        dto.order_deadline || null,
        dto.status || 'PLANNED',
        dto.captain_notes || null,
      ],
    );
    const createdVy = res.rows[0];
    if (totalTeus > 0) {
      const metaRes = await this.db.query(
        `
        SELECT
          (SELECT code FROM vessels WHERE id = $1 LIMIT 1) AS vessel_code,
          (SELECT name FROM ports WHERE id = $2 LIMIT 1) AS origin_name,
          (SELECT name FROM ports WHERE id = $3 LIMIT 1) AS dest_name,
          (SELECT name FROM customers WHERE id = $4 LIMIT 1) AS customer_name
        `,
        [dto.vessel_id || null, dto.origin_port_id, dto.destination_port_id, dto.customer_id || null],
      );
      const meta = metaRes.rows[0] || {};
      await this.insertPlaceholderContainers(this.db, {
        voyageId: createdVy.id,
        bargeCode: meta.vessel_code || null,
        tripNo: createdVy.voyage_no,
        originName: meta.origin_name || null,
        destinationName: meta.dest_name || null,
        shipperName: meta.customer_name || null,
        departureDate: this.toIsoDateOnly(createdVy.received_date),
        status: createdVy.status,
        cont_20e: dto.cont_20e,
        cont_20f: dto.cont_20f,
        cont_40e: dto.cont_40e,
        cont_40f: dto.cont_40f,
      });
    }
    return createdVy;
  }

  async updateVoyage(
    id: string,
    dto: {
      voyage_no?: string;
      vessel_id?: string;
      customer_id?: string;
      origin_port_id?: string;
      destination_port_id?: string;
      received_date?: string;
      pic_name?: string;
      cont_20e?: number;
      cont_20f?: number;
      cont_40e?: number;
      cont_40f?: number;
      vessel_berth_date?: string;
      order_deadline?: string;
      status?: string;
      captain_notes?: string;
    },
  ) {
    const totalTeus =
      dto.cont_20e !== undefined ||
      dto.cont_20f !== undefined ||
      dto.cont_40e !== undefined ||
      dto.cont_40f !== undefined
        ? this.computeTeus(dto.cont_20e, dto.cont_20f, dto.cont_40e, dto.cont_40f)
        : null;

    const res = await this.db.query(
      `
      UPDATE voyages
      SET
        voyage_no = COALESCE($2, voyage_no),
        vessel_id = COALESCE($3, vessel_id),
        customer_id = COALESCE($4, customer_id),
        origin_port_id = COALESCE($5, origin_port_id),
        destination_port_id = COALESCE($6, destination_port_id),
        received_date = COALESCE($7, received_date),
        pic_name = COALESCE($8, pic_name),
        cont_20e = COALESCE($9, cont_20e),
        cont_20f = COALESCE($10, cont_20f),
        cont_40e = COALESCE($11, cont_40e),
        cont_40f = COALESCE($12, cont_40f),
        total_teus = COALESCE($13, total_teus),
        vessel_berth_date = COALESCE($14, vessel_berth_date),
        order_deadline = COALESCE($15, order_deadline),
        status = COALESCE($16, status),
        captain_notes = COALESCE($17, captain_notes)
      WHERE id = $1
      RETURNING *
      `,
      [
        id,
        dto.voyage_no ?? null,
        dto.vessel_id || null,
        dto.customer_id || null,
        dto.origin_port_id || null,
        dto.destination_port_id || null,
        dto.received_date || null,
        dto.pic_name ?? null,
        dto.cont_20e ?? null,
        dto.cont_20f ?? null,
        dto.cont_40e ?? null,
        dto.cont_40f ?? null,
        totalTeus,
        dto.vessel_berth_date || null,
        dto.order_deadline || null,
        dto.status ?? null,
        dto.captain_notes ?? null,
      ],
    );
    return res.rows[0];
  }

  async updateVoyageStatus(id: string, status: string) {
    const timeCol =
      status === 'DEPARTED' || status === 'IN_TRANSIT'
        ? ', atd = COALESCE(atd, NOW())'
        : status === 'ARRIVED' || status === 'COMPLETED'
          ? ', ata = COALESCE(ata, NOW())'
          : '';
    const res = await this.db.query(
      `UPDATE voyages SET status = $2 ${timeCol} WHERE id = $1 RETURNING *`,
      [id, status],
    );
    return res.rows[0];
  }

  async deleteVoyage(id: string) {
    return this.db.transaction(async (client) => {
      const vyRes = await client.query(`SELECT id, vessel_id FROM voyages WHERE id = $1`, [id]);
      const vy = vyRes.rows[0];
      if (!vy) return { ok: true, releasedBookings: 0 };

      const bkRes = await client.query(
        `UPDATE bookings SET voyage_id = NULL, status = 'PENDING' WHERE voyage_id = $1 RETURNING id`,
        [id],
      );
      await client.query(`UPDATE voyage_containers SET voyage_id = NULL WHERE voyage_id = $1`, [id]);
      try {
        await client.query(`UPDATE accounting_port_expenses SET voyage_id = NULL WHERE voyage_id = $1`, [id]);
        await client.query(`UPDATE accounting_fuel_entries SET voyage_id = NULL WHERE voyage_id = $1`, [id]);
      } catch {
        // Optional accounting link tables may not exist on older DBs yet
      }
      await client.query(`DELETE FROM voyages WHERE id = $1`, [id]);

      if (vy.vessel_id) {
        await client.query(
          `UPDATE vessels SET status = 'AVAILABLE'
           WHERE id = $1 AND status = 'IN_VOYAGE'
             AND NOT EXISTS (
               SELECT 1 FROM voyages WHERE vessel_id = $1 AND status IN ('IN_TRANSIT', 'DEPARTED')
             )`,
          [vy.vessel_id],
        );
      }
      return { ok: true, releasedBookings: bkRes.rowCount || 0 };
    });
  }

  // --- VOYAGE CONTAINERS (CHI TIẾT TỪNG CHUYẾN) ---
  private normalizeContType(raw?: string): '20E' | '20F' | '40E' | '40F' {
    const up = (raw || '20F').trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (up === '20E' || up === '20F' || up === '40E' || up === '40F') {
      return up;
    }
    return '20F';
  }

  private static readonly CONTAINER_SELECT = `
    id, voyage_id, barge_code, trip_no, container_no,
    seal_no, booking_no,
    origin_name, destination_name, shipper_name,
    departure_date, accounting_month, status, cont_type,
    unit_price::float, baf::float, total_amount::float, fuel_price_no_vat::float,
    notes, created_at, updated_at
  `;

  private normalizeContainerPayload(dto: any) {
    const unitPrice = Number(dto.unit_price || 0);
    const baf = Number(dto.baf || 0);
    const hasExplicitTotal =
      dto.total_amount !== undefined && dto.total_amount !== null && dto.total_amount !== '';
    const totalAmount = hasExplicitTotal ? Number(dto.total_amount) : unitPrice + baf;
    const depDate = dto.departure_date ? String(dto.departure_date).trim().slice(0, 10) : null;

    return {
      barge_code: dto.barge_code ? String(dto.barge_code).trim() : null,
      trip_no: dto.trip_no ? String(dto.trip_no).trim() : null,
      container_no: String(dto.container_no || '').trim().toUpperCase(),
      seal_no: dto.seal_no ? String(dto.seal_no).trim().toUpperCase() : null,
      booking_no: dto.booking_no ? String(dto.booking_no).trim().toUpperCase() : null,
      origin_name: dto.origin_name ? String(dto.origin_name).trim() : null,
      destination_name: dto.destination_name ? String(dto.destination_name).trim() : null,
      shipper_name: dto.shipper_name ? String(dto.shipper_name).trim() : null,
      departure_date: depDate || null,
      cont_type: this.normalizeContType(dto.cont_type),
      unit_price: Number.isFinite(unitPrice) ? unitPrice : 0,
      baf: Number.isFinite(baf) ? baf : 0,
      total_amount: Number.isFinite(totalAmount) ? totalAmount : 0,
      fuel_price_no_vat: Number(dto.fuel_price_no_vat || 0) || 0,
      notes: dto.notes ? String(dto.notes).trim() : null,
    };
  }

  async listVoyageContainers(voyageId: string) {
    const res = await this.db.query(
      `
      SELECT ${DispatchService.CONTAINER_SELECT}
      FROM voyage_containers
      WHERE voyage_id = $1
      ORDER BY departure_date ASC NULLS LAST, created_at ASC, id ASC
      `,
      [voyageId],
    );
    return res.rows;
  }

  async createVoyageContainer(voyageId: string, dto: any) {
    const p = this.normalizeContainerPayload(dto);
    const res = await this.db.query(
      `
      INSERT INTO voyage_containers (
        voyage_id, barge_code, trip_no, container_no, seal_no, booking_no,
        origin_name, destination_name, shipper_name, departure_date,
        cont_type, unit_price, baf, total_amount, fuel_price_no_vat, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING ${DispatchService.CONTAINER_SELECT}
      `,
      [
        voyageId,
        p.barge_code,
        p.trip_no,
        p.container_no,
        p.seal_no,
        p.booking_no,
        p.origin_name,
        p.destination_name,
        p.shipper_name,
        p.departure_date,
        p.cont_type,
        p.unit_price,
        p.baf,
        p.total_amount,
        p.fuel_price_no_vat,
        p.notes,
      ],
    );
    return res.rows[0];
  }

  async bulkCreateVoyageContainers(
    voyageId: string,
    payload: { rows: any[]; replace?: boolean },
  ) {
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    const normalized = rows
      .map((r) => this.normalizeContainerPayload(r))
      .filter((r) => r.container_no.length > 0 || Boolean(r.cont_type));

    return this.db.transaction(async (client) => {
      if (payload?.replace) {
        await client.query(`DELETE FROM voyage_containers WHERE voyage_id = $1`, [voyageId]);
      }
      const inserted = [];
      for (const p of normalized) {
        const res = await client.query(
          `
          INSERT INTO voyage_containers (
            voyage_id, barge_code, trip_no, container_no, seal_no, booking_no,
            origin_name, destination_name, shipper_name, departure_date,
            cont_type, unit_price, baf, total_amount, fuel_price_no_vat, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING ${DispatchService.CONTAINER_SELECT}
          `,
          [
            voyageId,
            p.barge_code,
            p.trip_no,
            p.container_no,
            p.seal_no,
            p.booking_no,
            p.origin_name,
            p.destination_name,
            p.shipper_name,
            p.departure_date,
            p.cont_type,
            p.unit_price,
            p.baf,
            p.total_amount,
            p.fuel_price_no_vat,
            p.notes,
          ],
        );
        inserted.push(res.rows[0]);
      }
      return { insertedCount: inserted.length, rows: inserted };
    });
  }

  async listAllContainers() {
    const res = await this.db.query(`
      SELECT
        vc.id, vc.voyage_id,
        COALESCE(NULLIF(vc.barge_code, ''), v.code, v.name, '') AS barge_code,
        COALESCE(NULLIF(vc.trip_no, ''), vy.voyage_no, '') AS trip_no,
        vc.container_no, vc.seal_no, vc.booking_no,
        COALESCE(NULLIF(vc.origin_name, ''), op.name, '') AS origin_name,
        COALESCE(NULLIF(vc.destination_name, ''), dp.name, '') AS destination_name,
        COALESCE(NULLIF(vc.shipper_name, ''), c.name, '') AS shipper_name,
        COALESCE(vc.departure_date, vy.received_date, vc.created_at::date) AS departure_date,
        vc.cont_type,
        vc.unit_price::float, vc.baf::float, vc.total_amount::float, vc.fuel_price_no_vat::float,
        vc.accounting_month, vc.notes, vc.created_at, vc.updated_at
      FROM voyage_containers vc
      LEFT JOIN voyages vy ON vy.id = vc.voyage_id
      LEFT JOIN vessels v ON v.id = vy.vessel_id
      LEFT JOIN ports op ON op.id = vy.origin_port_id
      LEFT JOIN ports dp ON dp.id = vy.destination_port_id
      LEFT JOIN customers c ON c.id = vy.customer_id
      ORDER BY
        COALESCE(vc.departure_date, vy.received_date, vc.created_at::date) ASC,
        COALESCE(NULLIF(vc.barge_code, ''), v.code, v.name, '') ASC,
        COALESCE(NULLIF(vc.trip_no, ''), vy.voyage_no, '') ASC,
        vc.created_at ASC, vc.id ASC
    `);
    return res.rows;
  }

  async updateVoyageContainer(containerId: string, dto: any) {
    const prevRes = await this.db.query(
      `SELECT ${DispatchService.CONTAINER_SELECT} FROM voyage_containers WHERE id = $1`,
      [containerId],
    );
    const prev = prevRes.rows[0];
    if (!prev) throw new BadRequestException('Không tìm thấy container.');

    const merged = {
      ...prev,
      ...dto,
      total_amount:
        dto.total_amount !== undefined
          ? dto.total_amount
          : dto.unit_price !== undefined || dto.baf !== undefined
            ? Number(dto.unit_price ?? prev.unit_price ?? 0) + Number(dto.baf ?? prev.baf ?? 0)
            : prev.total_amount,
    };
    const containerNoProvided = dto.container_no !== undefined;
    const p = this.normalizeContainerPayload(merged);
    const res = await this.db.query(
      `
      UPDATE voyage_containers
      SET
        barge_code = $2,
        trip_no = $3,
        container_no = CASE WHEN $17::boolean THEN $4 ELSE container_no END,
        seal_no = $5,
        booking_no = $6,
        origin_name = $7,
        destination_name = $8,
        shipper_name = $9,
        departure_date = $10,
        cont_type = $11,
        unit_price = $12,
        baf = $13,
        total_amount = $14,
        fuel_price_no_vat = $15,
        notes = $16,
        updated_at = NOW()
      WHERE id = $1
      RETURNING ${DispatchService.CONTAINER_SELECT}
      `,
      [
        containerId,
        p.barge_code,
        p.trip_no,
        p.container_no,
        p.seal_no,
        p.booking_no,
        p.origin_name,
        p.destination_name,
        p.shipper_name,
        p.departure_date,
        p.cont_type,
        p.unit_price,
        p.baf,
        p.total_amount,
        p.fuel_price_no_vat,
        p.notes,
        containerNoProvided,
      ],
    );
    return res.rows[0];
  }

  async deleteVoyageContainer(containerId: string) {
    await this.db.query(`DELETE FROM voyage_containers WHERE id = $1`, [containerId]);
    return { ok: true };
  }

  async syncVoyageCountsFromDetails(voyageId: string) {
    const countsRes = await this.db.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE cont_type = '20E')::int AS c20e,
        COUNT(*) FILTER (WHERE cont_type = '20F')::int AS c20f,
        COUNT(*) FILTER (WHERE cont_type = '40E')::int AS c40e,
        COUNT(*) FILTER (WHERE cont_type = '40F')::int AS c40f
      FROM voyage_containers
      WHERE voyage_id = $1
      `,
      [voyageId],
    );
    const c = countsRes.rows[0] || { c20e: 0, c20f: 0, c40e: 0, c40f: 0 };
    const totalTeus = this.computeTeus(c.c20e, c.c20f, c.c40e, c.c40f);

    const upd = await this.db.query(
      `
      UPDATE voyages
      SET cont_20e = $2, cont_20f = $3, cont_40e = $4, cont_40f = $5, total_teus = $6
      WHERE id = $1
      RETURNING *
      `,
      [voyageId, c.c20e, c.c20f, c.c40e, c.c40f, totalTeus],
    );
    return upd.rows[0];
  }

  // --- BOOKINGS (BƯỚC 1 & 2: GOM ĐƠN & ĐIỀU ĐỘ 1 CHẠM) ---
  async listBookings(scope?: string) {
    const whereClause =
      scope === 'dispatch'
        ? `WHERE b.status <> 'COMPLETED' OR vy.status IN ('PLANNED', 'DEPARTED', 'IN_TRANSIT', 'ARRIVED')`
        : '';
    const res = await this.db.query(`
      SELECT
        b.*, b.estimated_freight::float,
        COALESCE(b.weight_per_20e, 0)::float AS weight_per_20e,
        COALESCE(b.weight_per_20f, 0)::float AS weight_per_20f,
        COALESCE(b.weight_per_40e, 0)::float AS weight_per_40e,
        COALESCE(b.weight_per_40f, 0)::float AS weight_per_40f,
        COALESCE(b.total_weight_tons, 0)::float AS total_weight_tons,
        COALESCE(c.name, b.customer_name) AS resolved_customer_name,
        c.code AS customer_code,
        COALESCE(op.name, b.origin_name) AS resolved_origin_name,
        COALESCE(dp.name, b.dest_name) AS resolved_dest_name,
        vy.voyage_no
      FROM bookings b
      LEFT JOIN customers c ON c.id = b.customer_id
      LEFT JOIN ports op ON op.id = b.origin_port_id
      LEFT JOIN ports dp ON dp.id = b.destination_port_id
      LEFT JOIN voyages vy ON vy.id = b.voyage_id
      ${whereClause}
      ORDER BY
        CASE WHEN b.voyage_id IS NULL THEN 0 ELSE 1 END ASC,
        b.closing_time ASC NULLS LAST,
        b.created_at DESC
    `);
    return res.rows;
  }

  private normalizeBookingFields(dto: any) {
    const c20e = Number(dto.cont_20e || 0);
    const c20f = Number(dto.cont_20f || 0);
    const c40e = Number(dto.cont_40e || 0);
    const c40f = Number(dto.cont_40f || 0);
    const w20e = Math.max(0, Number(dto.weight_per_20e || 0));
    const w20f = Math.max(0, Number(dto.weight_per_20f || 0));
    const w40e = Math.max(0, Number(dto.weight_per_40e || 0));
    const w40f = Math.max(0, Number(dto.weight_per_40f || 0));
    const computedWeight =
      Math.round((c20e * w20e + c20f * w20f + c40e * w40e + c40f * w40f) * 100) / 100;
    const totalWeightTons =
      w20e > 0 || w20f > 0 || w40e > 0 || w40f > 0
        ? computedWeight
        : Math.max(0, Number(dto.total_weight_tons || 0));
    const dir = String(dto.cargo_direction || 'EXPORT').toUpperCase() === 'IMPORT' ? 'IMPORT' : 'EXPORT';
    return {
      booking_no: String(dto.booking_no || `BK-${Date.now().toString().slice(-6)}`).trim().toUpperCase(),
      cargo_direction: dir,
      customer_id: dto.customer_id || null,
      customer_name: dto.customer_name || null,
      origin_port_id: dto.origin_port_id || null,
      origin_name: dto.origin_name || null,
      destination_port_id: dto.destination_port_id || null,
      dest_name: dto.dest_name || null,
      c20e,
      c20f,
      c40e,
      c40f,
      w20e,
      w20f,
      w40e,
      w40f,
      totalWeightTons,
      totalTeus: this.computeTeus(c20e, c20f, c40e, c40f),
      closing_time: dto.closing_time || null,
      estimated_freight: Number(dto.estimated_freight || 0),
      notes: dto.notes || null,
    };
  }

  async createBooking(dto: any) {
    const b = this.normalizeBookingFields(dto);
    const res = await this.db.query(
      `
      INSERT INTO bookings (
        booking_no, cargo_direction, customer_id, customer_name,
        origin_port_id, origin_name, destination_port_id, dest_name,
        cont_20e, cont_20f, cont_40e, cont_40f, total_teus,
        weight_per_20e, weight_per_20f, weight_per_40e, weight_per_40f, total_weight_tons,
        closing_time, estimated_freight, notes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 'PENDING')
      RETURNING *
      `,
      [
        b.booking_no,
        b.cargo_direction,
        b.customer_id,
        b.customer_name,
        b.origin_port_id,
        b.origin_name,
        b.destination_port_id,
        b.dest_name,
        b.c20e,
        b.c20f,
        b.c40e,
        b.c40f,
        b.totalTeus,
        b.w20e,
        b.w20f,
        b.w40e,
        b.w40f,
        b.totalWeightTons,
        b.closing_time,
        b.estimated_freight,
        b.notes,
      ],
    );
    return res.rows[0];
  }

  async updateBooking(id: string, dto: any) {
    return this.db.transaction(async (client) => {
      const prevRes = await client.query(`SELECT * FROM bookings WHERE id = $1`, [id]);
      const prev = prevRes.rows[0];
      if (!prev) throw new BadRequestException('Không tìm thấy booking.');

      const mergedDto = {
        booking_no: dto.booking_no ?? prev.booking_no,
        cargo_direction: dto.cargo_direction ?? prev.cargo_direction,
        customer_id: dto.customer_id !== undefined ? dto.customer_id : prev.customer_id,
        customer_name: dto.customer_name !== undefined ? dto.customer_name : prev.customer_name,
        origin_port_id: dto.origin_port_id !== undefined ? dto.origin_port_id : prev.origin_port_id,
        origin_name: dto.origin_name !== undefined ? dto.origin_name : prev.origin_name,
        destination_port_id:
          dto.destination_port_id !== undefined ? dto.destination_port_id : prev.destination_port_id,
        dest_name: dto.dest_name !== undefined ? dto.dest_name : prev.dest_name,
        cont_20e: dto.cont_20e ?? prev.cont_20e,
        cont_20f: dto.cont_20f ?? prev.cont_20f,
        cont_40e: dto.cont_40e ?? prev.cont_40e,
        cont_40f: dto.cont_40f ?? prev.cont_40f,
        weight_per_20e: dto.weight_per_20e ?? prev.weight_per_20e,
        weight_per_20f: dto.weight_per_20f ?? prev.weight_per_20f,
        weight_per_40e: dto.weight_per_40e ?? prev.weight_per_40e,
        weight_per_40f: dto.weight_per_40f ?? prev.weight_per_40f,
        total_weight_tons: dto.total_weight_tons ?? prev.total_weight_tons,
        closing_time: dto.closing_time !== undefined ? dto.closing_time : prev.closing_time,
        estimated_freight:
          dto.estimated_freight !== undefined ? dto.estimated_freight : prev.estimated_freight,
        notes: dto.notes !== undefined ? dto.notes : prev.notes,
      };
      const b = this.normalizeBookingFields(mergedDto);

      if (prev.voyage_id) {
        const d20e = b.c20e - Number(prev.cont_20e || 0);
        const d20f = b.c20f - Number(prev.cont_20f || 0);
        const d40e = b.c40e - Number(prev.cont_40e || 0);
        const d40f = b.c40f - Number(prev.cont_40f || 0);
        const dTeus = b.totalTeus - Number(prev.total_teus || 0);

        const vyRes = await client.query(
          `
          SELECT vy.id, vy.status, COALESCE(vy.total_teus, 0)::int AS total_teus,
                 v.name AS vessel_name, COALESCE(v.capacity_teu, 0)::int AS capacity_teu
          FROM voyages vy
          LEFT JOIN vessels v ON v.id = vy.vessel_id
          WHERE vy.id = $1
          `,
          [prev.voyage_id],
        );
        const vy = vyRes.rows[0];
        if (vy) {
          const projected = Number(vy.total_teus || 0) + dTeus;
          const maxTeu = Number(vy.capacity_teu || 0);
          if (dTeus > 0 && projected > maxTeu) {
            throw new BadRequestException(
              `Vượt sức chở của sà lan ${vy.vessel_name || ''} (${projected} TEU > tối đa ${maxTeu} TEU).`,
            );
          }
          await client.query(
            `
            UPDATE voyages
            SET
              cont_20e = GREATEST(0, COALESCE(cont_20e, 0) + $2),
              cont_20f = GREATEST(0, COALESCE(cont_20f, 0) + $3),
              cont_40e = GREATEST(0, COALESCE(cont_40e, 0) + $4),
              cont_40f = GREATEST(0, COALESCE(cont_40f, 0) + $5),
              total_teus = GREATEST(0, COALESCE(total_teus, 0) + $6)
            WHERE id = $1
            `,
            [prev.voyage_id, d20e, d20f, d40e, d40f, dTeus],
          );
        }
      }

      const res = await client.query(
        `
        UPDATE bookings
        SET
          booking_no = $2,
          cargo_direction = $3,
          customer_id = $4,
          customer_name = $5,
          origin_port_id = $6,
          origin_name = $7,
          destination_port_id = $8,
          dest_name = $9,
          cont_20e = $10,
          cont_20f = $11,
          cont_40e = $12,
          cont_40f = $13,
          total_teus = $14,
          weight_per_20e = $15,
          weight_per_20f = $16,
          weight_per_40e = $17,
          weight_per_40f = $18,
          total_weight_tons = $19,
          closing_time = $20,
          estimated_freight = $21,
          notes = $22,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [
          id,
          b.booking_no,
          b.cargo_direction,
          b.customer_id,
          b.customer_name,
          b.origin_port_id,
          b.origin_name,
          b.destination_port_id,
          b.dest_name,
          b.c20e,
          b.c20f,
          b.c40e,
          b.c40f,
          b.totalTeus,
          b.w20e,
          b.w20f,
          b.w40e,
          b.w40f,
          b.totalWeightTons,
          b.closing_time,
          b.estimated_freight,
          b.notes,
        ],
      );
      return res.rows[0];
    });
  }

  async deleteBooking(id: string) {
    await this.db.query(`DELETE FROM bookings WHERE id = $1`, [id]);
    return { ok: true };
  }

  async assignBookingsToBarge(dto: {
    booking_ids: string[];
    vessel_id: string;
    voyage_id?: string;
    voyage_no?: string;
  }) {
    const bookingIds = Array.isArray(dto.booking_ids) ? dto.booking_ids : [];
    if (bookingIds.length === 0) throw new BadRequestException('Chưa chọn booking nào.');

    return this.db.transaction(async (client) => {
      const bkRes = await client.query(
        `SELECT * FROM bookings WHERE id = ANY($1::uuid[])`,
        [bookingIds],
      );
      const selected = bkRes.rows;
      if (selected.length === 0) throw new BadRequestException('Không tìm thấy booking.');

      const vesselRes = await client.query(
        `SELECT id, name, code, COALESCE(capacity_teu, 0)::int AS capacity_teu FROM vessels WHERE id = $1`,
        [dto.vessel_id],
      );
      const vessel = vesselRes.rows[0];
      if (!vessel) throw new BadRequestException('Không tìm thấy sà lan.');

      const sum20e = selected.reduce((s, b) => s + Number(b.cont_20e || 0), 0);
      const sum20f = selected.reduce((s, b) => s + Number(b.cont_20f || 0), 0);
      const sum40e = selected.reduce((s, b) => s + Number(b.cont_40e || 0), 0);
      const sum40f = selected.reduce((s, b) => s + Number(b.cont_40f || 0), 0);
      const sumTeus = this.computeTeus(sum20e, sum20f, sum40e, sum40f);
      const first = selected[0];
      const maxDeadline = selected
        .map((b) => b.closing_time)
        .filter(Boolean)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
      const orderDeadline = this.toIsoDateOnly(maxDeadline);

      let targetVoyageId = dto.voyage_id || null;
      let existingTeus = 0;
      if (targetVoyageId) {
        const existingVyRes = await client.query(
          `SELECT id, status, COALESCE(total_teus, 0)::int AS total_teus FROM voyages WHERE id = $1`,
          [targetVoyageId],
        );
        const existingVy = existingVyRes.rows[0];
        if (!existingVy) throw new BadRequestException('Không tìm thấy chuyến cần ghép.');
        if (existingVy.status !== 'PLANNED') {
          throw new BadRequestException('Chỉ được ghép thêm booking vào chuyến đang gom/xếp hàng (PLANNED).');
        }
        existingTeus = Number(existingVy.total_teus || 0);
      }

      const maxTeu = Number(vessel.capacity_teu || 0);
      const projectedTeus = existingTeus + sumTeus;
      if (projectedTeus > maxTeu) {
        throw new BadRequestException(
          `Vượt sức chở của sà lan ${vessel.name} (${projectedTeus} TEU > tối đa ${maxTeu} TEU). Không thể ghép!`,
        );
      }

      let resolvedVoyageNo = dto.voyage_no || '';
      let resolvedReceivedDate = this.toIsoDateOnly(new Date());
      let resolvedStatus = 'PLANNED';

      if (targetVoyageId) {
        const existingRes = await client.query(
          `SELECT voyage_no, received_date, status FROM voyages WHERE id = $1`,
          [targetVoyageId],
        );
        if (existingRes.rows[0]) {
          resolvedVoyageNo = existingRes.rows[0].voyage_no;
          resolvedReceivedDate = this.toIsoDateOnly(existingRes.rows[0].received_date) || resolvedReceivedDate;
          resolvedStatus = existingRes.rows[0].status || resolvedStatus;
        }
        await client.query(
          `
          UPDATE voyages
          SET
            cont_20e = COALESCE(cont_20e, 0) + $2,
            cont_20f = COALESCE(cont_20f, 0) + $3,
            cont_40e = COALESCE(cont_40e, 0) + $4,
            cont_40f = COALESCE(cont_40f, 0) + $5,
            total_teus = COALESCE(total_teus, 0) + $6
          WHERE id = $1
          `,
          [targetVoyageId, sum20e, sum20f, sum40e, sum40f, sumTeus],
        );
      } else {
        const voyageNo =
          dto.voyage_no && String(dto.voyage_no).trim()
            ? String(dto.voyage_no).trim().toUpperCase()
            : await this.getNextVoyageNoForVessel(client, dto.vessel_id, resolvedReceivedDate);
        resolvedVoyageNo = voyageNo;
        const vyRes = await client.query(
          `
          INSERT INTO voyages (
            voyage_no, vessel_id, customer_id,
            origin_port_id, destination_port_id,
            received_date, cont_20e, cont_20f, cont_40e, cont_40f, total_teus,
            order_deadline, status, workflow_step
          ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, $7, $8, $9, $10, $11, 'PLANNED', 0)
          RETURNING id, received_date
          `,
          [
            voyageNo,
            dto.vessel_id,
            first.customer_id || null,
            first.origin_port_id || null,
            first.destination_port_id || null,
            sum20e,
            sum20f,
            sum40e,
            sum40f,
            sumTeus,
            orderDeadline,
          ],
        );
        targetVoyageId = vyRes.rows[0].id;
        resolvedReceivedDate = this.toIsoDateOnly(vyRes.rows[0].received_date) || resolvedReceivedDate;
      }

      await client.query(
        `UPDATE bookings SET voyage_id = $2, status = 'ASSIGNED', updated_at = NOW() WHERE id = ANY($1::uuid[])`,
        [bookingIds, targetVoyageId],
      );

      for (const bk of selected) {
        await this.insertPlaceholderContainers(client, {
          voyageId: targetVoyageId!,
          bargeCode: vessel.code || vessel.name || null,
          tripNo: resolvedVoyageNo,
          bookingNo: bk.booking_no || null,
          originName: bk.origin_name || null,
          destinationName: bk.dest_name || null,
          shipperName: bk.customer_name || null,
          departureDate: resolvedReceivedDate,
          status: resolvedStatus,
          cont_20e: Number(bk.cont_20e || 0),
          cont_20f: Number(bk.cont_20f || 0),
          cont_40e: Number(bk.cont_40e || 0),
          cont_40f: Number(bk.cont_40f || 0),
        });
      }

      return { ok: true, voyage_id: targetVoyageId, assignedCount: selected.length };
    });
  }

  async unassignBooking(bookingId: string) {
    return this.db.transaction(async (client) => {
      const bkRes = await client.query(`SELECT * FROM bookings WHERE id = $1`, [bookingId]);
      const bk = bkRes.rows[0];
      if (!bk) throw new BadRequestException('Không tìm thấy booking.');
      if (!bk.voyage_id) return { ok: true };

      const vyRes = await client.query(`SELECT id, status FROM voyages WHERE id = $1`, [bk.voyage_id]);
      const vy = vyRes.rows[0];
      if (vy && vy.status !== 'PLANNED') {
        throw new BadRequestException('Chỉ được gỡ booking khi chuyến còn ở trạng thái Đang gom/xếp hàng.');
      }

      const b20e = Number(bk.cont_20e || 0);
      const b20f = Number(bk.cont_20f || 0);
      const b40e = Number(bk.cont_40e || 0);
      const b40f = Number(bk.cont_40f || 0);
      const bTeus = Number(bk.total_teus || this.computeTeus(b20e, b20f, b40e, b40f));

      await client.query(
        `
        UPDATE voyages
        SET
          cont_20e = GREATEST(0, COALESCE(cont_20e, 0) - $2),
          cont_20f = GREATEST(0, COALESCE(cont_20f, 0) - $3),
          cont_40e = GREATEST(0, COALESCE(cont_40e, 0) - $4),
          cont_40f = GREATEST(0, COALESCE(cont_40f, 0) - $5),
          total_teus = GREATEST(0, COALESCE(total_teus, 0) - $6)
        WHERE id = $1
        `,
        [bk.voyage_id, b20e, b20f, b40e, b40f, bTeus],
      );

      await client.query(
        `DELETE FROM voyage_containers WHERE voyage_id = $1 AND booking_no = $2 AND COALESCE(TRIM(container_no), '') = ''`,
        [bk.voyage_id, bk.booking_no],
      );

      await client.query(
        `UPDATE bookings SET voyage_id = NULL, status = 'PENDING', updated_at = NOW() WHERE id = $1`,
        [bookingId],
      );
      return { ok: true };
    });
  }

  async releasePlannedVoyage(voyageId: string) {
    return this.db.transaction(async (client) => {
      const vyRes = await client.query(`SELECT id, status FROM voyages WHERE id = $1`, [voyageId]);
      const vy = vyRes.rows[0];
      if (!vy) throw new BadRequestException('Không tìm thấy chuyến.');
      if (vy.status !== 'PLANNED') {
        throw new BadRequestException('Chỉ có thể nhả chuyến khi chuyến đang ở trạng thái Đang gom/xếp hàng (PLANNED).');
      }

      const releasedRes = await client.query(
        `UPDATE bookings SET voyage_id = NULL, status = 'PENDING', updated_at = NOW() WHERE voyage_id = $1 RETURNING id`,
        [voyageId],
      );

      await client.query(
        `DELETE FROM voyage_containers WHERE voyage_id = $1 AND COALESCE(TRIM(container_no), '') = ''`,
        [voyageId],
      );

      const contCountRes = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM voyage_containers WHERE voyage_id = $1`,
        [voyageId],
      );
      const hasContainers = Number(contCountRes.rows[0]?.cnt || 0) > 0;

      if (!hasContainers) {
        await client.query(`DELETE FROM voyages WHERE id = $1`, [voyageId]);
        return { ok: true, releasedCount: releasedRes.rowCount || 0, deletedVoyage: true };
      }

      await client.query(
        `UPDATE voyages SET cont_20e = 0, cont_20f = 0, cont_40e = 0, cont_40f = 0, total_teus = 0 WHERE id = $1`,
        [voyageId],
      );
      return { ok: true, releasedCount: releasedRes.rowCount || 0, deletedVoyage: false };
    });
  }

  // --- BƯỚC 3 & 4: QUYẾT TOÁN & CẬP NHẬT BƯỚC THUYỀN TRƯỞNG ---
  async submitCaptainStep(
    voyageId: string,
    dto: {
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
      timestamp?: string;
    },
  ) {
    const ts = dto.timestamp || new Date().toISOString();
    const logEntry = JSON.stringify([
      {
        step: dto.step,
        timestamp: ts,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        notes: dto.notes ?? null,
      },
    ]);

    const nextStatus =
      dto.step === 3
        ? 'IN_TRANSIT'
        : dto.step === 4
          ? 'ARRIVED'
          : dto.step === 5
            ? 'COMPLETED'
            : null;

    const res = await this.db.query(
      `
      UPDATE voyages
      SET
        workflow_step = GREATEST(COALESCE(workflow_step, 0), $2),
        status = COALESCE($3, status),
        fuel_start_liters = COALESCE($4, fuel_start_liters),
        fuel_added_liters = COALESCE($5, fuel_added_liters),
        fuel_end_liters = COALESCE($6, fuel_end_liters),
        fuel_start_photo_url = COALESCE($7, fuel_start_photo_url),
        fuel_end_photo_url = COALESCE($8, fuel_end_photo_url),
        pod_photo_url = COALESCE($9, pod_photo_url),
        loading_completed_at = CASE WHEN $2 = 2 THEN COALESCE(loading_completed_at, $10::timestamptz) ELSE loading_completed_at END,
        atd = CASE WHEN $2 = 3 THEN COALESCE(atd, $10::timestamptz) ELSE atd END,
        ata = CASE WHEN $2 = 4 THEN COALESCE(ata, $10::timestamptz) ELSE ata END,
        laytime_start_at = CASE WHEN $2 = 4 THEN COALESCE(laytime_start_at, $10::timestamptz) ELSE laytime_start_at END,
        completed_unloading_at = CASE WHEN $2 = 5 THEN COALESCE(completed_unloading_at, $10::timestamptz) ELSE completed_unloading_at END,
        captain_report_log = COALESCE(captain_report_log, '[]'::jsonb) || $11::jsonb
      WHERE id = $1
      RETURNING *
      `,
      [
        voyageId,
        dto.step,
        nextStatus,
        dto.fuel_start_liters ?? null,
        dto.fuel_added_liters ?? null,
        dto.fuel_end_liters ?? null,
        dto.fuel_start_photo_url ?? null,
        dto.fuel_end_photo_url ?? null,
        dto.pod_photo_url ?? null,
        ts,
        logEntry,
      ],
    );

    if (dto.step === 5) {
      await this.db.query(
        `UPDATE bookings SET status = 'COMPLETED', updated_at = NOW() WHERE voyage_id = $1`,
        [voyageId],
      );
    }

    return res.rows[0];
  }

  async updateVoyageSettlement(
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
    const res = await this.db.query(
      `
      UPDATE voyages
      SET
        fuel_start_liters = COALESCE($2, fuel_start_liters),
        fuel_added_liters = COALESCE($3, fuel_added_liters),
        fuel_end_liters = COALESCE($4, fuel_end_liters),
        fuel_unit_price = COALESCE($5, fuel_unit_price),
        port_fee = COALESCE($6, port_fee),
        crew_salary = COALESCE($7, crew_salary),
        other_cost = COALESCE($8, other_cost)
      WHERE id = $1
      RETURNING *
      `,
      [
        voyageId,
        dto.fuel_start_liters ?? null,
        dto.fuel_added_liters ?? null,
        dto.fuel_end_liters ?? null,
        dto.fuel_unit_price ?? null,
        dto.port_fee ?? null,
        dto.crew_salary ?? null,
        dto.other_cost ?? null,
      ],
    );
    return res.rows[0];
  }

  async getSailingSchedule() {
    const res = await this.db.query(
      `SELECT data, updated_at FROM sailing_schedules WHERE id = 'default' LIMIT 1`,
    );
    if (res.rows.length > 0 && res.rows[0]?.data) {
      return {
        ...res.rows[0].data,
        updated_at: res.rows[0].updated_at,
      };
    }
    await this.db.query(
      `INSERT INTO sailing_schedules (id, data, updated_at)
       VALUES ('default', $1::jsonb, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [JSON.stringify(DEFAULT_SAILING_SCHEDULE)],
    );
    return {
      ...DEFAULT_SAILING_SCHEDULE,
      updated_at: new Date().toISOString(),
    };
  }

  async saveSailingSchedule(body: any) {
    if (!body || !Array.isArray(body.sheets) || body.sheets.length === 0) {
      throw new BadRequestException('Dữ liệu lịch chạy sà lan không hợp lệ.');
    }
    const clean = {
      active_month: String(body.active_month || body.sheets[0].month_key || '2026-11'),
      sheets: body.sheets,
    };
    const res = await this.db.query(
      `INSERT INTO sailing_schedules (id, data, updated_at)
       VALUES ('default', $1::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
       RETURNING data, updated_at`,
      [JSON.stringify(clean)],
    );
    return {
      ...res.rows[0].data,
      updated_at: res.rows[0].updated_at,
    };
  }

  // --- TALLY PHOTOS (CLOUDFLARE R2 + AI VISION EXTRACTION) ---
  getStorageAndAiStatus() {
    const r2 = getR2Config();
    const ai = getAiConfig();
    return {
      r2Configured: r2.configured,
      r2Bucket: r2.configured ? r2.bucket : null,
      aiConfigured: ai.configured,
      aiProvider: ai.provider,
    };
  }

  async listTallyPhotos(voyageId: string) {
    const res = await this.db.query(
      `
      SELECT
        id, voyage_id, vessel_id, image_url, r2_key, storage_provider, mime_type,
        original_size_bytes, compressed_size_bytes, uploaded_by, notes,
        ai_status, ai_provider, ai_raw_text,
        COALESCE(ai_extracted_containers, '[]'::jsonb) AS ai_extracted_containers,
        created_at, updated_at
      FROM voyage_tally_photos
      WHERE voyage_id = $1
      ORDER BY created_at DESC
      `,
      [voyageId],
    );
    return res.rows;
  }

  async uploadTallyPhoto(
    voyageId: string,
    dto: {
      image_data_url: string;
      vessel_id?: string;
      original_size_bytes?: number;
      uploaded_by?: string;
      notes?: string;
    },
  ) {
    if (!dto?.image_data_url) {
      throw new BadRequestException('Thiếu dữ liệu hình ảnh Tally.');
    }
    const vyRes = await this.db.query(
      `SELECT id, voyage_no, vessel_id FROM voyages WHERE id = $1 LIMIT 1`,
      [voyageId],
    );
    const vy = vyRes.rows[0];
    if (!vy) {
      throw new NotFoundException('Không tìm thấy chuyến để lưu hình ảnh Tally.');
    }

    const decoded = decodeBase64DataUrl(dto.image_data_url);
    if (!decoded.buffer || decoded.buffer.length === 0) {
      throw new BadRequestException('Dữ liệu ảnh không hợp lệ.');
    }

    const photoId = crypto.randomUUID();
    const uploaded = await uploadTallyImage({
      photoId,
      voyageCodeOrId: vy.voyage_no || vy.id,
      buffer: decoded.buffer,
      mimeType: decoded.mimeType,
      ext: decoded.ext,
    });

    const res = await this.db.query(
      `
      INSERT INTO voyage_tally_photos (
        id, voyage_id, vessel_id, image_url, r2_key, storage_provider,
        mime_type, original_size_bytes, compressed_size_bytes, uploaded_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
      `,
      [
        photoId,
        voyageId,
        dto.vessel_id || vy.vessel_id || null,
        uploaded.image_url,
        uploaded.r2_key,
        uploaded.storage_provider,
        decoded.mimeType,
        Number(dto.original_size_bytes || decoded.buffer.length),
        decoded.buffer.length,
        dto.uploaded_by || 'Thuyền trưởng',
        dto.notes || null,
      ],
    );
    return res.rows[0];
  }

  async getTallyPhotoBinary(photoId: string) {
    const res = await this.db.query(
      `SELECT id, storage_provider, r2_key, mime_type FROM voyage_tally_photos WHERE id = $1 LIMIT 1`,
      [photoId],
    );
    const row = res.rows[0];
    if (!row) {
      throw new NotFoundException('Không tìm thấy ảnh Tally.');
    }
    const bin = await readTallyImageBinary({
      photoId: row.id,
      storage_provider: row.storage_provider,
      r2_key: row.r2_key,
      mime_type: row.mime_type,
    });
    if (!bin) {
      throw new NotFoundException('Không đọc được dữ liệu file ảnh Tally.');
    }
    return bin;
  }

  async extractTallyPhotoWithAi(photoId: string, overrideApiKey?: string) {
    const res = await this.db.query(
      `SELECT * FROM voyage_tally_photos WHERE id = $1 LIMIT 1`,
      [photoId],
    );
    const row = res.rows[0];
    if (!row) {
      throw new NotFoundException('Không tìm thấy ảnh Tally.');
    }

    try {
      const bin = await readTallyImageBinary({
        photoId: row.id,
        storage_provider: row.storage_provider,
        r2_key: row.r2_key,
        image_url: row.image_url,
        mime_type: row.mime_type,
      });
      if (!bin) {
        throw new BadRequestException('Không tải được ảnh Tally từ kho lưu trữ để phân tích AI.');
      }

      const aiRes = await runAiContainerExtraction({
        imageBuffer: bin.buffer,
        mimeType: bin.mimeType,
        overrideApiKey,
      });

      if (!aiRes.ai_configured) {
        return {
          ai_configured: false,
          message: aiRes.message,
          photo: row,
        };
      }

      const upd = await this.db.query(
        `
        UPDATE voyage_tally_photos
        SET
          ai_status = 'EXTRACTED',
          ai_provider = $2,
          ai_raw_text = $3,
          ai_extracted_containers = $4::jsonb,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [photoId, aiRes.provider, aiRes.raw_text, JSON.stringify(aiRes.containers)],
      );

      return {
        ai_configured: true,
        provider: aiRes.provider,
        containers: aiRes.containers,
        photo: upd.rows[0],
      };
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) {
        throw err;
      }
      this.logger.error(`AI extraction failed for photo ${photoId}: ${err?.message || err}`);
      throw new BadRequestException(err?.message || 'Lỗi khi gọi AI phân tích ảnh Tally.');
    }
  }

  async updateTallyPhotoExtracted(photoId: string, containers: any[]) {
    const upd = await this.db.query(
      `
      UPDATE voyage_tally_photos
      SET
        ai_status = CASE WHEN ai_status = 'PENDING' THEN 'EDITED' ELSE ai_status END,
        ai_extracted_containers = $2::jsonb,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [photoId, JSON.stringify(Array.isArray(containers) ? containers : [])],
    );
    if (!upd.rows[0]) {
      throw new NotFoundException('Không tìm thấy ảnh Tally.');
    }
    return upd.rows[0];
  }

  async deleteTallyPhoto(photoId: string) {
    const res = await this.db.query(
      `DELETE FROM voyage_tally_photos WHERE id = $1 RETURNING id, storage_provider, r2_key`,
      [photoId],
    );
    const row = res.rows[0];
    if (!row) return { ok: true };
    await deleteTallyImageBinary({
      photoId: row.id,
      storage_provider: row.storage_provider,
      r2_key: row.r2_key,
    });
    return { ok: true };
  }
}
