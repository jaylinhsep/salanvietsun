import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class MaintenanceService {
  constructor(private readonly db: DatabaseService) {}

  async listOrders() {
    const res = await this.db.query(`
      SELECT
        m.*,
        v.code AS vessel_code, v.name AS vessel_name, v.inspection_expiry
      FROM maintenance_orders m
      JOIN vessels v ON v.id = m.vessel_id
      ORDER BY
        CASE m.priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
        m.created_at DESC
    `);
    return res.rows;
  }

  async createOrder(dto: {
    ticket_no?: string;
    vessel_id: string;
    title: string;
    maintenance_type: string;
    priority?: string;
    estimated_cost?: number;
    reported_by?: string;
    scheduled_date?: string;
    description?: string;
  }) {
    const ticketNo = dto.ticket_no || `MNT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
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
        dto.vessel_id,
        dto.title,
        dto.maintenance_type || 'CORRECTIVE',
        dto.priority || 'MEDIUM',
        dto.estimated_cost ?? 0,
        dto.reported_by ?? 'Thuyền trưởng',
        dto.scheduled_date ?? null,
        dto.description ?? null,
      ],
    );
    return res.rows[0];
  }

  async updateStatus(id: string, status: string, actualCost?: number) {
    const completedAt = status === 'COMPLETED' ? ', completed_date = CURRENT_DATE' : '';
    const res = await this.db.query(
      `
      UPDATE maintenance_orders
      SET status = $2, actual_cost = COALESCE($3, actual_cost) ${completedAt}
      WHERE id = $1
      RETURNING *
      `,
      [id, status, actualCost ?? null],
    );
    return res.rows[0];
  }
}
