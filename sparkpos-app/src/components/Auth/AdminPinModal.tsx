import React, { useState } from 'react';
import { ShieldCheck, Lock, AlertCircle, X } from 'lucide-react';
import { verifyAdminSupervisorPin } from '../../services/storage';
import { playSuccessBeep, playErrorBeep } from '../../services/scanner';
import { useDialog } from '../../hooks/useDialog';

interface AdminPinModalProps {
  title?: string;
  description?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  title = 'Verifikasi PIN Administrator',
  description = 'Menu ini memiliki akses khusus Administrator untuk mengubah pengaturan toko, nama aplikasi, atau logo.',
  onSuccess,
  onCancel,
}) => {
  const dialogRef = useDialog<HTMLDivElement>(true, onCancel);
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleDigit = (d: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + d);
      setErrorMessage(null);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  };

  const handleClear = () => {
    setPin('');
    setErrorMessage(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin) {
      setErrorMessage('Masukkan PIN Administrator.');
      playErrorBeep();
      return;
    }

    setIsLoading(true);
    const isValid = await verifyAdminSupervisorPin(pin);
    setIsLoading(false);

    if (isValid) {
      playSuccessBeep();
      onSuccess();
    } else {
      playErrorBeep();
      setErrorMessage('PIN Administrator salah! Coba default: 123456');
      setPin('');
    }
  };

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-slate-900 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
            <ShieldCheck className="w-5 h-5" />
            <span>{title}</span>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-800 dark:text-slate-200 font-medium mt-3">{description}</p>

        {/* PIN Display */}
        <div className="my-4">
          <div className="h-12 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <div className="tracking-widest text-lg font-mono text-emerald-600 dark:text-emerald-400">
                {pin ? '●'.repeat(pin.length) : <span className="text-xs text-slate-500 dark:text-slate-400 font-sans">Ketik PIN Admin...</span>}
              </div>
            </div>
            {pin && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-bold"
              >
                Reset
              </button>
            )}
          </div>

          {errorMessage && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Tactile Mini Numpad */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              className="h-11 rounded-xl bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold text-base active:scale-95 transition"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-11 rounded-xl bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs active:scale-95 transition"
          >
            C
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-11 rounded-xl bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold text-base active:scale-95 transition"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-11 rounded-xl bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs active:scale-95 transition"
          >
            ⌫
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-semibold text-xs transition"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isLoading || pin.length === 0}
            onClick={() => handleSubmit()}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition ${
              pin.length === 0
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow'
            }`}
          >
            Verifikasi
          </button>
        </div>
      </div>
    </div>
  );
};
