import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Barcode, Tag, Boxes, DollarSign, Sparkles, Truck, ShieldCheck, Cpu, ArrowDownRight } from 'lucide-react';
import { Product, Category, Unit, Supplier, ProductCondition } from '../../types/pos';
import { db, getSuppliers } from '../../services/storage';
import { formatRupiah } from '../../services/cartCalculator';

interface ProductFormModalProps {
  product: Product | null; // null if adding new
  categories: Category[];
  units: Unit[];
  initialCategoryId?: number;
  initialCondition?: ProductCondition;
  onSave: () => void;
  onClose: () => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  product,
  categories,
  units,
  initialCategoryId,
  initialCondition,
  onSave,
  onClose,
}) => {
  const isEditing = !!product;

  const [sku, setSku] = useState(product?.sku || `PRD-${Date.now().toString().slice(-4)}`);
  const [barcode, setBarcode] = useState(product?.barcode || '');
  const [name, setName] = useState(product?.name || '');
  const [categoryId, setCategoryId] = useState<number>(
    product?.categoryId || initialCategoryId || (categories[0]?.id || 1)
  );
  const [unitId, setUnitId] = useState<number>(product?.unitId || (units[0]?.id || 1));
  const [supplierId, setSupplierId] = useState<number | undefined>(product?.supplierId);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [buyPrice, setBuyPrice] = useState<string>(product?.buyPrice?.toString() || '0');
  const [sellPrice, setSellPrice] = useState<string>(product?.sellPrice?.toString() || '0');
  const [stock, setStock] = useState<string>(product?.stock?.toString() || '1');
  const [minStock, setMinStock] = useState<string>(product?.minStock?.toString() || '1');

  // Spesifikasi Khusus Toko Komputer (Kondisi, Kelengkapan, Garansi, SN)
  const [condition, setCondition] = useState<ProductCondition>(
    product?.condition || initialCondition || 'BARU'
  );
  const [conditionNotes, setConditionNotes] = useState(product?.conditionNotes || '');
  const [completeness, setCompleteness] = useState(product?.completeness || '');
  const [warrantyPeriod, setWarrantyPeriod] = useState(product?.warrantyPeriod || '1 Bulan Toko');
  const [serialNumber, setSerialNumber] = useState(product?.serialNumber || '');

  // Pencatatan Kas Keluar (Beli unit = toko keluar uang)
  const [recordCashOut, setRecordCashOut] = useState<boolean>(!isEditing);
  const [cashOutSource, setCashOutSource] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [sellerName, setSellerName] = useState<string>('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    getSuppliers().then((items) => setSuppliers(items));
  }, []);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedSupplier = suppliers.find((s) => s.id === supplierId);
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
        supplierId: selectedSupplier ? selectedSupplier.id : undefined,
        supplierName: selectedSupplier ? selectedSupplier.name : undefined,
        buyPrice: buy,
        sellPrice: sell,
        stock: currentStock,
        minStock: minimumStock,
        isService: isServiceCategory,
        condition,
        conditionNotes: conditionNotes.trim() || undefined,
        completeness: completeness.trim() || undefined,
        warrantyPeriod: warrantyPeriod.trim() || undefined,
        serialNumber: serialNumber.trim() || undefined,
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
        supplierId: selectedSupplier ? selectedSupplier.id : undefined,
        supplierName: selectedSupplier ? selectedSupplier.name : undefined,
        buyPrice: buy,
        sellPrice: sell,
        stock: currentStock,
        minStock: minimumStock,
        isService: isServiceCategory,
        condition,
        conditionNotes: conditionNotes.trim() || undefined,
        completeness: completeness.trim() || undefined,
        warrantyPeriod: warrantyPeriod.trim() || undefined,
        serialNumber: serialNumber.trim() || undefined,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      const newProdId = await db.products.add(newProduct as any);

      // Record Kas Keluar Toko (Membeli laptop = keluar uang, bukan nambah uang)
      if (!isEditing && recordCashOut) {
        const totalBuyCost = buy * currentStock;
        if (totalBuyCost > 0) {
          await db.cashFlows.add({
            shiftId: 1,
            cashierId: 1,
            cashierName: 'Owner / Kasir',
            type: 'OUT',
            category:
              categoryId === 3
                ? 'Beli Unit Laptop dari Pelanggan/Supplier'
                : 'Pembelian Stok Barang Masuk',
            amount: totalBuyCost,
            note: `Beli unit ${name.trim()} (${currentStock}x @${formatRupiah(
              buy
            )}) ${sellerName ? `dari ${sellerName.trim()}` : ''} [Sumber: ${
              cashOutSource === 'CASH' ? 'Kas Laci Tunai' : 'Transfer Bank'
            }]`,
            createdAt: now,
          });

          await db.stockMovements.add({
            productId: newProdId as number,
            productName: name.trim(),
            type: 'IN_PURCHASE',
            quantity: currentStock,
            balanceAfter: currentStock,
            supplierName: sellerName.trim() || selectedSupplier?.name || 'Pelanggan / Supplier',
            referenceNo: `BELI-${Date.now().toString().slice(-6)}`,
            notes: `Pembelian unit laptop/barang - Uang kas keluar ${formatRupiah(totalBuyCost)}`,
            createdAt: now,
          } as any);
        }
      }
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

          {/* Supplier / Distributor */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Supplier / Pemasok (Opsional)
            </label>
            <div className="relative">
              <select
                value={supplierId ?? ''}
                onChange={(e) =>
                  setSupplierId(e.target.value === '' ? undefined : parseInt(e.target.value))
                }
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 font-medium"
              >
                <option value="">-- Tanpa Supplier / Pemasok Umum --</option>
                {suppliers.map((s) => (
                  <option key={s.id || s.name} value={s.id}>
                    {s.name} {s.phone ? `(${s.phone})` : ''}
                  </option>
                ))}
              </select>
              <Truck className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
            </div>
            {suppliers.length === 0 && (
              <p className="text-[10px] text-slate-500 mt-1">
                Belum ada supplier tersimpan. Anda dapat menambahkannya lewat tombol "Kelola Supplier" di menu Stok.
              </p>
            )}
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

          {/* Spesifikasi Khusus Komputer & Laptop: Kondisi, Kelengkapan, Garansi, SN */}
          {!isServiceCategory && (
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  Kondisi & Kelengkapan Laptop / Komponen
                </span>
                <span className="text-[10px] text-slate-500">Khusus Toko Komputer</span>
              </div>

              {/* Pilihan Kondisi Unit */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Kondisi Barang:
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      { key: 'BARU', label: 'Baru', desc: 'Segel / BNIB', color: 'border-emerald-600 bg-emerald-950/40 text-emerald-300' },
                      { key: 'BEKAS', label: 'Bekas (Normal)', desc: 'Mulus 100% normal', color: 'border-blue-600 bg-blue-950/40 text-blue-300' },
                      { key: 'MINUS', label: 'Bekas (Minus)', desc: 'Ada cacat / minus', color: 'border-amber-600 bg-amber-950/40 text-amber-300' },
                      { key: 'MATOT', label: 'Matot / Kanibal', desc: 'Mati total / bahan sparepart', color: 'border-rose-600 bg-rose-950/40 text-rose-300' },
                    ] as const
                  ).map((c) => (
                    <button
                      type="button"
                      key={c.key}
                      onClick={() => setCondition(c.key)}
                      className={`p-2 rounded-lg border text-left transition flex flex-col justify-between ${
                        condition === c.key
                          ? `${c.color} ring-1 ring-emerald-500 font-bold`
                          : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-xs">{c.label}</span>
                      <span className="text-[9px] opacity-75 mt-0.5 leading-tight">{c.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Detail Kerusakan / Minus jika bukan BARU */}
              {condition !== 'BARU' && (
                <div>
                  <label className="block text-[11px] font-semibold text-amber-400 mb-1">
                    Detail Kerusakan / Catatan Minus Fisik:
                  </label>
                  <input
                    type="text"
                    value={conditionNotes}
                    onChange={(e) => setConditionNotes(e.target.value)}
                    placeholder="Contoh: Baterai drop, engsel kanan longgar, lecet casing wajar..."
                    className="w-full px-3 py-1.5 bg-slate-950 border border-amber-900/60 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              {/* Kelengkapan Unit & Serial Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Kelengkapan Unit (Laptop / Printer / PC):
                  </label>
                  <input
                    type="text"
                    value={completeness}
                    onChange={(e) => setCompleteness(e.target.value)}
                    placeholder="Unit + Charger + Dus, Kabel USB Printer..."
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {[
                      'Fullset Box',
                      'Unit + Charger',
                      'Kabel Power',
                      'Kabel USB Printer',
                      'Adaptor Printer',
                      'Cartridge / Head',
                      'Tabung Infus',
                      'Batangan Saja',
                    ].map((tag) => (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => {
                          const current = completeness ? completeness.split(',').map((s) => s.trim()).filter(Boolean) : [];
                          if (current.includes(tag)) {
                            setCompleteness(current.filter((t) => t !== tag).join(', '));
                          } else {
                            setCompleteness([...current, tag].join(', '));
                          }
                        }}
                        className={`text-[9px] px-1.5 py-0.5 rounded transition ${
                          completeness.includes(tag)
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                        }`}
                      >
                        {completeness.includes(tag) ? `✓ ${tag}` : `+ ${tag}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Masa Garansi Toko / Pabrik:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={warrantyPeriod}
                      onChange={(e) => setWarrantyPeriod(e.target.value)}
                      placeholder="1 Bulan Toko / 1 Tahun Resmi..."
                      className="w-full pl-7 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2" />
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {['3 Hari Tes', '7 Hari Toko', '1 Bulan Toko', '3 Bulan Toko', '1 Tahun Resmi', 'Non Garansi'].map((w) => (
                      <button
                        type="button"
                        key={w}
                        onClick={() => setWarrantyPeriod(w)}
                        className={`text-[9px] px-1.5 py-0.5 rounded transition ${
                          warrantyPeriod === w
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick Chips Minus untuk Printer / Komputer jika bukan BARU */}
              {condition !== 'BARU' && (
                <div className="pt-2 border-t border-slate-800/60">
                  <span className="text-[10px] text-slate-400 block mb-1">Pilih Cepat Minus Printer / PC / Laptop:</span>
                  <div className="flex flex-wrap gap-1">
                    {[
                      'Head Buntu / Bergaris',
                      'Roller Aus / Paper Jam',
                      'Blink Error (Waste Pad)',
                      'Infus Masuk Angin/Bocor',
                      'Baterai Drop',
                      'Engsel Longgar',
                      'Lecet Pemakaian',
                      'No Display / Matot',
                    ].map((m) => (
                      <button
                        type="button"
                        key={m}
                        onClick={() => {
                          const current = conditionNotes ? conditionNotes.split(',').map((s) => s.trim()).filter(Boolean) : [];
                          if (current.includes(m)) {
                            setConditionNotes(current.filter((t) => t !== m).join(', '));
                          } else {
                            setConditionNotes([...current, m].join(', '));
                          }
                        }}
                        className={`text-[9px] px-1.5 py-0.5 rounded transition ${
                          conditionNotes.includes(m)
                            ? 'bg-amber-600 text-white font-bold'
                            : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                        }`}
                      >
                        {conditionNotes.includes(m) ? `✓ ${m}` : `+ ${m}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Serial Number (SN / IMEI) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Serial Number / No. Seri Mesin (Opsional):
                </label>
                <input
                  type="text"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="SN: LNV-PF123456 / Cek di stiker belakang laptop"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

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

          {/* Pencatatan Keuangan Pembelian Unit (Kas Keluar Toko - Beli Laptop = Uang Keluar) */}
          {!isEditing && !isServiceCategory && (
            <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-bold text-rose-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recordCashOut}
                    onChange={(e) => setRecordCashOut(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 bg-slate-950 border-slate-700 cursor-pointer"
                  />
                  <span>Catat Pembelian Unit Ini Sebagai Kas Keluar Toko</span>
                </label>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-rose-900/60 text-rose-200 border border-rose-700/60 uppercase">
                  Uang Keluar
                </span>
              </div>

              {recordCashOut && (
                <div className="space-y-2 pt-2 border-t border-rose-900/40 text-xs">
                  <div className="p-2.5 rounded-lg bg-rose-900/30 border border-rose-800/40 flex items-center justify-between">
                    <span className="text-slate-300 text-[11px]">
                      Total Uang Modal Keluar ({stock} unit x {formatRupiah(parseFloat(buyPrice) || 0)}):
                    </span>
                    <span className="text-base font-black text-rose-400 font-mono">
                      -{formatRupiah((parseFloat(buyPrice) || 0) * (parseFloat(stock) || 0))}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">
                        Sumber Kas Toko:
                      </label>
                      <select
                        value={cashOutSource}
                        onChange={(e) => setCashOutSource(e.target.value as 'CASH' | 'TRANSFER')}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                      >
                        <option value="CASH">💵 Kas Tunai di Laci Kasir (Saldo Laci Berkurang)</option>
                        <option value="TRANSFER">🏦 Transfer Bank Rekening Toko</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">
                        Dibeli Dari (Customer / Supplier):
                      </label>
                      <input
                        type="text"
                        value={sellerName}
                        onChange={(e) => setSellerName(e.target.value)}
                        placeholder="Contoh: Bpk. Hendra (Beli Laptop Second)"
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-600"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">
                    * Membeli laptop/hardware berarti kas toko berkurang (uang keluar) untuk menambah persediaan unit barang.
                  </p>
                </div>
              )}
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
