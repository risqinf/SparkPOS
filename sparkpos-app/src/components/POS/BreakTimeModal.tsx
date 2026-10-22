import React, { useState, useEffect } from 'react';
import { Coffee, Lock, Play, AlertCircle, Clock } from 'lucide-react';
import { Employee } from '../../types/pos';
import { authenticateEmployee } from '../../services/storage';
import { playSuccessBeep, playErrorBeep } from '../../services/scanner';

interface BreakTimeModalProps {
  currentUser: Employee | null;
  startTime: Date;
  onResume: () => void;
}

export const BreakTimeModal: React.FC<BreakTimeModalProps> = ({
  currentUser,
  startTime,
  onResume,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [pin, setPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Live timer for break duration
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const diffSecs = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      setElapsedSeconds(diffSecs >= 0 ? diffSecs : 0);
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  const formatTimer = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

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

  const handleVerifyResume = async () => {
    if (!pin) {
      setErrorMessage('Masukkan PIN untuk membuka terminal.');
      playErrorBeep();
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);
    try {
      // Authenticate with user's PIN (or Admin PIN)
      let matched: Employee | null = null;
      if (currentUser) {
        matched = await authenticateEmployee(currentUser.username, pin);
      }
      if (!matched) {
        matched = await authenticateEmployee(pin);
      }

      if (matched) {
        playSuccessBeep();
        onResume();
      } else {
        playErrorBeep();
        setErrorMessage('PIN salah! Hanya kasir aktif atau Owner yang dapat membuka istirahat.');
        setPin('');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // Keyboard listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter') {
        handleVerifyResume();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pin]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center">
        {/* Coffee Icon Badge */}
        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-500/10">
          <Coffee className="w-8 h-8 animate-bounce" />
        </div>

        <h2 className="text-xl font-extrabold text-white tracking-tight">
          Terminal Kasir Sedang Istirahat
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Kasir: <strong className="text-slate-200">{currentUser?.fullName || 'Kasir'}</strong>
        </p>

        {/* Live Timer Clock */}
        <div className="my-6 px-6 py-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-400" />
          <span className="font-mono text-2xl font-black text-amber-300 tracking-wider">
            {formatTimer(elapsedSeconds)}
          </span>
        </div>

        {/* PIN Input Dots */}
        <div className="w-full space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Masukkan PIN Kasir untuk Melanjutkan
            </label>
            <div className="flex items-center justify-center gap-3 h-12 bg-slate-950 rounded-xl border border-slate-800">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full transition-all ${
                    i < pin.length ? 'bg-emerald-400 scale-110 shadow-sm shadow-emerald-400' : 'bg-slate-800'
                  }`}
                />
              ))}
            </div>
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Touch Numpad */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  if (k === 'C') setPin('');
                  else if (k === '⌫') handleBackspace();
                  else handleDigit(k);
                }}
                className="h-12 rounded-xl bg-slate-850 hover:bg-slate-800 text-white font-bold text-base transition border border-slate-800 active:scale-95 flex items-center justify-center"
              >
                {k}
              </button>
            ))}
          </div>

          {/* Resume Button */}
          <button
            type="button"
            disabled={isVerifying || pin.length < 4}
            onClick={handleVerifyResume}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 transition shadow-md shadow-emerald-950/40"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{isVerifying ? 'Memverifikasi...' : 'Selesai Istirahat & Buka Kasir'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
