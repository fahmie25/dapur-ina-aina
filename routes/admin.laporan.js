const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
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

// Ambil data transaksi untuk suatu periode. Dipakai bersama oleh halaman
// laporan (render HTML) dan endpoint export PDF, supaya keduanya selalu
// menampilkan angka yang identik.
async function ambilDataLaporan(req) {
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

  const dataAda = transaksiList.length > 0;
  const totalPenjualan = transaksiList.reduce((sum, t) => sum + Number(t.total), 0);
  const jumlahTransaksi = transaksiList.length;

  return { periode, rentang, transaksiList, dataAda, totalPenjualan, jumlahTransaksi };
}

// GET /admin/laporan : "Buka menu laporan" -> "Tampilkan filter periode" -> "Ambil data transaksi"
router.get('/', async (req, res, next) => {
  try {
    const { periode, rentang, transaksiList, dataAda, totalPenjualan, jumlahTransaksi } =
      await ambilDataLaporan(req);

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

// GET /admin/laporan/export-pdf : unduh laporan periode yang sedang dilihat sebagai PDF
router.get('/export-pdf', async (req, res, next) => {
  try {
    const { periode, rentang, transaksiList, totalPenjualan, jumlahTransaksi } =
      await ambilDataLaporan(req);

    const namaFile = `laporan-penjualan-${periode}-${toDateInputValue(new Date())}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${namaFile}"`);

    const doc = new PDFDocument({ size: 'A4', margin: 44 });
    doc.pipe(res);

    // ---------- Kop laporan ----------
    doc.fontSize(18).fillColor('#2F4B3C').text('Dapur Ina Aina', { continued: false });
    doc.fontSize(13).fillColor('#241C15').text('Laporan Penjualan');
    doc.fontSize(10).fillColor('#7C7060').text(`Periode: ${rentang.label}`);
    doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`);
    doc.moveDown(1);

    // ---------- Ringkasan ----------
    doc.fontSize(11).fillColor('#241C15');
    doc.text(`Total Penjualan  : Rp ${totalPenjualan.toLocaleString('id-ID')}`);
    doc.text(`Jumlah Transaksi : ${jumlahTransaksi}`);
    if (jumlahTransaksi > 0) {
      doc.text(`Rata-rata/Transaksi : Rp ${Math.round(totalPenjualan / jumlahTransaksi).toLocaleString('id-ID')}`);
    }
    doc.moveDown(1);

    if (transaksiList.length === 0) {
      doc.fontSize(11).fillColor('#7C7060').text('Tidak ada data transaksi pada periode ini.');
      doc.end();
      return;
    }

    // ---------- Tabel transaksi ----------
    const kolom = { no: 44, pelanggan: 110, tanggal: 280, total: 400, status: 480 };
    const lebarHalaman = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    function gambarHeaderTabel() {
      const y = doc.y;
      doc.fontSize(9).fillColor('#7C7060');
      doc.text('No.', kolom.no, y, { width: kolom.pelanggan - kolom.no - 6 });
      doc.text('Pelanggan', kolom.pelanggan, y, { width: kolom.tanggal - kolom.pelanggan - 6 });
      doc.text('Tanggal', kolom.tanggal, y, { width: kolom.total - kolom.tanggal - 6 });
      doc.text('Total', kolom.total, y, { width: kolom.status - kolom.total - 6 });
      doc.text('Status', kolom.status, y, { width: doc.page.margins.left + lebarHalaman - kolom.status });
      doc.moveDown(0.4);
      doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + lebarHalaman, doc.y).strokeColor('#E4D9C3').stroke();
      doc.moveDown(0.4);
    }

    gambarHeaderTabel();

    transaksiList.forEach((t) => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 40) {
        doc.addPage();
        gambarHeaderTabel();
      }
      const y = doc.y;
      doc.fontSize(9).fillColor('#241C15');
      doc.text(`#${t.id_pesanan}`, kolom.no, y, { width: kolom.pelanggan - kolom.no - 6 });
      doc.text(t.nama_pelanggan || t.users?.nama || '-', kolom.pelanggan, y, { width: kolom.tanggal - kolom.pelanggan - 6 });
      doc.text(new Date(t.tanggal).toLocaleDateString('id-ID'), kolom.tanggal, y, { width: kolom.total - kolom.tanggal - 6 });
      doc.text(`Rp ${Number(t.total).toLocaleString('id-ID')}`, kolom.total, y, { width: kolom.status - kolom.total - 6 });
      doc.text(t.status, kolom.status, y, { width: doc.page.margins.left + lebarHalaman - kolom.status });
      doc.moveDown(0.6);
    });

    doc.end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
