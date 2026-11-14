-- Migration: Detailed container manifest per voyage (matching Excel dispatch manifest)
CREATE TABLE IF NOT EXISTS voyage_containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voyage_id UUID NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
  barge_code VARCHAR(80),
  trip_no VARCHAR(80),
  container_no VARCHAR(40) NOT NULL,
  origin_name VARCHAR(150),
  destination_name VARCHAR(150),
  shipper_name VARCHAR(150),
  departure_date DATE,
  cont_type VARCHAR(10) NOT NULL DEFAULT '20F',
  unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  baf NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  fuel_price_no_vat NUMERIC(14, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voyage_containers_voyage_id ON voyage_containers(voyage_id);
CREATE INDEX IF NOT EXISTS idx_voyage_containers_container_no ON voyage_containers(container_no);
