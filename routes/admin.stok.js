const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { requireRole } = require('../middleware/auth');

router.use(requireRole('admin'));

// ============ PRODUK ============
// GET /admin/stok/produk : "Buka menu stok" -> "Tampilkan data"
router.get('/produk', async (req, res, next) => {
  try {
    const { data: produkList, error } = await supabaseAdmin
      .from('produk')
      .select('*, kategori(nama_kategori)')
      .order('id_produk');
    if (error) throw error;

    const { data: kategoriList } = await supabaseAdmin.from('kategori').select('*').order('nama_kategori');

    res.render('admin/produk', { title: 'Kelola Stok Produk', produkList, kategoriList });
  } catch (err) {
    next(err);
  }
});

// POST /admin/stok/produk : "Pilih aksi & input data" -> "Validasi data" -> "Simpan data"
router.post('/produk', async (req, res, next) => {
  try {
    const { nama_produk, id_kategori, harga, stok, gambar_url } = req.body;
    if (!nama_produk || !id_kategori || harga === undefined || stok === undefined) {
      req.flash('error', 'Data produk tidak lengkap / tidak valid.');
      return res.redirect('/admin/stok/produk');
    }
    const stokNum = Number(stok);
    const { error } = await supabaseAdmin.from('produk').insert({
      nama_produk,
      id_kategori: Number(id_kategori),
      harga: Number(harga),
      stok: stokNum,
      status: stokNum > 0 ? 'Tersedia' : 'Habis',
      gambar_url: gambar_url ? gambar_url.trim() : null,
    });
    if (error) throw error;
    req.flash('success', 'Produk berhasil ditambahkan.');
    res.redirect('/admin/stok/produk');
  } catch (err) {
    next(err);
  }
});

// GET /admin/stok/produk/:id/edit
router.get('/produk/:id/edit', async (req, res, next) => {
  try {
    const { data: produk, error } = await supabaseAdmin
      .from('produk')
      .select('*')
      .eq('id_produk', req.params.id)
      .single();
    if (error || !produk) {
      req.flash('error', 'Produk tidak ditemukan.');
      return res.redirect('/admin/stok/produk');
    }
    const { data: kategoriList } = await supabaseAdmin.from('kategori').select('*').order('nama_kategori');
    res.render('admin/produk-edit', { title: 'Edit Produk', produk, kategoriList });
  } catch (err) {
    next(err);
  }
});

// PUT /admin/stok/produk/:id : edit produk -> "Perbarui status"
router.put('/produk/:id', async (req, res, next) => {
  try {
    const { nama_produk, id_kategori, harga, stok, status, gambar_url } = req.body;
    const stokNum = Number(stok);
    const statusFinal = stokNum <= 0 ? 'Habis' : status || 'Tersedia';

    const { error } = await supabaseAdmin
      .from('produk')
      .update({
        nama_produk,
        id_kategori: Number(id_kategori),
        harga: Number(harga),
        stok: stokNum,
        status: statusFinal,
        gambar_url: gambar_url ? gambar_url.trim() : null,
      })
      .eq('id_produk', req.params.id);
    if (error) throw error;
    req.flash('success', 'Produk berhasil diperbarui.');
    res.redirect('/admin/stok/produk');
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/stok/produk/:id
router.delete('/produk/:id', async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from('produk').delete().eq('id_produk', req.params.id);
    if (error) throw error;
    req.flash('success', 'Produk berhasil dihapus.');
    res.redirect('/admin/stok/produk');
  } catch (err) {
    next(err);
  }
});

// ============ KATEGORI ============
router.get('/kategori', async (req, res, next) => {
  try {
    const { data: kategoriList, error } = await supabaseAdmin
      .from('kategori')
      .select('*')
      .order('id_kategori');
    if (error) throw error;
    res.render('admin/kategori', { title: 'Kelola Kategori', kategoriList });
  } catch (err) {
    next(err);
  }
});

router.post('/kategori', async (req, res, next) => {
  try {
    const { nama_kategori } = req.body;
    if (!nama_kategori) {
      req.flash('error', 'Nama kategori wajib diisi.');
      return res.redirect('/admin/stok/kategori');
    }
    const { error } = await supabaseAdmin.from('kategori').insert({ nama_kategori });
    if (error) throw error;
    req.flash('success', 'Kategori berhasil ditambahkan.');
    res.redirect('/admin/stok/kategori');
  } catch (err) {
    next(err);
  }
});

router.get('/kategori/:id/edit', async (req, res, next) => {
  try {
    const { data: kategori, error } = await supabaseAdmin
      .from('kategori')
      .select('*')
      .eq('id_kategori', req.params.id)
      .single();
    if (error || !kategori) {
      req.flash('error', 'Kategori tidak ditemukan.');
      return res.redirect('/admin/stok/kategori');
    }
    res.render('admin/kategori-edit', { title: 'Edit Kategori', kategori });
  } catch (err) {
    next(err);
  }
});

router.put('/kategori/:id', async (req, res, next) => {
  try {
    const { nama_kategori } = req.body;
    const { error } = await supabaseAdmin
      .from('kategori')
      .update({ nama_kategori })
      .eq('id_kategori', req.params.id);
    if (error) throw error;
    req.flash('success', 'Kategori berhasil diperbarui.');
    res.redirect('/admin/stok/kategori');
  } catch (err) {
    next(err);
  }
});

router.delete('/kategori/:id', async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from('kategori').delete().eq('id_kategori', req.params.id);
    if (error) {
      req.flash('error', 'Kategori tidak bisa dihapus (masih dipakai produk).');
      return res.redirect('/admin/stok/kategori');
    }
    req.flash('success', 'Kategori berhasil dihapus.');
    res.redirect('/admin/stok/kategori');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
