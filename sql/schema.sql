-- =====================================================================
-- SCHEMA DATABASE: Toko Dapur Ina Aina
-- Diadaptasi dari rancangan Tugas 2 (LSP) - Fahmi Tafazzul Rashid
--
-- CATATAN ADAPTASI:
-- Karena autentikasi memakai SUPABASE AUTH (bukan tabel users manual
-- dengan kolom password), maka:
--   1) Kolom "password" DIHAPUS dari tabel users -> kredensial disimpan
--      & dikelola sepenuhnya oleh Supabase Auth (auth.users).
--   2) id_user diubah dari INT menjadi UUID, karena Supabase Auth
--      memakai UUID sebagai primary key user, dan public.users.id_user
--      mereferensikan auth.users.id (1:1).
-- Selain dua hal di atas, struktur tabel & relasi mengikuti persis
-- rancangan pada Tugas 2.
-- =====================================================================

-- Ekstensi UUID (biasanya sudah aktif di Supabase, aman dipanggil ulang)
create extension if not exists "uuid-ossp";

-- =====================================================================
-- 1. TABEL USERS  (mirror dari auth.users, menyimpan profil & role)
-- =====================================================================
create table if not exists public.users (
  id_user     uuid primary key references auth.users(id) on delete cascade,
  username    varchar(50) not null unique,
  nama        varchar(50) not null,
  role        varchar(10) not null default 'user' check (role in ('admin','user')),
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- 2. TABEL KATEGORI
-- =====================================================================
create table if not exists public.kategori (
  id_kategori    serial primary key,
  nama_kategori  varchar(50) not null
);

-- =====================================================================
-- 3. TABEL PRODUK
-- =====================================================================
create table if not exists public.produk (
  id_produk    serial primary key,
  id_kategori  int not null references public.kategori(id_kategori) on delete restrict,
  nama_produk  varchar(50) not null,
  harga        decimal(12,2) not null default 0,
  stok         int not null default 0,
  status       varchar(10) not null default 'Tersedia' check (status in ('Tersedia','Habis')),
  gambar_url   text,
  created_at   timestamptz not null default now()
);

-- =====================================================================
-- 4. TABEL PESANAN
-- =====================================================================
create table if not exists public.pesanan (
  id_pesanan  serial primary key,
  id_user     uuid null references public.users(id_user) on delete set null,
  nama_pelanggan varchar(50) not null,
  no_telp     varchar(20) not null,
  tanggal     timestamptz not null default now(),
  total       decimal(12,2) not null default 0,
  status      varchar(20) not null default 'Menunggu Pembayaran'
              check (status in ('Menunggu Pembayaran','Dibayar','Diproses','Selesai','Dibatalkan'))
);

-- =====================================================================
-- 5. TABEL DETAIL_PESANAN
-- =====================================================================
create table if not exists public.detail_pesanan (
  id_detail   serial primary key,
  id_pesanan  int not null references public.pesanan(id_pesanan) on delete cascade,
  id_produk   int not null references public.produk(id_produk) on delete restrict,
  jumlah      int not null check (jumlah > 0),
  harga       decimal(12,2) not null,
  subtotal    decimal(12,2) not null
);

-- =====================================================================
-- 6. TABEL PEMBAYARAN
-- Ditambah kolom midtrans_order_id & snap_token untuk integrasi Midtrans,
-- di luar itu mengikuti rancangan Tugas 2.
-- =====================================================================
create table if not exists public.pembayaran (
  id_pembayaran     serial primary key,
  id_pesanan        int not null references public.pesanan(id_pesanan) on delete cascade,
  tanggal_bayar     timestamptz,
  metode            varchar(20) check (metode in ('Tunai','Transfer','QRIS','Kartu','E-Wallet')),
  jumlah_bayar      decimal(12,2) not null default 0,
  kembalian         decimal(12,2) not null default 0,
  status            varchar(20) not null default 'Pending'
                     check (status in ('Pending','Berhasil','Gagal','Kadaluarsa')),
  midtrans_order_id varchar(100) unique,
  snap_token        text
);

-- =====================================================================
-- INDEX pendukung
-- =====================================================================
create index if not exists idx_produk_kategori on public.produk(id_kategori);
create index if not exists idx_pesanan_user on public.pesanan(id_user);
create index if not exists idx_pesanan_tanggal on public.pesanan(tanggal);
create index if not exists idx_detail_pesanan on public.detail_pesanan(id_pesanan);
create index if not exists idx_pembayaran_pesanan on public.pembayaran(id_pesanan);

-- =====================================================================
-- ROW LEVEL SECURITY
-- Aplikasi ini mengakses Supabase dari server (Node.js) memakai
-- SERVICE ROLE KEY yang otomatis melewati RLS, sehingga RLS di bawah
-- ini sifatnya sebagai lapisan pengaman tambahan (defense in depth)
-- apabila suatu saat ada akses langsung dari client.
-- =====================================================================
alter table public.users enable row level security;
alter table public.kategori enable row level security;
alter table public.produk enable row level security;
alter table public.pesanan enable row level security;
alter table public.detail_pesanan enable row level security;
alter table public.pembayaran enable row level security;

create policy "user lihat profil sendiri" on public.users
  for select using (auth.uid() = id_user);

create policy "semua boleh lihat kategori" on public.kategori
  for select using (true);

create policy "semua boleh lihat produk" on public.produk
  for select using (true);

create policy "user lihat pesanan sendiri" on public.pesanan
  for select using (auth.uid() = id_user);

create policy "user lihat detail pesanan sendiri" on public.detail_pesanan
  for select using (
    exists (
      select 1 from public.pesanan p
      where p.id_pesanan = detail_pesanan.id_pesanan
      and p.id_user = auth.uid()
    )
  );

create policy "user lihat pembayaran sendiri" on public.pembayaran
  for select using (
    exists (
      select 1 from public.pesanan p
      where p.id_pesanan = pembayaran.id_pesanan
      and p.id_user = auth.uid()
    )
  );

-- =====================================================================
-- SEED DATA CONTOH (opsional, hapus/ubah sesuai kebutuhan)
-- =====================================================================
insert into public.kategori (nama_kategori) values
  ('Makanan Utama'),
  ('Appetizer'),
  ('Minuman')
on conflict do nothing;

insert into public.produk (id_kategori, nama_produk, harga, stok, status) values
  (1, 'Nasi Ayam Geprek', 18000, 25, 'Tersedia'),
  (1, 'Nasi Rendang', 22000, 15, 'Tersedia'),
  (2, 'Tahu Crispy', 8000, 30, 'Tersedia'),
  (2, 'Kerupuk', 3000, 50, 'Tersedia'),
  (3, 'Es Teh Manis', 5000, 40, 'Tersedia'),
  (3, 'Es Jeruk', 6000, 0, 'Habis')
on conflict do nothing;
