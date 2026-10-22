import React, { useState } from 'react';
import { X, Save, AlertCircle, Barcode, Tag, Boxes, DollarSign, Sparkles } from 'lucide-react';
import { Product, Category, Unit } from '../../types/pos';
import { db } from '../../services/storage';

interface ProductFormModalProps {
  product: Product | null; // null if adding new
  categories: Category[];
  units: Unit[];
  onSave: () => void;
  onClose: () => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  product,
  categories,
  units,
  onSave,
  onClose,
}) => {
  const isEditing = !!product;

  const [sku, setSku] = useState(product?.sku || `PRD-${Date.now().toString().slice(-4)}`);
  const [barcode, setBarcode] = useState(product?.barcode || '');
  const [name, setName] = useState(product?.name || '');
  const [categoryId, setCategoryId] = useState<number>(
    product?.categoryId || (categories[0]?.id || 1)
  );
  const [unitId, setUnitId] = useState<number>(product?.unitId || (units[0]?.id || 1));
  const [buyPrice, setBuyPrice] = useState<string>(product?.buyPrice?.toString() || '0');
  const [sellPrice, setSellPrice] = useState<string>(product?.sellPrice?.toString() || '0');
  const [stock, setStock] = useState<string>(product?.stock?.toString() || '0');
  const [minStock, setMinStock] = useState<string>(product?.minStock?.toString() || '5');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const isServiceCategory = selectedCategory?.name.toLowerCase() === 'jasa';

  // Generate random 12-digit EAN-13 style barcode
  const generateRandomBarcode = () => {
    const random12 = '899' + Math.floor(100000000 + Math.random() * 900000000).toString();
    setBarcode(random12);
  };

  const handleClearBarcode = () => {
    setBarcode('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Nama produk tidak boleh kosong!');
      return;
    }

    const buy = parseFloat(buyPrice) || 0;
    const sell = parseFloat(sellPrice) || 0;
    const currentStock = isServiceCategory ? 999999 : parseFloat(stock) || 0;
    const minimumStock = isServiceCategory ? 0 : parseFloat(minStock) || 0;

    const selectedUnit = units.find((u) => u.id === unitId);
    const now = new Date().toISOString();

    if (isEditing && product) {
      await db.products.update(product.id, {
        sku: sku.trim(),
        barcode: barcode.trim(),
        name: name.trim(),
        categoryId,
        categoryName: selectedCategory?.name || 'Umum',
        unitId,
        unitName: selectedUnit?.symbol || 'PCS',
        buyPrice: buy,
        sellPrice: sell,
        stock: currentStock,
        minStock: minimumStock,
        isService: isServiceCategory,
        isActive: true,
        updatedAt: now,
      });
    } else {
      const newProduct: Omit<Product, 'id'> = {
        sku: sku.trim(),
        barcode: barcode.trim(),
        name: name.trim(),
        categoryId,
        categoryName: selectedCategory?.name || 'Umum',
        unitId,
        unitName: selectedUnit?.symbol || 'PCS',
        buyPrice: buy,
        sellPrice: sell,
        stock: currentStock,
        minStock: minimumStock,
        isService: isServiceCategory,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      await db.products.add(newProduct as any);
    }

    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">
              {isEditing ? 'Ubah Data Produk' : 'Tambah Produk / Jasa Baru'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Barcode & SKU Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                SKU / Kode Barang
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Barcode (Opsional)
                </label>
                <div className="flex items-center gap-2">
                  {barcode && (
                    <button
                      type="button"
                      onClick={handleClearBarcode}
                      className="text-[10px] text-slate-400 hover:text-rose-400"
                    >
                      Kosongkan
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={generateRandomBarcode}
                    className="text-[10px] text-emerald-400 hover:underline"
                  >
                    Generate Acak
                  </button>
                </div>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Boleh dikosongkan..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 font-mono placeholder:text-slate-600"
                />
                <Barcode className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
              </div>
            </div>
          </div>

          {/* Product Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Nama Produk / Layanan Jasa
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Instal Ulang Windows / SSD 512GB / Mouse Wireless"
              required
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Category & Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Kategori
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 font-medium"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Satuan Jual
              </label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 font-medium"
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Price (Buy vs Sell) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Harga Modal (HPP)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs text-slate-500 font-semibold">
                  Rp
                </span>
                <input
                  type="number"
                  min="0"
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Harga Jual Kasir
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs text-slate-500 font-semibold">
                  Rp
                </span>
                <input
                  type="number"
                  min="0"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-emerald-400 focus:outline-none focus:border-emerald-500 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Stock & Minimum Stock OR Unlimited Service Notice */}
          {isServiceCategory ? (
            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-blue-400 shrink-0" />
              <div>
                <p className="font-bold">Layanan Jasa — Stok Tak Terbatas (∞)</p>
                <p className="text-[11px] text-blue-300/80 mt-0.5">
                  Produk dengan kategori Jasa tidak memerlukan stok fisik dan dapat ditransaksikan kapan saja di kasir tanpa batas stok.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Stok Awal Fisik
                </label>
                <input
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Batas Minimum Stok (Peringatan)
                </label>
                <input
                  type="number"
                  min="0"
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-amber-400 focus:outline-none focus:border-emerald-500 font-bold"
                />
              </div>
            </div>
          )}

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
              <span>Simpan Produk</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
