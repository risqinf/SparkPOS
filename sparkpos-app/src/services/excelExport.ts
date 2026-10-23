/**
 * SparkPOS Excel / Spreadsheet Export Service
 * Produces native Excel-compatible files (.csv with UTF-8 BOM) and
 * Clipboard TSV (Tab-Separated Values) ready to paste into Microsoft Excel / Google Sheets.
 * 100% offline, zero external binary dependency.
 */

import { Transaction, Product, ServiceOrder } from '../types/pos';

/**
 * Universal clipboard copy helper with legacy fallback.
 * Works reliably in Tauri WebKitGTK Linux and Web browsers.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('navigator.clipboard writeText failed, trying fallback textarea', err);
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback copy to clipboard failed', err);
    return false;
  }
}

/**
 * Helper to trigger file download safely in both web browsers and Tauri WebView2.
 * Crucial fix: Delay URL.revokeObjectURL to avoid aborting the download in Chromium/WebView2.
 */
function downloadFile(content: string, filename: string, mimeType: string) {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    
    // Clean up DOM element immediately, but delay blob revocation by 60s
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1000);
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        // ignore
      }
    }, 60000);
  } catch (error) {
    console.error('Download file error, trying direct data URI fallback:', error);
    try {
      const encodedUri = encodeURI(`data:${mimeType},${content}`);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (fallbackError) {
      alert('Gagal mendownload file secara otomatis. Data telah disalin ke clipboard, Anda dapat langsung menempelkannya (Ctrl+V) di Excel.');
    }
  }
}

function escapeCsvCell(value: any): string {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

function cleanTsvCell(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[\t\r\n]+/g, ' ').trim();
}

/**
 * Export Sales Transactions to Excel (.csv with UTF-8 BOM) or Clipboard (TSV)
 */
function buildTransactionsReport(
  transactions: Transaction[],
  format: 'csv' | 'tsv'
): string {
  const isCsv = format === 'csv';
  const sep = isCsv ? ',' : '\t';
  const cell = (v: any) => (isCsv ? escapeCsvCell(v) : cleanTsvCell(v));

  const headers = [
    'No. Invoice',
    'Tanggal & Waktu',
    'Kasir',
    'Nama Pelanggan',
    'Metode Pembayaran',
    'Jumlah Item',
    'Subtotal (Rp)',
    'Diskon (Rp)',
    'Total Akhir (Rp)',
    'Diterima (Rp)',
    'Kembalian (Rp)',
    'Rincian Item Produk',
  ];

  const rows = transactions.map((t) => {
    const itemsSummary = t.items
      .map((i) => `${i.name} (${i.quantity}x @${i.unitPrice})`)
      .join('; ');

    const dateStr = new Date(t.createdAt).toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const totalQty = t.items.reduce((sum, item) => sum + item.quantity, 0);

    return [
      cell(t.invoiceNumber),
      cell(dateStr),
      cell(t.cashierName || 'Kasir'),
      cell(t.customerName || 'Pelanggan Umum'),
      cell(t.paymentMethod?.toUpperCase() || 'CASH'),
      cell(totalQty),
      cell(t.subtotal),
      cell(t.discountOrderAmount),
      cell(t.grandTotal),
      cell(t.paidAmount),
      cell(t.changeAmount),
      cell(itemsSummary),
    ].join(sep);
  });

  return [headers.map(cell).join(sep), ...rows].join('\r\n');
}

export function exportTransactionsToExcel(
  transactions: Transaction[],
  storeName: string = 'SparkPOS'
) {
  const bom = '\uFEFF';
  const csvContent = bom + buildTransactionsReport(transactions, 'csv');
  const dateTag = new Date().toISOString().slice(0, 10);
  const filename = `Laporan_Penjualan_${storeName.replace(/\s+/g, '_')}_${dateTag}.csv`;
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
}

export async function copyTransactionsToClipboard(
  transactions: Transaction[]
): Promise<boolean> {
  const tsvContent = buildTransactionsReport(transactions, 'tsv');
  return await copyToClipboard(tsvContent);
}

/**
 * Export Inventory & Stock Valuation to Excel (.csv with UTF-8 BOM) or Clipboard (TSV)
 */
function buildStockReport(
  products: Product[],
  format: 'csv' | 'tsv'
): string {
  const isCsv = format === 'csv';
  const sep = isCsv ? ',' : '\t';
  const cell = (v: any) => (isCsv ? escapeCsvCell(v) : cleanTsvCell(v));

  const headers = [
    'Kode SKU',
    'Barcode',
    'Nama Produk / Barang',
    'Kategori',
    'Satuan',
    'Supplier / Pemasok',
    'Harga Modal HPP (Rp)',
    'Harga Jual Kasir (Rp)',
    'Margin Profit (Rp)',
    'Margin (%)',
    'Stok Fisik Saat Ini',
    'Batas Min. Stok',
    'Status Stok',
    'Total Nilai Aset HPP (Rp)',
  ];

  const rows = products.map((p) => {
    const marginNominal = p.sellPrice - p.buyPrice;
    const marginPercent = p.buyPrice > 0 ? Math.round((marginNominal / p.buyPrice) * 100) : 0;
    const isService = p.isService || p.categoryName?.toLowerCase() === 'jasa';
    const totalAsetValue = isService ? 0 : p.buyPrice * p.stock;
    const statusText = isService
      ? 'Jasa (Tak Terbatas)'
      : p.stock <= 0
      ? 'HABIS'
      : p.stock <= p.minStock
      ? 'MENIPIS'
      : 'AMAN';

    return [
      cell(p.sku),
      cell(p.barcode || '-'),
      cell(p.name),
      cell(p.categoryName || '-'),
      cell(p.unitName || 'PCS'),
      cell(p.supplierName || 'Pemasok Umum'),
      cell(p.buyPrice),
      cell(p.sellPrice),
      cell(marginNominal),
      cell(`${marginPercent}%`),
      cell(isService ? '∞' : p.stock),
      cell(isService ? '-' : p.minStock),
      cell(statusText),
      cell(totalAsetValue),
    ].join(sep);
  });

  return [headers.map(cell).join(sep), ...rows].join('\r\n');
}

export function exportStockToExcel(
  products: Product[],
  storeName: string = 'SparkPOS'
) {
  const bom = '\uFEFF';
  const csvContent = bom + buildStockReport(products, 'csv');
  const dateTag = new Date().toISOString().slice(0, 10);
  const filename = `Laporan_Stok_Barang_${storeName.replace(/\s+/g, '_')}_${dateTag}.csv`;
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
}

export async function copyStockToClipboard(
  products: Product[]
): Promise<boolean> {
  const tsvContent = buildStockReport(products, 'tsv');
  return await copyToClipboard(tsvContent);
}

/**
 * Export Computer & Laptop Service Orders to Excel
 */
export function exportServicesToExcel(
  orders: ServiceOrder[],
  storeName: string = 'SparkPOS'
) {
  const bom = '\uFEFF';
  const headers = [
    'No. Tiket Servis',
    'Tanggal Masuk',
    'Nama Pelanggan',
    'No. WhatsApp / HP',
    'Tipe Perangkat',
    'No. Seri / Serial',
    'Keluhan Kerusakan',
    'Diagnosa Teknisi',
    'Catatan / Info Proses',
    'Status Servis',
    'Teknisi Penanggung Jawab',
    'Biaya Sparepart (Rp)',
    'Biaya Jasa Servis (Rp)',
    'Diskon (Rp)',
    'Total Biaya Servis (Rp)',
    'Status Pembayaran',
    'Tanggal Selesai',
    'Estimasi Laba Bersih Jasa (Rp)',
  ];

  const rows = orders.map((o) => {
    const dateIn = new Date(o.receivedAt || o.createdAt).toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const dateOut = o.completedAt
      ? new Date(o.completedAt).toLocaleString('id-ID', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
      : '-';

    const netLaborProfit = Math.max(0, o.totalServiceFee - o.discountAmount);

    return [
      escapeCsvCell(o.ticketNumber),
      escapeCsvCell(dateIn),
      escapeCsvCell(o.customerName),
      escapeCsvCell(o.customerPhone || '-'),
      escapeCsvCell(o.deviceType),
      escapeCsvCell(o.deviceSerial || '-'),
      escapeCsvCell(o.complaint),
      escapeCsvCell(o.diagnosis || '-'),
      escapeCsvCell(o.notes || '-'),
      escapeCsvCell(o.status),
      escapeCsvCell(o.assignedTechName || '-'),
      escapeCsvCell(o.totalPartsCost),
      escapeCsvCell(o.totalServiceFee),
      escapeCsvCell(o.discountAmount),
      escapeCsvCell(o.grandTotal),
      escapeCsvCell(o.isPaid ? 'LUNAS' : 'BELUM LUNAS'),
      escapeCsvCell(dateOut),
      escapeCsvCell(netLaborProfit),
    ].join(',');
  });

  const csvContent = bom + [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
  const dateTag = new Date().toISOString().slice(0, 10);
  const filename = `Laporan_Service_Komputer_${storeName.replace(/\s+/g, '_')}_${dateTag}.csv`;

  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
}

/**
 * Export Rekapitulasi Keuangan Bulanan (Per Tanggal 1 s/d Akhir Bulan) ke Excel (.csv)
 */
export interface DailyBreakdownRow {
  dateStr: string;
  dayNumber: number;
  dayName: string;
  txCount: number;
  serviceCount: number;
  productSales: number;
  serviceSales: number;
  totalRevenue: number;
  productCost: number;
  serviceCost: number;
  grossProfit: number;
  cashIn: number;
  cashOut: number;
  netProfit: number;
}

export interface MonthlyRecapExportData {
  monthName: string;
  year: number;
  storeName: string;
  totalProductSales: number;
  totalServiceSales: number;
  grandRevenue: number;
  totalProductCost: number;
  totalServiceCost: number;
  totalGrossProfit: number;
  totalOperationalExpenses: number;
  netProfit: number;
  totalCashPayments: number;
  totalNonCashPayments: number;
  dailyRows: DailyBreakdownRow[];
}

export function exportMonthlyFinancialRecapToExcel(data: MonthlyRecapExportData) {
  const bom = '\uFEFF';
  const lines: string[] = [];

  // Metadata & Ringkasan Eksekutif
  lines.push(`REKAPITULASI KEUANGAN BULANAN - ${data.storeName.toUpperCase()}`);
  lines.push(`Periode: 1 ${data.monthName} ${data.year} s/d Selesai`);
  lines.push(`Waktu Ekspor: ${new Date().toLocaleString('id-ID')}`);
  lines.push('');

  // Ringkasan Finansial Eksekutif
  lines.push('RINGKASAN PERFORMA KEUANGAN TOKO');
  lines.push(`Total Omzet Penjualan Produk,${data.totalProductSales}`);
  lines.push(`Total Omzet Servis Komputer,${data.totalServiceSales}`);
  lines.push(`TOTAL OMZET KOTOR TOKO,${data.grandRevenue}`);
  lines.push(`Total Modal HPP Produk Terjual,${data.totalProductCost}`);
  lines.push(`Total Biaya Sparepart Servis,${data.totalServiceCost}`);
  lines.push(`TOTAL ESTIMASI LABA KOTOR,${data.totalGrossProfit}`);
  lines.push(`Total Biaya Operasional / Kas Keluar,${data.totalOperationalExpenses}`);
  lines.push(`ESTIMASI LABA BERSIH TOKO,${data.netProfit}`);
  lines.push('');
  lines.push('METODE PENERIMAAN KAS');
  lines.push(`Penerimaan Tunai (Cash),${data.totalCashPayments}`);
  lines.push(`Penerimaan Non-Tunai (QRIS / Transfer),${data.totalNonCashPayments}`);
  lines.push('');

  // Tabel Rekapitulasi Harian
  const headers = [
    'Tanggal',
    'Hari',
    'Jml Nota POS',
    'Jml Servis Selesai',
    'Omzet Produk (Rp)',
    'Omzet Servis (Rp)',
    'Total Omzet (Rp)',
    'Modal HPP Produk (Rp)',
    'Biaya Part Servis (Rp)',
    'Laba Kotor (Rp)',
    'Kas Masuk Lain (Rp)',
    'Kas Keluar Biaya (Rp)',
    'Laba Bersih Harian (Rp)',
  ];
  lines.push(headers.map(escapeCsvCell).join(','));

  for (const row of data.dailyRows) {
    lines.push([
      escapeCsvCell(row.dateStr),
      escapeCsvCell(row.dayName),
      escapeCsvCell(row.txCount),
      escapeCsvCell(row.serviceCount),
      escapeCsvCell(row.productSales),
      escapeCsvCell(row.serviceSales),
      escapeCsvCell(row.totalRevenue),
      escapeCsvCell(row.productCost),
      escapeCsvCell(row.serviceCost),
      escapeCsvCell(row.grossProfit),
      escapeCsvCell(row.cashIn),
      escapeCsvCell(row.cashOut),
      escapeCsvCell(row.netProfit),
    ].join(','));
  }

  const csvContent = bom + lines.join('\r\n');
  const filename = `Rekap_Keuangan_Bulanan_${data.monthName}_${data.year}_${data.storeName.replace(/\s+/g, '_')}.csv`;
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
}

/**
 * Export Rekapitulasi Shift Kasir (Harian & Gabungan Semua Shift) ke Excel (.csv)
 */
export interface ShiftExportItem {
  id: number;
  cashierName: string;
  shiftName?: string;
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

export function exportShiftsToExcel(
  shifts: ShiftExportItem[],
  dateLabel: string,
  storeName: string = 'SparkPOS'
) {
  const bom = '\uFEFF';
  const lines: string[] = [];

  lines.push(`REKAPITULASI LAPORAN SHIFT KASIR - ${storeName.toUpperCase()}`);
  lines.push(`Periode / Tanggal: ${dateLabel}`);
  lines.push(`Waktu Ekspor: ${new Date().toLocaleString('id-ID')}`);
  lines.push(`Total Shift: ${shifts.length}`);
  lines.push('');

  // Ringkasan Gabungan (Semua Shift Digabung)
  const totalOpening = shifts.reduce((s, sh) => s + (sh.openingCash || 0), 0);
  const totalCashSales = shifts.reduce((s, sh) => s + (sh.totalCashSales || 0), 0);
  const totalNonCashSales = shifts.reduce((s, sh) => s + (sh.totalNonCashSales || 0), 0);
  const totalServiceSales = shifts.reduce((s, sh) => s + (sh.totalServiceSales || 0), 0);
  const totalCashIn = shifts.reduce((s, sh) => s + (sh.totalCashIn || 0), 0);
  const totalCashOut = shifts.reduce((s, sh) => s + (sh.totalCashOut || 0), 0);
  const totalExpected = shifts.reduce((s, sh) => s + (sh.expectedCash || 0), 0);
  const totalActual = shifts.reduce((s, sh) => s + (sh.closingCash || sh.expectedCash || 0), 0);
  const totalDiscrepancy = shifts.reduce((s, sh) => s + (sh.discrepancy || 0), 0);
  const totalTxCount = shifts.reduce((s, sh) => s + (sh.txCount || 0), 0);
  const grandTotalRevenue = totalCashSales + totalNonCashSales + totalServiceSales;

  lines.push('RINGKASAN GABUNGAN SELURUH SHIFT HARI INI');
  lines.push(`Total Kas Modal Awal Seluruh Shift,${totalOpening}`);
  lines.push(`Total Penjualan Tunai Seluruh Shift,${totalCashSales}`);
  lines.push(`Total Penjualan Non-Tunai Seluruh Shift,${totalNonCashSales}`);
  lines.push(`Total Pendapatan Servis Seluruh Shift,${totalServiceSales}`);
  lines.push(`TOTAL OMZET GABUNGAN HARI INI,${grandTotalRevenue}`);
  lines.push(`Total Kas Masuk Manual (+),${totalCashIn}`);
  lines.push(`Total Kas Keluar Biaya Operasional (-),${totalCashOut}`);
  lines.push(`Total Kas Seharusnya di Laci (Expected),${totalExpected}`);
  lines.push(`Total Kas Fisik Aktual Dihitung (Actual),${totalActual}`);
  lines.push(`Total Selisih Kas Gabungan,${totalDiscrepancy}`);
  lines.push(`Total Nota Transaksi Selesai,${totalTxCount}`);
  lines.push('');

  // Tabel Rincian per Shift
  const headers = [
    'No. Shift',
    'Nama Kasir',
    'Jadwal Shift',
    'Waktu Buka',
    'Waktu Tutup',
    'Modal Awal (Rp)',
    'Penjualan Tunai (Rp)',
    'Penjualan Non-Tunai (Rp)',
    'Pendapatan Servis (Rp)',
    'Kas Masuk (+) (Rp)',
    'Kas Keluar (-) (Rp)',
    'Kas Laci Seharusnya (Rp)',
    'Uang Fisik Dihitung (Rp)',
    'Selisih Kas (Rp)',
    'Jml Nota',
    'Jml Servis',
    'Status Shift',
    'Catatan Kasir',
  ];
  lines.push(headers.map(escapeCsvCell).join(','));

  for (const s of shifts) {
    const startStr = s.startTime
      ? new Date(s.startTime).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
      : '-';
    const endStr = s.endTime
      ? new Date(s.endTime).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
      : 'Sedang Berjalan (Aktif)';

    lines.push([
      escapeCsvCell(`#${s.id}`),
      escapeCsvCell(s.cashierName),
      escapeCsvCell(s.shiftName || 'Standar'),
      escapeCsvCell(startStr),
      escapeCsvCell(endStr),
      escapeCsvCell(s.openingCash || 0),
      escapeCsvCell(s.totalCashSales || 0),
      escapeCsvCell(s.totalNonCashSales || 0),
      escapeCsvCell(s.totalServiceSales || 0),
      escapeCsvCell(s.totalCashIn || 0),
      escapeCsvCell(s.totalCashOut || 0),
      escapeCsvCell(s.expectedCash || 0),
      escapeCsvCell(s.closingCash || s.expectedCash || 0),
      escapeCsvCell(s.discrepancy || 0),
      escapeCsvCell(s.txCount || 0),
      escapeCsvCell(s.serviceCount || 0),
      escapeCsvCell(s.isClosed ? 'Ditutup (Selesai)' : 'Aktif'),
      escapeCsvCell(s.note || '-'),
    ].join(','));
  }

  const csvContent = bom + lines.join('\r\n');
  const filename = `Rekap_Shift_${dateLabel.replace(/\s+/g, '_')}_${storeName.replace(/\s+/g, '_')}.csv`;
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
}

// ==========================================
// UNIFIED FINANCIAL REPORT EXPORT (LAPORAN KEUANGAN TERPADU)
// ==========================================

export interface UnifiedExportTransaction {
  invoiceNumber: string;
  createdAt: string;
  type: 'POS' | 'SERVICE';
  cashierName: string;
  customerName: string;
  paymentMethod: string;
  grandTotal: number;
  totalCost: number;
  grossProfit: number;
  items: Array<{
    name: string;
    quantity: number;
    sellPrice: number;
    buyPrice: number;
    subtotal: number;
    margin: number;
  }>;
}

export interface UnifiedFinancialExportData {
  storeName: string;
  periodLabel: string;
  printedBy: string;
  openingCash: number;
  posRevenue: number;
  serviceRevenue: number;
  totalRevenue: number;
  totalCostHpp: number;
  operationalExpenses: number;
  netProfit: number;
  cashSalesTotal: number;
  transferSalesTotal: number;
  finalCashInDrawer: number;
  transactions: UnifiedExportTransaction[];
}

export function buildUnifiedFinancialReportLines(
  data: UnifiedFinancialExportData,
  format: 'csv' | 'tsv'
): string {
  const isCsv = format === 'csv';
  const sep = isCsv ? ',' : '\t';
  const cell = (v: any) => (isCsv ? escapeCsvCell(v) : cleanTsvCell(v));
  const lines: string[] = [];

  // Kop Laporan
  lines.push(`LAPORAN KEUANGAN TERPADU & RINCIAN TRANSAKSI - ${cleanTsvCell(data.storeName).toUpperCase()}`);
  lines.push(`Periode Laporan: ${cleanTsvCell(data.periodLabel)}`);
  lines.push(`Waktu Ekspor: ${new Date().toLocaleString('id-ID')}`);
  lines.push(`Dicetak Oleh: ${cleanTsvCell(data.printedBy)}`);
  lines.push('');

  // Ringkasan Finansial Eksekutif
  lines.push('RINGKASAN FINANSIAL & ARUS KAS');
  lines.push([cell('Modal Awal Kasir Hari Ini'), cell(data.openingCash)].join(sep));
  lines.push([cell('Total Omset Penjualan POS Barang'), cell(data.posRevenue)].join(sep));
  lines.push([cell('Total Pendapatan Jasa Servis'), cell(data.serviceRevenue)].join(sep));
  lines.push([cell('TOTAL OMSET TOKO (PENJUALAN + SERVIS)'), cell(data.totalRevenue)].join(sep));
  lines.push([cell('Total Modal HPP (Barang + Sparepart)'), cell(data.totalCostHpp)].join(sep));
  lines.push([cell('Pengeluaran Operasional Kas Toko'), cell(data.operationalExpenses)].join(sep));
  lines.push([cell('TOTAL OMSET DIPOTONG MODAL & BIAYA (LABA BERSIH)'), cell(data.netProfit)].join(sep));
  lines.push([cell('Penerimaan Tunai (Cash)'), cell(data.cashSalesTotal)].join(sep));
  lines.push([cell('Penerimaan Transfer Bank'), cell(data.transferSalesTotal)].join(sep));
  lines.push([cell('ESTIMASI SALDO KAS FISIK DI LACI KASIR'), cell(data.finalCashInDrawer)].join(sep));
  lines.push([cell('Total Jumlah Transaksi'), cell(data.transactions.length)].join(sep));
  lines.push('');

  // Tabel Detail Transaksi dengan Rincian Produk
  lines.push('TABEL RINCIAN LENGKAP TRANSAKSI & PRODUK YANG DIBELI');
  const headers = [
    'No. Bukti / Invoice',
    'Tanggal & Jam',
    'Tipe',
    'Kasir / PIC',
    'Nama Pelanggan',
    'Metode Bayar',
    'Rincian Produk [Nama x Qty @Harga (Modal HPP)]',
    'Total Omset Transaksi (Rp)',
    'Total Modal HPP (Rp)',
    'Laba Transaksi (Rp)',
  ];
  lines.push(headers.map(cell).join(sep));

  for (const t of data.transactions) {
    const dateFormatted = new Date(t.createdAt).toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const itemsDetail = t.items
      .map(
        (i) =>
          `${i.name} (${i.quantity}x @Rp ${i.sellPrice.toLocaleString('id-ID')} | HPP: Rp ${i.buyPrice.toLocaleString(
            'id-ID'
          )})`
      )
      .join('; ');

    lines.push(
      [
        cell(t.invoiceNumber),
        cell(dateFormatted),
        cell(t.type === 'POS' ? 'Penjualan Kasir' : 'Jasa Servis'),
        cell(t.cashierName || 'Kasir'),
        cell(t.customerName || 'Pelanggan Umum'),
        cell(t.paymentMethod || 'CASH'),
        cell(itemsDetail || '-'),
        cell(t.grandTotal),
        cell(t.totalCost),
        cell(t.grossProfit),
      ].join(sep)
    );
  }

  return lines.join('\r\n');
}

export function exportUnifiedFinancialReportToExcel(data: UnifiedFinancialExportData) {
  const bom = '\uFEFF';
  const csvContent = bom + buildUnifiedFinancialReportLines(data, 'csv');
  const cleanStore = data.storeName.replace(/\s+/g, '_');
  const cleanPeriod = data.periodLabel.replace(/[\s\/:]+/g, '_');
  const filename = `Laporan_Keuangan_Terpadu_${cleanStore}_${cleanPeriod}.csv`;

  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
}

export async function copyUnifiedFinancialReportToClipboard(
  data: UnifiedFinancialExportData
): Promise<boolean> {
  const tsvContent = buildUnifiedFinancialReportLines(data, 'tsv');
  return await copyToClipboard(tsvContent);
}



