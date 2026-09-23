const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { requireRole } = require('../middleware/auth');

router.use(requireRole('admin'));

function pad(n) { return String(n).padStart(2, '0'); }
function toDateInputValue(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

// Hitung rentang tanggal (start-end) berdasarkan periode & titik acuan yang
// dipilih admin (tanggal untuk mingguan, bulan untuk bulanan, tahun untuk
// tahunan). Jika tidak dipilih, default ke periode berjalan saat ini.
function hitungRentang(periode, query) {
  const now = new Date();

  if (periode === 'mingguan') {
    const pivot = /^\d{4}-\d{2}-\d{2}$/.test(query.tanggal) ? new Date(`${query.tanggal}T00:00:00`) : now;
    const hari = pivot.getDay(); // 0 = Minggu ... 6 = Sabtu
    const selisihKeSenin = hari === 0 ? -6 : 1 - hari;
    const senin = new Date(pivot);
    senin.setDate(pivot.getDate() + selisihKeSenin);
    const minggu = new Date(senin);
    minggu.setDate(senin.getDate() + 6);

    return {
      start: startOfDay(senin),
      end: endOfDay(minggu),
      pivotValue: toDateInputValue(pivot),
      label: `${senin.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })} – ${minggu.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    };
  }

  if (periode === 'tahunan') {
    const tahun = /^\d{4}$/.test(query.tahun) ? Number(query.tahun) : now.getFullYear();
    const start = new Date(tahun, 0, 1);
    const end = new Date(tahun, 11, 31, 23, 59, 59, 999);
    return { start, end, pivotValue: String(tahun), label: `Tahun ${tahun}` };
  }

  // default: bulanan
  let tahun = now.getFullYear();
  let bulan = now.getMonth() + 1;
  if (/^\d{4}-\d{2}$/.test(query.bulan)) {
    [tahun, bulan] = query.bulan.split('-').map(Number);
  }
  const start = new Date(tahun, bulan - 1, 1);
  const end = new Date(tahun, bulan, 0, 23, 59, 59, 999); // tanggal 0 bulan berikutnya = akhir bulan ini
  return {
    start,
    end,
    pivotValue: `${tahun}-${pad(bulan)}`,
    label: start.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
  };
}

// GET /admin/laporan : "Buka menu laporan" -> "Tampilkan filter periode" -> "Ambil data transaksi"
router.get('/', async (req, res, next) => {
  try {
    const periode = ['mingguan', 'bulanan', 'tahunan'].includes(req.query.periode)
      ? req.query.periode
      : 'bulanan';
    const rentang = hitungRentang(periode, req.query);

    const { data: transaksiList, error } = await supabaseAdmin
      .from('pesanan')
      .select('id_pesanan, tanggal, total, status, nama_pelanggan, users(nama)')
      .gte('tanggal', rentang.start.toISOString())
      .lte('tanggal', rentang.end.toISOString())
      .in('status', ['Dibayar', 'Diproses', 'Selesai'])
      .order('tanggal', { ascending: false });
    if (error) throw error;

    // "Data ada?" -> ya: Tampilkan laporan | tidak: ganti periode
    const dataAda = transaksiList.length > 0;
    const totalPenjualan = transaksiList.reduce((sum, t) => sum + Number(t.total), 0);
    const jumlahTransaksi = transaksiList.length;

    res.render('admin/laporan', {
      title: 'Laporan Penjualan',
      periode,
      pivotValue: rentang.pivotValue,
      rentangLabel: rentang.label,
      transaksiList,
      dataAda,
      totalPenjualan,
      jumlahTransaksi,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
