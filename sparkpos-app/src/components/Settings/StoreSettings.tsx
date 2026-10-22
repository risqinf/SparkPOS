import React, { useState, useRef } from 'react';
import {
  Settings,
  Store,
  Printer,
  DollarSign,
  Save,
  RotateCcw,
  CheckCircle2,
  Image,
  Upload,
  Trash2,
  Sparkles,
  ShieldCheck,
  Lock,
  Database,
  HardDrive,
  DownloadCloud,
  UploadCloud,
  AlertTriangle,
  X,
  FileText,
} from 'lucide-react';
import { StoreProfile, Employee } from '../../types/pos';
import { updateStoreProfile, db } from '../../services/storage';
import { printReceiptSilent } from '../../services/printer';
import {
  saveDatabaseToFile,
  importDatabaseFromJson,
  resetDatabase,
} from '../../services/databaseBackup';

interface StoreSettingsProps {
  storeProfile: StoreProfile;
  onUpdateProfile: (profile: StoreProfile) => void;
  currentUser?: Employee | null;
  onRequestAdminAccess?: () => void;
}

export const StoreSettings: React.FC<StoreSettingsProps> = ({
  storeProfile,
  onUpdateProfile,
  currentUser,
  onRequestAdminAccess,
}) => {
  const [profile, setProfile] = useState<StoreProfile>({ ...storeProfile });
  const [isSaved, setIsSaved] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);

  // State untuk Modal Uninstall & Hapus Total
  const [isUninstallModalOpen, setIsUninstallModalOpen] = useState(false);
  const [uninstallWipeMode, setUninstallWipeMode] = useState<'backup_first' | 'wipe_only'>('backup_first');
  const [uninstallReason, setUninstallReason] = useState('Pindah ke komputer / kasir baru');
  const [customReason, setCustomReason] = useState('');
  const [confirmWipeText, setConfirmWipeText] = useState('');
  const [isWiping, setIsWiping] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Mohon pilih file gambar (PNG, JPG, SVG, WebP)');
      return;
    }

    if (file.size > 1.5 * 1024 * 1024) {
      alert('Ukuran file logo maksimal 1.5 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setProfile((prev) => ({ ...prev, appLogo: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    if (!isAdmin) return;
    setProfile((prev) => ({ ...prev, appLogo: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Hanya Administrator yang berwenang menyimpan perubahan pengaturan.');
      return;
    }
    await updateStoreProfile(profile);
    onUpdateProfile(profile);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleTestPrint = () => {
    const dummyTx = {
      id: 9999,
      invoiceNumber: 'TEST-PRINTER-001',
      shiftId: 1,
      cashierId: 1,
      cashierName: 'Teknisi Kasir',
      subtotal: 15000,
      discountOrderAmount: 0,
      taxAmount: 1650,
      grandTotal: 16650,
      paidAmount: 20000,
      changeAmount: 3350,
      paymentMethod: 'CASH',
      payments: [{ method: 'CASH' as any, amount: 20000 }],
      items: [
        {
          productId: 1,
          sku: 'TEST-01',
          barcode: '899999900101',
          name: 'Item Uji Coba Printer Kasir',
          unitName: 'PCS',
          buyPrice: 10000,
          unitPrice: 15000,
          quantity: 1,
          discountAmount: 0,
          subtotal: 15000,
        },
      ],
      status: 'COMPLETED' as any,
      createdAt: new Date().toISOString(),
    };
    printReceiptSilent(dummyTx, profile);
  };

  const handleSaveDatabaseToFolder = async () => {
    if (!isAdmin) return;
    setIsBackingUp(true);
    try {
      const res = await saveDatabaseToFile();
      if (res.success) {
        alert(res.message || 'Database berhasil dicadangkan!');
      } else if (res.message && res.message !== 'Pemilihan folder dibatalkan.') {
        alert(res.message);
      }
    } catch (err: any) {
      alert(`Gagal mencadangkan database: ${err?.message || err}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreDatabaseFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (
      !confirm(
        `Yakin ingin memulihkan database dari file "${file.name}"? Seluruh data saat ini akan digantikan oleh data cadangan.`
      )
    ) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const res = await importDatabaseFromJson(text);
        if (res.success) {
          alert('Database berhasil dipulihkan! Halaman akan dimuat ulang.');
          window.location.reload();
        } else {
          alert(res.message);
        }
      } catch (err: any) {
        alert(`Gagal memulihkan database: ${err?.message || err}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetData = async () => {
    if (!isAdmin) {
      alert('Hanya Administrator yang dapat me-reset data sistem.');
      return;
    }
    if (
      confirm(
        'PERINGATAN: Seluruh database (produk, transaksi, riwayat shift, akun) akan dikosongkan dan sistem akan kembali ke wizard setup awal. Lanjutkan?'
      )
    ) {
      await resetDatabase();
      window.location.reload();
    }
  };

  const handleExecuteUninstallWipe = async () => {
    if (confirmWipeText !== 'HAPUS') {
      alert('Ketik kata "HAPUS" secara tepat (huruf besar) untuk konfirmasi.');
      return;
    }

    setIsWiping(true);
    try {
      const finalReason = uninstallReason === 'Lainnya' ? customReason : uninstallReason;

      // Jika user memilih simpan cadangan terlebih dahulu
      if (uninstallWipeMode === 'backup_first') {
        const backupRes = await saveDatabaseToFile();
        if (!backupRes.success && backupRes.message !== 'Pemilihan folder dibatalkan.') {
          if (!confirm(`Pencadangan belum selesai (${backupRes.message}). Tetap lanjutkan hapus total data?`)) {
            setIsWiping(false);
            return;
          }
        }
      }

      await resetDatabase(finalReason);
      alert(
        'Seluruh basis data SparkPOS telah dibersihkan secara total!\n\nAlasan telah dicatat. Anda sekarang dapat melanjutkan proses uninstall dari Windows Control Panel / Settings.'
      );
      window.location.reload();
    } catch (err: any) {
      alert(`Gagal membersihkan data: ${err?.message || err}`);
      setIsWiping(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 bg-slate-950 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-6 pb-12">
        {/* Title Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
              <Settings className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white">Pengaturan Brand & Konfigurasi Toko</h1>
                {isAdmin ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Mode Admin (Akses Penuh)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    Akses Kasir (Read Only)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Kustomisasi nama aplikasi, upload logo toko, identitas nota, dan printer thermal POS.
              </p>
            </div>
          </div>

          {isSaved && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>Pengaturan Berhasil Disimpan!</span>
            </div>
          )}
        </div>

        {/* Permission Banner if Non-Admin */}
        {!isAdmin && (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-slate-400 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold text-slate-200 block">
                  Anda masuk sebagai Non-Admin (Kasir)
                </span>
                <span className="text-slate-400">
                  Perubahan nama aplikasi, logo toko, dan pengaturan sistem hanya dapat diedit oleh akun Administrator.
                </span>
              </div>
            </div>

            {onRequestAdminAccess && (
              <button
                type="button"
                onClick={onRequestAdminAccess}
                className="px-3.5 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition shrink-0"
              >
                Buka Akses Admin
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Card 1: Branding & Logo */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                  1. Branding Aplikasi & Logo Toko (Khusus Admin)
                </h2>
              </div>
              <span className="text-[11px] text-slate-500">
                Tampil di antarmuka & cetak nota
              </span>
            </div>

            <div className="grid grid-cols-2 gap-5 items-start">
              {/* App Name */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Nama Aplikasi / Brand Kasir
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={profile.appName}
                  onChange={(e) => setProfile({ ...profile, appName: e.target.value })}
                  placeholder="Contoh: SparkPOS atau TokoKu POS"
                  required
                  className={`w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium ${
                    !isAdmin ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Nama ini akan tampil di bagian header aplikasi dan nota penjualan.
                </p>
              </div>

              {/* Logo Upload & Preview */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Logo Toko / Icon Aplikasi
                </label>
                <div className="flex items-center gap-4">
                  {/* Preview Box */}
                  <div className="w-16 h-16 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                    {profile.appLogo ? (
                      <img
                        src={profile.appLogo}
                        alt="Logo Preview"
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <Image className="w-6 h-6 text-slate-700" />
                    )}
                  </div>

                  <div className="space-y-1.5 flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      disabled={!isAdmin}
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="logo-upload-input"
                    />
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="logo-upload-input"
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition ${
                          !isAdmin
                            ? 'opacity-50 cursor-not-allowed'
                            : 'cursor-pointer hover:bg-slate-750'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-400" />
                        <span>{profile.appLogo ? 'Ganti Logo' : 'Upload Logo Toko'}</span>
                      </label>

                      {profile.appLogo && isAdmin && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-850 hover:bg-rose-500/10 border border-slate-800 text-slate-400 hover:text-rose-400 text-xs transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Disarankan gambar PNG transparan persegi (Maks. 1.5 MB).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Identitas Toko & Header Struk */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Store className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                2. Profil & Identitas Toko (Header Struk)
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Nama Toko / Usaha
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={profile.storeName}
                  onChange={(e) => setProfile({ ...profile, storeName: e.target.value })}
                  placeholder="Contoh: TOKO BERKAH JAYA"
                  required
                  className={`w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium ${
                    !isAdmin ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Nama Cabang / Outlet
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={profile.branchName}
                  onChange={(e) => setProfile({ ...profile, branchName: e.target.value })}
                  placeholder="Contoh: Cabang Utama Retail"
                  className={`w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 ${
                    !isAdmin ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Alamat Lengkap Toko
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={profile.address}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  placeholder="Contoh: Jl. Merdeka No. 45, Jakarta Selatan"
                  className={`w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 ${
                    !isAdmin ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  No. Telepon / WhatsApp
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="Contoh: 0812-3456-7890"
                  className={`w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 ${
                    !isAdmin ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Catatan Kaki Struk (Receipt Footer)
              </label>
              <textarea
                rows={2}
                disabled={!isAdmin}
                value={profile.receiptFooter}
                onChange={(e) => setProfile({ ...profile, receiptFooter: e.target.value })}
                placeholder="Pesan terima kasih atau syarat penukaran barang..."
                className={`w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono ${
                  !isAdmin ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              />
            </div>
          </div>

          {/* Card 3: Konfigurasi Printer Thermal ESC/POS */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                  3. Hardware Printer Kasir & Laci Uang (Thermal ESC/POS)
                </h2>
              </div>
              <button
                type="button"
                onClick={handleTestPrint}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-medium text-slate-200 transition"
              >
                Uji Cetak Struk (Test Print)
              </button>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Ukuran Lebar Kertas Struk
                </label>
                <select
                  disabled={!isAdmin}
                  value={profile.paperWidth}
                  onChange={(e) =>
                    setProfile({ ...profile, paperWidth: e.target.value as '58mm' | '80mm' })
                  }
                  className={`w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium ${
                    !isAdmin ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="58mm">58mm Mini Kasir Thermal (32 Kolom Karakter)</option>
                  <option value="80mm">80mm Standar Epson TM-T82 / Sejenis (42 Kolom Karakter)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Mendukung printer thermal USB, LAN, maupun Bluetooth.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-300">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={profile.autoKickDrawer}
                    onChange={(e) => setProfile({ ...profile, autoKickDrawer: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-800"
                  />
                  <span>Buka Laci Uang Otomatis (Kick RJ11 Cash Drawer)</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-300">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={profile.autoPrintReceipt}
                    onChange={(e) => setProfile({ ...profile, autoPrintReceipt: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-800"
                  />
                  <span>Cetak Struk Otomatis setelah Selesai Bayar</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-300">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={profile.showLogoOnReceipt}
                    onChange={(e) =>
                      setProfile({ ...profile, showLogoOnReceipt: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-800"
                  />
                  <span>Tampilkan Logo Gambar di Bagian Atas Struk</span>
                </label>
              </div>
            </div>
          </div>

          {/* Card 4: Pajak PPN */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                4. Kebijakan Pajak (PPN)
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Tarif Pajak PPN (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    disabled={!isAdmin}
                    value={profile.taxPercent}
                    onChange={(e) =>
                      setProfile({ ...profile, taxPercent: parseFloat(e.target.value) || 0 })
                    }
                    className={`w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-bold ${
                      !isAdmin ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-slate-500 font-bold">
                    %
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Skema Perhitungan Pajak
                </label>
                <select
                  disabled={!isAdmin}
                  value={profile.isTaxInclusive ? 'inclusive' : 'exclusive'}
                  onChange={(e) =>
                    setProfile({ ...profile, isTaxInclusive: e.target.value === 'inclusive' })
                  }
                  className={`w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium ${
                    !isAdmin ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="exclusive">Eksklusif (Pajak ditambahkan di atas subtotal nota)</option>
                  <option value="inclusive">Inklusif (Harga produk di katalog sudah termasuk pajak)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 5: Pencadangan & Pemulihan Database (Drive D:, USB, Restore) */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                  5. Pencadangan & Penyimpanan Database (Drive D: / Eksternal)
                </h2>
              </div>
              <span className="text-[11px] text-slate-500">
                Pilih lokasi penyimpanan cadangan
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Anda dapat mencadangkan seluruh data transaksi, master produk, pelanggan, dan pengaturan ke Drive D:, flashdisk, atau folder mana pun di komputer Anda agar data tetap aman saat instal ulang Windows.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                  <span>Simpan / Cadangkan ke File (Pilih Drive D:)</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Menyimpan file cadangan (.sparkdb). Jendela Windows akan terbuka untuk memilih Drive D:\ atau folder tujuan Anda.
                </p>
                <button
                  type="button"
                  disabled={!isAdmin || isBackingUp}
                  onClick={handleSaveDatabaseToFolder}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-semibold transition shadow-sm"
                >
                  <DownloadCloud className="w-4 h-4" />
                  <span>{isBackingUp ? 'Menyimpan...' : 'Cadangkan Database (Pilih Folder / Drive D:)'}</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <UploadCloud className="w-4 h-4 text-blue-400" />
                  <span>Pulihkan (Restore) dari File Cadangan</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Memulihkan data toko dan transaksi dari file cadangan .sparkdb atau .json yang ada di Drive D:\ atau USB.
                </p>
                <input
                  ref={restoreFileInputRef}
                  type="file"
                  accept=".sparkdb,.json"
                  onChange={handleRestoreDatabaseFile}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => restoreFileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-850 hover:bg-slate-800 disabled:opacity-60 text-slate-200 text-xs font-semibold transition border border-slate-700"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Pilih File Cadangan & Pulihkan</span>
                </button>
              </div>
            </div>

            {/* Info Lokasi Database Lokal */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2.5">
              <HardDrive className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-300">Lokasi Database Aktif Windows: </span>
                <span className="font-mono text-emerald-400">%LOCALAPPDATA%\com.sparkpos.desktop\EBWebView</span>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Aplikasi menggunakan database lokal IndexedDB berkecepatan tinggi. Lakukan backup berkala ke Drive D: untuk arsip cadangan.
                </p>
              </div>
            </div>
          </div>

          {/* Card 6: Persiapan Uninstall & Pembersihan Bersih Database */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-rose-900/40 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                  6. Persiapan Uninstall Aplikasi & Hapus Bersih Database
                </h2>
              </div>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                Pembersihan Total
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Sebelum Anda menghapus / uninstall aplikasi SparkPOS melalui <strong>Windows Settings atau Control Panel</strong>, Anda dapat memilih apakah ingin menghapus total seluruh riwayat database atau mencadangkannya terlebih dahulu beserta mencatat alasan penghapusan aplikasi.
            </p>

            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <h3 className="text-xs font-bold text-white">Opsi Hapus Total Database & Alasan Uninstall</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Pilihan wipe bersih total data toko, kasir, dan stok sebelum di-uninstall dari komputer.
                </p>
              </div>

              <button
                type="button"
                disabled={!isAdmin}
                onClick={() => {
                  setConfirmWipeText('');
                  setIsUninstallModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold text-xs transition disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>Buka Opsi Hapus Bersih</span>
              </button>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2">
            {isAdmin ? (
              <button
                type="button"
                onClick={handleResetData}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-900/50 text-xs font-medium transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Database (Kembali ke Setup Awal)</span>
              </button>
            ) : <div />}

            {isAdmin && (
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-sm active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Pengaturan</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* MODAL UNINSTALL & HAPUS BERSIH DATABASE */}
      {isUninstallModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-850">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Pembersihan Database Sebelum Uninstall
                  </h3>
                  <p className="text-xs text-slate-400">
                    Konfirmasi penghapusan data dan pencatatan alasan
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsUninstallModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Mode Pilihan: Backup First atau Direct Wipe */}
              <div className="space-y-2">
                <label className="font-bold text-slate-200 uppercase tracking-wider text-[11px] block">
                  1. Pilihan Tindakan Database:
                </label>

                <div className="grid grid-cols-1 gap-2">
                  <label
                    className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                      uninstallWipeMode === 'backup_first'
                        ? 'bg-slate-850 border-emerald-500/50 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="wipeMode"
                      checked={uninstallWipeMode === 'backup_first'}
                      onChange={() => setUninstallWipeMode('backup_first')}
                      className="mt-0.5 text-emerald-500 focus:ring-0"
                    />
                    <div>
                      <span className="font-bold block text-white">
                        Simpan Cadangan (.sparkdb) ke Drive D: lalu Hapus Bersih
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Direkomendasikan agar data riwayat penjualan dan stok tetap bisa dipulihkan kembali jika Anda menginstall ulang nanti.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                      uninstallWipeMode === 'wipe_only'
                        ? 'bg-slate-850 border-rose-500/50 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="wipeMode"
                      checked={uninstallWipeMode === 'wipe_only'}
                      onChange={() => setUninstallWipeMode('wipe_only')}
                      className="mt-0.5 text-rose-500 focus:ring-0"
                    />
                    <div>
                      <span className="font-bold block text-rose-300">
                        Hapus Bersih Total Tanpa Membuat Cadangan (Wipe Permanen)
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Seluruh produk, data kasir, transaksi penjualan, dan pengaturan toko akan dihapus permanen.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Alasan Dihapus / Uninstall */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="font-bold text-slate-200 uppercase tracking-wider text-[11px] block flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>2. Alasan Penghapusan / Uninstall:</span>
                </label>

                <select
                  value={uninstallReason}
                  onChange={(e) => setUninstallReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Pindah ke komputer / kasir baru">Pindah ke komputer / mesin kasir baru</option>
                  <option value="Toko tutup / berhenti operasional">Toko tutup / berhenti operasional</option>
                  <option value="Ingin mulai dari database kosong baru">Ingin mulai dari database kosong baru</option>
                  <option value="Hanya coba-coba / evaluasi sistem kasir">Hanya coba-coba / evaluasi sistem kasir</option>
                  <option value="Ganti software kasir lain">Ganti software kasir lain</option>
                  <option value="Lainnya">Lainnya (Tulis alasan sendiri)...</option>
                </select>

                {uninstallReason === 'Lainnya' && (
                  <input
                    type="text"
                    required
                    placeholder="Tuliskan alasan Anda..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 mt-2"
                  />
                )}
              </div>

              {/* Konfirmasi Teks */}
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-2">
                <span className="text-rose-300 font-semibold block text-[11px]">
                  Ketik kata <strong className="text-white font-mono bg-rose-950/80 px-1.5 py-0.5 rounded">HAPUS</strong> untuk mengonfirmasi pembersihan data:
                </span>
                <input
                  type="text"
                  placeholder="Ketik HAPUS"
                  value={confirmWipeText}
                  onChange={(e) => setConfirmWipeText(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-rose-500/40 rounded-xl text-xs text-white font-bold tracking-widest focus:outline-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsUninstallModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={isWiping || confirmWipeText !== 'HAPUS'}
                onClick={handleExecuteUninstallWipe}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 transition shadow-md shadow-rose-950/50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isWiping ? 'Sedang Membersihkan...' : 'Hapus Total Sekarang'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
