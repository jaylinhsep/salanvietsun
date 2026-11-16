-- Migration: Full Accounting Modules (Fixed Costs, Port/Voyage Expenses, Fuel Report, Supplies/Repair/Drydock, Vendor Outsourcing)

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
