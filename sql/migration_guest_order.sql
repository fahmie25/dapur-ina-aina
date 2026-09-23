-- Jalankan jika database lama sudah pernah dibuat sebelum mode pelanggan tanpa login.
-- Pesanan pelanggan sekarang tidak membutuhkan akun.

alter table public.pesanan drop constraint if exists pesanan_id_user_fkey;
alter table public.pesanan alter column id_user drop not null;
alter table public.pesanan add constraint pesanan_id_user_fkey foreign key (id_user) references public.users(id_user) on delete set null;

alter table public.pesanan add column if not exists nama_pelanggan varchar(50);
alter table public.pesanan add column if not exists no_telp varchar(20);

-- Data lama yang sudah memiliki user tetap dapat ditampilkan.
update public.pesanan
set nama_pelanggan = coalesce(nama_pelanggan, 'Pelanggan Lama'),
    no_telp = coalesce(no_telp, '-')
where nama_pelanggan is null or no_telp is null;

alter table public.pesanan alter column nama_pelanggan set not null;
alter table public.pesanan alter column no_telp set not null;
