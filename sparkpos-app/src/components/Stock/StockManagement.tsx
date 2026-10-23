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
  Truck,
  FileSpreadsheet,
  Package,
  ShieldCheck,
  Copy,
  Check,
  FileDown,
} from 'lucide-react';
import { Product, Category, Unit, Employee } from '../../types/pos';
import { formatRupiah } from '../../services/cartCalculator';
import { db, getActiveProducts } from '../../services/storage';
import { ProductFormModal } from './ProductFormModal';
import { StockOpnameModal } from './StockOpnameModal';
import { StockHistoryModal } from './StockHistoryModal';
import { SupplierManagementModal } from '../Supplier/SupplierManagementModal';
import { exportStockToExcel, copyStockToClipboard } from '../../services/excelExport';

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
  const [isCopied, setIsCopied] = useState(false);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProductToEdit, setSelectedProductToEdit] = useState<Product | null>(null);

  const [isOpnameOpen, setIsOpnameOpen] = useState(false);
  const [selectedProductForOpname, setSelectedProductForOpname] = useState<Product | null>(null);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<Product | null>(null);

  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);

  const isAdmin = currentUser?.role === 'owner' || currentUser?.role === 'admin';

  const loadData = async () => {
    const prods = await getActiveProducts();
    const cats = await db.categories.toArray();
    const u = await db.units.toArray();
    setProducts(prods);
    setCategories(cats);
    setUnits(u);
  };

  useEffect(() => {
    loadData();
  }, []);

  // KPI Calculations (Exclude unlimited services from low-stock warnings)
  const totalSku = products.length;
  const physicalProducts = products.filter(
    (p) => !p.isService && p.categoryName?.toLowerCase() !== 'jasa'
  );
  const totalStockValueHpp = physicalProducts.reduce((sum, p) => sum + p.buyPrice * p.stock, 0);
  const lowStockCount = physicalProducts.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
  const zeroStockCount = physicalProducts.filter((p) => p.stock <= 0).length;

  // Filtered List
  const filteredProducts = products.filter((p) => {
    const matchCategory = selectedCategoryId === null || p.categoryId === selectedCategoryId;
    const matchSearch =
      searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery)) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const isService = p.isService || p.categoryName?.toLowerCase() === 'jasa';
    const matchLowStock = !filterLowStockOnly || (!isService && p.stock <= p.minStock);
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
    setSelectedProductToEdit(null);
    setIsFormOpen(true);
  };

  const handleOpenEditProduct = (p: Product) => {
    setSelectedProductToEdit(p);
    setIsFormOpen(true);
  };

  const handleOpenOpname = (p?: Product) => {
    setSelectedProductForOpname(p || null);
    setIsOpnameOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col p-3 lg:p-5 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden select-none">
      {/* ================= TOP 4 KPI CARDS (Restrained Minimalist) ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-3.5 mb-3 shrink-0">
        {/* Total SKU */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              Total Master SKU
            </span>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{totalSku} Produk</div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
              Aktif di Katalog
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
            <Boxes className="w-4.5 h-4.5" />
          </div>
        </div>

        {/* Nilai HPP */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              Nilai Persediaan (HPP)
            </span>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {formatRupiah(totalStockValueHpp)}
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
              Modal barang berjalan
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <DollarSign className="w-4.5 h-4.5" />
          </div>
        </div>

        {/* Stok Menipis */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              Stok Menipis (Warning)
            </span>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5 flex items-center gap-1.5">
              <span>{lowStockCount} SKU</span>
              {lowStockCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
              Di bawah batas minimum
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-slate-850 border border-amber-200 dark:border-slate-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
        </div>

        {/* Stok Habis */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              Stok Habis (Kosong)
            </span>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5 flex items-center gap-1.5">
              <span>{zeroStockCount} SKU</span>
              {zeroStockCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
              Perlu order ulang
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-rose-50 dark:bg-slate-850 border border-rose-200 dark:border-slate-800 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <PackageX className="w-4.5 h-4.5" />
          </div>
        </div>
      </div>

      {/* ================= FILTER & ACTION TOOLBAR ================= */}
      <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 max-w-2xl">
          {/* Search Box */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari barcode, nama produk, atau SKU..."
              className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 shadow-2xs"
            />
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2" />
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategoryId ?? ''}
            onChange={(e) =>
              setSelectedCategoryId(e.target.value === '' ? null : parseInt(e.target.value))
            }
            className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 font-medium shadow-2xs"
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
            className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition border shadow-2xs ${
              filterLowStockOnly
                ? 'bg-slate-900 dark:bg-slate-800 border-slate-900 dark:border-slate-700 text-white'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Perlu Restock</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Stock Opname */}
          <button
            onClick={() => handleOpenOpname()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition shadow-2xs"
          >
            <ClipboardCheck className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>Stock Opname</span>
            {!isAdmin && <Lock className="w-3 h-3 text-slate-400" />}
          </button>

          {/* History */}
          <button
            onClick={() => {
              setSelectedProductForHistory(null);
              setIsHistoryOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition shadow-2xs"
          >
            <History className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>Riwayat Mutasi</span>
          </button>

          {/* Supplier Management */}
          <button
            onClick={() => setIsSupplierModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition shadow-2xs cursor-pointer"
            title="Kelola data distributor & pemasok hardware/sparepart"
          >
            <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Supplier</span>
          </button>

          {/* DUAL EXPORT 1: Salin ke Clipboard (Format Excel TSV) */}
          <button
            onClick={async () => {
              const ok = await copyStockToClipboard(filteredProducts);
              if (ok) {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2500);
              }
            }}
            disabled={filteredProducts.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 disabled:opacity-50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold transition shadow-2xs cursor-pointer"
            title="Salin data stok ke clipboard siap paste (Ctrl+V) di Excel"
          >
            {isCopied ? (
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            )}
            <span>{isCopied ? 'Tersalin!' : 'Salin Excel'}</span>
          </button>

          {/* DUAL EXPORT 2: Unduh File (.csv) */}
          <button
            onClick={() => exportStockToExcel(filteredProducts)}
            disabled={filteredProducts.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 disabled:opacity-50 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold transition shadow-2xs cursor-pointer"
            title="Unduh laporan daftar stok produk & valuasi aset ke file Excel (.csv)"
          >
            <FileDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Unduh (.csv)</span>
          </button>

          {/* Add Product Button */}
          <button
            onClick={handleOpenAddProduct}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-xs active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Produk</span>
            {!isAdmin && <Lock className="w-3 h-3 text-emerald-200" />}
          </button>
        </div>
      </div>

      {/* ================= PRODUCT DATA TABLE (DATABASE-LIKE HORIZONTAL LAYOUT) ================= */}
      <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xs">
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-950/80 text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 font-extrabold">
              <tr>
                <th className="px-3.5 py-2.5">KODE / SKU</th>
                <th className="px-3.5 py-2.5">BARCODE</th>
                <th className="px-3.5 py-2.5">NAMA PRODUK</th>
                <th className="px-3.5 py-2.5">TIPE / KATEGORI</th>
                <th className="px-3.5 py-2.5 text-right">HARGA MODAL (HPP)</th>
                <th className="px-3.5 py-2.5 text-right">HARGA JUAL</th>
                <th className="px-3.5 py-2.5 text-right">MARGIN</th>
                <th className="px-3.5 py-2.5 text-center">STOK FISIK</th>
                <th className="px-3.5 py-2.5 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400 dark:text-slate-500">
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
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60 transition">
                      {/* SKU */}
                      <td className="px-3.5 py-2.5 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {p.sku}
                      </td>

                      {/* Barcode */}
                      <td className="px-3.5 py-2.5 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {p.barcode || '-'}
                      </td>

                      {/* Name & Badges */}
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                            {p.name}
                          </span>
                          {p.condition && p.condition !== 'BARU' ? (
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase tracking-wider ${
                                p.condition === 'MATOT'
                                  ? 'bg-rose-950/60 text-rose-400 border border-rose-800/80'
                                  : p.condition === 'MINUS'
                                  ? 'bg-amber-950/60 text-amber-400 border border-amber-800/80'
                                  : 'bg-blue-950/60 text-blue-400 border border-blue-800/80'
                              }`}
                            >
                              {p.condition}
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase tracking-wider bg-emerald-950/60 text-emerald-400 border border-emerald-800/80">
                              BARU
                            </span>
                          )}
                          {p.warrantyPeriod && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center">
                              <ShieldCheck className="w-3 h-3 mr-0.5" />
                              {p.warrantyPeriod}
                            </span>
                          )}
                        </div>

                        {p.supplierName && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Supplier: {p.supplierName}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                          {p.categoryName || 'Umum'}
                        </span>
                      </td>

                      {/* Buy Price */}
                      <td className="px-3.5 py-2.5 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatRupiah(p.buyPrice)}
                      </td>

                      {/* Sell Price */}
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatRupiah(p.sellPrice)}
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal ml-0.5">
                          /{p.unitName}
                        </span>
                      </td>

                      {/* Margin */}
                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          +{formatRupiah(marginNominal)}
                        </span>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold font-mono">
                          ({marginPercent}%)
                        </div>
                      </td>

                      {/* Stock Status */}
                      <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                        {p.isService || p.categoryName?.toLowerCase() === 'jasa' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                            Jasa (∞)
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                              isOutOfStock
                                ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                                : isLowStock
                                ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            }`}
                          >
                            {p.stock} {p.unitName}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
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

      {isSupplierModalOpen && (
        <SupplierManagementModal
          isOpen={isSupplierModalOpen}
          onClose={() => {
            setIsSupplierModalOpen(false);
            loadData();
          }}
        />
      )}
    </div>
  );
};
