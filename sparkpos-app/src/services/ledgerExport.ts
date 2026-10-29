/**
 * Ekspor 3 format laporan buku toko (mengikuti laporan manual toko):
 *  1. Laporan Kas Harian  : TGL | NAMA | DEBIT | CREDIT           (1 sheet per bulan)
 *  2. Laporan Keuntungan  : TGL | NAMA BARANG | MODAL (UTAMA, TAMBAHAN) | HARGA JUAL | PROFIT | RATA2/HARI
 *                           + tabel CREDIT (pengeluaran) di sisi kanan  (1 sheet per bulan)
 *  3. Laporan Pembelian   : Tanggal | nama | Spesifikasi | kondisi | harga | tambahan modal | jumlah | keterangan
 * Semua total, profit, dan rata-rata memakai rumus Excel hidup sehingga bisa diedit manual.
 */
import XLSX from 'xlsx-js-style';
import { Transaction, ServiceOrder, CashFlow, StockMovement, Product } from '../types/pos';
import { toLocalDateString } from './dateUtils';
import { downloadWorkbook } from './excelExport';

export interface LedgerSource {
  storeName: string;
  transactions: Transaction[];
  serviceOrders: ServiceOrder[];
  cashFlows: CashFlow[];
  stockMovements: StockMovement[];
  products: Product[];
}

export interface LedgerRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

const MONTHS = [
  'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
  'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER',
];

const YELLOW = 'FFFF00';
const HEAD_FILL = 'D9E1F2';
const AMOUNT_FILL = 'DDEBF7';
const THIN = { style: 'thin', color: { rgb: '9CA3AF' } };
const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN };
const NUM = '#,##0';

// ---------------------------------------------------------------------------
// util
// ---------------------------------------------------------------------------
interface MonthKey {
  year: number;
  month: number; // 0-11
}

function monthsInRange(r: LedgerRange): MonthKey[] {
  const [sy, sm] = r.start.split('-').map(Number);
  const [ey, em] = r.end.split('-').map(Number);
  const out: MonthKey[] = [];
  let y = sy;
  let m = sm - 1;
  while (y < ey || (y === ey && m <= em - 1)) {
    out.push({ year: y, month: m });
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return out;
}

function inMonth(dateStr: string, mk: MonthKey, r: LedgerRange): boolean {
  if (dateStr < r.start || dateStr > r.end) return false;
  const [y, m] = dateStr.split('-').map(Number);
  return y === mk.year && m - 1 === mk.month;
}

function dayOf(dateStr: string): number {
  return Number(dateStr.split('-')[2]);
}

function excelSerial(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;
}

function sheetName(mk: MonthKey, multiYear: boolean): string {
  const n = MONTHS[mk.month].charAt(0) + MONTHS[mk.month].slice(1).toLowerCase();
  return multiYear ? `${n} ${String(mk.year).slice(2)}` : n;
}

type Cell = XLSX.CellObject & { s?: any };

class Sheet {
  ws: any = {};
  maxR = 0;
  maxC = 0;
  merges: XLSX.Range[] = [];

  put(r: number, c: number, value: string | number | null, style: any = {}, fmt?: string) {
    if (value === null || value === undefined || value === '') {
      if (!style || Object.keys(style).length === 0) return;
    }
    const cell: Cell = {
      t: typeof value === 'number' ? 'n' : 's',
      v: value === null || value === undefined ? '' : value,
      s: style,
    };
    if (fmt) cell.z = fmt;
    this.ws[XLSX.utils.encode_cell({ r, c })] = cell;
    this.maxR = Math.max(this.maxR, r);
    this.maxC = Math.max(this.maxC, c);
  }

  formula(r: number, c: number, f: string, cached: number, style: any = {}, fmt = NUM) {
    this.ws[XLSX.utils.encode_cell({ r, c })] = { t: 'n', f, v: cached, s: style, z: fmt };
    this.maxR = Math.max(this.maxR, r);
    this.maxC = Math.max(this.maxC, c);
  }

  merge(r1: number, c1: number, r2: number, c2: number) {
    this.merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
  }

  finish(widths: number[]): any {
    this.ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: this.maxR, c: Math.max(this.maxC, widths.length - 1) } });
    this.ws['!cols'] = widths.map((w) => ({ wch: w }));
    if (this.merges.length) this.ws['!merges'] = this.merges;
    return this.ws;
  }
}

const font = (name: string, sz = 11, bold = false) => ({ name, sz, bold });
const banner = (name: string, sz: number) => ({
  font: font(name, sz, true),
  fill: { fgColor: { rgb: YELLOW } },
  alignment: { horizontal: 'center', vertical: 'center' },
});
const head = (name: string, sz = 11) => ({
  font: font(name, sz, true),
  fill: { fgColor: { rgb: HEAD_FILL } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: BORDER,
});
const body = (name: string, align: 'left' | 'center' | 'right' = 'left', fill?: string, bold = false) => ({
  font: font(name, 11, bold),
  alignment: { horizontal: align, vertical: 'center' },
  border: BORDER,
  ...(fill ? { fill: { fgColor: { rgb: fill } } } : {}),
});

// ---------------------------------------------------------------------------
// ekstraksi data
// ---------------------------------------------------------------------------
interface Entry {
  date: string;
  ts: number;
  name: string;
  debit: number;
  credit: number;
  modal: number;
  jual: number;
  kind: 'sale' | 'service' | 'cashIn' | 'cashOut';
}

function serviceRevenueInfo(s: ServiceOrder): { date: string; revenue: number; ts: number } | null {
  if (s.status === 'DIBATALKAN') return null;

  // Syarat masuk buku/laporan keuangan:
  // - Sudah lunas di awal (s.isPaid || s.paidAt)
  // - ATAU status sudah DIAMBIL (customer ambil barang & bayar pelunasan)
  // Jika status masih Diterima, Dikerjakan, atau Selesai (belum diambil & belum lunas) -> PENDING (tidak masuk)
  const isRecognized = s.isPaid || s.status === 'DIAMBIL';
  if (!isRecognized) return null;

  let when: string;
  if (s.paidAt && s.status !== 'DIAMBIL') {
    when = s.paidAt;
  } else if (s.paidAt && s.isPaid && (!s.pickedUpAt || new Date(s.paidAt).getTime() < new Date(s.pickedUpAt).getTime())) {
    when = s.paidAt;
  } else if (s.status === 'DIAMBIL') {
    when = s.pickedUpAt || s.paidAt || s.updatedAt || s.createdAt;
  } else {
    when = s.paidAt || s.createdAt;
  }

  const revenue = s.paidAmount > 0 ? s.paidAmount : s.grandTotal || 0;
  if (revenue <= 0) return null;
  return { date: toLocalDateString(when), revenue, ts: new Date(when).getTime() };
}

/**
 * Ekstraksi kas harian sederhana: 1 transaksi penjualan = 1 baris kas masuk (tidak dipecah per-item agar tidak dobel)
 */
function collectCashEntries(src: LedgerSource): Entry[] {
  const out: Entry[] = [];

  for (const tx of src.transactions) {
    if (tx.status === 'VOID' || tx.status === 'REFUNDED') continue;
    const date = toLocalDateString(tx.createdAt);
    const ts = new Date(tx.createdAt).getTime();

    const itemNames = (tx.items || [])
      .map((it) => `${it.name}${it.quantity > 1 ? ` (${it.quantity}x)` : ''}`)
      .join(', ');
    const label = `Penjualan POS #${tx.invoiceNumber}${itemNames ? `: ${itemNames}` : ''}`;

    out.push({
      date,
      ts,
      kind: 'sale',
      name: label,
      debit: tx.grandTotal || 0,
      credit: 0,
      modal: (tx.items || []).reduce((acc, it) => acc + (it.buyPrice || 0) * it.quantity, 0),
      jual: tx.grandTotal || 0,
    });
  }

  for (const s of src.serviceOrders) {
    const info = serviceRevenueInfo(s);
    if (!info) continue;
    out.push({
      date: info.date,
      ts: info.ts,
      kind: 'service',
      name: `Servis #${s.ticketNumber}: ${s.deviceType || ''}${s.customerName ? ` (${s.customerName})` : ''}`.trim(),
      debit: info.revenue,
      credit: 0,
      modal: s.totalPartsCost || 0,
      jual: info.revenue,
    });
  }

  for (const f of src.cashFlows) {
    const date = toLocalDateString(f.createdAt);
    const ts = new Date(f.createdAt).getTime();
    const label = (f.note && f.note.trim()) || f.category;
    if (f.type === 'IN') {
      out.push({ date, ts, kind: 'cashIn', name: `Kas Masuk: ${label}`, debit: f.amount, credit: 0, modal: 0, jual: 0 });
    } else {
      out.push({ date, ts, kind: 'cashOut', name: `Kas Keluar: ${label}`, debit: 0, credit: f.amount, modal: 0, jual: 0 });
    }
  }

  return out.sort((a, b) => a.ts - b.ts);
}

/**
 * Ekstraksi itemized untuk Laporan Keuntungan (per produk untuk analisis margin HPP vs Jual)
 */
function collectItemizedEntries(src: LedgerSource): Entry[] {
  const out: Entry[] = [];

  for (const tx of src.transactions) {
    if (tx.status === 'VOID' || tx.status === 'REFUNDED') continue;
    const date = toLocalDateString(tx.createdAt);
    const ts = new Date(tx.createdAt).getTime();
    let itemSum = 0;
    for (const it of tx.items || []) {
      const line = it.subtotal ?? it.unitPrice * it.quantity;
      itemSum += line;
      out.push({
        date, ts, kind: 'sale',
        name: `jual ${it.name}${it.quantity > 1 ? ` x${it.quantity}` : ''}`,
        debit: line, credit: 0,
        modal: (it.buyPrice || 0) * it.quantity, jual: line,
      });
    }
    const diff = Math.round((tx.grandTotal || 0) - itemSum);
    if (diff !== 0) {
      out.push({
        date, ts: ts + 1, kind: 'sale',
        name: diff < 0 ? 'diskon nota' : 'pajak / ongkir nota',
        debit: diff, credit: 0, modal: 0, jual: diff,
      });
    }
  }

  for (const s of src.serviceOrders) {
    const info = serviceRevenueInfo(s);
    if (!info) continue;
    out.push({
      date: info.date,
      ts: info.ts,
      kind: 'service',
      name: `servis ${s.deviceType || ''}${s.customerName ? ` (${s.customerName})` : ''}`.trim(),
      debit: info.revenue, credit: 0,
      modal: s.totalPartsCost || 0, jual: info.revenue,
    });
  }

  for (const f of src.cashFlows) {
    const date = toLocalDateString(f.createdAt);
    const ts = new Date(f.createdAt).getTime();
    const label = (f.note && f.note.trim()) || f.category;
    if (f.type === 'IN') {
      out.push({ date, ts, kind: 'cashIn', name: label, debit: f.amount, credit: 0, modal: 0, jual: 0 });
    } else {
      out.push({ date, ts, kind: 'cashOut', name: label, debit: 0, credit: f.amount, modal: 0, jual: 0 });
    }
  }

  return out.sort((a, b) => a.ts - b.ts);
}

/** Gabungkan sel TGL untuk baris dengan tanggal sama berurutan (seperti laporan manual). */
function writeDayColumn(sh: Sheet, firstRow: number, days: number[], font: string) {
  let i = 0;
  while (i < days.length) {
    let j = i;
    while (j + 1 < days.length && days[j + 1] === days[i]) j++;
    sh.put(firstRow + i, 0, days[i], body(font, 'center'));
    for (let k = i + 1; k <= j; k++) sh.put(firstRow + k, 0, null, body(font, 'center'));
    if (j > i) sh.merge(firstRow + i, 0, firstRow + j, 0);
    i = j + 1;
  }
}

// ---------------------------------------------------------------------------
// 1. LAPORAN KAS HARIAN (SEDERHANA, BERSIH, TANPA DOUBLE-DOUBLE)
// ---------------------------------------------------------------------------
export function exportKasHarian(src: LedgerSource, range: LedgerRange) {
  const entries = collectCashEntries(src);
  const wb = XLSX.utils.book_new();
  const months = monthsInRange(range);
  const multiYear = new Set(months.map((m) => m.year)).size > 1;
  const F = 'Calibri';

  for (const mk of months) {
    const rows = entries.filter((e) => inMonth(e.date, mk, range));
    const sh = new Sheet();
    const title = [
      'LAPORAN KEUANGAN KAS TOKO',
      src.storeName.toUpperCase(),
      `BULAN ${MONTHS[mk.month]} ${mk.year}`,
    ];
    title.forEach((t, i) => {
      sh.put(i, 0, t, banner('Bahnschrift', 11));
      for (let c = 1; c < 4; c++) sh.put(i, c, null, banner('Bahnschrift', 11));
      sh.merge(i, 0, i, 3);
    });

    const H = 4;
    ['TGL', 'NAMA', 'DEBIT', 'CREDIT'].forEach((t, c) => sh.put(H, c, t, head(F)));

    const first = H + 1;
    writeDayColumn(sh, first, rows.map((r) => dayOf(r.date)), F);
    let debit = 0;
    let credit = 0;
    rows.forEach((r, i) => {
      const rr = first + i;
      sh.put(rr, 1, r.name, body(F));
      sh.put(rr, 2, r.debit || null, body(F, 'right', r.debit ? AMOUNT_FILL : undefined), NUM);
      sh.put(rr, 3, r.credit || null, body(F, 'right', r.credit ? 'FCE4D6' : undefined), NUM);
      debit += r.debit;
      credit += r.credit;
    });

    const last = first + Math.max(rows.length, 1) - 1;
    const t = last + 2;
    const rng = (col: string) => `${col}${first + 1}:${col}${last + 1}`;
    sh.put(t, 1, 'TOTAL', body(F, 'right', HEAD_FILL, true));
    sh.formula(t, 2, `SUM(${rng('C')})`, debit, body(F, 'right', HEAD_FILL, true));
    sh.formula(t, 3, `SUM(${rng('D')})`, credit, body(F, 'right', HEAD_FILL, true));
    sh.put(t + 1, 1, 'SALDO KAS (DEBIT - CREDIT)', body(F, 'right', YELLOW, true));
    sh.formula(t + 1, 2, `C${t + 1}-D${t + 1}`, debit - credit, body(F, 'right', YELLOW, true));
    sh.put(t + 1, 3, null, body(F, 'right', YELLOW));

    XLSX.utils.book_append_sheet(wb, sh.finish([8, 85, 16, 16]), sheetName(mk, multiYear));
  }

  downloadWorkbook(wb, `Laporan_Kas_Harian_${range.start}_sd_${range.end}`);
}

// ---------------------------------------------------------------------------
// 2. LAPORAN KEUNTUNGAN
// ---------------------------------------------------------------------------
export function exportKeuntungan(src: LedgerSource, range: LedgerRange) {
  const entries = collectItemizedEntries(src);
  const wb = XLSX.utils.book_new();
  const months = monthsInRange(range);
  const multiYear = new Set(months.map((m) => m.year)).size > 1;
  const F = 'Calibri';

  for (const mk of months) {
    const sales = entries.filter((e) => (e.kind === 'sale' || e.kind === 'service') && inMonth(e.date, mk, range));
    const outs = entries.filter((e) => e.kind === 'cashOut' && inMonth(e.date, mk, range));
    const sh = new Sheet();
    const store = src.storeName.toUpperCase();
    const monthLabel = `BULAN ${MONTHS[mk.month]} ${mk.year}`;

    // judul kiri (A:G) & kanan (H:J)
    [store, monthLabel].forEach((t, i) => {
      for (let c = 0; c < 7; c++) sh.put(i, c, c === 0 ? t : null, banner(F, 12));
      sh.merge(i, 0, i, 6);
      for (let c = 7; c < 10; c++) sh.put(i, c, c === 7 ? t : null, banner(F, 11));
      sh.merge(i, 7, i, 9);
    });

    // header kiri (baris 4-5)
    const hd = head(F);
    sh.put(3, 0, 'TGL', hd); sh.put(4, 0, null, hd); sh.merge(3, 0, 4, 0);
    sh.put(3, 1, 'NAMA BARANG', hd); sh.put(4, 1, null, hd); sh.merge(3, 1, 4, 1);
    sh.put(3, 2, 'MODAL', hd); sh.put(3, 3, null, hd); sh.merge(3, 2, 3, 3);
    sh.put(4, 2, 'UTAMA', hd); sh.put(4, 3, 'TAMBAHAN', hd);
    sh.put(3, 4, 'HARGA JUAL', hd); sh.put(4, 4, null, hd); sh.merge(3, 4, 4, 4);
    sh.put(3, 5, 'PROFIT', hd); sh.put(4, 5, null, hd); sh.merge(3, 5, 4, 5);
    sh.put(3, 6, 'RATA RATA /HARI', hd); sh.put(4, 6, null, hd); sh.merge(3, 6, 4, 6);
    // header kanan (baris 4)
    sh.put(3, 7, 'TGL', hd); sh.put(3, 8, 'NAMA', hd); sh.put(3, 9, 'CREDIT', hd);

    // data kiri mulai baris Excel 6
    const first = 5;
    writeDayColumn(sh, first, sales.map((r) => dayOf(r.date)), F);
    let tModal = 0, tJual = 0;
    sales.forEach((r, i) => {
      const rr = first + i;
      const x = rr + 1; // nomor baris Excel
      sh.put(rr, 1, r.name, body(F));
      sh.put(rr, 2, r.modal, body(F, 'right'), NUM);
      sh.put(rr, 3, 0, body(F, 'right'), NUM);
      sh.put(rr, 4, r.jual, body(F, 'right', AMOUNT_FILL), NUM);
      sh.formula(rr, 5, `SUM(E${x}-C${x}-D${x})`, r.jual - r.modal, body(F, 'center', AMOUNT_FILL), '"Rp"#,##0');
      sh.put(rr, 6, null, body(F));
      tModal += r.modal; tJual += r.jual;
    });

    // RATA RATA /HARI: profit kumulatif ÷ tanggal terakhir pada tiap blok mingguan (sama seperti laporan manual)
    const blocks = [7, 14, 21, 28, 31];
    let prevBound = 0;
    for (const bound of blocks) {
      let lastIdx = -1;
      sales.forEach((r, i) => {
        const d = dayOf(r.date);
        if (d > prevBound && d <= bound) lastIdx = i;
      });
      prevBound = bound;
      if (lastIdx < 0) continue;
      const lastDay = dayOf(sales[lastIdx].date);
      const cumulative = sales.slice(0, lastIdx + 1).reduce((a, r) => a + r.jual - r.modal, 0);
      sh.formula(first + lastIdx, 6, `SUM(F$${first + 1}:F${first + lastIdx + 1})/${lastDay}`, Math.round(cumulative / lastDay),
        body(F, 'center', 'FFF2CC', true), '#,##0;[Red]#,##0');
    }

    // data kanan mulai baris Excel 5
    const rFirst = 4;
    let tCredit = 0;
    outs.forEach((r, i) => {
      sh.put(rFirst + i, 7, dayOf(r.date), body(F, 'center'));
      sh.put(rFirst + i, 8, r.name, body(F));
      sh.put(rFirst + i, 9, r.credit, body(F, 'right'), NUM);
      tCredit += r.credit;
    });

    const leftLast = first + Math.max(sales.length, 1) - 1;
    const rightLast = rFirst + Math.max(outs.length, 1) - 1;
    const tr = Math.max(leftLast, rightLast) + 2; // baris total (0-idx)
    const tot = body(F, 'right', HEAD_FILL, true);
    sh.put(tr, 1, 'TOTAL', tot);
    sh.formula(tr, 2, `SUM(C${first + 1}:C${leftLast + 1})`, tModal, tot);
    sh.formula(tr, 3, `SUM(D${first + 1}:D${leftLast + 1})`, 0, tot);
    sh.formula(tr, 4, `SUM(E${first + 1}:E${leftLast + 1})`, tJual, tot);
    sh.formula(tr, 5, `SUM(F${first + 1}:F${leftLast + 1})`, tJual - tModal, tot, '"Rp"#,##0');
    sh.put(tr, 8, 'TOTAL', tot);
    sh.formula(tr, 9, `SUM(J${rFirst + 1}:J${rightLast + 1})`, tCredit, tot);

    // ringkasan bulan
    const sm = tr + 2;
    const lab = body(F, 'right', YELLOW, true);
    sh.put(sm, 1, 'TOTAL PROFIT PENJUALAN & SERVIS', lab);
    sh.formula(sm, 2, `F${tr + 1}`, tJual - tModal, lab, '"Rp"#,##0');
    sh.put(sm + 1, 1, 'TOTAL PENGELUARAN (CREDIT)', lab);
    sh.formula(sm + 1, 2, `J${tr + 1}`, tCredit, lab, '"Rp"#,##0');
    sh.put(sm + 2, 1, 'SISA PROFIT SETELAH PENGELUARAN', lab);
    sh.formula(sm + 2, 2, `C${sm + 1}-C${sm + 2}`, tJual - tModal - tCredit, lab, '"Rp"#,##0');

    XLSX.utils.book_append_sheet(wb, sh.finish([8, 70, 14, 14, 16, 18, 20, 8, 70, 18]), sheetName(mk, multiYear));
  }

  downloadWorkbook(wb, `Laporan_Keuntungan_${range.start}_sd_${range.end}`);
}

// ---------------------------------------------------------------------------
// 3. LAPORAN PEMBELIAN
// ---------------------------------------------------------------------------
interface PurchaseRow {
  date: string;
  name: string;
  spec: string;
  condition: string;
  price: number;
  note: string;
}

function collectPurchases(src: LedgerSource): PurchaseRow[] {
  const byId = new Map(src.products.map((p) => [p.id, p]));
  const rows: PurchaseRow[] = [];

  for (const m of src.stockMovements) {
    if (m.type !== 'IN_PURCHASE') continue;
    const p = byId.get(m.productId);
    const qty = m.quantity || 1;
    const unit = p?.buyPrice || 0;
    const cond = [p?.condition && p.condition !== 'BARU' ? p.condition.toLowerCase() : '', p?.conditionNotes || '']
      .filter(Boolean)
      .join(', ');
    rows.push({
      date: toLocalDateString(m.createdAt),
      name: m.productName || p?.name || '-',
      spec: p?.completeness || '',
      condition: cond,
      price: unit * qty,
      note: [qty > 1 ? `${qty} unit @ ${unit.toLocaleString('id-ID')}` : '', m.supplierName ? `dari ${m.supplierName}` : '']
        .filter(Boolean)
        .join(' - '),
    });
  }

  // Pembelian manual lewat Catat Kas (kategori beli unit / stok)
  for (const f of src.cashFlows) {
    if (f.type !== 'OUT') continue;
    if (!/^Beli (Unit|Stok)/i.test(f.category)) continue;
    rows.push({
      date: toLocalDateString(f.createdAt),
      name: f.note || f.category,
      spec: '',
      condition: '',
      price: f.amount,
      note: 'dicatat dari Uang Kas Keluar',
    });
  }

  return rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function exportPembelian(src: LedgerSource, range: LedgerRange) {
  const purchases = collectPurchases(src);
  const wb = XLSX.utils.book_new();
  const months = monthsInRange(range);
  const multiYear = new Set(months.map((m) => m.year)).size > 1;
  const F = 'Times New Roman';

  for (const mk of months) {
    const rows = purchases.filter((r) => inMonth(r.date, mk, range));
    const sh = new Sheet();

    for (let c = 0; c < 13; c++) sh.put(0, c, c === 0 ? `LAPORAN PEMBELIAN ${MONTHS[mk.month]} ${mk.year}` : null, banner(F, 18));
    sh.merge(0, 0, 0, 12);

    const hd = head(F, 12);
    const fixed: [number, string][] = [[0, 'Tanggal'], [1, 'nama'], [2, 'Spesifikasi'], [3, 'kondisi'], [4, 'harga']];
    for (const [c, t] of fixed) {
      sh.put(2, c, t, hd);
      sh.put(3, c, null, hd);
      sh.merge(2, c, 3, c);
    }
    sh.put(2, 5, 'tambahan modal', hd);
    for (let c = 6; c <= 11; c++) sh.put(2, c, null, hd);
    sh.merge(2, 5, 2, 11);
    ['batre', 'keyboard', 'hdd', 'ssd', 'ram', 'lcd', 'jumlah'].forEach((t, i) => sh.put(3, 5 + i, t, hd));
    sh.put(2, 12, 'keterangan', hd);
    sh.put(3, 12, null, hd);
    sh.merge(2, 12, 3, 12);

    const first = 4;
    let totalHarga = 0;
    rows.forEach((r, i) => {
      const rr = first + i;
      const x = rr + 1;
      const ctr = body(F, 'center');
      sh.put(rr, 0, excelSerial(r.date), ctr, 'd-mmm');
      sh.put(rr, 1, r.name, ctr);
      sh.put(rr, 2, r.spec, ctr);
      sh.put(rr, 3, r.condition, ctr);
      sh.put(rr, 4, r.price, ctr, NUM);
      for (let c = 5; c <= 10; c++) sh.put(rr, c, null, ctr, NUM); // tambahan modal diisi manual
      sh.formula(rr, 11, `SUM(E${x}+F${x}+G${x}+H${x}+I${x}+J${x}+K${x})`, r.price, ctr);
      sh.put(rr, 12, r.note, body(F, 'left'));
      totalHarga += r.price;
    });

    const last = first + Math.max(rows.length, 1) - 1;
    const t = last + 2;
    const tot = body(F, 'center', HEAD_FILL, true);
    sh.put(t, 3, 'TOTAL', tot);
    sh.formula(t, 4, `SUM(E${first + 1}:E${last + 1})`, totalHarga, tot);
    for (let c = 5; c <= 10; c++) sh.formula(t, c, `SUM(${XLSX.utils.encode_col(c)}${first + 1}:${XLSX.utils.encode_col(c)}${last + 1})`, 0, tot);
    sh.formula(t, 11, `SUM(L${first + 1}:L${last + 1})`, totalHarga, tot);

    XLSX.utils.book_append_sheet(wb, sh.finish([10, 34, 34, 28, 14, 11, 11, 11, 11, 11, 11, 14, 40]), sheetName(mk, multiYear));
  }

  downloadWorkbook(wb, `Laporan_Pembelian_${range.start}_sd_${range.end}`);
}
