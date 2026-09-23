# Dapur Ina Aina — Aplikasi Pemesanan & Pembayaran Online

Aplikasi web untuk Toko Dapur Ina Aina, dibangun sesuai rancangan **Tugas 1**
(use case diagram, activity diagram, class diagram) dan **Tugas 2**
(rancangan database) — Fahmi Tafazzul Rashid, 4KA04/10123393.

**Stack:** Node.js + Express + EJS · Supabase (PostgreSQL + Auth) · Midtrans (Snap payment gateway)

---

## 1. Struktur Fitur (mengikuti Use Case Diagram)

| Aktor | Use Case | Implementasi |
|---|---|---|
| Pelanggan | Melihat Menu | `GET /menu` |
| Pelanggan | Melakukan Pemesanan | `/cart/*`, `/checkout`, `/checkout/place` |
| Pelanggan | Melakukan Pembayaran | `/payment/:id` (Tunai & Non Tunai via Midtrans) |
| Admin | Login (include) | `/login` (Supabase Auth, khusus admin) |
| Admin | Mengelola Stok | `/admin/stok/produk`, `/admin/stok/kategori` |
| Admin | Mengelola Transaksi | `/admin/transaksi` |
| Admin | Melihat Laporan Penjualan | `/admin/laporan?periode=mingguan\|bulanan\|tahunan` |

Setiap activity diagram (Melihat menu & pemesanan, Pembayaran, Mengelola stok,
Mengelola transaksi, Laporan penjualan) diterapkan langkah-demi-langkah di
masing-masing route (lihat komentar di file `routes/*.js`).

## 2. Catatan Adaptasi dari Rancangan Awal

Karena Anda memilih **Supabase Auth** untuk autentikasi, ada 2 penyesuaian
kecil dari skema Tugas 2:

1. Kolom `password` pada tabel `users` **dihapus** — kredensial disimpan &
   dikelola oleh Supabase Auth (`auth.users`), bukan tabel kita sendiri.
2. `id_user` diubah dari `INT` menjadi `UUID`, karena Supabase Auth memakai
   UUID sebagai id user, dan `public.users.id_user` mereferensikan
   `auth.users.id` (relasi 1:1).

Selain itu, seluruh struktur tabel (`kategori`, `produk`, `pesanan`,
`detail_pesanan`, `pembayaran`) mengikuti persis rancangan pada Tugas 2. Detail
lengkap ada di `sql/schema.sql`.

Tabel `pembayaran` juga ditambah 2 kolom (`midtrans_order_id`, `snap_token`)
untuk mendukung integrasi Midtrans.

## 3. Setup

### a. Buat project Supabase
1. Buat project baru di https://supabase.com.
2. Buka **SQL Editor**, jalankan seluruh isi file `sql/schema.sql`.
3. Buka **Project Settings > API**, salin `Project URL`, `anon public key`,
   dan `service_role key`.

### b. Buat akun Midtrans (Sandbox)
1. Daftar di https://dashboard.midtrans.com (mode Sandbox cukup untuk uji coba).
2. Buka **Settings > Access Keys**, salin `Server Key` dan `Client Key`.
3. (Opsional, untuk pembayaran online berjalan otomatis) atur **Payment
   Notification URL** di Settings > Configuration ke:
   `https://<domain-publik-anda>/payment/notification`
   — saat development lokal, gunakan tunnel seperti `ngrok` agar Midtrans
   bisa mengirim notifikasi ke server lokal Anda.

### c. Konfigurasi environment
Salin `.env.example` menjadi `.env`, lalu isi kredensial Supabase, Midtrans, dan akun admin sesuai kebutuhan. Jangan membagikan file `.env`.

### d. Install dependency & jalankan
```bash
npm install
npm run seed:admin   # membuat 1 akun admin pertama (dari SEED_ADMIN_* di .env)
npm run dev           # atau: npm start
```
Aplikasi berjalan di `http://localhost:3000`.

- Login sebagai **admin** memakai email/password dari `SEED_ADMIN_EMAIL` /
  `SEED_ADMIN_PASSWORD` di `.env`.
- Pengguna baru dapat mendaftar sendiri lewat halaman `/register` (otomatis
  berperan sebagai `user`).

## 4. Struktur Folder

```
dapur-ina-aina/
├─ config/         # koneksi Supabase & Midtrans
├─ middleware/      # auth & role guard
├─ routes/          # semua endpoint Express
├─ views/           # template EJS
├─ public/css       # stylesheet
├─ sql/schema.sql    # skema database Supabase
├─ scripts/seedAdmin.js
└─ server.js
```

## 5. Alur Pelanggan Tanpa Login

1. Buka `/` atau `/menu`.
2. Pilih makanan/minuman dan masukkan ke keranjang.
3. Buka checkout dan isi nama + nomor WhatsApp/telepon.
4. Sistem membuat pesanan dan billing.
5. Pelanggan memilih Tunai atau Non Tunai.
6. Setelah pembayaran, pelanggan melihat struk.

Jika database sudah pernah dibuat dengan versi lama, jalankan `sql/migration_guest_order.sql` satu kali di Supabase SQL Editor.

## 6. Pengujian Pembayaran (Midtrans Sandbox)

Gunakan kartu uji Midtrans berikut di popup Snap saat memilih "Bayar Online":
- Nomor kartu: `4811 1111 1111 1114`
- CVV: `123`, Masa berlaku: bebas tanggal di masa depan, OTP: `112233`

Daftar lengkap metode uji (VA, QRIS, e-wallet, dll) tersedia di dokumentasi
Midtrans Sandbox: https://docs.midtrans.com/docs/testing-payment-on-sandbox

## 7. Foto Produk (via Link URL)

Setiap produk punya kolom opsional **Link Foto Produk**. Cukup tempel URL
gambar yang sudah ada di internet (misalnya hasil upload ke Imgur, Google
Drive dengan akses publik, atau CDN lain) saat menambah/mengedit produk di
halaman **Kelola Stok Produk**. Produk tanpa link foto akan tetap tampil
rapi dengan ikon emoji sesuai kategorinya di halaman menu.

Jika project Supabase Anda sudah dibuat SEBELUM fitur ini ditambahkan,
jalankan `sql/migration_gambar_produk.sql` di SQL Editor Supabase untuk
menambahkan kolom `gambar_url` ke tabel `produk` (project baru cukup
jalankan `sql/schema.sql` seperti biasa, sudah termasuk di dalamnya).

## 8. Batasan yang Perlu Diketahui

- Karena project ini dibangun di lingkungan sandbox tanpa akses internet,
  `node_modules` **belum ter-install** — jalankan `npm install` di komputer
  Anda sebelum menjalankan aplikasi.
- Webhook `/payment/notification` butuh URL publik agar Midtrans bisa
  memanggilnya (pakai ngrok/deploy ke hosting saat butuh notifikasi otomatis
  real-time; secara manual, admin tetap bisa mengecek & mengonfirmasi status
  transaksi lewat halaman **Kelola Transaksi**).
