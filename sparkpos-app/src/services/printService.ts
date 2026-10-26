/**
 * Layanan pencetakan SparkPOS.
 *
 * Di aplikasi desktop (Tauri):
 *  - Struk thermal 58mm -> dikirim sebagai ESC/POS langsung ke printer yang dipilih (tanpa dialog).
 *  - Faktur A4/F4       -> printer default Windows diganti sementara ke printer A4 pilihan,
 *                          lalu window.print() (WebView2 dijalankan dengan --kiosk-printing, jadi tanpa dialog).
 * Di browser (mode dev / tanpa Tauri) -> jatuh kembali ke dialog cetak bawaan browser.
 */
import { invoke } from '@tauri-apps/api/core';
import { StoreProfile, Transaction } from '../types/pos';
import { generateReceiptText } from './printer';

export interface PrinterInfo {
  name: string;
  isDefault: boolean;
}

export type PrintOutcome =
  | { ok: true; mode: 'raw' | 'silent' | 'dialog'; printer?: string }
  | { ok: false; error: string };

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function listPrinters(): Promise<PrinterInfo[]> {
  if (!isTauriRuntime()) return [];
  try {
    return await invoke<PrinterInfo[]>('list_printers');
  } catch (err) {
    console.error('list_printers gagal', err);
    return [];
  }
}

/** Printer virtual (PDF/XPS/OneNote/Fax) tidak cocok untuk struk maupun faktur langsung. */
export function isVirtualPrinter(name: string): boolean {
  return /pdf|xps|onenote|fax|anydesk|cutepdf|image writer|document writer/i.test(name);
}

/** Tebakan nama printer thermal kasir yang umum di Indonesia. */
export function looksLikeThermal(name: string): boolean {
  return /pos|thermal|receipt|struk|kasir|rp-?\d{2,3}|xp-?\d{2,3}|pos-?\d{2}|tm-?[tu]\d|zj-?\d|gprinter|gp-?\d|bixolon|sewoo|rongta|epson tm|58\s?mm|80\s?mm|mini printer|bluetooth/i.test(
    name
  );
}

export function suggestPrinters(printers: PrinterInfo[]): { thermal?: string; a4?: string } {
  const real = printers.filter((p) => !isVirtualPrinter(p.name));
  const thermal = real.find((p) => looksLikeThermal(p.name))?.name;
  const nonThermal = real.filter((p) => !looksLikeThermal(p.name));
  const a4 = (nonThermal.find((p) => p.isDefault) || nonThermal[0])?.name;
  return { thermal, a4 };
}

// ---------------------------------------------------------------------------
// ESC/POS
// ---------------------------------------------------------------------------
const ESC = 0x1b;
const GS = 0x1d;

function toAscii(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/•/g, '*')
    .replace(/[^\x20-\x7e\n]/g, '?');
}

export function buildEscPos(
  text: string,
  options: { cut?: boolean; kickDrawer?: boolean } = {}
): number[] {
  const bytes: number[] = [ESC, 0x40]; // init
  const body = toAscii(text.replace(/\r/g, ''));
  for (let i = 0; i < body.length; i++) bytes.push(body.charCodeAt(i));
  bytes.push(0x0a, 0x0a, 0x0a);
  if (options.cut) bytes.push(GS, 0x56, 0x42, 0x00); // feed + partial cut
  if (options.kickDrawer) bytes.push(...DRAWER_KICK);
  return bytes;
}

/** ESC p 0 25 250 : pulsa ke pin 2 (laci uang RJ11 standar). */
const DRAWER_KICK = [ESC, 0x70, 0x00, 0x19, 0xfa];

// ---------------------------------------------------------------------------
// Resolusi printer
// ---------------------------------------------------------------------------
async function resolvePrinter(
  kind: 'thermal' | 'a4',
  profile: StoreProfile
): Promise<{ name?: string; error?: string }> {
  const printers = await listPrinters();
  const configured = kind === 'thermal' ? profile.thermalPrinterName : profile.a4PrinterName;

  if (configured) {
    if (printers.length === 0 || printers.some((p) => p.name === configured)) {
      return { name: configured };
    }
    return {
      error: `Printer "${configured}" tidak ditemukan. Cek kabel/daya printer atau pilih ulang di Pengaturan.`,
    };
  }

  const suggestion = suggestPrinters(printers);
  const guess = kind === 'thermal' ? suggestion.thermal : suggestion.a4;
  if (guess) return { name: guess };

  return {
    error:
      kind === 'thermal'
        ? 'Printer thermal belum dipilih. Buka Pengaturan > Printer Kasir untuk memilihnya.'
        : 'Printer A4 belum dipilih. Buka Pengaturan > Printer Kasir untuk memilihnya.',
  };
}

// ---------------------------------------------------------------------------
// Cetak
// ---------------------------------------------------------------------------
export async function printThermalText(
  text: string,
  profile: StoreProfile,
  options: { kickDrawer?: boolean } = {}
): Promise<PrintOutcome> {
  if (!isTauriRuntime()) {
    window.print();
    return { ok: true, mode: 'dialog' };
  }

  const target = await resolvePrinter('thermal', profile);
  if (!target.name) return { ok: false, error: target.error || 'Printer thermal tidak tersedia' };

  try {
    const data = buildEscPos(text, {
      cut: !!profile.thermalAutoCut,
      kickDrawer: !!options.kickDrawer,
    });
    await invoke('print_raw', { printer: target.name, data });
    return { ok: true, mode: 'raw', printer: target.name };
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err) };
  }
}

/** Cetak halaman yang sedang tampil (elemen #printable-receipt) ke printer A4/F4 pilihan, tanpa dialog. */
export async function printA4Page(profile: StoreProfile): Promise<PrintOutcome> {
  if (!isTauriRuntime()) {
    window.print();
    return { ok: true, mode: 'dialog' };
  }

  const target = await resolvePrinter('a4', profile);
  if (!target.name) return { ok: false, error: target.error || 'Printer A4 tidak tersedia' };

  let previous: string | null = null;
  try {
    previous = (await invoke<string | null>('get_default_printer')) || null;
    if (previous !== target.name) {
      await invoke('set_default_printer', { name: target.name });
    }
    // beri waktu React merender elemen cetak sebelum window.print()
    await new Promise((r) => setTimeout(r, 120));
    window.print();
    return { ok: true, mode: 'silent', printer: target.name };
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err) };
  } finally {
    if (previous && previous !== target.name) {
      const restore = previous;
      setTimeout(() => {
        invoke('set_default_printer', { name: restore }).catch(() => {});
      }, 6000);
    }
  }
}

/** Buka laci uang tanpa mencetak (mis. saat struk dimatikan atau memakai faktur A4). */
export async function kickCashDrawer(profile: StoreProfile): Promise<void> {
  if (!isTauriRuntime()) return;
  const target = await resolvePrinter('thermal', profile);
  if (!target.name) return;
  try {
    await invoke('print_raw', { printer: target.name, data: [...DRAWER_KICK] });
  } catch (err) {
    console.error('Gagal membuka laci uang', err);
  }
}

/** Pesan singkat untuk toast sesuai hasil cetak. */
export function describeOutcome(outcome: PrintOutcome, label: string): string {
  if (!outcome.ok) return `Gagal mencetak ${label}: ${outcome.error}`;
  if (outcome.mode === 'dialog') return `Dialog cetak ${label} dibuka`;
  return `${label} dicetak ke ${outcome.printer}`;
}

/** Cetak struk/faktur penjualan sesuai format yang dipilih (58mm thermal langsung, A4 senyap). */
export async function printSaleReceipt(
  tx: Transaction,
  profile: StoreProfile,
  format: '58mm' | 'A4',
  kickDrawer = false
): Promise<PrintOutcome> {
  if (format === '58mm') {
    if (!isTauriRuntime()) return printThermalText('', profile); // dialog browser (elemen cetak sudah dirender pemanggil)
    const text = generateReceiptText(tx, { ...profile, paperWidth: '58mm' });
    return printThermalText(text, profile, { kickDrawer });
  }
  const outcome = await printA4Page(profile);
  if (kickDrawer) await kickCashDrawer(profile);
  return outcome;
}
