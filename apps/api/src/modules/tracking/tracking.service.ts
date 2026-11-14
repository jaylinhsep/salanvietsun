import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class TrackingService {
  constructor(private readonly db: DatabaseService) {}

  async getLivePositions() {
    const res = await this.db.query(`
      SELECT
        v.id, v.code, v.name, v.status, v.vessel_type,
        v.current_speed_knots::float AS speed_knots,
        v.current_fuel_liters::float AS fuel_liters,
        v.fuel_norm_l_per_hour::float AS fuel_norm,
        v.captain_name, v.captain_phone,
        ST_Y(v.current_location::geometry) AS lat,
        ST_X(v.current_location::geometry) AS lng,
        (
          SELECT p.name
          FROM ports p
          WHERE ST_DWithin(v.current_location, p.location, p.geofence_radius_m)
          LIMIT 1
        ) AS nearby_port
      FROM vessels v
      ORDER BY v.code ASC
    `);
    return res.rows;
  }

  async ingestAisPing(dto: {
    vessel_id: string;
    voyage_id?: string;
    lat: number;
    lng: number;
    speed_knots?: number;
    heading?: number;
    engine_rpm?: number;
    fuel_level_liters?: number;
  }) {
    await this.db.query(
      `
      INSERT INTO ais_positions (
        vessel_id, voyage_id, position, speed_knots, heading, engine_rpm, fuel_level_liters
      ) VALUES (
        $1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5, $6, $7, $8
      )
      `,
      [
        dto.vessel_id,
        dto.voyage_id || null,
        dto.lng,
        dto.lat,
        dto.speed_knots ?? 0,
        dto.heading ?? 0,
        dto.engine_rpm ?? 0,
        dto.fuel_level_liters ?? null,
      ],
    );

    const updated = await this.db.query(
      `
      UPDATE vessels
      SET
        current_location = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
        current_speed_knots = COALESCE($4, current_speed_knots),
        current_fuel_liters = COALESCE($5, current_fuel_liters),
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, code, name, current_speed_knots::float, current_fuel_liters::float
      `,
      [dto.vessel_id, dto.lng, dto.lat, dto.speed_knots ?? null, dto.fuel_level_liters ?? null],
    );

    return { ok: true, vessel: updated.rows[0] };
  }

  async getFuelLogs(vesselId?: string) {
    const query = vesselId
      ? `SELECT f.*, v.code AS vessel_code, v.name AS vessel_name FROM fuel_logs f JOIN vessels v ON v.id = f.vessel_id WHERE f.vessel_id = $1 ORDER BY f.logged_at DESC`
      : `SELECT f.*, v.code AS vessel_code, v.name AS vessel_name FROM fuel_logs f JOIN vessels v ON v.id = f.vessel_id ORDER BY f.logged_at DESC LIMIT 100`;
    const res = await this.db.query(query, vesselId ? [vesselId] : []);
    return res.rows;
  }

  async createFuelLog(dto: {
    vessel_id: string;
    voyage_id?: string;
    log_type: 'BUNKERING' | 'CONSUMPTION' | 'ROB';
    quantity_liters: number;
    unit_price_vnd?: number;
    engine_hours?: number;
    reported_by?: string;
    location_name?: string;
    notes?: string;
  }) {
    const res = await this.db.query(
      `
      INSERT INTO fuel_logs (
        vessel_id, voyage_id, log_type, quantity_liters, unit_price_vnd,
        engine_hours, reported_by, location_name, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        dto.vessel_id,
        dto.voyage_id || null,
        dto.log_type,
        dto.quantity_liters,
        dto.unit_price_vnd ?? 0,
        dto.engine_hours ?? null,
        dto.reported_by ?? null,
        dto.location_name ?? null,
        dto.notes ?? null,
      ],
    );

    // Update current fuel ROB on vessel
    if (dto.log_type === 'BUNKERING') {
      await this.db.query(
        `UPDATE vessels SET current_fuel_liters = current_fuel_liters + $2, updated_at = NOW() WHERE id = $1`,
        [dto.vessel_id, dto.quantity_liters],
      );
    } else if (dto.log_type === 'CONSUMPTION') {
      await this.db.query(
        `UPDATE vessels SET current_fuel_liters = GREATEST(0, current_fuel_liters - $2), updated_at = NOW() WHERE id = $1`,
        [dto.vessel_id, dto.quantity_liters],
      );
    } else if (dto.log_type === 'ROB') {
      await this.db.query(
        `UPDATE vessels SET current_fuel_liters = $2, updated_at = NOW() WHERE id = $1`,
        [dto.vessel_id, dto.quantity_liters],
      );
    }

    return res.rows[0];
  }
}
