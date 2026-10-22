import React, { useState, useEffect } from 'react';
import { X, Clock, Banknote, CreditCard, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { Shift, Transaction, CashFlow } from '../../types/pos';
import { formatRupiah } from '../../services/cartCalculator';
import { db, getCashFlowsByShift } from '../../services/storage';

interface ShiftReportModalProps {
  activeShift: Shift | null;
  onShiftClosed: () => void;
  onClose: () => void;
}

export const ShiftReportModal: React.FC<ShiftReportModalProps> = ({
  activeShift,
  onShiftClosed,
  onClose,
}) => {
  const [actualCashStr, setActualCashStr] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [cashSalesTotal, setCashSalesTotal] = useState<number>(0);
  const [nonCashSalesTotal, setNonCashSalesTotal] = useState<number>(0);
  const [txCount, setTxCount] = useState<number>(0);
  const [cashInTotal, setCashInTotal] = useState<number>(0);
  const [cashOutTotal, setCashOutTotal] = useState<number>(0);

  useEffect(() => {
    const calculateShiftSales = async () => {
      if (!activeShift) return;
      const txs = await db.transactions.where('shiftId').equals(activeShift.id).toArray();
      setTxCount(txs.length);

      let cashSum = 0;
      let nonCashSum = 0;

      for (const tx of txs) {
        for (const p of tx.payments) {
          if (p.method === 'CASH') {
            cashSum += p.amount;
          } else {
            nonCashSum += p.amount;
          }
        }
      }

      setCashSalesTotal(cashSum);
      setNonCashSalesTotal(nonCashSum);

      // Load Cash Flows (Uang Masuk / Keluar)
      const flows = await getCashFlowsByShift(activeShift.id);
      const inSum = flows.filter((f) => f.type === 'IN').reduce((sum, f) => sum + f.amount, 0);
      const outSum = flows.filter((f) => f.type === 'OUT').reduce((sum, f) => sum + f.amount, 0);
      setCashInTotal(inSum);
      setCashOutTotal(outSum);
    };

    calculateShiftSales();
  }, [activeShift]);

  const openingCash = activeShift?.openingCash || 0;
  const expectedCash = openingCash + cashSalesTotal + cashInTotal - cashOutTotal;
  const actualCash = parseFloat(actualCashStr) || 0;
  const discrepancy = actualCash - expectedCash;

  const handleCloseShift = async () => {
    if (!activeShift) return;
    if (actualCashStr === '') {
      alert('Silakan masukkan jumlah uang tunai fisik yang ada di laci kasir.');
      return;
    }

    if (
      !confirm(
        `Yakin ingin mengakhiri dan menutup Shift #${activeShift.id}?\nSelisih Kas: ${formatRupiah(
          discrepancy
        )}`
      )
    ) {
      return;
    }

    const now = new Date().toISOString();
    await db.shifts.update(activeShift.id, {
      endTime: now,
      closingCash: actualCash,
      expectedCash,
      discrepancy,
      note,
      isClosed: true,
    });

    // Start next shift automatically
    await db.shifts.add({
      id: activeShift.id + 1,
      cashierId: activeShift.cashierId,
      cashierName: activeShift.cashierName,
      startTime: now,
      openingCash: actualCash, // rolling cash or initial
      expectedCash: actualCash,
      isClosed: false,
    } as any);

    onShiftClosed();
    onClose();
  };

  const startTimeStr = activeShift?.startTime
    ? new Date(activeShift.startTime).toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '-';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Rincian Shift Kasir #{activeShift?.id || 1}
                </h2>
                {activeShift?.shiftName && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {activeShift.shiftName}
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400">
                Mulai: {startTimeStr} • Kasir: {activeShift?.cashierName}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Shift Financial Cards */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-850 border border-slate-800">
              <span className="text-slate-400 block mb-1">Kas Modal Awal:</span>
              <span className="text-lg font-bold text-white font-mono">
                {formatRupiah(openingCash)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-850 border border-slate-800">
              <span className="text-slate-400 block mb-1">Total Transaksi Selesai:</span>
              <span className="text-lg font-bold text-emerald-400 font-mono">
                {txCount} Transaksi
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-850 border border-slate-800">
              <span className="text-slate-400 block mb-1">Penjualan Tunai (Cash):</span>
              <span className="text-lg font-bold text-emerald-400 font-mono">
                {formatRupiah(cashSalesTotal)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-850 border border-slate-800">
              <span className="text-slate-400 block mb-1">Penjualan Non-Tunai:</span>
              <span className="text-lg font-bold text-blue-400 font-mono">
                {formatRupiah(nonCashSalesTotal)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-850 border border-slate-800">
              <span className="text-slate-400 block mb-1">Uang Masuk Manual (+):</span>
              <span className="text-lg font-bold text-emerald-400 font-mono">
                +{formatRupiah(cashInTotal)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-850 border border-slate-800">
              <span className="text-slate-400 block mb-1">Uang Keluar Operasional (-):</span>
              <span className="text-lg font-bold text-rose-400 font-mono">
                -{formatRupiah(cashOutTotal)}
              </span>
            </div>
          </div>

          {/* Expected Cash in Drawer */}
          <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 flex items-center justify-between">
            <span className="text-xs text-slate-300 font-semibold">
              Total Kas yang Harus Ada di Laci:
            </span>
            <span className="text-xl font-black text-emerald-400 font-mono">
              {formatRupiah(expectedCash)}
            </span>
          </div>

          {/* Actual Cash Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Hitung Uang Fisik Riil di Laci (Rekonsiliasi Kas)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-base text-slate-500 font-bold">
                Rp
              </span>
              <input
                type="number"
                value={actualCashStr}
                onChange={(e) => setActualCashStr(e.target.value)}
                placeholder="Masukkan jumlah uang fisik di laci..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-lg font-bold text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Discrepancy Alert */}
          {actualCashStr !== '' && (
            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                discrepancy === 0
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : discrepancy > 0
                  ? 'bg-blue-950/40 border-blue-800 text-blue-300'
                  : 'bg-rose-950/40 border-rose-800 text-rose-300'
              }`}
            >
              <span>Status Selisih Kas:</span>
              <span className="text-sm font-bold font-mono">
                {discrepancy === 0
                  ? '● Pas (Seimbang Rp 0)'
                  : discrepancy > 0
                  ? `+${formatRupiah(discrepancy)} (Kas Lebih)`
                  : `${formatRupiah(discrepancy)} (Kas Minus / Kurang)`}
              </span>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Catatan Penutupan Shift (Opsional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Sisa uang receh 500an cukup banyak"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750 font-semibold text-xs"
            >
              Tutup
            </button>

            <button
              type="button"
              onClick={handleCloseShift}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-md shadow-rose-950/40"
            >
              <Lock className="w-4 h-4" />
              <span>Tutup Shift Sekarang</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
