import React, { useState, useEffect } from 'react';
import {
  isStoreConfigured,
  getStoreProfile,
  DEFAULT_STORE_PROFILE,
  ensureDatabaseCompatibility,
  db,
} from './services/storage';
import { StoreProfile, Shift, HeldCart, Employee } from './types/pos';
import { Navbar } from './components/Navbar';
import { POSTerminal } from './components/POS/POSTerminal';
import { StockManagement } from './components/Stock/StockManagement';
import { TransactionHistory } from './components/Reports/TransactionHistory';
import { StoreSettings } from './components/Settings/StoreSettings';
import { ShiftReportModal } from './components/Reports/ShiftReportModal';
import { LoginScreen } from './components/Auth/LoginScreen';
import { AdminPinModal } from './components/Auth/AdminPinModal';
import { FirstTimeSetup } from './components/Auth/FirstTimeSetup';
import { CashierManagementModal } from './components/Owner/CashierManagementModal';
import { CashFlowModal } from './components/POS/CashFlowModal';
import { BreakTimeModal } from './components/POS/BreakTimeModal';
import { ServiceDashboard } from './components/Service/ServiceDashboard';
import { applyTheme, initThemeListener } from './services/theme';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [currentTab, setCurrentTab] = useState<'pos' | 'service' | 'stock' | 'reports' | 'settings'>('pos');
  const [storeProfile, setStoreProfile] = useState<StoreProfile>(DEFAULT_STORE_PROFILE);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);

  // Modals
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState(false);
  const [isCashFlowOpen, setIsCashFlowOpen] = useState(false);
  const [isBreakTimeOpen, setIsBreakTimeOpen] = useState(false);
  const [isCashierManagementOpen, setIsCashierManagementOpen] = useState(false);

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
      cleanup();
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
    // Contoh: login jam 07.30, apps tidak sengaja tertutup jam 13.10 -> lanjutkan shift kasir ini!
    const allShifts = await db.shifts.toArray();
    const myOpenShift = allShifts.find((s) => !s.isClosed && s.cashierId === employee.id);

    if (myOpenShift) {
      setActiveShift(myOpenShift);
    } else {
      // Buat shift baru untuk kasir ini
      const newShift: Shift = {
        id: (allShifts.length || 0) + 1,
        cashierId: employee.id,
        cashierName: employee.fullName,
        shiftName: employee.shiftSchedule || (employee.isFlexibleShift ? 'Shift Fleksibel' : 'Shift Standar'),
        startTime: new Date().toISOString(),
        openingCash: 0,
        expectedCash: 0,
        isClosed: false,
      };
      await db.shifts.add(newShift);
      setActiveShift(newShift);
    }

    // Default tab based on role: Teknisi goes to Service dashboard, others to POS
    if (employee.role === 'teknisi' || employee.role === 'supervisor') {
      setCurrentTab('service');
    } else {
      setCurrentTab('pos');
    }
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
    setActiveShift(myOpenShift || null);
  };

  // Global Keyboard Navigation (F1: POS, F3: Stock, F7: Reports, F11: Fullscreen)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      } else if (currentUser) {
        if (e.key === 'F1') {
          e.preventDefault();
          setCurrentTab('pos');
        } else if (e.key === 'F2') {
          e.preventDefault();
          setCurrentTab('service');
        } else if (e.key === 'F3') {
          e.preventDefault();
          setCurrentTab('stock');
        } else if (e.key === 'F7') {
          e.preventDefault();
          setCurrentTab('reports');
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [currentUser]);

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-slate-950 text-slate-100">
        <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <h2 className="text-base font-bold text-white tracking-wide">Menyiapkan SparkPOS...</h2>
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
        openShiftModal={() => setIsShiftModalOpen(true)}
        storeProfile={storeProfile}
        currentUser={currentUser}
        onLogout={handleLogout}
        onRequestAdminAccess={() => setIsAdminPinModalOpen(true)}
        onOpenCashFlow={() => setIsCashFlowOpen(true)}
        onOpenBreakTime={() => setIsBreakTimeOpen(true)}
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

      {/* Global Shift Summary Modal */}
      {isShiftModalOpen && (
        <ShiftReportModal
          activeShift={activeShift}
          storeProfile={storeProfile}
          currentUser={currentUser}
          onShiftClosed={refreshShift}
          onClose={() => setIsShiftModalOpen(false)}
        />
      )}

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
      {isCashFlowOpen && activeShift && currentUser && (
        <CashFlowModal
          activeShift={activeShift}
          currentUser={currentUser}
          isOpen={isCashFlowOpen}
          onClose={() => setIsCashFlowOpen(false)}
        />
      )}

      {/* Mode Istirahat Kasir Modal */}
      {isBreakTimeOpen && currentUser && (
        <BreakTimeModal
          currentUser={currentUser}
          isOpen={isBreakTimeOpen}
          onEndBreak={() => setIsBreakTimeOpen(false)}
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
    </div>
  );
}
