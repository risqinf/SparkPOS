import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  User,
  ShieldCheck,
  Store,
  ArrowRight,
  Delete,
  AlertCircle,
  Sparkles,
  Users,
  Clock,
  KeyRound,
  CheckCircle2,
  Sun,
  Moon,
  Monitor,
  Info,
  X,
  Wrench,
} from 'lucide-react';
import { Employee, StoreProfile } from '../../types/pos';
import { authenticateEmployee, db } from '../../services/storage';
import { playSuccessBeep, playErrorBeep } from '../../services/scanner';
import { getSavedTheme, cycleTheme, onThemeChange, ThemeMode } from '../../services/theme';

interface LoginScreenProps {
  storeProfile: StoreProfile;
  onLoginSuccess: (employee: Employee) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ storeProfile, onLoginSuccess }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getSavedTheme());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [username, setUsername] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeFocusField, setActiveFocusField] = useState<'username' | 'pin'>('username');

  useEffect(() => {
    const unsub = onThemeChange((mode) => {
      setThemeMode(mode);
    });
    return unsub;
  }, []);

  const usernameInputRef = useRef<HTMLInputElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Load registered employees
  useEffect(() => {
    const loadEmps = async () => {
      const all = await db.employees.toArray();
      const list = all.filter((e) => e.isActive !== false);
      setEmployees(list);
    };
    loadEmps();
  }, []);

  // Matching employee based on current username input
  const matchedUser = employees.find(
    (e: Employee) => e.username.toLowerCase() === username.trim().toLowerCase()
  );

  const handleNumpadClick = (digit: string) => {
    if (activeFocusField === 'username') {
      setUsername((prev: string) => prev + digit);
    } else {
      if (pin.length < 6) {
        setPin((prev: string) => prev + digit);
        setErrorMessage(null);
      }
    }
  };

  const handleBackspace = () => {
    if (activeFocusField === 'username') {
      setUsername((prev: string) => prev.slice(0, -1));
    } else {
      setPin((prev: string) => prev.slice(0, -1));
      setErrorMessage(null);
    }
  };

  const handleClear = () => {
    setPin('');
    setErrorMessage(null);
  };

  const handleSelectQuickUser = (emp: Employee) => {
    setUsername(emp.username);
    setPin('');
    setErrorMessage(null);
    setActiveFocusField('pin');
    if (pinInputRef.current) {
      pinInputRef.current.focus();
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!username.trim()) {
      setErrorMessage('Silakan masukkan username akun Anda!');
      playErrorBeep();
      if (usernameInputRef.current) usernameInputRef.current.focus();
      return;
    }

    if (!pin) {
      setErrorMessage('Silakan masukkan PIN otentikasi!');
      playErrorBeep();
      if (pinInputRef.current) pinInputRef.current.focus();
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. Cek keberadaan username
      const existingUser = employees.find(
        (emp: Employee) => emp.username.toLowerCase() === username.trim().toLowerCase()
      );

      if (!existingUser) {
        playErrorBeep();
        setErrorMessage(`Username "@${username.trim()}" tidak terdaftar di sistem!`);
        return;
      }

      // 2. Verifikasi PIN
      const authUser = await authenticateEmployee(username.trim(), pin.trim());

      if (authUser) {
        playSuccessBeep();
        onLoginSuccess(authUser);
      } else {
        playErrorBeep();
        setErrorMessage(`PIN tidak sesuai untuk akun @${existingUser.username}!`);
        setPin('');
        if (pinInputRef.current) pinInputRef.current.focus();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Keyboard shortcut listener (Enter to submit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleLogin();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [username, pin, employees]);

  return (
    <div className="flex h-screen w-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 select-none overflow-hidden items-center justify-center p-4 lg:p-6 relative">
      {/* Theme Switcher Button Top-Right */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={() => {
            const next = cycleTheme();
            setThemeMode(next);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          title="Klik untuk beralih antara Sistem / Terang / Gelap"
        >
          {themeMode === 'system' && <Monitor className="w-3.5 h-3.5 text-sky-500" />}
          {themeMode === 'light' && <Sun className="w-3.5 h-3.5 text-amber-500" />}
          {themeMode === 'dark' && <Moon className="w-3.5 h-3.5 text-indigo-400" />}
          <span className="text-[11px]">
            {themeMode === 'system'
              ? 'Sistem (Default)'
              : themeMode === 'light'
              ? 'Mode Terang'
              : 'Mode Gelap'}
          </span>
        </button>
      </div>

      <div className="w-full max-w-5xl 2xl:max-w-6xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[600px] 2xl:min-h-[660px]">
        {/* ================= LEFT SIDE: BRANDING & PROFILE (5 cols) ================= */}
        <div className="md:col-span-5 bg-slate-50 dark:bg-slate-900/60 p-8 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            {/* Store & App Logo */}
            <div className="flex items-center gap-3 mb-6">
              {storeProfile.appLogo ? (
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center shrink-0">
                  <img
                    src={storeProfile.appLogo}
                    alt="Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-600/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-6 h-6" />
                </div>
              )}
              <div>
                <h1 className="font-extrabold text-xl text-slate-900 dark:text-white tracking-tight">
                  {storeProfile.appName || 'SparkPOS'}
                </h1>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                  Desktop Retail Offline System
                </span>
              </div>
            </div>

            {/* Store Identity Box */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-850/80 border border-slate-200 dark:border-slate-800 space-y-1.5 mb-6 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-200">
                <Store className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{storeProfile.storeName}</span>
              </div>
              {storeProfile.branchName && (
                <p className="text-xs text-slate-600 dark:text-slate-400 pl-5">{storeProfile.branchName}</p>
              )}
              {storeProfile.address && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 pl-5 line-clamp-2">{storeProfile.address}</p>
              )}
            </div>

            {/* Role Explanation Note */}
            <div className="space-y-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-300 block uppercase tracking-wider text-[10px]">
                Panduan Hak Akses Role:
              </span>
              <div className="p-2.5 rounded-lg bg-slate-850/50 border border-slate-800 text-[11px] space-y-1">
                <div className="text-slate-300 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>1. Owner:</span>
                </div>
                <p className="text-slate-400 pl-2.5">
                  Akses penuh: Kasir, Servis, Stok, Pengaturan Toko, Hardware, Relokasi DB, dan Kelola Staf.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-850/50 border border-slate-800 text-[11px] space-y-1">
                <div className="text-slate-300 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                  <span>2. Teknisi:</span>
                </div>
                <p className="text-slate-400 pl-2.5">
                  Fokus Servis & Reparasi unit, diagnosa, sparepart, status servis, serta alternatif kasir jika kasir libur.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-850/50 border border-slate-800 text-[11px] space-y-1">
                <div className="text-slate-300 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  <span>3. Kasir:</span>
                </div>
                <p className="text-slate-400 pl-2.5">
                  Fokus penjualan POS, penerimaan servis masuk dari pelanggan, cetak nota, dan cek stok produk.
                </p>
              </div>
            </div>
          </div>

          {/* Offline Security Info Footer */}
          <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sistem Kasir Aman & Offline</span>
            </span>
            <span className="font-mono text-emerald-400 font-bold">v2.0.0</span>
          </div>
        </div>

        {/* ================= RIGHT SIDE: USERNAME & PIN FORM + TOUCH NUMPAD ================= */}
        <div className="md:col-span-7 p-6 lg:p-8 flex flex-col justify-between bg-white dark:bg-slate-900">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Login Masuk ke SparkPOS</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Masukkan Username & PIN akun yang ingin digunakan</p>
              </div>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-bold">v2.3.0</span>
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Quick-Pick Account Buttons */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Pilih Cepat Akun yang Tersedia:</span>
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">Klik untuk isi username otomatis</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {employees.map((emp: Employee) => {
                  const isSelected = username.trim().toLowerCase() === emp.username.toLowerCase();
                  const isOwner = emp.role === 'owner' || emp.role === 'admin';
                  const isTeknisi = emp.role === 'teknisi' || emp.role === 'supervisor';
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => handleSelectQuickUser(emp)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-500 text-emerald-900 dark:text-white shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <span className="flex items-center justify-center w-5 h-5 rounded-full shrink-0 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                  {isOwner
                    ? <ShieldCheck className="w-3 h-3" />
                    : isTeknisi
                    ? <Wrench className="w-3 h-3" />
                    : <User className="w-3 h-3" />}
                </span>
                      <span className="font-bold">{emp.fullName}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">(@{emp.username})</span>
                    </button>
                  );
                })}

                {employees.filter((e: Employee) => e.role === 'kasir' || e.role === 'cashier').length === 0 && (
                  <div className="w-full p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px]">
                    <Info className="w-3 h-3 inline mr-1 text-amber-500" />Baru ada akun Owner. Login sebagai Owner terlebih dahulu lalu buka menu <strong>Kelola Kasir</strong> untuk mendaftarkan akun kasir atau teknisi baru.
                  </div>
                )}
              </div>
            </div>

            {/* Form Inputs: Username & PIN */}
            <form onSubmit={handleLogin} className="space-y-3 mb-4">
              {/* Username Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Username Akun:</span>
                  </span>
                  {matchedUser && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3 h-3 inline mr-1 text-emerald-500" />Terdeteksi: {matchedUser.fullName} ({matchedUser.role === 'owner' || matchedUser.role === 'admin' ? 'Owner' : matchedUser.role === 'teknisi' || matchedUser.role === 'supervisor' ? 'Teknisi' : 'Kasir'})
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    ref={usernameInputRef}
                    type="text"
                    required
                    value={username}
                    onFocus={() => setActiveFocusField('username')}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setErrorMessage(null);
                    }}
                    placeholder="Ketik username akun (contoh: admin, kasir1)..."
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium font-mono shadow-2xs"
                  />
                  {username && (
                    <button
                      type="button"
                      onClick={() => {
                        setUsername('');
                        setPin('');
                      }}
                      className="absolute right-3 top-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* PIN Input Field */}
              <div>
                <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>PIN Akses (4 - 6 Angka):</span>
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {matchedUser?.role === 'owner' || matchedUser?.role === 'admin' ? 'PIN Owner 6 Digit' : 'PIN Masuk 4 Digit'}
                  </span>
                </div>

                <div className="relative">
                  <input
                    ref={pinInputRef}
                    type="password"
                    maxLength={6}
                    required
                    value={pin}
                    onFocus={() => setActiveFocusField('pin')}
                    onChange={(e) => {
                      setPin(e.target.value.replace(/\D/g, ''));
                      setErrorMessage(null);
                    }}
                    placeholder="Ketik PIN pada keyboard atau numpad di bawah..."
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-bold tracking-widest font-mono shadow-2xs"
                  />
                  {pin && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="absolute right-3 top-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            </form>

            {/* Tactile Touch Numpad */}
            <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleNumpadClick(digit)}
                  className="h-10 rounded-xl bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold text-sm active:scale-95 transition shadow-2xs"
                >
                  {digit}
                </button>
              ))}

              <button
                type="button"
                onClick={handleClear}
                className="h-10 rounded-xl bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-xs active:scale-95 transition"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={() => handleNumpadClick('0')}
                className="h-10 rounded-xl bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold text-sm active:scale-95 transition shadow-2xs"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleBackspace}
                className="h-10 rounded-xl bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center active:scale-95 transition"
              >
                <Delete className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 max-w-xs mx-auto w-full">
            <button
              type="button"
              disabled={isLoading || !username.trim() || pin.length === 0}
              onClick={() => handleLogin()}
              className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg ${
                isLoading || !username.trim() || pin.length === 0
                  ? 'bg-slate-800 text-slate-600 border border-slate-700/60 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40 active:scale-95'
              }`}
            >
              <span>{isLoading ? 'Memverifikasi...' : 'Masuk ke Sistem (Enter)'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
