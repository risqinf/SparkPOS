import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Store,
  ShieldCheck,
  UploadCloud,
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Database,
  Lock,
  User,
  Phone,
  MapPin,
  Tag,
} from 'lucide-react';
import { StoreProfile, Employee } from '../../types/pos';
import { initializeStore, DEFAULT_STORE_PROFILE } from '../../services/storage';
import { importDatabaseFromJson } from '../../services/databaseBackup';

interface FirstTimeSetupProps {
  onSetupComplete: (adminEmployee: Employee, profile: StoreProfile) => void;
}

export const FirstTimeSetup: React.FC<FirstTimeSetupProps> = ({ onSetupComplete }) => {
  const [activeMode, setActiveMode] = useState<'fresh' | 'restore'>('fresh');

  // Fresh Setup State
  const [appName, setAppName] = useState('SparkPOS');
  const [storeName, setStoreName] = useState('');
  const [branchName, setBranchName] = useState('Cabang Utama');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [receiptFooter, setReceiptFooter] = useState(
    'Terima kasih atas kunjungan Anda!\nBarang yang dibeli tidak dapat ditukar/dikembalikan.'
  );

  // Admin Account State
  const [adminFullName, setAdminFullName] = useState('Pemilik / Administrator');
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPin, setAdminPin] = useState('123456');
  const [adminPinConfirm, setAdminPinConfirm] = useState('123456');

  // Options
  const [seedUnits, setSeedUnits] = useState(true);
  const [seedCategories, setSeedCategories] = useState(true);

  // Restore State
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreJsonContent, setRestoreJsonContent] = useState<string>('');
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);

  // UI state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection for restore
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFile(file);
    setErrorMsg(null);
    setRestoreStatus('Membaca file cadangan...');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        // Simple JSON sanity check
        JSON.parse(text);
        setRestoreJsonContent(text);
        setRestoreStatus(`File siap: "${file.name}" (${(file.size / 1024).toFixed(1)} KB)`);
      } catch {
        setErrorMsg('Format file tidak valid. Pastikan file berformat .sparkdb atau .json cadangan resmi.');
        setRestoreFile(null);
        setRestoreStatus(null);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Gagal membaca file dari penyimpanan.');
      setRestoreStatus(null);
    };
    reader.readAsText(file);
  };

  // Submit Fresh Setup
  const handleFreshSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!storeName.trim()) {
      setErrorMsg('Nama Toko wajib diisi!');
      return;
    }

    if (!adminPin || adminPin.length < 4) {
      setErrorMsg('PIN Admin minimal harus 4 angka demi keamanan!');
      return;
    }

    if (adminPin !== adminPinConfirm) {
      setErrorMsg('Konfirmasi PIN Admin tidak cocok!');
      return;
    }

    setIsSubmitting(true);
    try {
      const profile: StoreProfile = {
        ...DEFAULT_STORE_PROFILE,
        appName: appName.trim() || 'SparkPOS',
        storeName: storeName.trim(),
        branchName: branchName.trim(),
        address: address.trim(),
        phone: phone.trim(),
        receiptFooter: receiptFooter.trim(),
      };

      const adminUser = await initializeStore(
        profile,
        {
          username: adminUsername.trim() || 'admin',
          pin: adminPin.trim(),
          fullName: adminFullName.trim() || 'Administrator',
        },
        seedUnits,
        seedCategories
      );

      onSetupComplete(adminUser, profile);
    } catch (err: any) {
      setErrorMsg(`Gagal melakukan setup awal: ${err?.message || err}`);
      setIsSubmitting(false);
    }
  };

  // Submit Restore
  const handleRestoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreJsonContent) {
      setErrorMsg('Pilih file cadangan database (.sparkdb / .json) terlebih dahulu!');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const result = await importDatabaseFromJson(restoreJsonContent);
      if (!result.success) {
        setErrorMsg(result.message);
        setIsSubmitting(false);
        return;
      }

      // Check restored admin
      const { db, getStoreProfile } = await import('../../services/storage');
      const profile = await getStoreProfile();
      const admin = await db.employees.where('role').equals('admin').first();

      if (!admin) {
        throw new Error('Database berhasil dipulihkan, namun akun Admin tidak ditemukan dalam cadangan.');
      }

      onSetupComplete(admin, profile);
    } catch (err: any) {
      setErrorMsg(`Gagal memulihkan database: ${err?.message || err}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-4 overflow-y-auto">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-slate-800/80 bg-gradient-to-b from-slate-850 to-slate-900">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
                Selamat Datang di SparkPOS
              </h1>
              <p className="text-xs md:text-sm text-slate-400">
                Inisialisasi Sistem Kasir Ritel — Mulai Baru atau Pulihkan Database Anda
              </p>
            </div>
          </div>

          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-2 gap-2 mt-6 p-1.5 bg-slate-950/80 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setActiveMode('fresh');
                setErrorMsg(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold transition ${
                activeMode === 'fresh'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>1. Setup Toko Baru (Mulai Bersih)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveMode('restore');
                setErrorMsg(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold transition ${
                activeMode === 'restore'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>2. Pulihkan Database (Restore)</span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-6 md:mx-8 mt-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab 1: Setup Toko Baru */}
        {activeMode === 'fresh' && (
          <form onSubmit={handleFreshSubmit} className="p-6 md:p-8 space-y-6">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-3 text-xs text-slate-300">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>
                <strong>Database Bersih:</strong> Tidak ada kasir dummy & tidak ada produk sampel. Anda dapat langsung menginput produk toko Anda sendiri.
              </span>
            </div>

            {/* Bagian 1: Identitas Toko & Brand */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <Store className="w-4 h-4" />
                <span>Identitas Toko & Aplikasi</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Nama Toko <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Contoh: Toko Berkah Mandiri"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Nama Cabang
                  </label>
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="Contoh: Cabang Utama"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Nama Aplikasi / Brand POS
                  </label>
                  <input
                    type="text"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="Contoh: SparkPOS atau KasirKu"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Nomor WhatsApp / Telepon
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Contoh: 0812-3456-7890"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Alamat Lengkap Toko
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Contoh: Jl. Merdeka No. 123, Pasar Raya, Kota Anda"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Bagian 2: Akun Administrator Utama */}
            <div className="space-y-4 pt-2 border-t border-slate-800/80">
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Akun Administrator Utama (Owner)</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Nama Lengkap Pemilik / Admin
                  </label>
                  <input
                    type="text"
                    required
                    value={adminFullName}
                    onChange={(e) => setAdminFullName(e.target.value)}
                    placeholder="Contoh: Pemilik Toko"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Username Admin
                  </label>
                  <input
                    type="text"
                    required
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="Contoh: admin"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    PIN Masuk Admin (4-6 Angka) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    required
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Contoh: 123456"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-emerald-500 font-bold tracking-widest"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Gunakan PIN yang mudah Anda ingat untuk login.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Ulangi PIN Masuk Admin <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    required
                    value={adminPinConfirm}
                    onChange={(e) => setAdminPinConfirm(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ulangi PIN di atas"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-emerald-500 font-bold tracking-widest"
                  />
                </div>
              </div>
            </div>

            {/* Checklist Inisialisasi */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={seedUnits}
                  onChange={(e) => setSeedUnits(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <span>Tambahkan satuan standar otomatis (PCS, Meter, Roll)</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={seedCategories}
                  onChange={(e) => setSeedCategories(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <span>Tambahkan kategori standar (Aksesoris, Jasa, Laptop, Sparepart)</span>
              </label>
            </div>

            {/* Action Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition disabled:opacity-60"
            >
              <span>{isSubmitting ? 'Menyimpan & Menyiapkan...' : 'Simpan & Masuk ke Aplikasi Kasir'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Tab 2: Pulihkan Database */}
        {activeMode === 'restore' && (
          <form onSubmit={handleRestoreSubmit} className="p-6 md:p-8 space-y-6">
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200 space-y-1">
              <p className="font-bold flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-400" />
                Punya Cadangan Database Sebelumnya di Drive D: atau Flashdisk?
              </p>
              <p className="text-blue-300/80">
                Pilih file cadangan (.sparkdb atau .json) yang pernah Anda ekspor sebelumnya. Seluruh profil toko, master produk, kategori, riwayat transaksi, dan user akan dipulihkan secara instan.
              </p>
            </div>

            {/* File Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-8 border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl bg-slate-950/70 hover:bg-slate-950 flex flex-col items-center justify-center cursor-pointer transition text-center space-y-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".sparkdb,.json"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400">
                <UploadCloud className="w-8 h-8" />
              </div>

              <div>
                <p className="text-sm font-bold text-white">
                  {restoreFile ? restoreFile.name : 'Klik untuk Memilih File Cadangan Database'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Mendukung file .sparkdb atau .json (dari Drive D:, E:, atau Folder Dokumen)
                </p>
              </div>

              {restoreStatus && (
                <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                  {restoreStatus}
                </div>
              )}
            </div>

            {/* Restore Action */}
            <button
              type="submit"
              disabled={isSubmitting || !restoreFile}
              className="w-full py-3.5 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{isSubmitting ? 'Memulihkan Database...' : 'Pulihkan Seluruh Database Sekarang'}</span>
              <FileCheck2 className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
