import React from 'react';
import { X, PauseCircle, Play, Trash2, Clock, ShoppingCart } from 'lucide-react';
import { HeldCart } from '../../types/pos';
import { formatRupiah } from '../../services/cartCalculator';

interface HoldCartModalProps {
  heldCarts: HeldCart[];
  onResume: (cart: HeldCart) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const HoldCartModal: React.FC<HoldCartModalProps> = ({
  heldCarts,
  onResume,
  onDelete,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PauseCircle className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">Daftar Antrean Tertahan (Parkir Cart)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {heldCarts.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Tidak ada transaksi yang sedang diparkir/ditahan.</p>
              <p className="text-xs text-slate-600 mt-1">
                Gunakan tombol [Parkir F4] di kasir untuk menahan antrean pelanggan.
              </p>
            </div>
          ) : (
            heldCarts.map((cart) => {
              const totalAmount = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
              const totalQty = cart.items.reduce((sum, item) => sum + item.quantity, 0);
              const timeStr = new Date(cart.heldAt).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={cart.id}
                  className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between hover:border-slate-600 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{cart.label}</span>
                      <span className="flex items-center gap-1 text-[11px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                        <Clock className="w-3 h-3 text-amber-400" />
                        {timeStr}
                      </span>
                    </div>
                    <div className="text-xs text-slate-200 font-medium">
                      {totalQty} item produk •{' '}
                      <span className="font-semibold text-emerald-400">
                        {formatRupiah(totalAmount)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 truncate max-w-sm font-medium">
                      {cart.items.map((i) => `${i.name} (${i.quantity})`).join(', ')}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onDelete(cart.id)}
                      className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/10 transition"
                      title="Hapus antrean"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onResume(cart)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md shadow-emerald-950/30"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Lanjutkan</span>
                    </button>
                  </div>
                </div>
              );
            })
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
