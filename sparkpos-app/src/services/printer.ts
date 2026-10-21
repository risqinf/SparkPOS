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
