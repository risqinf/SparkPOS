export type RoleType = 'owner' | 'kasir' | 'teknisi' | 'admin' | 'supervisor' | 'cashier';

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

export interface Supplier {
  id?: number;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

export type ServiceStatus = 'DITERIMA' | 'DIKERJAKAN' | 'SELESAI' | 'DIAMBIL' | 'DIBATALKAN';

export interface ServiceItem {
  id: string;
  serviceOrderId?: number;
  type: 'PART' | 'SERVICE';   // Sparepart atau Jasa Servis
  name: string;               // e.g. "Ganti Pasta Thermal" atau "SSD NVMe 512GB"
  productId?: number;         // Tautkan ke ID produk jika memotong stok
  supplierName?: string;      // Supplier suku cadang
  costPrice: number;          // Modal (HPP)
  sellPrice: number;          // Biaya yang ditagihkan ke pelanggan
  quantity: number;
  subtotal: number;           // sellPrice * quantity
}

export interface ServiceOrder {
  id?: number;
  ticketNumber: string;       // e.g. "SRV-20261022-0001"
  customerName: string;
  customerPhone?: string;
  deviceType: string;         // e.g. "Laptop Lenovo ThinkPad X201"
  deviceSerial?: string;      // No seri / IMEI / SN
  complaint: string;          // Keluhan awal pelanggan
  diagnosis?: string;         // Diagnosa & analisa teknisi
  completeness?: string;      // Kelengkapan unit: Charger, Tas, Box, Baterai, Kabel Power dll
  physicalCondition?: string; // Kondisi fisik: Lecet pemakaian, engsel patah, baut kurang dll
  devicePassword?: string;    // Password Windows / PIN / Pola kunci jika ada
  warrantyDays?: number;      // Garansi pengerjaan servis (hari, misal: 7, 14, 30 hari)
  downPayment?: number;       // Uang Muka / DP servis saat barang masuk
  status: ServiceStatus;
  assignedTechId?: number;    // ID teknisi penanggung jawab
  assignedTechName?: string;  // Nama teknisi
  items: ServiceItem[];       // Rincian sparepart & biaya jasa
  totalPartsCost: number;     // Total modal sparepart
  totalServiceFee: number;    // Total jasa kerja
  discountAmount: number;     // Diskon servis
  grandTotal: number;         // Total akhir tagihan servis
  paidAmount: number;         // Nominal yang sudah dibayar
  paymentMethod?: string;     // Metode pembayaran (CASH, QRIS, TRANSFER)
  isPaid: boolean;            // Lunas atau belum
  estimatedDate?: string;     // Estimasi tanggal selesai
  receivedAt: string;         // Tanggal masuk
  startedAt?: string;         // Waktu mulai pengerjaan
  completedAt?: string;       // Waktu selesai
  pickedUpAt?: string;        // Waktu diambil oleh pelanggan
  notes?: string;
  createdAt: string;
  updatedAt: string;
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

export type ProductCondition = 'BARU' | 'BEKAS' | 'MINUS' | 'MATOT';

export interface Product {
  id: number;
  sku: string;
  barcode: string;
  name: string;
  categoryId: number;
  categoryName?: string;
  unitId: number;
  unitName?: string;
  supplierId?: number;
  supplierName?: string;
  buyPrice: number;   // HPP (Harga Pokok Penjualan)
  sellPrice: number;  // Harga Jual
  stock: number;
  minStock: number;   // Batas peringatan stok menipis
  image?: string;
  isService?: boolean; // True jika produk bertipe Jasa (Stok tak terbatas)
  condition?: ProductCondition; // BARU = Baru, BEKAS = Bekas Mulus, MINUS = Bekas Ada Minus, MATOT = Bahan Kanibal/Rusak
  conditionNotes?: string;      // Detail minus/kondisi fisik (e.g. "Baterai drop, lecet bezel", "Unit matot kena air")
  completeness?: string;        // Kelengkapan (e.g. "Fullset Box + Charger Ori", "Unit Only / Batangan")
  warrantyPeriod?: string;      // Garansi (e.g. "1 Tahun Resmi", "1 Bulan Toko", "7 Hari")
  serialNumber?: string;        // Nomor Seri / SN distributor
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
  supplierName?: string;
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
  condition?: ProductCondition;
  warrantyPeriod?: string;
  serialNumber?: string;
}

export interface CartSummary {
  subtotal: number;
  discountItemTotal: number;
  discountOrderAmount: number;
  discountOrderPercent: number;
  taxPercent: number;
  taxAmount: number;
  isTaxInclusive: boolean;
  shippingCost?: number;
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
  shippingCost?: number;             // Biaya ongkir / pengiriman
  shippingCourier?: string;          // Kurir pengiriman (SPX Express / Shopee Xpress, J&T, JNE, SiCepat, GoSend, Kurir Toko)
  shippingTrackingNumber?: string;   // Nomor Resi pengiriman
  shippingAddress?: string;          // Alamat pengiriman
  grandTotal: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: string;
  payments: PaymentEntry[];
  items: CartItem[];
  status: 'COMPLETED' | 'REFUNDED' | 'VOID';
  notes?: string;
  createdAt: string;
}

export interface HeldCart {
  id: string;
  label: string;
  items: CartItem[];
  orderDiscountNominal: number;
  orderDiscountPercent: number;
  customerName?: string;
  shippingCost?: number;
  shippingCourier?: string;
  shippingTrackingNumber?: string;
  shippingAddress?: string;
  heldAt: string;
}

export type CashFlowType = 'IN' | 'OUT';

export interface CashFlow {
  id?: number;
  shiftId: number;
  cashierId: number;
  cashierName: string;
  type: CashFlowType; // IN = Uang Masuk, OUT = Uang Keluar
  category: string;   // e.g. 'Listrik, Air & Internet', 'Ongkos Kirim', 'Perlengkapan & Kemasan'
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
  totalCashSales?: number;
  totalNonCashSales?: number;
  totalServiceSales?: number;
  totalCashIn?: number;
  totalCashOut?: number;
  txCount?: number;
  serviceCount?: number;
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
  paperWidth: '58mm' | '80mm' | 'A4' | 'F4' | 'auto';
  defaultPrintFormat?: '58mm' | 'A4' | 'NONE';
  taxPercent: number;
  isTaxInclusive: boolean;
  autoKickDrawer: boolean;
  autoPrintReceipt: boolean;
  thermalPrinterName?: string; // Printer struk 58mm (dicetak langsung via ESC/POS)
  a4PrinterName?: string;      // Printer faktur A4/F4 (dicetak senyap)
  thermalAutoCut?: boolean;    // Printer thermal punya auto-cutter
  enablePrintReceipt?: boolean;
  currencySymbol: string;
  backupFolderPath?: string; // Path folder cadangan yang dipilih user (Drive D: dll)
  customDatabasePath?: string; // Path folder database operasional kustom aktif (D:\SparkPOS_Data dll)
}

export interface DatabasePathInfo {
  activePath: string;
  isCustom: boolean;
  status: 'CONNECTED' | 'DEFAULT' | 'OFFLINE' | 'MIGRATING';
  lastSyncedAt?: string;
  driveLetter?: string;
  itemCounts?: {
    products: number;
    transactions: number;
    serviceOrders: number;
    employees: number;
  };
}

export interface DailyCashRegister {
  id?: number;
  date: string;           // YYYY-MM-DD (local date)
  cashierId: number;
  cashierName: string;
  openingCash: number;    // Modal awal kasir hari ini
  openedAt: string;       // ISO timestamp
  closingCash?: number;   // Uang fisik saat tutup kas di akhir jam operasional
  closedAt?: string;
  notes?: string;
  isClosed: boolean;
}

