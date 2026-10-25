import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Banknote,
  ArrowRight,
  CheckCircle2,
  Printer,
  Building2,
  AlertCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CartSummary, PaymentMethod, PaymentEntry } from '../../types/pos';
import { formatRupiah } from '../../services/cartCalculator';
import { playSuccessBeep } from '../../services/scanner';

interface PaymentModalProps {
  summary: CartSummary;
  customerName?: string;
  onClose: () => void;
  onConfirmPayment: (
    payments: PaymentEntry[],
    paidAmount: number,
    changeAmount: number,
    autoPrint: boolean
  ) => void;
  defaultAutoPrint: boolean;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  summary,
  customerName,
  onClose,
  onConfirmPayment,
  defaultAutoPrint,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [cashAmountStr, setCashAmountStr] = useState<string>(summary.grandTotal.toString());
  const [transferRefNote, setTransferRefNote] = useState<string>('');
  const [autoPrint, setAutoPrint] = useState<boolean>(defaultAutoPrint);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (selectedMethod === 'CASH') {
      setCashAmountStr(summary.grandTotal.toString());
    } else {
      setCashAmountStr(summary.grandTotal.toString());
    }
  }, [summary.grandTotal, selectedMethod]);

  const cashAmount = parseFloat(cashAmountStr) || 0;
  const changeAmount = Math.max(0, cashAmount - summary.grandTotal);
  const isUnderpaid = cashAmount < summary.grandTotal && selectedMethod === 'CASH';

  // Quick cash buttons
  const quickCashOptions = [
    { label: 'Uang Pas', amount: summary.grandTotal },
    { label: '+10.000', add: 10000 },
    { label: '+20.000', add: 20000 },
    { label: '+50.000', add: 50000 },
    { label: '+100.000', add: 100000 },
    { label: 'Rp 50.000', amount: 50000 },
    { label: 'Rp 100.000', amount: 100000 },
    { label: 'Rp 200.000', amount: 200000 },
  ];

  const handleQuickCash = (option: { amount?: number; add?: number }) => {
    if (option.amount !== undefined) {
      setCashAmountStr(option.amount.toString());
    } else if (option.add !== undefined) {
      const current = parseFloat(cashAmountStr) || 0;
      setCashAmountStr((current + option.add).toString());
    }
  };

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
        autoPrint
      );
    }, 200);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && !isUnderpaid && !isSubmitting) {
        handleComplete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cashAmount, isUnderpaid, isSubmitting, selectedMethod, transferRefNote]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 select-none">
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

          {/* Payment Method Selector (Only 2 Choices: Tunai & Transfer) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              Metode Pembayaran
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedMethod('CASH')}
                className={`flex items-center justify-center gap-2.5 p-3.5 rounded-2xl border-2 font-bold text-sm transition cursor-pointer ${
                  selectedMethod === 'CASH'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-600 text-emerald-800 dark:text-emerald-300 shadow-md shadow-emerald-600/10'
                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                }`}
              >
                <Banknote className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>💵 Tunai (Cash)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod('TRANSFER')}
                className={`flex items-center justify-center gap-2.5 p-3.5 rounded-2xl border-2 font-bold text-sm transition cursor-pointer ${
                  selectedMethod === 'TRANSFER'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-600 text-emerald-800 dark:text-emerald-300 shadow-md shadow-emerald-600/10'
                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                }`}
              >
                <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>🏦 Transfer Bank</span>
              </button>
            </div>
          </div>

          {/* Tunai: Input Uang Diterima & Tombol Pecahan */}
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
                    type="number"
                    autoFocus
                    value={cashAmountStr}
                    onChange={(e) => setCashAmountStr(e.target.value)}
                    placeholder="Masukkan jumlah uang..."
                    className="w-full pl-12 pr-12 py-3 bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-2xl font-black text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 font-mono transition shadow-inner"
                  />
                  {cashAmount >= summary.grandTotal && (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 absolute right-4 top-3.5" />
                  )}
                </div>
              </div>

              {/* Quick Cash Buttons */}
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5 block">
                  Pilihan Cepat Uang Kasir:
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {quickCashOptions.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleQuickCash(opt)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 transition cursor-pointer"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
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

          {/* Print Receipt Toggle (Enable / Disable untuk toko yang menggunakan nota manual) */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={autoPrint}
                onChange={(e) => setAutoPrint(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 cursor-pointer"
              />
              <Printer className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Cetak struk nota belanja otomatis</span>
            </label>
            {!autoPrint && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold pl-6">
                Mode Nota Manual Aktif: Transaksi akan selesai langsung tanpa membuka dialog struk printer.
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
