import React, { useState, useEffect } from 'react';
import { Banknote, CheckCircle2, AlertCircle, Clock, ShieldAlert } from 'lucide-react';
import { formatRupiah } from '../../services/cartCalculator';
import { playSuccessBeep } from '../../services/scanner';
import { formatLocalDateOnly } from '../../services/dateUtils';

interface DailyOpeningCashModalProps {
  cashierName: string;
  onSaveOpeningCash: (amount: number) => Promise<void>;
}

export const DailyOpeningCashModal: React.FC<DailyOpeningCashModalProps> = ({
  cashierName,
  onSaveOpeningCash,
}) => {
  const [amountStr, setAmountStr] = useState<string>('200000');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const amount = parseFloat(amountStr) || 0;

  const quickOptions = [
    { label: 'Rp 100.000', val: 100000 },
    { label: 'Rp 200.000', val: 200000 },
    { label: 'Rp 300.000', val: 300000 },
    { label: 'Rp 500.000', val: 500000 },
    { label: '+50.000', add: 50000 },
    { label: '+100.000', add: 100000 },
    { label: 'Rp 0 (Tanpa Modal)', val: 0 },
  ];

  const handleQuickClick = (opt: { val?: number; add?: number }) => {
    if (opt.val !== undefined) {
      setAmountStr(opt.val.toString());
    } else if (opt.add !== undefined) {
      const cur = parseFloat(amountStr) || 0;
      setAmountStr((cur + opt.add).toString());
    }
    setErrorMsg(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (amount < 0) {
      setErrorMsg('Nominal modal awal tidak boleh negatif.');
      return;
    }
    setIsSubmitting(true);
    try {
      playSuccessBeep();
      await onSaveOpeningCash(amount);
    } catch (err) {
      console.error('Failed to save opening cash', err);
      setErrorMsg('Gagal menyimpan modal awal.');
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !isSubmitting) {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [amountStr, isSubmitting]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 select-none">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border-2 border-emerald-500/40 dark:border-emerald-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-100 dark:border-emerald-900/50 flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/30">
            <Banknote className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100">
                Wajib Awal Hari
              </span>
              <span className="text-xs text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                07.00 - 16.30
              </span>
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">
              Modal Awal Kasir Hari Ini
            </h2>
            <p className="text-xs text-slate-700 dark:text-slate-200 font-medium mt-0.5">
              {formatLocalDateOnly(new Date())} • Kasir: <strong>{cashierName}</strong>
            </p>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-300">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <p className="leading-relaxed font-medium">
              Masukkan total uang fisik (pecahan/kembalian) yang saat ini berada di laci kasir sebelum melayani transaksi pertama hari ini.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-2">
              Nominal Uang di Laci Kasir (Rp)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-lg font-extrabold text-slate-600 dark:text-slate-400">
                Rp
              </span>
              <input
                type="number"
                min="0"
                step="1000"
                autoFocus
                value={amountStr}
                onChange={(e) => {
                  setAmountStr(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="200000"
                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 focus:border-emerald-600 dark:focus:border-emerald-500 rounded-2xl text-2xl font-black text-slate-900 dark:text-white tracking-tight font-mono focus:outline-none transition shadow-inner"
              />
            </div>
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 text-right font-mono">
              Terbaca: {formatRupiah(amount)}
            </p>
          </div>

          {/* Quick Buttons */}
          <div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 block">
              Pilihan Cepat Nominal:
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {quickOptions.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleQuickClick(opt)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 transition cursor-pointer"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
            Tekan <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-slate-700 dark:text-slate-300">Enter</kbd> untuk konfirmasi
          </span>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit()}
            className="w-full sm:w-auto flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm transition shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? 'Menyimpan...' : 'Simpan & Buka Kasir'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
