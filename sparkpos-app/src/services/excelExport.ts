/**
 * SparkPOS Excel / Spreadsheet Export Service
 * Produces native, authentic, professionally styled Excel (.xlsx) workbooks
 * with full color palettes, zebra striping, accounting borders, automatic
 * thousands-separator formatting (1.000.000), and compact notation (JT/RB).
 * 100% offline, zero external server dependency.
 */

import XLSX from 'xlsx-js-style';
import { Transaction, Product, ServiceOrder } from '../types/pos';

// ==========================================
// EXECUTIVE DESIGN PALETTE & BORDERS
// ==========================================

const BORDER_THIN = {
  top: { style: 'thin', color: { rgb: 'CBD5E1' } },
  bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
  left: { style: 'thin', color: { rgb: 'CBD5E1' } },
  right: { style: 'thin', color: { rgb: 'CBD5E1' } },
};

const BORDER_DOUBLE_BOTTOM = {
  top: { style: 'thin', color: { rgb: 'CBD5E1' } },
  bottom: { style: 'double', color: { rgb: '0F172A' } },
  left: { style: 'thin', color: { rgb: 'CBD5E1' } },
  right: { style: 'thin', color: { rgb: 'CBD5E1' } },
};

const STYLE_TITLE_BANNER = {
  font: { name: 'Segoe UI', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '0F172A' } },
  alignment: { horizontal: 'left', vertical: 'center' },
};

const STYLE_TABLE_HEADER = {
  font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '1E293B' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: BORDER_THIN,
};

/**
 * Applies executive styling to any table:
 * - Header row (Row 0): Dark slate background (#1E293B) + white bold text
 * - Data rows (Row 1..N): Subtle zebra striping (#FFFFFF & #F8FAFC)
 * - Numeric columns: Right aligned with standard thousands format (#,##0)
 * - Centered columns: Centered alignment
 */
function applyStandardTableStyles(
  ws: any,
  totalRows: number,
  totalCols: number,
  numericCols: number[] = [],
  centeredCols: number[] = []
) {
  // 1. Header Row
  for (let c = 0; c < totalCols; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) {
      ws[addr].s = STYLE_TABLE_HEADER;
    }
  }

  // 2. Data Rows
  for (let r = 1; r < totalRows; r++) {
    const isZebra = r % 2 === 0;
    const bgRgb = isZebra ? 'F8FAFC' : 'FFFFFF';

    for (let c = 0; c < totalCols; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) continue;

      const isNumeric = numericCols.includes(c);
      const isCentered = centeredCols.includes(c);

      const cellStyle: any = {
        font: { name: 'Segoe UI', sz: 10, color: { rgb: '1E293B' } },
        fill: { fgColor: { rgb: bgRgb } },
        border: BORDER_THIN,
        alignment: {
          horizontal: isNumeric ? 'right' : isCentered ? 'center' : 'left',
          vertical: 'center',
        },
      };

      if (isNumeric) {
        ws[addr].z = '#,##0';
        cellStyle.numFmt = '#,##0';
      }

      ws[addr].s = cellStyle;
    }
  }
}

/**
 * Universal clipboard copy helper that writes both text/html and text/plain.
 * When pasted into Excel or LibreOffice Calc, it pastes as cleanly formatted
 * cells with borders, headers, and numeric values without any 'Text Import' dialog.
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

export async function copyToClipboard(text: string): Promise<boolean> {
  return await copyHtmlAndTextToClipboard(`<pre>${text}</pre>`, text);
}

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

export function downloadWorkbook(wb: any, filename: string) {
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
  const isNetProfit = data.netProfit >= 0;

  // --- SHEET 1: RINGKASAN FINANSIAL EKSEKUTIF ---
  const colAWidth = Math.max(54, data.storeName.length + 15);
  const summaryAoa: any[][] = [
    [`LAPORAN KEUANGAN TERPADU - ${data.storeName.toUpperCase()}`, ''],
    [`Periode Laporan: ${data.periodLabel}`, ''],
    [`Waktu Ekspor: ${new Date().toLocaleString('id-ID')}`, ''],
    [`Dicetak Oleh: ${data.printedBy}`, ''],
    [],
    ['INDIKATOR FINANSIAL & KAS', 'NOMINAL (RP)'],
    ['Modal Awal Kasir Hari Ini', data.openingCash],
    ['Total Omset Penjualan POS (Barang)', data.posRevenue],
    ['Total Pendapatan Jasa Servis', data.serviceRevenue],
    ['TOTAL OMSET KOTOR TOKO (POS + SERVIS)', data.totalRevenue],
    ['Total Modal HPP (Barang & Sparepart)', data.totalCostHpp],
    ['Pengeluaran Operasional Kas Toko', data.operationalExpenses],
    [
      isNetProfit
        ? 'TOTAL OMSET DIPOTONG MODAL & BIAYA (LABA BERSIH)'
        : 'TOTAL DEFISIT BERSIH HARI INI (RUGI BERSIH)',
      data.netProfit,
    ],
    ['Penerimaan Tunai (Cash)', data.cashSalesTotal],
    ['Penerimaan Transfer Bank', data.transferSalesTotal],
    ['ESTIMASI SALDO KAS FISIK DI LACI KASIR', data.finalCashInDrawer],
    ['Total Transaksi Tercatat', data.transactions.length],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);

  // Auto Merge Title Banner across Column A and B so long store names (e.g. FALAH Komputer) never get cut off
  wsSummary['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
  ];

  // Style Title Banner
  wsSummary['A1'].s = STYLE_TITLE_BANNER;

  // Metadata styling
  ['A2', 'A3', 'A4'].forEach((k) => {
    if (wsSummary[k]) {
      wsSummary[k].s = {
        font: { name: 'Segoe UI', sz: 9, italic: true, color: { rgb: '475569' } },
      };
    }
  });

  // Table Header row (Row 6)
  ['A6', 'B6'].forEach((k) => {
    if (wsSummary[k]) {
      wsSummary[k].s = {
        ...STYLE_TABLE_HEADER,
        alignment: {
          horizontal: k === 'B6' ? 'right' : 'left',
          vertical: 'center',
        },
      };
    }
  });

  // Style Data Rows in Sheet 1 (Rows 7 to 17)
  for (let r = 7; r <= 17; r++) {
    const isZebra = r % 2 === 0;
    let bgRgb = isZebra ? 'F8FAFC' : 'FFFFFF';
    let fontColor = '0F172A';
    let isBold = false;
    let border = BORDER_THIN;

    if (r === 10) {
      // Total Omset Toko
      bgRgb = 'EFF6FF';
      fontColor = '1D4ED8';
      isBold = true;
    } else if (r === 11) {
      // HPP
      bgRgb = 'FEF3C7';
      fontColor = 'B45309';
    } else if (r === 12) {
      // Pengeluaran
      bgRgb = 'FFE4E6';
      fontColor = 'E11D48';
    } else if (r === 13) {
      // Laba Bersih / Rugi
      bgRgb = isNetProfit ? 'ECFDF5' : 'FFF1F2';
      fontColor = isNetProfit ? '047857' : 'BE123C';
      isBold = true;
      border = BORDER_DOUBLE_BOTTOM;
    } else if (r === 16) {
      // Saldo Kas di Laci
      bgRgb = 'E0F2FE';
      fontColor = '0369A1';
      isBold = true;
      border = BORDER_DOUBLE_BOTTOM;
    }

    const cellA = wsSummary['A' + r];
    const cellB = wsSummary['B' + r];

    if (cellA) {
      cellA.s = {
        font: { name: 'Segoe UI', sz: 10, bold: isBold, color: { rgb: fontColor } },
        fill: { fgColor: { rgb: bgRgb } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border,
      };
    }

    if (cellB) {
      cellB.z = '#,##0';
      cellB.s = {
        font: { name: 'Segoe UI', sz: 10, bold: isBold, color: { rgb: fontColor } },
        fill: { fgColor: { rgb: bgRgb } },
        numFmt: '#,##0',
        alignment: { horizontal: 'right', vertical: 'center' },
        border,
      };
    }
  }

  wsSummary['!cols'] = [{ wch: colAWidth }, { wch: 25 }];
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
  applyStandardTableStyles(wsTx, txRows.length, txHeaders.length, [6, 7, 8], [0, 1, 2, 5]);

  // Highlight Profit column (Col 8)
  for (let r = 1; r < txRows.length; r++) {
    const cellLaba = wsTx[XLSX.utils.encode_cell({ r, c: 8 })];
    if (cellLaba) {
      const val = Number(cellLaba.v) || 0;
      const isProf = val >= 0;
      cellLaba.s = {
        ...cellLaba.s,
        font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: isProf ? '047857' : 'BE123C' } },
        fill: { fgColor: { rgb: isProf ? 'ECFDF5' : 'FFF1F2' } },
      };
    }
  }

  wsTx['!cols'] = [
    { wch: 22 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 24 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 22 },
    { wch: 55 },
  ];
  XLSX.utils.book_append_sheet(wb, wsTx, 'Rincian Transaksi');

  // --- SHEET 3: RINCIAN ITEM TERJUAL ---
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
  applyStandardTableStyles(wsItems, itemRows.length, itemHeaders.length, [4, 5, 6, 7, 8, 9], [0, 1, 2, 4]);

  // Highlight Profit in column 9 (Laba Kotor Item)
  for (let r = 1; r < itemRows.length; r++) {
    const cellLaba = wsItems[XLSX.utils.encode_cell({ r, c: 9 })];
    if (cellLaba) {
      cellLaba.s = {
        ...cellLaba.s,
        font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: '047857' } },
      };
    }
  }

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
  const isNetProfit = data.netProfit >= 0;

  // 1. Build TSV (Plain text fallback)
  const tsvLines: string[] = [];
  tsvLines.push(`LAPORAN KEUANGAN TERPADU - ${cleanCell(data.storeName).toUpperCase()}`);
  tsvLines.push(`Periode: ${cleanCell(data.periodLabel)}\tDicetak Oleh: ${cleanCell(data.printedBy)}`);
  tsvLines.push(`Waktu Ekspor: ${new Date().toLocaleString('id-ID')}`);
  tsvLines.push('');
  tsvLines.push('RINGKASAN FINANSIAL\tNOMINAL (RP)');
  tsvLines.push(`Modal Awal Kasir Hari Ini\t${data.openingCash}`);
  tsvLines.push(`Total Omset Penjualan POS\t${data.posRevenue}`);
  tsvLines.push(`Total Pendapatan Jasa Servis\t${data.serviceRevenue}`);
  tsvLines.push(`TOTAL OMSET TOKO\t${data.totalRevenue}`);
  tsvLines.push(`Total Modal HPP\t${data.totalCostHpp}`);
  tsvLines.push(`Pengeluaran Kas Toko\t${data.operationalExpenses}`);
  tsvLines.push(
    `${isNetProfit ? 'LABA BERSIH TOKO (SURPLUS)' : 'RUGI / DEFISIT BERSIH TOKO (MINUS)'}\t${data.netProfit}`
  );
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

  // 2. Build Rich Executive HTML Table with Full Colors
  const htmlRows = data.transactions
    .map((t, idx) => {
      const isZebra = idx % 2 === 1;
      const rowBg = isZebra ? '#f8fafc' : '#ffffff';
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
      const isProf = t.grossProfit >= 0;

      return `<tr style="background: ${rowBg};">
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: bold; font-family: monospace;">${escapeHtml(t.invoiceNumber)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center;">${escapeHtml(dateFormatted)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center;">${escapeHtml(t.type === 'POS' ? 'Penjualan' : 'Servis')}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">${escapeHtml(t.cashierName || 'Kasir')}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">${escapeHtml(t.customerName || 'Umum')}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-weight: bold;">${escapeHtml(t.paymentMethod || 'CASH')}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; font-weight: bold;">Rp ${t.grandTotal.toLocaleString('id-ID')}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right;">Rp ${t.totalCost.toLocaleString('id-ID')}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; font-weight: bold; color: ${isProf ? '#047857' : '#be123c'}; background: ${isProf ? '#ecfdf5' : '#fff1f2'};">Rp ${t.grossProfit.toLocaleString('id-ID')}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px;">${itemsSummary}</td>
      </tr>`;
    })
    .join('');

  const htmlContent = `
    <html>
      <head><meta charset="utf-8"></head>
      <body>
        <table style="border-collapse: collapse; font-family: sans-serif; font-size: 12px; margin-bottom: 22px;">
          <tr style="background: #0f172a; color: #ffffff;">
            <td colspan="3" style="font-size: 14px; font-weight: bold; padding: 10px 12px; border: 1px solid #0f172a;">
              LAPORAN KEUANGAN TERPADU - ${escapeHtml(data.storeName.toUpperCase())}
            </td>
          </tr>
          <tr style="background: #f8fafc; color: #475569; font-size: 11px;">
            <td colspan="2" style="padding: 6px 12px; border: 1px solid #cbd5e1;">
              Periode: <strong>${escapeHtml(data.periodLabel)}</strong> | Dicetak Oleh: <strong>${escapeHtml(data.printedBy)}</strong> | Waktu: ${new Date().toLocaleString('id-ID')}
            </td>
          </tr>
          <tr style="background: #1e293b; color: #ffffff; font-weight: bold;">
            <th style="border: 1px solid #94a3b8; padding: 7px 12px; text-align: left;">Indikator Finansial</th>
            <th style="border: 1px solid #94a3b8; padding: 7px 12px; text-align: right;">Nominal (Rp)</th>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px 12px;">Modal Awal Kasir</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 12px; text-align: right; font-weight: bold;">Rp ${data.openingCash.toLocaleString('id-ID')}</td>
          </tr>
          <tr style="background: #f8fafc;">
            <td style="border: 1px solid #cbd5e1; padding: 6px 12px;">Total Omset POS (Barang)</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 12px; text-align: right;">Rp ${data.posRevenue.toLocaleString('id-ID')}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px 12px;">Total Omset Servis</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 12px; text-align: right;">Rp ${data.serviceRevenue.toLocaleString('id-ID')}</td>
          </tr>
          <tr style="font-weight: bold; background: #eff6ff; color: #1d4ed8;">
            <td style="border: 1px solid #93c5fd; padding: 7px 12px;">TOTAL OMSET TOKO (POS + SERVIS)</td>
            <td style="border: 1px solid #93c5fd; padding: 7px 12px; text-align: right;">Rp ${data.totalRevenue.toLocaleString('id-ID')}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px 12px;">Total Modal HPP (Barang & Part)</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 12px; text-align: right; color: #b45309;">Rp ${data.totalCostHpp.toLocaleString('id-ID')}</td>
          </tr>
          <tr style="background: #f8fafc;">
            <td style="border: 1px solid #cbd5e1; padding: 6px 12px;">Pengeluaran Kas Toko</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 12px; text-align: right; color: #e11d48;">Rp ${data.operationalExpenses.toLocaleString('id-ID')}</td>
          </tr>
          ${
            isNetProfit
              ? `<tr style="font-weight: bold; background: #ecfdf5; color: #047857; font-size: 13px;">
                  <td style="border: 2px solid #059669; padding: 8px 12px;">LABA BERSIH TOKO (UNTUNG / SURPLUS)</td>
                  <td style="border: 2px solid #059669; padding: 8px 12px; text-align: right;">Rp ${data.netProfit.toLocaleString('id-ID')}</td>
                </tr>`
              : `<tr style="font-weight: bold; background: #fff1f2; color: #be123c; font-size: 13px;">
                  <td style="border: 2px solid #e11d48; padding: 8px 12px;">RUGI / DEFISIT BERSIH TOKO (MINUS HARI INI)</td>
                  <td style="border: 2px solid #e11d48; padding: 8px 12px; text-align: right;">Rp ${data.netProfit.toLocaleString('id-ID')}</td>
                </tr>`
          }
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px 12px;">Penerimaan Tunai (Cash)</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 12px; text-align: right;">Rp ${data.cashSalesTotal.toLocaleString('id-ID')}</td>
          </tr>
          <tr style="background: #f8fafc;">
            <td style="border: 1px solid #cbd5e1; padding: 6px 12px;">Penerimaan Transfer Bank</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 12px; text-align: right;">Rp ${data.transferSalesTotal.toLocaleString('id-ID')}</td>
          </tr>
          <tr style="font-weight: bold; background: #e0f2fe; color: #0369a1; font-size: 13px;">
            <td style="border: 2px solid #0284c7; padding: 8px 12px;">SALDO KAS DI LACI (UANG FISIK KASIR)</td>
            <td style="border: 2px solid #0284c7; padding: 8px 12px; text-align: right;">Rp ${data.finalCashInDrawer.toLocaleString('id-ID')}</td>
          </tr>
        </table>

        <table style="border-collapse: collapse; font-family: sans-serif; font-size: 11px;">
          <thead>
            <tr style="background: #1e293b; color: #ffffff;">
              <th style="border: 1px solid #94a3b8; padding: 7px 8px;">No. Invoice</th>
              <th style="border: 1px solid #94a3b8; padding: 7px 8px;">Tanggal & Jam</th>
              <th style="border: 1px solid #94a3b8; padding: 7px 8px;">Tipe</th>
              <th style="border: 1px solid #94a3b8; padding: 7px 8px;">Kasir</th>
              <th style="border: 1px solid #94a3b8; padding: 7px 8px;">Pelanggan</th>
              <th style="border: 1px solid #94a3b8; padding: 7px 8px;">Metode</th>
              <th style="border: 1px solid #94a3b8; padding: 7px 8px; text-align: right;">Omset (Rp)</th>
              <th style="border: 1px solid #94a3b8; padding: 7px 8px; text-align: right;">Modal HPP (Rp)</th>
              <th style="border: 1px solid #94a3b8; padding: 7px 8px; text-align: right;">Laba Bersih (Rp)</th>
              <th style="border: 1px solid #94a3b8; padding: 7px 8px;">Rincian Produk</th>
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
  applyStandardTableStyles(ws, rows.length, headers.length, [6, 7, 8, 13], [0, 1, 4, 9, 10, 11, 12]);

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
// 3. POS TRANSACTIONS EXPORT
// ==========================================

export function exportTransactionsToExcel(transactions: Transaction[], storeName: string = 'SparkPOS') {
  const wb = XLSX.utils.book_new();

  const headers = [
    'No. Bukti / Invoice',
    'Tanggal & Waktu',
    'Kasir',
    'Pelanggan',
    'Metode Bayar',
    'Jml Item',
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
  applyStandardTableStyles(ws, rows.length, headers.length, [6, 7, 8, 9, 10], [0, 1, 4, 5]);

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
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">${escapeHtml(dateStr)}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px;">${escapeHtml(t.cashierName || 'Kasir')}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px;">${escapeHtml(t.customerName || 'Umum')}</td>
      <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">${escapeHtml(t.paymentMethod || 'CASH')}</td>
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
  applyStandardTableStyles(ws, rows.length, headers.length, [11, 12, 13, 14, 17], [0, 1, 9, 15, 16]);

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
    [`REKAPITULASI KEUANGAN BULANAN - ${data.storeName.toUpperCase()}`, ''],
    [`Periode: 1 ${data.monthName} ${data.year} s/d Selesai`, ''],
    [`Waktu Ekspor: ${new Date().toLocaleString('id-ID')}`, ''],
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
  const colAWidth = Math.max(50, data.storeName.length + 15);
  wsSummary['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
  ];
  wsSummary['A1'].s = STYLE_TITLE_BANNER;
  ['A5', 'B5', 'A15', 'B15'].forEach((k) => {
    if (wsSummary[k]) wsSummary[k].s = STYLE_TABLE_HEADER;
  });

  // Style summary rows
  for (let r = 6; r <= 13; r++) {
    const cellA = wsSummary['A' + r];
    const cellB = wsSummary['B' + r];
    if (cellA && cellB) {
      const isZebra = r % 2 === 0;
      const isGrand = r === 8;
      const isNet = r === 13;
      const bg = isNet ? 'ECFDF5' : isGrand ? 'EFF6FF' : isZebra ? 'F8FAFC' : 'FFFFFF';
      const color = isNet ? '047857' : isGrand ? '1D4ED8' : '0F172A';
      const border = isNet ? BORDER_DOUBLE_BOTTOM : BORDER_THIN;

      cellA.s = {
        font: { name: 'Segoe UI', sz: 10, bold: isGrand || isNet, color: { rgb: color } },
        fill: { fgColor: { rgb: bg } },
        border,
      };
      cellB.z = '#,##0';
      cellB.s = {
        font: { name: 'Segoe UI', sz: 10, bold: isGrand || isNet, color: { rgb: color } },
        fill: { fgColor: { rgb: bg } },
        numFmt: '#,##0',
        alignment: { horizontal: 'right', vertical: 'center' },
        border,
      };
    }
  }

  wsSummary['!cols'] = [{ wch: colAWidth }, { wch: 24 }];
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
  applyStandardTableStyles(
    wsDaily,
    dailyRows.length,
    dailyHeaders.length,
    [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    [0, 1]
  );

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
    [`REKAPITULASI SESI KASIR - ${storeName.toUpperCase()}`, ''],
    [`Periode / Tanggal: ${dateLabel}`, ''],
    [`Waktu Ekspor: ${new Date().toLocaleString('id-ID')}`, ''],
    [`Total Sesi: ${shifts.length}`, ''],
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
  wsSummary['A1'].s = STYLE_TITLE_BANNER;
  ['A6', 'B6'].forEach((k) => {
    if (wsSummary[k]) wsSummary[k].s = STYLE_TABLE_HEADER;
  });

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
  applyStandardTableStyles(
    wsShifts,
    shiftRows.length,
    shiftHeaders.length,
    [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    [0, 2, 3, 4, 16]
  );

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
