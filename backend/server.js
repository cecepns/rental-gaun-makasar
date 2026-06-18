require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;
const UPLOAD_DIR = path.join(__dirname, 'uploads-rental-system');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const unlinkUpload = (url) => {
  if (!url?.startsWith('/uploads/')) return;
  const filepath = `${UPLOAD_DIR}/${url.replace('/uploads/', '')}`;
  try {
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  } catch { /* ignore */ }
};

const unlinkProductFiles = async (productId) => {
  const [[product]] = await pool.execute('SELECT main_image FROM products WHERE id = ?', [productId]);
  if (product?.main_image) unlinkUpload(product.main_image);
  const [images] = await pool.execute('SELECT url FROM product_images WHERE product_id = ?', [productId]);
  images.forEach((img) => unlinkUpload(img.url));
};

// ===================== DATABASE =====================
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'rental_system',
  waitForConnections: true,
  connectionLimit: 10,
});

// ===================== HELPERS =====================
const ok = (res, data, pagination = null) =>
  res.json({ success: true, data, ...(pagination && { pagination }) });

const fail = (res, message, status = 400) =>
  res.status(status).json({ success: false, message });

const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = [10, 25, 50, 100].includes(parseInt(query.limit)) ? parseInt(query.limit) : 10;
  const offset = (page - 1) * limit;
  const search = (query.search || '').trim();
  const sort = query.sort || 'created_at';
  const order = query.order === 'asc' ? 'ASC' : 'DESC';
  return { page, limit, offset, search, sort, order };
};

const paginationMeta = (page, limit, total) => ({
  page, limit, total, totalPages: Math.ceil(total / limit) || 1,
});

const toDateStr = (d) => {
  if (!d) return null;
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (value) => {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const eachDay = (start, end) => {
  const days = [];
  const cur = parseLocalDate(start);
  const last = parseLocalDate(end);
  if (!cur || !last) return days;
  while (cur <= last) {
    days.push(toDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
};

const signToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET || 'rent', { expiresIn: '7d' });

const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return fail(res, 'Unauthorized', 401);
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET || 'rent');
    next();
  } catch {
    return fail(res, 'Invalid token', 401);
  }
};

const logActivity = async (userId, action, entity, entityId, details = null) => {
  await pool.execute(
    'INSERT INTO activity_logs (user_id, action, entity, entity_id, details) VALUES (?,?,?,?,?)',
    [userId, action, entity, entityId, details ? JSON.stringify(details) : null]
  );
};

const createNotification = async (type, title, message, data = null, userId = null) => {
  await pool.execute(
    'INSERT INTO notifications (user_id, type, title, message, data) VALUES (?,?,?,?,?)',
    [userId, type, title, message, data ? JSON.stringify(data) : null]
  );
};

const generateBookingNumber = async () => {
  const prefix = `BK${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [[{ cnt }]] = await pool.execute(
    'SELECT COUNT(*) as cnt FROM bookings WHERE booking_number LIKE ?',
    [`${prefix}%`]
  );
  return `${prefix}${String(cnt + 1).padStart(4, '0')}`;
};

// Anti double-booking: count overlapping bookings + active keeps vs stock
const checkProductAvailability = async (productId, pickupDate, returnDate, excludeBookingId = null) => {
  const [[product]] = await pool.execute('SELECT stock FROM products WHERE id = ?', [productId]);
  if (!product) return { available: false, reason: 'Barang tidak ditemukan' };

  let bookingSql = `
    SELECT COALESCE(SUM(bi.quantity), 0) as booked
    FROM booking_items bi
    JOIN bookings b ON b.id = bi.booking_id
    WHERE bi.product_id = ?
      AND b.status NOT IN ('BATAL', 'SELESAI')
      AND b.pickup_date <= ? AND b.return_date >= ?
  `;
  const bookingParams = [productId, returnDate, pickupDate];
  if (excludeBookingId) {
    bookingSql += ' AND b.id != ?';
    bookingParams.push(excludeBookingId);
  }
  const [[{ booked }]] = await pool.execute(bookingSql, bookingParams);

  const [[{ kept }]] = await pool.execute(
    `SELECT COALESCE(COUNT(*), 0) as kept FROM keeps
     WHERE product_id = ? AND status = 'KEEP' AND expired_at > NOW()
       AND start_date <= ? AND end_date >= ?`,
    [productId, returnDate, pickupDate]
  );

  const used = Number(booked) + Number(kept);
  const available = used < product.stock;
  return {
    available,
    stock: product.stock,
    used,
    remaining: Math.max(0, product.stock - used),
    reason: available ? null : 'Gaun itu sudah terbooking. Silakan ubah tanggal atau kode gaun.',
  };
};

const expireKeeps = async () => {
  const [expired] = await pool.execute(
    `SELECT k.*, c.name as customer_name, p.name as product_name
     FROM keeps k JOIN customers c ON c.id = k.customer_id JOIN products p ON p.id = k.product_id
     WHERE k.status = 'KEEP' AND k.expired_at <= NOW()`
  );
  if (!expired.length) return;
  await pool.execute("UPDATE keeps SET status = 'EXPIRED' WHERE status = 'KEEP' AND expired_at <= NOW()");
  for (const k of expired) {
    await createNotification('KEEP_EXPIRED', 'Keep Expired',
      `Keep ${k.product_name} untuk ${k.customer_name} telah expired`, { keepId: k.id });
  }
};

const insertBookingDates = async (bookingId, pickupDate, returnDate, executor = pool) => {
  const days = eachDay(pickupDate, returnDate);
  for (const date of days) {
    await executor.execute('INSERT INTO booking_dates (booking_id, date) VALUES (?,?)', [bookingId, date]);
  }
};

const updateBookingPaymentStatus = async (bookingId) => {
  const [[booking]] = await pool.execute('SELECT total, dp_amount FROM bookings WHERE id = ?', [bookingId]);
  const [[{ paid }]] = await pool.execute(
    'SELECT COALESCE(SUM(amount),0) as paid FROM payments WHERE booking_id = ?', [bookingId]
  );
  let totalPaid = Number(paid);
  // Backward compat: DP dicatat di dp_amount saat booking dibuat (sebelum auto-insert payment)
  if (totalPaid === 0 && Number(booking.dp_amount) > 0) {
    totalPaid = Number(booking.dp_amount);
  }
  const total = Number(booking.total);
  let paymentStatus = 'BELUM_BAYAR';
  let status = null;
  if (totalPaid >= total) { paymentStatus = 'LUNAS'; status = 'LUNAS'; }
  else if (totalPaid > 0) { paymentStatus = 'DP'; status = 'DP'; }
  await pool.execute('UPDATE bookings SET payment_status = ? WHERE id = ?', [paymentStatus, bookingId]);
  if (status) await pool.execute('UPDATE bookings SET status = ? WHERE id = ? AND status IN ("KEEP","DP")', [status, bookingId]);
  return { totalPaid, remaining: Math.max(0, total - totalPaid), paymentStatus };
};

// ===================== MULTER =====================
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = file.originalname.match(/\.[^.]+$/)?.[0] || '';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, unique);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    const ext = (file.originalname.match(/\.[^.]+$/)?.[0] || '').toLowerCase();
    const valid = allowed.test(ext) && allowed.test(file.mimetype);
    cb(valid ? null : new Error('Hanya file gambar yang diizinkan'), valid);
  },
});

// ===================== MIDDLEWARE =====================
// app.use(cors());
// app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

// ===================== AUTH =====================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return fail(res, 'Email dan password wajib diisi');
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length) return fail(res, 'Email atau password salah', 401);
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return fail(res, 'Email atau password salah', 401);
    const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });
    ok(res, { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { fail(res, e.message, 500); }
});

app.get('/api/auth/profile', authMiddleware, async (req, res) => {
  try {
    const [[user]] = await pool.execute('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [req.user.id]);
    ok(res, user);
  } catch (e) { fail(res, e.message, 500); }
});

// ===================== DASHBOARD =====================
app.get('/api/dashboard', authMiddleware, async (req, res) => {
  try {
    await expireKeeps();
    const today = toDateStr(new Date());
    const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
    const monthStart = new Date(); monthStart.setDate(1);

    const queries = {
      totalProducts: "SELECT COUNT(*) as c FROM products WHERE is_active = 1",
      totalCustomers: 'SELECT COUNT(*) as c FROM customers',
      activeBookings: "SELECT COUNT(*) as c FROM bookings WHERE status IN ('DP','LUNAS','SEDANG_DISEWA')",
      rentedItems: "SELECT COUNT(*) as c FROM bookings WHERE status = 'SEDANG_DISEWA'",
      todayBookings: 'SELECT COUNT(*) as c FROM bookings WHERE event_date = ?',
      weekBookings: 'SELECT COUNT(*) as c FROM bookings WHERE event_date BETWEEN ? AND ?',
      activeKeeps: "SELECT COUNT(*) as c FROM keeps WHERE status = 'KEEP' AND expired_at > NOW()",
      monthRevenue: 'SELECT COALESCE(SUM(amount),0) as c FROM payments WHERE paid_at >= ?',
    };

    const [[tp]] = await pool.execute(queries.totalProducts);
    const [[tc]] = await pool.execute(queries.totalCustomers);
    const [[ab]] = await pool.execute(queries.activeBookings);
    const [[ri]] = await pool.execute(queries.rentedItems);
    const [[tb]] = await pool.execute(queries.todayBookings, [today]);
    const [[wb]] = await pool.execute(queries.weekBookings, [today, toDateStr(weekEnd)]);
    const [[ak]] = await pool.execute(queries.activeKeeps);
    const [[mr]] = await pool.execute(queries.monthRevenue, [monthStart]);

    const [pickupToday] = await pool.execute(
      `SELECT b.*, c.name as customer_name, GROUP_CONCAT(p.name SEPARATOR ', ') as products
       FROM bookings b JOIN customers c ON c.id = b.customer_id
       JOIN booking_items bi ON bi.booking_id = b.id JOIN products p ON p.id = bi.product_id
       WHERE b.pickup_date = ? AND b.status IN ('DP','LUNAS') GROUP BY b.id`,
      [today]
    );
    const [returnToday] = await pool.execute(
      `SELECT b.*, c.name as customer_name, GROUP_CONCAT(p.name SEPARATOR ', ') as products
       FROM bookings b JOIN customers c ON c.id = b.customer_id
       JOIN booking_items bi ON bi.booking_id = b.id JOIN products p ON p.id = bi.product_id
       WHERE b.return_date = ? AND b.status = 'SEDANG_DISEWA' GROUP BY b.id`,
      [today]
    );
    const [keepExpireToday] = await pool.execute(
      `SELECT k.*, c.name as customer_name, p.name as product_name
       FROM keeps k JOIN customers c ON c.id = k.customer_id JOIN products p ON p.id = k.product_id
       WHERE k.status = 'KEEP' AND DATE(k.expired_at) = ?`,
      [today]
    );
    const [unpaidBookings] = await pool.execute(
      `SELECT b.*, c.name as customer_name, c.phone as customer_phone
       FROM bookings b JOIN customers c ON c.id = b.customer_id
       WHERE b.payment_status != 'LUNAS' AND b.status NOT IN ('BATAL','SELESAI') LIMIT 10`
    );

    const [calendarData] = await pool.execute(
      `SELECT bd.date,
        SUM(CASE WHEN b.status IN ('DP','LUNAS','SEDANG_DISEWA') THEN 1 ELSE 0 END) as bookings,
        (SELECT COUNT(*) FROM keeps k WHERE k.status='KEEP' AND k.expired_at>NOW() AND k.start_date<=bd.date AND k.end_date>=bd.date) as keeps
       FROM booking_dates bd JOIN bookings b ON b.id = bd.booking_id
       WHERE bd.date BETWEEN ? AND LAST_DAY(?)
       GROUP BY bd.date`,
      [monthStart, monthStart]
    );

    ok(res, {
      stats: {
        totalProducts: tp.c, totalCustomers: tc.c, activeBookings: ab.c,
        rentedItems: ri.c, todayBookings: tb.c, weekBookings: wb.c,
        activeKeeps: ak.c, monthRevenue: Number(mr.c),
      },
      reminders: { pickupToday, returnToday, keepExpireToday, unpaidBookings },
      calendar: calendarData,
    });
  } catch (e) { fail(res, e.message, 500); }
});

// ===================== CATEGORIES =====================
app.get('/api/categories', authMiddleware, async (req, res) => {
  try {
    const { page, limit, offset, search } = parsePagination(req.query);
    let sql = 'SELECT * FROM categories WHERE 1=1';
    const params = [];
    if (search) { sql += ' AND name LIKE ?'; params.push(`%${search}%`); }
    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) as total FROM (${sql}) t`, params);
    sql += ' ORDER BY name ASC LIMIT ? OFFSET ?';
    const [data] = await pool.execute(sql, [...params, limit, offset]);
    ok(res, data, paginationMeta(page, limit, total));
  } catch (e) { fail(res, e.message, 500); }
});

app.get('/api/categories/all', authMiddleware, async (_, res) => {
  try {
    const [data] = await pool.execute('SELECT * FROM categories ORDER BY name');
    ok(res, data);
  } catch (e) { fail(res, e.message, 500); }
});

app.post('/api/categories', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return fail(res, 'Nama kategori wajib diisi');
    const [r] = await pool.execute('INSERT INTO categories (name) VALUES (?)', [name.trim()]);
    await logActivity(req.user.id, 'CREATE', 'category', r.insertId);
    ok(res, { id: r.insertId, name: name.trim() });
  } catch (e) { fail(res, e.message, 500); }
});

app.put('/api/categories/:id', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return fail(res, 'Nama kategori wajib diisi');
    await pool.execute('UPDATE categories SET name = ? WHERE id = ?', [name.trim(), req.params.id]);
    await logActivity(req.user.id, 'UPDATE', 'category', req.params.id);
    ok(res, { id: Number(req.params.id), name: name.trim() });
  } catch (e) { fail(res, e.message, 500); }
});

app.delete('/api/categories/:id', authMiddleware, async (req, res) => {
  try {
    const [[{ cnt }]] = await pool.execute('SELECT COUNT(*) as cnt FROM products WHERE category_id = ?', [req.params.id]);
    if (cnt > 0) return fail(res, 'Kategori masih digunakan oleh produk');
    await pool.execute('DELETE FROM categories WHERE id = ?', [req.params.id]);
    await logActivity(req.user.id, 'DELETE', 'category', req.params.id);
    ok(res, { deleted: true });
  } catch (e) { fail(res, e.message, 500); }
});

// ===================== PRODUCTS =====================
app.get('/api/products', authMiddleware, async (req, res) => {
  try {
    const { page, limit, offset, search, sort, order } = parsePagination(req.query);
    const categoryId = req.query.category_id;
    let sql = `SELECT p.*, c.name as category_name FROM products p JOIN categories c ON c.id = p.category_id WHERE 1=1`;
    const params = [];
    if (search) { sql += ' AND (p.name LIKE ? OR p.code LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (categoryId) { sql += ' AND p.category_id = ?'; params.push(categoryId); }
    if (req.query.is_active !== undefined) { sql += ' AND p.is_active = ?'; params.push(req.query.is_active === 'true' ? 1 : 0); }
    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) as total FROM (${sql}) t`, params);
    const allowedSort = ['name', 'code', 'rent_price', 'created_at'];
    const sortCol = allowedSort.includes(sort) ? `p.${sort}` : 'p.created_at';
    sql += ` ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`;
    const [data] = await pool.execute(sql, [...params, limit, offset]);
    ok(res, data, paginationMeta(page, limit, total));
  } catch (e) { fail(res, e.message, 500); }
});

app.get('/api/products/:id', authMiddleware, async (req, res) => {
  try {
    const [[product]] = await pool.execute(
      `SELECT p.*, c.name as category_name FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?`,
      [req.params.id]
    );
    if (!product) return fail(res, 'Barang tidak ditemukan', 404);
    const [images] = await pool.execute('SELECT * FROM product_images WHERE product_id = ?', [req.params.id]);
    const [history] = await pool.execute(
      `SELECT b.*, c.name as customer_name, bi.quantity, bi.rent_price as item_price
       FROM booking_items bi JOIN bookings b ON b.id = bi.booking_id
       JOIN customers c ON c.id = b.customer_id
       WHERE bi.product_id = ? ORDER BY b.created_at DESC LIMIT 20`, [req.params.id]
    );
    const [keeps] = await pool.execute(
      `SELECT k.*, c.name as customer_name FROM keeps k JOIN customers c ON c.id = k.customer_id
       WHERE k.product_id = ? ORDER BY k.created_at DESC LIMIT 20`, [req.params.id]
    );
    const [calendar] = await pool.execute(
      `SELECT bd.date, b.status, b.booking_number, c.name as customer_name
       FROM booking_dates bd JOIN bookings b ON b.id = bd.booking_id
       JOIN customers c ON c.id = b.customer_id
       JOIN booking_items bi ON bi.booking_id = b.id AND bi.product_id = ?
       WHERE b.status NOT IN ('BATAL') AND bd.date >= CURDATE() - INTERVAL 1 MONTH
       ORDER BY bd.date`, [req.params.id]
    );
    ok(res, { ...product, images, history, keeps, calendar });
  } catch (e) { fail(res, e.message, 500); }
});

app.post('/api/products', authMiddleware, upload.fields([{ name: 'main_image', maxCount: 1 }, { name: 'gallery', maxCount: 10 }]), async (req, res) => {
  try {
    const { code, name, category_id, description, rent_price, deposit, stock, is_active } = req.body;
    if (!code || !name || !category_id || !rent_price) return fail(res, 'Kode, nama, kategori, dan harga wajib diisi');
    const mainImage = req.files?.main_image?.[0] ? `/uploads/${req.files.main_image[0].filename}` : null;
    const [r] = await pool.execute(
      `INSERT INTO products (code, name, category_id, description, rent_price, deposit, stock, main_image, is_active)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [code, name, category_id, description || null, rent_price, deposit || 0, stock || 1, mainImage, is_active !== 'false' ? 1 : 0]
    );
    const productId = r.insertId;
    if (req.files?.gallery) {
      for (const f of req.files.gallery) {
        await pool.execute('INSERT INTO product_images (product_id, url) VALUES (?,?)', [productId, `/uploads/${f.filename}`]);
      }
    }
    await logActivity(req.user.id, 'CREATE', 'product', productId);
    ok(res, { id: productId });
  } catch (e) { fail(res, e.message, 500); }
});

app.put('/api/products/:id', authMiddleware, upload.fields([{ name: 'main_image', maxCount: 1 }, { name: 'gallery', maxCount: 10 }]), async (req, res) => {
  try {
    const { code, name, category_id, description, rent_price, deposit, stock, is_active } = req.body;
    const mainImage = req.files?.main_image?.[0] ? `/uploads/${req.files.main_image[0].filename}` : undefined;
    if (mainImage) {
      const [[old]] = await pool.execute('SELECT main_image FROM products WHERE id = ?', [req.params.id]);
      if (old?.main_image) unlinkUpload(old.main_image);
    }
    let sql = `UPDATE products SET code=?, name=?, category_id=?, description=?, rent_price=?, deposit=?, stock=?, is_active=?`;
    const params = [code, name, category_id, description || null, rent_price, deposit || 0, stock || 1, is_active !== 'false' ? 1 : 0];
    if (mainImage) { sql += ', main_image=?'; params.push(mainImage); }
    sql += ' WHERE id=?'; params.push(req.params.id);
    await pool.execute(sql, params);
    if (req.files?.gallery) {
      for (const f of req.files.gallery) {
        await pool.execute('INSERT INTO product_images (product_id, url) VALUES (?,?)', [req.params.id, `/uploads/${f.filename}`]);
      }
    }
    await logActivity(req.user.id, 'UPDATE', 'product', req.params.id);
    ok(res, { id: Number(req.params.id) });
  } catch (e) { fail(res, e.message, 500); }
});

app.delete('/api/products/:id/main-image', authMiddleware, async (req, res) => {
  try {
    const [[product]] = await pool.execute('SELECT main_image FROM products WHERE id = ?', [req.params.id]);
    if (!product) return fail(res, 'Barang tidak ditemukan', 404);
    if (product.main_image) {
      unlinkUpload(product.main_image);
      await pool.execute('UPDATE products SET main_image = NULL WHERE id = ?', [req.params.id]);
    }
    await logActivity(req.user.id, 'DELETE', 'product_main_image', req.params.id);
    ok(res, { deleted: true });
  } catch (e) { fail(res, e.message, 500); }
});

app.delete('/api/products/:id/images/:imageId', authMiddleware, async (req, res) => {
  try {
    const [[image]] = await pool.execute(
      'SELECT * FROM product_images WHERE id = ? AND product_id = ?',
      [req.params.imageId, req.params.id]
    );
    if (!image) return fail(res, 'Gambar tidak ditemukan', 404);
    unlinkUpload(image.url);
    await pool.execute('DELETE FROM product_images WHERE id = ?', [req.params.imageId]);
    await logActivity(req.user.id, 'DELETE', 'product_image', req.params.imageId);
    ok(res, { deleted: true });
  } catch (e) { fail(res, e.message, 500); }
});

app.delete('/api/products/:id', authMiddleware, async (req, res) => {
  try {
    await unlinkProductFiles(req.params.id);
    await pool.execute('DELETE FROM products WHERE id = ?', [req.params.id]);
    await logActivity(req.user.id, 'DELETE', 'product', req.params.id);
    ok(res, { deleted: true });
  } catch (e) { fail(res, e.message, 500); }
});

// ===================== CUSTOMERS =====================
app.get('/api/customers', authMiddleware, async (req, res) => {
  try {
    const { page, limit, offset, search, sort, order } = parsePagination(req.query);
    let sql = 'SELECT * FROM customers WHERE 1=1';
    const params = [];
    if (search) { sql += ' AND (name LIKE ? OR phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (req.query.status) { sql += ' AND status = ?'; params.push(req.query.status); }
    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) as total FROM (${sql}) t`, params);
    const allowedSort = ['name', 'phone', 'status', 'created_at'];
    const sortCol = allowedSort.includes(sort) ? sort : 'created_at';
    sql += ` ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`;
    const [data] = await pool.execute(sql, [...params, limit, offset]);
    ok(res, data, paginationMeta(page, limit, total));
  } catch (e) { fail(res, e.message, 500); }
});

app.get('/api/customers/:id', authMiddleware, async (req, res) => {
  try {
    const [[customer]] = await pool.execute('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!customer) return fail(res, 'Customer tidak ditemukan', 404);
    const [[stats]] = await pool.execute(
      `SELECT COUNT(*) as total_bookings, COALESCE(SUM(total),0) as total_transactions,
        MAX(created_at) as last_booking FROM bookings WHERE customer_id = ?`, [req.params.id]
    );
    const [bookings] = await pool.execute(
      'SELECT * FROM bookings WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10', [req.params.id]
    );
    ok(res, { ...customer, stats, bookings });
  } catch (e) { fail(res, e.message, 500); }
});

app.post('/api/customers', authMiddleware, async (req, res) => {
  try {
    const { name, phone, address, instagram, facebook, notes, status } = req.body;
    if (!name || !phone) return fail(res, 'Nama dan no HP wajib diisi');
    const [r] = await pool.execute(
      'INSERT INTO customers (name, phone, address, instagram, facebook, notes, status) VALUES (?,?,?,?,?,?,?)',
      [name, phone, address || null, instagram || null, facebook || null, notes || null, status || 'BARU']
    );
    await logActivity(req.user.id, 'CREATE', 'customer', r.insertId);
    const [[customer]] = await pool.execute('SELECT * FROM customers WHERE id = ?', [r.insertId]);
    ok(res, customer);
  } catch (e) { fail(res, e.message, 500); }
});

app.put('/api/customers/:id', authMiddleware, async (req, res) => {
  try {
    const { name, phone, address, instagram, facebook, notes, status } = req.body;
    await pool.execute(
      'UPDATE customers SET name=?, phone=?, address=?, instagram=?, facebook=?, notes=?, status=? WHERE id=?',
      [name, phone, address, instagram, facebook, notes, status, req.params.id]
    );
    await logActivity(req.user.id, 'UPDATE', 'customer', req.params.id);
    ok(res, { id: Number(req.params.id) });
  } catch (e) { fail(res, e.message, 500); }
});

app.delete('/api/customers/:id', authMiddleware, async (req, res) => {
  try {
    const [[{ cnt }]] = await pool.execute('SELECT COUNT(*) as cnt FROM bookings WHERE customer_id = ?', [req.params.id]);
    if (cnt > 0) return fail(res, 'Customer masih memiliki booking');
    await pool.execute('DELETE FROM customers WHERE id = ?', [req.params.id]);
    await logActivity(req.user.id, 'DELETE', 'customer', req.params.id);
    ok(res, { deleted: true });
  } catch (e) { fail(res, e.message, 500); }
});

// ===================== AVAILABILITY CHECK =====================
app.post('/api/availability/check', authMiddleware, async (req, res) => {
  try {
    const { product_id, pickup_date, return_date, exclude_booking_id } = req.body;
    if (!product_id || !pickup_date || !return_date) return fail(res, 'Barang dan tanggal wajib diisi');
    const result = await checkProductAvailability(product_id, pickup_date, return_date, exclude_booking_id || null);
    const [[product]] = await pool.execute('SELECT name, code FROM products WHERE id = ?', [product_id]);
    let status = 'TERSEDIA';
    if (!result.available) {
      const [[{ kept }]] = await pool.execute(
        `SELECT COUNT(*) as kept FROM keeps WHERE product_id=? AND status='KEEP' AND expired_at>NOW() AND start_date<=? AND end_date>=?`,
        [product_id, return_date, pickup_date]
      );
      status = Number(kept) > 0 ? 'SEDANG_KEEP' : 'TIDAK_TERSEDIA';
    }
    ok(res, { ...result, status, product });
  } catch (e) { fail(res, e.message, 500); }
});

// ===================== BOOKINGS =====================
app.get('/api/bookings', authMiddleware, async (req, res) => {
  try {
    const { page, limit, offset, search, sort, order } = parsePagination(req.query);
    let sql = `SELECT b.*, c.name as customer_name, c.phone as customer_phone,
      GROUP_CONCAT(p.name SEPARATOR ', ') as products
      FROM bookings b JOIN customers c ON c.id = b.customer_id
      LEFT JOIN booking_items bi ON bi.booking_id = b.id LEFT JOIN products p ON p.id = bi.product_id WHERE 1=1`;
    const params = [];
    if (search) { sql += ' AND (b.booking_number LIKE ? OR c.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (req.query.status) { sql += ' AND b.status = ?'; params.push(req.query.status); }
    if (req.query.date_from) { sql += ' AND b.event_date >= ?'; params.push(req.query.date_from); }
    if (req.query.date_to) { sql += ' AND b.event_date <= ?'; params.push(req.query.date_to); }
    sql += ' GROUP BY b.id';
    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) as total FROM (${sql}) t`, params);
    const allowedSort = ['event_date', 'pickup_date', 'return_date', 'created_at', 'total'];
    const sortCol = allowedSort.includes(sort) ? `b.${sort}` : 'b.created_at';
    sql += ` ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`;
    const [data] = await pool.execute(sql, [...params, limit, offset]);
    ok(res, data, paginationMeta(page, limit, total));
  } catch (e) { fail(res, e.message, 500); }
});

app.get('/api/bookings/:id', authMiddleware, async (req, res) => {
  try {
    const [[booking]] = await pool.execute(
      `SELECT b.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
       FROM bookings b JOIN customers c ON c.id = b.customer_id WHERE b.id = ?`, [req.params.id]
    );
    if (!booking) return fail(res, 'Booking tidak ditemukan', 404);
    const [items] = await pool.execute(
      `SELECT bi.*, p.name as product_name, p.code as product_code FROM booking_items bi
       JOIN products p ON p.id = bi.product_id WHERE bi.booking_id = ?`, [req.params.id]
    );
    const [payments] = await pool.execute(
      `SELECT py.*, u.name as admin_name FROM payments py JOIN users u ON u.id = py.admin_id
       WHERE py.booking_id = ? ORDER BY py.paid_at DESC`, [req.params.id]
    );
    const [returns] = await pool.execute('SELECT * FROM returns WHERE booking_id = ?', [req.params.id]);
    const [[{ paymentCount }]] = await pool.execute(
      'SELECT COUNT(*) as paymentCount FROM payments WHERE booking_id = ?', [req.params.id]
    );
    if (Number(paymentCount) === 0 && Number(booking.dp_amount) > 0) {
      await pool.execute(
        'INSERT INTO payments (booking_id, amount, method, notes, paid_at, admin_id) VALUES (?,?,?,?,?,?)',
        [req.params.id, booking.dp_amount, 'CASH', 'DP saat booking', booking.created_at || new Date(), req.user.id]
      );
    }
    const paymentSummary = await updateBookingPaymentStatus(req.params.id);
    const [paymentsAfterSync] = await pool.execute(
      `SELECT py.*, u.name as admin_name FROM payments py JOIN users u ON u.id = py.admin_id
       WHERE py.booking_id = ? ORDER BY py.paid_at DESC`, [req.params.id]
    );
    ok(res, { ...booking, items, payments: paymentsAfterSync, returns, paymentSummary });
  } catch (e) { fail(res, e.message, 500); }
});

app.post('/api/bookings', authMiddleware, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { customer_id, event_date, pickup_date, return_date, items, deposit, dp_amount, notes, status } = req.body;
    if (!customer_id || !event_date || !pickup_date || !return_date || !items?.length) {
      return fail(res, 'Data booking tidak lengkap');
    }
    for (const item of items) {
      const avail = await checkProductAvailability(item.product_id, pickup_date, return_date);
      if (!avail.available) {
        await conn.rollback();
        return fail(res, avail.reason);
      }
    }
    let rentTotal = 0;
    for (const item of items) {
      const [[p]] = await conn.execute('SELECT rent_price FROM products WHERE id = ?', [item.product_id]);
      if (!p) {
        await conn.rollback();
        return fail(res, 'Barang tidak ditemukan');
      }
      rentTotal += Number(p.rent_price) * (item.quantity || 1);
    }
    const total = rentTotal + Number(deposit || 0);
    const bookingNumber = await generateBookingNumber();
    const [r] = await conn.execute(
      `INSERT INTO bookings (booking_number, customer_id, event_date, pickup_date, return_date,
        rent_price, deposit, dp_amount, total, notes, status, payment_status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [bookingNumber, customer_id, event_date, pickup_date, return_date,
        rentTotal, deposit || 0, dp_amount || 0, total, notes || null,
        status || 'KEEP', Number(dp_amount) > 0 ? 'DP' : 'BELUM_BAYAR']
    );
    const bookingId = r.insertId;
    for (const item of items) {
      const [[p]] = await conn.execute('SELECT rent_price FROM products WHERE id = ?', [item.product_id]);
      if (!p) {
        await conn.rollback();
        return fail(res, 'Barang tidak ditemukan');
      }
      await conn.execute(
        'INSERT INTO booking_items (booking_id, product_id, quantity, rent_price) VALUES (?,?,?,?)',
        [bookingId, item.product_id, item.quantity || 1, p.rent_price]
      );
    }
    await insertBookingDates(bookingId, pickup_date, return_date, conn);
    await conn.commit();
    if (Number(dp_amount) > 0) {
      await pool.execute(
        'INSERT INTO payments (booking_id, amount, method, notes, paid_at, admin_id) VALUES (?,?,?,?,?,?)',
        [bookingId, dp_amount, 'CASH', 'DP saat booking', new Date(), req.user.id]
      );
      await updateBookingPaymentStatus(bookingId);
    }
    await logActivity(req.user.id, 'CREATE', 'booking', bookingId);
    await createNotification('BOOKING_BARU', 'Booking Baru', `Booking ${bookingNumber} dibuat`, { bookingId });
    ok(res, { id: bookingId, booking_number: bookingNumber });
  } catch (e) {
    await conn.rollback();
    fail(res, e.message, 500);
  } finally { conn.release(); }
});

app.put('/api/bookings/:id', authMiddleware, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { customer_id, event_date, pickup_date, return_date, items, deposit, dp_amount, notes, status } = req.body;
    const bookingId = req.params.id;
    const [[existing]] = await conn.execute('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (!existing) {
      await conn.rollback();
      return fail(res, 'Booking tidak ditemukan', 404);
    }
    if (items?.length) {
      for (const item of items) {
        const avail = await checkProductAvailability(item.product_id, pickup_date, return_date, bookingId);
        if (!avail.available) { await conn.rollback(); return fail(res, avail.reason); }
      }
    }
    let rentTotal = Number(existing.rent_price);
    if (items?.length) {
      await conn.execute('DELETE FROM booking_items WHERE booking_id = ?', [bookingId]);
      await conn.execute('DELETE FROM booking_dates WHERE booking_id = ?', [bookingId]);
      rentTotal = 0;
      for (const item of items) {
        const [[p]] = await conn.execute('SELECT rent_price FROM products WHERE id = ?', [item.product_id]);
        if (!p) {
          await conn.rollback();
          return fail(res, 'Barang tidak ditemukan');
        }
        rentTotal += Number(p.rent_price) * (item.quantity || 1);
        await conn.execute(
          'INSERT INTO booking_items (booking_id, product_id, quantity, rent_price) VALUES (?,?,?,?)',
          [bookingId, item.product_id, item.quantity || 1, p.rent_price]
        );
      }
      await insertBookingDates(bookingId, pickup_date, return_date, conn);
    } else if (pickup_date && return_date) {
      await conn.execute('DELETE FROM booking_dates WHERE booking_id = ?', [bookingId]);
      await insertBookingDates(bookingId, pickup_date, return_date, conn);
    }
    const total = rentTotal + Number(deposit ?? existing.deposit ?? 0);
    await conn.execute(
      `UPDATE bookings SET customer_id=?, event_date=?, pickup_date=?, return_date=?, rent_price=?, deposit=?,
       dp_amount=?, total=?, notes=?, status=? WHERE id=?`,
      [
        customer_id ?? existing.customer_id,
        event_date ?? existing.event_date,
        pickup_date ?? existing.pickup_date,
        return_date ?? existing.return_date,
        rentTotal,
        deposit ?? existing.deposit ?? 0,
        dp_amount ?? existing.dp_amount ?? 0,
        total,
        notes ?? existing.notes,
        status ?? existing.status,
        bookingId,
      ]
    );
    await conn.commit();
    await updateBookingPaymentStatus(bookingId);
    await logActivity(req.user.id, 'UPDATE', 'booking', bookingId);
    ok(res, { id: Number(bookingId) });
  } catch (e) {
    await conn.rollback();
    fail(res, e.message, 500);
  } finally { conn.release(); }
});

app.delete('/api/bookings/:id', authMiddleware, async (req, res) => {
  try {
    const [[booking]] = await pool.execute('SELECT id, status, booking_number FROM bookings WHERE id = ?', [req.params.id]);
    if (!booking) return fail(res, 'Booking tidak ditemukan', 404);
    if (booking.status === 'SEDANG_DISEWA') {
      return fail(res, 'Tidak dapat menghapus booking yang sedang disewa');
    }
    await pool.execute('DELETE FROM bookings WHERE id = ?', [req.params.id]);
    await logActivity(req.user.id, 'DELETE', 'booking', req.params.id, { booking_number: booking.booking_number });
    ok(res, { deleted: true });
  } catch (e) { fail(res, e.message, 500); }
});

app.put('/api/bookings/:id/cancel', authMiddleware, async (req, res) => {
  try {
    await pool.execute("UPDATE bookings SET status = 'BATAL' WHERE id = ?", [req.params.id]);
    await logActivity(req.user.id, 'CANCEL', 'booking', req.params.id);
    ok(res, { cancelled: true });
  } catch (e) { fail(res, e.message, 500); }
});

app.post('/api/bookings/:id/pickup', authMiddleware, upload.single('pickup_proof'), async (req, res) => {
  try {
    const { pickup_by, pickup_notes } = req.body;
    const proof = req.file ? `/uploads/${req.file.filename}` : null;
    await pool.execute(
      `UPDATE bookings SET status='SEDANG_DISEWA', pickup_by=?, pickup_notes=?, pickup_proof=?, pickup_at=NOW() WHERE id=?`,
      [pickup_by, pickup_notes, proof, req.params.id]
    );
    await logActivity(req.user.id, 'PICKUP', 'booking', req.params.id);
    ok(res, { picked_up: true });
  } catch (e) { fail(res, e.message, 500); }
});

app.post('/api/bookings/:id/return', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    const { return_date, condition, fine, notes } = req.body;
    const photo = req.file ? `/uploads/${req.file.filename}` : null;
    await pool.execute(
      'INSERT INTO returns (booking_id, return_date, `condition`, fine, notes, photo) VALUES (?,?,?,?,?,?)',
      [req.params.id, return_date, condition, fine || 0, notes, photo]
    );
    await pool.execute("UPDATE bookings SET status = 'SELESAI' WHERE id = ?", [req.params.id]);
    await logActivity(req.user.id, 'RETURN', 'booking', req.params.id);
    ok(res, { returned: true });
  } catch (e) { fail(res, e.message, 500); }
});

// ===================== KEEPS =====================
app.get('/api/keeps', authMiddleware, async (req, res) => {
  try {
    await expireKeeps();
    const { page, limit, offset, search } = parsePagination(req.query);
    let sql = `SELECT k.*, c.name as customer_name, p.name as product_name, p.code as product_code
      FROM keeps k JOIN customers c ON c.id = k.customer_id JOIN products p ON p.id = k.product_id WHERE 1=1`;
    const params = [];
    if (search) { sql += ' AND (c.name LIKE ? OR p.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (req.query.status) { sql += ' AND k.status = ?'; params.push(req.query.status); }
    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) as total FROM (${sql}) t`, params);
    sql += ' ORDER BY k.created_at DESC LIMIT ? OFFSET ?';
    const [data] = await pool.execute(sql, [...params, limit, offset]);
    ok(res, data, paginationMeta(page, limit, total));
  } catch (e) { fail(res, e.message, 500); }
});

app.post('/api/keeps', authMiddleware, async (req, res) => {
  try {
    const { product_id, customer_id, start_date, end_date, notes } = req.body;
    if (!product_id || !customer_id || !start_date || !end_date) return fail(res, 'Data keep tidak lengkap');
    const avail = await checkProductAvailability(product_id, start_date, end_date);
    if (!avail.available) return fail(res, avail.reason);
    const [[settings]] = await pool.execute('SELECT keep_default_hours FROM settings WHERE id = 1');
    const hours = settings?.keep_default_hours || Number(process.env.KEEP_DEFAULT_HOURS) || 24;
    const expiredAt = new Date(Date.now() + hours * 3600000);
    const [r] = await pool.execute(
      'INSERT INTO keeps (product_id, customer_id, start_date, end_date, notes, expired_at) VALUES (?,?,?,?,?,?)',
      [product_id, customer_id, start_date, end_date, notes, expiredAt]
    );
    await logActivity(req.user.id, 'CREATE', 'keep', r.insertId);
    ok(res, { id: r.insertId, expired_at: expiredAt });
  } catch (e) { fail(res, e.message, 500); }
});

app.put('/api/keeps/:id', authMiddleware, async (req, res) => {
  try {
    const { start_date, end_date, notes } = req.body;
    const [[keep]] = await pool.execute('SELECT product_id FROM keeps WHERE id = ?', [req.params.id]);
    if (!keep) return fail(res, 'Keep tidak ditemukan', 404);
    const avail = await checkProductAvailability(keep.product_id, start_date, end_date);
    if (!avail.available) return fail(res, avail.reason);
    await pool.execute('UPDATE keeps SET start_date=?, end_date=?, notes=? WHERE id=?',
      [start_date, end_date, notes, req.params.id]);
    ok(res, { id: Number(req.params.id) });
  } catch (e) { fail(res, e.message, 500); }
});

app.put('/api/keeps/:id/cancel', authMiddleware, async (req, res) => {
  try {
    await pool.execute("UPDATE keeps SET status = 'CANCEL' WHERE id = ?", [req.params.id]);
    await logActivity(req.user.id, 'CANCEL', 'keep', req.params.id);
    ok(res, { cancelled: true });
  } catch (e) { fail(res, e.message, 500); }
});

// ===================== PAYMENTS =====================
app.get('/api/payments', authMiddleware, async (req, res) => {
  try {
    const { page, limit, offset, search } = parsePagination(req.query);
    let sql = `SELECT py.*, b.booking_number, c.name as customer_name, u.name as admin_name
      FROM payments py JOIN bookings b ON b.id = py.booking_id
      JOIN customers c ON c.id = b.customer_id JOIN users u ON u.id = py.admin_id WHERE 1=1`;
    const params = [];
    if (search) { sql += ' AND (b.booking_number LIKE ? OR c.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (req.query.booking_id) { sql += ' AND py.booking_id = ?'; params.push(req.query.booking_id); }
    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) as total FROM (${sql}) t`, params);
    sql += ' ORDER BY py.paid_at DESC LIMIT ? OFFSET ?';
    const [data] = await pool.execute(sql, [...params, limit, offset]);
    ok(res, data, paginationMeta(page, limit, total));
  } catch (e) { fail(res, e.message, 500); }
});

app.post('/api/payments', authMiddleware, async (req, res) => {
  try {
    const { booking_id, amount, method, notes, paid_at } = req.body;
    if (!booking_id || !amount || !method) return fail(res, 'Data pembayaran tidak lengkap');
    const [r] = await pool.execute(
      'INSERT INTO payments (booking_id, amount, method, notes, paid_at, admin_id) VALUES (?,?,?,?,?,?)',
      [booking_id, amount, method, notes, paid_at || new Date(), req.user.id]
    );
    const summary = await updateBookingPaymentStatus(booking_id);
    await logActivity(req.user.id, 'CREATE', 'payment', r.insertId);
    await createNotification('PEMBAYARAN_MASUK', 'Pembayaran Masuk',
      `Pembayaran Rp ${Number(amount).toLocaleString('id-ID')} diterima`, { bookingId: booking_id, paymentId: r.insertId });
    ok(res, { id: r.insertId, ...summary });
  } catch (e) { fail(res, e.message, 500); }
});

// ===================== CALENDAR =====================
app.get('/api/calendar', authMiddleware, async (req, res) => {
  try {
    const { start, end, product_id } = req.query;
    const dateStart = start || toDateStr(new Date());
    const dateEnd = end || toDateStr(new Date(new Date().setMonth(new Date().getMonth() + 1)));
    let bookingSql = `SELECT b.id, b.booking_number, b.status, b.event_date, b.pickup_date, b.return_date,
      c.name as customer_name, p.name as product_name, p.code as product_code, p.id as product_id, 'booking' as type
      FROM bookings b JOIN customers c ON c.id = b.customer_id
      JOIN booking_items bi ON bi.booking_id = b.id JOIN products p ON p.id = bi.product_id
      WHERE b.status NOT IN ('BATAL') AND b.pickup_date <= ? AND b.return_date >= ?`;
    const params = [dateEnd, dateStart];
    if (product_id) { bookingSql += ' AND bi.product_id = ?'; params.push(product_id); }
    const [bookings] = await pool.execute(bookingSql, params);
    let keepSql = `SELECT k.id, k.status, k.start_date, k.end_date, c.name as customer_name,
      p.name as product_name, p.code as product_code, p.id as product_id, 'keep' as type
      FROM keeps k JOIN customers c ON c.id = k.customer_id JOIN products p ON p.id = k.product_id
      WHERE k.status = 'KEEP' AND k.expired_at > NOW() AND k.start_date <= ? AND k.end_date >= ?`;
    const keepParams = [dateEnd, dateStart];
    if (product_id) { keepSql += ' AND k.product_id = ?'; keepParams.push(product_id); }
    const [keeps] = await pool.execute(keepSql, keepParams);
    ok(res, { bookings, keeps, range: { start: dateStart, end: dateEnd } });
  } catch (e) { fail(res, e.message, 500); }
});

// ===================== REPORTS =====================
app.get('/api/reports', authMiddleware, async (req, res) => {
  try {
    const period = req.query.period || 'monthly';
    let dateFilter = 'MONTH(paid_at) = MONTH(CURDATE()) AND YEAR(paid_at) = YEAR(CURDATE())';
    if (period === 'daily') dateFilter = 'DATE(paid_at) = CURDATE()';
    else if (period === 'weekly') dateFilter = 'YEARWEEK(paid_at) = YEARWEEK(CURDATE())';
    else if (period === 'yearly') dateFilter = 'YEAR(paid_at) = YEAR(CURDATE())';

    const [[revenue]] = await pool.execute(
      `SELECT COALESCE(SUM(amount),0) as total_transactions,
        COALESCE(SUM(CASE WHEN b.payment_status='DP' THEN amount ELSE 0 END),0) as total_dp,
        COALESCE(SUM(CASE WHEN b.payment_status='LUNAS' THEN amount ELSE 0 END),0) as total_lunas
       FROM payments py JOIN bookings b ON b.id = py.booking_id WHERE ${dateFilter}`
    );
    const [topProducts] = await pool.execute(
      `SELECT p.name, p.code, COUNT(bi.id) as rental_count, COALESCE(SUM(bi.rent_price),0) as revenue
       FROM booking_items bi JOIN products p ON p.id = bi.product_id
       JOIN bookings b ON b.id = bi.booking_id WHERE b.status != 'BATAL'
       GROUP BY p.id ORDER BY rental_count DESC LIMIT 10`
    );
    const [topCustomers] = await pool.execute(
      `SELECT c.name, c.phone, COUNT(b.id) as booking_count, COALESCE(SUM(b.total),0) as total_transactions
       FROM bookings b JOIN customers c ON c.id = b.customer_id WHERE b.status != 'BATAL'
       GROUP BY c.id ORDER BY booking_count DESC LIMIT 10`
    );
    ok(res, { period, revenue, topProducts, topCustomers });
  } catch (e) { fail(res, e.message, 500); }
});

// ===================== NOTIFICATIONS =====================
app.get('/api/notifications', authMiddleware, async (req, res) => {
  try {
    await expireKeeps();
    const [data] = await pool.execute(
      'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50'
    );
    const [[{ unread }]] = await pool.execute('SELECT COUNT(*) as unread FROM notifications WHERE is_read = 0');
    ok(res, { notifications: data, unread: unread });
  } catch (e) { fail(res, e.message, 500); }
});

app.put('/api/notifications/:id/read', authMiddleware, async (req, res) => {
  try {
    await pool.execute('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
    ok(res, { read: true });
  } catch (e) { fail(res, e.message, 500); }
});

app.put('/api/notifications/read-all', authMiddleware, async (_, res) => {
  try {
    await pool.execute('UPDATE notifications SET is_read = 1 WHERE is_read = 0');
    ok(res, { read: true });
  } catch (e) { fail(res, e.message, 500); }
});

// ===================== SETTINGS =====================
app.get('/api/settings', authMiddleware, async (_, res) => {
  try {
    const [[settings]] = await pool.execute('SELECT * FROM settings WHERE id = 1');
    ok(res, settings);
  } catch (e) { fail(res, e.message, 500); }
});

app.put('/api/settings', authMiddleware, upload.single('logo'), async (req, res) => {
  try {
    const fields = ['store_name', 'address', 'phone', 'whatsapp', 'instagram',
      'keep_default_hours', 'deposit_default', 'wa_template_booking',
      'wa_template_dp_reminder', 'wa_template_pickup', 'wa_template_return'];
    const updates = [];
    const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
    }
    if (req.file) { updates.push('logo = ?'); params.push(`/uploads/${req.file.filename}`); }
    if (!updates.length) return fail(res, 'Tidak ada data untuk diupdate');
    await pool.execute(`UPDATE settings SET ${updates.join(', ')} WHERE id = 1`, params);
    const [[settings]] = await pool.execute('SELECT * FROM settings WHERE id = 1');
    ok(res, settings);
  } catch (e) { fail(res, e.message, 500); }
});

// ===================== WHATSAPP =====================
app.get('/api/bookings/:id/whatsapp', authMiddleware, async (req, res) => {
  try {
    const type = req.query.type || 'booking';
    const [[booking]] = await pool.execute(
      `SELECT b.*, c.name as customer_name, c.phone as customer_phone FROM bookings b
       JOIN customers c ON c.id = b.customer_id WHERE b.id = ?`, [req.params.id]
    );
    if (!booking) return fail(res, 'Booking tidak ditemukan', 404);
    const [items] = await pool.execute(
      `SELECT p.name FROM booking_items bi JOIN products p ON p.id = bi.product_id WHERE bi.booking_id = ?`, [req.params.id]
    );
    const [[settings]] = await pool.execute('SELECT * FROM settings WHERE id = 1');
    const templates = {
      booking: settings?.wa_template_booking,
      dp_reminder: settings?.wa_template_dp_reminder,
      pickup: settings?.wa_template_pickup,
      return: settings?.wa_template_return,
    };
    let message = templates[type] || templates.booking;
    message = message
      .replace('{nama}', booking.customer_name)
      .replace('{barang}', items.map((i) => i.name).join(', '))
      .replace('{tanggal}', `${toDateStr(booking.event_date)} (Ambil: ${toDateStr(booking.pickup_date)})`)
      .replace('{total}', `Rp ${Number(booking.total).toLocaleString('id-ID')}`);
    const phone = (settings?.whatsapp || booking.customer_phone).replace(/\D/g, '');
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    ok(res, { url: waUrl, message });
  } catch (e) { fail(res, e.message, 500); }
});

// ===================== SEED ADMIN =====================
const seedAdmin = async () => {
  try {
    const [rows] = await pool.execute('SELECT id FROM users LIMIT 1');
    if (rows.length) return;
    const hash = await bcrypt.hash('admin123', 10);
    await pool.execute(
      "INSERT INTO users (name, email, password, role) VALUES ('Administrator', 'admin@rental.com', ?, 'ADMIN')",
      [hash]
    );
    console.log('Default admin created: admin@rental.com / admin123');
  } catch (e) { console.warn('Seed admin skipped:', e.message); }
};

// ===================== CRON: AUTO EXPIRE KEEPS =====================
setInterval(expireKeeps, 5 * 60 * 1000);

// ===================== START =====================
app.listen(PORT, async () => {
  await seedAdmin();
  console.log(`Rental System API running on http://localhost:${PORT}`);
});
