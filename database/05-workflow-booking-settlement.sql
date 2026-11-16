-- Migration: Workflow Booking -> Single-Screen Dispatch -> 5-Step Captain Mobile -> Auto Settlement P&L

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_no VARCHAR(80) NOT NULL,
  cargo_direction VARCHAR(20) NOT NULL DEFAULT 'EXPORT',
  customer_id UUID REFERENCES customers(id),
  customer_name VARCHAR(150),
  origin_port_id UUID REFERENCES ports(id),
  origin_name VARCHAR(150),
  destination_port_id UUID REFERENCES ports(id),
  dest_name VARCHAR(150),
  cont_20e INT NOT NULL DEFAULT 0,
  cont_20f INT NOT NULL DEFAULT 0,
  cont_40e INT NOT NULL DEFAULT 0,
  cont_40f INT NOT NULL DEFAULT 0,
  total_teus INT NOT NULL DEFAULT 0,
  closing_time TIMESTAMPTZ,
  voyage_id UUID REFERENCES voyages(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  estimated_freight NUMERIC(14, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_voyage_id ON bookings(voyage_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- Seal number & booking reference on container manifest
ALTER TABLE voyage_containers ADD COLUMN IF NOT EXISTS seal_no VARCHAR(60);
ALTER TABLE voyage_containers ADD COLUMN IF NOT EXISTS booking_no VARCHAR(80);

-- 5-Step Captain Workflow + Laytime + Settlement fields on voyages
ALTER TABLE voyages ADD COLUMN IF NOT EXISTS workflow_step INT DEFAULT 0;
ALTER TABLE voyages ADD COLUMN IF NOT EXISTS fuel_start_liters NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE voyages ADD COLUMN IF NOT EXISTS fuel_added_liters NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE voyages ADD COLUMN IF NOT EXISTS fuel_end_liters NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE voyages ADD COLUMN IF NOT EXISTS fuel_unit_price NUMERIC(12, 2) DEFAULT 21500;
ALTER TABLE voyages ADD COLUMN IF NOT EXISTS loading_completed_at TIMESTAMPTZ;
ALTER TABLE voyages ADD COLUMN IF NOT EXISTS laytime_start_at TIMESTAMPTZ;
ALTER TABLE voyages ADD COLUMN IF NOT EXISTS completed_unloading_at TIMESTAMPTZ;
ALTER TABLE voyages ADD COLUMN IF NOT EXISTS port_fee NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE voyages ADD COLUMN IF NOT EXISTS crew_salary NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE voyages ADD COLUMN IF NOT EXISTS other_cost NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE voyages ADD COLUMN IF NOT EXISTS pod_photo_url TEXT;
ALTER TABLE voyages ADD COLUMN IF NOT EXISTS fuel_start_photo_url TEXT;
ALTER TABLE voyages ADD COLUMN IF NOT EXISTS fuel_end_photo_url TEXT;
ALTER TABLE voyages ADD COLUMN IF NOT EXISTS captain_report_log JSONB DEFAULT '[]'::jsonb;
