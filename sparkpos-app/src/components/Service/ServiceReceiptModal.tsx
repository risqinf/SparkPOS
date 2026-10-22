import React, { useState } from 'react';
import { X, Printer, Copy, Check, FileText } from 'lucide-react';
import { ServiceOrder, StoreProfile } from '../../types/pos';
import { generateServiceReceiptText } from '../../services/printer';

interface ServiceReceiptModalProps {
  order: ServiceOrder;
  storeProfile: StoreProfile;
  onClose: () => void;
}

export const ServiceReceiptModal: React.FC<ServiceReceiptModalProps> = ({
  order,
  storeProfile,
  onClose,
}) => {
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>(storeProfile.paperWidth);
  const [copied, setCopied] = useState(false);

  const activeProfile: StoreProfile = {
    ...storeProfile,
    paperWidth,
  };

  const receiptText = generateServiceReceiptText(order, activeProfile);

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(receiptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-bold text-white">Pratinjau Nota Servis ({order.ticketNumber})</h2>
              <p className="text-[11px] text-slate-400">Siap dicetak ke printer kasir thermal</p>
            </div>
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
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              58mm
            </button>
            <button
              onClick={() => setPaperWidth('80mm')}
              className={`px-3 py-1 rounded-md font-semibold transition ${
                paperWidth === '80mm'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              80mm
            </button>
          </div>
        </div>

        {/* Monospaced Receipt Preview Canvas */}
        <div className="p-6 bg-slate-950/80 overflow-y-auto flex-1 flex justify-center">
          <div
            className={`bg-white text-black p-4 font-mono text-[11px] leading-relaxed shadow-lg rounded-sm whitespace-pre select-text transition-all ${
              paperWidth === '58mm' ? 'w-[280px]' : 'w-[360px]'
            }`}
            style={{ fontFamily: '"Courier New", Courier, monospace' }}
          >
            {receiptText}
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="px-5 py-3.5 bg-slate-850 border-t border-slate-800 flex items-center justify-between shrink-0 gap-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition border border-slate-700"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Tersalin!' : 'Salin Teks Nota'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Tutup
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md shadow-indigo-950/50"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Sekarang</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
