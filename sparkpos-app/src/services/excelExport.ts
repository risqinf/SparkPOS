/**
 * SparkPOS Excel / Spreadsheet Export Service
 * Produces native Excel-compatible files (.csv with UTF-8 BOM)
 * 100% offline, zero external binary dependency, opens cleanly in Microsoft Excel.
 */

import { Transaction, Product, ServiceOrder } from '../types/pos';

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: any): string {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Export Sales Transactions to Excel (.csv with UTF-8 BOM)
 */
export function exportTransactionsToExcel(
  transactions: Transaction[],
  storeName: string = 'SparkPOS'
) {
  const bom = '\uFEFF';
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
      escapeCsvCell(t.invoiceNumber),
      escapeCsvCell(dateStr),
      escapeCsvCell(t.cashierName || 'Kasir'),
      escapeCsvCell(t.customerName || 'Pelanggan Umum'),
      escapeCsvCell(t.paymentMethod?.toUpperCase() || 'CASH'),
      escapeCsvCell(totalQty),
      escapeCsvCell(t.subtotal),
      escapeCsvCell(t.discountOrderAmount),
      escapeCsvCell(t.grandTotal),
      escapeCsvCell(t.paidAmount),
      escapeCsvCell(t.changeAmount),
      escapeCsvCell(itemsSummary),
    ].join(',');
  });

  const csvContent = bom + [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
  const dateTag = new Date().toISOString().slice(0, 10);
  const filename = `Laporan_Penjualan_${storeName.replace(/\s+/g, '_')}_${dateTag}.csv`;

  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
}

/**
 * Export Inventory & Stock Valuation to Excel
 */
export function exportStockToExcel(
  products: Product[],
  storeName: string = 'SparkPOS'
) {
  const bom = '\uFEFF';
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
      escapeCsvCell(p.sku),
      escapeCsvCell(p.barcode || '-'),
      escapeCsvCell(p.name),
      escapeCsvCell(p.categoryName || '-'),
      escapeCsvCell(p.unitName || 'PCS'),
      escapeCsvCell(p.supplierName || 'Pemasok Umum'),
      escapeCsvCell(p.buyPrice),
      escapeCsvCell(p.sellPrice),
      escapeCsvCell(marginNominal),
      escapeCsvCell(`${marginPercent}%`),
      escapeCsvCell(isService ? '∞' : p.stock),
      escapeCsvCell(isService ? '-' : p.minStock),
      escapeCsvCell(statusText),
      escapeCsvCell(totalAsetValue),
    ].join(',');
  });

  const csvContent = bom + [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
  const dateTag = new Date().toISOString().slice(0, 10);
  const filename = `Laporan_Stok_Barang_${storeName.replace(/\s+/g, '_')}_${dateTag}.csv`;

  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
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

