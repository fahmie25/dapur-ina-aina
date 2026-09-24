// Dapur Ina Aina — format otomatis untuk input berjenis "harga" (Rupiah).
// Dipakai dengan menambahkan class="input-rupiah" pada <input type="text">.
// Saat diketik: 1000 -> 1.000, 150000 -> 150.000, dst.
// Saat form dikirim: nilai dikembalikan ke angka polos (tanpa titik) supaya
// tidak mengubah cara server memproses data (Number(req.body.harga) dst).
(function () {
  function formatRibuan(angkaPolos) {
    if (!angkaPolos) return '';
    return Number(angkaPolos).toLocaleString('id-ID');
  }

  function pasang(input) {
    // Nilai awal (mis. saat form edit sudah terisi) ikut diformat
    if (input.value) {
      const angkaAwal = input.value.toString().replace(/\D/g, '');
      input.value = formatRibuan(angkaAwal);
    }

    input.addEventListener('input', () => {
      const posisiDariBelakang = input.value.length - input.selectionStart;
      const angkaPolos = input.value.replace(/\D/g, '');
      input.value = formatRibuan(angkaPolos);
      // Jaga posisi kursor tetap wajar setelah reformat
      const posisiBaru = Math.max(0, input.value.length - posisiDariBelakang);
      input.setSelectionRange(posisiBaru, posisiBaru);
    });

    // Sebelum form dikirim, lepas titik pemisah ribuan -> angka polos.
    const form = input.closest('form');
    if (form) {
      form.addEventListener('submit', () => {
        input.value = input.value.replace(/\D/g, '');
      });
    }
  }

  function init() {
    document.querySelectorAll('input.input-rupiah').forEach(pasang);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
