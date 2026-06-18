-- Rental & Keep Management System
-- MySQL Database Schema + Sample Data

CREATE DATABASE IF NOT EXISTS rental_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rental_system;

-- ===================== USERS =====================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('ADMIN') DEFAULT 'ADMIN',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ===================== CATEGORIES =====================
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===================== CUSTOMERS =====================
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address TEXT,
  instagram VARCHAR(100),
  facebook VARCHAR(100),
  notes TEXT,
  status ENUM('BARU','AKTIF','PELANGGAN_TETAP','BLACKLIST') DEFAULT 'BARU',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customers_name (name),
  INDEX idx_customers_phone (phone),
  INDEX idx_customers_status (status)
);

-- ===================== PRODUCTS =====================
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  category_id INT NOT NULL,
  description TEXT,
  rent_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  deposit DECIMAL(12,2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 1,
  main_image VARCHAR(500),
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  INDEX idx_products_name (name),
  INDEX idx_products_category (category_id),
  INDEX idx_products_active (is_active)
);

-- ===================== PRODUCT IMAGES =====================
CREATE TABLE IF NOT EXISTS product_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  url VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ===================== BOOKINGS =====================
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_number VARCHAR(30) NOT NULL UNIQUE,
  customer_id INT NOT NULL,
  event_date DATE NOT NULL,
  pickup_date DATE NOT NULL,
  return_date DATE NOT NULL,
  rent_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  deposit DECIMAL(12,2) NOT NULL DEFAULT 0,
  dp_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  status ENUM('KEEP','DP','LUNAS','SEDANG_DISEWA','SELESAI','BATAL') DEFAULT 'KEEP',
  payment_status ENUM('BELUM_BAYAR','DP','LUNAS') DEFAULT 'BELUM_BAYAR',
  pickup_notes TEXT,
  pickup_by VARCHAR(150),
  pickup_proof VARCHAR(500),
  pickup_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  INDEX idx_bookings_status (status),
  INDEX idx_bookings_dates (pickup_date, return_date),
  INDEX idx_bookings_event (event_date),
  INDEX idx_bookings_customer (customer_id)
);

-- ===================== BOOKING ITEMS =====================
CREATE TABLE IF NOT EXISTS booking_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  rent_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  INDEX idx_booking_items_product (product_id)
);

-- ===================== BOOKING DATES =====================
CREATE TABLE IF NOT EXISTS booking_dates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  date DATE NOT NULL,
  type VARCHAR(20) DEFAULT 'rental',
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  UNIQUE KEY uk_booking_date (booking_id, date),
  INDEX idx_booking_dates_date (date)
);

-- ===================== KEEPS =====================
CREATE TABLE IF NOT EXISTS keeps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  customer_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  expired_at DATETIME NOT NULL,
  status ENUM('KEEP','EXPIRED','CANCEL') DEFAULT 'KEEP',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  INDEX idx_keeps_dates (start_date, end_date),
  INDEX idx_keeps_status (status),
  INDEX idx_keeps_product (product_id)
);

-- ===================== PAYMENTS =====================
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  method ENUM('CASH','TRANSFER','QRIS') NOT NULL,
  notes TEXT,
  paid_at DATETIME NOT NULL,
  admin_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES users(id),
  INDEX idx_payments_booking (booking_id)
);

-- ===================== RETURNS =====================
CREATE TABLE IF NOT EXISTS returns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  return_date DATE NOT NULL,
  `condition` VARCHAR(100) NOT NULL,
  fine DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  photo VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- ===================== NOTIFICATIONS =====================
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  type ENUM('KEEP_EXPIRED','BOOKING_BARU','PEMBAYARAN_MASUK','TERLAMBAT_KEMBALI','PICKUP_TODAY','RETURN_TODAY','PAYMENT_DUE') NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) DEFAULT 0,
  data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_notifications_read (is_read)
);

-- ===================== SETTINGS =====================
CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY DEFAULT 1,
  store_name VARCHAR(200) DEFAULT 'Rental Shop',
  logo VARCHAR(500),
  address TEXT,
  phone VARCHAR(30),
  whatsapp VARCHAR(30),
  instagram VARCHAR(100),
  keep_default_hours INT DEFAULT 24,
  deposit_default DECIMAL(12,2) DEFAULT 100000,
  wa_template_booking TEXT,
  wa_template_dp_reminder TEXT,
  wa_template_pickup TEXT,
  wa_template_return TEXT
);

-- ===================== ACTIVITY LOGS =====================
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(50) NOT NULL,
  entity_id INT,
  details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_activity_entity (entity, entity_id)
);

-- ===================== SAMPLE DATA =====================

INSERT INTO settings (id, store_name, address, phone, whatsapp, keep_default_hours, deposit_default,
  wa_template_booking, wa_template_dp_reminder, wa_template_pickup, wa_template_return)
VALUES (
  1,
  'Rental Makassar',
  'Jl. Contoh No. 123, Makassar',
  '081234567890',
  '6281234567890',
  24,
  100000,
  'Halo {nama}\n\nBooking berhasil dibuat.\n\nBarang:\n{barang}\n\nTanggal:\n{tanggal}\n\nTotal:\n{total}',
  'Halo {nama}\n\nMohon melakukan pembayaran DP untuk booking Anda.',
  'Halo {nama}\n\nBesok jadwal pengambilan barang.',
  'Halo {nama}\n\nHari ini jadwal pengembalian barang.'
) ON DUPLICATE KEY UPDATE store_name = store_name;

INSERT INTO categories (name) VALUES
  ('Gaun'),
  ('Baju Adat'),
  ('Kostum'),
  ('Perlengkapan Event'),
  ('Dekorasi')
ON DUPLICATE KEY UPDATE name = name;

INSERT INTO products (code, name, category_id, description, rent_price, deposit, stock, is_active) VALUES
  ('GAUN-A', 'Gaun Pesta Makassar A', 1, 'Gaun pesta elegan warna merah maroon', 250000, 150000, 2, 1),
  ('GAUN-B', 'Gaun Pesta Putih Premium', 1, 'Gaun putih premium dengan payet', 350000, 200000, 1, 1),
  ('ADAT-01', 'Baju Bodo Makassar', 2, 'Baju adat Makassar lengkap dengan aksesoris', 300000, 200000, 3, 1),
  ('KOSTUM-01', 'Kostum Princess', 3, 'Kostum princess anak ukuran M', 150000, 100000, 5, 1),
  ('DEKOR-01', 'Set Dekorasi Panggung', 5, 'Paket dekorasi panggung minimalis', 500000, 300000, 2, 1);

INSERT INTO customers (name, phone, address, instagram, status) VALUES
  ('Siti Aminah', '081211111111', 'Makassar', '@sitiaminah', 'AKTIF'),
  ('Budi Santoso', '081222222222', 'Gowa', '@budis', 'PELANGGAN_TETAP'),
  ('Rina Wijaya', '081233333333', 'Makassar', '@rinaw', 'BARU');

-- Default admin dibuat otomatis saat backend pertama kali dijalankan
-- Email: admin@rental.com | Password: admin123
