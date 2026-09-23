const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { snap, core } = require('../config/midtrans');

function ownsGuestOrder(req, idPesanan) {
  const ids = req.session.guestOrders || [];
  return ids.includes(Number(idPesanan));
}

async function getPesananLengkap(idPesanan) {
  const { data: pesanan, error } = await supabaseAdmin
    .from('pesanan')
    .select('*, detail_pesanan(*, produk(nama_produk)), pembayaran(*)')
    .eq('id_pesanan', idPesanan)
    .single();
  if (error) return null;
  return pesanan;
}

// ---------- GET /payment/:id ----------
router.get('/payment/:id', async (req, res, next) => {
  try {
    if (!ownsGuestOrder(req, req.params.id)) {
      req.flash('error', 'Pesanan tidak ditemukan pada sesi pelanggan ini.');
      return res.redirect('/menu');
    }

    const pesanan = await getPesananLengkap(req.params.id);
    if (!pesanan) {
      req.flash('error', 'Pesanan tidak ditemukan.');
      return res.redirect('/menu');
    }
    const pembayaran = pesanan.pembayaran?.[0] || null;

    if (pembayaran?.status === 'Berhasil') {
      return res.redirect(`/order/success/${pesanan.id_pesanan}`);
    }

    res.render('payment', {
      title: 'Pembayaran',
      pesanan,
      pembayaran,
      midtransClientKey: process.env.MIDTRANS_CLIENT_KEY,
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    });
  } catch (err) {
    next(err);
  }
});

// ---------- POST /payment/:id/tunai ----------
router.post('/payment/:id/tunai', async (req, res, next) => {
  try {
    if (!ownsGuestOrder(req, req.params.id)) return res.redirect('/menu');
    const pesanan = await getPesananLengkap(req.params.id);
    if (!pesanan) return res.redirect('/menu');

    const jumlahBayar = Number(req.body.jumlah_bayar || 0);
    if (jumlahBayar < Number(pesanan.total)) {
      req.flash('error', 'Jumlah bayar kurang dari total tagihan.');
      return res.redirect(`/payment/${pesanan.id_pesanan}`);
    }

    const kembalian = jumlahBayar - Number(pesanan.total);
    const { error } = await supabaseAdmin
      .from('pembayaran')
      .update({
        metode: 'Tunai',
        jumlah_bayar: jumlahBayar,
        kembalian,
        tanggal_bayar: new Date().toISOString(),
        status: 'Pending',
      })
      .eq('id_pesanan', pesanan.id_pesanan);
    if (error) throw error;

    req.flash('success', 'Pembayaran tunai dicatat. Silakan bayar ke kasir.');
    res.redirect(`/order/success/${pesanan.id_pesanan}`);
  } catch (err) {
    next(err);
  }
});

// ---------- POST /payment/:id/online : Midtrans ----------
router.post('/payment/:id/online', async (req, res) => {
  try {
    if (!ownsGuestOrder(req, req.params.id)) return res.status(403).json({ error: 'Pesanan tidak ditemukan.' });
    const pesanan = await getPesananLengkap(req.params.id);
    if (!pesanan) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });

    const midtransOrderId = `ORDER-${pesanan.id_pesanan}-${Date.now()}`;
    const parameter = {
      transaction_details: {
        order_id: midtransOrderId,
        gross_amount: Math.round(Number(pesanan.total)),
      },
      item_details: pesanan.detail_pesanan.map((d) => ({
        id: String(d.id_produk),
        price: Math.round(Number(d.harga)),
        quantity: d.jumlah,
        name: (d.produk?.nama_produk || 'Produk').slice(0, 50),
      })),
      customer_details: {
        first_name: pesanan.nama_pelanggan || 'Pelanggan',
        phone: pesanan.no_telp || undefined,
      },
      callbacks: {
        finish: `${process.env.APP_BASE_URL}/order/success/${pesanan.id_pesanan}`,
      },
    };

    const transaction = await snap.createTransaction(parameter);

    const { error } = await supabaseAdmin
      .from('pembayaran')
      .update({ midtrans_order_id: midtransOrderId, snap_token: transaction.token, status: 'Pending' })
      .eq('id_pesanan', pesanan.id_pesanan);
    if (error) throw error;

    res.json({ snap_token: transaction.token, redirect_url: transaction.redirect_url });
  } catch (err) {
    console.error('[midtrans] gagal membuat transaksi:', err.message);
    res.status(500).json({ error: 'Gagal membuat transaksi pembayaran. Periksa konfigurasi Midtrans.' });
  }
});

// ---------- POST /payment/notification : webhook Midtrans ----------
router.post('/payment/notification', async (req, res) => {
  try {
    const statusResponse = await core.transaction.notification(req.body);
    const { order_id: midtransOrderId, transaction_status, fraud_status, payment_type } = statusResponse;

    const metodeMap = {
      credit_card: 'Kartu',
      bank_transfer: 'Transfer',
      echannel: 'Transfer',
      permata_va: 'Transfer',
      gopro: 'E-Wallet',
      gopay: 'E-Wallet',
      shopeepay: 'E-Wallet',
      qris: 'QRIS',
    };
    const metodeBaru = metodeMap[payment_type] || 'Transfer';

    let statusBaru = 'Pending';
    if (transaction_status === 'capture') statusBaru = fraud_status === 'accept' ? 'Berhasil' : 'Pending';
    else if (transaction_status === 'settlement') statusBaru = 'Berhasil';
    else if (['cancel', 'deny', 'expire'].includes(transaction_status)) statusBaru = transaction_status === 'expire' ? 'Kadaluarsa' : 'Gagal';

    const { data: pembayaran } = await supabaseAdmin
      .from('pembayaran')
      .select('id_pembayaran, id_pesanan, jumlah_bayar')
      .eq('midtrans_order_id', midtransOrderId)
      .single();

    if (pembayaran) {
      await supabaseAdmin
        .from('pembayaran')
        .update({
          metode: metodeBaru,
          status: statusBaru,
          tanggal_bayar: statusBaru === 'Berhasil' ? new Date().toISOString() : null,
          jumlah_bayar: statusBaru === 'Berhasil' ? Number(statusResponse.gross_amount) : pembayaran.jumlah_bayar,
        })
        .eq('id_pembayaran', pembayaran.id_pembayaran);

      if (statusBaru === 'Berhasil') {
        await supabaseAdmin.from('pesanan').update({ status: 'Dibayar' }).eq('id_pesanan', pembayaran.id_pesanan);
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('[midtrans webhook] error:', err.message);
    res.status(500).send('Error processing notification');
  }
});

// ---------- GET /order/success/:id ----------
router.get('/order/success/:id', async (req, res, next) => {
  try {
    if (!ownsGuestOrder(req, req.params.id)) {
      req.flash('error', 'Pesanan tidak ditemukan pada sesi pelanggan ini.');
      return res.redirect('/menu');
    }
    const pesanan = await getPesananLengkap(req.params.id);
    if (!pesanan) return res.redirect('/menu');
    res.render('order-success', { title: 'Struk Pesanan', pesanan, pembayaran: pesanan.pembayaran?.[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
