import { Transaction, StoreProfile } from '../types/pos';
import { formatRupiah } from './cartCalculator';

/**
 * Menghitung tanggal berakhirnya masa garansi unit secara presisi
 */
export function calculateWarrantyExpiry(
  saleDateStr: string,
  warrantyPeriod?: string
): { label: string; expiryDateStr: string } {
  if (
    !warrantyPeriod ||
    warrantyPeriod.trim() === '' ||
    warrantyPeriod.toLowerCase() === 'tidak ada' ||
    warrantyPeriod.toLowerCase() === 'non-garansi'
  ) {
    return { label: 'Non-Garansi', expiryDateStr: '-' };
  }

  const baseDate = new Date(saleDateStr);
  const lower = warrantyPeriod.toLowerCase();
  let daysToAdd = 30; // default 1 bulan jika tidak terdeteksi

  const matchNum = lower.match(/(\d+)/);
  const num = matchNum ? parseInt(matchNum[1], 10) : 1;

  if (lower.includes('tahun') || lower.includes('thn') || lower.includes('year')) {
    daysToAdd = num * 365;
  } else if (lower.includes('minggu') || lower.includes('week')) {
    daysToAdd = num * 7;
  } else if (lower.includes('hari') || lower.includes('day')) {
    daysToAdd = num;
  } else if (lower.includes('bulan') || lower.includes('bln') || lower.includes('month')) {
    daysToAdd = num * 30;
  }

  const expiry = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  const expiryFormatted = expiry.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return {
    label: warrantyPeriod,
    expiryDateStr: expiryFormatted,
  };
}

/**
 * Auto-detect ukuran kertas dan format printer paling optimal:
 * - HANYA format Faktur A4/F4 jika pelanggan MEMBELI UNIT LAPTOP.
 * - Pembelian produk printer, tinta, aksesoris, & sparepart lainnya tetap menggunakan
 *   format Struk Mini Kasir Thermal (58mm) agar sangat menghemat kertas dan tidak makan 1 lembar terus-menerus.
 */
export function detectOptimalPaperFormat(
  tx: Transaction,
  configuredPaperWidth: '58mm' | '80mm' | 'A4' | 'F4' | 'auto' = 'auto'
): '58mm' | 'A4' {
  if (configuredPaperWidth && configuredPaperWidth !== 'auto') {
    if (configuredPaperWidth === 'F4' || configuredPaperWidth === 'A4') return 'A4';
    return '58mm';
  }

  // Hanya jika transaksi memiliki barang unit laptop
  const hasLaptop = tx.items.some(isLaptopItem);
  if (hasLaptop) {
    return 'A4';
  }

  return '58mm';
}

export function isLaptopItem(item: { name: string; categoryName?: string }): boolean {
  const cat = (item.categoryName || '').toLowerCase();
  const name = item.name.toLowerCase();
  if (cat.includes('laptop') || cat.includes('notebook')) return true;
  return /\b(laptop|notebook|macbook|thinkpad|chromebook)\b/i.test(name);
}

/**
 * Memeriksa apakah produk berhak mendapatkan kartu garansi toko:
 * Garansi HANYA untuk produk Laptop, Sparepart, dan Printer/Print saja.
 * Produk Aksesoris dan Jasa tidak mendapatkan kartu garansi toko.
 */
export function isWarrantyEligibleItem(item: { name: string; categoryName?: string }): boolean {
  const cat = (item.categoryName || '').toLowerCase();
  const name = item.name.toLowerCase();

  // 1. Laptop / Notebook
  if (cat.includes('laptop') || cat.includes('notebook')) return true;
  if (/\b(laptop|notebook|macbook|thinkpad|chromebook)\b/i.test(name)) return true;

  // 2. Sparepart (RAM, SSD, LCD, baterai, motherboard, prosesor, psu, dll)
  if (cat.includes('sparepart') || cat.includes('part') || cat.includes('komponen')) return true;
  if (/\b(ram|ssd|hdd|harddisk|lcd|baterai|battery|motherboard|mobo|fan|processor|prosesor|vga|psu|power supply|keyboard internal)\b/i.test(name)) return true;

  // 3. Printer / Print (Printer unit, cartridge, toner, printhead, tinta)
  if (cat.includes('printer') || cat.includes('tinta') || cat.includes('print')) return true;
  if (/\b(printer|print|epson|canon|hp laserjet|brother|deskjet|ink tank|ecotank|cartridge|toner|printhead|head)\b/i.test(name)) return true;

  return false;
}

/**
 * Bungkus teks panjang menjadi beberapa baris (word-wrap) agar menurun rapi dan tidak terpotong di printer kasir
 */
export function wrapText(text: string, width: number): string[] {
  if (!text) return [];
  const lines: string[] = [];
  const rawLines = text.split('\n');

  for (const rawLine of rawLines) {
    if (rawLine.length <= width) {
      lines.push(rawLine);
      continue;
    }

    const words = rawLine.split(' ');
    let currentLine = '';

    for (const word of words) {
      if (!currentLine) {
        if (word.length <= width) {
          currentLine = word;
        } else {
          for (let i = 0; i < word.length; i += width) {
            lines.push(word.substring(i, i + width));
          }
        }
      } else if (currentLine.length + 1 + word.length <= width) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        if (word.length <= width) {
          currentLine = word;
        } else {
          for (let i = 0; i < word.length; i += width) {
            if (i + width >= word.length) {
              currentLine = word.substring(i);
            } else {
              lines.push(word.substring(i, i + width));
            }
          }
        }
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

export function padBetween(left: string, right: string, width: number): string {
  const spaces = width - left.length - right.length;
  if (spaces >= 1) {
    return left + ' '.repeat(spaces) + right;
  }
  // Jika panjang left + right melebihi lebar kertas, turunkan right ke baris berikutnya (rata kanan) agar tidak terpotong
  const rightPad = Math.max(0, width - right.length);
  return `${left}\n${' '.repeat(rightPad)}${right}`;
}

export function centerText(text: string, width: number): string {
  if (text.length >= width) return text;
  const leftPad = Math.floor((width - text.length) / 2);
  return ' '.repeat(leftPad) + text;
}

export function centerTextLines(text: string, width: number): string[] {
  const wrapped = wrapText(text, width);
  return wrapped.map((line) => {
    if (line.length >= width) return line;
    const leftPad = Math.floor((width - line.length) / 2);
    return ' '.repeat(leftPad) + line;
  });
}

export function generateReceiptText(tx: Transaction, profile: StoreProfile): string {
  const width = profile.paperWidth === '58mm' ? 32 : 42;
  const divider = '-'.repeat(width);
  const doubleDivider = '='.repeat(width);
  const lines: string[] = [];

  // 1. Header Toko (Word-wrap ke bawah rapi jika panjang)
  for (const sLine of centerTextLines(profile.storeName.toUpperCase(), width)) {
    lines.push(sLine);
  }
  if (profile.address) {
    for (const aLine of centerTextLines(profile.address, width)) {
      lines.push(aLine);
    }
  }
  if (profile.phone) {
    for (const pLine of centerTextLines(`Telp: ${profile.phone}`, width)) {
      lines.push(pLine);
    }
  }
  lines.push(doubleDivider);

  // 2. Transaction Info
  lines.push(`No. Nota : ${tx.invoiceNumber}`);
  const dateStr = new Date(tx.createdAt).toLocaleString('id-ID', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  lines.push(`Waktu    : ${dateStr}`);
  lines.push(`Kasir    : ${tx.cashierName}`);
  if (tx.customerName) {
    for (const cLine of wrapText(`Pelanggan: ${tx.customerName}`, width)) {
      lines.push(cLine);
    }
  }
  lines.push(divider);

  // 3. Line Items
  for (const item of tx.items) {
    let itemName = item.name;
    if (item.condition && item.condition !== 'BARU') {
      itemName += ` [${item.condition}]`;
    }
    for (const nLine of wrapText(itemName, width)) {
      lines.push(nLine);
    }
    let left = ` ${item.quantity} x ${formatRupiah(item.unitPrice)}`;
    if (item.discountAmount > 0) {
      left += ` (-${formatRupiah(item.discountAmount)})`;
    }
    const right = formatRupiah(item.subtotal);
    lines.push(padBetween(left, right, width));

    if (item.serialNumber) {
      for (const snLine of wrapText(`  SN: ${item.serialNumber}`, width)) {
        lines.push(snLine);
      }
    }
    if (item.warrantyPeriod) {
      const { expiryDateStr } = calculateWarrantyExpiry(tx.createdAt, item.warrantyPeriod);
      for (const wLine of wrapText(`  Garansi: ${item.warrantyPeriod} (s/d ${expiryDateStr})`, width)) {
        lines.push(wLine);
      }
    }
  }
  lines.push(divider);

  // 4. Financial Summary
  lines.push(padBetween('Subtotal:', formatRupiah(tx.subtotal), width));

  if (tx.discountOrderAmount > 0) {
    lines.push(padBetween('Diskon Nota:', `-${formatRupiah(tx.discountOrderAmount)}`, width));
  }

  if (tx.taxAmount > 0) {
    lines.push(padBetween('PPN:', formatRupiah(tx.taxAmount), width));
  }

  if (tx.shippingCost && tx.shippingCost > 0) {
    const courierLabel = tx.shippingCourier ? `Ongkir (${tx.shippingCourier}):` : 'Ongkos Kirim:';
    lines.push(padBetween(courierLabel, formatRupiah(tx.shippingCost), width));
    if (tx.shippingTrackingNumber) {
      for (const rLine of wrapText(` Resi: ${tx.shippingTrackingNumber}`, width)) {
        lines.push(rLine);
      }
    }
    if (tx.shippingAddress) {
      for (const aLine of wrapText(` Alamat: ${tx.shippingAddress}`, width)) {
        lines.push(aLine);
      }
    }
  }

  lines.push(doubleDivider);
  lines.push(padBetween('TOTAL AKHIR:', formatRupiah(tx.grandTotal), width));

  // 5. Payments
  for (const p of tx.payments) {
    lines.push(padBetween(`Bayar (${p.method}):`, formatRupiah(p.amount), width));
  }

  if (tx.changeAmount > 0) {
    lines.push(padBetween('KEMBALIAN:', formatRupiah(tx.changeAmount), width));
  }
  lines.push(doubleDivider);

  // 5.b Kartu Garansi (KHUSUS LAPTOP, SPAREPART & PRINTER SAJA)
  const warrantyItems = tx.items.filter(
    (i) =>
      isWarrantyEligibleItem(i) &&
      i.warrantyPeriod &&
      !['tidak ada', 'non-garansi', '-'].includes(i.warrantyPeriod.toLowerCase())
  );

  if (warrantyItems.length > 0) {
    for (const cLine of centerTextLines('KARTU GARANSI TOKO', width)) {
      lines.push(cLine);
    }
    for (const it of warrantyItems) {
      const { expiryDateStr } = calculateWarrantyExpiry(tx.createdAt, it.warrantyPeriod);
      for (const nLine of wrapText(`* ${it.name}`, width)) {
        lines.push(nLine);
      }
      for (const wLine of wrapText(`  Garansi: ${it.warrantyPeriod} (s/d ${expiryDateStr})`, width)) {
        lines.push(wLine);
      }
    }
    lines.push(doubleDivider);
  }

  // 6. Footer Toko
  if (profile.receiptFooter) {
    const footerLines = profile.receiptFooter.split('\n');
    for (const fLine of footerLines) {
      for (const cLine of centerTextLines(fLine.trim(), width)) {
        lines.push(cLine);
      }
    }
  }

  if (warrantyItems.length > 0) {
    for (const cLine of centerTextLines('Terimakasih atas kunjungannya,', width)) {
      lines.push(cLine);
    }
    for (const cLine of centerTextLines('sertakan kartu garansi', width)) {
      lines.push(cLine);
    }
  } else {
    for (const cLine of centerTextLines('Terimakasih atas kunjungannya', width)) {
      lines.push(cLine);
    }
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Format Nota / Tanda Terima Servis Komputer & Laptop untuk Printer Thermal (58mm/80mm)
 */
export function generateServiceReceiptText(
  order: import('../types/pos').ServiceOrder,
  profile: StoreProfile
): string {
  const width = profile.paperWidth === '58mm' ? 32 : 42;
  const divider = '-'.repeat(width);
  const doubleDivider = '='.repeat(width);
  const lines: string[] = [];

  // Header Toko
  for (const sLine of centerTextLines(profile.storeName.toUpperCase(), width)) {
    lines.push(sLine);
  }
  if (profile.address) {
    for (const aLine of centerTextLines(profile.address, width)) {
      lines.push(aLine);
    }
  }
  if (profile.phone) {
    for (const pLine of centerTextLines(`Telp/WA: ${profile.phone}`, width)) {
      lines.push(pLine);
    }
  }
  lines.push(doubleDivider);

  // Judul Nota Servis
  const isCancelled = order.status === 'DIBATALKAN';
  for (const tLine of centerTextLines(isCancelled ? 'NOTA PEMBATALAN SERVIS' : 'TANDA TERIMA SERVIS', width)) {
    lines.push(tLine);
  }
  lines.push(divider);

  // Informasi Tiket
  lines.push(`No. Tiket : ${order.ticketNumber}`);
  const dateStr = new Date(order.receivedAt || order.createdAt).toLocaleString('id-ID', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  lines.push(`Tgl Masuk : ${dateStr}`);
  for (const line of wrapText(`Pelanggan : ${order.customerName}`, width)) {
    lines.push(line);
  }
  if (order.customerPhone) lines.push(`No. HP/WA : ${order.customerPhone}`);
  for (const line of wrapText(`Perangkat : ${order.deviceType}`, width)) {
    lines.push(line);
  }
  if (order.deviceSerial) {
    for (const line of wrapText(`No. Seri  : ${order.deviceSerial}`, width)) {
      lines.push(line);
    }
  }
  if (order.completeness) {
    for (const line of wrapText(`Kelengkpn : ${order.completeness}`, width)) {
      lines.push(line);
    }
  }
  if (order.physicalCondition) {
    for (const line of wrapText(`Kondisi   : ${order.physicalCondition}`, width)) {
      lines.push(line);
    }
  }
  if (order.devicePassword) lines.push(`Pass/PIN  : ${order.devicePassword}`);
  if (!isCancelled && order.warrantyDays && order.warrantyDays > 0) {
    lines.push(`Garansi   : ${order.warrantyDays} Hari`);
  }
  if (order.assignedTechName) lines.push(`Teknisi   : ${order.assignedTechName}`);
  lines.push(divider);

  // Keluhan & Diagnosa
  lines.push('Keluhan:');
  for (const line of wrapText(` ${order.complaint || '-'}`, width)) {
    lines.push(line);
  }
  if (order.diagnosis) {
    lines.push('Diagnosa:');
    for (const line of wrapText(` ${order.diagnosis}`, width)) {
      lines.push(line);
    }
  }
  lines.push(divider);

  // Jika Dibatalkan: Cantumkan status dan alasan pembatalan
  if (isCancelled) {
    lines.push(padBetween('STATUS SERVIS:', 'DIBATALKAN', width));
    if (order.cancelReason) {
      lines.push('Alasan Pembatalan:');
      for (const line of wrapText(` ${order.cancelReason}`, width)) {
        lines.push(line);
      }
    }
    lines.push(doubleDivider);
  }

  // Rincian Komponen / Jasa jika sudah ada
  if (order.items && order.items.length > 0) {
    lines.push('Rincian Pengerjaan:');
    for (const item of order.items) {
      for (const nLine of wrapText(`${item.type === 'PART' ? '[PART]' : '[JASA]'} ${item.name}`, width)) {
        lines.push(nLine);
      }
      const left = ` ${item.quantity} x ${formatRupiah(item.sellPrice)}`;
      const right = formatRupiah(item.subtotal);
      lines.push(padBetween(left, right, width));
    }
    lines.push(divider);
  }

  // Total Finansial
  lines.push(padBetween('Total Tagihan:', formatRupiah(order.grandTotal), width));
  if (order.downPayment && order.downPayment > 0) {
    lines.push(padBetween('DP / Uang Muka:', formatRupiah(order.downPayment), width));
    const sisa = Math.max(0, order.grandTotal - order.downPayment);
    lines.push(padBetween('Sisa Tagihan  :', formatRupiah(sisa), width));
  }
  lines.push(
    padBetween(
      'Status Bayar :',
      order.isPaid ? 'LUNAS' : order.downPayment && order.downPayment > 0 ? 'DP DITERIMA' : isCancelled ? 'BATAL' : 'BELUM LUNAS',
      width
    )
  );
  if (order.isPaid || (order.paidAmount && order.paidAmount > 0)) {
    const isTf = order.paymentMethod?.toUpperCase().includes('TRANSFER');
    lines.push(padBetween('Metode Bayar :', isTf ? 'TRANSFER BANK' : 'TUNAI / CASH', width));
  }
  if (order.paidAmount > 0 && (!order.downPayment || order.paidAmount !== order.downPayment)) {
    lines.push(padBetween('Total Dibayar:', formatRupiah(order.paidAmount), width));
  }
  lines.push(doubleDivider);

  // Ketentuan & Tanda Tangan
  if (isCancelled) {
    for (const cLine of centerTextLines('Unit telah diserahkan kembali ke pelanggan.', width)) {
      lines.push(cLine);
    }
  } else {
    for (const cLine of centerTextLines('Syarat Pengambilan Servis:', width)) {
      lines.push(cLine);
    }
    lines.push('1. Wajib membawa nota tanda terima ini.');
    lines.push('2. Barang tidak diambil >30 hari di luar');
    lines.push('   tanggung jawab toko.');
    if (order.warrantyDays && order.warrantyDays > 0) {
      lines.push(`3. Garansi servis berlaku ${order.warrantyDays} hari.`);
    }
  }
  lines.push('');
  lines.push(padBetween('( Pelanggan )', '( Teknisi )', width));
  lines.push('');
  for (const cLine of centerTextLines('Terimakasih atas kunjungannya', width)) {
    lines.push(cLine);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Format Laporan Penutupan Shift Kasir (Z-Report) untuk Printer Thermal (58mm/80mm)
 */
export interface ShiftReportPrintData {
  shiftNumber: number;
  cashierName: string;
  shiftName?: string;
  startTime: string;
  endTime: string;
  openingCash: number;
  closingCash: number;
  expectedCash: number;
  discrepancy: number;
  cashSales: number;
  nonCashSales: number;
  serviceCashSales?: number;
  serviceNonCashSales?: number;
  cashIn: number;
  cashOut: number;
  txCount: number;
  serviceCount?: number;
  note?: string;
}

export function generateShiftReportReceiptText(
  data: ShiftReportPrintData,
  profile: StoreProfile
): string {
  const width = profile.paperWidth === '58mm' ? 32 : 42;
  const divider = '-'.repeat(width);
  const doubleDivider = '='.repeat(width);
  const lines: string[] = [];

  // 1. Header Toko
  lines.push(centerText(profile.storeName.toUpperCase(), width));
  if (profile.address) lines.push(centerText(profile.address, width));
  if (profile.phone) lines.push(centerText(`Telp: ${profile.phone}`, width));
  lines.push(doubleDivider);

  // 2. Judul Laporan Shift
  lines.push(centerText('LAPORAN TUTUP SHIFT (Z-REPORT)', width));
  lines.push(divider);

  // 3. Info Kasir & Periode
  lines.push(`No. Shift : #${data.shiftNumber}${data.shiftName ? ` (${data.shiftName})` : ''}`);
  lines.push(`Kasir     : ${data.cashierName}`);

  const startFormatted = new Date(data.startTime).toLocaleString('id-ID', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const endFormatted = new Date(data.endTime).toLocaleString('id-ID', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  lines.push(`Mulai     : ${startFormatted}`);
  lines.push(`Selesai   : ${endFormatted}`);
  lines.push(doubleDivider);

  // 4. Ringkasan Kas Laci (Drawer Reconciliation)
  lines.push(centerText('REKONSILIASI KAS LACI', width));
  lines.push(divider);
  lines.push(padBetween('Modal Awal Kas:', formatRupiah(data.openingCash), width));
  lines.push(padBetween('(+) Penjualan Tunai:', formatRupiah(data.cashSales), width));
  if (data.serviceCashSales && data.serviceCashSales > 0) {
    lines.push(padBetween('(+) Servis Tunai:', formatRupiah(data.serviceCashSales), width));
  }
  if (data.cashIn > 0) {
    lines.push(padBetween('(+) Kas Masuk Lain:', formatRupiah(data.cashIn), width));
  }
  if (data.cashOut > 0) {
    lines.push(padBetween('(-) Kas Keluar Biaya:', `-${formatRupiah(data.cashOut)}`, width));
  }
  lines.push(divider);
  lines.push(padBetween('Total Ekspektasi Kas:', formatRupiah(data.expectedCash), width));
  lines.push(padBetween('Uang Fisik Dihitung :', formatRupiah(data.closingCash), width));

  let selisihLabel = 'SEIMBANG (Rp 0)';
  if (data.discrepancy > 0) {
    selisihLabel = `+${formatRupiah(data.discrepancy)} (LEBIH)`;
  } else if (data.discrepancy < 0) {
    selisihLabel = `${formatRupiah(data.discrepancy)} (MINUS)`;
  }
  lines.push(padBetween('Status Selisih Kas  :', selisihLabel, width));
  lines.push(doubleDivider);

  // 5. Ringkasan Non-Tunai & Omzet
  lines.push(centerText('RINGKASAN PENJUALAN', width));
  lines.push(divider);
  lines.push(padBetween('Total Nota POS     :', `${data.txCount} Transaksi`, width));
  lines.push(padBetween('Penjualan Tunai    :', formatRupiah(data.cashSales), width));
  lines.push(padBetween('Penjualan Non-Tunai:', formatRupiah(data.nonCashSales), width));
  lines.push(padBetween('Total Omzet POS    :', formatRupiah(data.cashSales + data.nonCashSales), width));

  if ((data.serviceCount && data.serviceCount > 0) || (data.serviceCashSales && data.serviceCashSales > 0)) {
    lines.push(divider);
    lines.push(padBetween('Servis Selesai     :', `${data.serviceCount || 0} Tiket`, width));
    const totalServis = (data.serviceCashSales || 0) + (data.serviceNonCashSales || 0);
    lines.push(padBetween('Total Omzet Servis :', formatRupiah(totalServis), width));
  }

  const grandGrossRevenue = data.cashSales + data.nonCashSales + (data.serviceCashSales || 0) + (data.serviceNonCashSales || 0);
  lines.push(doubleDivider);
  lines.push(padBetween('TOTAL OMZET SHIFT  :', formatRupiah(grandGrossRevenue), width));
  lines.push(doubleDivider);

  // 6. Catatan Kasir
  if (data.note) {
    lines.push('Catatan:');
    lines.push(` ${data.note}`);
    lines.push(divider);
  }

  // 7. Tanda Tangan
  lines.push('');
  lines.push(padBetween('( Kasir )', '( Supervisor/Owner )', width));
  lines.push('');
  lines.push(centerText(`Dicetak: ${new Date().toLocaleString('id-ID')}`, width));
  lines.push('');

  return lines.join('\n');
}

