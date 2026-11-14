import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

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
    await this.db.query(`DELETE FROM ports WHERE id = $1`, [id]);
    return { ok: true };
  }

  // --- VOYAGES CRUD ---
  async listVoyages() {
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
        COALESCE(vc.detail_teus, 0) AS detail_teus,
        COALESCE(vc.detail_revenue, 0) AS detail_revenue
      FROM voyages vy
      LEFT JOIN customers c ON c.id = vy.customer_id
      LEFT JOIN vessels v ON v.id = vy.vessel_id
      LEFT JOIN orders o ON o.id = vy.order_id
      LEFT JOIN ports op ON op.id = vy.origin_port_id
      LEFT JOIN ports dp ON dp.id = vy.destination_port_id
      LEFT JOIN (
        SELECT
          voyage_id,
          COUNT(*)::int AS detail_count,
          COALESCE(SUM(CASE WHEN cont_type IN ('40E', '40F') THEN 2 ELSE 1 END), 0)::int AS detail_teus,
          COALESCE(SUM(total_amount), 0)::float AS detail_revenue
        FROM voyage_containers
        GROUP BY voyage_id
      ) vc ON vc.voyage_id = vy.id
      ORDER BY COALESCE(vy.received_date, vy.created_at::date) DESC, vy.created_at DESC
    `);
    return res.rows;
  }

  private computeTeus(c20e = 0, c20f = 0, c40e = 0, c40f = 0): number {
    return Number(c20e || 0) + Number(c20f || 0) + (Number(c40e || 0) + Number(c40f || 0)) * 2;
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
        dto.voyage_no,
        dto.vessel_id || null,
        dto.tugboat_id || null,
        dto.order_id || null,
        dto.customer_id || null,
        dto.origin_port_id,
        dto.destination_port_id,
        dto.etd || null,
        dto.eta || null,
        plannedNm,
        dto.received_date || new Date().toISOString().slice(0, 10),
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
    return res.rows[0];
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

  // --- VOYAGE CONTAINERS (CHI TIẾT TỪNG CHUYẾN) ---
  private normalizeContType(raw?: string): '20E' | '20F' | '40E' | '40F' {
    const up = (raw || '20F').trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (up === '20E' || up === '20F' || up === '40E' || up === '40F') {
      return up;
    }
    return '20F';
  }

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
      SELECT
        id, voyage_id, barge_code, trip_no, container_no,
        origin_name, destination_name, shipper_name,
        departure_date, cont_type,
        unit_price::float, baf::float, total_amount::float, fuel_price_no_vat::float,
        notes, created_at, updated_at
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
        voyage_id, barge_code, trip_no, container_no,
        origin_name, destination_name, shipper_name, departure_date,
        cont_type, unit_price, baf, total_amount, fuel_price_no_vat, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING
        id, voyage_id, barge_code, trip_no, container_no,
        origin_name, destination_name, shipper_name,
        departure_date, cont_type,
        unit_price::float, baf::float, total_amount::float, fuel_price_no_vat::float,
        notes, created_at, updated_at
      `,
      [
        voyageId,
        p.barge_code,
        p.trip_no,
        p.container_no,
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
      .filter((r) => r.container_no.length > 0);

    return this.db.transaction(async (client) => {
      if (payload?.replace) {
        await client.query(`DELETE FROM voyage_containers WHERE voyage_id = $1`, [voyageId]);
      }
      const inserted = [];
      for (const p of normalized) {
        const res = await client.query(
          `
          INSERT INTO voyage_containers (
            voyage_id, barge_code, trip_no, container_no,
            origin_name, destination_name, shipper_name, departure_date,
            cont_type, unit_price, baf, total_amount, fuel_price_no_vat, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING
            id, voyage_id, barge_code, trip_no, container_no,
            origin_name, destination_name, shipper_name,
            departure_date, cont_type,
            unit_price::float, baf::float, total_amount::float, fuel_price_no_vat::float,
            notes, created_at, updated_at
          `,
          [
            voyageId,
            p.barge_code,
            p.trip_no,
            p.container_no,
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

  async updateVoyageContainer(containerId: string, dto: any) {
    const p = this.normalizeContainerPayload(dto);
    const res = await this.db.query(
      `
      UPDATE voyage_containers
      SET
        barge_code = COALESCE($2, barge_code),
        trip_no = COALESCE($3, trip_no),
        container_no = CASE WHEN $4 <> '' THEN $4 ELSE container_no END,
        origin_name = COALESCE($5, origin_name),
        destination_name = COALESCE($6, destination_name),
        shipper_name = COALESCE($7, shipper_name),
        departure_date = COALESCE($8, departure_date),
        cont_type = $9,
        unit_price = $10,
        baf = $11,
        total_amount = $12,
        fuel_price_no_vat = $13,
        notes = $14,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id, voyage_id, barge_code, trip_no, container_no,
        origin_name, destination_name, shipper_name,
        departure_date, cont_type,
        unit_price::float, baf::float, total_amount::float, fuel_price_no_vat::float,
        notes, created_at, updated_at
      `,
      [
        containerId,
        p.barge_code,
        p.trip_no,
        p.container_no,
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
}
