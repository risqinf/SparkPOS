import React, { useState, useEffect } from 'react';
import {
  seedInitialDataIfEmpty,
  getStoreProfile,
  DEFAULT_STORE_PROFILE,
  db,
} from './services/storage';
import { StoreProfile, Shift, HeldCart, Employee } from './types/pos';
import { Navbar } from './components/Navbar';
import { POSTerminal } from './components/POS/POSTerminal';
import { StockManagement } from './components/Stock/StockManagement';
import { TransactionHistory } from './components/Reports/TransactionHistory';
import { StoreSettings } from './components/Settings/StoreSettings';
import { ShiftReportModal } from './components/Reports/ShiftReportModal';
import { HoldCartModal } from './components/POS/HoldCartModal';
import { LoginScreen } from './components/Auth/LoginScreen';
import { AdminPinModal } from './components/Auth/AdminPinModal';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [currentTab, setCurrentTab] = useState<'pos' | 'stock' | 'reports' | 'settings'>('pos');
  const [storeProfile, setStoreProfile] = useState<StoreProfile>(DEFAULT_STORE_PROFILE);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);

  // Modals
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState(false);

  // Initialize DB and load global state
  const initializeApp = async () => {
    try {
      await seedInitialDataIfEmpty();
      const profile = await getStoreProfile();
      setStoreProfile(profile);

      // Check stored user session
      const savedUserStr = localStorage.getItem('sparkpos_current_user');
      if (savedUserStr) {
        try {
          const parsedUser = JSON.parse(savedUserStr);
          setCurrentUser(parsedUser);
        } catch {
          // ignore error
        }
      }

      // Load active shift
      const latestShift = await db.shifts.where('isClosed').equals(0 as any).last();
      if (latestShift) {
        setActiveShift(latestShift);
      } else {
        // Create new active shift if none open
        const newShift: Shift = {
          id: 1,
          cashierId: 1,
          cashierName: 'Budi Santoso (Kasir 1)',
          startTime: new Date().toISOString(),
          openingCash: 250000,
          expectedCash: 250000,
          isClosed: false,
        };
        await db.shifts.add(newShift);
        setActiveShift(newShift);
      }

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
    initializeApp();
  }, []);

  const handleLoginSuccess = (employee: Employee) => {
    setCurrentUser(employee);
    localStorage.setItem('sparkpos_current_user', JSON.stringify(employee));
    // Default to POS terminal upon login
    setCurrentTab('pos');
  };

  const handleLogout = () => {
    setCurrentUser(null);
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
    const latest = await db.shifts.where('isClosed').equals(0 as any).last();
    setActiveShift(latest || null);
  };

  // Global Keyboard Navigation (F1: POS, F3: Stock, F7: Reports)
  useEffect(() => {
    if (!currentUser) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setCurrentTab('pos');
      } else if (e.key === 'F3') {
        e.preventDefault();
        setCurrentTab('stock');
      } else if (e.key === 'F7') {
        e.preventDefault();
        setCurrentTab('reports');
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
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
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
          />
        )}

        {currentTab === 'settings' && (
          <StoreSettings
            storeProfile={storeProfile}
            onUpdateProfile={setStoreProfile}
            currentUser={currentUser}
            onRequestAdminAccess={() => setIsAdminPinModalOpen(true)}
          />
        )}
      </main>

      {/* Shift Report / Close Shift Modal */}
      {isShiftModalOpen && (
        <ShiftReportModal
          activeShift={activeShift}
          onShiftClosed={refreshShift}
          onClose={() => setIsShiftModalOpen(false)}
        />
      )}

      {/* Admin PIN Elevation Modal */}
      {isAdminPinModalOpen && (
        <AdminPinModal
          title="Verifikasi Akses Administrator"
          description="Masukkan PIN Admin (123456) untuk membuka menu pengaturan toko, kustomisasi logo, atau manajemen stok lanjutan."
          onSuccess={handleAdminElevationSuccess}
          onCancel={() => setIsAdminPinModalOpen(false)}
        />
      )}
    </div>
  );
}
