import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Banknote,
  CheckCircle2,
  Printer,
  Building2,
  AlertCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CartSummary, PaymentMethod, PaymentEntry } from '../../types/pos';
import { formatRupiah } from '../../services/cartCalculator';
import { playSuccessBeep } from '../../services/scanner';
import { useDialog } from '../../hooks/useDialog';

interface PaymentModalProps {
  summary: CartSummary;
  customerName?: string;
  onClose: () => void;
  onConfirmPayment: (
    payments: PaymentEntry[],
    paidAmount: number,
    changeAmount: number,
    printFormat: '58mm' | 'A4' | null
  ) => void;
  defaultAutoPrint: boolean;
  defaultPaperFormat?: '58mm' | 'A4' | 'NONE';
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  summary,
  customerName,
  onClose,
  onConfirmPayment,
  defaultAutoPrint,
  defaultPaperFormat,
}) => {
  const dialogRef = useDialog<HTMLDivElement>(true, onClose);
  const [selectedMethod, setSelectedMethod] = useState<'CASH' | 'TRANSFER'>('CASH');

  // Cash payment: default 0, manual edit only, auto-formats with dots (e.g. 100.000)
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [cashInputDisplay, setCashInputDisplay] = useState<string>('');

  const [transferRefNote, setTransferRefNote] = useState<string>('');

  // Print format option: '58mm', 'A4', or null (unselected / no print)
  const [selectedPrint, setSelectedPrint] = useState<'58mm' | 'A4' | null>(() => {
    if (defaultPaperFormat === 'NONE' || defaultAutoPrint === false) return null;
    return defaultPaperFormat === 'A4' ? 'A4' : '58mm';
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // When switching payment method
  const handleSelectMethod = (method: 'CASH' | 'TRANSFER') => {
    setSelectedMethod(method);
    if (method === 'CASH') {
      setCashAmount(0);
      setCashInputDisplay('');
    }
  };

  // Toggle print selection: if clicked again, deselects to null
  const handleTogglePrint = (format: '58mm' | 'A4') => {
    if (selectedPrint === format) {
      setSelectedPrint(null);
    } else {
      setSelectedPrint(format);
    }
  };

  // Restrict keys in cash input: allow only digits and navigation keys (block '.' and ',')
  const handleCashKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Escape'].includes(
        e.key
      ) ||
      e.ctrlKey ||
      e.metaKey
    ) {
      return;
    }
    // Block dots, commas, symbols, letters
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  // Handle cash input change: format digits with thousand separator (.) automatically
  const handleCashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, '');
    if (!rawDigits) {
      setCashAmount(0);
      setCashInputDisplay('');
      return;
    }
    const numeric = parseInt(rawDigits, 10);
    setCashAmount(numeric);
    // Format to 100.000 (Indonesian dots) without requiring user to type '.'
    setCashInputDisplay(new Intl.NumberFormat('id-ID').format(numeric));
  };

  const changeAmount = Math.max(0, cashAmount - summary.grandTotal);
  const isUnderpaid = selectedMethod === 'CASH' && cashAmount < summary.grandTotal;

  const handleComplete = () => {
    if (isUnderpaid || isSubmitting) return;
    setIsSubmitting(true);
    playSuccessBeep();

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
    });

    const payments: PaymentEntry[] = [
      {
        method: selectedMethod as PaymentMethod,
        amount: selectedMethod === 'CASH' ? cashAmount : summary.grandTotal,
        referenceNo: selectedMethod === 'TRANSFER' ? transferRefNote.trim() : undefined,
      },
    ];

    setTimeout(() => {
      onConfirmPayment(
        payments,
        selectedMethod === 'CASH' ? cashAmount : summary.grandTotal,
        selectedMethod === 'CASH' ? changeAmount : 0,
        selectedPrint
      );
    }, 200);
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        return; // ditangani useDialog
      } else if (e.key === 'Enter' && !isUnderpaid && !isSubmitting) {
        // Enter pada tombol lain (mis. tutup) memakai aksi tombol itu sendiri
        if (e.target instanceof HTMLButtonElement) return;
        e.preventDefault();
        handleComplete();
      } else if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        handleSelectMethod('CASH');
      } else if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        handleSelectMethod('TRANSFER');
      } else if (e.altKey && e.key === '1') {
        e.preventDefault();
        handleTogglePrint('58mm');
      } else if (e.altKey && e.key === '2') {
        e.preventDefault();
        handleTogglePrint('A4');
      } else if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        setSelectedPrint(null);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [cashAmount, isUnderpaid, isSubmitting, selectedMethod, transferRefNote, selectedPrint]);

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 select-none">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 max-h-[95vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Pembayaran Kasir
              </h2>
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Pilih metode bayar Tunai atau Transfer Bank
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Grand Total Display */}
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 block">
                Total Belanja
              </span>
              {customerName && (
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  Pelanggan: {customerName}
                </span>
              )}
            </div>
            <span className="text-3xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight font-mono">
              {formatRupiah(summary.grandTotal)}
            </span>
          </div>

          {/* Payment Method Selector (Tunai & Transfer) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              Metode Pembayaran
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSelectMethod('CASH')}
                className={`flex items-center justify-between p-3.5 rounded-2xl border-2 font-bold text-sm transition cursor-pointer ${
                  selectedMethod === 'CASH'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-600 text-emerald-800 dark:text-emerald-300 shadow-md shadow-emerald-600/10'
                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>💵 Tunai (Cash)</span>
                </div>
                <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 font-mono">
                  Alt+C
                </kbd>
              </button>

              <button
                type="button"
                onClick={() => handleSelectMethod('TRANSFER')}
                className={`flex items-center justify-between p-3.5 rounded-2xl border-2 font-bold text-sm transition cursor-pointer ${
                  selectedMethod === 'TRANSFER'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-600 text-emerald-800 dark:text-emerald-300 shadow-md shadow-emerald-600/10'
                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>🏦 Transfer Bank</span>
                </div>
                <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 font-mono">
                  Alt+T
                </kbd>
              </button>
            </div>
          </div>

          {/* Tunai: Input Uang Diterima (Default 0, Manual Edit, Auto Formatted 100.000, No Quick Buttons) */}
          {selectedMethod === 'CASH' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Nominal Uang Diterima (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-lg font-bold text-slate-600 dark:text-slate-400">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={cashInputDisplay}
                    onChange={handleCashChange}
                    onKeyDown={handleCashKeyDown}
                    placeholder="0"
                    className="w-full pl-12 pr-12 py-3 bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-2xl font-black text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 font-mono transition shadow-inner"
                  />
                  {cashAmount >= summary.grandTotal && (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 absolute right-4 top-3.5" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Ketik nominal angka saja. Format ribuan (titik) otomatis diterapkan.
                </p>
              </div>

              {/* Kembalian Calculation */}
              <div
                className={`p-4 rounded-2xl border-2 flex items-center justify-between ${
                  isUnderpaid
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900/60 text-rose-800 dark:text-rose-200'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isUnderpaid ? (
                    <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span className="font-extrabold text-sm">
                    {isUnderpaid ? 'Kurang Bayar:' : 'Uang Kembalian:'}
                  </span>
                </div>
                <span className="text-2xl font-black font-mono tracking-tight">
                  {isUnderpaid
                    ? formatRupiah(summary.grandTotal - cashAmount)
                    : formatRupiah(changeAmount)}
                </span>
              </div>
            </div>
          )}

          {/* Transfer Bank: Uang Pas Otomatis & Catatan Bank */}
          {selectedMethod === 'TRANSFER' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 text-center space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300">
                  Nominal Transfer (Uang Pas)
                </span>
                <div className="text-3xl font-black text-sky-900 dark:text-sky-200 font-mono">
                  {formatRupiah(summary.grandTotal)}
                </div>
                <p className="text-xs text-sky-700 dark:text-sky-400">
                  Pelanggan mentransfer sesuai nominal total tagihan.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Nama Bank / Referensi Transfer (Opsional)
                </label>
                <input
                  type="text"
                  autoFocus
                  value={transferRefNote}
                  onChange={(e) => setTransferRefNote(e.target.value)}
                  placeholder="Contoh: BCA, Mandiri, BRI, BNI, Bukti #TRX123..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 transition shadow-inner"
                />
              </div>
            </div>
          )}

          {/* Print Format Selector Box (58mm or A4/F4, 80mm removed, Click to toggle/deselect) */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Opsi Cetak Struk:</span>
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {selectedPrint ? 'Klik tombol yang aktif untuk batal cetak' : 'Pilih jenis print atau biarkan kosong'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTogglePrint('58mm')}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between gap-1.5 border cursor-pointer ${
                  selectedPrint === '58mm'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/30'
                    : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span>⚡ Print 58mm</span>
                  {selectedPrint === '58mm' && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                </div>
                <kbd className="text-[9px] px-1 py-0.2 rounded bg-black/15 font-mono">
                  Alt+1
                </kbd>
              </button>

              <button
                type="button"
                onClick={() => handleTogglePrint('A4')}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between gap-1.5 border cursor-pointer ${
                  selectedPrint === 'A4'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/30'
                    : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span>📄 Print A4 / F4</span>
                  {selectedPrint === 'A4' && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                </div>
                <kbd className="text-[9px] px-1 py-0.2 rounded bg-black/15 font-mono">
                  Alt+2
                </kbd>
              </button>
            </div>

            {!selectedPrint ? (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                <span>🚫 Tanpa Cetak: Transaksi selesai langsung tanpa print nota.</span>
              </p>
            ) : (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  Otomatis mencetak langsung format {selectedPrint === 'A4' ? 'A4 / F4' : 'Thermal 58mm'}.
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 font-bold text-xs transition cursor-pointer"
          >
            Batal (Esc)
          </button>

          <button
            type="button"
            disabled={isUnderpaid || isSubmitting}
            onClick={handleComplete}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-extrabold transition shadow-md cursor-pointer ${
              isUnderpaid || isSubmitting
                ? 'bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Selesaikan Transaksi (Enter)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
