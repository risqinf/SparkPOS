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
  Clock,
  Filter,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  Building2,
  Banknote,
  RotateCcw,
  Sparkles,
  ArrowDownUp,
  X,
  Package,
} from 'lucide-react';
import {
  Transaction,
  StoreProfile,
  ServiceOrder,
  CashFlow,
  DailyCashRegister,
  Employee,
} from '../../types/pos';
import { formatRupiah } from '../../services/cartCalculator';
import { db, getTodayCashRegister } from '../../services/storage';
import { ReceiptModal } from '../POS/ReceiptModal';
import { ServiceReceiptModal } from '../Service/ServiceReceiptModal';
import {
  exportUnifiedFinancialReportToExcel,
  UnifiedExportTransaction,
  UnifiedFinancialExportData,
} from '../../services/excelExport';
import {
  getLocalDateString,
  toLocalDateString,
  formatLocalDateTime,
  formatLocalDateOnly,
} from '../../services/dateUtils';

interface TransactionHistoryProps {
  storeProfile: StoreProfile;
  currentUser?: Employee | null;
}

export interface UnifiedTransactionRecord {
  id: string; // e.g. "pos-12" or "srv-34"
  rawId: number;
  type: 'POS' | 'SERVICE';
  invoiceNumber: string;
  createdAt: string;
  localDate: string;
  cashierName: string;
  cashierId: number;
  customerName: string;
  paymentMethod: string;
  grandTotal: number;
  totalCost: number;
  grossProfit: number;
  items: Array<{
    name: string;
    quantity: number;
    sellPrice: number;
    buyPrice: number;
    subtotal: number;
    margin: number;
  }>;
  originalPosTx?: Transaction;
  originalServiceOrder?: ServiceOrder;
}

type PeriodFilter =
  | 'today'
  | 'yesterday'
  | '7days'
  | 'this_month'
  | '3months'
  | '6months'
  | '1year'
  | 'custom';

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  storeProfile,
  currentUser,
}) => {
  // Raw Data State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [cashFlows, setCashFlows] = useState<CashFlow[]>([]);
  const [dailyRegisters, setDailyRegisters] = useState<DailyCashRegister[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filter States
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(getLocalDateString());
  const [customEndDate, setCustomEndDate] = useState<string>(getLocalDateString());
  const [selectedCashierId, setSelectedCashierId] = useState<number | 'all'>(
    currentUser?.role === 'kasir' ? currentUser.id : 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'POS' | 'SERVICE'>('all');

  // Expanded row IDs for item breakdown
  const [expandedRowIds, setExpandedRowIds] = useState<Record<string, boolean>>({});

  // Receipt Modals
  const [selectedPosTxForReceipt, setSelectedPosTxForReceipt] = useState<Transaction | null>(null);
  const [selectedServiceForReceipt, setSelectedServiceForReceipt] = useState<ServiceOrder | null>(
    null
  );

  // Load all master transactions & service orders
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [txs, services, flows, registers, emps] = await Promise.all([
        db.transactions.reverse().sortBy('createdAt'),
        db.serviceOrders.toArray(),
        db.cashFlows.toArray(),
        db.dailyCashRegister.toArray(),
        db.employees.toArray(),
      ]);
      setTransactions(txs);
      setServiceOrders(services);
      setCashFlows(flows);
      setDailyRegisters(registers);
      setEmployees(emps);
    } catch (err) {
      console.error('Failed to load transaction history', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute Active Date Range (YYYY-MM-DD local dates)
  const dateRange = useMemo(() => {
    const today = new Date();
    const todayStr = getLocalDateString(today);

    if (periodFilter === 'today') {
      return { start: todayStr, end: todayStr, label: `Hari Ini (${formatLocalDateOnly(today)})` };
    }

    if (periodFilter === 'yesterday') {
      const yest = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const yestStr = getLocalDateString(yest);
      return { start: yestStr, end: yestStr, label: `Kemarin (${formatLocalDateOnly(yest)})` };
    }

    if (periodFilter === '7days') {
      const sevenDays = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
      const startStr = getLocalDateString(sevenDays);
      return { start: startStr, end: todayStr, label: '7 Hari Terakhir' };
    }

    if (periodFilter === 'this_month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startStr = getLocalDateString(startOfMonth);
      return {
        start: startStr,
        end: todayStr,
        label: `Bulan Ini (${today.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })})`,
      };
    }

    if (periodFilter === '3months') {
      const threeMonths = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      const startStr = getLocalDateString(threeMonths);
      return { start: startStr, end: todayStr, label: '3 Bulan Terakhir' };
    }

    if (periodFilter === '6months') {
      const sixMonths = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      const startStr = getLocalDateString(sixMonths);
      return { start: startStr, end: todayStr, label: '6 Bulan Terakhir' };
    }

    if (periodFilter === '1year') {
      const oneYear = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      const startStr = getLocalDateString(oneYear);
      return { start: startStr, end: todayStr, label: '1 Tahun Terakhir' };
    }

    // Custom
    return {
      start: customStartDate || todayStr,
      end: customEndDate || todayStr,
      label: `${customStartDate} s/d ${customEndDate}`,
    };
  }, [periodFilter, customStartDate, customEndDate]);

  // Combine POS transactions & Paid Service Orders into a Unified Dataset
  const allUnifiedRecords = useMemo<UnifiedTransactionRecord[]>(() => {
    const list: UnifiedTransactionRecord[] = [];

    // 1. POS Transactions
    for (const tx of transactions) {
      const localDate = toLocalDateString(tx.createdAt);
      const items = (tx.items || []).map((i) => {
        const buyPrice = i.buyPrice || 0;
        const sellPrice = i.unitPrice || 0;
        const subtotal = i.subtotal || sellPrice * i.quantity;
        const totalItemCost = buyPrice * i.quantity;
        return {
          name: i.name,
          quantity: i.quantity,
          sellPrice,
          buyPrice,
          subtotal,
          margin: subtotal - totalItemCost,
        };
      });

      const totalCost = items.reduce((sum, item) => sum + item.buyPrice * item.quantity, 0);
      const grossProfit = tx.grandTotal - totalCost;

      list.push({
        id: `pos-${tx.id}`,
        rawId: tx.id,
        type: 'POS',
        invoiceNumber: tx.invoiceNumber,
        createdAt: tx.createdAt,
        localDate,
        cashierName: tx.cashierName || 'Kasir',
        cashierId: tx.cashierId || 1,
        customerName: tx.customerName || 'Pelanggan Umum',
        paymentMethod: tx.paymentMethod || 'CASH',
        grandTotal: tx.grandTotal,
        totalCost,
        grossProfit,
        items,
        originalPosTx: tx,
      });
    }

    // 2. Paid Service Orders
    for (const s of serviceOrders) {
      if (s.paidAmount > 0 || s.isPaid || s.status === 'SELESAI' || s.status === 'DIAMBIL') {
        const orderTime = s.completedAt || s.pickedUpAt || s.updatedAt || s.createdAt;
        const localDate = toLocalDateString(orderTime);
        const revenue = s.paidAmount > 0 ? s.paidAmount : s.grandTotal || 0;
        if (revenue <= 0) continue;

        const items = (s.items || []).map((i) => {
          const buyPrice = i.costPrice || 0;
          const sellPrice = i.sellPrice || 0;
          const subtotal = i.subtotal || sellPrice * i.quantity;
          const totalItemCost = buyPrice * i.quantity;
          return {
            name: `${i.name} [${i.type === 'PART' ? 'Sparepart' : 'Jasa'}]`,
            quantity: i.quantity,
            sellPrice,
            buyPrice,
            subtotal,
            margin: subtotal - totalItemCost,
          };
        });

        const totalCost = s.totalPartsCost || 0;
        const grossProfit = revenue - totalCost;

        list.push({
          id: `srv-${s.id}`,
          rawId: s.id || 0,
          type: 'SERVICE',
          invoiceNumber: s.ticketNumber,
          createdAt: orderTime,
          localDate,
          cashierName: s.assignedTechName || 'Teknisi',
          cashierId: s.assignedTechId || 1,
          customerName: `${s.customerName}${s.deviceType ? ` (${s.deviceType})` : ''}`,
          paymentMethod: s.paymentMethod || 'CASH',
          grandTotal: revenue,
          totalCost,
          grossProfit,
          items,
          originalServiceOrder: s,
        });
      }
    }

    // Sort newest first
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [transactions, serviceOrders]);

  // Filtered Unified Records by Date Range, Cashier, Type & Search Query
  const filteredRecords = useMemo(() => {
    const effectiveCashierId = currentUser?.role === 'kasir' ? currentUser.id : selectedCashierId;
    const { start, end } = dateRange;
    const q = searchQuery.trim().toLowerCase();

    return allUnifiedRecords.filter((rec) => {
      // 1. Date filter (local date string inclusive)
      if (rec.localDate < start || rec.localDate > end) {
        return false;
      }

      // 2. Cashier filter
      if (effectiveCashierId !== 'all') {
        if (rec.cashierId !== effectiveCashierId) return false;
      }

      // 3. Type filter (POS vs Service)
      if (selectedTypeFilter !== 'all' && rec.type !== selectedTypeFilter) {
        return false;
      }

      // 4. Search query
      if (q) {
        const matchInvoice = rec.invoiceNumber.toLowerCase().includes(q);
        const matchCustomer = rec.customerName.toLowerCase().includes(q);
        const matchCashier = rec.cashierName.toLowerCase().includes(q);
        const matchMethod = rec.paymentMethod.toLowerCase().includes(q);
        const matchItem = rec.items.some((i) => i.name.toLowerCase().includes(q));
        if (!matchInvoice && !matchCustomer && !matchCashier && !matchMethod && !matchItem) {
          return false;
        }
      }

      return true;
    });
  }, [allUnifiedRecords, dateRange, selectedCashierId, currentUser, selectedTypeFilter, searchQuery]);

  // Financial Summary Aggregations
  const financialSummary = useMemo(() => {
    const { start, end } = dateRange;

    // 1. Modal Awal Kasir:
    // If today, use today's register openingCash. If a range, sum openingCash recorded in that range
    let openingCash = 0;
    const matchingRegisters = dailyRegisters.filter(
      (r) => r.date >= start && r.date <= end
    );
    if (matchingRegisters.length > 0) {
      openingCash = matchingRegisters.reduce((sum, r) => sum + (r.openingCash || 0), 0);
    }

    // 2. Omset POS & Servis
    let posRevenue = 0;
    let serviceRevenue = 0;
    let totalCostHpp = 0;
    let cashSalesTotal = 0;
    let transferSalesTotal = 0;

    for (const rec of filteredRecords) {
      if (rec.type === 'POS') {
        posRevenue += rec.grandTotal;
      } else {
        serviceRevenue += rec.grandTotal;
      }

      totalCostHpp += rec.totalCost;

      const isCash = rec.paymentMethod?.toUpperCase().includes('CASH');
      if (isCash) {
        cashSalesTotal += rec.grandTotal;
      } else {
        transferSalesTotal += rec.grandTotal;
      }
    }

    const totalRevenue = posRevenue + serviceRevenue;
    const grossProfit = totalRevenue - totalCostHpp;

    // 3. Pengeluaran Toko (Arus Kas Keluar Operasional) in date range
    const periodFlows = cashFlows.filter((f) => {
      const fDate = toLocalDateString(f.createdAt);
      return fDate >= start && fDate <= end;
    });

    const cashInTotal = periodFlows
      .filter((f) => f.type === 'IN')
      .reduce((sum, f) => sum + f.amount, 0);

    const operationalExpenses = periodFlows
      .filter((f) => f.type === 'OUT')
      .reduce((sum, f) => sum + f.amount, 0);

    // 4. Laba Bersih Toko = Omset - Modal HPP - Pengeluaran Toko
    const netProfit = grossProfit - operationalExpenses;

    // 5. Saldo Fisik Kas di Laci = Modal Awal + Kas Tunai Masuk - Kas Keluar Tunai
    const finalCashInDrawer = openingCash + cashSalesTotal + cashInTotal - operationalExpenses;

    return {
      openingCash,
      posRevenue,
      serviceRevenue,
      totalRevenue,
      totalCostHpp,
      grossProfit,
      operationalExpenses,
      cashInTotal,
      netProfit,
      cashSalesTotal,
      transferSalesTotal,
      finalCashInDrawer,
      count: filteredRecords.length,
    };
  }, [filteredRecords, dateRange, dailyRegisters, cashFlows]);

  const toggleRowExpansion = (id: string) => {
    setExpandedRowIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleExportExcel = () => {
    const exportTransactions: UnifiedExportTransaction[] = filteredRecords.map((r) => ({
      invoiceNumber: r.invoiceNumber,
      createdAt: r.createdAt,
      type: r.type,
      cashierName: r.cashierName,
      customerName: r.customerName,
      paymentMethod: r.paymentMethod,
      grandTotal: r.grandTotal,
      totalCost: r.totalCost,
      grossProfit: r.grossProfit,
      items: r.items,
    }));

    const exportData: UnifiedFinancialExportData = {
      storeName: storeProfile.storeName || 'SparkPOS',
      periodLabel: dateRange.label,
      printedBy: currentUser?.fullName || 'Kasir',
      openingCash: financialSummary.openingCash,
      posRevenue: financialSummary.posRevenue,
      serviceRevenue: financialSummary.serviceRevenue,
      totalRevenue: financialSummary.totalRevenue,
      totalCostHpp: financialSummary.totalCostHpp,
      operationalExpenses: financialSummary.operationalExpenses,
      netProfit: financialSummary.netProfit,
      cashSalesTotal: financialSummary.cashSalesTotal,
      transferSalesTotal: financialSummary.transferSalesTotal,
      finalCashInDrawer: financialSummary.finalCashInDrawer,
      transactions: exportTransactions,
    };

    exportUnifiedFinancialReportToExcel(exportData);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden select-none">
      {/* Top Header Bar */}
      <div className="px-5 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              Laporan Keuangan Terpadu & Riwayat Transaksi
            </h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {dateRange.label} • {filteredRecords.length} Transaksi Terdata
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 transition cursor-pointer shadow-2xs"
            title="Refresh Data Terbaru"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filteredRecords.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-extrabold transition shadow-xs cursor-pointer"
            title="Ekspor laporan keuangan & rincian barang ke Excel (.csv UTF-8 BOM)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ekspor Excel (.csv)</span>
          </button>
        </div>
      </div>

      {/* Main Content Area (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
        {/* ================= 1. PERIOD QUICK FILTER & CONTROLS ================= */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Quick Period Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mr-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Periode:
              </span>
              {(
                [
                  { id: 'today', label: 'Hari Ini' },
                  { id: 'yesterday', label: 'Kemarin' },
                  { id: '7days', label: '7 Hari' },
                  { id: 'this_month', label: '1 Bulan' },
                  { id: '3months', label: '3 Bulan' },
                  { id: '6months', label: '6 Bulan' },
                  { id: '1year', label: '1 Tahun' },
                  { id: 'custom', label: 'Kustom' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriodFilter(p.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                    periodFilter === p.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Cashier Filter */}
            {currentUser?.role !== 'kasir' && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Kasir:</span>
                <select
                  value={selectedCashierId}
                  onChange={(e) =>
                    setSelectedCashierId(e.target.value === 'all' ? 'all' : Number(e.target.value))
                  }
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">Semua Kasir / Staf</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} (@{emp.username})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Custom Date Range Inputs (If Custom Selected) */}
          {periodFilter === 'custom' && (
            <div className="flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-800 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Dari:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Sampai:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Search Box & Type Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nomor invoice, nama produk, pelanggan, atau kasir..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setSelectedTypeFilter('all')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  selectedTypeFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Semua ({allUnifiedRecords.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedTypeFilter('POS')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  selectedTypeFilter === 'POS'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Penjualan Kasir ({transactions.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedTypeFilter('SERVICE')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  selectedTypeFilter === 'SERVICE'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Servis Lunas
              </button>
            </div>
          </div>
        </div>

        {/* ================= 2. RINGKASAN FINANSIAL EKSEKUTIF (6 KOTAK KAYA INFORMASI) ================= */}
        <div>
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2.5 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Ringkasan Finansial Periode Terpilih</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Box 1: Modal Awal Kasir */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Modal Awal Kasir
              </span>
              <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono tracking-tight">
                {formatRupiah(financialSummary.openingCash)}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                Uang fisik awal hari
              </span>
            </div>

            {/* Box 2: Total Omset Toko */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Total Omset Toko
              </span>
              <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                {formatRupiah(financialSummary.totalRevenue)}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                POS: {formatRupiah(financialSummary.posRevenue)} • Servis:{' '}
                {formatRupiah(financialSummary.serviceRevenue)}
              </span>
            </div>

            {/* Box 3: Total Modal HPP */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Total Modal HPP
              </span>
              <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight">
                {formatRupiah(financialSummary.totalCostHpp)}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                Barang + Sparepart
              </span>
            </div>

            {/* Box 4: Pengeluaran Toko */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                Pengeluaran Toko
              </span>
              <div className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 font-mono tracking-tight">
                {formatRupiah(financialSummary.operationalExpenses)}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                Arus kas operasional
              </span>
            </div>

            {/* Box 5: Laba Bersih Toko */}
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500/30 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block mb-1">
                Laba Bersih Toko
              </span>
              <div className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-300 font-mono tracking-tight">
                {formatRupiah(financialSummary.netProfit)}
              </div>
              <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 mt-1 block">
                Omset - HPP - Biaya
              </span>
            </div>

            {/* Box 6: Saldo Kas di Laci Kasir */}
            <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border-2 border-sky-500/30 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300 block mb-1">
                Saldo Kas di Laci
              </span>
              <div className="text-base sm:text-lg font-black text-sky-700 dark:text-sky-300 font-mono tracking-tight">
                {formatRupiah(financialSummary.finalCashInDrawer)}
              </div>
              <span className="text-[10px] text-sky-700/80 dark:text-sky-400/80 mt-1 block">
                Tunai: {formatRupiah(financialSummary.cashSalesTotal)} | Bank:{' '}
                {formatRupiah(financialSummary.transferSalesTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* ================= 3. TABEL DETAIL TRANSAKSI & RINCIAN PRODUK ================= */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Daftar Transaksi ({filteredRecords.length} Transaksi)</span>
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
              Klik baris mana saja untuk melihat rincian item barang / jasa yang dibeli
            </span>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500">
              <Receipt className="w-12 h-12 mx-auto opacity-20 mb-3" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Tidak ada transaksi pada periode ini
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Coba pilih filter periode lain atau ubah kata kunci pencarian.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    <th className="py-3 px-3 text-center w-8">#</th>
                    <th className="py-3 px-3">No. Bukti</th>
                    <th className="py-3 px-3">Waktu (WIB)</th>
                    <th className="py-3 px-3">Tipe</th>
                    <th className="py-3 px-3">Kasir / PIC</th>
                    <th className="py-3 px-3">Pelanggan</th>
                    <th className="py-3 px-3">Metode Bayar</th>
                    <th className="py-3 px-3 text-right">Omset (Rp)</th>
                    <th className="py-3 px-3 text-right">Laba Kotor (Rp)</th>
                    <th className="py-3 px-3 text-center">Aksi Struk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-800/80 text-xs">
                  {filteredRecords.map((rec) => {
                    const isExpanded = !!expandedRowIds[rec.id];
                    const isCash = rec.paymentMethod?.toUpperCase().includes('CASH');

                    return (
                      <React.Fragment key={rec.id}>
                        <tr
                          onClick={() => toggleRowExpansion(rec.id)}
                          className={`transition cursor-pointer ${
                            isExpanded
                              ? 'bg-slate-50 dark:bg-slate-850'
                              : 'hover:bg-emerald-50/40 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <td className="py-3 px-3 text-center text-slate-400">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400 inline" />
                            ) : (
                              <ChevronRight className="w-4 h-4 inline" />
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                            {rec.invoiceNumber}
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">
                            {formatLocalDateTime(rec.createdAt)}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                rec.type === 'POS'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                  : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                              }`}
                            >
                              {rec.type === 'POS' ? (
                                <>
                                  <ShoppingCart className="w-2.5 h-2.5" />
                                  <span>Penjualan</span>
                                </>
                              ) : (
                                <>
                                  <Wrench className="w-2.5 h-2.5" />
                                  <span>Servis</span>
                                </>
                              )}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            {rec.cashierName}
                          </td>
                          <td className="py-3 px-3 text-slate-700 dark:text-slate-300 max-w-[160px] truncate">
                            {rec.customerName}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isCash
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                  : 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                              }`}
                            >
                              {isCash ? (
                                <Banknote className="w-3 h-3" />
                              ) : (
                                <Building2 className="w-3 h-3" />
                              )}
                              <span>{isCash ? '💵 Tunai' : '🏦 Transfer'}</span>
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {formatRupiah(rec.grandTotal)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                            +{formatRupiah(rec.grossProfit)}
                          </td>
                          <td
                            className="py-3 px-3 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (rec.type === 'POS' && rec.originalPosTx) {
                                  setSelectedPosTxForReceipt(rec.originalPosTx);
                                } else if (rec.type === 'SERVICE' && rec.originalServiceOrder) {
                                  setSelectedServiceForReceipt(rec.originalServiceOrder);
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-300 dark:border-slate-700 text-[11px] font-bold transition inline-flex items-center gap-1 cursor-pointer"
                              title="Lihat / Cetak Struk Nota"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Struk</span>
                            </button>
                          </td>
                        </tr>

                        {/* ================= EXPANDABLE ITEM BREAKDOWN ================= */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800">
                            <td colSpan={10} className="py-3 px-6">
                              <div className="space-y-2">
                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                                  Rincian Item Produk & Jasa ({rec.items.length} item):
                                </span>
                                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                        <th className="py-1.5 px-3">Nama Produk / Jasa</th>
                                        <th className="py-1.5 px-3 text-center">Qty</th>
                                        <th className="py-1.5 px-3 text-right">Harga Jual</th>
                                        <th className="py-1.5 px-3 text-right">Modal (HPP)</th>
                                        <th className="py-1.5 px-3 text-right">Subtotal</th>
                                        <th className="py-1.5 px-3 text-right">Margin Laba</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-150 dark:divide-slate-800">
                                      {rec.items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                                          <td className="py-1.5 px-3 font-medium text-slate-900 dark:text-slate-100">
                                            {item.name}
                                          </td>
                                          <td className="py-1.5 px-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                                            {item.quantity}
                                          </td>
                                          <td className="py-1.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                                            {formatRupiah(item.sellPrice)}
                                          </td>
                                          <td className="py-1.5 px-3 text-right font-mono text-slate-500 dark:text-slate-400">
                                            {formatRupiah(item.buyPrice)}
                                          </td>
                                          <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                            {formatRupiah(item.subtotal)}
                                          </td>
                                          <td className="py-1.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                            +{formatRupiah(item.margin)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* POS Receipt Preview Modal */}
      {selectedPosTxForReceipt && (
        <ReceiptModal
          transaction={selectedPosTxForReceipt}
          storeProfile={storeProfile}
          onClose={() => setSelectedPosTxForReceipt(null)}
        />
      )}

      {/* Service Receipt Preview Modal */}
      {selectedServiceForReceipt && (
        <ServiceReceiptModal
          order={selectedServiceForReceipt}
          storeProfile={storeProfile}
          onClose={() => setSelectedServiceForReceipt(null)}
        />
      )}
    </div>
  );
};
