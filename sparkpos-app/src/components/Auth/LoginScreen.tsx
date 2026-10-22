import React, { useState, useEffect } from 'react';
import {
  Lock,
  User,
  ShieldCheck,
  Store,
  ArrowRight,
  Delete,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Employee, StoreProfile } from '../../types/pos';
import { authenticateEmployee, db } from '../../services/storage';
import { playSuccessBeep, playErrorBeep } from '../../services/scanner';

interface LoginScreenProps {
  storeProfile: StoreProfile;
  onLoginSuccess: (employee: Employee) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ storeProfile, onLoginSuccess }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedUser, setSelectedUser] = useState<Employee | null>(null);
  const [pin, setPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const loadEmps = async () => {
      const all = await db.employees.toArray();
      const list = all.filter((e) => e.isActive !== false);
      setEmployees(list);
      if (list.length > 0) {
        // default select cashier or admin
        setSelectedUser(list[0]);
      }
    };
    loadEmps();
  }, []);

  const handleNumpadClick = (digit: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + digit);
      setErrorMessage(null);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  };

  const handleClear = () => {
    setPin('');
    setErrorMessage(null);
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin) {
      setErrorMessage('Silakan masukkan PIN otentikasi.');
      playErrorBeep();
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      let authUser: Employee | null = null;
      if (selectedUser) {
        authUser = await authenticateEmployee(selectedUser.username, pin);
      } else {
        authUser = await authenticateEmployee(pin);
      }

      if (authUser) {
        playSuccessBeep();
        onLoginSuccess(authUser);
      } else {
        playErrorBeep();
        setErrorMessage('PIN tidak sesuai! Silakan periksa kembali.');
        setPin('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Physical keyboard listener for digits, Enter and Backspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleNumpadClick(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter') {
        handleLogin();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, selectedUser]);

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 select-none overflow-hidden items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[560px]">
        {/* ================= LEFT SIDE: BRANDING & PROFILE (5 cols) ================= */}
        <div className="md:col-span-5 bg-slate-900/60 p-8 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col justify-between">
          <div>
            {/* Store & App Logo */}
            <div className="flex items-center gap-3 mb-6">
              {storeProfile.appLogo ? (
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 p-1 flex items-center justify-center shrink-0">
                  <img
                    src={storeProfile.appLogo}
                    alt="Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-6 h-6" />
                </div>
              )}
              <div>
                <h1 className="font-extrabold text-xl text-white tracking-tight">
                  {storeProfile.appName || 'SparkPOS'}
                </h1>
                <span className="text-[11px] text-slate-400 font-medium block">
                  Desktop Retail Offline System
                </span>
              </div>
            </div>

            {/* Store Identity Box */}
            <div className="p-4 rounded-xl bg-slate-850/80 border border-slate-800 space-y-1.5 mb-6">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <Store className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{storeProfile.storeName}</span>
              </div>
              {storeProfile.branchName && (
                <p className="text-xs text-slate-400 pl-5">{storeProfile.branchName}</p>
              )}
              {storeProfile.address && (
                <p className="text-[11px] text-slate-500 pl-5 line-clamp-2">{storeProfile.address}</p>
              )}
            </div>

            {/* Role Explanation Note */}
            <div className="space-y-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-300 block uppercase tracking-wider text-[10px]">
                Hak Akses Sistem (RBAC):
              </span>
              <div className="p-2.5 rounded-lg bg-slate-850/50 border border-slate-800 text-[11px] space-y-1">
                <div className="text-slate-300 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>1. Administrator / Owner:</span>
                </div>
                <p className="text-slate-400 pl-2.5">
                  Akses penuh: kelola stok, opname, laporan finansial, kustomisasi nama brand & upload logo toko.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-850/50 border border-slate-800 text-[11px] space-y-1">
                <div className="text-slate-300 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  <span>2. Non-Admin (Kasir):</span>
                </div>
                <p className="text-slate-400 pl-2.5">
                  Akses operasional: transaksi penjualan, scan barcode, tutup kasir shift, & cetak struk (pengaturan brand terkunci).
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
            <span className="font-mono text-slate-400">v1.2.0</span>
          </div>
        </div>

        {/* ================= RIGHT SIDE: TOUCH NUMPAD & PIN LOGIN (7 cols) ================= */}
        <div className="md:col-span-7 p-8 flex flex-col justify-between bg-slate-900">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">Pilih Akun & Masukkan PIN</h2>
              <span className="text-xs text-slate-400 font-mono">SparkPOS v1.2.0</span>
            </div>

            {/* Select User Role Buttons */}
            <div className="grid grid-cols-2 gap-2.5 mb-5">
              {employees.map((emp) => {
                const isSelected = selectedUser?.id === emp.id;
                const isAdmin = emp.role === 'admin';
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => {
                      setSelectedUser(emp);
                      setPin('');
                      setErrorMessage(null);
                    }}
                    className={`p-3 rounded-xl border text-left transition ${
                      isSelected
                        ? 'bg-slate-800 border-slate-600 shadow-md text-white'
                        : 'bg-slate-850 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900 text-slate-300">
                        {isAdmin ? 'Administrator' : 'Non-Admin / Kasir'}
                      </span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      )}
                    </div>
                    <div className="font-semibold text-xs text-white truncate">{emp.fullName}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                      User: @{emp.username}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* PIN Dots Display */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 px-1">
                <span>PIN Akses ({selectedUser?.fullName}):</span>
                <span className="font-mono text-[11px] text-slate-500">
                  {selectedUser?.role === 'admin' ? '6 Digit' : '4 Digit'}
                </span>
              </div>

              <div className="h-12 w-full bg-slate-950 border border-slate-800 rounded-xl px-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-500" />
                  <div className="flex items-center gap-2 tracking-widest text-lg font-mono text-emerald-400">
                    {pin ? '●'.repeat(pin.length) : (
                      <span className="text-xs text-slate-600 font-sans tracking-normal">
                        Ketik PIN pada numpad atau keyboard...
                      </span>
                    )}
                  </div>
                </div>

                {pin && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-[11px] text-slate-500 hover:text-slate-300"
                  >
                    Hapus
                  </button>
                )}
              </div>

              {errorMessage && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Tactile Touch Numpad */}
            <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleNumpadClick(digit)}
                  className="h-12 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-800 text-white font-bold text-lg active:scale-95 transition shadow-sm"
                >
                  {digit}
                </button>
              ))}

              <button
                type="button"
                onClick={handleClear}
                className="h-12 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-400 font-semibold text-xs active:scale-95 transition"
              >
                C
              </button>

              <button
                type="button"
                onClick={() => handleNumpadClick('0')}
                className="h-12 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-800 text-white font-bold text-lg active:scale-95 transition shadow-sm"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleBackspace}
                className="h-12 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-400 flex items-center justify-center active:scale-95 transition"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 max-w-xs mx-auto w-full">
            <button
              type="button"
              disabled={isLoading || pin.length === 0}
              onClick={() => handleLogin()}
              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg ${
                isLoading || pin.length === 0
                  ? 'bg-slate-800 text-slate-600 border border-slate-700/60 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40 active:scale-95'
              }`}
            >
              <span>Masuk ke Sistem (Enter)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
