import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Search,
  Printer,
  Calendar,
  CreditCard,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  FileSpreadsheet,
  Wrench,
  ArrowDownUp,
  Clock,
  Filter,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
} from 'lucide-react';
import {
  Transaction,
  StoreProfile,
  ServiceOrder,
  CashFlow,
  Shift,
} from '../../types/pos';
import { formatRupiah } from '../../services/cartCalculator';
import { db } from '../../services/storage';
import { ReceiptModal } from '../POS/ReceiptModal';
import {
  exportTransactionsToExcel,
  exportMonthlyFinancialRecapToExcel,
  DailyBreakdownRow,
  MonthlyRecapExportData,
} from '../../services/excelExport';
import {
  generateShiftReportReceiptText,
  ShiftReportPrintData,
} from '../../services/printer';

interface TransactionHistoryProps {
  storeProfile: StoreProfile;
}

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({ storeProfile }) => {
  const [activeSubTab, setActiveSubTab] = useState<'sales' | 'daily' | 'monthly' | 'shifts'>('sales');

  // Master Data State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [cashFlows, setCashFlows] = useState<CashFlow[]>([]);
  const [closedShifts, setClosedShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filter Sales state
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | '7days' | 'this_month'>('all');
  const [selectedTxForReceipt, setSelectedTxForReceipt] = useState<Transaction | null>(null);

  // Daily Recap state
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  // Monthly Recap state (Per Tanggal 1 s/d Akhir Bulan)
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  // Shift Receipt preview modal
  const [shiftReceiptPreviewText, setShiftReceiptPreviewText] = useState<string | null>(null);

  // Load all necessary records
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [txs, services, flows, shifts] = await Promise.all([
        db.transactions.reverse().sortBy('createdAt'),
        db.serviceOrders.toArray(),
        db.cashFlows.toArray(),
        db.shifts.toArray(),
      ]);
      setTransactions(txs);
      setServiceOrders(services);
      setCashFlows(flows);
      setClosedShifts(shifts.filter((s) => s.isClosed).sort((a, b) => b.id - a.id));
    } catch (err) {
      console.error('Failed to load transaction & financial history', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered sales transactions
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return transactions.filter((tx) => {
      // Period filter
      const txDate = new Date(tx.createdAt);
      if (periodFilter === 'today') {
        if (tx.createdAt.slice(0, 10) !== todayStr) return false;
      } else if (periodFilter === '7days') {
        if (txDate < sevenDaysAgo) return false;
      } else if (periodFilter === 'this_month') {
        if (txDate.getFullYear() !== currentYear || txDate.getMonth() !== currentMonth) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesInvoice = tx.invoiceNumber.toLowerCase().includes(q);
        const matchesCashier = tx.cashierName?.toLowerCase().includes(q);
        const matchesCustomer = tx.customerName && tx.customerName.toLowerCase().includes(q);
        const matchesPayment = tx.paymentMethod?.toLowerCase().includes(q);
        if (!matchesInvoice && !matchesCashier && !matchesCustomer && !matchesPayment) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, periodFilter, searchQuery]);

  // Overall Financial summary of current filtered sales
  const salesSummary = useMemo(() => {
    const totalRev = filteredTransactions.reduce((sum, t) => sum + t.grandTotal, 0);
    const count = filteredTransactions.length;
    const avg = count > 0 ? Math.round(totalRev / count) : 0;
    const cashTotal = filteredTransactions
      .filter((t) => t.paymentMethod === 'CASH')
      .reduce((sum, t) => sum + t.grandTotal, 0);
    const nonCashTotal = totalRev - cashTotal;
    return { totalRev, count, avg, cashTotal, nonCashTotal };
  }, [filteredTransactions]);

  // Daily Recap Calculation
  const dailyRecap = useMemo(() => {
    const targetDateStr = selectedDailyDate;

    // 1. Penjualan POS di hari tersebut
    const dayTxs = transactions.filter((t) => t.createdAt.slice(0, 10) === targetDateStr);
    const productRevenue = dayTxs.reduce((sum, t) => sum + t.grandTotal, 0);
    const productCost = dayTxs.reduce(
      (sum, t) =>
        sum + (t.items?.reduce((isum, item) => isum + (item.buyPrice || 0) * item.quantity, 0) || 0),
      0
    );
    const productGrossProfit = productRevenue - productCost;

    // 2. Servis Selesai/Diambil di hari tersebut
    const dayServices = serviceOrders.filter((s) => {
      const finishDate = s.completedAt || s.pickedUpAt || s.updatedAt || s.createdAt;
      return finishDate.slice(0, 10) === targetDateStr && s.paidAmount > 0;
    });
    const serviceRevenue = dayServices.reduce((sum, s) => sum + (s.paidAmount || s.grandTotal), 0);
    const servicePartsCost = dayServices.reduce((sum, s) => sum + (s.totalPartsCost || 0), 0);
    const serviceGrossProfit = Math.max(0, serviceRevenue - servicePartsCost);

    // 3. Arus Kas (Uang Masuk / Keluar Operasional)
    const dayFlows = cashFlows.filter((f) => f.createdAt.slice(0, 10) === targetDateStr);
    const cashIn = dayFlows.filter((f) => f.type === 'IN').reduce((sum, f) => sum + f.amount, 0);
    const cashOut = dayFlows.filter((f) => f.type === 'OUT').reduce((sum, f) => sum + f.amount, 0);

    // Totals
    const totalRevenue = productRevenue + serviceRevenue;
    const totalGrossProfit = productGrossProfit + serviceGrossProfit;
    const netProfit = totalGrossProfit - cashOut;

    // Breakdown Pembayaran
    const cashFromPOS = dayTxs
      .filter((t) => t.paymentMethod === 'CASH')
      .reduce((sum, t) => sum + t.grandTotal, 0);
    const nonCashFromPOS = productRevenue - cashFromPOS;
    const cashFromService = dayServices
      .filter((s) => s.paymentMethod === 'CASH')
      .reduce((sum, s) => sum + (s.paidAmount || s.grandTotal), 0);
    const nonCashFromService = serviceRevenue - cashFromService;

    return {
      dateStr: targetDateStr,
      dayTxs,
      dayServices,
      dayFlows,
      productRevenue,
      productCost,
      productGrossProfit,
      serviceRevenue,
      servicePartsCost,
      serviceGrossProfit,
      totalRevenue,
      totalGrossProfit,
      cashIn,
      cashOut,
      netProfit,
      totalCash: cashFromPOS + cashFromService,
      totalNonCash: nonCashFromPOS + nonCashFromService,
    };
  }, [transactions, serviceOrders, cashFlows, selectedDailyDate]);

  // Monthly Recap Calculation (Per Tanggal 1 s/d Akhir Bulan)
  const monthlyRecap = useMemo(() => {
    const year = selectedYear;
    const month = selectedMonth;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const dailyRows: DailyBreakdownRow[] = [];

    let totalProductSales = 0;
    let totalServiceSales = 0;
    let totalProductCost = 0;
    let totalServiceCost = 0;
    let totalCashIn = 0;
    let totalCashOut = 0;
    let totalCashPayments = 0;
    let totalNonCashPayments = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dObj = new Date(year, month, day);
      const dayName = DAY_NAMES[dObj.getDay()];

      // POS Txs on that date
      const dTxs = transactions.filter((t) => t.createdAt.slice(0, 10) === dStr);
      const pSales = dTxs.reduce((sum, t) => sum + t.grandTotal, 0);
      const pCost = dTxs.reduce(
        (sum, t) =>
          sum + (t.items?.reduce((isum, item) => isum + (item.buyPrice || 0) * item.quantity, 0) || 0),
        0
      );

      // Services on that date
      const dServices = serviceOrders.filter((s) => {
        const finishDate = s.completedAt || s.pickedUpAt || s.updatedAt || s.createdAt;
        return finishDate.slice(0, 10) === dStr && s.paidAmount > 0;
      });
      const sSales = dServices.reduce((sum, s) => sum + (s.paidAmount || s.grandTotal), 0);
      const sCost = dServices.reduce((sum, s) => sum + (s.totalPartsCost || 0), 0);

      // Cash Flows on that date
      const dFlows = cashFlows.filter((f) => f.createdAt.slice(0, 10) === dStr);
      const cIn = dFlows.filter((f) => f.type === 'IN').reduce((sum, f) => sum + f.amount, 0);
      const cOut = dFlows.filter((f) => f.type === 'OUT').reduce((sum, f) => sum + f.amount, 0);

      const dayTotalRev = pSales + sSales;
      const dayGrossProfit = Math.max(0, pSales - pCost) + Math.max(0, sSales - sCost);
      const dayNetProfit = dayGrossProfit - cOut;

      // Payments
      const cashP = dTxs
        .filter((t) => t.paymentMethod === 'CASH')
        .reduce((sum, t) => sum + t.grandTotal, 0);
      const nonCashP = pSales - cashP;
      const cashS = dServices
        .filter((s) => s.paymentMethod === 'CASH')
        .reduce((sum, s) => sum + (s.paidAmount || s.grandTotal), 0);
      const nonCashS = sSales - cashS;

      totalProductSales += pSales;
      totalServiceSales += sSales;
      totalProductCost += pCost;
      totalServiceCost += sCost;
      totalCashIn += cIn;
      totalCashOut += cOut;
      totalCashPayments += cashP + cashS;
      totalNonCashPayments += nonCashP + nonCashS;

      dailyRows.push({
        dateStr: dStr,
        dayNumber: day,
        dayName,
        txCount: dTxs.length,
        serviceCount: dServices.length,
        productSales: pSales,
        serviceSales: sSales,
        totalRevenue: dayTotalRev,
        productCost: pCost,
        serviceCost: sCost,
        grossProfit: dayGrossProfit,
        cashIn: cIn,
        cashOut: cOut,
        netProfit: dayNetProfit,
      });
    }

    const grandRevenue = totalProductSales + totalServiceSales;
    const totalGrossProfit =
      Math.max(0, totalProductSales - totalProductCost) +
      Math.max(0, totalServiceSales - totalServiceCost);
    const netProfit = totalGrossProfit - totalCashOut;

    return {
      monthName: MONTH_NAMES[month],
      year,
      totalProductSales,
      totalServiceSales,
      grandRevenue,
      totalProductCost,
      totalServiceCost,
      totalGrossProfit,
      totalOperationalExpenses: totalCashOut,
      netProfit,
      totalCashPayments,
      totalNonCashPayments,
      dailyRows,
    };
  }, [transactions, serviceOrders, cashFlows, selectedMonth, selectedYear]);

  const handleExportMonthly = () => {
    const exportData: MonthlyRecapExportData = {
      ...monthlyRecap,
      storeName: storeProfile.storeName,
    };
    exportMonthlyFinancialRecapToExcel(exportData);
  };

  const handlePrintPastShiftZReport = (s: Shift) => {
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
    setShiftReceiptPreviewText(text);
  };

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden select-none text-zinc-100">
      {/* Top Navigation & Sub-Tabs Bar */}
      <div className="px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-zinc-100 leading-tight">
              Menu Transaksi & Rekap Keuangan
            </h1>
            <span className="text-[10px] text-zinc-400">
              Riwayat penjualan, pembukuan harian, dan evaluasi bulanan tanggal 1
            </span>
          </div>
        </div>

        {/* 4 Professional Sub-Tabs */}
        <div className="flex items-center bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('sales')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
              activeSubTab === 'sales'
                ? 'bg-zinc-800 text-zinc-100 shadow-xs border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
            <span>1. Riwayat Transaksi</span>
          </button>

          <button
            onClick={() => setActiveSubTab('daily')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
              activeSubTab === 'daily'
                ? 'bg-zinc-800 text-zinc-100 shadow-xs border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-sky-400" />
            <span>2. Rekap Harian</span>
          </button>

          <button
            onClick={() => setActiveSubTab('monthly')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
              activeSubTab === 'monthly'
                ? 'bg-zinc-800 text-zinc-100 shadow-xs border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>3. Rekap Bulanan (Tgl 1)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('shifts')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
              activeSubTab === 'shifts'
                ? 'bg-zinc-800 text-zinc-100 shadow-xs border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>4. Laporan Shift</span>
          </button>
        </div>
      </div>

      {/* ================= VIEW 1: TRANSAKSI PENJUALAN ================= */}
      {activeSubTab === 'sales' && (
        <div className="flex-1 flex flex-col p-3 overflow-hidden space-y-2.5">
          {/* Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Total Omzet Penjualan:</span>
              <span className="text-base font-extrabold text-zinc-100 font-mono mt-0.5 block">
                {formatRupiah(salesSummary.totalRev)}
              </span>
              <span className="text-[9px] text-zinc-500 block">
                {salesSummary.count} nota transaksi
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Penerimaan Tunai (Cash):</span>
              <span className="text-base font-extrabold text-emerald-400 font-mono mt-0.5 block">
                {formatRupiah(salesSummary.cashTotal)}
              </span>
              <span className="text-[9px] text-zinc-500 block">Uang masuk laci kasir</span>
            </div>

            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Non-Tunai (QRIS/Transfer):</span>
              <span className="text-base font-extrabold text-sky-400 font-mono mt-0.5 block">
                {formatRupiah(salesSummary.nonCashTotal)}
              </span>
              <span className="text-[9px] text-zinc-500 block">Rekening & dompet digital</span>
            </div>

            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Rata-rata Nota Belanja:</span>
              <span className="text-base font-extrabold text-zinc-100 font-mono mt-0.5 block">
                {formatRupiah(salesSummary.avg)}
              </span>
              <span className="text-[9px] text-zinc-500 block">Basket size per transaksi</span>
            </div>
          </div>

          {/* Search & Quick Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 flex-1 max-w-lg">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari faktur, kasir, pelanggan, metode bayar..."
                  className="w-full pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
                />
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2" />
              </div>

              {/* Quick Period Filter Buttons */}
              <div className="flex items-center bg-zinc-900 rounded-lg border border-zinc-800 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPeriodFilter('all')}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition ${
                    periodFilter === 'all'
                      ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodFilter('today')}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition ${
                    periodFilter === 'today'
                      ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodFilter('7days')}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition ${
                    periodFilter === '7days'
                      ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  7 Hari
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodFilter('this_month')}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition ${
                    periodFilter === 'this_month'
                      ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Bulan Ini
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">
                Menampilkan: <strong className="text-zinc-200">{filteredTransactions.length}</strong> transaksi
              </span>

              <button
                onClick={() => exportTransactionsToExcel(filteredTransactions, storeProfile.storeName)}
                disabled={filteredTransactions.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition shadow-xs"
                title="Export transaksi yang sedang difilter ke file Excel (.csv)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex flex-col shadow-xs">
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 text-zinc-400 uppercase tracking-wider text-[10px] sticky top-0 z-10 border-b border-zinc-800">
                  <tr>
                    <th className="px-3 py-2 font-semibold">No. Faktur</th>
                    <th className="px-3 py-2 font-semibold">Waktu</th>
                    <th className="px-3 py-2 font-semibold">Pelanggan</th>
                    <th className="px-3 py-2 font-semibold">Kasir</th>
                    <th className="px-3 py-2 font-semibold">Item Belanja</th>
                    <th className="px-3 py-2 font-semibold">Metode Bayar</th>
                    <th className="px-3 py-2 text-right font-semibold">Total</th>
                    <th className="px-3 py-2 text-center font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-zinc-500">
                        Tidak ada transaksi penjualan yang cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-zinc-800/40 transition">
                        <td className="px-3 py-2">
                          <span className="font-mono text-xs font-semibold text-zinc-200">
                            {tx.invoiceNumber}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-zinc-400">
                          {new Date(tx.createdAt).toLocaleString('id-ID', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="px-3 py-2 text-zinc-300 font-medium">
                          {tx.customerName || <span className="text-zinc-500 italic">Pelanggan Umum</span>}
                        </td>
                        <td className="px-3 py-2 text-zinc-300">{tx.cashierName}</td>
                        <td className="px-3 py-2 text-zinc-400">
                          {tx.items?.length || 0} item ({tx.items?.reduce((s, i) => s + i.quantity, 0) || 0} pcs)
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                              tx.paymentMethod === 'CASH'
                                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                                : tx.paymentMethod === 'QRIS'
                                ? 'bg-sky-950/40 border-sky-800/60 text-sky-300'
                                : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                            }`}
                          >
                            {tx.paymentMethod}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-zinc-100 font-mono">
                          {formatRupiah(tx.grandTotal)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => setSelectedTxForReceipt(tx)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-[11px] font-medium transition"
                            title="Cetak Ulang Struk Nota"
                          >
                            <Printer className="w-3 h-3 text-zinc-400" />
                            <span>Struk</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= VIEW 2: REKAP HARIAN ================= */}
      {activeSubTab === 'daily' && (
        <div className="flex-1 flex flex-col p-3 overflow-hidden space-y-2.5">
          {/* Date Selector Banner */}
          <div className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold text-zinc-200">Pilih Tanggal Rekap Harian:</span>
              <input
                type="date"
                value={selectedDailyDate}
                onChange={(e) => setSelectedDailyDate(e.target.value)}
                className="px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-100 focus:outline-hidden focus:border-sky-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setSelectedDailyDate(new Date().toISOString().slice(0, 10))}
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-semibold"
              >
                Hari Ini
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400">
                Omzet Total:{' '}
                <strong className="text-emerald-400 font-mono font-bold">
                  {formatRupiah(dailyRecap.totalRevenue)}
                </strong>
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-400">
                Laba Bersih:{' '}
                <strong
                  className={`font-mono font-bold ${
                    dailyRecap.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatRupiah(dailyRecap.netProfit)}
                </strong>
              </span>
            </div>
          </div>

          {/* Daily Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Omzet Produk (Retail):</span>
              <span className="text-sm font-bold text-zinc-100 font-mono mt-0.5 block">
                {formatRupiah(dailyRecap.productRevenue)}
              </span>
              <span className="text-[9px] text-zinc-500 block">
                Modal: {formatRupiah(dailyRecap.productCost)} • Laba: {formatRupiah(dailyRecap.productGrossProfit)}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Omzet Servis Komputer:</span>
              <span className="text-sm font-bold text-amber-400 font-mono mt-0.5 block">
                {formatRupiah(dailyRecap.serviceRevenue)}
              </span>
              <span className="text-[9px] text-zinc-500 block">
                {dailyRecap.dayServices.length} unit • Biaya Part: {formatRupiah(dailyRecap.servicePartsCost)}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Kas Masuk & Keluar Toko:</span>
              <div className="flex items-center gap-2 mt-0.5 font-mono text-xs font-bold">
                <span className="text-emerald-400">+{formatRupiah(dailyRecap.cashIn)}</span>
                <span className="text-zinc-600">/</span>
                <span className="text-rose-400">-{formatRupiah(dailyRecap.cashOut)}</span>
              </div>
              <span className="text-[9px] text-zinc-500 block">Uang operasional / petty cash</span>
            </div>

            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Metode Penerimaan:</span>
              <div className="text-[11px] font-mono mt-0.5 text-zinc-300">
                Tunai: <strong className="text-emerald-400">{formatRupiah(dailyRecap.totalCash)}</strong>
              </div>
              <div className="text-[10px] font-mono text-zinc-400">
                Non-Tunai: <strong className="text-sky-400">{formatRupiah(dailyRecap.totalNonCash)}</strong>
              </div>
            </div>
          </div>

          {/* Daily Table of Events */}
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex flex-col">
            <div className="px-3 py-2 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between text-xs">
              <span className="font-bold text-zinc-200">
                Daftar Transaksi Tanggal {selectedDailyDate} ({dailyRecap.dayTxs.length} Nota POS, {dailyRecap.dayServices.length} Servis)
              </span>
              <button
                onClick={() => exportTransactionsToExcel(dailyRecap.dayTxs, `${storeProfile.storeName}_Harian_${selectedDailyDate}`)}
                disabled={dailyRecap.dayTxs.length === 0}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 text-[11px] font-semibold border border-zinc-700"
              >
                <FileSpreadsheet className="w-3 h-3 text-emerald-400" />
                <span>Export Harian</span>
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 text-zinc-400 uppercase tracking-wider text-[10px] border-b border-zinc-800">
                  <tr>
                    <th className="px-3 py-1.5">Waktu</th>
                    <th className="px-3 py-1.5">Tipe</th>
                    <th className="px-3 py-1.5">No. Referensi</th>
                    <th className="px-3 py-1.5">Keterangan / Pelanggan</th>
                    <th className="px-3 py-1.5">Metode Bayar</th>
                    <th className="px-3 py-1.5 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {dailyRecap.dayTxs.length === 0 && dailyRecap.dayServices.length === 0 && dailyRecap.dayFlows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-zinc-500">
                        Tidak ada transaksi atau mutasi keuangan pada tanggal {selectedDailyDate}.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {/* POS Txs */}
                      {dailyRecap.dayTxs.map((t) => (
                        <tr key={`pos-${t.id}`} className="hover:bg-zinc-800/40">
                          <td className="px-3 py-1.5 font-mono text-zinc-400">
                            {new Date(t.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              POS
                            </span>
                          </td>
                          <td className="px-3 py-1.5 font-mono font-semibold text-zinc-200">{t.invoiceNumber}</td>
                          <td className="px-3 py-1.5 text-zinc-300">
                            {t.customerName || 'Pelanggan Umum'} ({t.items?.length || 0} item)
                          </td>
                          <td className="px-3 py-1.5 text-zinc-400">{t.paymentMethod}</td>
                          <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-400">
                            {formatRupiah(t.grandTotal)}
                          </td>
                        </tr>
                      ))}

                      {/* Services */}
                      {dailyRecap.dayServices.map((s) => (
                        <tr key={`srv-${s.id}`} className="hover:bg-zinc-800/40">
                          <td className="px-3 py-1.5 font-mono text-zinc-400">
                            {new Date(s.updatedAt || s.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              SERVIS
                            </span>
                          </td>
                          <td className="px-3 py-1.5 font-mono font-semibold text-zinc-200">{s.ticketNumber}</td>
                          <td className="px-3 py-1.5 text-zinc-300">
                            {s.customerName} - {s.deviceType} ({s.complaint})
                          </td>
                          <td className="px-3 py-1.5 text-zinc-400">{s.paymentMethod || 'CASH'}</td>
                          <td className="px-3 py-1.5 text-right font-mono font-bold text-amber-400">
                            {formatRupiah(s.paidAmount || s.grandTotal)}
                          </td>
                        </tr>
                      ))}

                      {/* Cash Flows */}
                      {dailyRecap.dayFlows.map((f) => (
                        <tr key={`flow-${f.id}`} className="hover:bg-zinc-800/40">
                          <td className="px-3 py-1.5 font-mono text-zinc-400">
                            {new Date(f.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-3 py-1.5">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                f.type === 'IN'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              KAS {f.type}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-zinc-400 font-mono">{f.category}</td>
                          <td className="px-3 py-1.5 text-zinc-300">{f.note || '-'}</td>
                          <td className="px-3 py-1.5 text-zinc-500">Tunai Laci</td>
                          <td
                            className={`px-3 py-1.5 text-right font-mono font-bold ${
                              f.type === 'IN' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {f.type === 'IN' ? `+${formatRupiah(f.amount)}` : `-${formatRupiah(f.amount)}`}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= VIEW 3: REKAP BULANAN (PER TANGGAL 1 S/D AKHIR BULAN) ================= */}
      {activeSubTab === 'monthly' && (
        <div className="flex-1 flex flex-col p-3 overflow-hidden space-y-2.5">
          {/* Month & Year Filter Bar */}
          <div className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-zinc-200">
                Rekap Keuangan Bulanan (Periode 1 s/d Akhir Bulan):
              </span>

              {/* Month Selector */}
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-100 focus:outline-hidden focus:border-emerald-500 font-semibold"
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>

              {/* Year Selector */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-100 focus:outline-hidden focus:border-emerald-500 font-semibold"
              >
                {[selectedYear - 1, selectedYear, selectedYear + 1].map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportMonthly}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-xs"
                title="Export rekap bulanan tanggal 1 s/d akhir bulan ke format Excel (.csv)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export Excel Bulanan</span>
              </button>

              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition border border-zinc-700"
                title="Cetak ringkasan laporan bulanan"
              >
                <Printer className="w-3.5 h-3.5 text-zinc-400" />
                <span>Cetak Rekap</span>
              </button>
            </div>
          </div>

          {/* 8 Complete Financial Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
            {/* 1. Omzet Produk */}
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Total Omzet Penjualan Produk:</span>
              <span className="text-sm font-extrabold text-zinc-100 font-mono mt-0.5 block">
                {formatRupiah(monthlyRecap.totalProductSales)}
              </span>
              <span className="text-[9px] text-zinc-500 block">
                HPP: {formatRupiah(monthlyRecap.totalProductCost)}
              </span>
            </div>

            {/* 2. Omzet Servis */}
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Total Omzet Servis Komputer:</span>
              <span className="text-sm font-extrabold text-amber-400 font-mono mt-0.5 block">
                {formatRupiah(monthlyRecap.totalServiceSales)}
              </span>
              <span className="text-[9px] text-zinc-500 block">
                Biaya Part: {formatRupiah(monthlyRecap.totalServiceCost)}
              </span>
            </div>

            {/* 3. Total Omzet Kotor Toko */}
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">TOTAL OMZET KOTOR TOKO:</span>
              <span className="text-base font-black text-emerald-400 font-mono mt-0.5 block">
                {formatRupiah(monthlyRecap.grandRevenue)}
              </span>
              <span className="text-[9px] text-zinc-500 block">Produk + Jasa Servis</span>
            </div>

            {/* 4. Estimasi Laba Kotor */}
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Total Estimasi Laba Kotor:</span>
              <span className="text-sm font-extrabold text-zinc-100 font-mono mt-0.5 block">
                {formatRupiah(monthlyRecap.totalGrossProfit)}
              </span>
              <span className="text-[9px] text-zinc-500 block">Sebelum dikurangi operasional</span>
            </div>

            {/* 5. Biaya Operasional Toko */}
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Beban Pengeluaran Operasional:</span>
              <span className="text-sm font-extrabold text-rose-400 font-mono mt-0.5 block">
                -{formatRupiah(monthlyRecap.totalOperationalExpenses)}
              </span>
              <span className="text-[9px] text-zinc-500 block">Petty cash, konsumsi, listrik</span>
            </div>

            {/* 6. Estimasi Laba Bersih Toko */}
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">ESTIMASI LABA BERSIH TOKO:</span>
              <span
                className={`text-base font-black font-mono mt-0.5 block ${
                  monthlyRecap.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatRupiah(monthlyRecap.netProfit)}
              </span>
              <span className="text-[9px] text-zinc-500 block">Laba kotor - pengeluaran</span>
            </div>

            {/* 7. Penerimaan Tunai */}
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Penerimaan Tunai (Cash):</span>
              <span className="text-sm font-bold text-zinc-100 font-mono mt-0.5 block">
                {formatRupiah(monthlyRecap.totalCashPayments)}
              </span>
              <span className="text-[9px] text-zinc-500 block">Uang masuk fisik laci</span>
            </div>

            {/* 8. Penerimaan Non-Tunai */}
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Penerimaan Non-Tunai:</span>
              <span className="text-sm font-bold text-sky-400 font-mono mt-0.5 block">
                {formatRupiah(monthlyRecap.totalNonCashPayments)}
              </span>
              <span className="text-[9px] text-zinc-500 block">QRIS / EDC / Transfer</span>
            </div>
          </div>

          {/* Daily Table Breakdown from Day 1 to End of Month */}
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex flex-col shadow-xs">
            <div className="px-3 py-2 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between text-xs">
              <span className="font-bold text-zinc-200">
                Tabel Rekapitulasi Harian (Tanggal 1 s/d Akhir Bulan {monthlyRecap.monthName} {monthlyRecap.year})
              </span>
              <span className="text-[10px] text-zinc-400">
                {monthlyRecap.dailyRows.filter((r) => r.totalRevenue > 0 || r.cashOut > 0).length} hari aktif bertransaksi
              </span>
            </div>

            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 text-zinc-400 uppercase tracking-wider text-[10px] sticky top-0 z-10 border-b border-zinc-800">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Tgl</th>
                    <th className="px-3 py-2 font-semibold">Hari</th>
                    <th className="px-3 py-2 text-center font-semibold">Nota POS</th>
                    <th className="px-3 py-2 text-center font-semibold">Servis</th>
                    <th className="px-3 py-2 text-right font-semibold">Omzet Produk</th>
                    <th className="px-3 py-2 text-right font-semibold">Omzet Servis</th>
                    <th className="px-3 py-2 text-right font-semibold">Total Omzet</th>
                    <th className="px-3 py-2 text-right font-semibold">Kas Keluar</th>
                    <th className="px-3 py-2 text-right font-semibold">Laba Bersih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {monthlyRecap.dailyRows.map((row) => (
                    <tr
                      key={row.dateStr}
                      className={`hover:bg-zinc-800/40 transition ${
                        row.totalRevenue > 0 ? 'bg-zinc-900/40' : 'opacity-60'
                      }`}
                    >
                      <td className="px-3 py-1.5 font-mono font-bold text-zinc-200">
                        Tgl {row.dayNumber}
                      </td>
                      <td className="px-3 py-1.5 text-zinc-400">{row.dayName}</td>
                      <td className="px-3 py-1.5 text-center text-zinc-300 font-mono">
                        {row.txCount > 0 ? row.txCount : '-'}
                      </td>
                      <td className="px-3 py-1.5 text-center text-zinc-300 font-mono">
                        {row.serviceCount > 0 ? row.serviceCount : '-'}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-zinc-300">
                        {row.productSales > 0 ? formatRupiah(row.productSales) : '-'}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-amber-400">
                        {row.serviceSales > 0 ? formatRupiah(row.serviceSales) : '-'}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold text-zinc-100">
                        {row.totalRevenue > 0 ? formatRupiah(row.totalRevenue) : '-'}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-rose-400">
                        {row.cashOut > 0 ? `-${formatRupiah(row.cashOut)}` : '-'}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold">
                        {row.totalRevenue > 0 || row.cashOut > 0 ? (
                          <span className={row.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {formatRupiah(row.netProfit)}
                          </span>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= VIEW 4: RIWAYAT LAPORAN SHIFT ================= */}
      {activeSubTab === 'shifts' && (
        <div className="flex-1 flex flex-col p-3 overflow-hidden space-y-2.5">
          <div className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-between text-xs shrink-0">
            <div>
              <span className="font-bold text-zinc-200 block">
                Arsip & Riwayat Laporan Penutupan Shift Kasir (Z-Reports)
              </span>
              <span className="text-[10px] text-zinc-400">
                Pilih shift untuk mencetak ulang struk laporan rekonsiliasi kas
              </span>
            </div>
            <span className="text-zinc-400 text-xs">
              Total Shift Selesai: <strong className="text-zinc-200">{closedShifts.length}</strong>
            </span>
          </div>

          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex flex-col shadow-xs">
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 text-zinc-400 uppercase tracking-wider text-[10px] sticky top-0 z-10 border-b border-zinc-800">
                  <tr>
                    <th className="px-3 py-2 font-semibold">No. Shift</th>
                    <th className="px-3 py-2 font-semibold">Kasir</th>
                    <th className="px-3 py-2 font-semibold">Waktu Buka</th>
                    <th className="px-3 py-2 font-semibold">Waktu Tutup</th>
                    <th className="px-3 py-2 text-right font-semibold">Kas Awal</th>
                    <th className="px-3 py-2 text-right font-semibold">Kas Fisik Laci</th>
                    <th className="px-3 py-2 text-right font-semibold">Ekspektasi</th>
                    <th className="px-3 py-2 text-right font-semibold">Selisih</th>
                    <th className="px-3 py-2 text-center font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {closedShifts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-zinc-500">
                        Belum ada riwayat shift yang ditutup.
                      </td>
                    </tr>
                  ) : (
                    closedShifts.map((s) => (
                      <tr key={s.id} className="hover:bg-zinc-800/40 transition">
                        <td className="px-3 py-2 font-mono font-bold text-zinc-200">
                          #{s.id}
                        </td>
                        <td className="px-3 py-2 text-zinc-300 font-medium">{s.cashierName}</td>
                        <td className="px-3 py-2 text-zinc-400">
                          {new Date(s.startTime).toLocaleString('id-ID', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="px-3 py-2 text-zinc-400">
                          {s.endTime
                            ? new Date(s.endTime).toLocaleString('id-ID', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : '-'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-zinc-300">
                          {formatRupiah(s.openingCash || 0)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-zinc-100">
                          {formatRupiah(s.closingCash || s.expectedCash || 0)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-zinc-400">
                          {formatRupiah(s.expectedCash || 0)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold">
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
                            onClick={() => handlePrintPastShiftZReport(s)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-[11px] font-semibold border border-zinc-700"
                            title="Cetak ulang struk Z-Report shift"
                          >
                            <Printer className="w-3 h-3 text-zinc-400" />
                            <span>Cetak Z-Report</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Regular Sales Receipt Modal */}
      {selectedTxForReceipt && (
        <ReceiptModal
          transaction={selectedTxForReceipt}
          storeProfile={storeProfile}
          onClose={() => setSelectedTxForReceipt(null)}
        />
      )}

      {/* Shift Z-Report Thermal Preview Modal */}
      {shiftReceiptPreviewText && (
        <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-3.5 py-2.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-zinc-200">Struk Laporan Shift (Z-Report)</span>
              </div>
              <button
                onClick={() => setShiftReceiptPreviewText(null)}
                className="p-1 rounded text-zinc-400 hover:text-zinc-100"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-zinc-950 overflow-y-auto flex-1 font-mono text-[11px] text-zinc-300 whitespace-pre leading-relaxed select-text border-y border-zinc-800">
              {shiftReceiptPreviewText}
            </div>

            <div className="p-2.5 bg-zinc-900 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(shiftReceiptPreviewText);
                  alert('Teks laporan shift berhasil disalin ke clipboard!');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-semibold"
              >
                Salin Teks
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShiftReceiptPreviewText(null)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-xs"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
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
