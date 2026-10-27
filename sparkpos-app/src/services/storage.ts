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
  WorkShiftTemplate,
  Supplier,
  ServiceOrder,
  ServiceItem,
  DailyCashRegister,
} from '../types/pos';
import { getLocalDateString } from './dateUtils';

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
  suppliers!: Table<Supplier, number>;
  serviceOrders!: Table<ServiceOrder, number>;
  serviceItems!: Table<ServiceItem, string>;
  dailyCashRegister!: Table<DailyCashRegister, number>;

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

    this.version(4).stores({
      products: '++id, sku, barcode, name, categoryId, supplierId, stock, minStock, isActive',
      categories: '++id, name',
      units: '++id, name',
      stockMovements: '++id, productId, type, createdAt',
      transactions: '++id, invoiceNumber, shiftId, cashierId, customerName, status, createdAt',
      shifts: '++id, cashierId, isClosed, startTime',
      heldCarts: 'id, heldAt',
      settings: 'key',
      employees: '++id, username, pin, role, isActive',
      cashFlows: '++id, shiftId, cashierId, type, category, createdAt',
      suppliers: '++id, name, phone, createdAt',
      serviceOrders: '++id, ticketNumber, customerName, status, assignedTechId, isPaid, receivedAt, createdAt',
      serviceItems: 'id, serviceOrderId, type, name, productId',
    });

    this.version(5).stores({
      products: '++id, sku, barcode, name, categoryId, supplierId, stock, minStock, isActive',
      categories: '++id, name',
      units: '++id, name',
      stockMovements: '++id, productId, type, createdAt',
      transactions: '++id, invoiceNumber, shiftId, cashierId, customerName, status, createdAt',
      shifts: '++id, cashierId, isClosed, startTime',
      heldCarts: 'id, heldAt',
      settings: 'key',
      employees: '++id, username, pin, role, isActive',
      cashFlows: '++id, shiftId, cashierId, type, category, createdAt',
      suppliers: '++id, name, phone, createdAt',
      serviceOrders: '++id, ticketNumber, customerName, status, assignedTechId, isPaid, receivedAt, createdAt',
      serviceItems: 'id, serviceOrderId, type, name, productId',
      dailyCashRegister: '++id, date, cashierId, isClosed',
    });
  }
}

export const db = new SparkPOSDatabase();

// 5 Kategori Baru (Aksesoris, Jasa, Laptop, Sparepart, Printer & Tinta)
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 1, name: 'Aksesoris', icon: 'Headphones', description: 'Kabel, charger, mouse, keyboard, headphone' },
  { id: 2, name: 'Jasa', icon: 'Wrench', description: 'Servis laptop, instalasi OS, maintenance (Stok ∞)' },
  { id: 3, name: 'Laptop', icon: 'Laptop', description: 'Unit laptop baru & second' },
  { id: 4, name: 'Sparepart', icon: 'Cpu', description: 'RAM, SSD, LCD, baterai, motherboard' },
  { id: 5, name: 'Printer & Tinta', icon: 'Printer', description: 'Printer, tinta printer botol, cartridge, toner, kertas' },
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
  paperWidth: '58mm',
  defaultPrintFormat: '58mm',
  taxPercent: 0,
  isTaxInclusive: false,
  autoKickDrawer: true,
  autoPrintReceipt: true,
  currencySymbol: 'Rp',
  backupFolderPath: '',
};

/**
 * Memastikan kompatibilitas database dari instalasi versi sebelumnya:
 * - Mengganti kategori lama (makanan/sembako) ke 5 kategori komputer & printer
 * - Menambahkan kategori Printer & Tinta jika belum tersedia
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
    } else {
      // Pastikan kategori Printer & Tinta tersedia di DB yang sudah berjalan
      const hasPrinterCategory = existingCats.some((c) =>
        ['printer', 'tinta'].some((kw) => c.name.toLowerCase().includes(kw))
      );
      if (!hasPrinterCategory) {
        await db.categories.add({
          name: 'Printer & Tinta',
          icon: 'Printer',
          description: 'Printer, tinta printer botol, cartridge, toner, kertas',
        });
      }
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

    // 4. Migrasi otomatis Role lama -> Baru ('admin' -> 'owner', 'cashier' -> 'kasir', 'supervisor' -> 'teknisi')
    const employees = await db.employees.toArray();
    for (const emp of employees) {
      let updatedRole = emp.role;
      if (emp.role === 'admin') updatedRole = 'owner';
      else if (emp.role === 'cashier') updatedRole = 'kasir';
      else if (emp.role === 'supervisor') updatedRole = 'teknisi';

      if (updatedRole !== emp.role) {
        await db.employees.update(emp.id, { role: updatedRole });
      }
    }
  } catch (err) {
    console.warn('Gagal menjalankan ensureDatabaseCompatibility:', err);
  }
}

/**
 * Mengambil produk aktif secara universal (Bebas dari bug perbandingan tipe IndexedDB)
 * Otomatis memperkaya categoryName & unitName agar akurat saat deteksi garansi/nota.
 */
export async function getActiveProducts(): Promise<Product[]> {
  try {
    const all = await db.products.toArray();
    const active = all.filter((p) => p.isActive !== false);
    const cats = await db.categories.toArray();
    const catMap = new Map<number, string>(cats.map((c) => [c.id, c.name]));
    const units = await db.units.toArray();
    const unitMap = new Map<number, string>(units.map((u) => [u.id, u.symbol || u.name]));
    return active.map((p) => ({
      ...p,
      categoryName: p.categoryName || catMap.get(p.categoryId) || '',
      unitName: p.unitName || unitMap.get(p.unitId) || 'PCS',
    }));
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
    const ownerCount = await db.employees
      .filter((e) => e.role === 'owner' || e.role === 'admin')
      .count();
    const profile = await db.settings.get('store_profile');
    return ownerCount > 0 && !!profile;
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
  adminData: { username: string; pin: string; fullName: string },
  seedUnits: boolean = true,
  seedCategories: boolean = true,
  cashierData?: {
    username: string;
    fullName: string;
    pin: string;
    shiftSchedule?: string;
    shiftStart?: string;
    shiftEnd?: string;
    isFlexibleShift?: boolean;
  }
): Promise<{ admin: Employee; cashier?: Employee }> {
  const now = new Date().toISOString();

  // 1. Simpan Profil Toko
  await db.settings.put({ key: 'store_profile', value: profile });

  // 2. Buat Akun Owner Utama
  const adminEmployee: Omit<Employee, 'id'> = {
    username: adminData.username.trim() || 'owner',
    fullName: adminData.fullName.trim() || 'Pemilik Toko (Owner)',
    pin: adminData.pin.trim() || '123456',
    role: 'owner',
    isActive: true,
    createdAt: now,
  };
  const adminId = await db.employees.add(adminEmployee as any);
  const createdAdmin: Employee = { id: adminId as number, ...adminEmployee };

  let createdCashier: Employee | undefined;
  if (cashierData && cashierData.fullName.trim() && cashierData.pin.trim()) {
    const cashierEmployee: Omit<Employee, 'id'> = {
      username: cashierData.username.trim() || 'kasir1',
      fullName: cashierData.fullName.trim() || 'Kasir 1',
      pin: cashierData.pin.trim() || '1234',
      role: 'kasir',
      shiftSchedule: cashierData.shiftSchedule || 'Jam Kerja Standar (07:30 - 16:30)',
      shiftStart: cashierData.shiftStart,
      shiftEnd: cashierData.shiftEnd,
      isFlexibleShift: cashierData.isFlexibleShift,
      isActive: true,
      createdAt: now,
    };
    const cashierId = await db.employees.add(cashierEmployee as any);
    createdCashier = { id: cashierId as number, ...cashierEmployee };
  }

  // 3. Inisialisasi Kategori Baru (Aksesoris, Jasa, Laptop, Sparepart)
  if (seedCategories) {
    await db.categories.clear();
    await db.categories.bulkAdd(DEFAULT_CATEGORIES);
  }

  // 4. Inisialisasi Satuan Baru (PCS, Meter, Roll)
  if (seedUnits) {
    await db.units.clear();
    await db.units.bulkAdd(DEFAULT_UNITS);
  }

  return {
    admin: createdAdmin,
    cashier: createdCashier,
  };
}

export async function getStoreProfile(): Promise<StoreProfile> {
  const record = await db.settings.get('store_profile');
  return record?.value || DEFAULT_STORE_PROFILE;
}

export async function updateStoreProfile(profile: StoreProfile): Promise<void> {
  await db.settings.put({ key: 'store_profile', value: profile });
}


/**
 * [SECURITY NOTE]
 * PIN disimpan dalam bentuk plaintext di IndexedDB lokal.
 * Untuk produksi yang membutuhkan keamanan lebih, gunakan:
 * - hash() berbasis Web Crypto API sebelum menyimpan ke DB
 * - atau enkripsi client-side dengan key yang tidak tersimpan di browser
 * Contoh: await crypto.subtle.digest('SHA-256', Buffer.from(pin)) 
 */

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
  return !!(
    emp &&
    (emp.role === 'owner' || emp.role === 'admin' || emp.role === 'supervisor' || emp.role === 'teknisi') &&
    emp.isActive
  );
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

// Master Template Jadwal & Jam Kerja Operasional Toko (Default 07:30 - 16:30)
export const DEFAULT_WORK_SHIFTS: WorkShiftTemplate[] = [
  { id: 'shift-standar', name: 'Jam Kerja Standar', startTime: '07:30', endTime: '16:30', isFlexible: false, description: 'Jam operasional toko (07:30 - 16:30)' },
  { id: 'shift-fleksibel', name: 'Shift Fleksibel', isFlexible: true, description: 'Shift bebas tanpa batasan jam tetap' },
];

export async function getWorkShiftTemplates(): Promise<WorkShiftTemplate[]> {
  try {
    const rec = await db.settings.get('work_shifts');
    if (rec && rec.value && Array.isArray(rec.value) && rec.value.length > 0) {
      return rec.value;
    }
    await db.settings.put({ key: 'work_shifts', value: DEFAULT_WORK_SHIFTS });
    return DEFAULT_WORK_SHIFTS;
  } catch (err) {
    console.error('Error getWorkShiftTemplates:', err);
    return DEFAULT_WORK_SHIFTS;
  }
}

export async function saveWorkShiftTemplates(templates: WorkShiftTemplate[]): Promise<void> {
  await db.settings.put({ key: 'work_shifts', value: templates });
}

// ==========================================
// SUPPLIER MANAGEMENT SERVICES
// ==========================================

export async function getSuppliers(): Promise<Supplier[]> {
  try {
    return await db.suppliers.orderBy('name').toArray();
  } catch (err) {
    console.error('Error getSuppliers:', err);
    return [];
  }
}

export async function addSupplier(supplier: Omit<Supplier, 'id'>): Promise<number> {
  return (await db.suppliers.add({
    ...supplier,
    createdAt: supplier.createdAt || new Date().toISOString(),
  } as any)) as number;
}

export async function updateSupplier(id: number, supplier: Partial<Supplier>): Promise<void> {
  await db.suppliers.update(id, supplier);
}

export async function deleteSupplier(id: number): Promise<void> {
  await db.suppliers.delete(id);
}

// ==========================================
// SERVICE MANAGEMENT SERVICES (TRACKING PERBAIKAN)
// ==========================================

export async function generateServiceTicketNumber(): Promise<string> {
  const now = new Date();
  const dateStr = now.toISOString().slice(2, 10).replace(/-/g, ''); // e.g. "261022"
  const countToday = await db.serviceOrders.count();
  const seq = String(countToday + 1).padStart(4, '0');
  return `SRV-${dateStr}-${seq}`;
}

export async function getServiceOrders(): Promise<ServiceOrder[]> {
  try {
    const orders = await db.serviceOrders.toArray();
    return orders.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
  } catch (err) {
    console.error('Error getServiceOrders:', err);
    return [];
  }
}

export async function getServiceOrderById(id: number): Promise<ServiceOrder | undefined> {
  return await db.serviceOrders.get(id);
}

export async function addServiceOrder(order: Omit<ServiceOrder, 'id'>): Promise<number> {
  const now = new Date().toISOString();
  const ticketNumber = order.ticketNumber || (await generateServiceTicketNumber());
  const newOrder: Omit<ServiceOrder, 'id'> = {
    ...order,
    ticketNumber,
    createdAt: order.createdAt || now,
    updatedAt: now,
  };
  return (await db.serviceOrders.add(newOrder as any)) as number;
}

export async function updateServiceOrder(id: number, order: Partial<ServiceOrder>): Promise<void> {
  await db.serviceOrders.update(id, {
    ...order,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteServiceOrder(id: number): Promise<void> {
  await db.serviceOrders.delete(id);
}

// ==========================================
// DAILY CASH REGISTER (MODAL AWAL KASIR & SALDO HARIAN)
// ==========================================

export async function getTodayCashRegister(): Promise<DailyCashRegister | undefined> {
  const todayStr = getLocalDateString();
  return await db.dailyCashRegister.where('date').equals(todayStr).first();
}

export async function getCashRegisterByDate(dateStr: string): Promise<DailyCashRegister | undefined> {
  return await db.dailyCashRegister.where('date').equals(dateStr).first();
}

export async function setTodayOpeningCash(
  openingCash: number,
  cashierId: number,
  cashierName: string
): Promise<DailyCashRegister> {
  const todayStr = getLocalDateString();
  const existing = await getTodayCashRegister();
  if (existing && existing.id) {
    await db.dailyCashRegister.update(existing.id, {
      openingCash,
      cashierId,
      cashierName,
      openedAt: existing.openedAt || new Date().toISOString(),
    });
    return { ...existing, openingCash, cashierId, cashierName };
  } else {
    const record: DailyCashRegister = {
      date: todayStr,
      openingCash,
      cashierId,
      cashierName,
      openedAt: new Date().toISOString(),
      isClosed: false,
    };
    const id = await db.dailyCashRegister.add(record as any);
    return { ...record, id: id as number };
  }
}

export async function closeTodayCashRegister(closingCash: number, notes?: string): Promise<void> {
  const existing = await getTodayCashRegister();
  if (existing && existing.id) {
    await db.dailyCashRegister.update(existing.id, {
      closingCash,
      closedAt: new Date().toISOString(),
      notes: notes || '',
      isClosed: true,
    });
  }
}

