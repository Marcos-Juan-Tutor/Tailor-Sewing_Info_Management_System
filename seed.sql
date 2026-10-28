-- Optional example data (three orders tagged "Sample" in the app).
-- Run after schema.sql:   mysql -u root -p tailor_book < sql/seed.sql
-- Remove later with:      DELETE FROM orders WHERE is_sample = 1;

USE tailor_book;

INSERT INTO customers (id, name, phone, email, address) VALUES
  (1, 'Maria Santos',         '0917 000 0001', '',                  '12 Acacia St, Quezon City'),
  (2, 'Riverside Elementary', '0917 000 0002', 'office@example.com', '45 Mabini Ave, Quezon City'),
  (3, 'Ramon Cruz',           '0917 000 0003', '',                  '8 Narra Rd, Marikina');

INSERT INTO orders
  (id, order_no, customer_id, type, item, received_date, due_date, status, is_cancelled, cancelled_at, unit, adjustments, fee, deposit, is_sample)
VALUES
  ('sample1', 'T-0001', 1, 'Dress',   'Debut gown, ivory satin',                '2026-10-20', '2026-11-08', 'Sewing',   0, NULL,         'cm',
   'Sweetheart neckline, fitted bodice, detachable train. Hem 2 cm above the floor in heels.', 6500.00, 3000.00, 1),
  ('sample2', 'T-0002', 2, 'Uniform', 'Girls'' school uniform, 3 sets (size 8)', '2026-10-24', '2026-10-30', 'Measured', 0, NULL,         'cm',
   'Leave 3 cm hem allowance for growth. School crest sewn on left chest.', 1800.00, 500.00, 1),
  ('sample3', 'T-0003', 3, 'Curtains','Living room curtains, 2 panels',         '2026-10-15', '2026-11-12', 'New',      1, '2026-10-22', 'cm',
   'Blackout lining, eyelet top.', 2200.00, 0.00, 1);

INSERT INTO order_measurements (order_id, sort_order, label, value) VALUES
  ('sample1', 0, 'Neck', '34'), ('sample1', 1, 'Shoulder', '38'), ('sample1', 2, 'Chest / Bust', '88'),
  ('sample1', 3, 'Waist', '68'), ('sample1', 4, 'Hip', '94'), ('sample1', 5, 'Back length', '40'), ('sample1', 6, 'Height', '160'),
  ('sample2', 0, 'Chest / Bust', '62'), ('sample2', 1, 'Waist', '56'), ('sample2', 2, 'Hip', '66'),
  ('sample2', 3, 'Back length', '30'), ('sample2', 4, 'Sleeve length', '38'),
  ('sample3', 0, 'Width', '240'), ('sample3', 1, 'Height / Drop', '230'), ('sample3', 2, 'Fullness', '2x'),
  ('sample3', 3, 'Hem / Rod pocket', '8'), ('sample3', 4, 'Panels', '2');

INSERT INTO order_materials (order_id, sort_order, name, qty, cost) VALUES
  ('sample1', 0, 'Ivory satin',            '4 m',  2800.00),
  ('sample1', 1, 'Tulle',                  '3 m',   600.00),
  ('sample1', 2, 'Invisible zipper',       '1',      60.00),
  ('sample2', 0, 'White blouse fabric',    '3 m',   540.00),
  ('sample2', 1, 'Navy pleated skirt fabric', '3 m', 660.00),
  ('sample2', 2, 'Buttons',                '18',     90.00),
  ('sample3', 0, 'Blackout fabric',        '10 m', 3200.00),
  ('sample3', 1, 'Eyelet rings',           '20',    250.00);

INSERT INTO settings (setting_key, setting_value) VALUES ('currency', '$')
  ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
