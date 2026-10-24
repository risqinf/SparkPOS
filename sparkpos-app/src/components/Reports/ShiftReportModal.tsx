import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  Banknote,
  Printer,
  AlertCircle,
  CheckCircle2,
  Lock,
  History,
  Copy,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import { Shift, StoreProfile, Employee } from '../../types/pos';
import { formatRupiah } from '../../services/cartCalculator';
import { db, getCashFlowsByShift, closeTodayCashRegister } from '../../services/storage';
import {
  generateShiftReportReceiptText,
  ShiftReportPrintData,
} from '../../services/printer';
import { getLocalDateString, toLocalDateString } from '../../services/dateUtils';

interface ShiftReportModalProps {
  activeShift: Shift | null;
  storeProfile: StoreProfile;
  currentUser?: Employee | null;
  onShiftClosed: () => void;
  onClose: () => void;
}

export const ShiftReportModal: React.FC<ShiftReportModalProps> = ({
  activeShift,
  storeProfile,
  currentUser,
  onShiftClosed,
  onClose,
}) => {
  const [modalTab, setModalTab] = useState<'current' | 'history'>('current');
  const [actualCashStr, setActualCashStr] = useState<string>('');
  const [newOpeningCashStr, setNewOpeningCashStr] = useState<string>('0');
  const [note, setNote] = useState<string>('');
  const [cashSalesTotal, setCashSalesTotal] = useState<number>(0);
  const [nonCashSalesTotal, setNonCashSalesTotal] = useState<number>(0);
  const [txCount, setTxCount] = useState<number>(0);
  const [cashInTotal, setCashInTotal] = useState<number>(0);
  const [cashOutTotal, setCashOutTotal] = useState<number>(0);
  const [serviceCashTotal, setServiceCashTotal] = useState<number>(0);
  const [serviceNonCashTotal, setServiceNonCashTotal] = useState<number>(0);
  const [serviceCount, setServiceCount] = useState<number>(0);

  // Past shifts for history tab
  const [pastShifts, setPastShifts] = useState<Shift[]>([]);

  // Thermal Receipt Preview Modal State
  const [receiptPreviewText, setReceiptPreviewText] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const calculateShiftSales = async () => {
    if (!activeShift) return;

    const todayStr = getLocalDateString();
    // 1. Transaksi Penjualan Barang POS (Shift ID atau Hari Ini)
    const allTxs = await db.transactions.toArray();
    const txs = allTxs.filter((t) => {
      if (t.shiftId === activeShift.id) return true;
      const tDate = toLocalDateString(t.createdAt);
      return tDate === todayStr;
    });

    setTxCount(txs.length);

    let cashSum = 0;
    let nonCashSum = 0;

    for (const tx of txs) {
      if (tx.payments && tx.payments.length > 0) {
        for (const p of tx.payments) {
          if (p.method === 'CASH') {
            cashSum += p.amount;
          } else {
            nonCashSum += p.amount;
          }
        }
      } else {
        if (tx.paymentMethod === 'CASH') {
          cashSum += tx.grandTotal;
        } else {
          nonCashSum += tx.grandTotal;
        }
      }
    }

    setCashSalesTotal(cashSum);
    setNonCashSalesTotal(nonCashSum);

    // 2. Transaksi Jasa & Servis Masuk
    try {
      const serviceOrders = await db.serviceOrders.toArray();
      let sCash = 0;
      let sNonCash = 0;
      let sCnt = 0;

      for (const ord of serviceOrders) {
        const shiftTime = new Date(activeShift.startTime).getTime();
        const ordTime = new Date(ord.updatedAt || ord.createdAt).getTime();
        const ordDate = toLocalDateString(ord.updatedAt || ord.createdAt);

        if ((ordTime >= shiftTime || ordDate === todayStr) && ord.paidAmount > 0) {
          sCnt++;
          if (ord.paymentMethod === 'CASH') {
            sCash += ord.paidAmount;
          } else {
            sNonCash += ord.paidAmount;
          }
        }
      }

      setServiceCashTotal(sCash);
      setServiceNonCashTotal(sNonCash);
      setServiceCount(sCnt);
    } catch (e) {
      console.error('Error calculating shift services', e);
    }

    // 3. Arus Kas Masuk / Keluar (Petty Cash)
    const allFlows = await db.cashFlows.toArray();
    const flows = allFlows.filter((f) => {
      if (f.shiftId === activeShift.id) return true;
      return toLocalDateString(f.createdAt) === todayStr;
    });
    const inSum = flows.filter((f) => f.type === 'IN').reduce((sum, f) => sum + f.amount, 0);
    const outSum = flows.filter((f) => f.type === 'OUT').reduce((sum, f) => sum + f.amount, 0);
    setCashInTotal(inSum);
    setCashOutTotal(outSum);
  };

  useEffect(() => {
    calculateShiftSales();

    const handleUpdate = () => {
      calculateShiftSales();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('sparkpos_data_changed', handleUpdate);
      window.addEventListener('focus', handleUpdate);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('sparkpos_data_changed', handleUpdate);
        window.removeEventListener('focus', handleUpdate);
      }
    };
  }, [activeShift]);

  // Load past closed shifts
  useEffect(() => {
    const loadPastShifts = async () => {
      const all = await db.shifts.toArray();
      const closed = all.filter((s) => s.isClosed).sort((a, b) => b.id - a.id);
      setPastShifts(closed);
    };
    loadPastShifts();
  }, [modalTab]);

  const openingCash = activeShift?.openingCash || 0;
  const expectedCash = openingCash + cashSalesTotal + serviceCashTotal + cashInTotal - cashOutTotal;
  const actualCash = parseFloat(actualCashStr) || 0;
  const discrepancy = actualCash - expectedCash;

  // Build Print Data
  const getPrintData = (): ShiftReportPrintData => {
    return {
      shiftNumber: activeShift?.id || 1,
      cashierName: activeShift?.cashierName || 'Kasir',
      shiftName: activeShift?.shiftName,
      startTime: activeShift?.startTime || new Date().toISOString(),
      endTime: new Date().toISOString(),
      openingCash,
      closingCash: actualCashStr !== '' ? actualCash : expectedCash,
      expectedCash,
      discrepancy: actualCashStr !== '' ? discrepancy : 0,
      cashSales: cashSalesTotal,
      nonCashSales: nonCashSalesTotal,
      serviceCashSales: serviceCashTotal,
      serviceNonCashSales: serviceNonCashTotal,
      cashIn: cashInTotal,
      cashOut: cashOutTotal,
      txCount,
      serviceCount,
      note: note || activeShift?.note,
    };
  };

  const handlePreviewReceipt = () => {
    const data = getPrintData();
    const text = generateShiftReportReceiptText(data, storeProfile);
    setReceiptPreviewText(text);
  };

  const handlePrintSilent = () => {
    window.print();
  };

  const handleCopyReceipt = () => {
    if (!receiptPreviewText) return;
    navigator.clipboard.writeText(receiptPreviewText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    if (actualCashStr === '') {
      alert('Silakan masukkan jumlah uang tunai fisik yang ada di laci kasir.');
      return;
    }

    let msg = `Tutup Kas Harian Toko (07.00 - 16.30)?\n\n`;
    msg += `Kas Awal     : ${formatRupiah(openingCash)}\n`;
    msg += `Penjualan    : ${formatRupiah(cashSalesTotal + nonCashSalesTotal)}\n`;
    msg += `Kas Laci Seharusnya: ${formatRupiah(expectedCash)}\n`;
    msg += `Uang Fisik Aktual  : ${formatRupiah(actualCash)}\n`;
    msg += `Selisih Kas : ${
      discrepancy === 0
        ? 'Pas (Rp 0)'
        : discrepancy > 0
        ? `+${formatRupiah(discrepancy)} (LEBIH)`
        : `${formatRupiah(discrepancy)} (KURANG)`
    }`;

    if (!confirm(msg)) {
      return;
    }

    const now = new Date().toISOString();
    await closeTodayCashRegister(actualCash, note);
    await db.shifts.update(activeShift.id, {
      endTime: now,
      closingCash: actualCash,
      expectedCash,
      discrepancy,
      totalCashSales: cashSalesTotal,
      totalNonCashSales: nonCashSalesTotal,
      totalServiceSales: serviceCashTotal + serviceNonCashTotal,
      totalCashIn: cashInTotal,
      totalCashOut: cashOutTotal,
      txCount,
      serviceCount,
      note,
      isClosed: true,
    });

    onShiftClosed();
    onClose();
  };

  const handleStartNewShift = async () => {
    if (!currentUser) {
      alert('Sesi kasir tidak ditemukan. Silakan login kembali.');
      return;
    }
    const allShifts = await db.shifts.toArray();
    const openingVal = parseFloat(newOpeningCashStr) || 0;
    const newShift: Shift = {
      id: (allShifts.length || 0) + 1,
      cashierId: currentUser.id,
      cashierName: currentUser.fullName,
      shiftName: currentUser.shiftSchedule || 'Shift Standar',
      startTime: new Date().toISOString(),
      openingCash: openingVal,
      expectedCash: openingVal,
      isClosed: false,
    };
    await db.shifts.add(newShift);
    onShiftClosed();
    onClose();
  };

  const handlePrintPastShift = (s: Shift) => {
    const data: ShiftReportPrintData = {
      shiftNumber: s.id,
      cashierName: s.cashierName,
      shiftName: s.shiftName,
      startTime: s.startTime,
      endTime: s.endTime || s.startTime,
      openingCash: s.openingCash || 0,
      closingCash: s.closingCash || s.expectedCash || 0,
      expectedCash: s.expectedCash || 0,
      discrepancy: s.discrepancy || 0,
      cashSales: s.totalCashSales || 0,
      nonCashSales: s.totalNonCashSales || 0,
      serviceCashSales: s.totalServiceSales || 0,
      cashIn: s.totalCashIn || 0,
      cashOut: s.totalCashOut || 0,
      txCount: s.txCount || 0,
      serviceCount: s.serviceCount || 0,
      note: s.note,
    };
    const text = generateShiftReportReceiptText(data, storeProfile);
    setReceiptPreviewText(text);
  };

  const startTimeStr = activeShift?.startTime
    ? new Date(activeShift.startTime).toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '-';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-xs p-3">
      <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-4 py-3 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-zinc-100">
                  Laporan Kas Hari Ini (07.00 - 16.30)
                </h2>
              </div>
              <span className="text-[11px] text-zinc-400">
                Mulai: {startTimeStr} • Kasir: <strong className="text-zinc-200">{activeShift?.cashierName}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Tab Switcher */}
            <div className="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 text-[11px] mr-1">
              <button
                type="button"
                onClick={() => setModalTab('current')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  modalTab === 'current'
                    ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Tutup Kas (16.30)
              </button>
              <button
                type="button"
                onClick={() => setModalTab('history')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  modalTab === 'history'
                    ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Riwayat Kas Harian ({pastShifts.length})
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
              title="Tutup dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Tab Body */}
        {modalTab === 'current' ? (
          !activeShift ? (
            <div className="p-8 text-center space-y-4 flex-1 flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
                <Clock className="w-7 h-7" />
              </div>
              <div className="max-w-md">
                <h3 className="text-base font-bold text-zinc-100">Tidak Ada Shift Kasir Aktif</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Shift kerja Anda saat ini sedang ditutup. Silakan tentukan modal kas awal di laci untuk membuka shift kasir baru.
                </p>
              </div>
              <div className="w-full max-w-xs space-y-3 text-left bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                    Kas Modal Awal Kasir (Rp):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="0"
                    value={newOpeningCashStr}
                    onChange={(e) => setNewOpeningCashStr(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-100 font-mono focus:border-emerald-500 outline-none"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    {formatRupiah(parseFloat(newOpeningCashStr) || 0)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleStartNewShift}
                  className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs transition shadow-lg flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Buka Shift Baru Sekarang</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
            {/* Ringkasan Kas Laci Grid */}
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                Rincian Arus Keuangan Shift Ini
              </span>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className="text-zinc-400 text-[10px] block">Modal Kas Awal:</span>
                  <span className="text-sm font-bold text-zinc-100 font-mono">
                    {formatRupiah(openingCash)}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className="text-zinc-400 text-[10px] block">Penjualan Tunai:</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">
                    +{formatRupiah(cashSalesTotal)}
                  </span>
                  <span className="text-[9px] text-zinc-500 block">{txCount} transaksi nota</span>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className="text-zinc-400 text-[10px] block">Penjualan Non-Tunai:</span>
                  <span className="text-sm font-bold text-sky-400 font-mono">
                    {formatRupiah(nonCashSalesTotal)}
                  </span>
                  <span className="text-[9px] text-zinc-500 block">QRIS / Transfer</span>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className="text-zinc-400 text-[10px] block">Servis Komputer:</span>
                  <span className="text-sm font-bold text-amber-400 font-mono">
                    +{formatRupiah(serviceCashTotal)}
                  </span>
                  <span className="text-[9px] text-zinc-500 block">{serviceCount} tiket selesai</span>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className="text-zinc-400 text-[10px] block">Kas Masuk (+):</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">
                    +{formatRupiah(cashInTotal)}
                  </span>
                  <span className="text-[9px] text-zinc-500 block">Manual petty cash</span>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className="text-zinc-400 text-[10px] block">Kas Keluar (-):</span>
                  <span className="text-sm font-bold text-rose-400 font-mono">
                    -{formatRupiah(cashOutTotal)}
                  </span>
                  <span className="text-[9px] text-zinc-500 block">Operasional / konsumsi</span>
                </div>
              </div>
            </div>

            {/* Expected Cash in Drawer */}
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-zinc-200 block">
                  Kas Seharusnya di Laci (Sistem):
                </span>
                <span className="text-[10px] text-zinc-400">
                  Kas Awal + Tunai + Servis Tunai + Kas Masuk - Kas Keluar
                </span>
              </div>
              <span className="text-base font-extrabold text-emerald-400 font-mono">
                {formatRupiah(expectedCash)}
              </span>
            </div>

            {/* Actual Cash Input */}
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1.5">
              <label className="block text-[11px] font-bold text-zinc-300">
                Hitung Fisik Uang Riil di Laci (Rekonsiliasi Kas):
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs text-zinc-500 font-bold">Rp</span>
                <input
                  type="number"
                  value={actualCashStr}
                  onChange={(e) => setActualCashStr(e.target.value)}
                  placeholder="Masukkan jumlah uang fisik di laci..."
                  className="w-full pl-9 pr-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm font-bold text-zinc-100 focus:outline-hidden focus:border-emerald-500 font-mono"
                />
              </div>

              {/* Discrepancy Status */}
              {actualCashStr !== '' && (
                <div
                  className={`px-3 py-1.5 rounded-md border flex items-center justify-between text-xs font-semibold ${
                    discrepancy === 0
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                      : discrepancy > 0
                      ? 'bg-sky-950/40 border-sky-800/60 text-sky-300'
                      : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                  }`}
                >
                  <span className="text-[11px]">Selisih Kas Laci:</span>
                  <span className="font-mono text-xs font-bold">
                    {discrepancy === 0
                      ? '● Pas (Seimbang Rp 0)'
                      : discrepancy > 0
                      ? `+${formatRupiah(discrepancy)} (Kas Berlebih)`
                      : `${formatRupiah(discrepancy)} (Kas Kurang / Minus)`}
                  </span>
                </div>
              )}
            </div>

            {/* Note */}
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                Catatan Penutupan Shift (Opsional)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Contoh: Uang koin 500an cukup, shift diserahterimakan ke kasir siang"
                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-hidden focus:border-zinc-600"
              />
            </div>

            {/* Actions Bar */}
            <div className="pt-2 border-t border-zinc-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handlePreviewReceipt}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs transition border border-zinc-700"
                title="Lihat & cetak struk tutup shift (Z-Report)"
              >
                <Printer className="w-3.5 h-3.5 text-zinc-400" />
                <span>Cetak Laporan Tutup Shift</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-semibold text-xs"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleCloseShift}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-xs"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Akhiri & Tutup Shift</span>
                </button>
              </div>
            </div>
          </div>
        )
      ) : (
          /* History Tab */
          <div className="p-4 overflow-y-auto flex-1 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-300">
                Riwayat Shift yang Telah Ditutup ({pastShifts.length})
              </span>
              <span className="text-[10px] text-zinc-500">
                Pilih shift untuk mencetak ulang laporan Z-Report
              </span>
            </div>

            {pastShifts.length === 0 ? (
              <div className="py-12 text-center text-zinc-500">
                Belum ada shift kerja yang ditutup sebelumnya.
              </div>
            ) : (
              <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-900 text-zinc-400 uppercase tracking-wider text-[10px] border-b border-zinc-800">
                    <tr>
                      <th className="px-3 py-2">Shift #</th>
                      <th className="px-3 py-2">Kasir</th>
                      <th className="px-3 py-2">Waktu Selesai</th>
                      <th className="px-3 py-2 text-right">Kas Awal</th>
                      <th className="px-3 py-2 text-right">Kas Fisik</th>
                      <th className="px-3 py-2 text-right">Selisih</th>
                      <th className="px-3 py-2 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850">
                    {pastShifts.map((s) => (
                      <tr key={s.id} className="hover:bg-zinc-900/60 transition">
                        <td className="px-3 py-2 font-mono font-bold text-zinc-200">#{s.id}</td>
                        <td className="px-3 py-2 text-zinc-300">{s.cashierName}</td>
                        <td className="px-3 py-2 text-zinc-400">
                          {s.endTime ? new Date(s.endTime).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-zinc-400">
                          {formatRupiah(s.openingCash || 0)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-zinc-200">
                          {formatRupiah(s.closingCash || s.expectedCash || 0)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {s.discrepancy === undefined || s.discrepancy === 0 ? (
                            <span className="text-emerald-400 text-[11px]">Pas (Rp 0)</span>
                          ) : s.discrepancy > 0 ? (
                            <span className="text-sky-400 text-[11px]">+{formatRupiah(s.discrepancy)}</span>
                          ) : (
                            <span className="text-rose-400 text-[11px]">{formatRupiah(s.discrepancy)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => handlePrintPastShift(s)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-semibold border border-zinc-700"
                            title="Cetak ulang struk shift"
                          >
                            <Printer className="w-3 h-3 text-zinc-400" />
                            <span>Struk</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Thermal Receipt Print Preview Dialog */}
      {receiptPreviewText && (
        <div className="fixed inset-0 z-60 bg-zinc-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-3.5 py-2.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-zinc-200">Preview Struk Tutup Shift</span>
              </div>
              <button
                onClick={() => setReceiptPreviewText(null)}
                className="p-1 rounded text-zinc-400 hover:text-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-zinc-950 overflow-y-auto flex-1 font-mono text-[11px] text-zinc-300 whitespace-pre leading-relaxed select-text border-y border-zinc-800">
              {receiptPreviewText}
            </div>

            <div className="p-2.5 bg-zinc-900 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleCopyReceipt}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-semibold"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{isCopied ? 'Tersalin!' : 'Salin Teks'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReceiptPreviewText(null)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-xs"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={handlePrintSilent}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Struk</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
