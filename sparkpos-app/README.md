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
