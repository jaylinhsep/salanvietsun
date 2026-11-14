-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. FLEET & ASSET MANAGEMENT
CREATE TABLE IF NOT EXISTS vessels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(30) UNIQUE NOT NULL,           -- VD: VS-SL-01
    name VARCHAR(120) NOT NULL,                 -- VD: Sà lan Việt Sun 01
    registration_no VARCHAR(50) NOT NULL,       -- Số đăng ký: SG-6868
    vessel_type VARCHAR(40) NOT NULL,           -- SELF_PROPELLED | DUMB_BARGE | TUGBOAT
    capacity_tons NUMERIC(10,2) NOT NULL,       -- Trọng tải (tấn)
    capacity_teu INT DEFAULT 0,                 -- Sức chở container (TEU)
    length_m NUMERIC(6,2),
    width_m NUMERIC(6,2),
    max_draft_m NUMERIC(5,2),                   -- Mớn nước tối đa
    main_engine_hp INT,                         -- Công suất máy chính (HP)
    fuel_norm_l_per_hour NUMERIC(8,2) DEFAULT 45.00, -- Định mức tiêu hao (lít/giờ)
    status VARCHAR(30) DEFAULT 'AVAILABLE',     -- AVAILABLE | IN_VOYAGE | MAINTENANCE | IDLE
    inspection_expiry DATE,                     -- Hạn đăng kiểm
    insurance_expiry DATE,                      -- Hạn bảo hiểm
    current_location GEOGRAPHY(Point, 4326),    -- Vị trí hiện tại (PostGIS)
    current_speed_knots NUMERIC(5,2) DEFAULT 0,
    current_fuel_liters NUMERIC(10,2) DEFAULT 0,
    captain_name VARCHAR(100),
    captain_phone VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vessels_location ON vessels USING GIST (current_location);

CREATE TABLE IF NOT EXISTS vessel_equipment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vessel_id UUID REFERENCES vessels(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    category VARCHAR(50) NOT NULL,              -- MAIN_ENGINE | GENERATOR | GPS_AIS | WINCH | CRANE
    serial_no VARCHAR(80),
    running_hours NUMERIC(10,2) DEFAULT 0,
    next_service_hours NUMERIC(10,2),
    status VARCHAR(30) DEFAULT 'OPERATIONAL',   -- OPERATIONAL | WARNING | FAULTY
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PORTS / TERMINALS (POSTGIS)
CREATE TABLE IF NOT EXISTS ports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    region VARCHAR(80),                         -- TP.HCM | Bà Rịa - Vũng Tàu | Cần Thơ | Đồng Tháp...
    port_type VARCHAR(40) DEFAULT 'PORT',       -- PORT | ICD | ANCHORAGE | FUEL_STATION
    location GEOGRAPHY(Point, 4326) NOT NULL,
    geofence_radius_m INT DEFAULT 500,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ports_location ON ports USING GIST (location);

-- 3. ORDERS, BILLING & ACCOUNTING
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    tax_code VARCHAR(30),
    address TEXT,
    contact_person VARCHAR(100),
    phone VARCHAR(30),
    email VARCHAR(120),
    credit_limit NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_no VARCHAR(40) UNIQUE NOT NULL,       -- ORD-2026-0001
    customer_id UUID REFERENCES customers(id),
    cargo_type VARCHAR(100) NOT NULL,           -- Container, Xi măng, Cát đá, Nông sản...
    cargo_weight_tons NUMERIC(10,2) NOT NULL,
    container_count INT DEFAULT 0,
    origin_port_id UUID REFERENCES ports(id),
    destination_port_id UUID REFERENCES ports(id),
    unit_price NUMERIC(14,2) NOT NULL,          -- Đơn giá (VNĐ/tấn hoặc VNĐ/chuyến)
    total_freight NUMERIC(15,2) NOT NULL,       -- Tổng cước
    surcharge NUMERIC(15,2) DEFAULT 0,          -- Phụ phí (xếp dỡ, neo đậu, nhiên liệu)
    status VARCHAR(30) DEFAULT 'PENDING',       -- PENDING | CONFIRMED | IN_TRANSIT | DELIVERED | INVOICED | PAID
    pickup_date TIMESTAMPTZ,
    delivery_deadline TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_no VARCHAR(40) UNIQUE NOT NULL,
    order_id UUID REFERENCES orders(id),
    customer_id UUID REFERENCES customers(id),
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    subtotal NUMERIC(15,2) NOT NULL,
    vat_amount NUMERIC(15,2) NOT NULL,
    total_amount NUMERIC(15,2) NOT NULL,
    paid_amount NUMERIC(15,2) DEFAULT 0,
    payment_status VARCHAR(30) DEFAULT 'UNPAID', -- UNPAID | PARTIAL | PAID | OVERDUE
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. DISPATCHING & VOYAGE PLANNING
CREATE TABLE IF NOT EXISTS voyages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voyage_no VARCHAR(40) UNIQUE NOT NULL,      -- VOY-2026-0001
    vessel_id UUID REFERENCES vessels(id),
    tugboat_id UUID REFERENCES vessels(id),     -- Nếu sà lan không tự hành cần đầu kéo
    order_id UUID REFERENCES orders(id),
    origin_port_id UUID REFERENCES ports(id),
    destination_port_id UUID REFERENCES ports(id),
    etd TIMESTAMPTZ,                            -- Estimated Time of Departure
    eta TIMESTAMPTZ,                            -- Estimated Time of Arrival
    atd TIMESTAMPTZ,                            -- Actual Time of Departure
    ata TIMESTAMPTZ,                            -- Actual Time of Arrival
    planned_distance_nm NUMERIC(8,2),           -- Hải lý / km đường sông
    planned_route GEOGRAPHY(LineString, 4326),  -- Tuyến đường dự kiến
    status VARCHAR(30) DEFAULT 'PLANNED',       -- PLANNED | DEPARTED | IN_TRANSIT | ARRIVED | COMPLETED | CANCELLED
    customer_id UUID REFERENCES customers(id),
    received_date DATE DEFAULT CURRENT_DATE,
    pic_name VARCHAR(100),
    cont_20e INT DEFAULT 0,
    cont_20f INT DEFAULT 0,
    cont_40e INT DEFAULT 0,
    cont_40f INT DEFAULT 0,
    total_teus INT DEFAULT 0,
    vessel_berth_date DATE,
    order_deadline DATE,
    captain_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. AIS/GPS TRACKING & FUEL MONITORING
CREATE TABLE IF NOT EXISTS ais_positions (
    id BIGSERIAL PRIMARY KEY,
    vessel_id UUID REFERENCES vessels(id) ON DELETE CASCADE,
    voyage_id UUID REFERENCES voyages(id) ON DELETE SET NULL,
    position GEOGRAPHY(Point, 4326) NOT NULL,
    speed_knots NUMERIC(5,2) DEFAULT 0,
    heading NUMERIC(5,2) DEFAULT 0,
    engine_rpm INT DEFAULT 0,
    fuel_level_liters NUMERIC(10,2),
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ais_vessel_time ON ais_positions (vessel_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_ais_position ON ais_positions USING GIST (position);

CREATE TABLE IF NOT EXISTS fuel_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vessel_id UUID REFERENCES vessels(id) ON DELETE CASCADE,
    voyage_id UUID REFERENCES voyages(id) ON DELETE SET NULL,
    log_type VARCHAR(30) NOT NULL,              -- BUNKERING (Cấp dầu) | CONSUMPTION (Tiêu thụ) | ROB (Tồn két)
    quantity_liters NUMERIC(10,2) NOT NULL,
    unit_price_vnd NUMERIC(12,2) DEFAULT 0,
    engine_hours NUMERIC(10,2),
    reported_by VARCHAR(100),
    location_name VARCHAR(150),
    notes TEXT,
    logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. MAINTENANCE & REPAIR
CREATE TABLE IF NOT EXISTS maintenance_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_no VARCHAR(40) UNIQUE NOT NULL,      -- MNT-2026-0001
    vessel_id UUID REFERENCES vessels(id) ON DELETE CASCADE,
    equipment_id UUID REFERENCES vessel_equipment(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    maintenance_type VARCHAR(30) NOT NULL,      -- PREVENTIVE | CORRECTIVE | DRY_DOCK | INSPECTION
    priority VARCHAR(20) DEFAULT 'MEDIUM',      -- LOW | MEDIUM | HIGH | CRITICAL
    status VARCHAR(30) DEFAULT 'OPEN',          -- OPEN | IN_PROGRESS | WAITING_PARTS | COMPLETED
    estimated_cost NUMERIC(15,2) DEFAULT 0,
    actual_cost NUMERIC(15,2) DEFAULT 0,
    reported_by VARCHAR(100),
    scheduled_date DATE,
    completed_date DATE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
