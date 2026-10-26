import React, { useState } from 'react';
import { X, ArrowDownRight, ArrowUpRight, DollarSign, Tag, FileText, CheckCircle2 } from 'lucide-react';
import { formatRupiah } from '../../services/cartCalculator';
import { addCashFlow } from '../../services/storage';
import { CashFlowType, Shift, Employee } from '../../types/pos';
import { CASH_OUT_CATEGORIES, CASH_IN_CATEGORIES, noteExample } from '../../services/cashCategories';
import { useDialog } from '../../hooks/useDialog';

interface CashFlowModalProps {
  activeShift: Shift | null;
  currentUser: Employee | null;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

const DEFAULT_EXPENSE_CATEGORIES = CASH_OUT_CATEGORIES;
const DEFAULT_INCOME_CATEGORIES = CASH_IN_CATEGORIES;

export const CashFlowModal: React.FC<CashFlowModalProps> = ({
  activeShift,
  currentUser,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const dialogRef = useDialog<HTMLDivElement>(true, onClose);
  const [flowType, setFlowType] = useState<CashFlowType>('OUT'); // Default: Uang Keluar
  const [amountStr, setAmountStr] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>(DEFAULT_EXPENSE_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const categories = flowType === 'OUT' ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_CATEGORIES;

  const handleAmountQuickAdd = (nominal: number) => {
    const current = parseFloat(amountStr) || 0;
    setAmountStr((current + nominal).toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(amountStr) || 0;
    if (amount <= 0) {
      alert('Nominal uang harus lebih dari Rp 0!');
      return;
    }

    const finalCategory =
      selectedCategory === 'Lain-lain' && customCategory.trim()
        ? customCategory.trim()
        : selectedCategory;

    setIsSubmitting(true);
    try {
      await addCashFlow({
        shiftId: activeShift?.id || 1,
        cashierId: currentUser?.id || 1,
        cashierName: currentUser?.fullName || 'Kasir',
        type: flowType,
        category: finalCategory,
        amount,
        note: note.trim(),
        createdAt: new Date().toISOString(),
      });

      const typeLabel = flowType === 'OUT' ? 'Uang Keluar' : 'Uang Masuk';
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('sparkpos_data_changed', {
            detail: { type: 'cash_flow', flowType, amount },
          })
        );
      }
      if (onSuccess) {
        onSuccess(`${typeLabel} sebesar ${formatRupiah(amount)} berhasil dicatat!`);
      }
      onClose();
    } catch (err: any) {
      alert(`Gagal mencatat arus kas: ${err?.message || err}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Kasir: Catat Uang Masuk / Keluar Laci</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="p-5 pb-0">
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setFlowType('OUT');
                setSelectedCategory(DEFAULT_EXPENSE_CATEGORIES[0]);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition ${
                flowType === 'OUT'
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>Uang Keluar (Biaya / Beli Barang)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFlowType('IN');
                setSelectedCategory(DEFAULT_INCOME_CATEGORIES[0]);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition ${
                flowType === 'IN'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Uang Masuk (Tambah Kas Laci)</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Nominal Input */}
          <div>
            <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1">
              Nominal Uang (Rp) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-xs text-slate-400 font-bold">Rp</span>
              <input
                type="number"
                min="1"
                required
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0"
                className={`w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-lg font-bold text-white focus:outline-none ${
                  flowType === 'OUT' ? 'focus:border-rose-500 text-rose-300' : 'focus:border-emerald-500 text-emerald-300'
                }`}
              />
            </div>

            {/* Quick buttons */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {[5000, 10000, 20000, 50000, 100000].map((nom) => (
                <button
                  key={nom}
                  type="button"
                  onClick={() => handleAmountQuickAdd(nom)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700"
                >
                  +{nom.toLocaleString('id-ID')}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAmountStr('')}
                className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-300 text-[11px] font-medium"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1">
              Kategori Keperluan
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Category Input if 'Lain-lain' */}
          {selectedCategory === 'Lain-lain' && (
            <div>
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1">
                Ketik Kategori Kustom
              </label>
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Contoh: Biaya cetak banner / Beli air galon"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* Note / Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1">
              Keterangan
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={noteExample(flowType)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex items-center gap-1.5 px-6 py-2.5 rounded-xl font-bold text-xs text-white transition shadow-md ${
                flowType === 'OUT'
                  ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/40'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Transaksi Kas'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
