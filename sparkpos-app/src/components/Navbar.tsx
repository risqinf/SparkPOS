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
} from 'lucide-react';
import { Shift, StoreProfile, Employee } from '../types/pos';

interface NavbarProps {
  currentTab: 'pos' | 'stock' | 'reports' | 'settings';
  setCurrentTab: (tab: 'pos' | 'stock' | 'reports' | 'settings') => void;
  activeShift: Shift | null;
  heldCount: number;
  openHeldModal: () => void;
  openShiftModal: () => void;
  storeProfile: StoreProfile;
  currentUser: Employee | null;
  onLogout: () => void;
  onRequestAdminAccess?: () => void;
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
}) => {
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const isAdmin = currentUser?.role === 'admin';

  const handleTabClick = (tab: 'pos' | 'stock' | 'reports' | 'settings') => {
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
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 shadow-md select-none z-20">
      {/* ================= BRAND & STORE PROFILE ================= */}
      <div className="flex items-center gap-3">
        {/* Custom Logo or Default Minimal Emblem */}
        {storeProfile.appLogo ? (
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center p-1 shrink-0">
            <img
              src={storeProfile.appLogo}
              alt="Logo"
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-emerald-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
        )}

        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-base text-white tracking-tight">
              {storeProfile.appName || 'SparkPOS'}
            </span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
              Desktop Native
            </span>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
            <Store className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate max-w-[180px] text-slate-300">{storeProfile.storeName}</span>
            {storeProfile.branchName && (
              <>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400 truncate max-w-[140px]">{storeProfile.branchName}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ================= MAIN NAVIGATION TABS ================= */}
      <nav className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => handleTabClick('pos')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
            currentTab === 'pos'
              ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
          title="Terminal Kasir Penjualan (F1)"
        >
          <ShoppingCart className="w-4 h-4 text-emerald-400" />
          <span>Kasir (POS)</span>
          <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[9px] bg-slate-900 rounded text-slate-400 font-mono border border-slate-800">
            F1
          </kbd>
        </button>

        <button
          onClick={() => handleTabClick('stock')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
            currentTab === 'stock'
              ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
          title="Katalog Produk & Manajemen Stok (F3)"
        >
          <Boxes className="w-4 h-4 text-slate-300" />
          <span>Stok & Produk</span>
          <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[9px] bg-slate-900 rounded text-slate-400 font-mono border border-slate-800">
            F3
          </kbd>
        </button>

        <button
          onClick={() => handleTabClick('reports')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
            currentTab === 'reports'
              ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
          title="Riwayat Transaksi Penjualan (F7)"
        >
          <Receipt className="w-4 h-4 text-slate-300" />
          <span>Riwayat Penjualan</span>
          <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[9px] bg-slate-900 rounded text-slate-400 font-mono border border-slate-800">
            F7
          </kbd>
        </button>

        {/* Settings Tab - Restricted to Admin */}
        <button
          onClick={() => handleTabClick('settings')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
            currentTab === 'settings'
              ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
          title={isAdmin ? 'Pengaturan Brand, Logo & Hardware' : 'Khusus Administrator (Terkunci)'}
        >
          <Settings className="w-4 h-4 text-slate-300" />
          <span>Pengaturan</span>
          {!isAdmin && (
            <Lock className="w-3 h-3 text-slate-500" />
          )}
        </button>
      </nav>

      {/* ================= RIGHT CONTROLS: HELD, SHIFT, USER PROFILE & LOGOUT ================= */}
      <div className="flex items-center gap-2.5">
        {/* Held Carts / Parkir */}
        <button
          onClick={openHeldModal}
          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700/80 text-slate-300 text-xs font-medium transition"
          title="Antrean Transaksi Tertahan / Parkir (F6)"
        >
          <PauseCircle className="w-4 h-4 text-slate-400" />
          <span className="hidden sm:inline">Parkir</span>
          {heldCount > 0 && (
            <span className="flex items-center justify-center px-1.5 py-0.2 rounded-full bg-slate-700 text-white font-bold text-[10px]">
              {heldCount}
            </span>
          )}
          <kbd className="px-1 text-[9px] bg-slate-900 rounded text-slate-400 font-mono border border-slate-800">
            F6
          </kbd>
        </button>

        {/* Active Shift Indicator */}
        <button
          onClick={openShiftModal}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700/80 text-slate-300 text-xs transition"
          title="Klik untuk melihat shift kasir atau tutup kasir"
        >
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <div className="text-left leading-tight">
            <span className="text-slate-400 text-[10px] block">Shift #{activeShift?.id || 1}</span>
            <span className="font-semibold text-slate-200 text-xs truncate max-w-[90px] block">
              {activeShift?.cashierName || 'Kasir'}
            </span>
          </div>
        </button>

        {/* Current User Badge (Admin vs Non-Admin) */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800">
          {isAdmin ? (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <User className="w-3.5 h-3.5 text-slate-400" />
          )}
          <div className="text-left leading-none">
            <span className="text-[11px] font-semibold text-slate-200 block truncate max-w-[100px]">
              {currentUser?.fullName?.split(' ')[0] || 'User'}
            </span>
            <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider block mt-0.5">
              {isAdmin ? 'Admin' : 'Kasir'}
            </span>
          </div>
        </div>

        {/* Logout / Switch User */}
        <button
          onClick={onLogout}
          className="p-2 rounded-xl bg-slate-850 hover:bg-rose-500/10 border border-slate-700/80 text-slate-400 hover:text-rose-400 transition"
          title="Ganti Pengguna / Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700/80 text-slate-400 hover:text-white transition"
          title="Layar Penuh (F11)"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
