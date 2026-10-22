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
