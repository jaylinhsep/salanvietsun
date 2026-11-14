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
        ST_Y(dp.location::geometry) AS dest_lat, ST_X(dp.location::geometry) AS dest_lng
      FROM voyages vy
      LEFT JOIN customers c ON c.id = vy.customer_id
      LEFT JOIN vessels v ON v.id = vy.vessel_id
      LEFT JOIN orders o ON o.id = vy.order_id
      LEFT JOIN ports op ON op.id = vy.origin_port_id
      LEFT JOIN ports dp ON dp.id = vy.destination_port_id
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
}
