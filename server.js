require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const morgan = require('morgan');
const path = require('path');

const { attachUser } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const menuRoutes = require('./routes/menu');
const orderRoutes = require('./routes/order');
const paymentRoutes = require('./routes/payment');
const adminDashboardRoutes = require('./routes/admin.dashboard');
const adminStokRoutes = require('./routes/admin.stok');
const adminTransaksiRoutes = require('./routes/admin.transaksi');
const adminLaporanRoutes = require('./routes/admin.laporan');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'ganti-secret-ini',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 }, // 8 jam
  })
);
app.use(flash());

// Sisipkan data user (jika sudah login) & pesan flash ke semua view
app.use(attachUser);
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.path = req.path;
  next();
});

// ===== Routes =====
app.get('/', (req, res) => res.render('home', { title: 'Beranda' }));
app.use('/admin', adminDashboardRoutes);

app.use('/', authRoutes);
app.use('/', menuRoutes);
app.use('/', orderRoutes);
app.use('/', paymentRoutes);
app.use('/admin/stok', adminStokRoutes);
app.use('/admin/transaksi', adminTransaksiRoutes);
app.use('/admin/laporan', adminLaporanRoutes);

// 404
app.use((req, res) => {
  res.status(404).render('error', { title: 'Halaman Tidak Ditemukan', message: 'Halaman yang Anda cari tidak ada.' });
});

// Error handler umum
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Terjadi Kesalahan', message: err.message || 'Terjadi kesalahan pada server.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Dapur Ina Aina berjalan di http://localhost:${PORT}`);
});
