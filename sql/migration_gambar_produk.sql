-- Jalankan di SQL Editor Supabase (kalau tabel produk Anda dibuat SEBELUM
-- migration ini) untuk menambahkan dukungan foto produk lewat link URL.

alter table public.produk add column if not exists gambar_url text;
