import React, { useState } from 'react';
import { X, Printer, Copy, Check, FileText, ShieldCheck } from 'lucide-react';
import { Transaction, StoreProfile } from '../../types/pos';
import { generateReceiptText, detectOptimalPaperFormat } from '../../services/printer';
import { printSaleReceipt, describeOutcome } from '../../services/printService';
import { PrintableReceipt } from './PrintableReceipt';
import { useDialog } from '../../hooks/useDialog';

interface ReceiptModalProps {
  transaction: Transaction;
  storeProfile: StoreProfile;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  transaction,
  storeProfile,
  onClose,
}) => {
  const dialogRef = useDialog<HTMLDivElement>(true, onClose);
  const [paperFormat, setPaperFormat] = useState<'58mm' | 'A4'>(() => {
    return detectOptimalPaperFormat(transaction, storeProfile.paperWidth);
  });

  const [copied, setCopied] = useState(false);

  const activeProfile: StoreProfile = {
    ...storeProfile,
    paperWidth: '58mm',
  };

  const receiptText = generateReceiptText(transaction, activeProfile);

  const [printStatus, setPrintStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = async () => {
    if (isPrinting) return;
    setIsPrinting(true);
    setPrintStatus(null);
    const outcome = await printSaleReceipt(transaction, storeProfile, paperFormat, false);
    setPrintStatus({
      text: describeOutcome(outcome, paperFormat === 'A4' ? 'faktur A4' : 'struk 58mm'),
      ok: outcome.ok,
    });
    setIsPrinting(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(receiptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const warrantyItems = transaction.items.filter(
    (item) =>
      item.warrantyPeriod &&
      !['tidak ada', 'non-garansi', '-'].includes(item.warrantyPeriod.toLowerCase())
  );

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Pratinjau Struk & Faktur Penjualan</span>
                {warrantyItems.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Ada Garansi Unit Laptop</span>
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pilihan Format: Thermal Kasir (58mm) & Printer Kantor (A4/F4)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paper Format Switcher Toolbar (80mm Removed) */}
        <div className="px-5 py-2.5 bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-300/60 dark:border-slate-700/60 flex items-center justify-between shrink-0 text-xs flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-slate-700 dark:text-slate-300 font-bold">Format Kertas Printer:</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
              (Rekomendasi: {paperFormat === 'A4' ? 'Faktur A4/F4' : '58mm Kasir'})
            </span>
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-300 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setPaperFormat('58mm')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                paperFormat === '58mm'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              ⚡ 58mm Mini Kasir
            </button>
            <button
              type="button"
              onClick={() => setPaperFormat('A4')}
              className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                paperFormat === 'A4'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>📄 A4 / F4 Faktur Resmi</span>
            </button>
          </div>
        </div>

        {/* Paper Canvas Preview Area */}
        <div className="p-6 overflow-y-auto flex-1 flex justify-center bg-slate-50/90 dark:bg-slate-950/90">
          <div className="w-full flex justify-center">
            <PrintableReceipt
              transaction={transaction}
              storeProfile={storeProfile}
              paperFormat={paperFormat}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750 font-bold text-xs transition cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Tersalin!' : 'Salin Teks Nota'}</span>
          </button>

          <div className="flex items-center gap-2">
            {printStatus && (
              <span className={`text-[11px] font-semibold max-w-[260px] truncate ${printStatus.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} title={printStatus.text}>
                {printStatus.text}
              </span>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750 font-bold text-xs transition cursor-pointer"
            >
              Tutup (Esc)
            </button>

            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition shadow-lg shadow-emerald-950/40 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak ({paperFormat === 'A4' ? 'Printer Biasa A4/F4' : 'Thermal 58mm'})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
