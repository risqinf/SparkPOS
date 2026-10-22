export type RoleType = 'admin' | 'supervisor' | 'cashier';

export interface WorkShiftTemplate {
  id: string;
  name: string;        // e.g. 'Shift Pagi', 'Shift Siang', 'Shift Weekend'
  startTime?: string;  // e.g. '08:00'
  endTime?: string;    // e.g. '16:00'
  isFlexible: boolean; // true jika tanpa jam masuk/keluar tetap
  description?: string;
}

export interface Employee {
  id: number;
  username: string;
  fullName: string;
  pin: string;
  role: RoleType;
  shiftSchedule?: string; // e.g. 'Shift Pagi (08:00 - 16:00)', 'Shift Siang'
  shiftStart?: string;    // e.g. '08:00'
  shiftEnd?: string;      // e.g. '16:00'
  isFlexibleShift?: boolean; // true jika jadwal shift bebas / fleksibel
  isActive: boolean;
  createdAt: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  icon?: string;
}

export interface Unit {
  id: number;
  name: string;
  symbol: string;
}

export interface Product {
  id: number;
  sku: string;
  barcode: string;
  name: string;
  categoryId: number;
  categoryName?: string;
  unitId: number;
  unitName?: string;
  buyPrice: number;   // HPP (Harga Pokok Penjualan)
  sellPrice: number;  // Harga Jual
  stock: number;
  minStock: number;   // Batas peringatan stok menipis
  image?: string;
  isService?: boolean; // True jika produk bertipe Jasa (Stok tak terbatas)
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StockMovementType = 'IN_PURCHASE' | 'OUT_SALE' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'RETURN';

export interface StockMovement {
  id: number;
  productId: number;
  productName: string;
  type: StockMovementType;
  quantity: number;
  balanceAfter: number;
  referenceNo?: string;
  notes?: string;
  createdAt: string;
}

export interface CartItem {
  productId: number;
  sku: string;
  barcode: string;
  name: string;
  unitName: string;
  buyPrice: number;
  unitPrice: number;
  quantity: number;
  discountAmount: number; // Diskon per item (nominal)
  subtotal: number;       // (unitPrice * quantity) - discountAmount
  isService?: boolean;
}

export interface CartSummary {
  subtotal: number;
  discountItemTotal: number;
  discountOrderAmount: number;
  discountOrderPercent: number;
  taxPercent: number;
  taxAmount: number;
  isTaxInclusive: boolean;
  grandTotal: number;
  totalItems: number;
  rounding: number;
}

export type PaymentMethod = 'CASH' | 'QRIS' | 'DEBIT' | 'CREDIT' | 'TRANSFER';

export interface PaymentEntry {
  method: PaymentMethod;
  amount: number;
  referenceNo?: string;
}

export interface Transaction {
  id: number;
  invoiceNumber: string;
  shiftId: number;
  cashierId: number;
  cashierName: string;
  customerName?: string;
  subtotal: number;
  discountOrderAmount: number;
  taxAmount: number;
  grandTotal: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: string;
  payments: PaymentEntry[];
  items: CartItem[];
  status: 'COMPLETED' | 'REFUNDED' | 'VOID';
  createdAt: string;
}

export interface HeldCart {
  id: string;
  label: string;
  items: CartItem[];
  orderDiscountNominal: number;
  orderDiscountPercent: number;
  customerName?: string;
  heldAt: string;
}

export type CashFlowType = 'IN' | 'OUT';

export interface CashFlow {
  id?: number;
  shiftId: number;
  cashierId: number;
  cashierName: string;
  type: CashFlowType; // IN = Uang Masuk, OUT = Uang Keluar
  category: string;   // e.g. 'Beli Makan / Konsumsi', 'Pengamen / Keamanan', 'Operasional & ATK'
  amount: number;
  note?: string;
  createdAt: string;
}

export interface Shift {
  id: number;
  cashierId: number;
  cashierName: string;
  shiftName?: string; // e.g. 'Shift Pagi (08:00 - 16:00)' atau 'Fleksibel'
  startTime: string;
  endTime?: string;
  openingCash: number;
  closingCash?: number;
  expectedCash: number;
  totalCashIn?: number;
  totalCashOut?: number;
  discrepancy?: number;
  note?: string;
  isClosed: boolean;
}

export interface StoreProfile {
  appName: string;
  appLogo?: string; // Base64 data URL for logo
  showLogoOnReceipt: boolean;
  storeName: string;
  branchName: string;
  address: string;
  phone: string;
  receiptFooter: string;
  paperWidth: '58mm' | '80mm';
  taxPercent: number;
  isTaxInclusive: boolean;
  autoKickDrawer: boolean;
  autoPrintReceipt: boolean;
  currencySymbol: string;
  backupFolderPath?: string; // Path folder cadangan yang dipilih user (Drive D: dll)
}
