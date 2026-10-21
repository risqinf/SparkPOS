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

// Default Store Profile
export const DEFAULT_STORE_PROFILE: StoreProfile = {
  appName: 'SparkPOS',
  appLogo: '',
  showLogoOnReceipt: true,
  storeName: 'TOKO BERKAH JAYA',
  branchName: 'Cabang Utama Retail',
  address: 'Jl. Merdeka No. 45, Jakarta Selatan',
  phone: '0812-3456-7890',
  receiptFooter: 'Terima kasih atas kunjungan Anda!\nBarang yang sudah dibeli tidak dapat ditukar/dikembalikan.',
  paperWidth: '80mm',
  taxPercent: 11,
  isTaxInclusive: false,
  autoKickDrawer: true,
  autoPrintReceipt: true,
  currencySymbol: 'Rp',
};

// Seed initial realistic retail products & users if empty
export async function seedInitialDataIfEmpty() {
  const now = new Date().toISOString();

  // 1. Employees (Admin & Kasir)
  const empCount = await db.employees.count();
  if (empCount === 0) {
    const defaultEmployees: Omit<Employee, 'id'>[] = [
      {
        username: 'admin',
        fullName: 'Administrator (Owner)',
        pin: '123456',
        role: 'admin',
        isActive: true,
        createdAt: now,
      },
      {
        username: 'kasir',
        fullName: 'Budi Santoso (Kasir 1)',
        pin: '1234',
        role: 'cashier',
        isActive: true,
        createdAt: now,
      },
    ];
    await db.employees.bulkAdd(defaultEmployees as any);
  }

  const productCount = await db.products.count();
  if (productCount > 0) return;

  // 2. Categories
  const categoryData: Category[] = [
    { id: 1, name: 'Sembako & Kebutuhan Pokok', icon: 'ShoppingBag' },
    { id: 2, name: 'Minuman Dingin & Hangat', icon: 'Coffee' },
    { id: 3, name: 'Makanan Ringan & Snack', icon: 'Cookie' },
    { id: 4, name: 'Bumbu Dapur & Masak', icon: 'Flame' },
    { id: 5, name: 'Sabun & Kebersihan', icon: 'Sparkles' },
    { id: 6, name: 'Rokok & Tembakau', icon: 'Cigarette' },
  ];
  await db.categories.bulkAdd(categoryData);

  // 3. Units
  const unitData: Unit[] = [
    { id: 1, name: 'Pieces', symbol: 'PCS' },
    { id: 2, name: 'Pack', symbol: 'PCK' },
    { id: 3, name: 'Botol', symbol: 'BTL' },
    { id: 4, name: 'Kilogram', symbol: 'KG' },
    { id: 5, name: 'Dus / Karton', symbol: 'DUS' },
  ];
  await db.units.bulkAdd(unitData);

  // 4. Products
  const sampleProducts: Omit<Product, 'id'>[] = [
    {
      sku: 'PRD-001',
      barcode: '899999900101',
      name: 'Indomie Goreng Original 85g',
      categoryId: 1,
      categoryName: 'Sembako & Kebutuhan Pokok',
      unitId: 1,
      unitName: 'PCS',
      buyPrice: 2800,
      sellPrice: 3500,
      stock: 120,
      minStock: 20,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      sku: 'PRD-002',
      barcode: '899999900102',
      name: 'Indomie Kuah Ayam Bawang 75g',
      categoryId: 1,
      categoryName: 'Sembako & Kebutuhan Pokok',
      unitId: 1,
      unitName: 'PCS',
      buyPrice: 2750,
      sellPrice: 3500,
      stock: 85,
      minStock: 15,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      sku: 'PRD-003',
      barcode: '899276100101',
      name: 'Aqua Air Mineral Botol 600ml',
      categoryId: 2,
      categoryName: 'Minuman Dingin & Hangat',
      unitId: 3,
      unitName: 'BTL',
      buyPrice: 2500,
      sellPrice: 4000,
      stock: 48,
      minStock: 12,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      sku: 'PRD-004',
      barcode: '899276100102',
      name: 'Le Minerale 600ml Segar',
      categoryId: 2,
      categoryName: 'Minuman Dingin & Hangat',
      unitId: 3,
      unitName: 'BTL',
      buyPrice: 2400,
      sellPrice: 3500,
      stock: 36,
      minStock: 10,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      sku: 'PRD-005',
      barcode: '899886610201',
      name: 'Minyak Goreng Sania Pouch 2 Liter',
      categoryId: 1,
      categoryName: 'Sembako & Kebutuhan Pokok',
      unitId: 2,
      unitName: 'PCK',
      buyPrice: 32000,
      sellPrice: 36500,
      stock: 24,
      minStock: 6,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      sku: 'PRD-006',
      barcode: '899886610202',
      name: 'Beras Ramos Setra Premium 5 Kg',
      categoryId: 1,
      categoryName: 'Sembako & Kebutuhan Pokok',
      unitId: 2,
      unitName: 'PCK',
      buyPrice: 65000,
      sellPrice: 74000,
      stock: 18,
      minStock: 5,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      sku: 'PRD-007',
      barcode: '899600130101',
      name: 'Kopi Kapal Api Special Mix 10x24g',
      categoryId: 2,
      categoryName: 'Minuman Dingin & Hangat',
      unitId: 2,
      unitName: 'PCK',
      buyPrice: 13500,
      sellPrice: 16000,
      stock: 4,
      minStock: 10,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      sku: 'PRD-008',
      barcode: '899100140101',
      name: 'Chitato Sapi Panggang 68g',
      categoryId: 3,
      categoryName: 'Makanan Ringan & Snack',
      unitId: 1,
      unitName: 'PCS',
      buyPrice: 8500,
      sellPrice: 11500,
      stock: 32,
      minStock: 8,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      sku: 'PRD-009',
      barcode: '899100140102',
      name: 'Oreo Vanilla Sandwich Biscuit 133g',
      categoryId: 3,
      categoryName: 'Makanan Ringan & Snack',
      unitId: 1,
      unitName: 'PCS',
      buyPrice: 7200,
      sellPrice: 9500,
      stock: 0,
      minStock: 10,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      sku: 'PRD-010',
      barcode: '899234550101',
      name: 'Rinso Anti Noda Cair 750ml',
      categoryId: 5,
      categoryName: 'Sabun & Kebersihan',
      unitId: 2,
      unitName: 'PCK',
      buyPrice: 17000,
      sellPrice: 21500,
      stock: 15,
      minStock: 5,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      sku: 'PRD-011',
      barcode: '899234550102',
      name: 'Sunlight Pencuci Piring Jeruk Nipis 700ml',
      categoryId: 5,
      categoryName: 'Sabun & Kebersihan',
      unitId: 2,
      unitName: 'PCK',
      buyPrice: 12500,
      sellPrice: 15500,
      stock: 40,
      minStock: 10,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      sku: 'PRD-012',
      barcode: '899312360101',
      name: 'Telur Ayam Negeri Fresh 1 Kg',
      categoryId: 1,
      categoryName: 'Sembako & Kebutuhan Pokok',
      unitId: 4,
      unitName: 'KG',
      buyPrice: 25000,
      sellPrice: 29000,
      stock: 50,
      minStock: 10,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  await db.products.bulkAdd(sampleProducts as any);

  // 5. Initial Shift
  const initialShift: Shift = {
    id: 1,
    cashierId: 2,
    cashierName: 'Budi Santoso (Kasir 1)',
    startTime: now,
    openingCash: 250000,
    expectedCash: 250000,
    isClosed: false,
  };
  await db.shifts.add(initialShift);

  // 6. Store Settings
  await db.settings.put({ key: 'store_profile', value: DEFAULT_STORE_PROFILE });
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
