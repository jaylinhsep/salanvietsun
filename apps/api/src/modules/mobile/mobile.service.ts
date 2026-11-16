import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../../database/database.service';
import { TrackingService } from '../tracking/tracking.service';
import { DispatchService } from '../dispatch/dispatch.service';

export interface CaptainSessionUser {
  id: string;
  username: string;
  full_name: string;
  vessel_code: string;
  role: string;
}

const CAPTAIN_TOKEN_SECRET =
  process.env.CAPTAIN_AUTH_SECRET || 'vietsun-captain-secret-2026-hmac';
const CAPTAIN_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;

const DEFAULT_CAPTAIN_SEEDS = [
  {
    username: 'nv18',
    password: process.env.CAPTAIN_NV18_PASSWORD || 'nv18@2026',
    full_name: 'Thuyền trưởng NHẬT VIỆT 18',
    vessel_code: 'NV18',
  },
  {
    username: 'nv36',
    password: process.env.CAPTAIN_NV36_PASSWORD || 'nv36@2026',
    full_name: 'Thuyền trưởng NHẬT VIỆT 36',
    vessel_code: 'NV36',
  },
  {
    username: 'nv38',
    password: process.env.CAPTAIN_NV38_PASSWORD || 'nv38@2026',
    full_name: 'Thuyền trưởng NHẬT VIỆT 38',
    vessel_code: 'NV38',
  },
];

@Injectable()
export class MobileService implements OnModuleInit {
  private readonly logger = new Logger(MobileService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly trackingService: TrackingService,
    private readonly dispatchService: DispatchService,
  ) {}

  private hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(password, salt, 32).toString('hex');
    return `${salt}:${derived}`;
  }

  private verifyPassword(password: string, storedHash: string): boolean {
    const [salt, expectedHex] = String(storedHash || '').split(':');
    if (!salt || !expectedHex) return false;
    const derived = crypto.scryptSync(password, salt, 32);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  }

  private signCaptainToken(user: CaptainSessionUser): string {
    const payload = {
      sub: user.id,
      username: user.username,
      full_name: user.full_name,
      vessel_code: user.vessel_code,
      role: user.role,
      exp: Date.now() + CAPTAIN_TOKEN_TTL_MS,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto
      .createHmac('sha256', CAPTAIN_TOKEN_SECRET)
      .update(body)
      .digest('base64url');
    return `${body}.${sig}`;
  }

  private async ensureSchemaAndSeed(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS captain_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(60) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name VARCHAR(120) NOT NULL,
        vessel_code VARCHAR(40) NOT NULL,
        role VARCHAR(30) NOT NULL DEFAULT 'CAPTAIN',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    for (const seed of DEFAULT_CAPTAIN_SEEDS) {
      await this.db.query(
        `
        INSERT INTO captain_accounts (username, password_hash, full_name, vessel_code, role)
        VALUES ($1, $2, $3, $4, 'CAPTAIN')
        ON CONFLICT (username) DO NOTHING
        `,
        [seed.username, this.hashPassword(seed.password), seed.full_name, seed.vessel_code],
      );
    }
  }

  async onModuleInit() {
    try {
      await this.ensureSchemaAndSeed();
    } catch (err: any) {
      this.logger.warn(`Captain accounts bootstrap skipped: ${err?.message}`);
    }
  }

  private async authenticateHeader(authHeader?: string): Promise<{
    account: CaptainSessionUser;
    vessel: any;
  }> {
    const raw = String(authHeader || '').trim();
    if (!raw.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Vui lòng đăng nhập tài khoản Thuyền trưởng.');
    }
    const token = raw.slice(7).trim();
    const dot = token.indexOf('.');
    if (dot <= 0) {
      throw new UnauthorizedException('Token đăng nhập không hợp lệ.');
    }
    const body = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expectedSig = crypto
      .createHmac('sha256', CAPTAIN_TOKEN_SECRET)
      .update(body)
      .digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      throw new UnauthorizedException('Chữ ký phiên đăng nhập không hợp lệ.');
    }

    let payload: any;
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập bị lỗi.');
    }
    if (!payload?.username || !payload?.vessel_code || !payload?.exp || Date.now() > Number(payload.exp)) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
    }

    const accRes = await this.db.query(
      `SELECT id, username, full_name, vessel_code, role, is_active FROM captain_accounts WHERE username = $1 LIMIT 1`,
      [String(payload.username).trim().toLowerCase()],
    );
    const acc = accRes.rows[0];
    if (!acc || acc.is_active === false) {
      throw new UnauthorizedException('Tài khoản Thuyền trưởng không tồn tại hoặc đã bị khóa.');
    }

    const vesselRes = await this.db.query(
      `
      SELECT v.*, ST_Y(v.current_location::geometry) AS lat, ST_X(v.current_location::geometry) AS lng
      FROM vessels v
      WHERE UPPER(v.code) = UPPER($1)
      LIMIT 1
      `,
      [acc.vessel_code],
    );
    const vessel = vesselRes.rows[0];
    if (!vessel) {
      throw new ForbiddenException(`Không tìm thấy sà lan được phân công (${acc.vessel_code}).`);
    }

    return {
      account: {
        id: acc.id,
        username: acc.username,
        full_name: acc.full_name,
        vessel_code: acc.vessel_code,
        role: acc.role,
      },
      vessel,
    };
  }

  async loginCaptain(dto: { username?: string; password?: string }) {
    await this.ensureSchemaAndSeed();
    const username = String(dto?.username || '').trim().toLowerCase();
    const password = String(dto?.password || '');
    if (!username || !password) {
      throw new UnauthorizedException('Vui lòng nhập tên đăng nhập và mật khẩu.');
    }

    const accRes = await this.db.query(
      `SELECT id, username, password_hash, full_name, vessel_code, role, is_active FROM captain_accounts WHERE username = $1 LIMIT 1`,
      [username],
    );
    const acc = accRes.rows[0];
    if (!acc || acc.is_active === false || !this.verifyPassword(password, acc.password_hash)) {
      throw new UnauthorizedException('Sai tên đăng nhập hoặc mật khẩu.');
    }

    const vesselRes = await this.db.query(
      `
      SELECT v.*, ST_Y(v.current_location::geometry) AS lat, ST_X(v.current_location::geometry) AS lng
      FROM vessels v
      WHERE UPPER(v.code) = UPPER($1)
      LIMIT 1
      `,
      [acc.vessel_code],
    );
    const vessel = vesselRes.rows[0] || null;
    const captain: CaptainSessionUser = {
      id: acc.id,
      username: acc.username,
      full_name: acc.full_name,
      vessel_code: acc.vessel_code,
      role: acc.role,
    };
    return {
      token: this.signCaptainToken(captain),
      captain,
      vessel,
    };
  }

  async getCaptainWorkspace(authHeader?: string) {
    const { account, vessel } = await this.authenticateHeader(authHeader);

    const voyagesRes = await this.db.query(
      `
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
        vy.origin_port_id, op.code AS origin_code, op.name AS origin_name,
        ST_Y(op.location::geometry) AS origin_lat, ST_X(op.location::geometry) AS origin_lng,
        vy.destination_port_id, dp.code AS dest_code, dp.name AS dest_name,
        ST_Y(dp.location::geometry) AS dest_lat, ST_X(dp.location::geometry) AS dest_lng,
        COALESCE(vy.workflow_step, 0) AS workflow_step,
        COALESCE(vy.fuel_start_liters, 0)::float AS fuel_start_liters,
        COALESCE(vy.fuel_added_liters, 0)::float AS fuel_added_liters,
        COALESCE(vy.fuel_end_liters, 0)::float AS fuel_end_liters,
        COALESCE(vy.fuel_unit_price, 21500)::float AS fuel_unit_price,
        vy.loading_completed_at, vy.laytime_start_at, vy.completed_unloading_at,
        vy.pod_photo_url, vy.fuel_start_photo_url, vy.fuel_end_photo_url,
        COALESCE(vy.captain_report_log, '[]'::jsonb) AS captain_report_log,
        bk.booking_nos, bk.earliest_closing_time
      FROM voyages vy
      LEFT JOIN customers c ON c.id = vy.customer_id
      LEFT JOIN vessels v ON v.id = vy.vessel_id
      LEFT JOIN ports op ON op.id = vy.origin_port_id
      LEFT JOIN ports dp ON dp.id = vy.destination_port_id
      LEFT JOIN (
        SELECT
          voyage_id,
          STRING_AGG(booking_no, ', ' ORDER BY created_at ASC) AS booking_nos,
          MIN(closing_time) AS earliest_closing_time
        FROM bookings
        WHERE voyage_id IS NOT NULL
        GROUP BY voyage_id
      ) bk ON bk.voyage_id = vy.id
      WHERE vy.vessel_id = $1
      ORDER BY COALESCE(vy.received_date, vy.created_at::date) DESC, vy.created_at DESC
      LIMIT 60
      `,
      [vessel.id],
    );

    const fuelLogs = await this.trackingService.getFuelLogs(vessel.id);

    const maintRes = await this.db.query(
      `
      SELECT m.*, v.code AS vessel_code, v.name AS vessel_name
      FROM maintenance_orders m
      LEFT JOIN vessels v ON v.id = m.vessel_id
      WHERE m.vessel_id = $1
      ORDER BY m.created_at DESC
      LIMIT 40
      `,
      [vessel.id],
    );

    return {
      captain: account,
      vessel,
      voyages: voyagesRes.rows,
      fuelLogs,
      maintenanceOrders: maintRes.rows,
    };
  }

  async getCaptainSummaryWithAuth(authHeader?: string) {
    const { account, vessel } = await this.authenticateHeader(authHeader);
    const res = await this.getCaptainSummary(vessel.code);
    return { ...res, captain: account };
  }

  private async assertVoyageOwnership(vesselId: string, voyageId?: string) {
    if (!voyageId) return;
    const vyRes = await this.db.query(
      `SELECT id, vessel_id FROM voyages WHERE id = $1 LIMIT 1`,
      [voyageId],
    );
    const vy = vyRes.rows[0];
    if (!vy) {
      throw new ForbiddenException('Không tìm thấy chuyến thuộc sà lan của bạn.');
    }
    if (vy.vessel_id !== vesselId) {
      throw new ForbiddenException('Bạn không có quyền thao tác dữ liệu của sà lan khác.');
    }
  }

  async captainCheckInWithAuth(authHeader: string | undefined, dto: any) {
    const { vessel } = await this.authenticateHeader(authHeader);
    if (dto?.vessel_id && dto.vessel_id !== vessel.id) {
      throw new ForbiddenException('Không được phép gửi Check-in cho sà lan khác.');
    }
    await this.assertVoyageOwnership(vessel.id, dto?.voyage_id);
    return this.captainCheckIn({ ...dto, vessel_id: vessel.id });
  }

  async submitCaptainStepWithAuth(authHeader: string | undefined, dto: any) {
    const { vessel } = await this.authenticateHeader(authHeader);
    if (dto?.vessel_id && dto.vessel_id !== vessel.id) {
      throw new ForbiddenException('Không được phép báo cáo bước cho sà lan khác.');
    }
    await this.assertVoyageOwnership(vessel.id, dto?.voyage_id);
    return this.submitCaptainStep({ ...dto, vessel_id: vessel.id });
  }

  async createScopedFuelLog(authHeader: string | undefined, dto: any) {
    const { account, vessel } = await this.authenticateHeader(authHeader);
    if (dto?.vessel_id && dto.vessel_id !== vessel.id) {
      throw new ForbiddenException('Không được phép nhập dầu cho sà lan khác.');
    }
    await this.assertVoyageOwnership(vessel.id, dto?.voyage_id);
    return this.trackingService.createFuelLog({
      ...dto,
      vessel_id: vessel.id,
      reported_by: dto?.reported_by || account.full_name,
    });
  }

  async createScopedMaintenanceOrder(authHeader: string | undefined, dto: any) {
    const { account, vessel } = await this.authenticateHeader(authHeader);
    if (dto?.vessel_id && dto.vessel_id !== vessel.id) {
      throw new ForbiddenException('Không được phép báo sự cố cho sà lan khác.');
    }
    const ticketNo = `MNT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const res = await this.db.query(
      `
      INSERT INTO maintenance_orders (
        ticket_no, vessel_id, title, maintenance_type, priority,
        estimated_cost, reported_by, scheduled_date, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        ticketNo,
        vessel.id,
        dto.title,
        dto.maintenance_type || 'CORRECTIVE',
        dto.priority || 'MEDIUM',
        dto.estimated_cost ?? 0,
        dto.reported_by || account.full_name,
        dto.scheduled_date ?? null,
        dto.description ?? null,
      ],
    );
    return res.rows[0];
  }

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
      WHERE vy.vessel_id = $1 AND vy.status IN ('PLANNED', 'DEPARTED', 'IN_TRANSIT', 'ARRIVED')
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

  async submitCaptainStep(dto: {
    vessel_id?: string;
    voyage_id: string;
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
  }) {
    if (dto.vessel_id && dto.lat !== undefined && dto.lng !== undefined) {
      await this.trackingService.ingestAisPing({
        vessel_id: dto.vessel_id,
        voyage_id: dto.voyage_id,
        lat: Number(dto.lat),
        lng: Number(dto.lng),
        speed_knots: dto.step === 3 ? 7.5 : 0,
      });
    }

    if (dto.vessel_id) {
      const nextVesselStatus =
        dto.step === 3 ? 'IN_VOYAGE' : dto.step === 5 ? 'AVAILABLE' : null;
      const fuelVal =
        dto.step === 1
          ? dto.fuel_start_liters
          : dto.step === 5
            ? dto.fuel_end_liters
            : null;
      if (nextVesselStatus || fuelVal !== null) {
        await this.db.query(
          `
          UPDATE vessels
          SET
            status = COALESCE($2, status),
            current_fuel_liters = COALESCE($3, current_fuel_liters),
            updated_at = NOW()
          WHERE id = $1
          `,
          [dto.vessel_id, nextVesselStatus, fuelVal ?? null],
        );
      }
    }

    const updated = await this.dispatchService.submitCaptainStep(dto.voyage_id, dto);
    return { ok: true, voyage: updated };
  }
}
