require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '[supabase] Env SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY belum lengkap. ' +
    'Salin .env.example menjadi .env dan isi dengan kredensial project Supabase Anda.'
  );
}

// Client "anon" -> dipakai untuk login administrator (auth.signInWithPassword)
// Ini aman karena hanya memverifikasi kredensial, sama seperti dari browser.
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Client "admin" (service role) -> dipakai untuk semua query CRUD ke tabel
// (produk, kategori, pesanan, dll) dan operasi admin (create user, dsb).
// PENTING: client ini hanya boleh dipakai di sisi server, TIDAK PERNAH
// dikirim/diexpose ke browser.
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

module.exports = { supabaseAnon, supabaseAdmin };
