# SparkPOS — Modern Offline-First Retail POS (Desktop & Web)

Aplikasi Kasir (Point of Sale) modern, offline-first, dan super ringan dirancang khusus untuk minimarket, toko sembako, dan retail UMKM dengan target perangkat Windows (RAM 4GB) serta kenyamanan pengembangan di Linux.

---

## 🚀 Cara Menjalankan & Mereview di Linux

### 1. Mode Web (Review Cepat di Browser)
Server lokal saat ini sudah aktif di background:
```bash
cd sparkpos-app
npm run dev
```
Buka browser Anda di: **`http://localhost:5173`**

### 2. Mode Desktop Native Linux (Jendela Aplikasi)
Untuk menguji dalam bentuk jendela desktop native di Linux:
```bash
cd sparkpos-app
npm run tauri:dev
```

### 3. Build Distribusi Windows (.exe Installer)
Aplikasi ini menggunakan **Tauri v2 + WebView2**. Saat di-build untuk Windows, ukuran installer hanya ~12 MB dan konsumsi RAM saat berjalan hanya **~40–60 MB** (sangat aman dan lancar di PC toko kasir RAM 4GB).

---

## 📦 Fitur Lengkap yang Telah Diimplementasikan

### 1. System Management Stock Produk & Varian
* **Master Produk:** SKU, Barcode, Nama Produk, Kategori, Satuan (Pcs/Box/Btl), Harga Modal (HPP), Harga Jual Kasir, dan Margin Keuntungan (%).
* **Badge Peringatan Stok:**
  * 🟢 **Normal:** Stok di atas batas minimum.
  * 🟡 **Peringatan Restock:** Stok $\le$ `MinStock`.
  * 🔴 **Stok Habis:** Stok $= 0$.
* **Stock Opname (Penyesuaian Fisik):** Input jumlah barang nyata di toko vs sistem, hitung selisih otomatis, dan rekam alasan (Rusak, Expired, Selisih Kasir, Koreksi).
* **Kartu Mutasi Stok:** Audit log transparan untuk setiap transaksi penjualan kasir, restock, dan opname.

### 2. System POS Lengkap
* **Layout Kasir Modern:** Katalog produk visual sentuh layar + pencarian cepat + daftar keranjang belanja realtime.
* **Hold / Park Transaksi `[F4]`:** Tahan antrean pelanggan yang tertinggal dompet tanpa membatalkan belanjaan, dan buka kembali antrean lewat menu `[F6]`.
* **Diskon & Pajak:** Diskon per produk, diskon nota `[F8]` (persen / nominal), dan konfigurasi PPN 11% (inklusif/eksklusif).
* **Modal Pembayaran Lengkap `[F12]`:**
  * Tunai (Cash), QRIS Instant, Kartu Debit, Transfer Bank.
  * Tombol uang pas & nominal cepat (+10k, +20k, +50k, +100k, 50k, 100k, 200k).
  * Perhitungan uang kembalian otomatis & animasi selebrasi.
* **Shortcut Kasir:**
  * `F1`: Fokus Input Barcode / Cari Produk
  * `F3`: Menu Manajemen Stok & Master Produk
  * `F4`: Tahan / Parkir Transaksi Aktif
  * `F6`: Buka Daftar Antrean Parkir
  * `F7`: Riwayat Penjualan & Cetak Ulang Struk
  * `F8`: Diskon Total Nota
  * `F12`: Checkout & Bayar
  * `Esc`: Tutup Modal / Batal

### 3. System Kasir via Scan Barcode Cepat
* **Global Hardware Barcode Listener:** Menggunakan event listener global. Kasir tidak perlu repot mengklik kursor ke kotak teks input barcode.
* **Deteksi Scanner Fisik:** Mendeteksi keystroke berkecepatan tinggi (< 45ms per karakter) dari scanner USB/Bluetooth.
* **Auto-Increment:** Scan barang yang sama otomatis menambah kuantiti `+ 1`.
* **Synthesizer Beep Audio:** Suara beep konfirmasi kasir retail menggunakan Web Audio API tanpa perlu file asset suara eksternal.

### 4. Integrasi Printer Thermal & Cash Drawer
* **ESC/POS Monospace Engine:** Format struk presisi untuk ukuran **58mm (32 kolom)** dan **80mm (42 kolom)**.
* **Simulator Struk Fisik:** Tampilan kertas struk di layar sebelum dicetak.
* **Silent Thermal Print:** Menggunakan CSS `@media print` thermal khusus tanpa header/footer URL browser.
* **Perintah Cash Drawer:** Sinyal buka laci kasir otomatis (`0x1B 0x70`) dan potong kertas (`0x1D 0x56`).

### 5. Manajemen Shift & Rekonsiliasi Kas
* **Buka / Tutup Shift:** Catat modal awal laci kasir.
* **Rekonsiliasi Kasir:** Perhitungan otomatis uang tunai yang seharusnya ada di laci vs uang fisik riil, menampilkan selisih kas (Pas, Kas Lebih, atau Kas Minus).


## Catatan Rilis v2.6.3

**Perbaikan Akurasi Perhitungan Laporan Keuangan & Saldo Kas Laci (Zero Selisih)**
- **Koreksi Logika Kas Masuk & Kembalian**: Memperbaiki perhitungan penerimaan kas tunai (`cashSalesTotal`) dan ekspektasi kas laci kasir (`expectedCash`). Uang kembalian yang telah dikembalikan ke pelanggan tidak lagi dikurangkan ganda dari total belanja (`grandTotal`), sehingga nominal kas bersih masuk dari penjualan tunai tercatat 100% presisi senilai transaksi riil.
- **Keseimbangan Finansial Sempurna**: Total Penerimaan Kas Tunai + Transfer Bank kini selalu seimbang sempurna (sama persis) dengan Total Omset Toko, menghilangkan selisih semu pada kartu ringkasan finansial maupun ekspor Excel.
- **Sinkronisasi Otomatis Sesi Kasir (Self-Healing)**: Sesi shift aktif yang sebelumnya mengalami anomali selisih otomatis disinkronkan kembali secara akurat berdasarkan riwayat transaksi fisik, mengembalikan status kas laci menjadi seimbang (pas).

## Catatan Rilis v2.6.2

**Garansi Toko Khusus Laptop, Sparepart & Printer**
- Kartu garansi toko pada struk thermal kasir (58mm) maupun faktur resmi (A4) secara konsisten dan eksklusif hanya diberikan untuk barang kategori atau produk **Laptop, Sparepart, dan Printer/Print**.
- Barang kategori Aksesoris dan Jasa tidak lagi memicu kartu garansi toko.

**Validasi Wajib Formulir Terima Servis (Nama, Nomor HP & Tipe Perangkat)**
- Kolom yang wajib diisi pada saat menerima servis unit (`ServiceOrderModal`) disesuaikan secara ketat: **Nama Pelanggan**, **Nomor WhatsApp / HP**, dan **Tipe Perangkat**.
- Kolom keluhan kerusakan kini opsional (dapat dikosongkan dengan fallback pemeriksaan unit otomatis), sehingga pendaftaran servis lebih cepat dan praktis saat pelanggan terburu-buru.

## Catatan Rilis v2.6.1

**Integrasi Notifikasi WhatsApp Servis (Otomatis & Deteksi WA Web / Desktop App)**
- **Kirim Pesan WhatsApp Langsung**: Mengabari pelanggan secara langsung dari dashboard servis, nota cetak servis, maupun saat membuat/mengedit tiket servis.
- **Deteksi Cerdas WhatsApp**: Pilihan kirim otomatis (membuka WhatsApp dan mendeteksi aplikasi Desktop atau WhatsApp Web), WhatsApp Web langsung di peramban, aplikasi WhatsApp Desktop Windows, atau salin teks pesan ke clipboard.
- **Format Pesan Sopan & Terstruktur**: Template bahasa Indonesia yang ramah, sopan, dan profesional dengan No. Tiket/Nota, nama perangkat, keluhan, estimasi pengerjaan, rincian biaya & DP, garansi servis, dan alamat/kontak toko.
- **5 Template Lengkap**: Tanda Terima Servis Masuk, Konfirmasi Diagnosa & Estimasi Biaya, Servis Selesai & Siap Diambil, Pembatalan Servis, dan Konfirmasi Pengambilan Unit / Garansi Aktif.
- **Pratinjau & Edit Pesan**: Teks pesan dapat ditinjau dan diedit bebas sebelum dikirim dengan nomor HP otomatis terformat ke standar internasional (+62).

## Catatan Rilis v2.6.0

**Garansi & Manajemen Stok Fleksibel**
- Masa garansi produk di menu Stok kini dapat diatur secara fleksibel (pilihan hari/bulan atau input manual bebas), dengan default baru `Non-Garansi` (tidak lagi hardcoded 1 bulan).
- Produk non-garansi otomatis tidak memunculkan baris garansi pada struk dan nota kasir.

**Kartu Garansi Khusus Unit Laptop & Layout Struk Rapi**
- Kartu garansi pada struk kasir kini **khusus untuk pembelian unit laptop**. Pembelian printer, tinta, aksesoris, atau sparepart tidak memicu kartu garansi laptop.
- Teks nota yang panjang otomatis membungkus (text wrap) rapi sesuai lebar thermal 32 karakter dan tidak terpotong ke samping.
- Format cetak A4/thermal dioptimalkan untuk menghemat kertas (memotong kelebihan feed kertas kosong).

**Kategori Baru: Printer & Tinta**
- Menambahkan kategori master `Printer & Tinta` untuk printer, tinta botol, cartridge, toner, dan kertas dengan auto-migrasi database.

**Pembatalan Servis dengan Alasan & Bukti Nota**
- Pembatalan servis kini mencatat alasan detail (mis. dibatalkan pelanggan, sparepart kosong, motherboard rusak parah, dll).
- Tersedia cetak *Nota Pembatalan Servis* sebagai tanda terima serah-terima kembali unit ke pelanggan.

**Laporan Keuangan Sederhana & Bersih**
- Menghilangkan badge notasi singkatan (JT/Rb) agar laporan keuangan lebih bersih, tegas, dan mudah dibaca (menampilkan angka Rupiah lengkap).
- Ekspor kas harian disederhanakan: 1 transaksi penjualan = 1 baris kas masuk tanpa duplikasi baris item.
- Ekspor Excel otomatis menggabungkan banner judul toko (merge cells) dan memperlebar kolom agar nama toko panjang tidak terpotong.
- Riwayat transaksi kasir menampilkan rincian pembayaran tunai, kembalian yang dikeluarkan, dan kas bersih masuk secara transparan.

## Catatan Rilis v2.5.0

**Cetak otomatis tanpa dialog**
- Pengaturan > Printer Kasir: pilih printer thermal 58mm dan printer A4/F4 (terdeteksi otomatis dari Windows).
- Struk 58mm dikirim langsung sebagai ESC/POS ke printer pilihan (juga membuka laci uang untuk pembayaran tunai).
- Faktur A4/F4 dicetak senyap ke printer A4 pilihan (WebView2 `--kiosk-printing`; printer default Windows diganti sementara lalu dikembalikan).
- Tersedia tombol Uji Struk 58mm dan Uji Faktur A4.

**Keyboard** (tekan `F1` di aplikasi untuk daftar lengkap)
- `Ctrl+1..5` pindah menu, `F2`/`Ctrl+K`/`/` fokus ke Scan/Cari, `F12`/`Ctrl+Enter` bayar, `Esc` tutup/hapus pencarian.
- `Tab` kembali berpindah kolom seperti biasa; semua modal punya Esc, focus trap, dan mengembalikan fokus.
- Keranjang: `Ctrl+Up/Down` pilih baris, `+`/`-` ubah jumlah, `Delete` hapus.
- Shortcut kasir tidak aktif saat jendela/modal terbuka; `F5`/`Ctrl+R`/`Ctrl+P` diblokir agar keranjang tidak hilang.

**Laporan**
- Uang kas masuk/keluar kini tampil di Riwayat Transaksi (dapat dikoreksi/dihapus) dan tidak dihitung sebagai omset.
- Unduh Laporan: Kas Harian, Keuntungan, dan Pembelian dalam format buku toko (sheet per bulan, total/profit/rata-rata berupa rumus Excel).

**Tampilan**
- Semua modal dan halaman memakai pasangan warna terang/gelap yang konsisten.
