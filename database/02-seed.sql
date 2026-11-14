-- Seed Ports (TP.HCM, Bà Rịa - Vũng Tàu, ĐBSCL)
INSERT INTO ports (id, code, name, region, port_type, location, geofence_radius_m) VALUES
('11111111-1111-1111-1111-111111111101', 'CATLAI', 'Cảng Tân Cảng Cát Lái', 'TP. Hồ Chí Minh', 'PORT', ST_GeogFromText('SRID=4326;POINT(106.7918 10.7615)'), 800),
('11111111-1111-1111-1111-111111111102', 'CAIMEP', 'Cảng Quốc tế Cái Mép (CMIT)', 'Bà Rịa - Vũng Tàu', 'PORT', ST_GeogFromText('SRID=4326;POINT(107.0165 10.5284)'), 1000),
('11111111-1111-1111-1111-111111111103', 'CANTHO', 'Cảng Cái Cui - Cần Thơ', 'Cần Thơ', 'PORT', ST_GeogFromText('SRID=4326;POINT(105.8142 10.0028)'), 600),
('11111111-1111-1111-1111-111111111104', 'MYTHO', 'Cảng Mỹ Tho', 'Tiền Giang', 'PORT', ST_GeogFromText('SRID=4326;POINT(106.3450 10.3540)'), 500),
('11111111-1111-1111-1111-111111111105', 'VINHLONG', 'Cảng Bình Minh - Vĩnh Long', 'Vĩnh Long', 'ICD', ST_GeogFromText('SRID=4326;POINT(105.8215 10.0155)'), 500),
('11111111-1111-1111-1111-111111111106', 'LONGAN', 'Cảng Quốc tế Long An', 'Long An', 'PORT', ST_GeogFromText('SRID=4326;POINT(106.7368 10.5562)'), 700)
ON CONFLICT (code) DO NOTHING;

-- Seed Vessels
INSERT INTO vessels (id, code, name, registration_no, vessel_type, capacity_tons, capacity_teu, length_m, width_m, max_draft_m, main_engine_hp, fuel_norm_l_per_hour, status, inspection_expiry, insurance_expiry, current_location, current_speed_knots, current_fuel_liters, captain_name, captain_phone) VALUES
('22222222-2222-2222-2222-222222222201', 'VS-SL-01', 'Sà lan Việt Sun 01', 'SG-6868', 'SELF_PROPELLED', 2400, 96, 68.5, 13.8, 3.8, 1200, 62.0, 'IN_VOYAGE', '2027-05-15', '2027-03-20', ST_GeogFromText('SRID=4326;POINT(106.8542 10.6721)'), 8.4, 8450, 'Nguyễn Văn Hùng', '0903112233'),
('22222222-2222-2222-2222-222222222202', 'VS-SL-02', 'Sà lan Việt Sun 02', 'SG-7979', 'SELF_PROPELLED', 3000, 128, 76.0, 15.2, 4.1, 1500, 75.0, 'IN_VOYAGE', '2027-08-10', '2027-06-01', ST_GeogFromText('SRID=4326;POINT(106.4120 10.3250)'), 7.8, 11200, 'Trần Minh Tuấn', '0908445566'),
('22222222-2222-2222-2222-222222222203', 'VS-SL-03', 'Sà lan Việt Sun 03', 'SG-5522', 'SELF_PROPELLED', 1800, 72, 58.0, 12.2, 3.4, 900, 48.0, 'AVAILABLE', '2027-01-25', '2027-02-14', ST_GeogFromText('SRID=4326;POINT(106.7918 10.7615)'), 0.0, 5600, 'Lê Hoàng Nam', '0913778899'),
('22222222-2222-2222-2222-222222222204', 'VS-SL-04', 'Sà lan Việt Sun 04 (Boong)', 'SG-4411', 'DUMB_BARGE', 1500, 0, 54.0, 12.0, 3.2, 0, 0.0, 'MAINTENANCE', '2026-12-10', '2027-04-01', ST_GeogFromText('SRID=4326;POINT(106.7368 10.5562)'), 0.0, 0, 'Phạm Quốc Bảo', '0938223344'),
('22222222-2222-2222-2222-222222222205', 'VS-DK-01', 'Tàu kéo Việt Sun 01', 'SG-9901', 'TUGBOAT', 0, 0, 26.5, 7.8, 2.8, 1800, 82.0, 'AVAILABLE', '2027-09-30', '2027-09-30', ST_GeogFromText('SRID=4326;POINT(107.0165 10.5284)'), 0.0, 9800, 'Võ Thành Long', '0909667788')
ON CONFLICT (code) DO NOTHING;

-- Seed Customers
INSERT INTO customers (id, code, name, tax_code, address, contact_person, phone, email, credit_limit) VALUES
('33333333-3333-3333-3333-333333333301', 'KH-TANHOA', 'Công ty CP Logistics Tân Hòa', '0301234567', 'Quận 2, TP. Thủ Đức, TP.HCM', 'Chị Lan Anh', '0901234567', 'ops@tanhoalogistics.vn', 2000000000),
('33333333-3333-3333-3333-333333333302', 'KH-MEKONGRICE', 'Tổng Công ty Lương thực Mekong', '1800567890', 'Quận Cái Răng, TP. Cần Thơ', 'Anh Hoàng', '0918234567', 'logistics@mekongrice.vn', 1500000000),
('33333333-3333-3333-3333-333333333303', 'KH-INSEE', 'Công ty Xi măng Tây Nam', '0309988776', 'KCN Hiệp Phước, Nhà Bè, TP.HCM', 'Anh Dũng', '0987654321', 'supply@taynamcement.vn', 3000000000)
ON CONFLICT (code) DO NOTHING;

-- Seed Orders
INSERT INTO orders (id, order_no, customer_id, cargo_type, cargo_weight_tons, container_count, origin_port_id, destination_port_id, unit_price, total_freight, surcharge, status, pickup_date, delivery_deadline) VALUES
('44444444-4444-4444-4444-444444444401', 'ORD-2026-0101', '33333333-3333-3333-3333-333333333301', 'Container 40ft (Hàng lạnh)', 1920, 84, '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111102', 95000, 182400000, 12000000, 'IN_TRANSIT', NOW() - INTERVAL '6 hours', NOW() + INTERVAL '8 hours'),
('44444444-4444-4444-4444-444444444402', 'ORD-2026-0102', '33333333-3333-3333-3333-333333333302', 'Gạo xuất khẩu đóng bao', 2600, 0, '11111111-1111-1111-1111-111111111103', '11111111-1111-1111-1111-111111111101', 145000, 377000000, 15000000, 'IN_TRANSIT', NOW() - INTERVAL '14 hours', NOW() + INTERVAL '18 hours'),
('44444444-4444-4444-4444-444444444403', 'ORD-2026-0103', '33333333-3333-3333-3333-333333333303', 'Xi măng bao Jumbo', 1650, 0, '11111111-1111-1111-1111-111111111106', '11111111-1111-1111-1111-111111111105', 118000, 194700000, 5000000, 'CONFIRMED', NOW() + INTERVAL '12 hours', NOW() + INTERVAL '48 hours')
ON CONFLICT (order_no) DO NOTHING;

-- Seed Voyages
INSERT INTO voyages (id, voyage_no, vessel_id, order_id, origin_port_id, destination_port_id, etd, eta, atd, planned_distance_nm, status, captain_notes) VALUES
('55555555-5555-5555-5555-555555555501', 'VOY-2026-0081', '22222222-2222-2222-2222-222222222201', '44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111102', NOW() - INTERVAL '6 hours', NOW() + INTERVAL '5 hours', NOW() - INTERVAL '5 hours 45 minutes', 38.5, 'IN_TRANSIT', 'Qua phao số 0 sông Lòng Tàu thuận lợi, nước ròng'),
('55555555-5555-5555-5555-555555555502', 'VOY-2026-0082', '22222222-2222-2222-2222-222222222202', '44444444-4444-4444-4444-444444444402', '11111111-1111-1111-1111-111111111103', '11111111-1111-1111-1111-111111111101', NOW() - INTERVAL '14 hours', NOW() + INTERVAL '16 hours', NOW() - INTERVAL '13 hours 30 minutes', 105.0, 'IN_TRANSIT', 'Đang qua khu vực kênh Chợ Gạo'),
('55555555-5555-5555-5555-555555555503', 'VOY-2026-0083', '22222222-2222-2222-2222-222222222203', '44444444-4444-4444-4444-444444444403', '11111111-1111-1111-1111-111111111106', '11111111-1111-1111-1111-111111111105', NOW() + INTERVAL '12 hours', NOW() + INTERVAL '36 hours', NULL, 82.0, 'PLANNED', 'Chờ nhận lệnh xuất bến')
ON CONFLICT (voyage_no) DO NOTHING;

-- Seed Invoices
INSERT INTO invoices (invoice_no, order_id, customer_id, issue_date, due_date, subtotal, vat_amount, total_amount, paid_amount, payment_status) VALUES
('INV-2026-0041', '44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333301', CURRENT_DATE - 2, CURRENT_DATE + 28, 194400000, 15552000, 209952000, 100000000, 'PARTIAL'),
('INV-2026-0042', '44444444-4444-4444-4444-444444444402', '33333333-3333-3333-3333-333333333302', CURRENT_DATE - 1, CURRENT_DATE + 14, 392000000, 31360000, 423360000, 0, 'UNPAID')
ON CONFLICT (invoice_no) DO NOTHING;

-- Seed Fuel Logs
INSERT INTO fuel_logs (vessel_id, voyage_id, log_type, quantity_liters, unit_price_vnd, engine_hours, reported_by, location_name, notes) VALUES
('22222222-2222-2222-2222-222222222201', '55555555-5555-5555-5555-555555555501', 'BUNKERING', 5000, 21800, 4120.5, 'Nguyễn Văn Hùng', 'Cảng Cát Lái', 'Cấp dầu DO 0.05S trước chuyến'),
('22222222-2222-2222-2222-222222222201', '55555555-5555-5555-5555-555555555501', 'CONSUMPTION', 360, 21800, 4126.2, 'Nguyễn Văn Hùng', 'Sông Lòng Tàu', 'Tiêu thụ 5.7 giờ chạy máy'),
('22222222-2222-2222-2222-222222222202', '55555555-5555-5555-5555-555555555502', 'CONSUMPTION', 980, 21800, 5890.0, 'Trần Minh Tuấn', 'Kênh Chợ Gạo', 'Chạy ngược nước cường');

-- Seed Maintenance Orders
INSERT INTO maintenance_orders (ticket_no, vessel_id, title, maintenance_type, priority, status, estimated_cost, actual_cost, reported_by, scheduled_date, description) VALUES
('MNT-2026-0018', '22222222-2222-2222-2222-222222222204', 'Lên triền bảo dưỡng định kỳ & sơn chống hà đáy tàu', 'DRY_DOCK', 'HIGH', 'IN_PROGRESS', 185000000, 120000000, 'Phạm Quốc Bảo', CURRENT_DATE - 3, 'Bảo dưỡng vỏ tàu và kiểm tra van thông biển trước kỳ đăng kiểm'),
('MNT-2026-0019', '22222222-2222-2222-2222-222222222203', 'Thay lọc nhớt máy chính & kiểm tra bơm cao áp', 'PREVENTIVE', 'MEDIUM', 'OPEN', 14500000, 0, 'Lê Hoàng Nam', CURRENT_DATE + 2, 'Đến mốc 500 giờ chạy máy định kỳ')
ON CONFLICT (ticket_no) DO NOTHING;
