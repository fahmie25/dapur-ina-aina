const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

function getGuestOrders(req) {
  if (!req.session.guestOrders) req.session.guestOrders = [];
  return req.session.guestOrders;
}

// ---------- GET /checkout : review sebelum menyimpan pesanan ----------
router.get('/checkout', (req, res) => {
  const cart = req.session.cart || [];
  if (cart.length === 0) {
    req.flash('error', 'Keranjang Anda masih kosong.');
    return res.redirect('/menu');
  }
  const total = cart.reduce((sum, item) => sum + item.harga * item.jumlah, 0);
  res.render('checkout', { title: 'Checkout', cart, total });
});

// ---------- POST /checkout/place : pelanggan guest membuat pesanan ----------
router.post('/checkout/place', async (req, res, next) => {
  const cart = req.session.cart || [];
  if (cart.length === 0) {
    req.flash('error', 'Keranjang Anda masih kosong.');
    return res.redirect('/menu');
  }

  const namaPelanggan = String(req.body.nama_pelanggan || '').trim();
  const noTelp = String(req.body.no_telp || '').trim();

  if (!namaPelanggan || !noTelp) {
    req.flash('error', 'Nama pelanggan dan nomor WhatsApp wajib diisi.');
    return res.redirect('/checkout');
  }

  const polaNoTelp = /^(0|\+62)8[0-9]{8,12}$/;
  if (!polaNoTelp.test(noTelp)) {
    req.flash('error', 'Format nomor WhatsApp/telepon tidak valid. Gunakan awalan 08 atau +62, contoh: 081234567890.');
    return res.redirect('/checkout');
  }

  try {
    // Re-validasi stok sebelum transaksi disimpan.
    for (const item of cart) {
      const { data: produk, error } = await supabaseAdmin
        .from('produk')
        .select('stok, status, nama_produk, harga')
        .eq('id_produk', item.id_produk)
        .single();
      if (error || !produk) throw new Error('Produk tidak ditemukan: ' + item.nama_produk);
      if (produk.status === 'Habis' || produk.stok < item.jumlah) {
        req.flash('error', `Stok "${produk.nama_produk}" tidak mencukupi.`);
        return res.redirect('/cart');
      }
    }

    const total = cart.reduce((sum, item) => sum + item.harga * item.jumlah, 0);

    // id_user sengaja NULL karena pelanggan tidak mempunyai akun.
    const { data: pesanan, error: pesananErr } = await supabaseAdmin
      .from('pesanan')
      .insert({
        id_user: null,
        nama_pelanggan: namaPelanggan,
        no_telp: noTelp,
        total,
        status: 'Menunggu Pembayaran',
      })
      .select()
      .single();
    if (pesananErr) throw pesananErr;

    const detailRows = cart.map((item) => ({
      id_pesanan: pesanan.id_pesanan,
      id_produk: item.id_produk,
      jumlah: item.jumlah,
      harga: item.harga,
      subtotal: item.harga * item.jumlah,
    }));
    const { error: detailErr } = await supabaseAdmin.from('detail_pesanan').insert(detailRows);
    if (detailErr) throw detailErr;

    // Kurangi stok sesuai jumlah yang dipesan.
    for (const item of cart) {
      const { data: produk } = await supabaseAdmin
        .from('produk')
        .select('stok')
        .eq('id_produk', item.id_produk)
        .single();
      const stokBaru = Math.max(0, produk.stok - item.jumlah);
      await supabaseAdmin
        .from('produk')
        .update({ stok: stokBaru, status: stokBaru <= 0 ? 'Habis' : 'Tersedia' })
        .eq('id_produk', item.id_produk);
    }

    // Billing dibuat sebelum pelanggan memilih metode pembayaran.
    const { error: billingErr } = await supabaseAdmin.from('pembayaran').insert({
      id_pesanan: pesanan.id_pesanan,
      jumlah_bayar: 0,
      kembalian: 0,
      status: 'Pending',
    });
    if (billingErr) throw billingErr;

    req.session.cart = [];
    const guestOrders = getGuestOrders(req);
    guestOrders.push(pesanan.id_pesanan);
    req.session.guestOrders = [...new Set(guestOrders)].slice(-20);

    res.redirect(`/payment/${pesanan.id_pesanan}`);
  } catch (err) {
    next(err);
  }
});

// Riwayat pesanan guest berdasarkan sesi browser, tanpa login.
router.get('/my-orders', async (req, res, next) => {
  try {
    const ids = getGuestOrders(req);
    if (!ids.length) return res.render('my-orders', { title: 'Pesanan Saya', pesananList: [] });

    const { data: pesananList, error } = await supabaseAdmin
      .from('pesanan')
      .select('id_pesanan, tanggal, total, status, nama_pelanggan, no_telp')
      .in('id_pesanan', ids)
      .order('tanggal', { ascending: false });
    if (error) throw error;
    res.render('my-orders', { title: 'Pesanan Saya', pesananList });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
