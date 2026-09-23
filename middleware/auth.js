const { supabaseAnon, supabaseAdmin } = require('../config/supabase');

/**
 * Memuat sesi administrator jika ada.
 * Pelanggan tidak memiliki akun/sesi dan tetap dapat menggunakan seluruh alur
 * menu -> keranjang -> checkout -> pembayaran sebagai guest.
 */
async function attachUser(req, res, next) {
  res.locals.user = null;
  req.user = null;

  const session = req.session.supabaseSession;
  if (!session) return next();

  try {
    const { data, error } = await supabaseAnon.auth.getUser(session.access_token);

    if (error || !data?.user) {
      const { data: refreshed, error: refreshError } = await supabaseAnon.auth.refreshSession({
        refresh_token: session.refresh_token,
      });
      if (refreshError || !refreshed?.session) {
        req.session.supabaseSession = null;
        return next();
      }
      req.session.supabaseSession = {
        access_token: refreshed.session.access_token,
        refresh_token: refreshed.session.refresh_token,
      };
      data.user = refreshed.user;
    }

    const uid = data?.user?.id;
    if (!uid) return next();

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('id_user, username, nama, role')
      .eq('id_user', uid)
      .single();

    // Hanya profil admin yang dianggap sebagai pengguna aplikasi.
    if (profile?.role === 'admin') {
      req.user = profile;
      res.locals.user = profile;
    } else {
      req.session.supabaseSession = null;
    }
  } catch (err) {
    console.error('[auth] gagal memuat sesi admin:', err.message);
  }

  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      req.flash('error', 'Silakan login sebagai administrator.');
      return res.redirect('/login');
    }
    if (req.user.role !== role) {
      req.flash('error', 'Anda tidak memiliki akses ke halaman tersebut.');
      return res.redirect('/');
    }
    next();
  };
}

module.exports = { attachUser, requireRole };
