import React, { useState } from 'react';
import { X, Printer, Copy, Check, FileText } from 'lucide-react';
import { ServiceOrder, StoreProfile } from '../../types/pos';
import { generateServiceReceiptText } from '../../services/printer';
import { printThermalText, isTauriRuntime, describeOutcome } from '../../services/printService';

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
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>(
    storeProfile.paperWidth === '58mm' ? '58mm' : '80mm'
  );
  const [copied, setCopied] = useState(false);

  const activeProfile: StoreProfile = {
    ...storeProfile,
    paperWidth,
  };

  const receiptText = generateServiceReceiptText(order, activeProfile);

  const [printStatus, setPrintStatus] = useState<{ text: string; ok: boolean } | null>(null);

  const handlePrint = async () => {
    setPrintStatus(null);
    if (!isTauriRuntime()) {
      window.print();
      return;
    }
    const outcome = await printThermalText(receiptText, storeProfile);
    setPrintStatus({ text: describeOutcome(outcome, 'nota servis'), ok: outcome.ok });
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
        <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Pratinjau Nota Servis ({order.ticketNumber})</h2>
              <p className="text-[10px] text-zinc-400">Siap dicetak ke printer kasir thermal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Paper Width Selector Toolbar */}
        <div className="px-4 py-2 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between shrink-0 text-xs">
          <span className="text-zinc-400 text-[11px] font-medium">Ukuran Kertas Thermal:</span>
          <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-md border border-zinc-800">
            <button
              onClick={() => setPaperWidth('58mm')}
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition ${
                paperWidth === '58mm'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              58mm
            </button>
            <button
              onClick={() => setPaperWidth('80mm')}
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition ${
                paperWidth === '80mm'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              80mm
            </button>
          </div>
        </div>

        {/* Monospaced Receipt Preview Canvas */}
        <div className="p-4 bg-zinc-950/80 overflow-y-auto flex-1 flex justify-center">
          <div
            className={`bg-white text-black p-3.5 font-mono text-[11px] leading-relaxed shadow-lg rounded-sm whitespace-pre select-text transition-all ${
              paperWidth === '58mm' ? 'w-[280px]' : 'w-[360px]'
            }`}
            style={{ fontFamily: '"Courier New", Courier, monospace' }}
          >
            {receiptText}
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="px-4 py-2.5 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between shrink-0 gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition border border-zinc-700"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Tersalin!' : 'Salin Teks Nota'}</span>
          </button>

          <div className="flex items-center gap-2">
            {printStatus && (
              <span className={`text-[11px] font-semibold max-w-[200px] truncate ${printStatus.ok ? 'text-emerald-400' : 'text-rose-400'}`} title={printStatus.text}>
                {printStatus.text}
              </span>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-semibold transition"
            >
              Tutup
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Sekarang</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
