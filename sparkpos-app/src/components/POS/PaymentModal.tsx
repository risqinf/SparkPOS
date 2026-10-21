import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Banknote,
  QrCode,
  ArrowRight,
  CheckCircle2,
  Printer,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CartSummary, PaymentMethod, PaymentEntry } from '../../types/pos';
import { formatRupiah } from '../../services/cartCalculator';
import { playSuccessBeep } from '../../services/scanner';

interface PaymentModalProps {
  summary: CartSummary;
  onClose: () => void;
  onConfirmPayment: (payments: PaymentEntry[], paidAmount: number, changeAmount: number, autoPrint: boolean) => void;
  defaultAutoPrint: boolean;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  summary,
  onClose,
  onConfirmPayment,
  defaultAutoPrint,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('CASH');
  const [cashAmountStr, setCashAmountStr] = useState<string>('');
  const [autoPrint, setAutoPrint] = useState<boolean>(defaultAutoPrint);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Set default cash amount to exact grand total
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
    if (isUnderpaid) return;
    setIsSubmitting(true);
    playSuccessBeep();

    // Trigger confetti
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 },
    });

    const payments: PaymentEntry[] = [
      {
        method: selectedMethod,
        amount: selectedMethod === 'CASH' ? cashAmount : summary.grandTotal,
      },
    ];

    setTimeout(() => {
      onConfirmPayment(
        payments,
        selectedMethod === 'CASH' ? cashAmount : summary.grandTotal,
        changeAmount,
        autoPrint
      );
    }, 250);
  };

  // Keyboard shortcut listener (Enter to submit, Esc to close)
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
  }, [cashAmount, isUnderpaid, isSubmitting]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Pembayaran Kasir</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Grand Total Display */}
          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between">
            <span className="text-slate-400 font-medium">Total yang Harus Dibayar:</span>
            <span className="text-3xl font-extrabold text-emerald-400 tracking-tight">
              {formatRupiah(summary.grandTotal)}
            </span>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Metode Pembayaran
            </label>
            <div className="grid grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedMethod('CASH')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-sm font-semibold transition ${
                  selectedMethod === 'CASH'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/30'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                }`}
              >
                <Banknote className="w-5 h-5 mb-1" />
                <span>Tunai (Cash)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod('QRIS')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-sm font-semibold transition ${
                  selectedMethod === 'QRIS'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/30'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                }`}
              >
                <QrCode className="w-5 h-5 mb-1" />
                <span>QRIS Instant</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod('DEBIT')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-sm font-semibold transition ${
                  selectedMethod === 'DEBIT'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/30'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                }`}
              >
                <CreditCard className="w-5 h-5 mb-1" />
                <span>Kartu Debit</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod('TRANSFER')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-sm font-semibold transition ${
                  selectedMethod === 'TRANSFER'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/30'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                }`}
              >
                <ArrowRight className="w-5 h-5 mb-1" />
                <span>Transfer Bank</span>
              </button>
            </div>
          </div>

          {/* Cash Input & Quick Money Buttons (If Cash) */}
          {selectedMethod === 'CASH' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Nominal Uang Diterima (Rp)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    autoFocus
                    value={cashAmountStr}
                    onChange={(e) => setCashAmountStr(e.target.value)}
                    placeholder="Masukkan jumlah uang..."
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-2xl font-bold text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                  {cashAmount >= summary.grandTotal && (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 absolute right-3.5 top-3.5" />
                  )}
                </div>
              </div>

              {/* Quick Cash Buttons */}
              <div>
                <span className="text-xs text-slate-400 font-medium mb-1.5 block">
                  Pilihan Cepat Uang Kasir:
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {quickCashOptions.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleQuickCash(opt)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-emerald-600/20 hover:border-emerald-500 hover:text-emerald-300 transition"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Change Calculation */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  isUnderpaid
                    ? 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                    : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                }`}
              >
                <span className="font-semibold text-sm">
                  {isUnderpaid ? 'Kurang Bayar:' : 'Uang Kembalian:'}
                </span>
                <span className="text-2xl font-extrabold tracking-tight">
                  {isUnderpaid
                    ? formatRupiah(summary.grandTotal - cashAmount)
                    : formatRupiah(changeAmount)}
                </span>
              </div>
            </div>
          )}

          {/* Non-cash prompt */}
          {selectedMethod !== 'CASH' && (
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 text-center space-y-2">
              <QrCode className="w-12 h-12 text-emerald-400 mx-auto" />
              <p className="text-sm text-slate-300">
                Silakan scan QRIS atau gesek kartu pelanggan pada mesin EDC sejumlah:
              </p>
              <div className="text-xl font-bold text-white">{formatRupiah(summary.grandTotal)}</div>
            </div>
          )}

          {/* Options: Auto Print */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
              <input
                type="checkbox"
                checked={autoPrint}
                onChange={(e) => setAutoPrint(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-800 border-slate-700"
              />
              <Printer className="w-4 h-4 text-slate-400" />
              <span>Cetak struk otomatis setelah bayar</span>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-850 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750 font-semibold text-sm transition"
          >
            Batal (Esc)
          </button>

          <button
            type="button"
            disabled={isUnderpaid || isSubmitting}
            onClick={handleComplete}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-base font-bold transition shadow-lg ${
              isUnderpaid || isSubmitting
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
            }`}
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>Selesaikan Transaksi (Enter)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
