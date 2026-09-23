const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { requireRole } = require('../middleware/auth');

router.use(requireRole('admin'));

function pad(n) { return String(n).padStart(2, '0'); }
function toDateInputValue(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

// GET /admin/transaksi : "Buka menu transaksi" -> "Tampilkan daftar"
// Mendukung filter rentang tanggal lewat query ?dari=YYYY-MM-DD&sampai=YYYY-MM-DD
// Default: 1 bulan (30 hari) terakhir.
router.get('/', async (req, res, next) => {
  try {
    const sekarang = new Date();
    const sebulanLalu = new Date(sekarang);
    sebulanLalu.setDate(sekarang.getDate() - 30);

    const dari = POLA_TANGGAL.test(req.query.dari) ? req.query.dari : toDateInputValue(sebulanLalu);
    const sampai = POLA_TANGGAL.test(req.query.sampai) ? req.query.sampai : toDateInputValue(sekarang);

    const dariISO = new Date(`${dari}T00:00:00`).toISOString();
    const sampaiISO = new Date(`${sampai}T23:59:59.999`).toISOString();

    const { data: pesananList, error } = await supabaseAdmin
      .from('pesanan')
      .select('*, users(nama, username), pembayaran(status, metode)')
      .gte('tanggal', dariISO)
      .lte('tanggal', sampaiISO)
      .order('tanggal', { ascending: false });
    if (error) throw error;

    res.render('admin/transaksi', { title: 'Kelola Transaksi', pesananList, dari, sampai });
  } catch (err) {
    next(err);
  }
});

// GET /admin/transaksi/:id : "Cari/pilih transaksi" -> "Tampilkan detail"
router.get('/:id', async (req, res, next) => {
  try {
    const { data: pesanan, error } = await supabaseAdmin
      .from('pesanan')
      .select('*, users(nama, username), detail_pesanan(*, produk(nama_produk)), pembayaran(*)')
      .eq('id_pesanan', req.params.id)
      .single();
    if (error || !pesanan) {
      req.flash('error', 'Transaksi tidak ditemukan.');
      return res.redirect('/admin/transaksi');
    }
    res.render('admin/transaksi-detail', { title: `Transaksi #${pesanan.id_pesanan}`, pesanan });
  } catch (err) {
    next(err);
  }
});

// PUT /admin/transaksi/:id/status : "Ubah status transaksi" -> "Validasi status" -> "Simpan perubahan"
router.put('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const valid = ['Menunggu Pembayaran', 'Dibayar', 'Diproses', 'Selesai', 'Dibatalkan'];
    if (!valid.includes(status)) {
      req.flash('error', 'Status tidak valid.');
      return res.redirect(`/admin/transaksi/${req.params.id}`);
    }
    const { error } = await supabaseAdmin
      .from('pesanan')
      .update({ status })
      .eq('id_pesanan', req.params.id);
    if (error) throw error;
    req.flash('success', 'Status transaksi berhasil diperbarui.');
    res.redirect(`/admin/transaksi/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

// PUT /admin/transaksi/:id/konfirmasi-tunai : konfirmasi pembayaran tunai di kasir
router.put('/:id/konfirmasi-tunai', async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin
      .from('pembayaran')
      .update({ status: 'Berhasil', tanggal_bayar: new Date().toISOString() })
      .eq('id_pesanan', req.params.id);
    if (error) throw error;

    await supabaseAdmin.from('pesanan').update({ status: 'Dibayar' }).eq('id_pesanan', req.params.id);

    req.flash('success', 'Pembayaran tunai berhasil dikonfirmasi.');
    res.redirect(`/admin/transaksi/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
