import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class OrdersService {
  constructor(private readonly db: DatabaseService) {}

  async listCustomers() {
    const res = await this.db.query(`
      SELECT c.*,
        COALESCE((SELECT SUM(i.total_amount - i.paid_amount) FROM invoices i WHERE i.customer_id = c.id AND i.payment_status != 'PAID'), 0)::float AS outstanding_debt
      FROM customers c
      ORDER BY c.name ASC
    `);
    return res.rows;
  }

  async createCustomer(dto: {
    code: string;
    name: string;
    tax_code?: string;
    address?: string;
    contact_person?: string;
    phone?: string;
    email?: string;
  }) {
    const res = await this.db.query(
      `
      INSERT INTO customers (code, name, tax_code, address, contact_person, phone, email)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        dto.code.trim().toUpperCase(),
        dto.name.trim(),
        dto.tax_code ?? null,
        dto.address ?? null,
        dto.contact_person ?? null,
        dto.phone ?? null,
        dto.email ?? null,
      ],
    );
    return res.rows[0];
  }

  async updateCustomer(
    id: string,
    dto: {
      code?: string;
      name?: string;
      tax_code?: string;
      address?: string;
      contact_person?: string;
      phone?: string;
      email?: string;
    },
  ) {
    const res = await this.db.query(
      `
      UPDATE customers
      SET
        code = COALESCE($2, code),
        name = COALESCE($3, name),
        tax_code = COALESCE($4, tax_code),
        address = COALESCE($5, address),
        contact_person = COALESCE($6, contact_person),
        phone = COALESCE($7, phone),
        email = COALESCE($8, email)
      WHERE id = $1
      RETURNING *
      `,
      [
        id,
        dto.code?.trim().toUpperCase() ?? null,
        dto.name?.trim() ?? null,
        dto.tax_code ?? null,
        dto.address ?? null,
        dto.contact_person ?? null,
        dto.phone ?? null,
        dto.email ?? null,
      ],
    );
    return res.rows[0];
  }

  async deleteCustomer(id: string) {
    return this.db.transaction(async (client) => {
      // Detach FK references on existing orders, invoices, voyages & bookings before deleting customer
      await client.query(`UPDATE voyages SET customer_id = NULL WHERE customer_id = $1`, [id]);
      await client.query(`UPDATE orders SET customer_id = NULL WHERE customer_id = $1`, [id]);
      await client.query(`UPDATE invoices SET customer_id = NULL WHERE customer_id = $1`, [id]);
      await client.query(`UPDATE bookings SET customer_id = NULL WHERE customer_id = $1`, [id]);
      await client.query(`DELETE FROM customers WHERE id = $1`, [id]);
      return { ok: true };
    });
  }

  async listOrders() {
    const res = await this.db.query(`
      SELECT
        o.id, o.order_no, o.cargo_type, o.cargo_weight_tons::float, o.container_count,
        o.unit_price::float, o.total_freight::float, o.surcharge::float,
        o.status, o.pickup_date, o.delivery_deadline, o.notes, o.created_at,
        c.name AS customer_name, c.code AS customer_code,
        op.name AS origin_name, op.code AS origin_code,
        dp.name AS dest_name, dp.code AS dest_code
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN ports op ON op.id = o.origin_port_id
      LEFT JOIN ports dp ON dp.id = o.destination_port_id
      ORDER BY o.created_at DESC
    `);
    return res.rows;
  }

  async createOrder(dto: {
    order_no: string;
    customer_id: string;
    cargo_type: string;
    cargo_weight_tons: number;
    container_count?: number;
    origin_port_id: string;
    destination_port_id: string;
    unit_price: number;
    surcharge?: number;
    pickup_date?: string;
    delivery_deadline?: string;
    notes?: string;
  }) {
    const totalFreight = Number(dto.cargo_weight_tons) * Number(dto.unit_price);
    const res = await this.db.query(
      `
      INSERT INTO orders (
        order_no, customer_id, cargo_type, cargo_weight_tons, container_count,
        origin_port_id, destination_port_id, unit_price, total_freight, surcharge,
        pickup_date, delivery_deadline, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
      `,
      [
        dto.order_no,
        dto.customer_id,
        dto.cargo_type,
        dto.cargo_weight_tons,
        dto.container_count ?? 0,
        dto.origin_port_id,
        dto.destination_port_id,
        dto.unit_price,
        totalFreight,
        dto.surcharge ?? 0,
        dto.pickup_date ?? null,
        dto.delivery_deadline ?? null,
        dto.notes ?? null,
      ],
    );
    return res.rows[0];
  }

  async listInvoices() {
    const res = await this.db.query(`
      SELECT
        i.id, i.invoice_no, i.issue_date, i.due_date,
        i.subtotal::float, i.vat_amount::float, i.total_amount::float, i.paid_amount::float,
        (i.total_amount - i.paid_amount)::float AS balance_due,
        i.payment_status, i.created_at,
        o.order_no, c.name AS customer_name, c.code AS customer_code
      FROM invoices i
      LEFT JOIN orders o ON o.id = i.order_id
      LEFT JOIN customers c ON c.id = i.customer_id
      ORDER BY i.issue_date DESC
    `);
    return res.rows;
  }

  async recordPayment(invoiceId: string, amount: number) {
    const res = await this.db.query(
      `
      UPDATE invoices
      SET
        paid_amount = LEAST(total_amount, paid_amount + $2),
        payment_status = CASE
          WHEN paid_amount + $2 >= total_amount THEN 'PAID'
          WHEN paid_amount + $2 > 0 THEN 'PARTIAL'
          ELSE 'UNPAID'
        END
      WHERE id = $1
      RETURNING *
      `,
      [invoiceId, amount],
    );
    return res.rows[0];
  }
}
