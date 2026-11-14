import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class DispatchService {
  constructor(private readonly db: DatabaseService) {}

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

  async listVoyages() {
    const res = await this.db.query(`
      SELECT
        vy.id, vy.voyage_no, vy.status, vy.etd, vy.eta, vy.atd, vy.ata,
        vy.planned_distance_nm::float, vy.captain_notes, vy.created_at,
        v.id AS vessel_id, v.code AS vessel_code, v.name AS vessel_name, v.captain_name,
        o.id AS order_id, o.order_no, o.cargo_type, o.cargo_weight_tons::float,
        op.code AS origin_code, op.name AS origin_name,
        ST_Y(op.location::geometry) AS origin_lat, ST_X(op.location::geometry) AS origin_lng,
        dp.code AS dest_code, dp.name AS dest_name,
        ST_Y(dp.location::geometry) AS dest_lat, ST_X(dp.location::geometry) AS dest_lng
      FROM voyages vy
      LEFT JOIN vessels v ON v.id = vy.vessel_id
      LEFT JOIN orders o ON o.id = vy.order_id
      LEFT JOIN ports op ON op.id = vy.origin_port_id
      LEFT JOIN ports dp ON dp.id = vy.destination_port_id
      ORDER BY vy.created_at DESC
    `);
    return res.rows;
  }

  async createVoyage(dto: {
    voyage_no: string;
    vessel_id: string;
    tugboat_id?: string;
    order_id?: string;
    origin_port_id: string;
    destination_port_id: string;
    etd: string;
    eta: string;
    captain_notes?: string;
  }) {
    // Calculate straight-line nautical miles using PostGIS ST_Distance as baseline * 1.25 river factor
    const distRes = await this.db.query(
      `
      SELECT ROUND((ST_Distance(a.location, b.location) / 1852.0 * 1.25)::numeric, 2)::float AS nm
      FROM ports a, ports b
      WHERE a.id = $1 AND b.id = $2
      `,
      [dto.origin_port_id, dto.destination_port_id],
    );
    const plannedNm = distRes.rows[0]?.nm ?? 35.0;

    const res = await this.db.query(
      `
      INSERT INTO voyages (
        voyage_no, vessel_id, tugboat_id, order_id,
        origin_port_id, destination_port_id, etd, eta, planned_distance_nm, captain_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
      `,
      [
        dto.voyage_no,
        dto.vessel_id,
        dto.tugboat_id || null,
        dto.order_id || null,
        dto.origin_port_id,
        dto.destination_port_id,
        dto.etd,
        dto.eta,
        plannedNm,
        dto.captain_notes || null,
      ],
    );
    return res.rows[0];
  }

  async updateVoyageStatus(id: string, status: string) {
    const timeCol = status === 'DEPARTED' || status === 'IN_TRANSIT' ? ', atd = COALESCE(atd, NOW())' : status === 'ARRIVED' || status === 'COMPLETED' ? ', ata = COALESCE(ata, NOW())' : '';
    const res = await this.db.query(
      `UPDATE voyages SET status = $2 ${timeCol} WHERE id = $1 RETURNING *`,
      [id, status],
    );
    return res.rows[0];
  }
}
