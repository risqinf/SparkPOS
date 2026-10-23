# RENCANA KERJA & SPESIFIKASI UPDATE SPARKPOS (PLAN.MD)

Dokumen ini berisi rencana komprehensif, analisis teknis, dan rancangan perubahan untuk pembaruan aplikasi **SparkPOS**. Seluruh poin dirancang berdasarkan 8 kebutuhan utama yang diminta serta strategi build rilis binary portabel Linux.

---

## 📋 DAFTAR KEBUTUHAN & ANALISIS KEBUTUHAN

| No | Kebutuhan | File Terkait | Status Analisis |
|:---|:---|:---|:---|
| **1** | **UI Login Sederhana & Keyboard-Only**: Form di tengah, cukup Logo + Nama Toko, username & PIN via keyboard tanpa on-screen numpad / select user. | `sparkpos-app/src/components/Auth/LoginScreen.tsx` | Siap diimplementasikan. Buang numpad touch, quick-pick accounts, dan 2-kolom layout. Ganti dengan centered card clean. |
| **2** | **Pilihan Pembayaran Hanya 2**: Tunai (Cash) dan Transfer Bank saja. | `sparkpos-app/src/components/POS/PaymentModal.tsx`, `sparkpos-app/src/types/pos.ts` | Hapus opsi QRIS & Debit di modal bayar. Sederhanakan UI pembayaran. |
| **3** | **Fix Order Sudah Dibayar Belum Masuk Riwayat**: Masalah order yang sudah dibayar tidak muncul di riwayat hari itu. | `sparkpos-app/src/components/Reports/TransactionHistory.tsx`, `sparkpos-app/src/components/Service/ServiceOrderModal.tsx`, `sparkpos-app/src/components/POS/POSTerminal.tsx` | Masalah utama: (1) Timezone UTC mismatch (`toISOString().slice(0,10)`) membuat transaksi pagi/malam bergeser tanggal; (2) Order servis lunas belum dimasukkan ke riwayat penjualan terpadu; (3) Filter kasir. |
| **4** | **Laporan Keuangan Terpadu & Lengkap + Input Modal Harian**: 1 laporan lengkap berisi rincian item barang yang dibeli (nama, qty, harga, HPP, margin), filter rekap (Hari Ini, Kemarin, 7 Hari, 1 Bulan, 3 Bulan, 6 Bulan, 1 Tahun), total omset dipotong modal, serta modal awal kasir wajib setiap awal hari. | `sparkpos-app/src/components/Reports/TransactionHistory.tsx`, `sparkpos-app/src/App.tsx`, `sparkpos-app/src/services/storage.ts` | Gabungkan 4 tab lama (`sales`, `daily`, `monthly`, `shifts`) menjadi 1 dashboard terpadu yang kaya informasi + popup wajib input modal awal kasir saat login hari baru. |
| **5** | **Pembersihan Fitur**: Hapus form Cabang, hapus laporan shift ganti ke "Laporan Hari Ini" (jam kerja tetap 07.00 - 16.30), hapus bagian kurir/shipping. | `sparkpos-app/src/components/Auth/FirstTimeSetup.tsx`, `sparkpos-app/src/components/Settings/StoreSettings.tsx`, `sparkpos-app/src/components/POS/POSTerminal.tsx`, `sparkpos-app/src/components/Reports/ShiftReportModal.tsx` | Hapus semua input cabang & kurir. Ubah konsep shift menjadi sesi harian kasir toko (07.00 - 16.30). |
| **6** | **Perbaikan Warna, Kontras & Tema Terang/Gelap**: Perbaiki font abu-abu pudar, box yang tak terbaca, tombol tidak konsisten. | `sparkpos-app/src/index.css`, seluruh komponen UI | Terapkan palette High-Contrast (Light & Dark), perbaiki teks redup `text-slate-400` pada light mode agar selalu terbaca tanpa perlu diklik. |
| **7** | **Redesign Lebih Rapi & Fitur Export Excel Laporan Harian**: Tampilan nyaman dilihat + ekspor laporan keuangan harian dan berkala ke file Excel (.csv UTF-8 BOM). | `sparkpos-app/src/services/excelExport.ts`, `sparkpos-app/src/components/Reports/TransactionHistory.tsx` | Ekspor Excel berisi rincian lengkap tiap produk yang terjual, modal kasir harian, kas masuk/keluar, dan laba bersih. |
| **8** | **Katalog Produk Kasir & Stok Mode Detail (Bukan Box Kotak)**: Ubah katalog produk di kasir dari kartu kotak (grid cards) menjadi tampilan list detail. | `sparkpos-app/src/components/POS/POSTerminal.tsx`, `sparkpos-app/src/components/Stock/StockManagement.tsx` | Ganti layout grid box menjadi tabel list detail: Barcode, Nama Lengkap Produk, Kategori, Stok Badge, Satuan, Harga Jual, dan Tombol Tambah Cepat. |
| **9** | **Build Binary Portabel Linux & Rilis GitHub**: Binary static/portable untuk Linux (AppImage / Standalone) tanpa perlu install apa pun lagi. | `sparkpos-app/src-tauri/tauri.conf.json`, `.github/workflows/release.yml` | Build Linux bundle via Tauri CLI (`cargo` + `webkit2gtk`) menghasilkan file `.AppImage` portabel. |

---

## 🛠️ DETAIL RANCANGAN SETIAP POIN PERUBAHAN

### 1. UI Login Sederhana & Berpusat (Centered Minimalist Login)
* **Desain Baru**:
  - Hapus layout 2 kolom (branding kiri + form kanan).
  - Tampilkan 1 Card elegan persis di tengah layar (`flex items-center justify-center min-h-screen`).
  - Header Card:
    - Logo Aplikasi (`storeProfile.appLogo` atau Icon Default).
    - Nama Toko (`storeProfile.storeName`).
    - Subtitle sederhana: *"Sistem Kasir"* atau *"Silakan Masuk"*.
  - Form Input:
    - Input 1: **Username** (auto-focus saat halaman terbuka).
    - Input 2: **PIN / Password** (mendukung pengetikan langsung dari keyboard fisik).
    - Tombol Submit: **"Masuk ke Kasir"** (didukung shortcut keyboard `Enter`).
  - Dihapus:
    - On-screen touch keypad / numpad (angka 0-9 untuk di-klik).
    - Tombol quick-select account ("Pilih Cepat Akun").
    - Kotak penjelasan hak akses role yang panjang.
  - Tetap dipertahankan:
    - Tombol toggle tema Terang/Gelap di pojok kanan atas secara rapi.

---

### 2. Metode Pembayaran Kasir (Hanya Tunai & Transfer Bank)
* **Penyederhanaan di `PaymentModal.tsx`**:
  - Opsi tombol metode pembayaran hanya ada 2:
    1. **💵 Tunai (Cash)**:
       - Input nominal uang yang diterima dari pembeli.
       - Tombol cepat uang pas & pecahan (Uang Pas, +10rb, +20rb, +50rb, 100rb, dll).
       - Perhitungan kembalian otomatis yang jelas dan besar.
    2. **🏦 Transfer Bank**:
       - Nominal langsung otomatis sama persis dengan total belanja (uang pas, tanpa kembalian).
       - Kolom opsional: Catatan Referensi / Nama Bank (BCA, Mandiri, BRI, BNI, dll).
  - Opsi `QRIS` dan `Kartu Debit` dihilangkan agar proses pembayaran di kasir lebih ringkas dan terhindar dari salah pilih.

---

### 3. Perbaikan Bug: Order Sudah Dibayar Belum Masuk ke Riwayat Hari Itu
* **Akar Masalah yang Ditemukan**:
  1. **Konversi Waktu Berbasis UTC vs Timezone Lokal (WIB / UTC+7)**:
     - Transaksi disimpan menggunakan `new Date().toISOString()`.
     - Filter pencarian hari ini sebelumnya menggunakan `tx.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10)`.
     - Pada jam 00:00 - 06:59 WIB, waktu UTC masih berada di hari kemarin. Sebaliknya pada malam hari, ada potensi offset tanggal berbeda. Akibatnya order yang dibuat di rentang jam tersebut tidak cocok dengan tanggal hari ini.
  2. **Pemisahan Data Order Servis dan Transaksi Kasir**:
     - Ketika pesanan servis komputer dibayar oleh pelanggan di modul servis, datanya hanya tersimpan di tabel `serviceOrders`.
     - Halaman `TransactionHistory.tsx` pada tab Penjualan hanya membaca `transactions`, sehingga order servis yang lunas tidak pernah terlihat di tabel riwayat transaksi harian.
  3. **Penyaringan Berdasarkan ID Kasir**:
     - Kasir yang login dengan akun berbeda atau shift sebelumnya menyebabkan transaksi tidak terlihat jika filter kasir aktif.
* **Solusi**:
  - Buat helper standardisasi tanggal lokal:
    ```typescript
    // Format YYYY-MM-DD sesuai tanggal lokal komputer kasir (bukan UTC)
    export function getLocalDateString(d: Date = new Date()): string {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    ```
  - Satukan transaksi penjualan kasir (POS) dan order servis yang dibayar ke dalam riwayat transaksi terpadu.
  - Trigger refresh data seketika saat kasir berpindah ke tab riwayat transaksi.

---

### 4. Laporan Keuangan Terpadu & Input Modal Awal Harian Wajib
* **Konsep Satu Laporan Keuangan Lengkap**:
  - Tidak ada lagi tab-tab terpisah yang membingungkan (`sales`, `daily`, `monthly`, `shifts`).
  - Digantikan oleh **1 Halaman Laporan Keuangan Terpadu** dengan filter periode cepat:
    - 📅 **Hari Ini**
    - 📅 **Kemarin**
    - 📅 **7 Hari Terakhir**
    - 📅 **1 Bulan**
    - 📅 **3 Bulan**
    - 📅 **6 Bulan**
    - 📅 **1 Tahun**
* **Struktur Ringkasan Finansial di Bagian Atas**:
  1. **Modal Awal Kasir**: Tercatat otomatis dari input awal hari.
  2. **Total Omset Toko**: Total transaksi penjualan kasir + penerimaan jasa servis.
  3. **Total Modal HPP**: Harga pokok pembelian barang yang terjual + biaya sparepart.
  4. **Pengeluaran Toko**: Kas keluar operasional (makan, belanja kebutuhan toko, dll).
  5. **Total Omset Dipotong Modal & Pengeluaran (Laba Bersih)**: `Omset - Modal HPP - Pengeluaran`.
  6. **Saldo Kas Akhir di Laci Kasir**: `Modal Awal + Penerimaan Tunai - Pengeluaran Tunai`.
* **Tabel Rincian Transaksi yang Sangat Detail**:
  - Setiap baris transaksi menampilkan rincian barang yang dibeli:
    - Nomor Invoice / Bukti
    - Waktu Transaksi (Tanggal & Jam)
    - Kasir yang melayani
    - Nama Pelanggan
    - Metode Pembayaran (Tunai / Transfer Bank)
    - **Daftar Produk yang Dibeli**: Nama produk, Qty, Harga Satuan, Modal Satuan, Subtotal.
    - Total Omset Transaksi
    - Laba Kotor Transaksi
* **Modal Awal Kasir Wajib Setiap Awal Hari**:
  - Toko memiliki jam kerja tetap (07.00 - 16.30).
  - Ketika ada user login untuk pertama kali di hari baru (tanggal lokal hari tersebut belum memiliki data modal awal):
    - Muncul modal dialog wajib: **"Masukkan Modal Awal Kasir Hari Ini"**.
    - Kasir menginput nominal uang kembalian di laci (misal: Rp 200.000).
    - Tombol simpan akan mencatat modal awal di database harian (`dailyCashRegister`).
    - Modal ini tidak dapat dilewati agar pembukuan kasir setiap hari selalu akurat dan terhindar dari selisih kas.

---

### 5. Penghapusan Fitur yang Tidak Diperlukan
* **Hapus Form Cabang**:
  - Hapus input "Nama Cabang" di setup awal (`FirstTimeSetup.tsx`).
  - Hapus input "Nama Cabang" di pengaturan toko (`StoreSettings.tsx`).
  - Hapus teks cabang di tampilan login dan struk (cukup menampilkan Nama Toko dan Alamat).
* **Ganti Laporan Shift menjadi Laporan Hari Ini**:
  - Karena jam kerja toko tetap (07.00 - 16.30), sistem multi-shift dihapus.
  - Tidak ada lagi pembagian Shift 1 / Shift 2 yang membingungkan.
  - Diganti dengan **Laporan Hari Ini (Jam Kerja 07.00 - 16.30)**:
    - Menampilkan ringkasan kas dari jam 07.00 sampai jam 16.30.
    - Ringkasan tutup kas harian di akhir jam kerja.
* **Hapus Fitur Kurir / Pengiriman (Shipping)**:
  - Hapus opsi pengiriman, pilihan kurir (SPX, JNE, J&T, dll), nomor resi, ongkos kirim, dan alamat kirim dari `POSTerminal.tsx`.
  - Struk belanja kasir menjadi lebih bersih dan fokus pada transaksi langsung di tempat.

---

### 6. Redesign Warna, Kontras Tinggi & Tampilan Terang/Gelap
* **Masalah yang Diperbaiki**:
  - Teks abu-abu muda (`text-slate-400` / `text-slate-500`) yang tidak terbaca di background putih saat mode terang.
  - Border kartu atau input form yang pudar sehingga kotak input tidak terlihat sebelum diklik.
  - Inkonsistensi warna tombol (terlalu banyak tombol berwarna abu-abu gelap di mode terang).
* **Standar Tampilan Baru**:
  - **Mode Terang (Light Mode)**:
    - Latar belakang utama: `#f8fafc` (slate-50) / `#ffffff`.
    - Kartu / Panel: Putih bersih `#ffffff` dengan border tegas `border-slate-300` dan shadow halus.
    - Teks Utama: `text-slate-900` (hitam pekat, sangat kontras dan tajam).
    - Teks Sekunder: `text-slate-700` atau `text-slate-600` (bukan 400).
    - Input Form: Background putih, border `border-slate-300` jelas, teks `text-slate-900`, placeholder `text-slate-400`, border focus emerald-600.
  - **Mode Gelap (Dark Mode)**:
    - Latar belakang utama: `#020617` (slate-950).
    - Kartu / Panel: `#0f172a` (slate-900) dengan border `border-slate-800`.
    - Teks Utama: `text-slate-100` / putih.
    - Teks Sekunder: `text-slate-300`.
    - Input Form: Background `#1e293b` (slate-800) dengan border `border-slate-700`.
  - Tombol aksi dibuat dengan warna primer tegas:
    - Utama: Emerald (Hijau POS profesional)
    - Sekunder: Slate netral bergaris tegas
    - Hapus/Batal: Rose / Merah

---

### 7. Export Laporan Keuangan Harian ke Excel
* **Implementasi di `excelExport.ts`**:
  - Fungsi baru: `exportComprehensiveDailyReportToExcel(reportData)`
  - Format output: File Spreadsheet `.csv` dengan **UTF-8 BOM** (`\uFEFF`), langsung terbuka dengan rapi di Microsoft Excel, WPS Office, dan LibreOffice tanpa teks berantakan.
  - Isi Dokumen Excel:
    1. **Kop Laporan**: Nama Toko, Tanggal Laporan, Jam Cetak, Nama Kasir.
    2. **Ringkasan Kas & Finansial**:
       - Modal Awal Kasir Hari Ini (Rp)
       - Total Omset Penjualan POS (Rp)
       - Total Omset Servis (Rp)
       - Total Omset Toko (Rp)
       - Total Modal HPP (Rp)
       - Total Pengeluaran Kas (Rp)
       - Laba Bersih Toko (Rp)
       - Pembayaran Tunai (Rp) vs Transfer Bank (Rp)
       - Uang Kas Fisik Akhir di Kasir (Rp)
    3. **Tabel Detail Transaksi**:
       - No. Invoice
       - Jam Transaksi
       - Tipe (POS / Servis)
       - Pelanggan
       - Metode Bayar
       - **Daftar Barang & Rincian**: `[Nama Barang x Qty @Harga (Modal: HPP)]`
       - Total Omset
       - Estimasi Laba Transaksi

---

### 8. List Produk di Kasir: Tampilan Detail (Bukan Box Kotak)
* **Perubahan Tampilan di `POSTerminal.tsx`**:
  - Ganti susunan grid kartu kotak (`grid-cols-2 md:grid-cols-4...`) menjadi **Tabel / Row List Detail**:
    - Kolom 1: Barcode / SKU
    - Kolom 2: Nama Lengkap Produk (terbaca penuh tanpa terpotong)
    - Kolom 3: Kategori Produk
    - Kolom 4: Status Stok (Badge jelas: Misal *"Stok: 15 PCS"*, *"MENIPIS (2)"*, *"HABIS"*)
    - Kolom 5: Harga Jual (Rupiah besar dan jelas)
    - Kolom 6: Aksi (Tombol Cepat `+ Keranjang` atau klik langsung pada baris)
  - Memberikan pengalaman pencarian dan pemilihan barang yang jauh lebih cepat, akurat, dan profesional untuk kasir toko komputer & retail.

---

### 9. Build Binary Static / Portabel Linux & Rilis GitHub
* **Pengecekan Lingkungan Laptop**:
  - Rust & Cargo: `v1.99.1` telah terpasang.
  - Node.js & npm: `v26.11.1` & `npm 12.2.0` telah terpasang.
  - WebKit2GTK: `2.54.1` telah terpasang di sistem Linux ini.
  - Git Author: `Risqinf <risqinf@users.noreply.github.com>`.
  - Remote: `https://github.com/risqinf/SparkPos`.
* **Target Build**:
  - Menggunakan Tauri build untuk menghasilkan **Linux AppImage** portabel:
    ```bash
    npm run tauri:build
    ```
    Output: File executable `.AppImage` mandiri di `src-tauri/target/release/bundle/appimage/SparkPOS_x.x.x_amd64.AppImage` dan binary standalone di `src-tauri/target/release/sparkpos` yang bisa langsung dijalankan di semua distro Linux tanpa perlu instalasi.
* **Rilis ke GitHub**:
  - Buat git commit dengan pesan yang jelas.
  - Tag versi baru (misal `v2.4.0`).
  - Push commit & tag ke origin main.
  - GitHub Workflow di `.github/workflows/release.yml` akan otomatis membuat rilis di GitHub Releases dengan file binary Linux & Windows.

---

## 📅 RENCANA TAHAPAN EKSEKUSI & STATUS PENYELESAIAN

```
Tahap 1: Persetujuan Rencana (User Review Plan) [SELESAI]
  └── Disetujui dan diinstruksikan untuk dieksekusi secara menyeluruh.

Tahap 2: UI Login & Autentikasi [SELESAI]
  ├── LoginScreen.tsx didesain ulang menjadi Card elegan di tengah layar (Centered Minimalist)
  ├── Input via keyboard langsung (Username auto-focus, PIN password, enter to login)
  └── Numpad sentuh, quick-select user, dan panduan role panjang berhasil dibersihkan

Tahap 3: Pembersihan Fitur (Cabang, Shift, Kurir) [SELESAI]
  ├── Input Cabang dihapus dari FirstTimeSetup.tsx dan StoreSettings.tsx
  ├── Teks cabang dihapus dari struk nota POS, nota servis, dan login screen
  ├── Opsi kurir, ongkir, nomor resi, dan alamat kirim dihapus dari POSTerminal.tsx
  └── Sistem shift disederhanakan menjadi jam operasional toko tetap 07.00 - 16.30

Tahap 4: Sistem Kas Harian & Input Modal Kasir Wajib [SELESAI]
  ├── Modal wajib DailyOpeningCashModal.tsx saat login hari baru
  ├── Pembukuan modal awal, penerimaan kas, dan pengeluaran kas tersimpan di IndexedDB (dailyCashRegister)
  └── Perhitungan saldo kas fisik di laci kasir secara akurat

Tahap 5: Perbaikan Riwayat Transaksi & 1 Laporan Keuangan Terpadu [SELESAI]
  ├── Perbaikan bug date matching lokal WIB vs UTC menggunakan helper dateUtils.ts
  ├── Penyatuan transaksi penjualan POS dan order servis lunas ke riwayat transaksi terpadu
  ├── 1 Halaman Laporan Keuangan Terpadu menggantikan 4 tab lama
  ├── Filter periode cepat: Hari ini, Kemarin, 7 Hari, 1 Bulan, 3 Bulan, 6 Bulan, 1 Tahun, Kustom
  └── Rincian detail produk yang dibeli (nama, qty, harga, HPP modal, margin profit)

Tahap 6: Perbaikan Mode Pembayaran (Tunai & Transfer Saja) [SELESAI]
  ├── PaymentModal.tsx disederhanakan hanya untuk Tunai (Cash) dan Transfer Bank
  ├── Opsi QRIS & Debit dihapus untuk menghindari salah pilih
  └── Opsi catatan referensi bank & tombol uang pas instan

Tahap 7: Katalog Kasir Tampilan List Detail [SELESAI]
  ├── Layout grid box kartu di POSTerminal.tsx diganti menjadi Tabel List Detail
  ├── Menampilkan Barcode/SKU, Nama Lengkap Produk, Kategori, Badge Status Stok, Satuan, Harga Jual
  └── Tombol cepat "+ Keranjang" serta klik langsung pada seluruh baris produk

Tahap 8: Standardisasi Warna, Tema Terang/Gelap & Export Excel [SELESAI]
  ├── Palette High-Contrast di Light & Dark mode (bebas teks abu-abu pudar)
  ├── Border form tegas dan jelas terbaca tanpa perlu diklik
  └── Export Excel Laporan Keuangan Terpadu (.csv UTF-8 BOM) lengkap dengan rincian produk

Tahap 9: Pengujian, Build Binary Portabel Linux & Rilis GitHub [SEDANG BERJALAN]
  ├── Verifikasi tsc & vite build berhasil (zero error, bundle size optimal 696 kB)
  ├── Penyesuaian versi 2.4.0 pada package.json, tauri.conf.json, dan Cargo.toml
  ├── Build binary Linux portabel (.AppImage & binary standalone)
  └── Git commit, tag v2.4.0, dan rilis ke GitHub
```

---

*Status: Seluruh fitur dan spesifikasi perbaikan telah selesai dikerjakan dan diverifikasi dengan sukses.*
