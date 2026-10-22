import Dexie, { Table } from 'dexie';
import {
  Product,
  Category,
  Unit,
  StockMovement,
  Transaction,
  Shift,
  StoreProfile,
  HeldCart,
  Employee,
  CashFlow,
} from '../types/pos';

export class SparkPOSDatabase extends Dexie {
  products!: Table<Product, number>;
  categories!: Table<Category, number>;
  units!: Table<Unit, number>;
  stockMovements!: Table<StockMovement, number>;
  transactions!: Table<Transaction, number>;
  shifts!: Table<Shift, number>;
  heldCarts!: Table<HeldCart, string>;
  settings!: Table<{ key: string; value: any }, string>;
  employees!: Table<Employee, number>;
  cashFlows!: Table<CashFlow, number>;

  constructor() {
    super('SparkPOS_LocalDB');
    this.version(3).stores({
      products: '++id, sku, barcode, name, categoryId, stock, minStock, isActive',
      categories: '++id, name',
      units: '++id, name',
      stockMovements: '++id, productId, type, createdAt',
      transactions: '++id, invoiceNumber, shiftId, cashierId, status, createdAt',
      shifts: '++id, cashierId, isClosed, startTime',
      heldCarts: 'id, heldAt',
      settings: 'key',
      employees: '++id, username, pin, role, isActive',
      cashFlows: '++id, shiftId, cashierId, type, category, createdAt',
    });
  }
}

export const db = new SparkPOSDatabase();

// 4 Kategori Baru (Aksesoris, Jasa, Laptop, Sparepart)
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 1, name: 'Aksesoris', icon: 'Headphones', description: 'Kabel, charger, mouse, keyboard, headphone' },
  { id: 2, name: 'Jasa', icon: 'Wrench', description: 'Servis laptop, instalasi OS, maintenance (Stok ∞)' },
  { id: 3, name: 'Laptop', icon: 'Laptop', description: 'Unit laptop baru & second' },
  { id: 4, name: 'Sparepart', icon: 'Cpu', description: 'RAM, SSD, LCD, baterai, motherboard' },
];

// 3 Satuan Baru (PCS, Meter, Roll)
export const DEFAULT_UNITS: Unit[] = [
  { id: 1, name: 'Pieces', symbol: 'PCS' },
  { id: 2, name: 'Meter', symbol: 'MTR' },
  { id: 3, name: 'Roll', symbol: 'ROL' },
];

// Profil Toko Default (Bersih untuk Toko Baru)
export const DEFAULT_STORE_PROFILE: StoreProfile = {
  appName: 'SparkPOS',
  appLogo: '',
  showLogoOnReceipt: true,
  storeName: 'Nama Toko Saya',
  branchName: 'Cabang Utama',
  address: '',
  phone: '',
  receiptFooter: 'Terima kasih atas kunjungan Anda!\nBarang yang sudah dibeli tidak dapat ditukar/dikembalikan.',
  paperWidth: '80mm',
  taxPercent: 0,
  isTaxInclusive: false,
  autoKickDrawer: true,
  autoPrintReceipt: true,
  currencySymbol: 'Rp',
  backupFolderPath: '',
};

/**
 * Memastikan kompatibilitas database dari instalasi versi sebelumnya:
 * - Mengganti kategori lama (makanan/sembako) ke 4 kategori baru (Aksesoris, Jasa, Laptop, Sparepart)
 * - Mengganti satuan lama ke (PCS, Meter, Roll)
 * - Membersihkan sisa data dummy kasir Budi jika ada
 */
export async function ensureDatabaseCompatibility(): Promise<void> {
  try {
    // 1. Periksa kategori lama
    const existingCats = await db.categories.toArray();
    const hasOldCategories = existingCats.some((c) =>
      ['sembako', 'minuman', 'makanan', 'bumbu', 'sabun', 'rokok'].some((keyword) =>
        c.name.toLowerCase().includes(keyword)
      )
    );

    if (hasOldCategories || existingCats.length === 0) {
      await db.categories.clear();
      await db.categories.bulkAdd(DEFAULT_CATEGORIES);
    }

    // 2. Periksa satuan lama
    const existingUnits = await db.units.toArray();
    const hasOldUnits = existingUnits.some((u) =>
      ['kardus', 'dus', 'botol', 'kilogram', 'kg', 'pack'].some((kw) =>
        u.name.toLowerCase().includes(kw) || u.symbol.toLowerCase() === kw
      )
    );

    if (hasOldUnits || existingUnits.length === 0) {
      await db.units.clear();
      await db.units.bulkAdd(DEFAULT_UNITS);
    }

    // 3. Bersihkan kasir legacy Budi Santoso jika masih tertinggal
    const legacyKasir = await db.employees
      .filter((e) => e.username === 'kasir' && e.fullName.toLowerCase().includes('budi'))
      .toArray();
    for (const k of legacyKasir) {
      await db.employees.delete(k.id);
    }
  } catch (err) {
    console.warn('Gagal menjalankan ensureDatabaseCompatibility:', err);
  }
}

/**
 * Mengambil produk aktif secara universal (Bebas dari bug perbandingan tipe IndexedDB)
 */
export async function getActiveProducts(): Promise<Product[]> {
  try {
    const all = await db.products.toArray();
    return all.filter((p) => p.isActive !== false);
  } catch (err) {
    console.error('Error getActiveProducts:', err);
    return [];
  }
}

/**
 * Cek apakah toko sudah dikonfigurasi / database sudah di-setup.
 */
export async function isStoreConfigured(): Promise<boolean> {
  try {
    const adminCount = await db.employees.where('role').equals('admin').count();
    const profile = await db.settings.get('store_profile');
    return adminCount > 0 && !!profile;
  } catch (err) {
    console.error('Error checking isStoreConfigured', err);
    return false;
  }
}

/**
 * Setup Toko Baru dari awal (Fresh Start):
 * - Menyimpan profil toko & nama brand
 * - Membuat akun Owner / Administrator utama
 * - Menginisialisasi kategori & satuan standar komputer/ritel
 * - Database produk, transaksi, shift, dan data kasir 100% KOSONG dan BERSIH!
 */
export async function initializeStore(
  profile: StoreProfile,
  adminData: { username: string; pin: string; fullName: string }
): Promise<Employee> {
  const now = new Date().toISOString();

  // 1. Simpan Profil Toko
  await db.settings.put({ key: 'store_profile', value: profile });

  // 2. Buat Akun Owner / Administrator Utama (TANPA DATA KASIR)
  const adminEmployee: Omit<Employee, 'id'> = {
    username: adminData.username.trim() || 'owner',
    fullName: adminData.fullName.trim() || 'Pemilik Toko (Owner)',
    pin: adminData.pin.trim() || '123456',
    role: 'admin',
    isActive: true,
    createdAt: now,
  };
  const adminId = await db.employees.add(adminEmployee as any);

  // 3. Inisialisasi Kategori Baru (Aksesoris, Jasa, Laptop, Sparepart)
  await db.categories.clear();
  await db.categories.bulkAdd(DEFAULT_CATEGORIES);

  // 4. Inisialisasi Satuan Baru (PCS, Meter, Roll)
  await db.units.clear();
  await db.units.bulkAdd(DEFAULT_UNITS);

  return {
    id: adminId as number,
    ...adminEmployee,
  };
}

export async function getStoreProfile(): Promise<StoreProfile> {
  const record = await db.settings.get('store_profile');
  return record?.value || DEFAULT_STORE_PROFILE;
}

export async function updateStoreProfile(profile: StoreProfile): Promise<void> {
  await db.settings.put({ key: 'store_profile', value: profile });
}

export async function authenticateEmployee(pinOrUsername: string, pin?: string): Promise<Employee | null> {
  if (pin !== undefined) {
    // Authenticate by username & pin
    const emp = await db.employees
      .where('username')
      .equalsIgnoreCase(pinOrUsername.trim())
      .first();
    if (emp && emp.pin === pin.trim() && emp.isActive) {
      return emp;
    }
    return null;
  } else {
    // Authenticate by PIN only (Fast POS Login)
    const emp = await db.employees
      .where('pin')
      .equals(pinOrUsername.trim())
      .first();
    if (emp && emp.isActive) {
      return emp;
    }
    return null;
  }
}

export async function verifyAdminSupervisorPin(pin: string): Promise<boolean> {
  const emp = await db.employees
    .where('pin')
    .equals(pin.trim())
    .first();
  return !!(emp && (emp.role === 'admin' || emp.role === 'supervisor') && emp.isActive);
}

// Cash Flow Services (Uang Masuk & Keluar Kasir)
export async function addCashFlow(flow: Omit<CashFlow, 'id'>): Promise<number> {
  return (await db.cashFlows.add(flow as any)) as number;
}

export async function getCashFlowsByShift(shiftId: number): Promise<CashFlow[]> {
  try {
    return await db.cashFlows.where('shiftId').equals(shiftId).toArray();
  } catch (err) {
    console.error('Error getCashFlowsByShift:', err);
    return [];
  }
}
