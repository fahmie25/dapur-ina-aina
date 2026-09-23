/**
 * Jalankan sekali untuk membuat akun admin pertama:
 *   npm run seed:admin
 * Kredensial diambil dari .env (SEED_ADMIN_*).
 */
require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase');

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const username = process.env.SEED_ADMIN_USERNAME || 'admin';
  const nama = process.env.SEED_ADMIN_NAMA || 'Admin Toko';

  if (!email || !password) {
    console.error('SEED_ADMIN_EMAIL dan SEED_ADMIN_PASSWORD wajib diisi di .env');
    process.exit(1);
  }

  console.log(`Membuat akun admin: ${email} ...`);

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createErr) {
    console.error('Gagal membuat user di Supabase Auth:', createErr.message);
    process.exit(1);
  }

  const { error: profileErr } = await supabaseAdmin.from('users').insert({
    id_user: created.user.id,
    username,
    nama,
    role: 'admin',
  });

  if (profileErr) {
    console.error('Gagal menyimpan profil admin:', profileErr.message);
    process.exit(1);
  }

  console.log('Akun admin berhasil dibuat!');
  console.log(`  Email    : ${email}`);
  console.log(`  Password : ${password}`);
  console.log('Silakan login melalui halaman /login.');
  process.exit(0);
}

main();
