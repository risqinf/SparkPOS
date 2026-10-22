import { Transaction, StoreProfile } from '../types/pos';
import { formatRupiah } from './cartCalculator';
import { playCashDrawerKickSound } from './scanner';

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
  if (profile.branchName) {
    lines.push(centerText(profile.branchName, width));
  }
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
    lines.push(item.name);
    let left = ` ${item.quantity} x ${formatRupiah(item.unitPrice)}`;
    if (item.discountAmount > 0) {
      left += ` (-${formatRupiah(item.discountAmount)})`;
    }
    const right = formatRupiah(item.subtotal);
    lines.push(padBetween(left, right, width));
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

export function printReceiptSilent(tx: Transaction, profile: StoreProfile) {
  // If kick drawer enabled, play simulated drawer sound and command
  if (profile.autoKickDrawer) {
    playCashDrawerKickSound();
  }

  // Trigger browser print dialog styled specifically for thermal printer
  window.print();
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
  if (profile.branchName) lines.push(centerText(profile.branchName, width));
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
  lines.push(padBetween('Status Bayar :', order.isPaid ? 'LUNAS' : 'BELUM LUNAS', width));
  if (order.paidAmount > 0) {
    lines.push(padBetween('Dibayar      :', formatRupiah(order.paidAmount), width));
  }
  lines.push(doubleDivider);

  // Ketentuan & Tanda Tangan
  lines.push(centerText('Syarat Pengambilan Servis:', width));
  lines.push('1. Wajib membawa nota tanda terima ini.');
  lines.push('2. Barang tidak diambil >30 hari di luar');
  lines.push('   tanggung jawab toko.');
  lines.push('');
  lines.push(padBetween('( Pelanggan )', '( Teknisi )', width));
  lines.push('');
  lines.push(centerText('* Terimakasih Atas Kepercayaan Anda *', width));
  lines.push('');

  return lines.join('\n');
}
