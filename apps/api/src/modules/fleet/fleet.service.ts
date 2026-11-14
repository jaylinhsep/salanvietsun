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

  async updateStatus(id: string, status: string) {
    const res = await this.db.query(
      `UPDATE vessels SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING id, code, status`,
      [id, status],
    );
    return res.rows[0];
  }

  async getEquipment(vesselId?: string) {
    const query = vesselId
      ? `SELECT e.*, v.code AS vessel_code, v.name AS vessel_name FROM vessel_equipment e JOIN vessels v ON v.id = e.vessel_id WHERE e.vessel_id = $1 ORDER BY e.created_at DESC`
      : `SELECT e.*, v.code AS vessel_code, v.name AS vessel_name FROM vessel_equipment e JOIN vessels v ON v.id = e.vessel_id ORDER BY e.created_at DESC`;
    const res = await this.db.query(query, vesselId ? [vesselId] : []);
    return res.rows;
  }
}
