import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { useDialog } from '../hooks/useDialog';

const GROUPS: { title: string; rows: [string, string][] }[] = [
  {
    title: 'Umum',
    rows: [
      ['F1', 'Bantuan shortcut ini'],
      ['Ctrl+1 … Ctrl+5', 'Pindah menu: Kasir, Servis, Stok, Laporan, Pengaturan'],
      ['F11', 'Layar penuh'],
      ['Esc', 'Tutup jendela / batalkan'],
      ['Tab / Shift+Tab', 'Pindah kolom isian berikutnya / sebelumnya'],
      ['Enter', 'Konfirmasi / simpan pada formulir'],
    ],
  },
  {
    title: 'Kasir',
    rows: [
      ['F2, Ctrl+K, /', 'Fokus ke kolom Scan / Cari produk'],
      ['↑ / ↓ lalu Enter', 'Pilih produk di katalog, tambah ke keranjang'],
      ['5*kabel', 'Tambah banyak sekaligus (jumlah*nama/kode)'],
      ['Ctrl+↑ / Ctrl+↓', 'Pilih baris di keranjang'],
      ['+  /  −  (juga Numpad)', 'Tambah / kurangi jumlah baris terpilih'],
      ['Delete / Ctrl+Delete', 'Hapus baris terpilih'],
      ['F3', 'Isi nama pelanggan'],
      ['F4 / F6', 'Parkir transaksi / buka antrean parkir'],
      ['F8 / F9', 'Diskon nota / kosongkan keranjang'],
      ['F10', 'Catat uang kas masuk / keluar'],
      ['F12, Ctrl+Enter', 'Bayar'],
      ['Alt+1 … Alt+9', 'Filter kategori'],
    ],
  },
  {
    title: 'Jendela Pembayaran',
    rows: [
      ['Enter', 'Selesaikan pembayaran'],
      ['Alt+C / Alt+T', 'Tunai / Transfer'],
      ['Alt+1 / Alt+2 / Alt+N', 'Cetak 58mm / A4 / tanpa cetak'],
    ],
  },
];

export const ShortcutHelp: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const ref = useDialog<HTMLDivElement>(true, onClose);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
            <Keyboard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Shortcut Keyboard
          </div>
          <button
            onClick={onClose}
            data-autofocus
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto space-y-5">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                {g.title}
              </h3>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800">
                {g.rows.map(([k, d]) => (
                  <div key={k} className="flex items-center justify-between gap-4 px-3 py-2 text-xs">
                    <span className="text-slate-700 dark:text-slate-300">{d}</span>
                    <kbd className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[11px] font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {k}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
