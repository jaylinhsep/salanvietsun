import { Injectable, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface AccountingFilter {
  month?: string;
  vessel_code?: string;
  category?: string;
}

const ACCOUNTING_TABLES: Record<string, string> = {
  'fixed-costs': 'accounting_fixed_costs',
  'port-expenses': 'accounting_port_expenses',
  'fuel-entries': 'accounting_fuel_entries',
  supplies: 'accounting_supplies',
  'vendor-costs': 'accounting_vendor_costs',
};

@Injectable()
export class OrdersService implements OnModuleInit {
  constructor(private readonly db: DatabaseService) {}

  async onModuleInit() {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS accounting_fixed_costs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        period_month VARCHAR(7) NOT NULL,
        vessel_id UUID REFERENCES vessels(id) ON DELETE CASCADE,
        vessel_code VARCHAR(80),
        vessel_name VARCHAR(150),
        charter_fee NUMERIC(14, 2) NOT NULL DEFAULT 0,
        crew_salary NUMERIC(14, 2) NOT NULL DEFAULT 0,
        social_insurance NUMERIC(14, 2) NOT NULL DEFAULT 0,
        hull_insurance NUMERIC(14, 2) NOT NULL DEFAULT 0,
        storage_fee NUMERIC(14, 2) NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS accounting_port_expenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        period_month VARCHAR(7) NOT NULL,
        expense_date DATE,
        trip_no VARCHAR(80),
        vessel_id UUID REFERENCES vessels(id) ON DELETE SET NULL,
        vessel_code VARCHAR(80),
        vessel_name VARCHAR(150),
        category VARCHAR(30) NOT NULL DEFAULT 'PORT_AUTH',
        amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS accounting_fuel_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        period_month VARCHAR(7) NOT NULL,
        entry_date DATE,
        vessel_id UUID REFERENCES vessels(id) ON DELETE SET NULL,
        vessel_code VARCHAR(80),
        vessel_name VARCHAR(150),
        entry_type VARCHAR(20) NOT NULL DEFAULT 'CONSUMPTION',
        route_label VARCHAR(200),
        liters_consumed NUMERIC(12, 2) NOT NULL DEFAULT 0,
        liters_bunkered NUMERIC(12, 2) NOT NULL DEFAULT 0,
        unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
        discount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS accounting_supplies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        period_month VARCHAR(7) NOT NULL,
        entry_date DATE,
        vessel_id UUID REFERENCES vessels(id) ON DELETE SET NULL,
        vessel_code VARCHAR(80),
        vessel_name VARCHAR(150),
        category VARCHAR(30) NOT NULL DEFAULT 'SUPPLIES',
        item_name VARCHAR(255) NOT NULL,
        unit VARCHAR(40),
        quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
        unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
        vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 8,
        total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        invoice_no VARCHAR(80),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS accounting_vendor_costs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        period_month VARCHAR(7) NOT NULL,
        pickup_date DATE,
        vendor_name VARCHAR(150),
        shipping_line VARCHAR(80),
        booking_no VARCHAR(80),
        container_no VARCHAR(40),
        cont_type VARCHAR(10) NOT NULL DEFAULT '20F',
        vendor_barge VARCHAR(120),
        origin_name VARCHAR(120),
        destination_name VARCHAR(120),
        freight_term VARCHAR(30) DEFAULT 'FI-FO',
        fuel_surcharge NUMERIC(14, 2) NOT NULL DEFAULT 0,
        unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
        vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 8,
        total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        invoice_no VARCHAR(80),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

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

  /** Shared filtered listing for the 5 accounting ledger tables. */
  async listAccounting(kind: keyof typeof ACCOUNTING_TABLES, filter: AccountingFilter) {
    const table = ACCOUNTING_TABLES[kind];
    if (!table) throw new Error(`Unknown accounting table: ${kind}`);
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.month) {
      params.push(filter.month);
      conditions.push(`period_month = $${params.length}`);
    }
    if (filter.vessel_code && kind !== 'vendor-costs') {
      params.push(filter.vessel_code.trim().toUpperCase());
      conditions.push(`UPPER(COALESCE(vessel_code, '')) = $${params.length}`);
    }
    if (filter.category && (kind === 'port-expenses' || kind === 'supplies')) {
      params.push(filter.category.trim().toUpperCase());
      conditions.push(`UPPER(category) = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderBy =
      kind === 'fixed-costs'
        ? 'ORDER BY period_month DESC, vessel_code ASC'
        : 'ORDER BY period_month DESC, created_at DESC';
    const res = await this.db.query(`SELECT * FROM ${table} ${where} ${orderBy}`, params);
    return res.rows;
  }

  async deleteAccounting(kind: keyof typeof ACCOUNTING_TABLES, id: string) {
    const table = ACCOUNTING_TABLES[kind];
    if (!table) throw new Error(`Unknown accounting table: ${kind}`);
    await this.db.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    return { ok: true };
  }

  async saveFixedCost(dto: Record<string, any>) {
    const periodMonth = String(dto.period_month || new Date().toISOString().slice(0, 7));
    const vesselCode = dto.vessel_code ? String(dto.vessel_code).trim().toUpperCase() : null;
    if (dto.id) {
      const res = await this.db.query(
        `UPDATE accounting_fixed_costs SET
          period_month = $2, vessel_id = $3, vessel_code = $4, vessel_name = $5,
          charter_fee = $6, crew_salary = $7, social_insurance = $8,
          hull_insurance = $9, storage_fee = $10, notes = $11, updated_at = NOW()
        WHERE id = $1 RETURNING *`,
        [
          dto.id,
          periodMonth,
          dto.vessel_id || null,
          vesselCode,
          dto.vessel_name || vesselCode,
          Number(dto.charter_fee || 0),
          Number(dto.crew_salary || 0),
          Number(dto.social_insurance || 0),
          Number(dto.hull_insurance || 0),
          Number(dto.storage_fee || 0),
          dto.notes || null,
        ],
      );
      return res.rows[0];
    }
    const res = await this.db.query(
      `INSERT INTO accounting_fixed_costs (
        period_month, vessel_id, vessel_code, vessel_name,
        charter_fee, crew_salary, social_insurance, hull_insurance, storage_fee, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        periodMonth,
        dto.vessel_id || null,
        vesselCode,
        dto.vessel_name || vesselCode,
        Number(dto.charter_fee || 0),
        Number(dto.crew_salary || 0),
        Number(dto.social_insurance || 0),
        Number(dto.hull_insurance || 0),
        Number(dto.storage_fee || 0),
        dto.notes || null,
      ],
    );
    return res.rows[0];
  }

  async createPortExpense(dto: Record<string, any>) {
    const expDate = dto.expense_date ? String(dto.expense_date).slice(0, 10) : null;
    const periodMonth = String(dto.period_month || (expDate ? expDate.slice(0, 7) : new Date().toISOString().slice(0, 7)));
    const vesselCode = dto.vessel_code ? String(dto.vessel_code).trim().toUpperCase() : null;
    const res = await this.db.query(
      `INSERT INTO accounting_port_expenses (
        period_month, expense_date, trip_no, vessel_id, vessel_code, vessel_name,
        category, amount, description
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        periodMonth,
        expDate,
        dto.trip_no || null,
        dto.vessel_id || null,
        vesselCode,
        dto.vessel_name || vesselCode,
        String(dto.category || 'PORT_AUTH').toUpperCase(),
        Number(dto.amount || 0),
        dto.description || null,
      ],
    );
    return res.rows[0];
  }

  async createFuelEntry(dto: Record<string, any>) {
    const entryDate = dto.entry_date ? String(dto.entry_date).slice(0, 10) : null;
    const periodMonth = String(dto.period_month || (entryDate ? entryDate.slice(0, 7) : new Date().toISOString().slice(0, 7)));
    const vesselCode = dto.vessel_code ? String(dto.vessel_code).trim().toUpperCase() : null;
    const litersBunkered = Number(dto.liters_bunkered || 0);
    const unitPrice = Number(dto.unit_price || 0);
    const discount = Number(dto.discount || 0);
    const computedTotal =
      dto.total_amount !== undefined && dto.total_amount !== ''
        ? Number(dto.total_amount)
        : Math.max(0, litersBunkered * unitPrice - discount);
    const res = await this.db.query(
      `INSERT INTO accounting_fuel_entries (
        period_month, entry_date, vessel_id, vessel_code, vessel_name,
        entry_type, route_label, liters_consumed, liters_bunkered,
        unit_price, discount, total_amount, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        periodMonth,
        entryDate,
        dto.vessel_id || null,
        vesselCode,
        dto.vessel_name || vesselCode,
        String(dto.entry_type || 'CONSUMPTION').toUpperCase(),
        dto.route_label || null,
        Number(dto.liters_consumed || 0),
        litersBunkered,
        unitPrice,
        discount,
        computedTotal,
        dto.notes || null,
      ],
    );
    return res.rows[0];
  }

  async createSupplyEntry(dto: Record<string, any>) {
    const entryDate = dto.entry_date ? String(dto.entry_date).slice(0, 10) : null;
    const periodMonth = String(dto.period_month || (entryDate ? entryDate.slice(0, 7) : new Date().toISOString().slice(0, 7)));
    const vesselCode = dto.vessel_code ? String(dto.vessel_code).trim().toUpperCase() : null;
    const qty = Number(dto.quantity ?? 1);
    const price = Number(dto.unit_price || 0);
    const vat = Number(dto.vat_rate ?? 8);
    const total =
      dto.total_amount !== undefined && dto.total_amount !== ''
        ? Number(dto.total_amount)
        : Math.round(qty * price * (1 + vat / 100));
    const res = await this.db.query(
      `INSERT INTO accounting_supplies (
        period_month, entry_date, vessel_id, vessel_code, vessel_name,
        category, item_name, unit, quantity, unit_price, vat_rate,
        total_amount, invoice_no, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        periodMonth,
        entryDate,
        dto.vessel_id || null,
        vesselCode,
        dto.vessel_name || vesselCode,
        String(dto.category || 'SUPPLIES').toUpperCase(),
        String(dto.item_name || '').trim() || 'Vật tư sà lan',
        dto.unit || null,
        qty,
        price,
        vat,
        total,
        dto.invoice_no || null,
        dto.notes || null,
      ],
    );
    return res.rows[0];
  }

  async createVendorCost(dto: Record<string, any>) {
    const pickupDate = dto.pickup_date ? String(dto.pickup_date).slice(0, 10) : null;
    const periodMonth = String(dto.period_month || (pickupDate ? pickupDate.slice(0, 7) : new Date().toISOString().slice(0, 7)));
    const unitPrice = Number(dto.unit_price || 0);
    const fuelSurcharge = Number(dto.fuel_surcharge || 0);
    const vat = Number(dto.vat_rate ?? 8);
    const total =
      dto.total_amount !== undefined && dto.total_amount !== ''
        ? Number(dto.total_amount)
        : Math.round((unitPrice + fuelSurcharge) * (1 + vat / 100));
    const res = await this.db.query(
      `INSERT INTO accounting_vendor_costs (
        period_month, pickup_date, vendor_name, shipping_line, booking_no,
        container_no, cont_type, vendor_barge, origin_name, destination_name,
        freight_term, fuel_surcharge, unit_price, vat_rate, total_amount,
        invoice_no, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [
        periodMonth,
        pickupDate,
        dto.vendor_name || null,
        dto.shipping_line || null,
        dto.booking_no ? String(dto.booking_no).trim().toUpperCase() : null,
        dto.container_no ? String(dto.container_no).trim().toUpperCase() : null,
        String(dto.cont_type || '20F').toUpperCase(),
        dto.vendor_barge || null,
        dto.origin_name || null,
        dto.destination_name || null,
        dto.freight_term || 'FI-FO',
        fuelSurcharge,
        unitPrice,
        vat,
        total,
        dto.invoice_no || null,
        dto.notes || null,
      ],
    );
    return res.rows[0];
  }

  /** Monthly & YTD P&L aggregation across all 5 ledgers + container yield. */
  async getAccountingPnlReport(year: number, month: number) {
    const mm = String(month).padStart(2, '0');
    const periodMonth = `${year}-${mm}`;
    const yearPrefix = `${year}-`;

    const [vesselsRes, contYearRes, fixedRes, portRes, fuelRes, suppliesRes, vendorRes] =
      await Promise.all([
        this.db.query(`SELECT id, code, name FROM vessels ORDER BY code ASC`),
        this.db.query(
          `SELECT COALESCE(NULLIF(UPPER(TRIM(barge_code)), ''), 'CHUNG') AS barge_code,
                  TO_CHAR(COALESCE(departure_date::date, created_at::date), 'YYYY-MM') AS ym,
                  COALESCE(SUM(total_amount), 0) AS revenue
           FROM voyage_containers
           WHERE TO_CHAR(COALESCE(departure_date::date, created_at::date), 'YYYY-MM') LIKE $1
           GROUP BY 1, 2`,
          [`${yearPrefix}%`],
        ),
        this.db.query(
          `SELECT * FROM accounting_fixed_costs WHERE period_month LIKE $1`,
          [`${yearPrefix}%`],
        ),
        this.db.query(
          `SELECT * FROM accounting_port_expenses WHERE period_month LIKE $1`,
          [`${yearPrefix}%`],
        ),
        this.db.query(
          `SELECT * FROM accounting_fuel_entries WHERE period_month LIKE $1`,
          [`${yearPrefix}%`],
        ),
        this.db.query(
          `SELECT * FROM accounting_supplies WHERE period_month LIKE $1`,
          [`${yearPrefix}%`],
        ),
        this.db.query(
          `SELECT * FROM accounting_vendor_costs WHERE period_month LIKE $1`,
          [`${yearPrefix}%`],
        ),
      ]);

    const bargeCodes = new Set<string>(['NV18', 'NV36', 'NV38']);
    for (const v of vesselsRes.rows) if (v.code) bargeCodes.add(String(v.code).toUpperCase());
    for (const r of contYearRes.rows) if (r.barge_code) bargeCodes.add(String(r.barge_code).toUpperCase());
    for (const r of fixedRes.rows) if (r.vessel_code) bargeCodes.add(String(r.vessel_code).toUpperCase());
    for (const r of portRes.rows) if (r.vessel_code) bargeCodes.add(String(r.vessel_code).toUpperCase());
    for (const r of fuelRes.rows) if (r.vessel_code) bargeCodes.add(String(r.vessel_code).toUpperCase());
    for (const r of suppliesRes.rows) if (r.vessel_code) bargeCodes.add(String(r.vessel_code).toUpperCase());

    const normBarge = (code?: string | null) =>
      code ? String(code).trim().toUpperCase() : 'CHUNG';

    const emptyBucket = (code: string) => ({
      vessel_code: code,
      revenue: 0,
      crew_salary: 0,
      charter_fee: 0,
      port_auth: 0,
      berth: 0,
      allowance: 0,
      other_port: 0,
      fuel_do: 0,
      vendor_cost: 0,
      hull_insurance: 0,
      supplies: 0,
      repair_drydock: 0,
      social_insurance: 0,
      storage_fee: 0,
      total_cost: 0,
      net_profit: 0,
    });

    const monthlyMap = new Map<string, ReturnType<typeof emptyBucket>>();
    for (const c of bargeCodes) monthlyMap.set(c, emptyBucket(c));
    const ensureBucket = (code: string) => {
      if (!monthlyMap.has(code)) monthlyMap.set(code, emptyBucket(code));
      return monthlyMap.get(code)!;
    };

    const ytdMatrix = new Map<string, Record<number, { revenue: number; cost: number; profit: number }>>();
    const addYtd = (code: string, ym: string, revDelta: number, costDelta: number) => {
      const m = Number(ym.slice(5, 7));
      if (!m || m < 1 || m > 12) return;
      if (!ytdMatrix.has(code)) ytdMatrix.set(code, {});
      const row = ytdMatrix.get(code)!;
      if (!row[m]) row[m] = { revenue: 0, cost: 0, profit: 0 };
      row[m].revenue += revDelta;
      row[m].cost += costDelta;
      row[m].profit = row[m].revenue - row[m].cost;
    };

    for (const r of contYearRes.rows) {
      const c = normBarge(r.barge_code);
      const rev = Number(r.revenue || 0);
      addYtd(c, r.ym, rev, 0);
      if (r.ym === periodMonth) ensureBucket(c).revenue += rev;
    }

    for (const r of fixedRes.rows) {
      const c = normBarge(r.vessel_code);
      const sum =
        Number(r.charter_fee || 0) +
        Number(r.crew_salary || 0) +
        Number(r.social_insurance || 0) +
        Number(r.hull_insurance || 0) +
        Number(r.storage_fee || 0);
      addYtd(c, r.period_month, 0, sum);
      if (r.period_month === periodMonth) {
        const b = ensureBucket(c);
        b.charter_fee += Number(r.charter_fee || 0);
        b.crew_salary += Number(r.crew_salary || 0);
        b.social_insurance += Number(r.social_insurance || 0);
        b.hull_insurance += Number(r.hull_insurance || 0);
        b.storage_fee += Number(r.storage_fee || 0);
      }
    }

    for (const r of portRes.rows) {
      const c = normBarge(r.vessel_code);
      const amt = Number(r.amount || 0);
      addYtd(c, r.period_month, 0, amt);
      if (r.period_month === periodMonth) {
        const b = ensureBucket(c);
        const cat = String(r.category || 'PORT_AUTH').toUpperCase();
        if (cat === 'PORT_AUTH') b.port_auth += amt;
        else if (cat === 'BERTH') b.berth += amt;
        else if (cat === 'ALLOWANCE') b.allowance += amt;
        else b.other_port += amt;
      }
    }

    for (const r of fuelRes.rows) {
      const et = String(r.entry_type || '').toUpperCase();
      if (et !== 'BUNKERING' && et !== 'CARRY_OVER' && Number(r.total_amount || 0) === 0) {
        continue;
      }
      const c = normBarge(r.vessel_code);
      const amt = Number(r.total_amount || 0);
      addYtd(c, r.period_month, 0, amt);
      if (r.period_month === periodMonth) ensureBucket(c).fuel_do += amt;
    }

    for (const r of suppliesRes.rows) {
      const c = normBarge(r.vessel_code);
      const amt = Number(r.total_amount || 0);
      addYtd(c, r.period_month, 0, amt);
      if (r.period_month === periodMonth) {
        const b = ensureBucket(c);
        const cat = String(r.category || 'SUPPLIES').toUpperCase();
        if (cat === 'SUPPLIES') b.supplies += amt;
        else b.repair_drydock += amt;
      }
    }

    for (const r of vendorRes.rows) {
      const amt = Number(r.total_amount || 0);
      addYtd('VENDOR', r.period_month, 0, amt);
      if (r.period_month === periodMonth) ensureBucket('VENDOR').vendor_cost += amt;
    }

    const byBarge = Array.from(monthlyMap.values()).map((b) => {
      b.total_cost =
        b.crew_salary +
        b.charter_fee +
        b.port_auth +
        b.berth +
        b.allowance +
        b.other_port +
        b.fuel_do +
        b.vendor_cost +
        b.hull_insurance +
        b.supplies +
        b.repair_drydock +
        b.social_insurance +
        b.storage_fee;
      b.net_profit = b.revenue - b.total_cost;
      return b;
    });

    const summary = byBarge.reduce(
      (acc, b) => {
        acc.revenue += b.revenue;
        acc.crew_salary += b.crew_salary;
        acc.charter_fee += b.charter_fee;
        acc.port_auth += b.port_auth;
        acc.berth += b.berth;
        acc.allowance += b.allowance;
        acc.other_port += b.other_port;
        acc.fuel_do += b.fuel_do;
        acc.vendor_cost += b.vendor_cost;
        acc.hull_insurance += b.hull_insurance;
        acc.supplies += b.supplies;
        acc.repair_drydock += b.repair_drydock;
        acc.social_insurance += b.social_insurance;
        acc.storage_fee += b.storage_fee;
        acc.total_cost += b.total_cost;
        acc.net_profit += b.net_profit;
        return acc;
      },
      emptyBucket('TOTAL'),
    );

    const yearlyByBarge = Array.from(ytdMatrix.entries()).map(([vessel_code, months]) => ({
      vessel_code,
      months,
      total_revenue: Object.values(months).reduce((s, m) => s + m.revenue, 0),
      total_cost: Object.values(months).reduce((s, m) => s + m.cost, 0),
      total_profit: Object.values(months).reduce((s, m) => s + m.profit, 0),
    }));

    return { period_month: periodMonth, year, month, summary, by_barge: byBarge, yearly_by_barge: yearlyByBarge };
  }
}
