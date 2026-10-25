/**
 * SparkPOS Excel / Spreadsheet Export Service
 * Produces native, authentic Excel (.xlsx) workbooks and dual-format
 * Clipboard (rich HTML table + TSV) for seamless copy-pasting into
 * Microsoft Excel, LibreOffice Calc, and Google Sheets.
 * 100% offline, zero external server dependency.
 */

import * as RawXLSX from '@e965/xlsx';
import { Transaction, Product, ServiceOrder } from '../types/pos';

// Interop for ESM / CJS bundlers
const XLSX = (RawXLSX as any).default || RawXLSX;

/**
 * Universal clipboard copy helper that writes both text/html and text/plain.
 * When pasted into Excel or LibreOffice Calc, it pastes as cleanly formatted
 * cells with borders, headers, and numeric values without any "Text Import" dialog.
 */
export async function copyHtmlAndTextToClipboard(html: string, tsv: string): Promise<boolean> {
  // Method 1: Modern navigator.clipboard with ClipboardItem
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([tsv], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch (err) {
    console.warn('navigator.clipboard.write ClipboardItem failed, trying fallback writeText:', err);
  }

  // Method 2: navigator.clipboard.writeText (TSV fallback)
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(tsv);
      return true;
    }
  } catch (err) {
    console.warn('navigator.clipboard.writeText failed, trying DOM execCommand fallback:', err);
  }

  // Method 3: DOM execCommand with copy listener for dual format
  try {
    let success = false;
    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      if (e.clipboardData) {
        e.clipboardData.setData('text/html', html);
        e.clipboardData.setData('text/plain', tsv);
        success = true;
      }
    };

    document.addEventListener('copy', onCopy, { once: true });
    document.execCommand('copy');
    return success;
  } catch (err) {
    console.error('All clipboard copy attempts failed:', err);
    return false;
  }
}

/**
 * Legacy wrapper for plain text copy
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  return await copyHtmlAndTextToClipboard(`<pre>${text}</pre>`, text);
}

/**
 * Triggers safe client-side file download of a Blob.
 */
function downloadBlob(blob: Blob, filename: string) {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1000);
  } catch (error) {
    console.error('Download blob error:', error);
  }
}

/**
 * Writes an XLSX workbook and triggers download as native .xlsx file
 */
export function downloadWorkbook(wb: RawXLSX.WorkBook, filename: string) {
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const safeFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  downloadBlob(blob, safeFilename);
}

function cleanCell(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).replace(/[\t\r\n]+/g, ' ').trim();
}

function escapeHtml(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ==========================================
// 1. UNIFIED FINANCIAL REPORT (LAPORAN KEUANGAN TERPADU)
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

export function exportUnifiedFinancialReportToExcel(data: UnifiedFinancialExportData) {
  const wb = XLSX.utils.book_new();

  // --- SHEET 1: RINGKASAN FINANSIAL ---
  const summaryAoa: any[][] = [
    [`LAPORAN KEUANGAN TERPADU - ${data.storeName.toUpperCase()}`],
    [`Periode Laporan: ${data.periodLabel}`],
    [`Waktu Ekspor: ${new Date().toLocaleString('id-ID')}`],
    [`Dicetak Oleh: ${data.printedBy}`],
    [],
    ['INDIKATOR FINANSIAL & KAS', 'NOMINAL (RP)'],
    ['Modal Awal Kasir Hari Ini', data.openingCash],
    ['Total Omset Penjualan POS (Barang)', data.posRevenue],
    ['Total Pendapatan Jasa Servis', data.serviceRevenue],
    ['TOTAL OMSET KOTOR TOKO (POS + SERVIS)', data.totalRevenue],
    ['Total Modal HPP (Barang & Sparepart)', data.totalCostHpp],
    ['Pengeluaran Operasional Kas Toko', data.operationalExpenses],
    ['TOTAL OMSET DIPOTONG MODAL & BIAYA (LABA BERSIH)', data.netProfit],
    ['Penerimaan Tunai (Cash)', data.cashSalesTotal],
    ['Penerimaan Transfer Bank', data.transferSalesTotal],
    ['ESTIMASI SALDO KAS FISIK DI LACI KASIR', data.finalCashInDrawer],
    ['Total Transaksi Tercatat', data.transactions.length],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
  wsSummary['!cols'] = [{ wch: 48 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Finansial');

  // --- SHEET 2: DAFTAR TRANSAKSI ---
  const txHeaders = [
    'No. Bukti / Invoice',
    'Tanggal & Jam',
    'Tipe Transaksi',
    'Kasir / PIC',
    'Nama Pelanggan',
    'Metode Bayar',
    'Total Omset (Rp)',
    'Total Modal HPP (Rp)',
    'Laba Bersih Transaksi (Rp)',
    'Ringkasan Produk Dibeli',
  ];

  const txRows: any[][] = [txHeaders];
  for (const t of data.transactions) {
    const dateFormatted = new Date(t.createdAt).toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const itemsSummary = t.items
      .map((i) => `${i.name} (${i.quantity}x @Rp ${i.sellPrice.toLocaleString('id-ID')})`)
      .join('; ');

    txRows.push([
      t.invoiceNumber,
      dateFormatted,
      t.type === 'POS' ? 'Penjualan Kasir' : 'Jasa Servis',
      t.cashierName || 'Kasir',
      t.customerName || 'Pelanggan Umum',
      t.paymentMethod?.toUpperCase() || 'CASH',
      t.grandTotal,
      t.totalCost,
      t.grossProfit,
      itemsSummary || '-',
    ]);
  }

  const wsTx = XLSX.utils.aoa_to_sheet(txRows);
  wsTx['!cols'] = [
    { wch: 22 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 22 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 22 },
    { wch: 45 },
  ];
  XLSX.utils.book_append_sheet(wb, wsTx, 'Rincian Transaksi');

  // --- SHEET 3: RINCIAN ITEM TERJUAL (ROW-BY-ROW) ---
  const itemHeaders = [
    'No. Invoice',
    'Tanggal & Jam',
    'Tipe',
    'Nama Produk / Jasa',
    'Qty',
    'Harga Jual Satuan (Rp)',
    'Modal HPP Satuan (Rp)',
    'Subtotal Omset (Rp)',
    'Subtotal Modal HPP (Rp)',
    'Laba Kotor (Rp)',
  ];

  const itemRows: any[][] = [itemHeaders];
  for (const t of data.transactions) {
    const dateFormatted = new Date(t.createdAt).toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    for (const item of t.items) {
      const itemSubtotalCost = (item.buyPrice || 0) * (item.quantity || 1);
      const itemProfit = (item.subtotal || 0) - itemSubtotalCost;

      itemRows.push([
        t.invoiceNumber,
        dateFormatted,
        t.type === 'POS' ? 'Produk Kasir' : 'Jasa/Part Servis',
        item.name,
        item.quantity,
        item.sellPrice,
        item.buyPrice,
        item.subtotal,
        itemSubtotalCost,
        itemProfit,
      ]);
    }
  }

  const wsItems = XLSX.utils.aoa_to_sheet(itemRows);
  wsItems['!cols'] = [
    { wch: 22 },
    { wch: 18 },
    { wch: 18 },
    { wch: 34 },
    { wch: 10 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, wsItems, 'Rincian Item Terjual');

  const cleanStore = (data.storeName || 'SparkPOS').replace(/\s+/g, '_');
  const cleanPeriod = (data.periodLabel || 'Hari_Ini').replace(/[\s\/:]+/g, '_');
  const filename = `Laporan_Keuangan_Terpadu_${cleanStore}_${cleanPeriod}.xlsx`;

  downloadWorkbook(wb, filename);
}

export async function copyUnifiedFinancialReportToClipboard(
  data: UnifiedFinancialExportData
): Promise<boolean> {
  // 1. Build TSV (Plain text fallback)
  const tsvLines: string[] = [];
  tsvLines.push(`LAPORAN KEUANGAN TERPADU - ${cleanCell(data.storeName).toUpperCase()}`);
  tsvLines.push(`Periode: ${cleanCell(data.periodLabel)}\tDicetak Oleh: ${cleanCell(data.printedBy)}`);
  tsvLines.push(`Waktu Ekspor: ${new Date().toLocaleString('id-ID')}`);
  tsvLines.push('');
  tsvLines.push('RINGKASAN FINANSIAL');
  tsvLines.push(`Modal Awal Kasir Hari Ini\t${data.openingCash}`);
  tsvLines.push(`Total Omset Penjualan POS\t${data.posRevenue}`);
  tsvLines.push(`Total Pendapatan Jasa Servis\t${data.serviceRevenue}`);
  tsvLines.push(`TOTAL OMSET TOKO\t${data.totalRevenue}`);
  tsvLines.push(`Total Modal HPP\t${data.totalCostHpp}`);
  tsvLines.push(`Pengeluaran Kas Toko\t${data.operationalExpenses}`);
  tsvLines.push(`LABA BERSIH TOKO\t${data.netProfit}`);
  tsvLines.push(`Penerimaan Tunai (Cash)\t${data.cashSalesTotal}`);
  tsvLines.push(`Penerimaan Transfer Bank\t${data.transferSalesTotal}`);
  tsvLines.push(`SALDO KAS DI LACI KASIR\t${data.finalCashInDrawer}`);
  tsvLines.push('');
  tsvLines.push('TABEL RINCIAN TRANSAKSI');
  tsvLines.push(
    [
      'No. Invoice',
      'Tanggal & Jam',
      'Tipe',
      'Kasir',
      'Pelanggan',
      'Metode Bayar',
      'Omset (Rp)',
      'Modal HPP (Rp)',
      'Laba (Rp)',
      'Rincian Produk',
    ].join('\t')
  );

  for (const t of data.transactions) {
    const dateFormatted = new Date(t.createdAt).toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const itemsSummary = t.items
      .map((i) => `${cleanCell(i.name)} (${i.quantity}x @${i.sellPrice})`)
      .join('; ');

    tsvLines.push(
      [
        cleanCell(t.invoiceNumber),
        dateFormatted,
        t.type === 'POS' ? 'Penjualan' : 'Servis',
        cleanCell(t.cashierName || 'Kasir'),
        cleanCell(t.customerName || 'Umum'),
        cleanCell(t.paymentMethod || 'CASH'),
        t.grandTotal,
        t.totalCost,
        t.grossProfit,
        cleanCell(itemsSummary),
      ].join('\t')
    );
  }

  const plainTsv = tsvLines.join('\r\n');

  // 2. Build Rich HTML Table
  const htmlRows = data.transactions
    .map((t) => {
      const dateFormatted = new Date(t.createdAt).toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const itemsSummary = t.items
        .map((i) => `${escapeHtml(i.name)} (${i.quantity}x @Rp ${i.sellPrice.toLocaleString('id-ID')})`)
        .join('<br>');

      return `<tr>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: bold; font-family: monospace;">${escapeHtml(t.invoiceNumber)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">${escapeHtml(dateFormatted)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">${escapeHtml(t.type === 'POS' ? 'Penjualan' : 'Servis')}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">${escapeHtml(t.cashierName || 'Kasir')}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">${escapeHtml(t.customerName || 'Umum')}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">${escapeHtml(t.paymentMethod || 'CASH')}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; font-weight: bold;">Rp ${t.grandTotal.toLocaleString('id-ID')}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right;">Rp ${t.totalCost.toLocaleString('id-ID')}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; font-weight: bold; color: #047857;">Rp ${t.grossProfit.toLocaleString('id-ID')}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px;">${itemsSummary}</td>
      </tr>`;
    })
    .join('');

  const htmlContent = `
    <html>
      <head><meta charset="utf-8"></head>
      <body>
        <table style="border-collapse: collapse; font-family: sans-serif; font-size: 12px; margin-bottom: 20px;">
          <tr><td colspan="2" style="font-size: 15px; font-weight: bold; padding-bottom: 4px;">LAPORAN KEUANGAN TERPADU - ${escapeHtml(data.storeName.toUpperCase())}</td></tr>
          <tr><td colspan="2" style="color: #475569; padding-bottom: 8px;">Periode: ${escapeHtml(data.periodLabel)} | Dicetak Oleh: ${escapeHtml(data.printedBy)}</td></tr>
          <tr style="background: #f1f5f9; font-weight: bold;"><th style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left;">Indikator Finansial</th><th style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right;">Nominal (Rp)</th></tr>
          <tr><td style="border: 1px solid #cbd5e1; padding: 5px 10px;">Modal Awal Kasir</td><td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right;">Rp ${data.openingCash.toLocaleString('id-ID')}</td></tr>
          <tr><td style="border: 1px solid #cbd5e1; padding: 5px 10px;">Total Omset POS</td><td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right;">Rp ${data.posRevenue.toLocaleString('id-ID')}</td></tr>
          <tr><td style="border: 1px solid #cbd5e1; padding: 5px 10px;">Total Omset Servis</td><td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right;">Rp ${data.serviceRevenue.toLocaleString('id-ID')}</td></tr>
          <tr style="font-weight: bold;"><td style="border: 1px solid #cbd5e1; padding: 5px 10px; background: #e2e8f0;">TOTAL OMSET TOKO</td><td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right; background: #e2e8f0;">Rp ${data.totalRevenue.toLocaleString('id-ID')}</td></tr>
          <tr><td style="border: 1px solid #cbd5e1; padding: 5px 10px;">Total Modal HPP</td><td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right;">Rp ${data.totalCostHpp.toLocaleString('id-ID')}</td></tr>
          <tr><td style="border: 1px solid #cbd5e1; padding: 5px 10px;">Pengeluaran Kas Toko</td><td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right;">Rp ${data.operationalExpenses.toLocaleString('id-ID')}</td></tr>
          <tr style="font-weight: bold; background: #ecfdf5; color: #047857;"><td style="border: 1px solid #cbd5e1; padding: 5px 10px;">LABA BERSIH TOKO</td><td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right;">Rp ${data.netProfit.toLocaleString('id-ID')}</td></tr>
          <tr><td style="border: 1px solid #cbd5e1; padding: 5px 10px;">Penerimaan Tunai (Cash)</td><td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right;">Rp ${data.cashSalesTotal.toLocaleString('id-ID')}</td></tr>
          <tr><td style="border: 1px solid #cbd5e1; padding: 5px 10px;">Penerimaan Transfer Bank</td><td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right;">Rp ${data.transferSalesTotal.toLocaleString('id-ID')}</td></tr>
          <tr style="font-weight: bold; background: #f8fafc;"><td style="border: 1px solid #cbd5e1; padding: 5px 10px;">SALDO KAS DI LACI KASIR</td><td style="border: 1px solid #cbd5e1; padding: 5px 10px; text-align: right;">Rp ${data.finalCashInDrawer.toLocaleString('id-ID')}</td></tr>
        </table>

        <table style="border-collapse: collapse; font-family: sans-serif; font-size: 11px;">
          <thead>
            <tr style="background: #1e293b; color: #ffffff;">
              <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">No. Invoice</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">Tanggal & Jam</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">Tipe</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">Kasir</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">Pelanggan</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">Metode</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right;">Omset (Rp)</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right;">Modal HPP (Rp)</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right;">Laba (Rp)</th>
              <th style="border: 1px solid #cbd5e1; padding: 6px 8px;">Rincian Produk</th>
            </tr>
          </thead>
          <tbody>
            ${htmlRows}
          </tbody>
        </table>
      </body>
    </html>
  `;

  return await copyHtmlAndTextToClipboard(htmlContent, plainTsv);
}

// ==========================================
// 2. INVENTORY & STOCK VALUATION EXPORT
// ==========================================

export function exportStockToExcel(products: Product[], storeName: string = 'SparkPOS') {
  const wb = XLSX.utils.book_new();

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

  const rows: any[][] = [headers];

  for (const p of products) {
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

    rows.push([
      p.sku,
      p.barcode || '-',
      p.name,
      p.categoryName || '-',
      p.unitName || 'PCS',
      p.supplierName || 'Pemasok Umum',
      p.buyPrice,
      p.sellPrice,
      marginNominal,
      `${marginPercent}%`,
      isService ? '∞' : p.stock,
      isService ? '-' : p.minStock,
      statusText,
      totalAsetValue,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 14 },
    { wch: 18 },
    { wch: 34 },
    { wch: 16 },
    { wch: 10 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Katalog Stok Barang');

  const dateTag = new Date().toISOString().slice(0, 10);
  const cleanStore = storeName.replace(/\s+/g, '_');
  const filename = `Laporan_Stok_Barang_${cleanStore}_${dateTag}.xlsx`;

  downloadWorkbook(wb, filename);
}

export async function copyStockToClipboard(products: Product[]): Promise<boolean> {
  const headers = [
    'Kode SKU',
    'Barcode',
    'Nama Produk / Barang',
    'Kategori',
    'Satuan',
    'Supplier',
    'Modal HPP (Rp)',
    'Harga Jual (Rp)',
    'Margin (Rp)',
    'Stok',
    'Status',
    'Total Aset (Rp)',
  ];

  const tsvLines = [headers.join('\t')];
  const htmlRows: string[] = [];

  for (const p of products) {
    const marginNominal = p.sellPrice - p.buyPrice;
    const isService = p.isService || p.categoryName?.toLowerCase() === 'jasa';
    const totalAsetValue = isService ? 0 : p.buyPrice * p.stock;
    const statusText = isService
      ? 'Jasa'
      : p.stock <= 0
      ? 'HABIS'
      : p.stock <= p.minStock
      ? 'MENIPIS'
      : 'AMAN';

    tsvLines.push(
      [
        cleanCell(p.sku),
        cleanCell(p.barcode || '-'),
        cleanCell(p.name),
        cleanCell(p.categoryName || '-'),
        cleanCell(p.unitName || 'PCS'),
        cleanCell(p.supplierName || 'Umum'),
        p.buyPrice,
        p.sellPrice,
        marginNominal,
        isService ? '∞' : p.stock,
        statusText,
        totalAsetValue,
      ].join('\t')
    );

    htmlRows.push(`<tr>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-family: monospace;">${escapeHtml(p.sku)}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-family: monospace;">${escapeHtml(p.barcode || '-')}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">${escapeHtml(p.name)}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px;">${escapeHtml(p.categoryName || '-')}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">${escapeHtml(p.unitName || 'PCS')}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px;">${escapeHtml(p.supplierName || 'Umum')}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right;">Rp ${p.buyPrice.toLocaleString('id-ID')}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right; font-weight: bold;">Rp ${p.sellPrice.toLocaleString('id-ID')}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right; color: #047857;">Rp ${marginNominal.toLocaleString('id-ID')}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold;">${isService ? '∞' : p.stock}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">${statusText}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right; font-weight: bold;">Rp ${totalAsetValue.toLocaleString('id-ID')}</td>
    </tr>`);
  }

  const plainTsv = tsvLines.join('\r\n');
  const htmlContent = `
    <html>
      <head><meta charset="utf-8"></head>
      <body>
        <table style="border-collapse: collapse; font-family: sans-serif; font-size: 11px;">
          <thead>
            <tr style="background: #1e293b; color: #ffffff;">
              ${headers.map((h) => `<th style="border: 1px solid #cbd5e1; padding: 6px 8px;">${escapeHtml(h)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${htmlRows.join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;

  return await copyHtmlAndTextToClipboard(htmlContent, plainTsv);
}

// ==========================================
// 3. SALES TRANSACTIONS EXPORT
// ==========================================

export function exportTransactionsToExcel(transactions: Transaction[], storeName: string = 'SparkPOS') {
  const wb = XLSX.utils.book_new();

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

  const rows: any[][] = [headers];

  for (const t of transactions) {
    const itemsSummary = t.items
      .map((i) => `${i.name} (${i.quantity}x @Rp ${i.unitPrice.toLocaleString('id-ID')})`)
      .join('; ');

    const dateStr = new Date(t.createdAt).toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const totalQty = t.items.reduce((sum, item) => sum + item.quantity, 0);

    rows.push([
      t.invoiceNumber,
      dateStr,
      t.cashierName || 'Kasir',
      t.customerName || 'Pelanggan Umum',
      t.paymentMethod?.toUpperCase() || 'CASH',
      totalQty,
      t.subtotal,
      t.discountOrderAmount,
      t.grandTotal,
      t.paidAmount,
      t.changeAmount,
      itemsSummary,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 22 },
    { wch: 18 },
    { wch: 16 },
    { wch: 22 },
    { wch: 14 },
    { wch: 12 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 45 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Daftar Penjualan');

  const dateTag = new Date().toISOString().slice(0, 10);
  const cleanStore = storeName.replace(/\s+/g, '_');
  const filename = `Laporan_Penjualan_${cleanStore}_${dateTag}.xlsx`;

  downloadWorkbook(wb, filename);
}

export async function copyTransactionsToClipboard(transactions: Transaction[]): Promise<boolean> {
  const headers = [
    'No. Invoice',
    'Tanggal & Waktu',
    'Kasir',
    'Pelanggan',
    'Metode',
    'Jml Item',
    'Grand Total (Rp)',
    'Diterima (Rp)',
    'Kembalian (Rp)',
    'Rincian Produk',
  ];

  const tsvLines = [headers.join('\t')];
  const htmlRows: string[] = [];

  for (const t of transactions) {
    const itemsSummary = t.items
      .map((i) => `${cleanCell(i.name)} (${i.quantity}x @${i.unitPrice})`)
      .join('; ');

    const dateStr = new Date(t.createdAt).toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const totalQty = t.items.reduce((sum, item) => sum + item.quantity, 0);

    tsvLines.push(
      [
        cleanCell(t.invoiceNumber),
        dateStr,
        cleanCell(t.cashierName || 'Kasir'),
        cleanCell(t.customerName || 'Umum'),
        cleanCell(t.paymentMethod || 'CASH'),
        totalQty,
        t.grandTotal,
        t.paidAmount,
        t.changeAmount,
        cleanCell(itemsSummary),
      ].join('\t')
    );

    htmlRows.push(`<tr>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-family: monospace; font-weight: bold;">${escapeHtml(t.invoiceNumber)}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px;">${escapeHtml(dateStr)}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px;">${escapeHtml(t.cashierName || 'Kasir')}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px;">${escapeHtml(t.customerName || 'Umum')}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px;">${escapeHtml(t.paymentMethod || 'CASH')}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">${totalQty}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right; font-weight: bold;">Rp ${t.grandTotal.toLocaleString('id-ID')}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right;">Rp ${t.paidAmount.toLocaleString('id-ID')}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right;">Rp ${t.changeAmount.toLocaleString('id-ID')}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-size: 11px;">${escapeHtml(itemsSummary)}</td>
    </tr>`);
  }

  const plainTsv = tsvLines.join('\r\n');
  const htmlContent = `
    <html>
      <head><meta charset="utf-8"></head>
      <body>
        <table style="border-collapse: collapse; font-family: sans-serif; font-size: 11px;">
          <thead>
            <tr style="background: #1e293b; color: #ffffff;">
              ${headers.map((h) => `<th style="border: 1px solid #cbd5e1; padding: 6px 8px;">${escapeHtml(h)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${htmlRows.join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;

  return await copyHtmlAndTextToClipboard(htmlContent, plainTsv);
}

// ==========================================
// 4. COMPUTER & LAPTOP SERVICE ORDERS EXPORT
// ==========================================

export function exportServicesToExcel(orders: ServiceOrder[], storeName: string = 'SparkPOS') {
  const wb = XLSX.utils.book_new();

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

  const rows: any[][] = [headers];

  for (const o of orders) {
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

    rows.push([
      o.ticketNumber,
      dateIn,
      o.customerName,
      o.customerPhone || '-',
      o.deviceType,
      o.deviceSerial || '-',
      o.complaint,
      o.diagnosis || '-',
      o.notes || '-',
      o.status,
      o.assignedTechName || '-',
      o.totalPartsCost,
      o.totalServiceFee,
      o.discountAmount,
      o.grandTotal,
      o.isPaid ? 'LUNAS' : 'BELUM LUNAS',
      dateOut,
      netLaborProfit,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 18 },
    { wch: 18 },
    { wch: 22 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 30 },
    { wch: 30 },
    { wch: 25 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 20 },
    { wch: 14 },
    { wch: 16 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Order Servis Komputer');

  const dateTag = new Date().toISOString().slice(0, 10);
  const cleanStore = storeName.replace(/\s+/g, '_');
  const filename = `Laporan_Service_Komputer_${cleanStore}_${dateTag}.xlsx`;

  downloadWorkbook(wb, filename);
}

// ==========================================
// 5. MONTHLY FINANCIAL RECAP EXPORT
// ==========================================

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
  const wb = XLSX.utils.book_new();

  // Sheet 1: Ringkasan Eksekutif
  const summaryRows: any[][] = [
    [`REKAPITULASI KEUANGAN BULANAN - ${data.storeName.toUpperCase()}`],
    [`Periode: 1 ${data.monthName} ${data.year} s/d Selesai`],
    [`Waktu Ekspor: ${new Date().toLocaleString('id-ID')}`],
    [],
    ['RINGKASAN PERFORMA KEUANGAN TOKO', 'NOMINAL (RP)'],
    ['Total Omzet Penjualan Produk', data.totalProductSales],
    ['Total Omzet Servis Komputer', data.totalServiceSales],
    ['TOTAL OMZET KOTOR TOKO', data.grandRevenue],
    ['Total Modal HPP Produk Terjual', data.totalProductCost],
    ['Total Biaya Sparepart Servis', data.totalServiceCost],
    ['TOTAL ESTIMASI LABA KOTOR', data.totalGrossProfit],
    ['Total Biaya Operasional / Kas Keluar', data.totalOperationalExpenses],
    ['ESTIMASI LABA BERSIH TOKO', data.netProfit],
    [],
    ['METODE PENERIMAAN KAS', 'NOMINAL (RP)'],
    ['Penerimaan Tunai (Cash)', data.totalCashPayments],
    ['Penerimaan Non-Tunai (Transfer)', data.totalNonCashPayments],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 45 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Eksekutif');

  // Sheet 2: Tabel Rekap Harian
  const dailyHeaders = [
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

  const dailyRows: any[][] = [dailyHeaders];
  for (const r of data.dailyRows) {
    dailyRows.push([
      r.dateStr,
      r.dayName,
      r.txCount,
      r.serviceCount,
      r.productSales,
      r.serviceSales,
      r.totalRevenue,
      r.productCost,
      r.serviceCost,
      r.grossProfit,
      r.cashIn,
      r.cashOut,
      r.netProfit,
    ]);
  }

  const wsDaily = XLSX.utils.aoa_to_sheet(dailyRows);
  wsDaily['!cols'] = [
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Rekapitulasi Harian');

  const cleanStore = data.storeName.replace(/\s+/g, '_');
  const filename = `Rekap_Keuangan_Bulanan_${data.monthName}_${data.year}_${cleanStore}.xlsx`;

  downloadWorkbook(wb, filename);
}

// ==========================================
// 6. SHIFT REPORT EXPORT
// ==========================================

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
  const wb = XLSX.utils.book_new();

  // Summary Metrics
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

  const summaryRows: any[][] = [
    [`REKAPITULASI SESI KASIR - ${storeName.toUpperCase()}`],
    [`Periode / Tanggal: ${dateLabel}`],
    [`Waktu Ekspor: ${new Date().toLocaleString('id-ID')}`],
    [`Total Sesi: ${shifts.length}`],
    [],
    ['RINGKASAN GABUNGAN HARI INI', 'NOMINAL (RP)'],
    ['Total Kas Modal Awal', totalOpening],
    ['Total Penjualan Tunai', totalCashSales],
    ['Total Penjualan Non-Tunai', totalNonCashSales],
    ['Total Pendapatan Servis', totalServiceSales],
    ['TOTAL OMZET GABUNGAN', grandTotalRevenue],
    ['Total Kas Masuk Manual (+)', totalCashIn],
    ['Total Kas Keluar Biaya (-)', totalCashOut],
    ['Total Kas Laci Seharusnya (Expected)', totalExpected],
    ['Total Kas Fisik Aktual (Actual)', totalActual],
    ['Total Selisih Kas', totalDiscrepancy],
    ['Total Nota Transaksi Selesai', totalTxCount],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 42 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Harian');

  const shiftHeaders = [
    'No. Sesi',
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
    'Kas Seharusnya (Rp)',
    'Uang Fisik Dihitung (Rp)',
    'Selisih Kas (Rp)',
    'Jml Nota',
    'Jml Servis',
    'Status Sesi',
    'Catatan Kasir',
  ];

  const shiftRows: any[][] = [shiftHeaders];
  for (const s of shifts) {
    const startStr = s.startTime
      ? new Date(s.startTime).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
      : '-';
    const endStr = s.endTime
      ? new Date(s.endTime).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
      : 'Aktif';

    shiftRows.push([
      `#${s.id}`,
      s.cashierName,
      s.shiftName || 'Standar',
      startStr,
      endStr,
      s.openingCash || 0,
      s.totalCashSales || 0,
      s.totalNonCashSales || 0,
      s.totalServiceSales || 0,
      s.totalCashIn || 0,
      s.totalCashOut || 0,
      s.expectedCash || 0,
      s.closingCash || s.expectedCash || 0,
      s.discrepancy || 0,
      s.txCount || 0,
      s.serviceCount || 0,
      s.isClosed ? 'Ditutup' : 'Aktif',
      s.note || '-',
    ]);
  }

  const wsShifts = XLSX.utils.aoa_to_sheet(shiftRows);
  wsShifts['!cols'] = [
    { wch: 12 },
    { wch: 18 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 20 },
    { wch: 20 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 20 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 25 },
  ];
  XLSX.utils.book_append_sheet(wb, wsShifts, 'Rincian Sesi Kasir');

  const cleanDate = dateLabel.replace(/[\s\/:]+/g, '_');
  const cleanStore = storeName.replace(/\s+/g, '_');
  const filename = `Laporan_Sesi_Kasir_${cleanDate}_${cleanStore}.xlsx`;

  downloadWorkbook(wb, filename);
}
