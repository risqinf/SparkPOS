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
  Copy,
  Check,
  Edit3,
  PlusCircle,
  Save,
  FileDown,
  AlertCircle,
  Lock,
} from 'lucide-react';
import {
  Transaction,
  StoreProfile,
  ServiceOrder,
  CashFlow,
  DailyCashRegister,
  Employee,
  PaymentMethod,
} from '../../types/pos';
import { formatRupiah, formatCompactRupiah } from '../../services/cartCalculator';
import { db, getTodayCashRegister, setTodayOpeningCash } from '../../services/storage';
import { ReceiptModal } from '../POS/ReceiptModal';
import { ServiceReceiptModal } from '../Service/ServiceReceiptModal';
import {
  exportUnifiedFinancialReportToExcel,
  copyUnifiedFinancialReportToClipboard,
  UnifiedExportTransaction,
  UnifiedFinancialExportData,
} from '../../services/excelExport';
import {
  getLocalDateString,
  toLocalDateString,
  formatLocalDateTime,
  formatLocalDateOnly,
} from '../../services/dateUtils';
import { CASH_OUT_CATEGORIES, CASH_IN_CATEGORIES, noteExample } from '../../services/cashCategories';
import { ArrowDownRight, ArrowUpRight, Trash2 } from 'lucide-react';
import { useDialog } from '../../hooks/useDialog';

interface TransactionHistoryProps {
  storeProfile: StoreProfile;
  currentUser?: Employee | null;
  onOpenCashFlow?: () => void;
}

export interface UnifiedTransactionRecord {
  id: string; // e.g. "pos-12" or "srv-34"
  rawId: number;
  type: 'POS' | 'SERVICE' | 'CASH_IN' | 'CASH_OUT';
  invoiceNumber: string;
  createdAt: string;
  localDate: string;
  cashierName: string;
  cashierId: number;
  customerName: string;
  paymentMethod: string;
  notes?: string;
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
  originalCashFlow?: CashFlow;
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
  onOpenCashFlow,
}) => {
  // Raw Data State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [cashFlows, setCashFlows] = useState<CashFlow[]>([]);
  const [dailyRegisters, setDailyRegisters] = useState<DailyCashRegister[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filter States: Default to 'all' so kasir & owner see all transactions by default
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(getLocalDateString());
  const [customEndDate, setCustomEndDate] = useState<string>(getLocalDateString());
  const [selectedCashierId, setSelectedCashierId] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'POS' | 'SERVICE' | 'CASH'>('all');

  // Expanded row IDs for item breakdown
  const [expandedRowIds, setExpandedRowIds] = useState<Record<string, boolean>>({});

  // Receipt Modals
  const [selectedPosTxForReceipt, setSelectedPosTxForReceipt] = useState<Transaction | null>(null);
  const [selectedServiceForReceipt, setSelectedServiceForReceipt] = useState<ServiceOrder | null>(
    null
  );

  // Toast / Feedback State
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Correction Modals State
  const [isEditOpeningCashOpen, setIsEditOpeningCashOpen] = useState(false);
  const dlgOpeningRef = useDialog<HTMLDivElement>(isEditOpeningCashOpen, () => setIsEditOpeningCashOpen(false));
  const [editOpeningCashValue, setEditOpeningCashValue] = useState<string>('0');

  const [transactionToEdit, setTransactionToEdit] = useState<UnifiedTransactionRecord | null>(null);
  const dlgEditTxRef = useDialog<HTMLDivElement>(!!transactionToEdit, () => setTransactionToEdit(null));
  const [editCustomerName, setEditCustomerName] = useState<string>('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>('CASH');
  const [editNotes, setEditNotes] = useState<string>('');

  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const dlgCashRef = useDialog<HTMLDivElement>(isAddExpenseOpen, () => closeCashFlowModal());
  const [expenseType, setExpenseType] = useState<'OUT' | 'IN'>('OUT');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseCategory, setExpenseCategory] = useState<string>(CASH_OUT_CATEGORIES[0]);
  const [editingFlowId, setEditingFlowId] = useState<number | null>(null);
  const [expenseNotes, setExpenseNotes] = useState<string>('');

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Load all master transactions & service orders
  const loadData = async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
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
      if (!isBackground) showToast('Gagal memuat data transaksi', 'error');
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData(true);
    };

    // Auto-sync polling every 5s so data is strictly realtime without closing shift
    const intervalTimer = setInterval(() => {
      loadData(true);
    }, 5000);

    if (typeof window !== 'undefined') {
      window.addEventListener('sparkpos_data_changed', handleUpdate);
      window.addEventListener('focus', handleUpdate);
      document.addEventListener('visibilitychange', handleUpdate);
    }
    return () => {
      clearInterval(intervalTimer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('sparkpos_data_changed', handleUpdate);
        window.removeEventListener('focus', handleUpdate);
        document.removeEventListener('visibilitychange', handleUpdate);
      }
    };
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
        notes: tx.notes,
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
          notes: s.notes,
          grandTotal: revenue,
          totalCost,
          grossProfit,
          items,
          originalServiceOrder: s,
        });
      }
    }

    // 3. Uang Kas Masuk / Keluar (tercatat di riwayat, tidak dihitung sebagai omset)
    for (const f of cashFlows) {
      const isIn = f.type === 'IN';
      list.push({
        id: `cash-${f.id}`,
        rawId: f.id || 0,
        type: isIn ? 'CASH_IN' : 'CASH_OUT',
        invoiceNumber: `KAS-${String(f.id || 0).padStart(4, '0')}`,
        createdAt: f.createdAt,
        localDate: toLocalDateString(f.createdAt),
        cashierName: f.cashierName || 'Kasir',
        cashierId: f.cashierId || 1,
        customerName: f.category || (isIn ? 'Kas Masuk' : 'Kas Keluar'),
        paymentMethod: /transfer bank/i.test(f.note || '') ? 'TRANSFER' : 'CASH',
        notes: f.note,
        grandTotal: f.amount,
        totalCost: 0,
        grossProfit: 0,
        items: [],
        originalCashFlow: f,
      });
    }

    // Sort newest first
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [transactions, serviceOrders, cashFlows]);

  // Filtered Unified Records by Date Range, Cashier, Type & Search Query
  const filteredRecords = useMemo(() => {
    const effectiveCashierId = selectedCashierId;
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
      if (selectedTypeFilter === 'CASH') {
        if (rec.type !== 'CASH_IN' && rec.type !== 'CASH_OUT') return false;
      } else if (selectedTypeFilter !== 'all' && rec.type !== selectedTypeFilter) {
        return false;
      }

      // 4. Search query
      if (q) {
        const matchInvoice = rec.invoiceNumber.toLowerCase().includes(q);
        const matchCustomer = rec.customerName.toLowerCase().includes(q);
        const matchCashier = rec.cashierName.toLowerCase().includes(q);
        const matchMethod = rec.paymentMethod.toLowerCase().includes(q);
        const matchItem = rec.items.some((i) => i.name.toLowerCase().includes(q));
        const matchNotes = (rec.notes || '').toLowerCase().includes(q);
        if (!matchInvoice && !matchCustomer && !matchCashier && !matchMethod && !matchItem && !matchNotes) {
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

    const salesRecords = filteredRecords.filter((r) => r.type === 'POS' || r.type === 'SERVICE');
    for (const rec of salesRecords) {
      if (rec.type === 'POS') {
        posRevenue += rec.grandTotal;
      } else {
        serviceRevenue += rec.grandTotal;
      }

      totalCostHpp += rec.totalCost;

      // Split payment precision support
      if (rec.originalPosTx?.payments && rec.originalPosTx.payments.length > 0) {
        for (const p of rec.originalPosTx.payments) {
          if (p.method?.toUpperCase().includes('CASH')) {
            cashSalesTotal += p.amount || 0;
          } else {
            transferSalesTotal += p.amount || 0;
          }
        }
      } else {
        const isCash = rec.paymentMethod?.toUpperCase().includes('CASH');
        if (isCash) {
          cashSalesTotal += rec.grandTotal;
        } else {
          transferSalesTotal += rec.grandTotal;
        }
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
      count: salesRecords.length,
    };
  }, [filteredRecords, dateRange, dailyRegisters, cashFlows]);

  const todayRegister = useMemo(() => {
    return dailyRegisters.find((r) => r.date === getLocalDateString());
  }, [dailyRegisters]);
  const isTodayClosed = todayRegister?.isClosed;

  const toggleRowExpansion = (id: string) => {
    setExpandedRowIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getExportData = (): UnifiedFinancialExportData => {
    const exportTransactions: UnifiedExportTransaction[] = filteredRecords
      .filter((r) => r.type === 'POS' || r.type === 'SERVICE')
      .map((r) => ({
      invoiceNumber: r.invoiceNumber,
      createdAt: r.createdAt,
      type: r.type as 'POS' | 'SERVICE',
      cashierName: r.cashierName,
      customerName: r.customerName,
      paymentMethod: r.paymentMethod,
      grandTotal: r.grandTotal,
      totalCost: r.totalCost,
      grossProfit: r.grossProfit,
      items: r.items,
    }));

    return {
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
  };

  // 1. Ekspor dalam bentuk File (.xlsx Excel Asli)
  const handleExportExcelFile = () => {
    const data = getExportData();
    exportUnifiedFinancialReportToExcel(data);
    showToast('File Excel (.xlsx) berhasil diunduh!');
  };

  // 2. Salin ke Clipboard (Format Excel TSV & HTML)
  const handleCopyClipboard = async () => {
    const data = getExportData();
    const ok = await copyUnifiedFinancialReportToClipboard(data);
    if (ok) {
      setIsCopied(true);
      showToast('Laporan berhasil disalin ke clipboard! Format tabel siap ditempel (Ctrl+V) di Excel/LibreOffice.');
      setTimeout(() => setIsCopied(false), 2500);
    } else {
      showToast('Gagal menyalin ke clipboard', 'error');
    }
  };

  // Opening Cash Correction Handlers
  const handleOpenEditOpeningCash = () => {
    setEditOpeningCashValue(financialSummary.openingCash.toString());
    setIsEditOpeningCashOpen(true);
  };

  const handleSaveOpeningCashCorrection = async () => {
    const newOpening = parseFloat(editOpeningCashValue.replace(/[^0-9]/g, '')) || 0;
    const targetDate = dateRange.start; // The active date or today

    const existing = await db.dailyCashRegister.where('date').equals(targetDate).first();
    if (existing && existing.id) {
      await db.dailyCashRegister.update(existing.id, {
        openingCash: newOpening,
      });
    } else {
      await db.dailyCashRegister.add({
        date: targetDate,
        openingCash: newOpening,
        cashierId: currentUser?.id || 1,
        cashierName: currentUser?.fullName || 'Kasir',
        openedAt: new Date().toISOString(),
        isClosed: false,
      } as any);
    }

    await loadData();
    setIsEditOpeningCashOpen(false);
    showToast(`Modal awal untuk tanggal ${targetDate} berhasil dikoreksi menjadi ${formatRupiah(newOpening)}!`);
  };

  // Transaction Correction Handlers
  const handleOpenEditTransaction = (rec: UnifiedTransactionRecord) => {
    setTransactionToEdit(rec);
    setEditCustomerName(rec.customerName || '');
    setEditPaymentMethod(rec.paymentMethod?.toUpperCase().includes('TRANSFER') ? 'TRANSFER' : 'CASH');
    setEditNotes(rec.notes || '');
  };

  const handleSaveTransactionCorrection = async () => {
    if (!transactionToEdit) return;

    try {
      if (transactionToEdit.type === 'POS' && transactionToEdit.originalPosTx) {
        const tx = transactionToEdit.originalPosTx;
        const newPayments = [
          {
            method: editPaymentMethod as PaymentMethod,
            amount: tx.paidAmount || tx.grandTotal,
          },
        ];

        await db.transactions.update(tx.id, {
          customerName: editCustomerName.trim() || 'Pelanggan Umum',
          paymentMethod: editPaymentMethod,
          payments: newPayments,
          notes: editNotes.trim() || undefined,
        });
      } else if (transactionToEdit.type === 'SERVICE' && transactionToEdit.originalServiceOrder) {
        const srv = transactionToEdit.originalServiceOrder;
        await db.serviceOrders.update(srv.id!, {
          customerName: editCustomerName.trim() || srv.customerName,
          paymentMethod: editPaymentMethod,
          notes: editNotes.trim() || srv.notes,
        });
      }

      await loadData();
      showToast(`Transaksi ${transactionToEdit.invoiceNumber} berhasil dikoreksi!`);
      setTransactionToEdit(null);
    } catch (err) {
      console.error('Error saving transaction correction', err);
      showToast('Gagal menyimpan koreksi transaksi', 'error');
    }
  };

  // Cash Flow: catat baru / koreksi / hapus
  const openNewCashFlow = (type: 'OUT' | 'IN' = 'OUT') => {
    setEditingFlowId(null);
    setExpenseType(type);
    setExpenseCategory(type === 'OUT' ? CASH_OUT_CATEGORIES[0] : CASH_IN_CATEGORIES[0]);
    setExpenseAmount('');
    setExpenseNotes('');
    setIsAddExpenseOpen(true);
  };

  const openEditCashFlow = (f: CashFlow) => {
    setEditingFlowId(f.id ?? null);
    setExpenseType(f.type);
    setExpenseCategory(f.category);
    setExpenseAmount(String(f.amount));
    setExpenseNotes(f.note || '');
    setIsAddExpenseOpen(true);
  };

  const closeCashFlowModal = () => {
    setIsAddExpenseOpen(false);
    setEditingFlowId(null);
    setExpenseAmount('');
    setExpenseNotes('');
  };

  const handleSaveExpense = async () => {
    const nominal = parseFloat(expenseAmount.replace(/[^0-9]/g, '')) || 0;
    if (nominal <= 0) {
      showToast('Nominal harus lebih dari Rp 0', 'error');
      return;
    }

    try {
      const note =
        expenseNotes.trim() || (expenseType === 'OUT' ? 'Kas keluar' : 'Kas masuk');
      if (editingFlowId !== null) {
        await db.cashFlows.update(editingFlowId, {
          type: expenseType,
          category: expenseCategory,
          amount: nominal,
          note,
        });
      } else {
        await db.cashFlows.add({
          shiftId: 1,
          cashierId: currentUser?.id || 1,
          cashierName: currentUser?.fullName || 'Kasir',
          type: expenseType,
          category: expenseCategory,
          amount: nominal,
          note,
          createdAt: new Date().toISOString(),
        } as any);
      }

      await loadData();
      window.dispatchEvent(new CustomEvent('sparkpos_data_changed', { detail: { type: 'cash_flow' } }));
      const wasEditing = editingFlowId !== null;
      closeCashFlowModal();
      showToast(
        wasEditing
          ? `Catatan kas berhasil dikoreksi (${formatRupiah(nominal)})`
          : `Berhasil mencatat ${expenseType === 'OUT' ? 'uang keluar' : 'uang masuk'} sebesar ${formatRupiah(nominal)}!`
      );
    } catch (err) {
      console.error('Error saving cash flow', err);
      showToast('Gagal mencatat arus kas', 'error');
    }
  };

  const handleDeleteCashFlow = async () => {
    if (editingFlowId === null) return;
    if (!confirm('Hapus catatan kas ini? Saldo kas akan dihitung ulang.')) return;
    await db.cashFlows.delete(editingFlowId);
    await loadData();
    window.dispatchEvent(new CustomEvent('sparkpos_data_changed', { detail: { type: 'cash_flow' } }));
    closeCashFlowModal();
    showToast('Catatan kas dihapus');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2 border animate-in fade-in slide-in-from-top-3 duration-200 ${
            toastMessage.type === 'error'
              ? 'bg-rose-950/90 border-rose-700 text-rose-200'
              : 'bg-emerald-950/90 border-emerald-700 text-emerald-200'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

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
              {dateRange.label} • {financialSummary.count} Transaksi • {filteredRecords.length - financialSummary.count} Catatan Kas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Real-Time Toko Otomatis Sesuai Waktu Sistem (07:30 - 16:30) */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Real-Time Sistem (07:30 - 16:30)</span>
          </div>

          {/* Quick Cash In / Out */}
          <button
            type="button"
            onClick={onOpenCashFlow || (() => openNewCashFlow('OUT'))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 transition cursor-pointer shadow-2xs"
            title="Catat Uang Kas Masuk / Keluar Operasional Toko"
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Catat Kas</span>
          </button>

          {/* Segarkan / Refresh */}
          <button
            type="button"
            onClick={() => loadData()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 transition cursor-pointer shadow-2xs"
            title="Refresh Data Terbaru (Otomatis Realtime)"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>

          {/* DUAL EXPORT 1: Salin ke Clipboard (Format Excel / TSV) */}
          <button
            type="button"
            onClick={handleCopyClipboard}
            disabled={filteredRecords.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 disabled:opacity-40 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition shadow-2xs cursor-pointer"
            title="Salin data laporan ke Clipboard dalam format yang langsung rapih saat di-paste (Ctrl+V) ke Excel"
          >
            {isCopied ? (
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            )}
            <span>{isCopied ? 'Tersalin!' : 'Salin Clipboard (Excel)'}</span>
          </button>

          {/* DUAL EXPORT 2: Unduh File Excel (.xlsx Native) */}
          <button
            type="button"
            onClick={handleExportExcelFile}
            disabled={filteredRecords.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-extrabold transition shadow-xs cursor-pointer"
            title="Unduh laporan keuangan lengkap beserta rincian produk dalam bentuk file Excel (.xlsx) resmi yang langsung rapih di Excel & LibreOffice"
          >
            <FileDown className="w-4 h-4" />
            <span>Unduh File (.xlsx)</span>
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

            {/* Cashier Filter (Dapat dipilih oleh semua role, default Semua Kasir) */}
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
                placeholder="Cari invoice, produk, pelanggan, kasir, atau keterangan kas..."
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
              <button
                type="button"
                onClick={() => setSelectedTypeFilter('CASH')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  selectedTypeFilter === 'CASH'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Kas Masuk/Keluar ({cashFlows.length})
              </button>
            </div>
          </div>
        </div>

        {/* ================= 2. RINGKASAN FINANSIAL EKSEKUTIF (6 KARTU KAYA INFORMASI DENGAN FITUR KOREKSI) ================= */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Ringkasan Finansial Periode Terpilih</span>
            </h2>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Nilai dapat dikoreksi kapan saja sewaktu-waktu
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
            {/* Box 1: Modal Awal Kasir + Tombol Koreksi Langsung */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Modal Awal Kasir
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenEditOpeningCash}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                    title="Koreksi Modal Awal Kasir jika salah input"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Koreksi</span>
                  </button>
                </div>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-lg font-black text-slate-900 dark:text-white font-mono tracking-tight">
                    {formatRupiah(financialSummary.openingCash)}
                  </span>
                  <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {formatCompactRupiah(financialSummary.openingCash)}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 mt-2 block">
                Uang fisik awal hari
              </span>
            </div>

            {/* Box 2: Total Omset Toko */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Total Omset Toko
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    POS + Servis
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                    {formatRupiah(financialSummary.totalRevenue)}
                  </span>
                  <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    {formatCompactRupiah(financialSummary.totalRevenue)}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 mt-2 block truncate" title={`POS: ${formatRupiah(financialSummary.posRevenue)} • Servis: ${formatRupiah(financialSummary.serviceRevenue)}`}>
                POS: {formatRupiah(financialSummary.posRevenue)} • Servis: {formatRupiah(financialSummary.serviceRevenue)}
              </span>
            </div>

            {/* Box 3: Total Modal HPP */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Total Modal HPP
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                    Barang + Part
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight">
                    {formatRupiah(financialSummary.totalCostHpp)}
                  </span>
                  <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                    {formatCompactRupiah(financialSummary.totalCostHpp)}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 mt-2 block">
                Modal pokok penjualan
              </span>
            </div>

            {/* Box 4: Pengeluaran Toko + Tombol Tambah/Koreksi Kas */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Pengeluaran Toko
                  </span>
                  <button
                    type="button"
                    onClick={() => openNewCashFlow('OUT')}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-rose-600 dark:text-rose-400 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                    title="Catat atau koreksi pengeluaran operasional toko"
                  >
                    <PlusCircle className="w-3 h-3" />
                    <span>Catat Kas</span>
                  </button>
                </div>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-lg font-black text-rose-600 dark:text-rose-400 font-mono tracking-tight">
                    {formatRupiah(financialSummary.operationalExpenses)}
                  </span>
                  <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                    {formatCompactRupiah(financialSummary.operationalExpenses)}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 mt-2 block">
                Arus kas operasional
              </span>
            </div>

            {/* Box 5: Laba Bersih Toko / Rugi Toko */}
            {(() => {
              const isProfit = financialSummary.netProfit >= 0;
              return (
                <div
                  className={`p-4 rounded-2xl border-2 shadow-2xs flex flex-col justify-between transition-colors ${
                    isProfit
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500/40'
                      : 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-500/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span
                        className={`text-[10px] font-extrabold uppercase tracking-wider ${
                          isProfit ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'
                        }`}
                      >
                        {isProfit ? 'Laba Bersih Toko' : 'Rugi / Defisit Toko'}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                          isProfit
                            ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300'
                        }`}
                      >
                        {isProfit ? 'Untung (Surplus)' : 'Minus (Defisit)'}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span
                        className={`text-lg font-black font-mono tracking-tight ${
                          isProfit ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {formatRupiah(financialSummary.netProfit)}
                      </span>
                      <span
                        className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded-md ${
                          isProfit
                            ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300'
                        }`}
                      >
                        {formatCompactRupiah(financialSummary.netProfit)}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-semibold mt-2 block ${
                      isProfit ? 'text-emerald-800/80 dark:text-emerald-400/80' : 'text-rose-800/80 dark:text-rose-400/80'
                    }`}
                  >
                    {isProfit
                      ? `Margin: ${
                          financialSummary.totalRevenue > 0
                            ? Math.round((financialSummary.netProfit / financialSummary.totalRevenue) * 100)
                            : 0
                        }% dari omset`
                      : 'Beban operasional & HPP melebihi omset'}
                  </span>
                </div>
              );
            })()}

            {/* Box 6: Saldo Kas di Laci Kasir */}
            {(() => {
              const isCashHealthy = financialSummary.finalCashInDrawer >= 0;
              return (
                <div
                  className={`p-4 rounded-2xl border-2 shadow-2xs flex flex-col justify-between transition-colors ${
                    isCashHealthy
                      ? 'bg-sky-50/70 dark:bg-sky-950/40 border-sky-500/40'
                      : 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-500/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span
                        className={`text-[10px] font-extrabold uppercase tracking-wider ${
                          isCashHealthy ? 'text-sky-800 dark:text-sky-300' : 'text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        Saldo Kas di Laci
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                          isCashHealthy
                            ? 'bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300'
                            : 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {isCashHealthy ? 'Uang Fisik' : 'Kas Minus'}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span
                        className={`text-lg font-black font-mono tracking-tight ${
                          isCashHealthy ? 'text-sky-700 dark:text-sky-300' : 'text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {formatRupiah(financialSummary.finalCashInDrawer)}
                      </span>
                      <span
                        className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded-md ${
                          isCashHealthy
                            ? 'bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-300'
                            : 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {formatCompactRupiah(financialSummary.finalCashInDrawer)}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-medium mt-2 block truncate ${
                      isCashHealthy ? 'text-sky-800/80 dark:text-sky-400/80' : 'text-amber-800/80 dark:text-amber-400/80'
                    }`}
                    title={`Tunai: ${formatRupiah(financialSummary.cashSalesTotal)} | Bank: ${formatRupiah(financialSummary.transferSalesTotal)}`}
                  >
                    Tunai: {formatRupiah(financialSummary.cashSalesTotal)} | Bank: {formatRupiah(financialSummary.transferSalesTotal)}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* ================= 3. TABEL DETAIL TRANSAKSI & RINCIAN PRODUK ================= */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Riwayat Transaksi & Kas ({filteredRecords.length} catatan)</span>
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
              Klik baris mana saja untuk melihat rincian item atau klik Koreksi untuk mengubah data transaksi
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
                    <th className="py-3 px-3 text-center">Aksi & Koreksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-800/80 text-xs">
                  {filteredRecords.map((rec) => {
                    const isExpanded = !!expandedRowIds[rec.id];
                    const isCash = rec.paymentMethod?.toUpperCase().includes('CASH');
                    const isFlow = rec.type === 'CASH_IN' || rec.type === 'CASH_OUT';
                    const flowIn = rec.type === 'CASH_IN';

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
                          <td className="py-3 px-3 text-slate-800 dark:text-slate-200 font-semibold whitespace-nowrap">
                            {formatLocalDateTime(rec.createdAt)}
                          </td>
                          <td className="py-3 px-3">
                            {isFlow ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                  flowIn
                                    ? 'bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800'
                                    : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                                }`}
                              >
                                {flowIn ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                                <span>{flowIn ? 'Kas Masuk' : 'Kas Keluar'}</span>
                              </span>
                            ) : (
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
                            )}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            {rec.cashierName}
                          </td>
                          <td className="py-3 px-3 text-slate-700 dark:text-slate-300 max-w-[160px] truncate">
                            {rec.customerName}
                            {isFlow && rec.notes && (
                              <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate" title={rec.notes}>
                                {rec.notes}
                              </span>
                            )}
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
                          <td
                            className={`py-3 px-3 text-right font-mono font-bold ${
                              isFlow
                                ? flowIn
                                  ? 'text-sky-700 dark:text-sky-300'
                                  : 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {isFlow ? `${flowIn ? '+' : '-'}${formatRupiah(rec.grandTotal)}` : formatRupiah(rec.grandTotal)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                            {isFlow ? <span className="text-slate-400">—</span> : `+${formatRupiah(rec.grossProfit)}`}
                          </td>
                          <td
                            className="py-3 px-3 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              {isFlow && rec.originalCashFlow ? (
                                <button
                                  type="button"
                                  onClick={() => openEditCashFlow(rec.originalCashFlow!)}
                                  className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 border border-slate-300 dark:border-slate-700 text-[11px] font-bold transition inline-flex items-center gap-1 cursor-pointer"
                                  title="Koreksi atau hapus catatan kas ini"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Koreksi</span>
                                </button>
                              ) : (
                              <>
                              {/* Action 1: Print / View Struk */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (rec.type === 'POS' && rec.originalPosTx) {
                                    setSelectedPosTxForReceipt(rec.originalPosTx);
                                  } else if (rec.type === 'SERVICE' && rec.originalServiceOrder) {
                                    setSelectedServiceForReceipt(rec.originalServiceOrder);
                                  }
                                }}
                                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-300 dark:border-slate-700 text-[11px] font-bold transition inline-flex items-center gap-1 cursor-pointer"
                                title="Lihat / Cetak Struk Nota"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Struk</span>
                              </button>

                              {/* Action 2: Edit / Koreksi Transaksi */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditTransaction(rec)}
                                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 border border-slate-300 dark:border-slate-700 text-[11px] font-bold transition inline-flex items-center gap-1 cursor-pointer"
                                title="Koreksi nama pelanggan, metode pembayaran, atau catatan transaksi"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Koreksi</span>
                              </button>
                              </>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* ================= EXPANDABLE ITEM BREAKDOWN ================= */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800">
                            <td colSpan={10} className="py-3 px-6">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                                    {isFlow ? 'Rincian Catatan Kas:' : `Rincian Item Produk & Jasa (${rec.items.length} item):`}
                                  </span>
                                  {rec.notes && (
                                    <span className="text-xs italic text-slate-500 dark:text-slate-400">
                                      Catatan: {rec.notes}
                                    </span>
                                  )}
                                </div>
                                {isFlow ? (
                                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                                    <div><span className="font-bold">Kategori:</span> {rec.customerName}</div>
                                    <div><span className="font-bold">Keterangan:</span> {rec.notes || '-'}</div>
                                    <div><span className="font-bold">Dicatat oleh:</span> {rec.cashierName}</div>
                                  </div>
                                ) : (
                                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
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
                                          <td className="py-1.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300 font-semibold">
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
                                )}
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

      {/* ================= MODAL 1: KOREKSI MODAL AWAL KASIR ================= */}
      {isEditOpeningCashOpen && (
        <div ref={dlgOpeningRef} role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                  <Banknote className="w-4 h-4" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Koreksi Modal Awal Kasir
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOpeningCashOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Koreksi uang fisik kas awal yang ada di laci kasir untuk tanggal <strong>{dateRange.start}</strong>. Saldo laci akan otomatis disesuaikan secara real-time.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Nominal Modal Awal (Rp):
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={editOpeningCashValue}
                  onChange={(e) => setEditOpeningCashValue(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base font-black font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  placeholder="0"
                  autoFocus
                />
              </div>
              <div className="text-right text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {formatRupiah(Number(editOpeningCashValue) || 0)}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditOpeningCashOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveOpeningCashCorrection}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition shadow-xs flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Koreksi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: KOREKSI TRANSAKSI ================= */}
      {transactionToEdit && (
        <div ref={dlgEditTxRef} role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Koreksi Transaksi {transactionToEdit.invoiceNumber}
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {formatLocalDateTime(transactionToEdit.createdAt)} • Total: {formatRupiah(transactionToEdit.grandTotal)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTransactionToEdit(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Nama Pelanggan */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nama Pelanggan:
                </label>
                <input
                  type="text"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  placeholder="e.g. Bpk. Hendra / Pelanggan Umum"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Metode Pembayaran */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Metode Pembayaran:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditPaymentMethod('CASH')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      editPaymentMethod === 'CASH'
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>💵 Tunai (Cash)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPaymentMethod('TRANSFER')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      editPaymentMethod === 'TRANSFER'
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>🏦 Transfer Bank</span>
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Mengubah metode bayar akan otomatis mengupdate saldo kas fisik di laci vs mutasi bank.
                </span>
              </div>

              {/* Catatan Koreksi */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Catatan / Keterangan Koreksi:
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Alasan koreksi data transaksi ini..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setTransactionToEdit(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveTransactionCorrection}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition shadow-xs flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: CATAT / KOREKSI ARUS KAS PENGELUARAN ================= */}
      {isAddExpenseOpen && (
        <div ref={dlgCashRef} role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center">
                  <ArrowDownUp className="w-4 h-4" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {editingFlowId !== null ? 'Koreksi Catatan Kas' : 'Catat Uang Kas Masuk / Keluar'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeCashFlowModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Tipe Arus Kas */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Jenis Arus Kas:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setExpenseType('OUT'); setExpenseCategory(CASH_OUT_CATEGORIES[0]); }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      expenseType === 'OUT'
                        ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>💸 Uang Keluar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setExpenseType('IN'); setExpenseCategory(CASH_IN_CATEGORIES[0]); }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      expenseType === 'IN'
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>💰 Uang Masuk</span>
                  </button>
                </div>
              </div>

              {/* Nominal */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nominal (Rp):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base font-black font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    placeholder="0"
                    autoFocus
                  />
                </div>
                <div className="text-right text-xs font-bold text-slate-600 dark:text-slate-400">
                  {formatRupiah(Number(expenseAmount) || 0)}
                </div>
              </div>

              {/* Kategori */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Kategori:
                </label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                >
                  {(expenseType === 'OUT' ? CASH_OUT_CATEGORIES : CASH_IN_CATEGORIES).concat(
                    (expenseType === 'OUT' ? CASH_OUT_CATEGORIES : CASH_IN_CATEGORIES).includes(expenseCategory) ? [] : [expenseCategory]
                  ).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Catatan */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Keterangan:
                </label>
                <input
                  type="text"
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  placeholder={noteExample(expenseType)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              {editingFlowId !== null && (
                <button
                  type="button"
                  onClick={handleDeleteCashFlow}
                  className="mr-auto px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Hapus</span>
                </button>
              )}
              <button
                type="button"
                onClick={closeCashFlowModal}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveExpense}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition shadow-xs flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Transaksi Kas</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
