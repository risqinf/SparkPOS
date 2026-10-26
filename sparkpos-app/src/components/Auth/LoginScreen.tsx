import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  User,
  Sparkles,
  Sun,
  Moon,
  Monitor,
  AlertCircle,
  ArrowRight,
  Loader2,
  Store,
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
  const [username, setUsername] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const usernameInputRef = useRef<HTMLInputElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = onThemeChange((mode) => {
      setThemeMode(mode);
    });
    return unsub;
  }, []);

  // Autofocus username input on mount
  useEffect(() => {
    usernameInputRef.current?.focus();
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedUser = username.trim();
    if (!trimmedUser) {
      setErrorMessage('Silakan masukkan username kasir / akun Anda!');
      playErrorBeep();
      usernameInputRef.current?.focus();
      return;
    }

    if (!pin) {
      setErrorMessage('Silakan masukkan PIN otentikasi!');
      playErrorBeep();
      pinInputRef.current?.focus();
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. Cek keberadaan user
      const allUsers = await db.employees.toArray();
      const existingUser = allUsers.find(
        (emp) => emp.username.toLowerCase() === trimmedUser.toLowerCase() && emp.isActive !== false
      );

      if (!existingUser) {
        playErrorBeep();
        setErrorMessage(`Username "@${trimmedUser}" tidak terdaftar atau nonaktif!`);
        usernameInputRef.current?.focus();
        return;
      }

      // 2. Verifikasi PIN
      const authUser = await authenticateEmployee(trimmedUser, pin.trim());

      if (authUser) {
        playSuccessBeep();
        onLoginSuccess(authUser);
      } else {
        playErrorBeep();
        setErrorMessage('PIN yang Anda masukkan salah. Silakan coba lagi!');
        setPin('');
        pinInputRef.current?.focus();
      }
    } catch (err) {
      console.error('Login error:', err);
      setErrorMessage('Terjadi kesalahan saat otentikasi sistem.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 items-center justify-center p-4 relative select-none">
      {/* Theme Switcher Button Top-Right */}
      <div className="absolute top-4 right-4 z-20">
        <button
          type="button"
          onClick={() => {
            const next = cycleTheme();
            setThemeMode(next);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold shadow-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          title="Klik untuk beralih antara Sistem / Terang / Gelap"
        >
          {themeMode === 'system' && <Monitor className="w-3.5 h-3.5 text-sky-500" />}
          {themeMode === 'light' && <Sun className="w-3.5 h-3.5 text-amber-500" />}
          {themeMode === 'dark' && <Moon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
          <span className="text-[11px]">
            {themeMode === 'system'
              ? 'Sistem'
              : themeMode === 'light'
              ? 'Mode Terang'
              : 'Mode Gelap'}
          </span>
        </button>
      </div>

      {/* Centered Minimalist Login Card */}
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-3xl shadow-2xl p-8 sm:p-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header: Logo + Store Name + Subtitle */}
        <div className="flex flex-col items-center text-center mb-8">
          {storeProfile.appLogo ? (
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center mb-3 shadow-xs">
              <img
                src={storeProfile.appLogo}
                alt="Logo Toko"
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 shadow-xs">
              <Sparkles className="w-8 h-8" />
            </div>
          )}

          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {storeProfile.storeName || 'SparkPOS Retail'}
          </h1>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1 flex items-center gap-1">
            <Store className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Sistem Kasir & Operasional Toko</span>
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5 text-xs font-semibold text-rose-800 dark:text-rose-200 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* Clean Keyboard-Only Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          {/* Input Username */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300 mb-1.5">
              Username Kasir / Admin
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-slate-400 dark:text-slate-500">
                <User className="w-4 h-4" />
              </span>
              <input
                ref={usernameInputRef}
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setErrorMessage(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (username.trim()) {
                      pinInputRef.current?.focus();
                    } else {
                      handleLogin();
                    }
                  }
                }}
                placeholder="Masukkan username akun..."
                autoComplete="username"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 focus:border-emerald-600 dark:focus:border-emerald-500 rounded-xl text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition shadow-inner"
              />
            </div>
          </div>

          {/* Input PIN / Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300">
                PIN Keamanan
              </label>
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Gunakan keyboard fisik
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-slate-400 dark:text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                ref={pinInputRef}
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="Masukkan PIN otentikasi..."
                autoComplete="current-password"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 focus:border-emerald-600 dark:focus:border-emerald-500 rounded-xl text-sm font-black text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 tracking-wider focus:outline-none transition shadow-inner"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-sm font-extrabold shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <>
                <span>Masuk ke Kasir</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Shortcut Helper */}
        <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800 text-center">
          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            Tekan <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-200 font-bold text-[10px]">Enter</kbd> untuk login langsung dari keyboard
          </p>
        </div>
      </div>
    </div>
  );
};
