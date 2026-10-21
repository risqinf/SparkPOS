import React, { useState } from 'react';
import { X, ClipboardCheck, ArrowRight, Save, AlertTriangle } from 'lucide-react';
import { Product } from '../../types/pos';
import { db } from '../../services/storage';

interface StockOpnameModalProps {
  products: Product[];
  initialProduct?: Product | null;
  onSuccess: () => void;
  onClose: () => void;
}

export const StockOpnameModal: React.FC<StockOpnameModalProps> = ({
  products,
  initialProduct,
  onSuccess,
  onClose,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<number>(
    initialProduct?.id || products[0]?.id || 1
  );
  const [physicalCountStr, setPhysicalCountStr] = useState<string>('');
  const [reason, setReason] = useState<string>('Barang Rusak / Pecah');
  const [notes, setNotes] = useState<string>('');

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const systemStock = selectedProduct?.stock || 0;
  const physicalCount = parseFloat(physicalCountStr) || 0;
  const discrepancy = physicalCount - systemStock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    if (discrepancy === 0) {
      if (!confirm('Jumlah fisik sama persis dengan sistem (tidak ada selisih). Lanjutkan simpan?')) {
        return;
      }
    }

    const now = new Date().toISOString();
    const type = discrepancy >= 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';

    // 1. Update Product Stock
    await db.products.update(selectedProduct.id, {
      stock: physicalCount,
      updatedAt: now,
    });

    // 2. Record Stock Movement
    await db.stockMovements.add({
      id: 0,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      type,
      quantity: Math.abs(discrepancy),
      balanceAfter: physicalCount,
      referenceNo: `OPN-${Date.now().toString().slice(-6)}`,
      notes: `${reason}${notes ? ` - ${notes}` : ''}`,
      createdAt: now,
    } as any);

    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Stock Opname / Penyesuaian Stok Fisik</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Select Product */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Pilih Produk
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => {
                const id = parseInt(e.target.value);
                setSelectedProductId(id);
                const p = products.find((prod) => prod.id === id);
                if (p) setPhysicalCountStr(p.stock.toString());
              }}
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Stok Sistem: {p.stock} {p.unitName})
                </option>
              ))}
            </select>
          </div>

          {/* Comparison Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
              <span className="text-[11px] text-slate-400 font-medium block">Stok di Sistem:</span>
              <div className="text-2xl font-black text-white mt-1">
                {systemStock}{' '}
                <span className="text-xs font-normal text-slate-400">{selectedProduct?.unitName}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                Jumlah Riil di Toko/Rak:
              </label>
              <input
                type="number"
                autoFocus
                required
                value={physicalCountStr}
                onChange={(e) => setPhysicalCountStr(e.target.value)}
                placeholder="Jumlah riil..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-2xl font-black text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Discrepancy Alert */}
          {physicalCountStr !== '' && (
            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                discrepancy === 0
                  ? 'bg-slate-800 border-slate-700 text-slate-300'
                  : discrepancy > 0
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800 text-rose-300'
              }`}
            >
              <span>Hasil Selisih Fisik:</span>
              <span className="text-sm font-bold">
                {discrepancy > 0 ? `+${discrepancy}` : discrepancy} {selectedProduct?.unitName}{' '}
                {discrepancy > 0
                  ? '(Kelebihan Fisik)'
                  : discrepancy < 0
                  ? '(Kekurangan Fisik)'
                  : '(Sesuai)'}
              </span>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Alasan Penyesuaian
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="Barang Rusak / Pecah">Barang Rusak / Pecah</option>
              <option value="Barang Kadaluarsa (Expired)">Barang Kadaluarsa (Expired)</option>
              <option value="Hilang / Selisih Fisik Kasir">Hilang / Selisih Fisik Kasir</option>
              <option value="Koreksi Input Stok Awal">Koreksi Input Stok Awal</option>
              <option value="Bonus / Retur Masuk Supplier">Bonus / Retur Masuk Supplier</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>

          {/* Optional Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Catatan Tambahan (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Ditemukan bocor di rak belakang"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750 font-semibold text-xs"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md shadow-emerald-950/40"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Penyesuaian</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
