import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class FleetService {
  constructor(private readonly db: DatabaseService) {}

  async findAllVessels() {
    const res = await this.db.query(`
      SELECT
        id, code, name, registration_no, vessel_type,
        capacity_tons::float, capacity_teu, length_m::float, width_m::float, max_draft_m::float,
        main_engine_hp, fuel_norm_l_per_hour::float, status,
        inspection_expiry, insurance_expiry,
        ST_Y(current_location::geometry) AS lat,
        ST_X(current_location::geometry) AS lng,
        current_speed_knots::float, current_fuel_liters::float,
        captain_name, captain_phone, created_at
      FROM vessels
      ORDER BY code ASC
    `);
    return res.rows;
  }

  async createVessel(dto: {
    code: string;
    name: string;
    registration_no: string;
    vessel_type: string;
    capacity_tons: number;
    capacity_teu?: number;
    main_engine_hp?: number;
    fuel_norm_l_per_hour?: number;
    captain_name?: string;
    captain_phone?: string;
    lat?: number;
    lng?: number;
  }) {
    const lng = dto.lng ?? 106.7918;
    const lat = dto.lat ?? 10.7615;
    const res = await this.db.query(
      `
      INSERT INTO vessels (
        code, name, registration_no, vessel_type, capacity_tons, capacity_teu,
        main_engine_hp, fuel_norm_l_per_hour, captain_name, captain_phone, current_location
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        ST_SetSRID(ST_MakePoint($11, $12), 4326)::geography
      )
      RETURNING id, code, name, registration_no, vessel_type, capacity_tons::float, status
      `,
      [
        dto.code,
        dto.name,
        dto.registration_no,
        dto.vessel_type,
        dto.capacity_tons,
        dto.capacity_teu ?? 0,
        dto.main_engine_hp ?? 0,
        dto.fuel_norm_l_per_hour ?? 45,
        dto.captain_name ?? null,
        dto.captain_phone ?? null,
        lng,
        lat,
      ],
    );
    return res.rows[0];
  }

  async updateVessel(
    id: string,
    dto: {
      code?: string;
      name?: string;
      registration_no?: string;
      vessel_type?: string;
      capacity_tons?: number;
      capacity_teu?: number;
      main_engine_hp?: number;
      fuel_norm_l_per_hour?: number;
      status?: string;
      inspection_expiry?: string;
      captain_name?: string;
      captain_phone?: string;
    },
  ) {
    const res = await this.db.query(
      `
      UPDATE vessels
      SET
        code = COALESCE($2, code),
        name = COALESCE($3, name),
        registration_no = COALESCE($4, registration_no),
        vessel_type = COALESCE($5, vessel_type),
        capacity_tons = COALESCE($6, capacity_tons),
        capacity_teu = COALESCE($7, capacity_teu),
        main_engine_hp = COALESCE($8, main_engine_hp),
        fuel_norm_l_per_hour = COALESCE($9, fuel_norm_l_per_hour),
        status = COALESCE($10, status),
        inspection_expiry = COALESCE($11, inspection_expiry),
        captain_name = COALESCE($12, captain_name),
        captain_phone = COALESCE($13, captain_phone),
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, code, name, registration_no, vessel_type, capacity_tons::float, capacity_teu, main_engine_hp, fuel_norm_l_per_hour::float, status, inspection_expiry, captain_name, captain_phone
      `,
      [
        id,
        dto.code ?? null,
        dto.name ?? null,
        dto.registration_no ?? null,
        dto.vessel_type ?? null,
        dto.capacity_tons ?? null,
        dto.capacity_teu ?? null,
        dto.main_engine_hp ?? null,
        dto.fuel_norm_l_per_hour ?? null,
        dto.status ?? null,
        dto.inspection_expiry || null,
        dto.captain_name ?? null,
        dto.captain_phone ?? null,
      ],
    );
    return res.rows[0];
  }

  async updateStatus(id: string, status: string) {
    const res = await this.db.query(
      `UPDATE vessels SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING id, code, status`,
      [id, status],
    );
    return res.rows[0];
  }

  async getEquipment(vesselId?: string) {
    const query = vesselId
      ? `SELECT e.*, e.running_hours::float, e.next_service_hours::float, v.code AS vessel_code, v.name AS vessel_name FROM vessel_equipment e JOIN vessels v ON v.id = e.vessel_id WHERE e.vessel_id = $1 ORDER BY e.created_at DESC`
      : `SELECT e.*, e.running_hours::float, e.next_service_hours::float, v.code AS vessel_code, v.name AS vessel_name FROM vessel_equipment e JOIN vessels v ON v.id = e.vessel_id ORDER BY e.created_at DESC`;
    const res = await this.db.query(query, vesselId ? [vesselId] : []);
    return res.rows;
  }

  async createEquipment(dto: {
    vessel_id: string;
    name: string;
    category: string;
    serial_no?: string;
    running_hours?: number;
    next_service_hours?: number;
    status?: string;
  }) {
    const res = await this.db.query(
      `
      INSERT INTO vessel_equipment (vessel_id, name, category, serial_no, running_hours, next_service_hours, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *, running_hours::float, next_service_hours::float
      `,
      [
        dto.vessel_id,
        dto.name,
        dto.category || 'MAIN_ENGINE',
        dto.serial_no ?? null,
        dto.running_hours ?? 0,
        dto.next_service_hours ?? null,
        dto.status || 'OPERATIONAL',
      ],
    );
    return res.rows[0];
  }

  async updateEquipment(
    id: string,
    dto: {
      name?: string;
      category?: string;
      serial_no?: string;
      running_hours?: number;
      next_service_hours?: number;
      status?: string;
    },
  ) {
    const res = await this.db.query(
      `
      UPDATE vessel_equipment
      SET
        name = COALESCE($2, name),
        category = COALESCE($3, category),
        serial_no = COALESCE($4, serial_no),
        running_hours = COALESCE($5, running_hours),
        next_service_hours = COALESCE($6, next_service_hours),
        status = COALESCE($7, status)
      WHERE id = $1
      RETURNING *, running_hours::float, next_service_hours::float
      `,
      [
        id,
        dto.name ?? null,
        dto.category ?? null,
        dto.serial_no ?? null,
        dto.running_hours ?? null,
        dto.next_service_hours ?? null,
        dto.status ?? null,
      ],
    );
    return res.rows[0];
  }

  async deleteEquipment(id: string) {
    await this.db.query(`DELETE FROM vessel_equipment WHERE id = $1`, [id]);
    return { ok: true };
  }
}
