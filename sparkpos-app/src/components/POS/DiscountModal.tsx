import React, { useState } from 'react';
import { X, Percent, Tag, Check } from 'lucide-react';
import { formatRupiah } from '../../services/cartCalculator';

interface DiscountModalProps {
  currentPercent: number;
  currentNominal: number;
  subtotal: number;
  onApply: (percent: number, nominal: number) => void;
  onClose: () => void;
}

export const DiscountModal: React.FC<DiscountModalProps> = ({
  currentPercent,
  currentNominal,
  subtotal,
  onApply,
  onClose,
}) => {
  const [mode, setMode] = useState<'percent' | 'nominal'>(
    currentPercent > 0 ? 'percent' : 'nominal'
  );
  const [value, setValue] = useState<string>(
    currentPercent > 0 ? currentPercent.toString() : currentNominal.toString()
  );

  const numVal = parseFloat(value) || 0;
  const calculatedDiscount =
    mode === 'percent' ? Math.round((subtotal * Math.min(100, numVal)) / 100) : Math.min(subtotal, numVal);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'percent') {
      onApply(Math.min(100, numVal), 0);
    } else {
      onApply(0, Math.min(subtotal, numVal));
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">Diskon Total Nota (Order Discount)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => {
                setMode('percent');
                setValue('10');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
                mode === 'percent'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Persentase (%)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('nominal');
                setValue('5000');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
                mode === 'nominal'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Nominal Rupiah (Rp)</span>
            </button>
          </div>

          {/* Quick presets */}
          <div>
            <span className="text-xs text-slate-200 font-bold mb-1.5 block">Preset Cepat:</span>
            <div className="flex flex-wrap gap-2">
              {mode === 'percent'
                ? [5, 10, 15, 20, 50].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setValue(p.toString())}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-emerald-600/20 hover:border-emerald-500 hover:text-emerald-300 transition"
                    >
                      {p}%
                    </button>
                  ))
                : [2000, 5000, 10000, 20000, 50000].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setValue(n.toString())}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-emerald-600/20 hover:border-emerald-500 hover:text-emerald-300 transition"
                    >
                      {formatRupiah(n)}
                    </button>
                  ))}
            </div>
          </div>

          {/* Input field */}
          <div>
            <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5">
              {mode === 'percent' ? 'Besar Diskon (%)' : 'Jumlah Potongan Harga (Rp)'}
            </label>
            <input
              type="number"
              autoFocus
              min="0"
              max={mode === 'percent' ? 100 : subtotal}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-xl font-bold text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Summary preview */}
          <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between">
            <span className="text-xs text-slate-200 font-semibold">Total Potongan Diskon:</span>
            <span className="text-lg font-bold text-amber-400">
              -{formatRupiah(calculatedDiscount)}
            </span>
          </div>

          {/* Footer actions */}
          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onApply(0, 0);
                onClose();
              }}
              className="text-xs text-rose-400 hover:underline"
            >
              Hapus Diskon
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-950/30"
              >
                <Check className="w-4 h-4" />
                <span>Terapkan</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
