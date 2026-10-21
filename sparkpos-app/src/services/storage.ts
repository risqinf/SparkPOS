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

  constructor() {
    super('SparkPOS_LocalDB');
    this.version(2).stores({
      products: '++id, sku, barcode, name, categoryId, stock, minStock, isActive',
      categories: '++id, name',
      units: '++id, name',
      stockMovements: '++id, productId, type, createdAt',
      transactions: '++id, invoiceNumber, shiftId, cashierId, status, createdAt',
      shifts: '++id, cashierId, isClosed, startTime',
      heldCarts: 'id, heldAt',
      settings: 'key',
      employees: '++id, username, pin, role, isActive',
    });
  }
}

export const db = new SparkPOSDatabase();

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
};

/**
 * Cek apakah toko sudah dikonfigurasi / database sudah di-setup.
 * Mengembalikan false jika belum ada akun Admin atau profil toko belum disimpan.
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
 * - Membuat akun Admin utama dengan PIN rahasia sendiri
 * - Inisialisasi satuan standar ritel (opsional)
 * - Database produk, transaksi, shift, dan kasir dummy 100% KOSONG dan BERSIH!
 */
export async function initializeStore(
  profile: StoreProfile,
  adminData: { username: string; pin: string; fullName: string },
  seedDefaultUnits: boolean = true,
  seedDefaultCategories: boolean = true
): Promise<Employee> {
  const now = new Date().toISOString();

  // 1. Simpan Profil Toko
  await db.settings.put({ key: 'store_profile', value: profile });

  // 2. Buat Akun Administrator Utama
  const adminEmployee: Omit<Employee, 'id'> = {
    username: adminData.username.trim() || 'admin',
    fullName: adminData.fullName.trim() || 'Administrator Utama',
    pin: adminData.pin.trim() || '123456',
    role: 'admin',
    isActive: true,
    createdAt: now,
  };
  const adminId = await db.employees.add(adminEmployee as any);

  // 3. Inisialisasi Satuan Standar Ritel (Opsional)
  if (seedDefaultUnits) {
    const unitCount = await db.units.count();
    if (unitCount === 0) {
      const standardUnits: Unit[] = [
        { id: 1, name: 'Pieces', symbol: 'PCS' },
        { id: 2, name: 'Pack / Bungkus', symbol: 'PCK' },
        { id: 3, name: 'Botol', symbol: 'BTL' },
        { id: 4, name: 'Kilogram', symbol: 'KG' },
        { id: 5, name: 'Dus / Karton', symbol: 'DUS' },
      ];
      await db.units.bulkAdd(standardUnits);
    }
  }

  // 4. Inisialisasi Kategori Dasar (Opsional)
  if (seedDefaultCategories) {
    const catCount = await db.categories.count();
    if (catCount === 0) {
      const standardCategories: Category[] = [
        { id: 1, name: 'Makanan & Minuman', icon: 'Coffee' },
        { id: 2, name: 'Kebutuhan Pokok', icon: 'ShoppingBag' },
        { id: 3, name: 'Lainnya', icon: 'Tag' },
      ];
      await db.categories.bulkAdd(standardCategories);
    }
  }

  // NOTE: Produk, Kasir Dummy (Budi Santoso), dan Shift awal 100% KOSONG!

  return {
    id: adminId as number,
    ...adminEmployee,
  };
}

// Kompatibilitas fungsi lama: tidak menyuntik data dummy Budi atau Indomie
export async function seedInitialDataIfEmpty() {
  const configured = await isStoreConfigured();
  if (!configured) {
    // Biarkan wizard setup awal yang menangani inisialisasi
    return;
  }
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
