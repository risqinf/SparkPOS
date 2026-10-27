import React, { useState, useEffect } from 'react';
import {
  isStoreConfigured,
  getStoreProfile,
  DEFAULT_STORE_PROFILE,
  ensureDatabaseCompatibility,
  getTodayCashRegister,
  setTodayOpeningCash,
  db,
} from './services/storage';
import { StoreProfile, Shift, HeldCart, Employee } from './types/pos';
import { Navbar } from './components/Navbar';
import { POSTerminal } from './components/POS/POSTerminal';
import { StockManagement } from './components/Stock/StockManagement';
import { TransactionHistory } from './components/Reports/TransactionHistory';
import { StoreSettings } from './components/Settings/StoreSettings';
import { LoginScreen } from './components/Auth/LoginScreen';
import { AdminPinModal } from './components/Auth/AdminPinModal';
import { FirstTimeSetup } from './components/Auth/FirstTimeSetup';
import { CashierManagementModal } from './components/Owner/CashierManagementModal';
import { DailyOpeningCashModal } from './components/Auth/DailyOpeningCashModal';
import { CashFlowModal } from './components/POS/CashFlowModal';
import { ServiceDashboard } from './components/Service/ServiceDashboard';
import { applyTheme, initThemeListener } from './services/theme';
import { ShortcutHelp } from './components/ShortcutHelp';
import { isDialogOpen } from './hooks/useDialog';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [currentTab, setCurrentTab] = useState<'pos' | 'service' | 'stock' | 'reports' | 'settings'>('pos');
  const [storeProfile, setStoreProfile] = useState<StoreProfile>(DEFAULT_STORE_PROFILE);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);

  // Modals
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState(false);
  const [isCashFlowOpen, setIsCashFlowOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isCashierManagementOpen, setIsCashierManagementOpen] = useState(false);
  const [isOpeningCashModalOpen, setIsOpeningCashModalOpen] = useState(false);

  // Initialize DB and load global state
  const initializeApp = async () => {
    try {
      // 1. Pastikan kompatibilitas skema database & upgrade kategori/satuan otomatis
      await ensureDatabaseCompatibility();

      const configured = await isStoreConfigured();
      setIsConfigured(configured);

      if (!configured) {
        setIsReady(true);
        return;
      }

      const profile = await getStoreProfile();
      setStoreProfile(profile);

      // Selalu mulai di layar login PIN agar setiap login wajib memasukkan username & PIN yang jelas
      localStorage.removeItem('sparkpos_current_user');
      setCurrentUser(null);
      setActiveShift(null);

      // Load held carts
      const held = await db.heldCarts.toArray();
      setHeldCarts(held);

      setIsReady(true);
    } catch (err) {
      console.error('Failed to initialize local SparkPOS DB', err);
      setIsReady(true);
    }
  };

  useEffect(() => {
    applyTheme();
    const cleanup = initThemeListener();
    initializeApp();
    return () => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, []);

  const handleSetupComplete = (
    adminEmployee: Employee,
    profile: StoreProfile,
    loginAsCashier?: boolean,
    cashierEmployee?: Employee
  ) => {
    setStoreProfile(profile);
    setIsConfigured(true);
    setIsReady(true);
    if (loginAsCashier && cashierEmployee) {
      handleLoginSuccess(cashierEmployee);
    } else if (loginAsCashier) {
      setCurrentUser(null);
      setActiveShift(null);
      localStorage.removeItem('sparkpos_current_user');
    } else {
      setCurrentUser(adminEmployee);
      localStorage.setItem('sparkpos_current_user', JSON.stringify(adminEmployee));
      setCurrentTab('pos');
    }
  };

  const handleLoginSuccess = async (employee: Employee) => {
    setCurrentUser(employee);
    localStorage.setItem('sparkpos_current_user', JSON.stringify(employee));

    // Cek apakah kasir ini SUDAH MEMILIKI shift aktif yang belum ditutup
    const allShifts = await db.shifts.toArray();
    const myOpenShift = allShifts.find((s) => !s.isClosed && s.cashierId === employee.id);

    // Cek Modal Awal Kasir Hari Ini (Wajib di awal hari untuk jam kerja 07.00 - 16.30)
    const todayReg = await getTodayCashRegister();

    if (myOpenShift) {
      if (todayReg && todayReg.openingCash > 0 && myOpenShift.openingCash === 0) {
        myOpenShift.openingCash = todayReg.openingCash;
        await db.shifts.update(myOpenShift.id, { openingCash: todayReg.openingCash });
      }
      // Sinkronisasi expectedCash dengan transaksi tunai riil agar terbebas dari bug selisih kembalian
      const shiftTxs = await db.transactions.where('shiftId').equals(myOpenShift.id).toArray();
      const realCashFromTxs = shiftTxs
        .filter((t) => t.status !== 'VOID' && t.status !== 'REFUNDED')
        .reduce((sum, t) => {
          const isCash = t.paymentMethod?.toUpperCase().includes('CASH');
          if (t.payments && t.payments.length > 0) {
            const cPay = t.payments
              .filter((p) => p.method?.toUpperCase().includes('CASH'))
              .reduce((s, p) => s + Math.min(p.amount || 0, t.grandTotal), 0);
            return sum + cPay;
          }
          return sum + (isCash ? t.grandTotal : 0);
        }, 0);
      const accurateExpected = (myOpenShift.openingCash || 0) + realCashFromTxs;
      if (myOpenShift.expectedCash !== accurateExpected) {
        myOpenShift.expectedCash = accurateExpected;
        await db.shifts.update(myOpenShift.id, { expectedCash: accurateExpected });
      }
      setActiveShift(myOpenShift);
    } else {
      // Buat shift baru untuk kasir ini
      const initialOpening = todayReg ? todayReg.openingCash : 0;
      const newShift: Shift = {
        id: (allShifts.length || 0) + 1,
        cashierId: employee.id,
        cashierName: employee.fullName,
        shiftName: 'Sesi Kasir Hari Ini (07.00 - 16.30)',
        startTime: new Date().toISOString(),
        openingCash: initialOpening,
        expectedCash: initialOpening,
        isClosed: false,
      };
      await db.shifts.add(newShift);
      setActiveShift(newShift);
    }

    // Jika belum ada data modal awal kasir untuk hari ini, munculkan modal wajib
    if (!todayReg) {
      setIsOpeningCashModalOpen(true);
    }

    // Default tab based on role: Teknisi goes to Service dashboard, others to POS
    if (employee.role === 'teknisi' || employee.role === 'supervisor') {
      setCurrentTab('service');
    } else {
      setCurrentTab('pos');
    }
  };

  const handleSaveOpeningCash = async (amount: number) => {
    if (!currentUser) return;
    await setTodayOpeningCash(amount, currentUser.id, currentUser.fullName);
    if (activeShift) {
      await db.shifts.update(activeShift.id, { openingCash: amount, expectedCash: amount });
      setActiveShift((prev) => (prev ? { ...prev, openingCash: amount, expectedCash: amount } : null));
    }
    setIsOpeningCashModalOpen(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveShift(null);
    localStorage.removeItem('sparkpos_current_user');
  };

  const handleAdminElevationSuccess = async () => {
    setIsAdminPinModalOpen(false);
    // Find admin user in DB
    const adminUser = await db.employees.where('role').equals('admin').first();
    if (adminUser) {
      setCurrentUser(adminUser);
      localStorage.setItem('sparkpos_current_user', JSON.stringify(adminUser));
    }
    setCurrentTab('settings');
  };

  const refreshHeldCarts = async () => {
    const list = await db.heldCarts.toArray();
    setHeldCarts(list);
  };

  const refreshShift = async () => {
    if (!currentUser) {
      setActiveShift(null);
      return;
    }
    const allShifts = await db.shifts.toArray();
    const myOpenShift = allShifts.find((s) => !s.isClosed && s.cashierId === currentUser.id);
    if (myOpenShift) {
      const shiftTxs = await db.transactions.where('shiftId').equals(myOpenShift.id).toArray();
      const realCashFromTxs = shiftTxs
        .filter((t) => t.status !== 'VOID' && t.status !== 'REFUNDED')
        .reduce((sum, t) => {
          const isCash = t.paymentMethod?.toUpperCase().includes('CASH');
          if (t.payments && t.payments.length > 0) {
            const cPay = t.payments
              .filter((p) => p.method?.toUpperCase().includes('CASH'))
              .reduce((s, p) => s + Math.min(p.amount || 0, t.grandTotal), 0);
            return sum + cPay;
          }
          return sum + (isCash ? t.grandTotal : 0);
        }, 0);
      const accurateExpected = (myOpenShift.openingCash || 0) + realCashFromTxs;
      if (myOpenShift.expectedCash !== accurateExpected) {
        myOpenShift.expectedCash = accurateExpected;
        await db.shifts.update(myOpenShift.id, { expectedCash: accurateExpected });
      }
    }
    setActiveShift(myOpenShift || null);
  };

  // Global keyboard: F1 bantuan, Ctrl+1..5 pindah menu, F11 layar penuh.
  // F5 / Ctrl+R (muat ulang) dan Ctrl+P diblokir agar keranjang tidak hilang & tidak muncul dialog cetak.
  useEffect(() => {
    const tabs = ['pos', 'service', 'stock', 'reports', 'settings'] as const;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'F5' || (mod && (e.key === 'r' || e.key === 'R')) || (mod && (e.key === 'p' || e.key === 'P'))) {
        e.preventDefault();
        return;
      }
      if (e.key === 'F11') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
        return;
      }
      if (!currentUser || (isDialogOpen() && !isHelpOpen)) return;
      if (e.key === 'F1') {
        e.preventDefault();
        setIsHelpOpen((v) => !v);
      } else if (mod && !e.shiftKey && !e.altKey && e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        setCurrentTab(tabs[parseInt(e.key, 10) - 1]);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [currentUser, isHelpOpen]);

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">Menyiapkan SparkPOS...</h2>
        <p className="text-xs text-slate-500 mt-1">Menginisialisasi basis data lokal & hardware kasir</p>
      </div>
    );
  }

  // Jika toko belum dikonfigurasi / database awal masih kosong, tampilkan Setup Awal / Restore
  if (isConfigured === false) {
    return <FirstTimeSetup onSetupComplete={handleSetupComplete} />;
  }

  // If not logged in, show Touch PIN Login Screen
  if (!currentUser) {
    return (
      <LoginScreen
        storeProfile={storeProfile}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Navigation & Status Bar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        activeShift={activeShift}
        heldCount={heldCarts.length}
        openHeldModal={() => setIsHeldModalOpen(true)}
        storeProfile={storeProfile}
        currentUser={currentUser}
        onLogout={handleLogout}
        onRequestAdminAccess={() => setIsAdminPinModalOpen(true)}
        onOpenCashFlow={() => setIsCashFlowOpen(true)}
        onOpenCashierManagement={() => setIsCashierManagementOpen(true)}
      />

      {/* Main Workstation Body */}
      <main className="flex-1 flex overflow-hidden">
        {currentTab === 'pos' && (
          <POSTerminal
            storeProfile={storeProfile}
            activeShift={activeShift}
            heldCarts={heldCarts}
            onUpdateHeldCarts={refreshHeldCarts}
            openHeldModal={() => setIsHeldModalOpen(true)}
            isHeldModalOpen={isHeldModalOpen}
            setIsHeldModalOpen={setIsHeldModalOpen}
            currentUser={currentUser}
            onLogout={handleLogout}
            onOpenCashierManagement={() => setIsCashierManagementOpen(true)}
            onOpenCashFlow={() => setIsCashFlowOpen(true)}
          />
        )}

        {currentTab === 'service' && (
          <ServiceDashboard
            currentUser={currentUser}
            storeProfile={storeProfile}
            onLogout={handleLogout}
          />
        )}

        {currentTab === 'stock' && (
          <StockManagement
            currentUser={currentUser}
            onRequestAdminAccess={() => setIsAdminPinModalOpen(true)}
          />
        )}

        {currentTab === 'reports' && (
          <TransactionHistory
            storeProfile={storeProfile}
            currentUser={currentUser}
            onOpenCashFlow={() => setIsCashFlowOpen(true)}
          />
        )}

        {currentTab === 'settings' && (
          <StoreSettings
            storeProfile={storeProfile}
            onUpdateProfile={(newProfile) => setStoreProfile(newProfile)}
            currentUser={currentUser}
            onRequestAdminAccess={() => setIsAdminPinModalOpen(true)}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Supervisor / Admin PIN Elevate Modal */}
      {isAdminPinModalOpen && (
        <AdminPinModal
          title="Verifikasi Akses Administrator"
          description="Masukkan PIN Admin untuk membuka menu pengaturan toko, kustomisasi logo, atau manajemen stok lanjutan."
          onSuccess={handleAdminElevationSuccess}
          onCancel={() => setIsAdminPinModalOpen(false)}
        />
      )}

      {/* Arus Kas: Uang Masuk / Keluar Modal */}
      {isHelpOpen && <ShortcutHelp onClose={() => setIsHelpOpen(false)} />}

      {isCashFlowOpen && activeShift && currentUser && (
        <CashFlowModal
          activeShift={activeShift}
          currentUser={currentUser}
          isOpen={isCashFlowOpen}
          onClose={() => setIsCashFlowOpen(false)}
        />
      )}

      {/* Kelola Kasir (Khusus Owner) Modal */}
      {isCashierManagementOpen && currentUser && (
        <CashierManagementModal
          currentUser={currentUser}
          isOpen={isCashierManagementOpen}
          onClose={() => setIsCashierManagementOpen(false)}
          onLogoutAndSwitch={handleLogout}
        />
      )}

      {/* Modal Wajib: Input Modal Awal Kasir Hari Ini */}
      {isOpeningCashModalOpen && currentUser && (
        <DailyOpeningCashModal
          cashierName={currentUser.fullName}
          onSaveOpeningCash={handleSaveOpeningCash}
        />
      )}
    </div>
  );
}
