const express = require('express');
const router = express.Router();
const { supabaseAnon, supabaseAdmin } = require('../config/supabase');

// Hanya ADMIN yang memiliki akun dan perlu login.
// Pelanggan tidak membuat akun dan dapat memesan sebagai guest.
router.get('/login', (req, res) => {
  if (req.user?.role === 'admin') return res.redirect('/admin');
  res.render('auth/login', { title: 'Login Admin' });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    req.flash('error', 'Email dan password wajib diisi.');
    return res.redirect('/login');
  }

  try {
    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

    if (error || !data?.session) {
      req.flash('error', 'Email atau password salah.');
      return res.redirect('/login');
    }

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('id_user, username, nama, role')
      .eq('id_user', data.user.id)
      .single();

    // Akun yang boleh masuk ke sistem hanya role admin.
    if (profile?.role !== 'admin') {
      await supabaseAnon.auth.signOut();
      req.flash('error', 'Halaman login hanya diperuntukkan bagi administrator. Pelanggan tidak perlu login.');
      return res.redirect('/login');
    }

    req.session.supabaseSession = {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    };

    req.flash('success', 'Login admin berhasil.');
    return res.redirect('/admin');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Terjadi kesalahan server saat login.');
    res.redirect('/login');
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/menu'));
});

module.exports = router;
