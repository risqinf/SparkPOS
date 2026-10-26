import React, { useEffect, useState } from 'react';
import { X, History, ArrowDownRight, ArrowUpRight, RefreshCw } from 'lucide-react';
import { StockMovement, Product } from '../../types/pos';
import { db } from '../../services/storage';
import { useDialog } from '../../hooks/useDialog';

interface StockHistoryModalProps {
  product?: Product | null;
  onClose: () => void;
}

export const StockHistoryModal: React.FC<StockHistoryModalProps> = ({ product, onClose }) => {
  const dialogRef = useDialog<HTMLDivElement>(true, onClose);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  const loadMovements = async () => {
    if (product) {
      const list = await db.stockMovements
        .where('productId')
        .equals(product.id)
        .reverse()
        .sortBy('createdAt');
      setMovements(list);
    } else {
      const list = await db.stockMovements.reverse().sortBy('createdAt');
      setMovements(list.slice(0, 100)); // limit to latest 100
    }
  };

  useEffect(() => {
    loadMovements();
  }, [product]);

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-white">
                {product ? `Riwayat Mutasi: ${product.name}` : 'Semua Riwayat Mutasi Stok'}
              </h2>
              {product && (
                <div className="text-xs text-slate-400">
                  Barcode: <span className="font-mono text-emerald-400">{product.barcode}</span> •
                  Stok Sekarang: <span className="font-bold text-white">{product.stock} {product.unitName}</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Table */}
        <div className="p-5 overflow-y-auto flex-1">
          {movements.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <History className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Belum ada catatan mutasi stok untuk produk ini.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-3 py-2.5 rounded-l-lg">Waktu</th>
                  {!product && <th className="px-3 py-2.5">Produk</th>}
                  <th className="px-3 py-2.5">Tipe Mutasi</th>
                  <th className="px-3 py-2.5 text-right">Jumlah</th>
                  <th className="px-3 py-2.5 text-right">Saldo Akhir</th>
                  <th className="px-3 py-2.5 rounded-r-lg">Keterangan / Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {movements.map((m) => {
                  const isOut = m.type === 'OUT_SALE' || m.type === 'ADJUSTMENT_OUT';
                  const dateStr = new Date(m.createdAt).toLocaleString('id-ID', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  });

                  return (
                    <tr key={m.id} className="hover:bg-slate-800/40">
                      <td className="px-3 py-3 text-slate-400 whitespace-nowrap">{dateStr}</td>
                      {!product && (
                        <td className="px-3 py-3 font-semibold text-slate-200">{m.productName}</td>
                      )}
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            isOut
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {isOut ? (
                            <ArrowDownRight className="w-3 h-3" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3" />
                          )}
                          <span>
                            {m.type === 'OUT_SALE'
                              ? 'Penjualan Kasir'
                              : m.type === 'ADJUSTMENT_OUT'
                              ? 'Koreksi Kurang'
                              : m.type === 'ADJUSTMENT_IN'
                              ? 'Koreksi Tambah'
                              : m.type === 'IN_PURCHASE'
                              ? 'Restock Masuk'
                              : 'Mutasi'}
                          </span>
                        </span>
                      </td>
                      <td
                        className={`px-3 py-3 text-right font-bold ${
                          isOut ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {isOut ? `-${m.quantity}` : `+${m.quantity}`}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-slate-200">
                        {m.balanceAfter}
                      </td>
                      <td className="px-3 py-3 text-slate-400">
                        <span className="font-mono text-slate-500 mr-1.5">{m.referenceNo}</span>
                        <span>{m.notes}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-850 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750 font-semibold text-xs transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
