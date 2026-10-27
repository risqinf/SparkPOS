import React, { useState } from 'react';
import { X, Printer, Copy, Check, FileText, MessageCircle } from 'lucide-react';
import { ServiceOrder, StoreProfile } from '../../types/pos';
import { generateServiceReceiptText } from '../../services/printer';
import { printThermalText, isTauriRuntime, describeOutcome } from '../../services/printService';
import { useDialog } from '../../hooks/useDialog';

interface ServiceReceiptModalProps {
  order: ServiceOrder;
  storeProfile: StoreProfile;
  onClose: () => void;
  onOpenWhatsApp?: (order: ServiceOrder) => void;
}

export const ServiceReceiptModal: React.FC<ServiceReceiptModalProps> = ({
  order,
  storeProfile,
  onClose,
  onOpenWhatsApp,
}) => {
  const dialogRef = useDialog<HTMLDivElement>(true, onClose);
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
    <div ref={dialogRef} role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-300/80 dark:border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <span>{order.status === 'DIBATALKAN' ? 'Nota Pembatalan Servis' : 'Pratinjau Nota Servis'} ({order.ticketNumber})</span>
                {order.status === 'DIBATALKAN' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                    Dibatalkan
                  </span>
                )}
              </h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Siap dicetak ke printer kasir thermal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Paper Width Selector Toolbar */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 text-xs">
          <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium">Ukuran Kertas Thermal:</span>
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-md border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setPaperWidth('58mm')}
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition ${
                paperWidth === '58mm'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              58mm
            </button>
            <button
              onClick={() => setPaperWidth('80mm')}
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition ${
                paperWidth === '80mm'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              80mm
            </button>
          </div>
        </div>

        {/* Monospaced Receipt Preview Canvas */}
        <div className="p-4 bg-slate-50/80 dark:bg-slate-950/80 overflow-y-auto flex-1 flex justify-center">
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
        <div className="px-4 py-2.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition border border-slate-300 dark:border-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin!' : 'Salin Teks Nota'}</span>
            </button>

            {onOpenWhatsApp && (
              <button
                type="button"
                onClick={() => onOpenWhatsApp(order)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold transition border border-emerald-300 dark:border-emerald-700 shadow-2xs"
                title="Kirim pesan WhatsApp nota ke pelanggan"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Kirim WhatsApp</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {printStatus && (
              <span className={`text-[11px] font-semibold max-w-[200px] truncate ${printStatus.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} title={printStatus.text}>
                {printStatus.text}
              </span>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-semibold transition"
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
