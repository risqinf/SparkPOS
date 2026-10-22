import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  PauseCircle,
  Tag,
  CreditCard,
  ShoppingCart,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  LogOut,
  Users,
  User,
  Truck,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  Product,
  Category,
  CartItem,
  CartSummary,
  StoreProfile,
  Shift,
  PaymentEntry,
  Transaction,
  HeldCart,
  Employee,
} from '../../types/pos';
import { calculateCartSummary, formatRupiah } from '../../services/cartCalculator';
import { barcodeScanner, playSuccessBeep, playErrorBeep } from '../../services/scanner';
import { db, getActiveProducts } from '../../services/storage';
import { PaymentModal } from './PaymentModal';
import { HoldCartModal } from './HoldCartModal';
import { DiscountModal } from './DiscountModal';
import { ReceiptModal } from './ReceiptModal';

interface POSTerminalProps {
  storeProfile: StoreProfile;
  activeShift: Shift | null;
  heldCarts: HeldCart[];
  onUpdateHeldCarts: () => void;
  openHeldModal: () => void;
  isHeldModalOpen: boolean;
  setIsHeldModalOpen: (open: boolean) => void;
  currentUser?: Employee | null;
  onLogout?: () => void;
  onOpenCashierManagement?: () => void;
}

export const POSTerminal: React.FC<POSTerminalProps> = ({
  storeProfile,
  activeShift,
  heldCarts,
  onUpdateHeldCarts,
  openHeldModal,
  isHeldModalOpen,
  setIsHeldModalOpen,
  currentUser,
  onLogout,
  onOpenCashierManagement,
}) => {
  // Catalog State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Cart State
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [orderDiscountPercent, setOrderDiscountPercent] = useState<number>(0);
  const [orderDiscountNominal, setOrderDiscountNominal] = useState<number>(0);

  // Biaya Pengiriman (Ongkir) & Ekspedisi
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [shippingCourier, setShippingCourier] = useState<string>('');
  const [shippingTrackingNumber, setShippingTrackingNumber] = useState<string>('');
  const [shippingAddress, setShippingAddress] = useState<string>('');
  const [isShippingOpen, setIsShippingOpen] = useState<boolean>(false);

  // Modals
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<Transaction | null>(null);

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Load products and categories from local DB
  const loadCatalog = async () => {
    const prods = await getActiveProducts();
    const cats = await db.categories.toArray();
    setProducts(prods);
    setCategories(cats);
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Cart Financials (Termasuk Ongkir)
  const cartSummary: CartSummary = calculateCartSummary(
    cartItems,
    orderDiscountPercent,
    orderDiscountNominal,
    storeProfile.taxPercent,
    storeProfile.isTaxInclusive,
    shippingCost
  );

  // Add product to cart logic
  const addToCart = (product: Product, quantity = 1) => {
    const isService = product.isService || product.categoryName?.toLowerCase() === 'jasa';
    if (!isService && product.stock <= 0) {
      playErrorBeep();
      showToast(`Stok "${product.name}" habis (0)!`, 'error');
      return;
    }

    setCartItems((prev) => {
      const existingIdx = prev.findIndex((item) => item.productId === product.id);
      if (existingIdx >= 0) {
        const item = prev[existingIdx];
        const newQty = item.quantity + quantity;
        if (!isService && newQty > product.stock) {
          showToast(`Stok tersisa hanya ${product.stock} ${product.unitName}`, 'error');
          return prev;
        }
        const updated = [...prev];
        updated[existingIdx] = {
          ...item,
          quantity: newQty,
          subtotal: item.unitPrice * newQty - (item.discountAmount || 0),
        };
        return updated;
      } else {
        const newItem: CartItem = {
          productId: product.id,
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          unitName: product.unitName || 'PCS',
          buyPrice: product.buyPrice,
          unitPrice: product.sellPrice,
          quantity,
          discountAmount: 0,
          subtotal: product.sellPrice * quantity,
          condition: product.condition,
          warrantyPeriod: product.warrantyPeriod,
          serialNumber: product.serialNumber,
        };
        return [...prev, newItem];
      }
    });

    playSuccessBeep();
    showToast(`+${quantity} ${product.name}`);
  };

  const updateItemQuantity = (productId: number, delta: number) => {
    setCartItems((prev) => {
      const idx = prev.findIndex((i) => i.productId === productId);
      if (idx < 0) return prev;
      const item = prev[idx];
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        return prev.filter((i) => i.productId !== productId);
      }
      const updated = [...prev];
      updated[idx] = {
        ...item,
        quantity: newQty,
        subtotal: item.unitPrice * newQty - (item.discountAmount || 0),
      };
      return updated;
    });
  };

  const removeItem = (productId: number) => {
    setCartItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const clearCart = () => {
    if (cartItems.length === 0) return;
    if (confirm('Kosongkan semua barang dari keranjang belanja?')) {
      setCartItems([]);
      setOrderDiscountPercent(0);
      setOrderDiscountNominal(0);
      setShippingCost(0);
      setShippingCourier('');
      setShippingTrackingNumber('');
      setShippingAddress('');
      setIsShippingOpen(false);
    }
  };

  // Handle Barcode Scanned (both from hardware scanner & manual submit)
  const handleBarcodeLookup = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    let found = await db.products.where('barcode').equals(trimmed).first();
    if (!found) {
      found = await db.products.where('sku').equalsIgnoreCase(trimmed).first();
    }
    if (!found) {
      found = await db.products
        .filter((p) => p.name.toLowerCase().includes(trimmed.toLowerCase()))
        .first();
    }

    if (found) {
      addToCart(found, 1);
      setSearchQuery('');
    } else {
      playErrorBeep();
      showToast(`Produk dengan kode "${trimmed}" tidak ditemukan!`, 'error');
    }
  };

  // Subscribe to Global Barcode Scanner
  useEffect(() => {
    const unsubscribe = barcodeScanner.subscribe((barcode) => {
      handleBarcodeLookup(barcode);
    });
    return () => unsubscribe();
  }, []);

  // Keyboard Shortcuts: F1, F4, F6, F8, F12
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleHoldCart();
      } else if (e.key === 'F6') {
        e.preventDefault();
        openHeldModal();
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (cartItems.length > 0) setIsDiscountOpen(true);
      } else if (e.key === 'F12') {
        e.preventDefault();
        if (cartItems.length > 0) setIsPaymentOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartItems]);

  // Hold / Park Cart
  const handleHoldCart = async () => {
    if (cartItems.length === 0) {
      showToast('Keranjang masih kosong, tidak ada yang diparkir', 'error');
      return;
    }
    const label = `Antrean #${heldCarts.length + 1} (${cartItems.length} SKU)`;
    const newHeld: HeldCart = {
      id: Date.now().toString(),
      label,
      items: [...cartItems],
      orderDiscountNominal,
      orderDiscountPercent,
      customerName: customerName.trim() || undefined,
      shippingCost,
      shippingCourier: shippingCourier.trim() || undefined,
      shippingTrackingNumber: shippingTrackingNumber.trim() || undefined,
      shippingAddress: shippingAddress.trim() || undefined,
      heldAt: new Date().toISOString(),
    };
    await db.heldCarts.add(newHeld);
    setCartItems([]);
    setOrderDiscountPercent(0);
    setOrderDiscountNominal(0);
    setCustomerName('');
    setShippingCost(0);
    setShippingCourier('');
    setShippingTrackingNumber('');
    setShippingAddress('');
    setIsShippingOpen(false);
    onUpdateHeldCarts();
    showToast(`Transaksi diparkir: ${label}`, 'success');
  };

  // Resume Held Cart
  const handleResumeCart = async (cart: HeldCart) => {
    if (cartItems.length > 0) {
      if (!confirm('Keranjang saat ini akan ditimpa dengan antrean parkir. Lanjutkan?')) {
        return;
      }
    }
    setCartItems(cart.items);
    setOrderDiscountPercent(cart.orderDiscountPercent);
    setOrderDiscountNominal(cart.orderDiscountNominal);
    setCustomerName(cart.customerName || '');
    setShippingCost(cart.shippingCost || 0);
    setShippingCourier(cart.shippingCourier || '');
    setShippingTrackingNumber(cart.shippingTrackingNumber || '');
    setShippingAddress(cart.shippingAddress || '');
    setIsShippingOpen(!!(cart.shippingCost && cart.shippingCost > 0));
    await db.heldCarts.delete(cart.id);
    onUpdateHeldCarts();
    setIsHeldModalOpen(false);
    showToast(`Antrean "${cart.label}" berhasil dimuat kembali!`);
  };

  // Confirm and Save Transaction
  const handlePaymentSuccess = async (
    payments: PaymentEntry[],
    paidAmount: number,
    changeAmount: number,
    autoPrint: boolean
  ) => {
    const now = new Date().toISOString();
    const dateCode = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${dateCode}-${randomSuffix}`;

    const newTx: Transaction = {
      id: 0,
      invoiceNumber,
      shiftId: activeShift?.id || 1,
      cashierId: currentUser?.id || activeShift?.cashierId || 1,
      cashierName: currentUser?.fullName || activeShift?.cashierName || 'Kasir',
      customerName: customerName.trim() || undefined,
      subtotal: cartSummary.subtotal,
      discountOrderAmount: cartSummary.discountOrderAmount,
      taxAmount: cartSummary.taxAmount,
      shippingCost,
      shippingCourier: shippingCourier.trim() || undefined,
      shippingTrackingNumber: shippingTrackingNumber.trim() || undefined,
      shippingAddress: shippingAddress.trim() || undefined,
      grandTotal: cartSummary.grandTotal,
      paidAmount,
      changeAmount,
      paymentMethod: payments.map((p) => p.method).join(' + '),
      payments,
      items: [...cartItems],
      status: 'COMPLETED',
      createdAt: now,
    };

    // 1. Save Transaction to DB
    const txId = await db.transactions.add(newTx as any);
    newTx.id = txId;

    // 2. Reduce Stock & Record Stock Movements (Skip for Service items)
    for (const item of cartItems) {
       const prod = await db.products.get(item.productId);
       if (prod) {
         const isService = prod.isService || prod.categoryName?.toLowerCase() === 'jasa';
         if (!isService) {
           const newStock = Math.max(0, prod.stock - item.quantity);
           await db.products.update(prod.id, { stock: newStock, updatedAt: now });

           await db.stockMovements.add({
             id: 0,
             productId: prod.id,
             productName: prod.name,
             type: 'OUT_SALE',
             quantity: item.quantity,
             balanceAfter: newStock,
             referenceNo: invoiceNumber,
             createdAt: now,
           } as any);
         }
       }
    }

    // Refresh products
    await loadCatalog();

    // Reset Cart
    setCartItems([]);
    setOrderDiscountPercent(0);
    setOrderDiscountNominal(0);
    setShippingCost(0);
    setShippingCourier('');
    setShippingTrackingNumber('');
    setShippingAddress('');
    setIsShippingOpen(false);
    setIsPaymentOpen(false);

    // Show Receipt Modal
    setCompletedTransaction(newTx);
    showToast(`Transaksi ${invoiceNumber} Berhasil!`, 'success');
  };

  // Filter products by category & search
  const filteredProducts = products.filter((p) => {
    const matchCategory = selectedCategory === null || p.categoryId === selectedCategory;
    const matchSearch =
      searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2 border animate-in fade-in slide-in-from-top-3 duration-200 ${
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

      {/* Banner Khusus bila Login sebagai Owner / Administrator */}
      {(currentUser?.role === 'owner' || currentUser?.role === 'admin') && (
        <div className="bg-emerald-50 dark:bg-slate-900 border-b border-emerald-200 dark:border-emerald-500/30 px-4 py-1.5 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
            </span>
            <span>
              <strong>Mode Owner Aktif</strong> — Anda sedang di layar kasir dengan akun Owner.
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onOpenCashierManagement && (
              <button
                type="button"
                onClick={onOpenCashierManagement}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 border border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200 text-xs font-semibold transition"
              >
                <Users className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
                <span>Kelola Data Kasir</span>
              </button>
            )}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-xs"
              >
                <LogOut className="w-3.5 h-3.5 text-white" />
                <span>Logout</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Terminal Workstation Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* ================= LEFT: PRODUCT CATALOG & BARCODE SEARCH (FLEX-1 EXPANSIVE) ================= */}
        <div className="flex-1 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-3 lg:p-4 overflow-hidden">
        {/* Top Barcode / Search Input Row */}
        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={barcodeInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleBarcodeLookup(searchQuery);
                }
              }}
              placeholder="Scan barcode scanner atau ketik nama/SKU produk... (Enter)"
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition shadow-inner font-medium"
            />
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-2.5" />
          </div>

          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Reset
            </button>
          )}
        </div>

        {/* Category Filter Pills (Horizontal Scroll) */}
        <div className="flex items-center gap-1.5 pb-2 mb-2 overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              selectedCategory === null
                ? 'bg-slate-900 dark:bg-slate-800 border border-slate-900 dark:border-slate-700 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200'
            }`}
          >
            Semua Produk ({products.length})
          </button>
          {categories.map((cat) => {
            const count = products.filter((p) => p.categoryId === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === cat.id
                    ? 'bg-slate-900 dark:bg-slate-800 border border-slate-900 dark:border-slate-700 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200'
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Product Cards Grid (Responsive Multi-Column for Desktop Screens) */}
        <div className="flex-1 overflow-y-auto pr-1">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12 space-y-2">
              <ShoppingCart className="w-12 h-12 opacity-20 mb-2" />
              <p className="text-sm font-semibold text-slate-300">
                {products.length === 0
                  ? 'Katalog Produk Masih Kosong'
                  : 'Tidak ada produk yang cocok dengan pencarian.'}
              </p>
              {products.length === 0 && (
                <p className="text-xs text-slate-500 max-w-sm text-center">
                  Buka tab <strong>Manajemen Stok (F3)</strong> untuk mulai mendaftarkan produk baru atau import katalog toko Anda.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {filteredProducts.map((p) => {
                const isService = p.isService || p.categoryName?.toLowerCase() === 'jasa';
                const isOutOfStock = !isService && p.stock <= 0;
                const isLowStock = !isService && p.stock > 0 && p.stock <= p.minStock;

                return (
                  <button
                    key={p.id}
                    disabled={isOutOfStock}
                    onClick={() => addToCart(p, 1)}
                    className={`relative text-left p-3 rounded-xl border flex flex-col justify-between transition-all group ${
                      isOutOfStock
                        ? 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs shadow-2xs active:scale-[0.98]'
                    }`}
                  >
                    <div>
                      {/* Barcode & Status Pill */}
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1.5">
                        <span className="font-mono text-slate-500 dark:text-slate-400 text-[10px] truncate max-w-[100px]">
                          {p.barcode || p.sku}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold text-[9px] ${
                            isService
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                              : isOutOfStock
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : isLowStock
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <span
                            className={`w-1 h-1 rounded-full ${
                              isService
                                ? 'bg-blue-500 dark:bg-blue-400'
                                : isOutOfStock
                                ? 'bg-rose-500 dark:bg-rose-400'
                                : isLowStock
                                ? 'bg-amber-500 dark:bg-amber-400'
                                : 'bg-slate-500 dark:bg-slate-400'
                            }`}
                          />
                          <span>
                            {isService
                              ? 'Jasa (∞)'
                              : isOutOfStock
                              ? 'HABIS'
                              : isLowStock
                              ? `Sisa ${p.stock}`
                              : `Stok ${p.stock}`}
                          </span>
                        </span>
                      </div>

                      {/* Product Name */}
                      <h3 className="font-medium text-slate-800 dark:text-slate-200 text-xs line-clamp-2 leading-snug mb-2 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                        {p.name}
                      </h3>
                    </div>

                    {/* Price and Unit */}
                    <div className="flex items-baseline justify-between mt-1 pt-2 border-t border-slate-150 dark:border-slate-800/80">
                      <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight font-mono">
                        {formatRupiah(p.sellPrice)}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">/{p.unitName || 'pcs'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ================= RIGHT: ACTIVE CART & FINANCIALS (FLEXIBLE SIDEBAR) ================= */}
      <div className="w-[390px] lg:w-[430px] xl:w-[470px] 2xl:w-[510px] shrink-0 flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden border-l border-slate-200 dark:border-slate-800">
        {/* Cart Header */}
        <div className="px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
              Keranjang Kasir
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {cartItems.length} SKU ({cartSummary.totalItems} item)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleHoldCart}
              disabled={cartItems.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 text-xs font-medium transition"
              title="Tahan transaksi saat ini (F4)"
            >
              <PauseCircle className="w-3.5 h-3.5" />
              <span>Parkir [F4]</span>
            </button>

            <button
              onClick={clearCart}
              disabled={cartItems.length === 0}
              className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition"
              title="Kosongkan Keranjang"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {onLogout && (
              <button
                onClick={() => {
                  if (confirm(`Logout dari kasir ${currentUser?.fullName || ''} dan kembali ke layar PIN?`)) {
                    onLogout();
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-xs cursor-pointer ml-1"
                title="Logout Kasir (Kembali ke Layar PIN)"
              >
                <LogOut className="w-3.5 h-3.5 text-white" />
                <span>Logout</span>
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-12">
              <ShoppingCart className="w-10 h-10 opacity-20 mb-2" />
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Keranjang Belanja Masih Kosong</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-600 mt-0.5 text-center px-4">
                Tembakkan scanner barcode atau klik produk di katalog sebelah kiri.
              </p>
            </div>
          ) : (
            cartItems.map((item) => (
              <div
                key={item.productId}
                className="p-2.5 rounded-xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2.5 hover:border-slate-300 dark:hover:border-slate-700 transition shadow-2xs"
              >
                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-200 truncate">{item.name}</h4>
                    {item.condition && item.condition !== 'BARU' && (
                      <span className="text-[9px] px-1 py-0.2 rounded font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
                        {item.condition}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{formatRupiah(item.unitPrice)}</span>
                    {item.discountAmount > 0 && (
                      <span className="text-rose-500">
                        (-{formatRupiah(item.discountAmount)})
                      </span>
                    )}
                    {item.warrantyPeriod && (
                      <span className="flex items-center text-emerald-600 dark:text-emerald-400 text-[10px]">
                        <ShieldCheck className="w-3 h-3 mr-0.5" />{item.warrantyPeriod}
                      </span>
                    )}
                    {item.serialNumber && (
                      <span className="text-slate-400 text-[10px]">SN: {item.serialNumber}</span>
                    )}
                  </div>
                </div>

                {/* Qty Controls */}
                <div className="flex items-center gap-1 shrink-0 bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => updateItemQuantity(item.productId, -1)}
                    className="p-1 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-7 text-center text-xs font-bold text-slate-900 dark:text-white font-mono">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateItemQuantity(item.productId, 1)}
                    className="p-1 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Subtotal & Delete */}
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-slate-100 font-mono">
                    {formatRupiah(item.subtotal)}
                  </div>
                  <button
                    onClick={() => removeItem(item.productId)}
                    className="text-[10px] text-slate-500 hover:text-rose-400 transition"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Financial Summary & Large Checkout Button (Fixed at Bottom) */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0 space-y-3 shadow-lg">
          {/* Input Nama Pelanggan (Opsional - Dicetak di Struk) */}
          <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-950/80 border border-slate-800 focus-within:border-emerald-500/80 transition">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1.5" />
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nama Pelanggan (Opsional - dicetak di nota)..."
              className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            {customerName && (
              <button
                type="button"
                onClick={() => setCustomerName('')}
                className="text-slate-500 hover:text-slate-300 text-xs px-1.5"
                title="Hapus nama pelanggan"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Biaya Pengiriman (Ongkir) Toggle & Options */}
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsShippingOpen(!isShippingOpen)}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition"
              >
                <Truck className="w-3.5 h-3.5 text-cyan-400" />
                <span>Kirim Barang / Ongkir</span>
                {shippingCost > 0 && (
                  <span className="text-cyan-400 font-mono text-[11px] ml-1">
                    (+{formatRupiah(shippingCost)})
                  </span>
                )}
                {isShippingOpen ? (
                  <ChevronUp className="w-3 h-3 text-slate-500" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-slate-500" />
                )}
              </button>

              {shippingCost > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShippingCost(0);
                    setShippingCourier('');
                    setShippingTrackingNumber('');
                    setShippingAddress('');
                  }}
                  className="text-[10px] text-slate-500 hover:text-rose-400 font-semibold"
                >
                  Batal Ongkir
                </button>
              )}
            </div>

            {isShippingOpen && (
              <div className="pt-2 border-t border-slate-800/80 space-y-2 text-xs">
                {/* Nominal Ongkir */}
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    Biaya Ongkos Kirim (Rp):
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-[11px] text-slate-500 font-semibold">Rp</span>
                    <input
                      type="number"
                      min="0"
                      value={shippingCost || ''}
                      onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full pl-8 pr-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-cyan-500 font-bold"
                    />
                  </div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {[10000, 15000, 20000, 25000, 35000, 50000].map((amt) => (
                      <button
                        type="button"
                        key={amt}
                        onClick={() => setShippingCost(amt)}
                        className={`text-[9px] px-1.5 py-0.5 rounded transition ${
                          shippingCost === amt
                            ? 'bg-cyan-600 text-white font-bold'
                            : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                        }`}
                      >
                        +{amt / 1000}rb
                      </button>
                    ))}
                  </div>
                </div>

                {/* Kurir Ekspedisi */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Pilihan Kurir:</label>
                    <select
                      value={shippingCourier}
                      onChange={(e) => setShippingCourier(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-cyan-500 font-medium"
                    >
                      <option value="">Pilih Kurir...</option>
                      <option value="SPX Express (Shopee Xpress)">SPX Express (Shopee Xpress)</option>
                      <option value="J&T Express">J&T Express</option>
                      <option value="JNE Express">JNE Express</option>
                      <option value="SiCepat">SiCepat</option>
                      <option value="J&T Cargo">J&T Cargo (Kargo PC/Printer)</option>
                      <option value="GoSend / Grab">GoSend / Grab Instant</option>
                      <option value="Kurir Toko">Kurir Toko Sendiri</option>
                      <option value="Pos Indonesia">Pos Indonesia</option>
                      <option value="Anteraja">Anteraja</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">No. Resi (Opsional):</label>
                    <input
                      type="text"
                      placeholder="e.g. JP123456789"
                      value={shippingTrackingNumber}
                      onChange={(e) => setShippingTrackingNumber(e.target.value)}
                      className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                {/* Alamat Pengiriman */}
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Alamat Pengiriman:</label>
                  <input
                    type="text"
                    placeholder="Alamat lengkap penerima..."
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Subtotal, Diskon & Pajak Rows */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Subtotal Belanja:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-200 font-mono">
                {formatRupiah(cartSummary.subtotal)}
              </span>
            </div>

            {/* Diskon Order */}
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <button
                onClick={() => setIsDiscountOpen(true)}
                disabled={cartItems.length === 0}
                className="flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-50 font-medium"
              >
                <Tag className="w-3 h-3" />
                <span>
                  Diskon Nota [F8]
                  {cartSummary.discountOrderPercent > 0
                    ? ` (${cartSummary.discountOrderPercent}%)`
                    : ''}
                  :
                </span>
              </button>
              <span className="font-semibold text-amber-600 dark:text-amber-400 font-mono">
                {cartSummary.discountOrderAmount > 0
                  ? `-${formatRupiah(cartSummary.discountOrderAmount)}`
                  : 'Rp 0'}
              </span>
            </div>

            {/* Ongkos Kirim Row if set */}
            {shippingCost > 0 && (
              <div className="flex justify-between text-sky-600 dark:text-cyan-400 font-medium">
                <span>Ongkos Kirim ({shippingCourier || 'Ekspedisi'}):</span>
                <span className="font-mono">+{formatRupiah(shippingCost)}</span>
              </div>
            )}

            {/* PPN Pajak */}
            {storeProfile.taxPercent > 0 && (
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>
                  PPN {storeProfile.taxPercent}%{' '}
                  {storeProfile.isTaxInclusive ? '(Termasuk)' : ''}:
                </span>
                <span className="font-medium text-slate-900 dark:text-slate-200 font-mono">
                  {formatRupiah(cartSummary.taxAmount)}
                </span>
              </div>
            )}
          </div>

          {/* Grand Total Display */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-baseline justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              TOTAL AKHIR:
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight font-mono">
              {formatRupiah(cartSummary.grandTotal)}
            </span>
          </div>

          {/* Big Checkout Pay Button */}
          <button
            onClick={() => setIsPaymentOpen(true)}
            disabled={cartItems.length === 0}
            className={`w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
              cartItems.length === 0
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border border-slate-300 dark:border-slate-700/60 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-[0.98]'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>BAYAR SEKARANG [F12] — {formatRupiah(cartSummary.grandTotal)}</span>
          </button>
        </div>
      </div>
      </div>

      {/* MODALS */}
      {isPaymentOpen && (
        <PaymentModal
          summary={cartSummary}
          customerName={customerName}
          onClose={() => setIsPaymentOpen(false)}
          onConfirmPayment={handlePaymentSuccess}
          defaultAutoPrint={storeProfile.autoPrintReceipt}
        />
      )}

      {isDiscountOpen && (
        <DiscountModal
          currentPercent={orderDiscountPercent}
          currentNominal={orderDiscountNominal}
          subtotal={cartSummary.subtotal}
          onApply={(pct, nom) => {
            setOrderDiscountPercent(pct);
            setOrderDiscountNominal(nom);
          }}
          onClose={() => setIsDiscountOpen(false)}
        />
      )}

      {isHeldModalOpen && (
        <HoldCartModal
          heldCarts={heldCarts}
          onResume={handleResumeCart}
          onDelete={async (id) => {
            await db.heldCarts.delete(id);
            onUpdateHeldCarts();
          }}
          onClose={() => setIsHeldModalOpen(false)}
        />
      )}

      {completedTransaction && (
        <ReceiptModal
          transaction={completedTransaction}
          storeProfile={storeProfile}
          onClose={() => setCompletedTransaction(null)}
        />
      )}
    </div>
  );
};
