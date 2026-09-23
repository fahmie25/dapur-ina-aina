require('dotenv').config();
const midtransClient = require('midtrans-client');

const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';

// Snap dipakai untuk membuat transaksi (mendapatkan snap token) yang
// nantinya dipakai untuk menampilkan popup pembayaran Midtrans di
// halaman "Melakukan Pembayaran".
const snap = new midtransClient.Snap({
  isProduction,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

// CoreApi dipakai untuk cek status transaksi (dipanggil dari webhook
// notification handler agar status yang disimpan selalu tervalidasi).
const core = new midtransClient.CoreApi({
  isProduction,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

module.exports = { snap, core, isProduction };
