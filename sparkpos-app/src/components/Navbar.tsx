import React, { useState, useEffect } from 'react';
import {
  Store,
  ShoppingCart,
  Boxes,
  Receipt,
  Settings,
  Clock,
  Maximize2,
  Minimize2,
  PauseCircle,
  Sparkles,
  User,
  ShieldCheck,
  LogOut,
  ArrowDownUp,
  Users,
  Wrench,
  Sun,
  Moon,
  Monitor,
  TrendingUp,
} from 'lucide-react';
import { Shift, StoreProfile, Employee } from '../types/pos';
import { getSavedTheme, cycleTheme, onThemeChange, ThemeMode } from '../services/theme';

interface NavbarProps {
  currentTab: 'pos' | 'service' | 'stock' | 'reports' | 'settings';
  setCurrentTab: (tab: 'pos' | 'service' | 'stock' | 'reports' | 'settings') => void;
  activeShift: Shift | null;
  heldCount: number;
  openHeldModal: () => void;
  openShiftModal: () => void;
  storeProfile: StoreProfile;
  currentUser: Employee | null;
  onLogout: () => void;
  onRequestAdminAccess?: () => void;
  onOpenCashFlow?: () => void;
  onOpenCashierManagement?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  activeShift,
  heldCount,
  openHeldModal,
  openShiftModal,
  storeProfile,
  currentUser,
  onLogout,
  onRequestAdminAccess,
  onOpenCashFlow,
  onOpenCashierManagement,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getSavedTheme());

  useEffect(() => {
    const unsub = onThemeChange((mode) => {
      setThemeMode(mode);
    });
    return unsub;
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const handleToggleTheme = () => {
    const next = cycleTheme();
    setThemeMode(next);
  };

  const isAdmin = currentUser?.role === 'owner' || currentUser?.role === 'admin';

  const handleTabClick = (tab: 'pos' | 'service' | 'stock' | 'reports' | 'settings') => {
    if (tab === 'settings' && !isAdmin) {
      if (onRequestAdminAccess) {
        onRequestAdminAccess();
      } else {
        alert('Akses Terbatas: Menu Pengaturan Toko & Logo hanya dapat diakses oleh Administrator.');
      }
      return;
    }
    setCurrentTab(tab);
  };

  return (
    <header className="h-11 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-2 lg:px-3 flex items-center justify-between shrink-0 shadow-xs select-none z-30 w-full text-slate-800 dark:text-zinc-100 transition-colors">
      {/* ================= LEFT: BRAND & STORE PROFILE ================= */}
      <div className="flex items-center gap-2 shrink-0 pr-2 border-r border-slate-200 dark:border-zinc-800">
        {storeProfile.appLogo ? (
          <div className="w-7 h-7 rounded-lg overflow-hidden bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex items-center justify-center p-0.5 shrink-0">
            <img
              src={storeProfile.appLogo}
              alt="Logo"
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-zinc-950 border border-emerald-200 dark:border-zinc-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        )}

        <div className="leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-xs text-slate-900 dark:text-zinc-100 tracking-tight">
              {storeProfile.appName || 'SparkPOS'}
            </span>
            <span className="text-[8px] font-semibold px-1 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 uppercase">
              Pro
            </span>
          </div>
          <div className="text-[10px] text-slate-700 dark:text-zinc-300 flex items-center gap-1 font-semibold truncate max-w-[130px] lg:max-w-[160px]">
            <Store className="w-2.5 h-2.5 text-slate-500 dark:text-zinc-400 shrink-0" />
            <span className="truncate">{storeProfile.storeName}</span>
          </div>
        </div>
      </div>

      {/* ================= MIDDLE & RIGHT CONTROLS WRAPPER (SCROLLABLE ON NARROW SCREENS) ================= */}
      <div className="flex-1 flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar pl-2 py-0.5 min-w-0">
        {/* ================= MAIN NAVIGATION TABS ================= */}
        <nav className="flex items-center gap-0.5 bg-slate-100 dark:bg-zinc-950 p-0.5 rounded-lg border border-slate-200 dark:border-zinc-800 shrink-0">
          {/* Tab 1: Kasir POS */}
          <button
            onClick={() => handleTabClick('pos')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition ${
              currentTab === 'pos'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs border border-slate-200 dark:border-zinc-700'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-900'
            }`}
            title="Terminal Kasir Penjualan (F1)"
          >
            <ShoppingCart className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Kasir</span>
            <kbd className="hidden xl:inline-block px-1 py-0.2 text-[8px] bg-slate-200 dark:bg-zinc-900 rounded text-slate-500 dark:text-zinc-400 font-mono">
              F1
            </kbd>
          </button>

          {/* Tab 2: Service Komputer, Laptop, Printer */}
          <button
            onClick={() => handleTabClick('service')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition ${
              currentTab === 'service'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs border border-slate-200 dark:border-zinc-700'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-900'
            }`}
            title="Kelola Servis Komputer, Laptop & Printer (F2)"
          >
            <Wrench className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Service</span>
            <kbd className="hidden xl:inline-block px-1 py-0.2 text-[8px] bg-slate-200 dark:bg-zinc-900 rounded text-slate-500 dark:text-zinc-400 font-mono">
              F2
            </kbd>
          </button>

          {/* Tab 3: Stok Produk & Sparepart */}
          <button
            onClick={() => handleTabClick('stock')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition ${
              currentTab === 'stock'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs border border-slate-200 dark:border-zinc-700'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-900'
            }`}
            title="Katalog Produk, Stok & Sparepart (F3)"
          >
            <Boxes className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
            <span>Stok</span>
            <kbd className="hidden xl:inline-block px-1 py-0.2 text-[8px] bg-slate-200 dark:bg-zinc-900 rounded text-slate-500 dark:text-zinc-400 font-mono">
              F3
            </kbd>
          </button>

          {/* Tab 4: Laporan Keuangan */}
          <button
            onClick={() => handleTabClick('reports')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition ${
              currentTab === 'reports'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs border border-slate-200 dark:border-zinc-700'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-900'
            }`}
            title="Laporan Keuangan, Omset, Laba Bersih & Riwayat Transaksi Lengkap (F7)"
          >
            <TrendingUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Laporan Keuangan</span>
            <kbd className="hidden xl:inline-block px-1 py-0.2 text-[8px] bg-slate-200 dark:bg-zinc-900 rounded text-slate-500 dark:text-zinc-400 font-mono">
              F7
            </kbd>
          </button>

          {/* Tab 5: Settings Tab (Owner Only) */}
          {isAdmin && (
            <button
              onClick={() => handleTabClick('settings')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition ${
                currentTab === 'settings'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs border border-slate-200 dark:border-zinc-700'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-900'
              }`}
              title="Pengaturan Brand, Logo, Hardware & Relokasi Database"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 shrink-0" />
              <span>Pengaturan</span>
            </button>
          )}
        </nav>

        {/* ================= RIGHT ACTION BUTTONS ================= */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {/* Kelola Kasir (Owner Only) */}
          {isAdmin && onOpenCashierManagement && (
            <button
              onClick={onOpenCashierManagement}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold transition shrink-0"
              title="Kelola Data Kasir & Shift Kerja (Khusus Owner)"
            >
              <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Kelola Kasir</span>
            </button>
          )}

          {/* Arus Kas (Uang Kas Masuk / Keluar) */}
          {onOpenCashFlow && (
            <button
              onClick={onOpenCashFlow}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-zinc-950 hover:bg-slate-200 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-medium transition shrink-0"
              title="Catat Uang Masuk / Keluar (Operasional, Beli Makan, dll)"
            >
              <ArrowDownUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden md:inline">Uang Kas</span>
            </button>
          )}

          {/* Held Carts / Parkir */}
          <button
            onClick={openHeldModal}
            className="relative flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-zinc-950 hover:bg-slate-200 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-medium transition shrink-0"
            title="Antrean Transaksi Tertahan / Parkir (F6)"
          >
            <PauseCircle className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
            <span className="hidden md:inline">Parkir</span>
            {heldCount > 0 && (
              <span className="flex items-center justify-center px-1.5 py-0.2 rounded-full bg-slate-700 dark:bg-zinc-700 text-white font-bold text-[9px]">
                {heldCount}
              </span>
            )}
            <kbd className="hidden lg:inline-block px-1 text-[8px] bg-slate-200 dark:bg-zinc-900 rounded text-slate-500 dark:text-zinc-400 font-mono">
              F6
            </kbd>
          </button>

          {/* Kas Hari Ini (Shortcut Langsung ke Laporan Keuangan) */}
          <button
            onClick={() => handleTabClick('reports')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition shrink-0 cursor-pointer ${
              currentTab === 'reports'
                ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200'
                : 'bg-slate-100 dark:bg-zinc-950 hover:bg-slate-200 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
            }`}
            title="Klik untuk membuka Laporan Keuangan & Kas Hari Ini (07.00 - 16.30)"
          >
            <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <div className="text-left leading-tight hidden sm:block">
              <span className="text-slate-700 dark:text-zinc-300 text-[8px] block font-mono font-bold uppercase">
                Kas Hari Ini (07:00-16:30)
              </span>
              <span className="font-bold text-slate-800 dark:text-zinc-200 text-[10px] truncate max-w-[100px] block">
                {activeShift?.cashierName || 'Kasir'}
              </span>
            </div>
          </button>

          {/* Current User Badge */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shrink-0">
            {isAdmin ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : currentUser?.role === 'teknisi' || currentUser?.role === 'supervisor' ? (
              <Users className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            ) : (
              <User className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
            )}
            <div className="text-left leading-none">
              <span className="text-[10px] font-bold text-slate-800 dark:text-zinc-200 block truncate max-w-[70px]">
                {currentUser?.fullName?.split(' ')[0] || 'User'}
              </span>
              <span className="text-[7.5px] font-extrabold text-slate-700 dark:text-zinc-300 uppercase tracking-wider block">
                {isAdmin
                  ? 'Owner'
                  : currentUser?.role === 'teknisi' || currentUser?.role === 'supervisor'
                  ? 'Teknisi'
                  : 'Kasir'}
              </span>
            </div>
          </div>

          {/* ================= THEME SWITCHER BUTTON (System / Light / Dark) ================= */}
          <button
            onClick={handleToggleTheme}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-zinc-950 hover:bg-slate-200 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-semibold transition shrink-0 cursor-pointer"
            title={`Tema Saat Ini: ${
              themeMode === 'system'
                ? 'Mengikuti Sistem (Default)'
                : themeMode === 'light'
                ? 'Terang (Light Mode)'
                : 'Gelap (Dark Mode)'
            }. Klik untuk ganti.`}
          >
            {themeMode === 'system' && (
              <>
                <Monitor className="w-3.5 h-3.5 text-sky-500" />
                <span className="hidden xl:inline text-[10px]">Sistem</span>
              </>
            )}
            {themeMode === 'light' && (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden xl:inline text-[10px]">Terang</span>
              </>
            )}
            {themeMode === 'dark' && (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden xl:inline text-[10px]">Gelap</span>
              </>
            )}
          </button>

          {/* ================= TOMBOL LOGOUT (ALWAYS VISIBLE, PROMINENT & SOLID) ================= */}
          {onLogout && (
            <button
              onClick={() => {
                if (confirm(`Logout dari akun ${currentUser?.fullName || 'ini'} dan kembali ke layar PIN?`)) {
                  onLogout();
                }
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold transition shadow-xs cursor-pointer shrink-0 ml-0.5"
              title="Keluar / Logout Akun (Kembali ke Layar PIN)"
            >
              <LogOut className="w-3.5 h-3.5 text-white" />
              <span>Logout</span>
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-zinc-950 hover:bg-slate-200 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 transition shrink-0"
            title="Layar Penuh (F11)"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </header>
  );
};
