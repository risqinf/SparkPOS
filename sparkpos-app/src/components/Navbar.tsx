import React from 'react';
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
  Lock,
  ArrowDownUp,
  Coffee,
  Users,
  Wrench,
} from 'lucide-react';
import { Shift, StoreProfile, Employee } from '../types/pos';

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
  onOpenBreakTime?: () => void;
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
  onOpenBreakTime,
  onOpenCashierManagement,
}) => {
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const isAdmin = currentUser?.role === 'owner' || currentUser?.role === 'admin';
  const isTechnician = currentUser?.role === 'teknisi' || currentUser?.role === 'supervisor';

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
    <header className="h-13 bg-zinc-900 border-b border-zinc-800 px-3 lg:px-4 flex items-center justify-between shrink-0 shadow-xs select-none z-20 w-full">
      {/* ================= BRAND & STORE PROFILE ================= */}
      <div className="flex items-center gap-2.5">
        {/* Custom Logo or Default Minimal Emblem */}
        {storeProfile.appLogo ? (
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center p-0.5 shrink-0">
            <img
              src={storeProfile.appLogo}
              alt="Logo"
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center text-emerald-400 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
        )}

        <div>
          <div className="flex items-center gap-1.5 leading-none">
            <span className="font-bold text-sm text-zinc-100 tracking-tight">
              {storeProfile.appName || 'SparkPOS'}
            </span>
            <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              Desktop
            </span>
          </div>
          <div className="text-[11px] text-zinc-400 flex items-center gap-1 font-medium mt-0.5 leading-none">
            <Store className="w-3 h-3 text-zinc-500 shrink-0" />
            <span className="truncate max-w-[150px] text-zinc-300">{storeProfile.storeName}</span>
            {storeProfile.branchName && (
              <>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400 truncate max-w-[120px]">{storeProfile.branchName}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ================= MAIN NAVIGATION TABS ================= */}
      <nav className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
        {/* Tab 1: Kasir POS */}
        <button
          onClick={() => handleTabClick('pos')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
            currentTab === 'pos'
              ? 'bg-zinc-800 text-zinc-100 shadow-xs border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
          title="Terminal Kasir Penjualan (F1)"
        >
          <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
          <span>Kasir (POS)</span>
          <kbd className="hidden md:inline-block px-1 py-0.2 text-[8px] bg-zinc-900 rounded text-zinc-400 font-mono border border-zinc-800">
            F1
          </kbd>
        </button>

        {/* Tab 2: Service Komputer & Laptop */}
        <button
          onClick={() => handleTabClick('service')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
            currentTab === 'service'
              ? 'bg-zinc-800 text-zinc-100 shadow-xs border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
          title="Kelola Servis Komputer & Laptop (F2)"
        >
          <Wrench className="w-3.5 h-3.5 text-amber-400" />
          <span>Service</span>
          <kbd className="hidden md:inline-block px-1 py-0.2 text-[8px] bg-zinc-900 rounded text-zinc-400 font-mono border border-zinc-800">
            F2
          </kbd>
        </button>

        {/* Tab 3: Stok & Produk */}
        <button
          onClick={() => handleTabClick('stock')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
            currentTab === 'stock'
              ? 'bg-zinc-800 text-zinc-100 shadow-xs border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
          title="Katalog Produk & Manajemen Stok (F3)"
        >
          <Boxes className="w-3.5 h-3.5 text-zinc-400" />
          <span>Stok</span>
          <kbd className="hidden md:inline-block px-1 py-0.2 text-[8px] bg-zinc-900 rounded text-zinc-400 font-mono border border-zinc-800">
            F3
          </kbd>
        </button>

        {/* Tab 4: Transaksi & Rekap Keuangan */}
        <button
          onClick={() => handleTabClick('reports')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
            currentTab === 'reports'
              ? 'bg-zinc-800 text-zinc-100 shadow-xs border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
          title="Menu Riwayat Transaksi, Rekap Harian & Bulanan Tgl 1 (F7)"
        >
          <Receipt className="w-3.5 h-3.5 text-emerald-400" />
          <span>Transaksi & Rekap</span>
          <kbd className="hidden md:inline-block px-1 py-0.2 text-[8px] bg-zinc-900 rounded text-zinc-400 font-mono border border-zinc-800">
            F7
          </kbd>
        </button>

        {/* Settings Tab - Restricted to Admin */}
        <button
          onClick={() => handleTabClick('settings')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
            currentTab === 'settings'
              ? 'bg-zinc-800 text-zinc-100 shadow-xs border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
          title={isAdmin ? 'Pengaturan Brand, Logo, Hardware & Relokasi Database' : 'Khusus Administrator (Terkunci)'}
        >
          <Settings className="w-3.5 h-3.5 text-zinc-400" />
          <span>Pengaturan</span>
          {!isAdmin && (
            <Lock className="w-3 h-3 text-zinc-500" />
          )}
        </button>
      </nav>

      {/* ================= RIGHT CONTROLS: HELD, SHIFT, USER PROFILE & LOGOUT ================= */}
      {/* ================= RIGHT CONTROLS: HELD, SHIFT, USER PROFILE & LOGOUT ================= */}
      <div className="flex items-center gap-1.5">
        {/* Kelola Kasir (Owner Only) */}
        {isAdmin && onOpenCashierManagement && (
          <button
            onClick={onOpenCashierManagement}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition"
            title="Kelola Data Kasir & Shift Kerja (Khusus Owner)"
          >
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">Kelola Kasir</span>
          </button>
        )}

        {/* Arus Kas (Uang Masuk / Keluar) */}
        {onOpenCashFlow && (
          <button
            onClick={onOpenCashFlow}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-medium transition"
            title="Catat Uang Masuk / Keluar (Operasional, Beli Makan, dll)"
          >
            <ArrowDownUp className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">Uang Kas</span>
          </button>
        )}

        {/* Istirahat Kasir (Break Mode Lock) */}
        {onOpenBreakTime && (
          <button
            onClick={onOpenBreakTime}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-amber-500/10 hover:border-amber-500/40 border border-zinc-800 text-amber-300 text-xs font-medium transition"
            title="Kunci Layar Kasir Saat Sedang Istirahat"
          >
            <Coffee className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Istirahat</span>
          </button>
        )}

        {/* Held Carts / Parkir */}
        <button
          onClick={openHeldModal}
          className="relative flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-medium transition"
          title="Antrean Transaksi Tertahan / Parkir (F6)"
        >
          <PauseCircle className="w-3.5 h-3.5 text-zinc-400" />
          <span className="hidden sm:inline">Parkir</span>
          {heldCount > 0 && (
            <span className="flex items-center justify-center px-1.5 py-0.2 rounded-full bg-zinc-700 text-white font-bold text-[9px]">
              {heldCount}
            </span>
          )}
          <kbd className="px-1 text-[8px] bg-zinc-900 rounded text-zinc-400 font-mono border border-zinc-800">
            F6
          </kbd>
        </button>

        {/* Active Shift Indicator */}
        <button
          onClick={openShiftModal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs transition"
          title="Klik untuk melihat rincian shift kasir atau tutup shift"
        >
          <Clock className="w-3.5 h-3.5 text-zinc-400" />
          <div className="text-left leading-tight">
            <div className="flex items-center gap-1">
              <span className="text-zinc-500 text-[9px] block font-mono">Shift #{activeShift?.id || 1}</span>
              {currentUser?.shiftSchedule && (
                <span className="text-[9px] text-emerald-400 font-medium truncate max-w-[90px] hidden sm:inline">
                  • {currentUser.shiftSchedule}
                </span>
              )}
            </div>
            <span className="font-semibold text-zinc-200 text-[11px] truncate max-w-[110px] block">
              {activeShift?.cashierName || 'Kasir'}
            </span>
          </div>
        </button>

        {/* Current User Badge (Owner vs Teknisi vs Kasir) */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800">
          {isAdmin ? (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          ) : currentUser?.role === 'teknisi' || currentUser?.role === 'supervisor' ? (
            <Users className="w-3.5 h-3.5 text-sky-400" />
          ) : (
            <User className="w-3.5 h-3.5 text-zinc-400" />
          )}
          <div className="text-left leading-none">
            <span className="text-[11px] font-semibold text-zinc-200 block truncate max-w-[80px]">
              {currentUser?.fullName?.split(' ')[0] || 'User'}
            </span>
            <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider block mt-0.5">
              {isAdmin
                ? 'Owner'
                : currentUser?.role === 'teknisi' || currentUser?.role === 'supervisor'
                ? 'Teknisi'
                : 'Kasir'}
            </span>
          </div>
        </div>

        {/* Tombol Logout / Ganti Kasir (Jelas & Menonjol) */}
        <button
          onClick={onLogout}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-white text-xs font-bold transition shadow-xs"
          title="Logout / Ganti Akun Kasir (Kembali ke Layar PIN)"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-400" />
          <span className="inline whitespace-nowrap">Ganti Kasir</span>
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-100 transition"
          title="Layar Penuh (F11)"
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </header>
  );
};
