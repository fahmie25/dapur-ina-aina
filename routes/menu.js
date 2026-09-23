const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

function getCart(req) {
  if (!req.session.cart) req.session.cart = []; // [{id_produk, nama_produk, harga, jumlah}]
  return req.session.cart;
}

// ---------- GET /menu : Melihat Menu ----------
router.get('/menu', async (req, res, next) => {
  try {
    const idKategori = req.query.kategori ? Number(req.query.kategori) : null;

    const { data: kategoriList, error: errKat } = await supabaseAdmin
      .from('kategori')
      .select('id_kategori, nama_kategori')
      .order('id_kategori');
    if (errKat) throw errKat;

    let query = supabaseAdmin
      .from('produk')
      .select('id_produk, nama_produk, harga, stok, status, id_kategori')
      .order('nama_produk');
    if (idKategori) query = query.eq('id_kategori', idKategori);

    const { data: produkList, error: errProduk } = await query;
    if (errProduk) throw errProduk;

    const cart = getCart(req);
    const cartCount = cart.reduce((sum, item) => sum + item.jumlah, 0);

    res.render('menu', {
      title: 'Menu',
      kategoriList,
      produkList,
      selectedKategori: idKategori,
      cartCount,
    });
  } catch (err) {
    next(err);
  }
});

// ---------- POST /cart/add : Pilih item & jumlah (bagian dari Melakukan Pemesanan) ----------
router.post('/cart/add', async (req, res, next) => {
  try {
    const idProduk = Number(req.body.id_produk);
    const jumlah = Math.max(1, Number(req.body.jumlah) || 1);

    const { data: produk, error } = await supabaseAdmin
      .from('produk')
      .select('id_produk, nama_produk, harga, stok, status')
      .eq('id_produk', idProduk)
      .single();

    if (error || !produk) {
      req.flash('error', 'Produk tidak ditemukan.');
      return res.redirect('/menu');
    }
    // Activity Diagram: Cek stok -> "Kosong" balik ke Pilih item, "Tersedia" lanjut
    if (produk.status === 'Habis' || produk.stok <= 0) {
      req.flash('error', `Maaf, stok "${produk.nama_produk}" sedang kosong.`);
      return res.redirect('/menu');
    }

    const cart = getCart(req);
    const existing = cart.find((item) => item.id_produk === idProduk);
    const jumlahBaru = (existing ? existing.jumlah : 0) + jumlah;

    if (jumlahBaru > produk.stok) {
      req.flash('error', `Stok "${produk.nama_produk}" hanya tersisa ${produk.stok}.`);
      return res.redirect('/menu');
    }

    if (existing) {
      existing.jumlah = jumlahBaru;
    } else {
      cart.push({
        id_produk: produk.id_produk,
        nama_produk: produk.nama_produk,
        harga: Number(produk.harga),
        jumlah,
      });
    }

    req.flash('success', `${produk.nama_produk} ditambahkan ke keranjang.`);
    res.redirect('/menu');
  } catch (err) {
    next(err);
  }
});

// ---------- GET /cart : lihat keranjang ----------
router.get('/cart', (req, res) => {
  const cart = getCart(req);
  const total = cart.reduce((sum, item) => sum + item.harga * item.jumlah, 0);
  res.render('cart', { title: 'Keranjang', cart, total });
});

// ---------- POST /cart/update : ubah jumlah item ----------
router.post('/cart/update', (req, res) => {
  const idProduk = Number(req.body.id_produk);
  const jumlah = Math.max(0, Number(req.body.jumlah) || 0);
  const cart = getCart(req);
  const idx = cart.findIndex((item) => item.id_produk === idProduk);
  if (idx !== -1) {
    if (jumlah === 0) cart.splice(idx, 1);
    else cart[idx].jumlah = jumlah;
  }
  res.redirect('/cart');
});

// ---------- POST /cart/remove ----------
router.post('/cart/remove', (req, res) => {
  const idProduk = Number(req.body.id_produk);
  req.session.cart = getCart(req).filter((item) => item.id_produk !== idProduk);
  res.redirect('/cart');
});

module.exports = router;
