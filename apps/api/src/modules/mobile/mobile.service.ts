import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { TrackingService } from '../tracking/tracking.service';
import { DispatchService } from '../dispatch/dispatch.service';

@Injectable()
export class MobileService {
  constructor(
    private readonly db: DatabaseService,
    private readonly trackingService: TrackingService,
    private readonly dispatchService: DispatchService,
  ) {}

  async getCaptainSummary(vesselCode = 'VS-SL-01') {
    const vesselRes = await this.db.query(
      `
      SELECT id, code, name, registration_no, status, captain_name,
        current_speed_knots::float, current_fuel_liters::float,
        ST_Y(current_location::geometry) AS lat,
        ST_X(current_location::geometry) AS lng
      FROM vessels WHERE code = $1 LIMIT 1
      `,
      [vesselCode],
    );
    const vessel = vesselRes.rows[0];
    if (!vessel) return { vessel: null, activeVoyage: null };

    const voyageRes = await this.db.query(
      `
      SELECT vy.*, op.name AS origin_name, dp.name AS dest_name,
        o.order_no, o.cargo_type, o.cargo_weight_tons::float
      FROM voyages vy
      LEFT JOIN ports op ON op.id = vy.origin_port_id
      LEFT JOIN ports dp ON dp.id = vy.destination_port_id
      LEFT JOIN orders o ON o.id = vy.order_id
      WHERE vy.vessel_id = $1 AND vy.status IN ('PLANNED', 'DEPARTED', 'IN_TRANSIT')
      ORDER BY vy.created_at DESC
      LIMIT 1
      `,
      [vessel.id],
    );

    return {
      vessel,
      activeVoyage: voyageRes.rows[0] || null,
    };
  }

  async captainCheckIn(dto: {
    vessel_id: string;
    voyage_id?: string;
    lat: number;
    lng: number;
    action: 'DEPART' | 'ARRIVE' | 'CHECKPOINT';
    notes?: string;
  }) {
    await this.trackingService.ingestAisPing({
      vessel_id: dto.vessel_id,
      voyage_id: dto.voyage_id,
      lat: dto.lat,
      lng: dto.lng,
      speed_knots: dto.action === 'ARRIVE' ? 0 : 7.5,
    });

    // Check nearby port with PostGIS ST_DWithin
    const portRes = await this.db.query(
      `
      SELECT id, code, name,
        ROUND(ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)::numeric, 0)::int AS distance_m
      FROM ports
      ORDER BY location <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      LIMIT 1
      `,
      [dto.lng, dto.lat],
    );

    if (dto.voyage_id && (dto.action === 'DEPART' || dto.action === 'ARRIVE')) {
      const nextStatus = dto.action === 'DEPART' ? 'IN_TRANSIT' : 'ARRIVED';
      await this.dispatchService.updateVoyageStatus(dto.voyage_id, nextStatus);
    }

    return {
      ok: true,
      action: dto.action,
      nearest_port: portRes.rows[0] || null,
      timestamp: new Date().toISOString(),
    };
  }
}
