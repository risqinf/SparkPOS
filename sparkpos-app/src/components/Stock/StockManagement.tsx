import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  ClipboardCheck,
  History,
  Edit2,
  Trash2,
  DollarSign,
  PackageX,
  Lock,
} from 'lucide-react';
import { Product, Category, Unit, Employee } from '../../types/pos';
import { formatRupiah } from '../../services/cartCalculator';
import { db } from '../../services/storage';
import { ProductFormModal } from './ProductFormModal';
import { StockOpnameModal } from './StockOpnameModal';
import { StockHistoryModal } from './StockHistoryModal';

interface StockManagementProps {
  currentUser?: Employee | null;
  onRequestAdminAccess?: () => void;
}

export const StockManagement: React.FC<StockManagementProps> = ({
  currentUser,
  onRequestAdminAccess,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProductToEdit, setSelectedProductToEdit] = useState<Product | null>(null);

  const [isOpnameOpen, setIsOpnameOpen] = useState(false);
  const [selectedProductForOpname, setSelectedProductForOpname] = useState<Product | null>(null);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<Product | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  const loadData = async () => {
    const prods = await db.products.where('isActive').equals(1 as any).toArray();
    const cats = await db.categories.toArray();
    const u = await db.units.toArray();
    setProducts(prods);
    setCategories(cats);
    setUnits(u);
  };

  useEffect(() => {
    loadData();
  }, []);

  // KPI Calculations
  const totalSku = products.length;
  const totalStockValueHpp = products.reduce((sum, p) => sum + p.buyPrice * p.stock, 0);
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
  const zeroStockCount = products.filter((p) => p.stock <= 0).length;

  // Filtered List
  const filteredProducts = products.filter((p) => {
    const matchCategory = selectedCategoryId === null || p.categoryId === selectedCategoryId;
    const matchSearch =
      searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchLowStock = !filterLowStockOnly || p.stock <= p.minStock;
    return matchCategory && matchSearch && matchLowStock;
  });

  const handleDeleteProduct = async (product: Product) => {
    if (!isAdmin) {
      if (onRequestAdminAccess) onRequestAdminAccess();
      return;
    }
    if (confirm(`Yakin ingin menghapus produk "${product.name}"?`)) {
      await db.products.update(product.id, { isActive: false });
      await loadData();
    }
  };

  const handleOpenAddProduct = () => {
    if (!isAdmin) {
      if (onRequestAdminAccess) onRequestAdminAccess();
      return;
    }
    setSelectedProductToEdit(null);
    setIsFormOpen(true);
  };

  const handleOpenEditProduct = (p: Product) => {
    if (!isAdmin) {
      if (onRequestAdminAccess) onRequestAdminAccess();
      return;
    }
    setSelectedProductToEdit(p);
    setIsFormOpen(true);
  };

  const handleOpenOpname = (p?: Product) => {
    if (!isAdmin) {
      if (onRequestAdminAccess) onRequestAdminAccess();
      return;
    }
    setSelectedProductForOpname(p || null);
    setIsOpnameOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col p-5 bg-slate-950 overflow-hidden select-none">
      {/* ================= TOP 4 KPI CARDS (Restrained Minimalist) ================= */}
      <div className="grid grid-cols-4 gap-3.5 mb-4 shrink-0">
        {/* Total SKU */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">
              Total Master SKU
            </span>
            <div className="text-xl font-bold text-white mt-0.5">{totalSku} Produk</div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Aktif di Katalog
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-850 border border-slate-800 flex items-center justify-center text-slate-400">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        {/* Nilai HPP */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">
              Nilai Persediaan (HPP)
            </span>
            <div className="text-xl font-bold text-slate-100 mt-0.5">
              {formatRupiah(totalStockValueHpp)}
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Modal barang berjalan
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-850 border border-slate-800 flex items-center justify-center text-slate-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Stok Menipis */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">
              Stok Menipis (Warning)
            </span>
            <div className="text-xl font-bold text-slate-100 mt-0.5 flex items-center gap-1.5">
              <span>{lowStockCount} SKU</span>
              {lowStockCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Di bawah batas minimum
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-850 border border-slate-800 flex items-center justify-center text-slate-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Stok Habis */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">
              Stok Habis (Kosong)
            </span>
            <div className="text-xl font-bold text-slate-100 mt-0.5 flex items-center gap-1.5">
              <span>{zeroStockCount} SKU</span>
              {zeroStockCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Perlu order ulang
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-850 border border-slate-800 flex items-center justify-center text-slate-400">
            <PackageX className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ================= FILTER & ACTION TOOLBAR ================= */}
      <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          {/* Search Box */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari barcode, nama produk, atau SKU..."
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategoryId ?? ''}
            onChange={(e) =>
              setSelectedCategoryId(e.target.value === '' ? null : parseInt(e.target.value))
            }
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
          >
            <option value="">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Low Stock Filter Button */}
          <button
            onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition border ${
              filterLowStockOnly
                ? 'bg-slate-800 border-slate-700 text-white'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Perlu Restock</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Stock Opname */}
          <button
            onClick={() => handleOpenOpname()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 text-xs font-medium transition"
          >
            <ClipboardCheck className="w-4 h-4 text-slate-400" />
            <span>Stock Opname</span>
            {!isAdmin && <Lock className="w-3 h-3 text-slate-600" />}
          </button>

          {/* History */}
          <button
            onClick={() => {
              setSelectedProductForHistory(null);
              setIsHistoryOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 text-xs font-medium transition"
          >
            <History className="w-4 h-4 text-slate-400" />
            <span>Riwayat Mutasi</span>
          </button>

          {/* Add Product Button */}
          <button
            onClick={handleOpenAddProduct}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Produk</span>
            {!isAdmin && <Lock className="w-3 h-3 text-emerald-200" />}
          </button>
        </div>
      </div>

      {/* ================= PRODUCT DATA TABLE ================= */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-sm">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] sticky top-0 z-10 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold">Produk & Barcode</th>
                <th className="px-4 py-3 font-semibold">Kategori</th>
                <th className="px-4 py-3 text-right font-semibold">Harga Modal</th>
                <th className="px-4 py-3 text-right font-semibold">Harga Jual</th>
                <th className="px-4 py-3 text-right font-semibold">Margin</th>
                <th className="px-4 py-3 text-center font-semibold">Stok</th>
                <th className="px-4 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    Tidak ada produk yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const marginNominal = p.sellPrice - p.buyPrice;
                  const marginPercent =
                    p.buyPrice > 0 ? Math.round((marginNominal / p.buyPrice) * 100) : 0;
                  const isOutOfStock = p.stock <= 0;
                  const isLowStock = p.stock > 0 && p.stock <= p.minStock;

                  return (
                    <tr key={p.id} className="hover:bg-slate-850/60 transition">
                      {/* Name & Barcode */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-200 text-xs">{p.name}</div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span className="font-mono text-slate-400">{p.barcode}</span>
                          <span>•</span>
                          <span className="font-mono">{p.sku}</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3 text-slate-400">{p.categoryName || '-'}</td>

                      {/* Buy Price */}
                      <td className="px-4 py-3 text-right text-slate-400 font-medium">
                        {formatRupiah(p.buyPrice)}
                      </td>

                      {/* Sell Price */}
                      <td className="px-4 py-3 text-right font-semibold text-white">
                        {formatRupiah(p.sellPrice)}
                        <span className="text-[10px] text-slate-500 font-normal">
                          /{p.unitName}
                        </span>
                      </td>

                      {/* Margin */}
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs text-slate-300">
                          +{formatRupiah(marginNominal)}
                        </span>
                        <div className="text-[10px] text-slate-500">
                          ({marginPercent}%)
                        </div>
                      </td>

                      {/* Stock Status */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            isOutOfStock
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : isLowStock
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-slate-800 text-slate-200 border border-slate-700'
                          }`}
                        >
                          {p.stock} {p.unitName}
                        </span>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Min: {p.minStock} {p.unitName}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Opname */}
                          <button
                            onClick={() => handleOpenOpname(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                            title="Penyesuaian Stok Fisik (Opname)"
                          >
                            <ClipboardCheck className="w-4 h-4" />
                          </button>

                          {/* History */}
                          <button
                            onClick={() => {
                              setSelectedProductForHistory(p);
                              setIsHistoryOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                            title="Lihat Riwayat Mutasi Kartu Stok"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => handleOpenEditProduct(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                            title="Edit Data Produk (Admin)"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                            title="Hapus Produk (Admin)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Info */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Menampilkan {filteredProducts.length} dari total {products.length} SKU</span>
          {!isAdmin && (
            <span className="text-[11px] text-slate-500">
              * Mode Kasir: Modifikasi harga & hapus produk memerlukan hak Administrator.
            </span>
          )}
        </div>
      </div>

      {/* Modals */}
      {isFormOpen && (
        <ProductFormModal
          product={selectedProductToEdit}
          categories={categories}
          units={units}
          onSave={() => {
            setIsFormOpen(false);
            loadData();
          }}
          onClose={() => setIsFormOpen(false)}
        />
      )}

      {isOpnameOpen && (
        <StockOpnameModal
          initialProduct={selectedProductForOpname}
          products={products}
          onSuccess={() => {
            setIsOpnameOpen(false);
            loadData();
          }}
          onClose={() => setIsOpnameOpen(false)}
        />
      )}

      {isHistoryOpen && (
        <StockHistoryModal
          product={selectedProductForHistory}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}
    </div>
  );
};
