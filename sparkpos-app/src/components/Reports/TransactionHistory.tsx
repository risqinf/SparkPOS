import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Transaction, StoreProfile } from '../../types/pos';
import { formatRupiah } from '../../services/cartCalculator';
import { db } from '../../services/storage';
import { ReceiptModal } from '../POS/ReceiptModal';
import { exportTransactionsToExcel } from '../../services/excelExport';

interface TransactionHistoryProps {
  storeProfile: StoreProfile;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({ storeProfile }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTxForReceipt, setSelectedTxForReceipt] = useState<Transaction | null>(null);

  const loadTransactions = async () => {
    const list = await db.transactions.reverse().sortBy('createdAt');
    setTransactions(list);
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  // Filtered transactions
  const filtered = transactions.filter(
    (tx) =>
      tx.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.cashierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.customerName && tx.customerName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Financial summary of all transactions
  const totalRevenue = transactions.reduce((sum, t) => sum + t.grandTotal, 0);
  const totalCount = transactions.length;
  const averageTicket = totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0;

  return (
    <div className="flex-1 flex flex-col p-4 lg:p-6 bg-slate-950 overflow-hidden select-none">
      {/* Top Metrics Ribbon (Restrained Minimalist) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 lg:gap-4.5 mb-4 shrink-0">
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">
              Total Omzet Penjualan
            </span>
            <div className="text-xl font-bold text-white mt-0.5">
              {formatRupiah(totalRevenue)}
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Akumulasi nota selesai
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-850 border border-slate-800 flex items-center justify-center text-slate-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">
              Jumlah Transaksi
            </span>
            <div className="text-xl font-bold text-white mt-0.5">{totalCount} Transaksi</div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Nota berhasil dicetak
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-850 border border-slate-800 flex items-center justify-center text-slate-400">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">
              Rata-rata Nota (Basket Size)
            </span>
            <div className="text-xl font-bold text-white mt-0.5">
              {formatRupiah(averageTicket)}
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Per transaksi belanja
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-850 border border-slate-800 flex items-center justify-center text-slate-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari no. faktur / invoice, nama kasir, atau pelanggan..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            Total: <strong className="text-slate-200">{filtered.length}</strong> transaksi
          </span>

          <button
            onClick={() => exportTransactionsToExcel(filtered, storeProfile.storeName)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition shadow-sm active:scale-95"
            title="Export riwayat transaksi ke format Microsoft Excel (.csv)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-sm">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] sticky top-0 z-10 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold">No. Invoice / Faktur</th>
                <th className="px-4 py-3 font-semibold">Waktu Transaksi</th>
                <th className="px-4 py-3 font-semibold">Pelanggan</th>
                <th className="px-4 py-3 font-semibold">Kasir</th>
                <th className="px-4 py-3 font-semibold">Item Belanja</th>
                <th className="px-4 py-3 font-semibold">Metode Bayar</th>
                <th className="px-4 py-3 text-right font-semibold">Total Tagihan</th>
                <th className="px-4 py-3 text-center font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    Belum ada riwayat transaksi penjualan.
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => {
                  const dateStr = new Date(tx.createdAt).toLocaleString('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  });

                  return (
                    <tr key={tx.id} className="hover:bg-slate-850/60 transition">
                      {/* Invoice */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-slate-200">
                          {tx.invoiceNumber}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-slate-400">{dateStr}</td>

                      {/* Customer Name */}
                      <td className="px-4 py-3 text-slate-300 font-medium">
                        {tx.customerName || (
                          <span className="text-slate-500 italic">Pelanggan Umum</span>
                        )}
                      </td>

                      {/* Cashier */}
                      <td className="px-4 py-3 text-slate-300 font-medium">{tx.cashierName}</td>

                      {/* Items Count */}
                      <td className="px-4 py-3 text-slate-400">
                        {tx.items?.length || 0} item ({tx.items?.reduce((s, i) => s + i.quantity, 0) || 0} pcs)
                      </td>

                      {/* Payment Method */}
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          {tx.paymentMethod}
                        </span>
                      </td>

                      {/* Grand Total */}
                      <td className="px-4 py-3 text-right font-bold text-white font-mono">
                        {formatRupiah(tx.grandTotal)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedTxForReceipt(tx)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-xs transition"
                          title="Cetak Ulang Struk"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-400" />
                          <span>Struk</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Modal for Re-printing */}
      {selectedTxForReceipt && (
        <ReceiptModal
          transaction={selectedTxForReceipt}
          storeProfile={storeProfile}
          onClose={() => setSelectedTxForReceipt(null)}
        />
      )}
    </div>
  );
};
