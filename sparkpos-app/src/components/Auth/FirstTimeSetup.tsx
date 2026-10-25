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
  Clock,
  UserCheck,
  Users,
  LogOut,
} from 'lucide-react';
import { StoreProfile, Employee } from '../../types/pos';
import { initializeStore, DEFAULT_STORE_PROFILE, db, getStoreProfile } from '../../services/storage';
import { importDatabaseFromJson } from '../../services/databaseBackup';

interface FirstTimeSetupProps {
  onSetupComplete: (
    adminEmployee: Employee,
    profile: StoreProfile,
    loginAsCashier?: boolean,
    cashierEmployee?: Employee
  ) => void;
}

export const FirstTimeSetup: React.FC<FirstTimeSetupProps> = ({ onSetupComplete }) => {
  const [activeMode, setActiveMode] = useState<'fresh' | 'restore'>('fresh');

  // Fresh Setup State
  const [appName, setAppName] = useState('SparkPOS');
  const [storeName, setStoreName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [receiptFooter, setReceiptFooter] = useState(
    'Terima kasih atas kunjungan Anda!\nBarang yang dibeli tidak dapat ditukar/dikembalikan.'
  );

  // Admin Account State
  const [adminFullName, setAdminFullName] = useState('Pemilik Toko (Owner)');
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPin, setAdminPin] = useState('123456');
  const [adminPinConfirm, setAdminPinConfirm] = useState('123456');

  // Initial Cashier Setup State (Optional / Recommended)
  const [createInitialCashier, setCreateInitialCashier] = useState(true);
  const [cashierFullName, setCashierFullName] = useState('Kasir 1');
  const [cashierUsername, setCashierUsername] = useState('kasir1');
  const [cashierPin, setCashierPin] = useState('1234');
  const [cashierShiftSchedule, setCashierShiftSchedule] = useState('Jam Kerja Standar (07:30 - 16:30)');
  const [cashierIsFlexible, setCashierIsFlexible] = useState(false);

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
  const [setupResult, setSetupResult] = useState<{
    admin: Employee;
    cashier?: Employee;
    profile: StoreProfile;
  } | null>(null);

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

    if (createInitialCashier) {
      if (!cashierFullName.trim()) {
        setErrorMsg('Nama Kasir wajib diisi!');
        return;
      }
      if (!cashierPin || cashierPin.length < 4) {
        setErrorMsg('PIN Kasir minimal harus 4 angka!');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const profile: StoreProfile = {
        ...DEFAULT_STORE_PROFILE,
        appName: appName.trim() || 'SparkPOS',
        storeName: storeName.trim(),
        branchName: '',
        address: address.trim(),
        phone: phone.trim(),
        receiptFooter: receiptFooter.trim(),
      };

      const cashierData = createInitialCashier
        ? {
            username: cashierUsername.trim() || 'kasir1',
            fullName: cashierFullName.trim() || 'Kasir 1',
            pin: cashierPin.trim() || '1234',
            shiftSchedule: cashierIsFlexible ? 'Shift Fleksibel' : cashierShiftSchedule,
            isFlexibleShift: cashierIsFlexible,
          }
        : undefined;

      const result = await initializeStore(
        profile,
        {
          username: adminUsername.trim() || 'admin',
          pin: adminPin.trim(),
          fullName: adminFullName.trim() || 'Pemilik Toko (Owner)',
        },
        seedUnits,
        seedCategories,
        cashierData
      );

      setSetupResult({
        admin: result.admin,
        cashier: result.cashier,
        profile,
      });
    } catch (err: any) {
      setErrorMsg(`Gagal melakukan setup awal: ${err?.message || err}`);
    } finally {
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

      // Read restored profile and admin employee
      const profile = await getStoreProfile();
      const admin = await db.employees.where('role').equals('admin').first();
      const firstCashier = await db.employees.where('role').equals('cashier').first();

      if (!admin) {
        throw new Error('Database berhasil dipulihkan, namun akun Admin tidak ditemukan dalam cadangan.');
      }

      setSetupResult({
        admin,
        cashier: firstCashier,
        profile,
      });
    } catch (err: any) {
      setErrorMsg(`Gagal memulihkan database: ${err?.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // IF SETUP IS COMPLETED: SHOW CLEAR CHOICE SCREEN (Owner vs Cashier)
  if (setupResult) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-4 lg:p-6 overflow-y-auto">
        <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 p-6 md:p-8 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Setup Toko Selesai! <CheckCircle2 className="w-4 h-4 inline mr-1 text-emerald-500" />
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Data toko <strong className="text-white">{setupResult.profile.storeName}</strong> berhasil dikonfigurasi.
            </p>
          </div>

          {/* Account Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-6">
            {/* Owner Account Card */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-left">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Akun Owner</span>
                </span>
                <span className="text-xs font-mono text-slate-400">PIN: {setupResult.admin.pin}</span>
              </div>
              <div className="font-bold text-sm text-white">{setupResult.admin.fullName}</div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">@{setupResult.admin.username}</div>
              <p className="text-[11px] text-slate-500 mt-2">
                Akses penuh: master produk, laporan, kelola kasir, dan backup database.
              </p>
            </div>

            {/* Cashier Account Card */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-left">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>Akun Kasir</span>
                </span>
                {setupResult.cashier && (
                  <span className="text-xs font-mono text-slate-400">PIN: {setupResult.cashier.pin}</span>
                )}
              </div>
              {setupResult.cashier ? (
                <>
                  <div className="font-bold text-sm text-white">{setupResult.cashier.fullName}</div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">@{setupResult.cashier.username}</div>
                  <p className="text-[11px] text-emerald-400/90 mt-2 flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3" />
                    <span>Jadwal: {setupResult.cashier.shiftSchedule || 'Shift Fleksibel'}</span>
                  </p>
                </>
              ) : (
                <div className="py-2">
                  <div className="text-xs text-slate-400 italic">Belum ada kasir yang ditambahkan.</div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Anda dapat menambahkan kasir kapan saja di menu Kelola Kasir.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action Choice Buttons */}
          <div className="space-y-2.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block text-center mb-1">
              Pilih Cara Masuk Sekarang:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Login sebagai Kasir */}
              <button
                type="button"
                onClick={() =>
                  onSetupComplete(setupResult.admin, setupResult.profile, true, setupResult.cashier)
                }
                className="py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition active:scale-[0.99]"
              >
                <UserCheck className="w-4 h-4" />
                <span>
                  {setupResult.cashier
                    ? `Login sebagai Kasir (${setupResult.cashier.fullName})`
                    : 'Buka Layar Login Kasir'}
                </span>
              </button>

              {/* Option 2: Masuk sebagai Owner */}
              <button
                type="button"
                onClick={() =>
                  onSetupComplete(setupResult.admin, setupResult.profile, false)
                }
                className="py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition active:scale-[0.99]"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Masuk sebagai Owner (Buka POS)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-4 lg:p-6 overflow-y-auto">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-4xl lg:max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-slate-800/80 bg-gradient-to-b from-slate-850 to-slate-900">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
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

            {/* Bagian 1 & 2 dalam Grid 2 Kolom untuk Layar Desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Kolom Kiri: Identitas Toko & Brand */}
              <div className="space-y-4 bg-slate-950/40 p-5 rounded-2xl border border-slate-800/80">
                <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2 pb-2 border-b border-slate-800">
                  <Store className="w-4 h-4" />
                  <span>Identitas Toko & Brand</span>
                </h2>

                <div className="space-y-3.5">
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
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Nama Aplikasi Kasir / Header
                    </label>
                    <input
                      type="text"
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      placeholder="Contoh: SparkPOS"
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Nomor Telepon / WhatsApp
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Contoh: 0812-3456-7890"
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Alamat Lengkap Toko
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Contoh: Jl. Merdeka No. 123, Pasar Raya, Kota Anda"
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Kolom Kanan: Akun Owner & Akun Kasir Pertama */}
              <div className="space-y-4">
                {/* Akun Owner */}
                <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800/80 space-y-3.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2 pb-2 border-b border-slate-800">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Akun Administrator Utama (Owner)</span>
                  </h2>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Nama Pemilik (Owner)
                      </label>
                      <input
                        type="text"
                        required
                        value={adminFullName}
                        onChange={(e) => setAdminFullName(e.target.value)}
                        placeholder="Contoh: Pemilik Toko"
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Username
                      </label>
                      <input
                        type="text"
                        required
                        value={adminUsername}
                        onChange={(e) => setAdminUsername(e.target.value)}
                        placeholder="Contoh: admin"
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
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
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-emerald-500 font-bold tracking-widest"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Ulangi PIN Admin <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="password"
                        maxLength={6}
                        required
                        value={adminPinConfirm}
                        onChange={(e) => setAdminPinConfirm(e.target.value.replace(/\D/g, ''))}
                        placeholder="Ulangi PIN di atas"
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-emerald-500 font-bold tracking-widest"
                      />
                    </div>
                  </div>
                </div>

                {/* Akun Kasir Pertama (Opsional & Direkomendasikan) */}
                <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={createInitialCashier}
                        onChange={(e) => setCreateInitialCashier(e.target.checked)}
                        className="rounded text-emerald-500 focus:ring-0 bg-slate-900 border-slate-700"
                      />
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Sekaligus Buat Akun Kasir Pertama</span>
                      </span>
                    </label>
                    <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/10">
                      Rekomendasi
                    </span>
                  </div>

                  {createInitialCashier && (
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Nama Kasir
                          </label>
                          <input
                            type="text"
                            required={createInitialCashier}
                            value={cashierFullName}
                            onChange={(e) => setCashierFullName(e.target.value)}
                            placeholder="Contoh: Kasir 1"
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            PIN Masuk Kasir (4 Digit)
                          </label>
                          <input
                            type="password"
                            maxLength={6}
                            required={createInitialCashier}
                            value={cashierPin}
                            onChange={(e) => setCashierPin(e.target.value.replace(/\D/g, ''))}
                            placeholder="Contoh: 1234"
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-emerald-500 tracking-wider font-bold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Pilihan Shift Kerja
                          </label>
                          <select
                            disabled={cashierIsFlexible}
                            value={cashierShiftSchedule}
                            onChange={(e) => setCashierShiftSchedule(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-40"
                          >
                            <option value="Jam Kerja Standar (07:30 - 16:30)">Jam Kerja Standar (07:30 - 16:30)</option>
                            <option value="Shift Fleksibel">Shift Fleksibel</option>
                          </select>
                        </div>

                        <div className="flex items-center pt-5">
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                            <input
                              type="checkbox"
                              checked={cashierIsFlexible}
                              onChange={(e) => setCashierIsFlexible(e.target.checked)}
                              className="rounded text-emerald-500 focus:ring-0 bg-slate-900 border-slate-700"
                            />
                            <span>Mode Shift Fleksibel</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Checklist Inisialisasi */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={seedUnits}
                  onChange={(e) => setSeedUnits(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-0 bg-slate-900 border-slate-700"
                />
                <span>Tambahkan satuan standar (PCS, Meter, Roll)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
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
              className="w-full py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition disabled:opacity-60"
            >
              <span>{isSubmitting ? 'Menyimpan & Menyiapkan...' : 'Simpan & Selesaikan Setup Toko'}</span>
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
              className="w-full py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
