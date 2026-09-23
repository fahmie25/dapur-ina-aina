const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('./../config/supabase');
const { requireRole } = require('./../middleware/auth');

router.use(requireRole('admin'));

router.get('/', async (req, res, next) => {
  try {
    const [{ data: produk }, { data: kategori }, { data: pesanan }, { data: pembayaran }] = await Promise.all([
      supabaseAdmin.from('produk').select('id_produk, nama_produk, stok, status, harga'),
      supabaseAdmin.from('kategori').select('id_kategori'),
      supabaseAdmin.from('pesanan').select('id_pesanan, total, status, tanggal, nama_pelanggan').order('tanggal', { ascending: false }),
      supabaseAdmin.from('pembayaran').select('id_pembayaran, id_pesanan, status, metode'),
    ]);

    const produkList = produk || [];
    const pesananList = pesanan || [];
    const pembayaranList = pembayaran || [];
    const totalPenjualan = pesananList
      .filter(p => ['Dibayar', 'Diproses', 'Selesai'].includes(p.status))
      .reduce((sum, p) => sum + Number(p.total || 0), 0);

    res.render('admin/dashboard', {
      title: 'Dashboard Admin',
      stats: {
        produk: produkList.length,
        tersedia: produkList.filter(p => p.status === 'Tersedia').length,
        habis: produkList.filter(p => p.status === 'Habis').length,
        kategori: (kategori || []).length,
        transaksi: pesananList.length,
        menunggu: pesananList.filter(p => p.status === 'Menunggu Pembayaran').length,
        dibayar: pembayaranList.filter(p => p.status === 'Berhasil').length,
        totalPenjualan,
      },
      pesananTerbaru: pesananList.slice(0, 8),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
