import React, { useState } from 'react';
import { X, Printer, Copy, Check, FileText } from 'lucide-react';
import { Transaction, StoreProfile } from '../../types/pos';
import { generateReceiptText, printReceiptSilent } from '../../services/printer';

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
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>(storeProfile.paperWidth);
  const [copied, setCopied] = useState(false);

  const activeProfile: StoreProfile = {
    ...storeProfile,
    paperWidth,
  };

  const receiptText = generateReceiptText(transaction, activeProfile);

  const handlePrint = () => {
    printReceiptSilent(transaction, activeProfile);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(receiptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Pratinjau Struk Kasir (ESC/POS)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paper Width Selector Toolbar */}
        <div className="px-5 py-2.5 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between shrink-0 text-xs">
          <span className="text-slate-400 font-medium">Ukuran Kertas Thermal:</span>
          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-700">
            <button
              onClick={() => setPaperWidth('58mm')}
              className={`px-3 py-1 rounded-md font-semibold transition ${
                paperWidth === '58mm'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              58mm (32 col)
            </button>
            <button
              onClick={() => setPaperWidth('80mm')}
              className={`px-3 py-1 rounded-md font-semibold transition ${
                paperWidth === '80mm'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              80mm (42 col)
            </button>
          </div>
        </div>

        {/* Realistic Receipt Paper Canvas */}
        <div className="p-6 overflow-y-auto flex-1 flex justify-center bg-slate-950">
          <div
            id="printable-receipt"
            className={`bg-white text-slate-950 p-6 rounded shadow-2xl font-mono text-xs leading-relaxed border-t-8 border-slate-300 ${
              paperWidth === '58mm' ? 'w-[290px]' : 'w-[370px]'
            }`}
          >
            {/* Store Logo if configured */}
            {activeProfile.showLogoOnReceipt && activeProfile.appLogo && (
              <div className="flex justify-center mb-3">
                <img
                  src={activeProfile.appLogo}
                  alt="Receipt Logo"
                  className="max-h-14 max-w-[140px] object-contain grayscale contrast-200"
                />
              </div>
            )}

            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-tight select-all">
              {receiptText}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-850 border-t border-slate-800 flex items-center justify-between shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750 font-medium text-xs transition"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Tersalin!' : 'Salin Teks'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750 font-semibold text-xs transition"
            >
              Tutup (Esc)
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-950/40"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Struk Sekarang</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
