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
 * - Jika ada penjualan unit laptop, serial number, atau nominal besar (>= Rp 1.5jt) -> Format Faktur A4/F4
 * - Jika penjualan aksesoris/sparepart umum -> Format Struk Mini Kasir Thermal (58mm/80mm)
 */
export function detectOptimalPaperFormat(
  tx: Transaction,
  configuredPaperWidth: '58mm' | '80mm' | 'A4' | 'F4' | 'auto' = 'auto'
): '58mm' | 'A4' {
  if (configuredPaperWidth && configuredPaperWidth !== 'auto') {
    if (configuredPaperWidth === 'F4' || configuredPaperWidth === 'A4') return 'A4';
    return '58mm';
  }

  const hasLaptopOrBigTicket = tx.items.some(
    (item) =>
      item.name.toLowerCase().includes('laptop') ||
      item.name.toLowerCase().includes('macbook') ||
      item.name.toLowerCase().includes('thinkpad') ||
      item.name.toLowerCase().includes('notebook') ||
      item.name.toLowerCase().includes('pc ') ||
      item.serialNumber ||
      (item.warrantyPeriod && (item.unitPrice || 0) >= 1500000)
  );

  if (hasLaptopOrBigTicket || tx.grandTotal >= 2000000) {
    return 'A4';
  }

  return '58mm';
}

export function padBetween(left: string, right: string, width: number): string {
  const spaces = width - left.length - right.length;
  if (spaces <= 0) return `${left} ${right}`;
  return left + ' '.repeat(spaces) + right;
}

export function centerText(text: string, width: number): string {
  if (text.length >= width) return text.substring(0, width);
  const leftPad = Math.floor((width - text.length) / 2);
  return ' '.repeat(leftPad) + text;
}

export function generateReceiptText(tx: Transaction, profile: StoreProfile): string {
  const width = profile.paperWidth === '58mm' ? 32 : 42;
  const divider = '-'.repeat(width);
  const doubleDivider = '='.repeat(width);
  const lines: string[] = [];

  // 1. Header
  lines.push(centerText(profile.storeName.toUpperCase(), width));
  if (profile.address) {
    lines.push(centerText(profile.address, width));
  }
  if (profile.phone) {
    lines.push(centerText(`Telp: ${profile.phone}`, width));
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
    lines.push(`Pelanggan: ${tx.customerName}`);
  }
  lines.push(divider);

  // 3. Line Items
  for (const item of tx.items) {
    let itemName = item.name;
    if (item.condition && item.condition !== 'BARU') {
      itemName += ` [${item.condition}]`;
    }
    lines.push(itemName);
    let left = ` ${item.quantity} x ${formatRupiah(item.unitPrice)}`;
    if (item.discountAmount > 0) {
      left += ` (-${formatRupiah(item.discountAmount)})`;
    }
    const right = formatRupiah(item.subtotal);
    lines.push(padBetween(left, right, width));

    if (item.serialNumber) {
      lines.push(`  SN: ${item.serialNumber}`);
    }
    if (item.warrantyPeriod) {
      const { expiryDateStr } = calculateWarrantyExpiry(tx.createdAt, item.warrantyPeriod);
      lines.push(`  Garansi: ${item.warrantyPeriod} (s/d ${expiryDateStr})`);
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
      lines.push(` Resi: ${tx.shippingTrackingNumber}`);
    }
    if (tx.shippingAddress) {
      lines.push(` Alamat: ${tx.shippingAddress}`);
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

  // 5.b Warranty Terms if Laptop / Hardware with warranty sold
  const itemsWithWarranty = tx.items.filter(
    (i) =>
      i.warrantyPeriod &&
      !['tidak ada', 'non-garansi', '-'].includes(i.warrantyPeriod.toLowerCase())
  );
  if (itemsWithWarranty.length > 0) {
    lines.push(centerText('KETENTUAN KARTU GARANSI TOKO', width));
    lines.push('1. Nota ini berlaku sbg kartu garansi resmi.');
    lines.push('2. Segel toko utuh, tdk rusak/robek/hilang.');
    lines.push('3. Tdk kena cairan, jatuh, korsleting.');
    lines.push('4. Klaim garansi wajib bawa unit & nota.');
    lines.push(doubleDivider);
  }

  // 6. Footer
  if (profile.receiptFooter) {
    const footerLines = profile.receiptFooter.split('\n');
    for (const fLine of footerLines) {
      lines.push(centerText(fLine.trim(), width));
    }
  }

  lines.push('');
  lines.push(centerText('* Terimakasih *', width));
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
  lines.push(centerText(profile.storeName.toUpperCase(), width));
  if (profile.address) lines.push(centerText(profile.address, width));
  if (profile.phone) lines.push(centerText(`Telp/WA: ${profile.phone}`, width));
  lines.push(doubleDivider);

  // Judul Nota Servis
  lines.push(centerText('TANDA TERIMA SERVIS', width));
  lines.push(divider);

  // Informasi Tiket
  lines.push(`No. Tiket : ${order.ticketNumber}`);
  const dateStr = new Date(order.receivedAt || order.createdAt).toLocaleString('id-ID', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  lines.push(`Tgl Masuk : ${dateStr}`);
  lines.push(`Pelanggan : ${order.customerName}`);
  if (order.customerPhone) lines.push(`No. HP/WA : ${order.customerPhone}`);
  lines.push(`Perangkat : ${order.deviceType}`);
  if (order.deviceSerial) lines.push(`No. Seri  : ${order.deviceSerial}`);
  if (order.completeness) lines.push(`Kelengkpn : ${order.completeness}`);
  if (order.physicalCondition) lines.push(`Kondisi   : ${order.physicalCondition}`);
  if (order.devicePassword) lines.push(`Pass/PIN  : ${order.devicePassword}`);
  if (order.warrantyDays && order.warrantyDays > 0) {
    lines.push(`Garansi   : ${order.warrantyDays} Hari`);
  }
  if (order.assignedTechName) lines.push(`Teknisi   : ${order.assignedTechName}`);
  lines.push(divider);

  // Keluhan & Diagnosa
  lines.push('Keluhan:');
  lines.push(` ${order.complaint || '-'}`);
  if (order.diagnosis) {
    lines.push('Diagnosa:');
    lines.push(` ${order.diagnosis}`);
  }
  lines.push(divider);

  // Rincian Komponen / Jasa jika sudah ada
  if (order.items && order.items.length > 0) {
    lines.push('Rincian Pengerjaan:');
    for (const item of order.items) {
      lines.push(`${item.type === 'PART' ? '[PART]' : '[JASA]'} ${item.name}`);
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
      order.isPaid ? 'LUNAS' : order.downPayment && order.downPayment > 0 ? 'DP DITERIMA' : 'BELUM LUNAS',
      width
    )
  );
  if (order.paidAmount > 0 && (!order.downPayment || order.paidAmount !== order.downPayment)) {
    lines.push(padBetween('Total Dibayar:', formatRupiah(order.paidAmount), width));
  }
  lines.push(doubleDivider);

  // Ketentuan & Tanda Tangan
  lines.push(centerText('Syarat Pengambilan Servis:', width));
  lines.push('1. Wajib membawa nota tanda terima ini.');
  lines.push('2. Barang tidak diambil >30 hari di luar');
  lines.push('   tanggung jawab toko.');
  if (order.warrantyDays && order.warrantyDays > 0) {
    lines.push(`3. Garansi servis berlaku ${order.warrantyDays} hari.`);
  }
  lines.push('');
  lines.push(padBetween('( Pelanggan )', '( Teknisi )', width));
  lines.push('');
  lines.push(centerText('* Terimakasih Atas Kepercayaan Anda *', width));
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

