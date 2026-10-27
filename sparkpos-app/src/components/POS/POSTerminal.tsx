import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { barcodeScanner, playSuccessBeep, playErrorBeep, playCashDrawerKickSound } from '../../services/scanner';
import { db, getActiveProducts } from '../../services/storage';
import { PaymentModal } from './PaymentModal';
import { HoldCartModal } from './HoldCartModal';
import { DiscountModal } from './DiscountModal';
import { PrintableReceipt } from './PrintableReceipt';
import { isDialogOpen } from '../../hooks/useDialog';
import { printSaleReceipt, kickCashDrawer, isTauriRuntime } from '../../services/printService';

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
  onOpenCashFlow?: () => void;
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
  onOpenCashFlow,
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

  // Modals & Print Job
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [directPrintJob, setDirectPrintJob] = useState<{
    tx: Transaction;
    format: '58mm' | 'A4';
  } | null>(null);

  // Keyboard navigation & element references
  const [selectedCatalogIndex, setSelectedCatalogIndex] = useState<number>(-1);
  const [selectedCartId, setSelectedCartId] = useState<number | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const payButtonRef = useRef<HTMLButtonElement>(null);
  const customerNameInputRef = useRef<HTMLInputElement>(null);

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

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

  // Reset selected catalog highlight when query or category changes
  useEffect(() => {
    setSelectedCatalogIndex(-1);
  }, [searchQuery, selectedCategory]);

  // Auto-scroll selected row into view when navigating with Arrow keys
  useEffect(() => {
    if (selectedCatalogIndex >= 0) {
      const el = document.getElementById(`catalog-row-${selectedCatalogIndex}`);
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedCatalogIndex]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Cart Financials
  const cartSummary: CartSummary = calculateCartSummary(
    cartItems,
    orderDiscountPercent,
    orderDiscountNominal,
    storeProfile.taxPercent,
    storeProfile.isTaxInclusive,
    0
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
          categoryName: product.categoryName,
        };
        return [...prev, newItem];
      }
    });

    playSuccessBeep();
    setSelectedCartId(product.id);
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
    }
  };

  // Handle Barcode Scanned (supports multiplier quantity e.g. "5*barcode", "3*kabel", "10*SKU")
  const handleBarcodeLookup = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    let targetQty = 1;
    let targetCode = trimmed;

    // Check for multiplier format like 5*89999 or 3*laptop
    const multMatch = trimmed.match(/^(\d+)[*xX](.*)$/);
    if (multMatch) {
      const parsedQty = parseInt(multMatch[1], 10);
      if (parsedQty > 0) {
        targetQty = parsedQty;
        targetCode = multMatch[2].trim();
      }
    }

    if (!targetCode) {
      showToast('Ketik kode atau nama produk setelah tanda * (contoh: 5*Kabel)', 'error');
      return;
    }

    let found = await db.products.where('barcode').equals(targetCode).first();
    if (!found) {
      found = await db.products.where('sku').equalsIgnoreCase(targetCode).first();
    }
    if (!found) {
      found = await db.products
        .filter((p) => p.name.toLowerCase().includes(targetCode.toLowerCase()))
        .first();
    }

    if (found) {
      addToCart(found, targetQty);
      setSearchQuery('');
      setSelectedCatalogIndex(-1);
    } else {
      playErrorBeep();
      showToast(`Produk "${targetCode}" tidak ditemukan!`, 'error');
    }
  };

  // Subscribe to Global Barcode Scanner
  useEffect(() => {
    const unsubscribe = barcodeScanner.subscribe((barcode) => {
      handleBarcodeLookup(barcode);
    });
    return () => unsubscribe();
  }, []);

  // Keyboard shortcuts (standar aplikasi kasir). Semua dinonaktifkan saat dialog/modal terbuka.
  //  F2 / Ctrl+K / Ctrl+F / "/"  : fokus ke Scan/Cari       F3 : nama pelanggan
  //  F4 parkir   F6 antrean   F8 diskon   F9 kosongkan   F10 kas   F12 / Ctrl+Enter : bayar
  //  Ctrl+↑/↓ pilih baris keranjang   +/- (atau Numpad) ubah jumlah   Delete hapus baris
  //  Esc : hapus pencarian / lepas fokus     Alt+1..9 : kategori
  useEffect(() => {
    const focusSearch = () => {
      barcodeInputRef.current?.focus();
      barcodeInputRef.current?.select();
    };
    const moveCartSelection = (dir: 1 | -1) => {
      if (cartItems.length === 0) return;
      const idx = cartItems.findIndex((i) => i.productId === selectedCartId);
      const next = idx < 0 ? (dir === 1 ? 0 : cartItems.length - 1) : Math.min(cartItems.length - 1, Math.max(0, idx + dir));
      setSelectedCartId(cartItems[next].productId);
      document.getElementById(`cart-row-${cartItems[next].productId}`)?.scrollIntoView({ block: 'nearest' });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isDialogOpen() || isPaymentOpen || isDiscountOpen || isHeldModalOpen) return;
      const t = e.target as HTMLElement | null;
      const inField =
        !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;

      // Tombol fungsi
      if (/^F\d+$/.test(e.key) && e.repeat) return;
      switch (e.key) {
        case 'F2':
          e.preventDefault();
          focusSearch();
          return;
        case 'F3':
          e.preventDefault();
          customerNameInputRef.current?.focus();
          return;
        case 'F4':
          e.preventDefault();
          handleHoldCart();
          return;
        case 'F6':
          e.preventDefault();
          openHeldModal();
          return;
        case 'F8':
          e.preventDefault();
          if (cartItems.length > 0) setIsDiscountOpen(true);
          return;
        case 'F9':
          e.preventDefault();
          clearCart();
          return;
        case 'F10':
          e.preventDefault();
          onOpenCashFlow?.();
          return;
        case 'F12':
          e.preventDefault();
          if (cartItems.length > 0) setIsPaymentOpen(true);
          return;
      }

      if (mod && e.key === 'Enter') {
        e.preventDefault();
        if (cartItems.length > 0) setIsPaymentOpen(true);
        return;
      }
      if (mod && (e.key === 'k' || e.key === 'K' || e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        focusSearch();
        return;
      }
      if (!inField && !mod && !e.altKey && e.key === '/') {
        e.preventDefault();
        focusSearch();
        return;
      }

      // Kategori Alt+1..9
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const num = parseInt(e.key, 10);
        if (num === 1) {
          setSelectedCategory(null);
          showToast('Kategori: Semua Produk');
        } else if (categories[num - 2]) {
          setSelectedCategory(categories[num - 2].id);
          showToast(`Kategori: ${categories[num - 2].name}`);
        }
        return;
      }

      // Navigasi baris keranjang
      if (mod && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        moveCartSelection(e.key === 'ArrowDown' ? 1 : -1);
        return;
      }
      if (mod && e.key === 'Delete' && selectedCartId !== null) {
        e.preventDefault();
        removeItem(selectedCartId);
        setSelectedCartId(null);
        return;
      }
      const fieldEmpty = !inField || (t as HTMLInputElement)?.value === '';
      if (selectedCartId !== null && fieldEmpty && !mod && !e.altKey) {
        if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
          e.preventDefault();
          updateItemQuantity(selectedCartId, 1);
          return;
        }
        if (e.key === '-' || e.code === 'NumpadSubtract') {
          e.preventDefault();
          updateItemQuantity(selectedCartId, -1);
          return;
        }
        if (e.key === 'Delete' && !inField) {
          e.preventDefault();
          removeItem(selectedCartId);
          setSelectedCartId(null);
          return;
        }
      }

      if (e.key === 'Escape') {
        if (searchQuery) {
          e.preventDefault();
          setSearchQuery('');
          setSelectedCatalogIndex(-1);
        } else if (selectedCartId !== null) {
          setSelectedCartId(null);
        } else if (inField) {
          (t as HTMLElement).blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartItems, categories, onOpenCashFlow, selectedCartId, searchQuery, isPaymentOpen, isDiscountOpen, isHeldModalOpen]);

  // Baris terakhir yang ditambahkan otomatis terpilih; pilihan yang sudah dihapus dilepas
  useEffect(() => {
    if (selectedCartId !== null && !cartItems.some((i) => i.productId === selectedCartId)) {
      setSelectedCartId(cartItems.length > 0 ? cartItems[cartItems.length - 1].productId : null);
    }
  }, [cartItems, selectedCartId]);

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
      heldAt: new Date().toISOString(),
    };
    await db.heldCarts.add(newHeld);
    setCartItems([]);
    setOrderDiscountPercent(0);
    setOrderDiscountNominal(0);
    setCustomerName('');
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
    await db.heldCarts.delete(cart.id);
    onUpdateHeldCarts();
    setIsHeldModalOpen(false);
    showToast(`Antrean "${cart.label}" berhasil dimuat kembali!`);
  };

  // Confirm and Save Transaction (Direct print without preview modal)
  const handlePaymentSuccess = async (
    payments: PaymentEntry[],
    paidAmount: number,
    changeAmount: number,
    printFormat: '58mm' | 'A4' | null
  ) => {
    try {
      const now = new Date().toISOString();
      const dateCode = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const invoiceNumber = `INV-${dateCode}-${randomSuffix}`;

      // Clean payload without id: 0 so Dexie auto-increments primary key without collision
      const txPayload: Omit<Transaction, 'id'> = {
        invoiceNumber,
        shiftId: activeShift?.id || 1,
        cashierId: currentUser?.id || activeShift?.cashierId || 1,
        cashierName: currentUser?.fullName || activeShift?.cashierName || 'Kasir',
        customerName: customerName.trim() || undefined,
        subtotal: cartSummary.subtotal,
        discountOrderAmount: cartSummary.discountOrderAmount,
        taxAmount: cartSummary.taxAmount,
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
      const txId = await db.transactions.add(txPayload as any);
      const newTx: Transaction = {
        ...txPayload,
        id: txId as number,
      };

      // 2. Reduce Stock & Record Stock Movements (Skip for Service items)
      for (const item of cartItems) {
        const prod = await db.products.get(item.productId);
        if (prod) {
          const isService = prod.isService || prod.categoryName?.toLowerCase() === 'jasa';
          if (!isService) {
            const newStock = Math.max(0, prod.stock - item.quantity);
            await db.products.update(prod.id, { stock: newStock, updatedAt: now });

            await db.stockMovements.add({
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

      // 3. Update shift expected cash if cash was received
      if (activeShift) {
        const cashPaymentTotal = payments
          .filter((p) => p.method === 'CASH')
          .reduce((sum, p) => sum + Math.min(p.amount, cartSummary.grandTotal), 0);
        if (cashPaymentTotal > 0) {
          const updatedExpected = (activeShift.expectedCash || 0) + cashPaymentTotal;
          await db.shifts.update(activeShift.id, { expectedCash: updatedExpected });
        }
      }

      // 4. Broadcast global event for 100% REALTIME sync with Laporan Keuangan & Recap
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('sparkpos_data_changed', {
            detail: { type: 'transaction', invoiceNumber, id: txId },
          })
        );
      }

      // Refresh products catalog
      await loadCatalog();

      // Reset Cart
      setCartItems([]);
      setCustomerName('');
      setOrderDiscountPercent(0);
      setOrderDiscountNominal(0);
      setIsPaymentOpen(false);

      // Cetak langsung tanpa dialog sesuai format yang dipilih di jendela pembayaran
      const paidCash = payments.some((p) => p.method === 'CASH');
      const kick = !!storeProfile.autoKickDrawer && paidCash;

      if (printFormat) {
        if (kick) playCashDrawerKickSound();
        const needsDom = printFormat === 'A4' || !isTauriRuntime();
        if (needsDom) setDirectPrintJob({ tx: newTx, format: printFormat });
        showToast(
          `Transaksi ${invoiceNumber} berhasil! Mencetak ${printFormat === 'A4' ? 'faktur A4' : 'struk 58mm'}...`,
          'success'
        );
        // beri waktu elemen cetak tampil sebelum dikirim ke printer
        if (needsDom) await new Promise((r) => setTimeout(r, 150));
        const outcome = await printSaleReceipt(newTx, storeProfile, printFormat, kick);
        if (!outcome.ok) {
          playErrorBeep();
          showToast(`Transaksi tersimpan, tetapi cetak gagal: ${outcome.error}`, 'error');
        }
        if (needsDom) setTimeout(() => setDirectPrintJob(null), 2500);
        barcodeInputRef.current?.focus();
      } else {
        if (kick) {
          playCashDrawerKickSound();
          kickCashDrawer(storeProfile);
        }
        showToast(`Transaksi ${invoiceNumber} Berhasil Disimpan (Mode Nota Manual / Tanpa Struk)`, 'success');
        barcodeInputRef.current?.focus();
      }
    } catch (err: any) {
      console.error('Failed to complete transaction:', err);
      showToast(`Gagal menyimpan transaksi: ${err?.message || 'Error database'}`, 'error');
    }
  };

  // Optimized memoized product catalog search (including serialNumber & barcode)
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCategory !== null && p.categoryId !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.serialNumber && p.serialNumber.toLowerCase().includes(q))
      );
    });
  }, [products, selectedCategory, searchQuery]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2 border animate-in fade-in slide-in-from-top-3 duration-200 ${
            toastMessage.type === 'error'
              ? 'bg-rose-50/90 dark:bg-rose-950/90 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-200'
              : 'bg-emerald-50/90 dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-200'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
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
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSelectedCatalogIndex((prev) =>
                    filteredProducts.length > 0 ? Math.min(filteredProducts.length - 1, prev + 1) : -1
                  );
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSelectedCatalogIndex((prev) => Math.max(-1, prev - 1));
                  return;
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (selectedCatalogIndex >= 0 && selectedCatalogIndex < filteredProducts.length) {
                    const selectedProd = filteredProducts[selectedCatalogIndex];
                    let qty = 1;
                    const match = searchQuery.match(/^(\d+)[*xX]/);
                    if (match) {
                      const q = parseInt(match[1], 10);
                      if (q > 0) qty = q;
                    }
                    addToCart(selectedProd, qty);
                    setSearchQuery('');
                  } else {
                    handleBarcodeLookup(searchQuery);
                  }
                }
              }}
              placeholder="Scan barcode / ketik nama/SKU... (Cth: 5*Kabel | F2 fokus, Enter tambah, Esc hapus)"
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition shadow-inner font-medium"
            />
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-2.5" />
          </div>

          {searchQuery && (
            <button
              tabIndex={-1}
              onClick={() => setSearchQuery('')}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>

        {/* Category Filter Pills (Horizontal Scroll with Alt+1..9 Shortcuts) */}
        <div className="flex items-center gap-1.5 pb-2 mb-2 overflow-x-auto no-scrollbar shrink-0">
          <button
            tabIndex={-1}
            onClick={() => setSelectedCategory(null)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === null
                ? 'bg-slate-900 dark:bg-slate-800 border border-slate-900 dark:border-slate-700 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200'
            }`}
          >
            <span>Semua Produk ({products.length})</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-black/10 dark:bg-black/30 font-mono opacity-70">
              Alt+1
            </span>
          </button>
          {categories.map((cat, cIdx) => {
            const count = products.filter((p) => p.categoryId === cat.id).length;
            const shortcutNum = cIdx + 2;
            return (
              <button
                tabIndex={-1}
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  selectedCategory === cat.id
                    ? 'bg-slate-900 dark:bg-slate-800 border border-slate-900 dark:border-slate-700 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200'
                }`}
              >
                <span>{cat.name} ({count})</span>
                {shortcutNum <= 9 && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-black/10 dark:bg-black/30 font-mono opacity-70">
                    Alt+{shortcutNum}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Product Cards Grid (Responsive Multi-Column for Desktop Screens) */}
        <div className="flex-1 overflow-y-auto pr-1">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12 space-y-2">
              <ShoppingCart className="w-12 h-12 opacity-20 mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {products.length === 0
                  ? 'Katalog Produk Masih Kosong'
                  : 'Tidak ada produk yang cocok dengan pencarian.'}
              </p>
              {products.length === 0 && (
                <p className="text-xs text-slate-500 max-w-sm text-center">
                  Buka tab <strong>Manajemen Stok (Ctrl+3)</strong> untuk mulai mendaftarkan produk baru atau import katalog toko Anda.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    <th className="py-2.5 px-3 whitespace-nowrap">CODE (SKU/BARCODE)</th>
                    <th className="py-2.5 px-3">NAMA PRODUK</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">TYPE (KATEGORI)</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">HARGA JUAL</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">STOK</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-800/80 text-xs">
                  {filteredProducts.map((p, idx) => {
                    const isService = p.isService || p.categoryName?.toLowerCase() === 'jasa';
                    const isOutOfStock = !isService && p.stock <= 0;
                    const isLowStock = !isService && p.stock > 0 && p.stock <= p.minStock;
                    const isHighlighted = idx === selectedCatalogIndex;

                    return (
                      <tr
                        key={p.id}
                        id={`catalog-row-${idx}`}
                        onClick={() => {
                          // Klik biasa HANYA menyorot / memilih baris, TIDAK langsung menambahkan ke keranjang
                          setSelectedCatalogIndex(idx);
                        }}
                        onDoubleClick={() => {
                          // Double click untuk menambahkan ke keranjang secara aman
                          if (!isOutOfStock) {
                            addToCart(p, 1);
                          }
                        }}
                        title={
                          isOutOfStock
                            ? 'Stok Habis'
                            : 'Klik untuk memilih baris. Double-click atau tekan Enter untuk masukkan ke keranjang'
                        }
                        className={`transition group cursor-pointer ${
                          isHighlighted
                            ? 'ring-2 ring-emerald-500 bg-emerald-100 dark:bg-emerald-950/80 font-bold'
                            : isOutOfStock
                            ? 'opacity-40 bg-slate-50/50 dark:bg-slate-950/40 cursor-not-allowed'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-xs text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {p.sku || p.barcode}
                          {p.barcode && p.sku && p.barcode !== p.sku && (
                            <span className="block text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                              BC: {p.barcode}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs">{p.name}</span>
                            {p.condition && p.condition !== 'BARU' && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                                {p.condition}
                              </span>
                            )}
                            {p.warrantyPeriod && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center font-medium">
                                <ShieldCheck className="w-3 h-3 mr-0.5" />{p.warrantyPeriod}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                            {p.categoryName || 'Umum'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 dark:text-emerald-400 text-xs whitespace-nowrap">
                          {formatRupiah(p.sellPrice)}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                              isService
                                ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                                : isOutOfStock
                                ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                                : isLowStock
                                ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            }`}
                          >
                            {isService
                              ? 'Jasa (∞)'
                              : isOutOfStock
                              ? 'HABIS (0)'
                              : isLowStock
                              ? `Sisa ${p.stock} ${p.unitName || 'pcs'}`
                              : `Stok: ${p.stock} ${p.unitName || 'pcs'}`}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            tabIndex={-1}
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() => addToCart(p, 1)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white text-[11px] font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1"
                            title="Tambah 1 item ke keranjang"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Keranjang</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
              className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition"
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
                id={`cart-row-${item.productId}`}
                onClick={() => setSelectedCartId(item.productId)}
                className={`p-2.5 rounded-xl bg-white dark:bg-slate-950/60 border flex items-center justify-between gap-2.5 transition shadow-2xs cursor-pointer ${
                  selectedCartId === item.productId
                    ? 'border-emerald-500 ring-2 ring-emerald-500/40'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
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
                      <span className="text-slate-600 dark:text-slate-400 text-[10px] font-medium">SN: {item.serialNumber}</span>
                    )}
                  </div>
                </div>

                {/* Qty Controls */}
                <div className="flex items-center gap-1 shrink-0 bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  <button
                    tabIndex={-1}
                    onClick={() => updateItemQuantity(item.productId, -1)}
                    className="p-1 rounded text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-7 text-center text-xs font-bold text-slate-900 dark:text-white font-mono">
                    {item.quantity}
                  </span>
                  <button
                    tabIndex={-1}
                    onClick={() => updateItemQuantity(item.productId, 1)}
                    className="p-1 rounded text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Subtotal & Delete */}
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                    {formatRupiah(item.subtotal)}
                  </div>
                  <button
                    tabIndex={-1}
                    onClick={() => removeItem(item.productId)}
                    className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 hover:text-rose-500 transition cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Financial Summary & Large Checkout Button (Fixed at Bottom) */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 space-y-3 shadow-lg">
          {/* Input Nama Pelanggan (Opsional - Dicetak di Struk) */}
          <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 focus-within:border-emerald-500/80 transition">
            <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0 ml-1.5" />
            <input
              ref={customerNameInputRef}
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  barcodeInputRef.current?.focus();
                }
              }}
              placeholder="Nama Pelanggan (Opsional - dicetak di nota)..."
              className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
            />
            {customerName && (
              <button
                tabIndex={-1}
                type="button"
                onClick={() => setCustomerName('')}
                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs px-1.5 cursor-pointer"
                title="Hapus nama pelanggan"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Subtotal, Diskon & Pajak Rows */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-800 dark:text-slate-200 font-semibold">
              <span>Subtotal Belanja:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                {formatRupiah(cartSummary.subtotal)}
              </span>
            </div>

            {/* Diskon Order */}
            <div className="flex justify-between items-center text-slate-800 dark:text-slate-200 font-semibold">
              <button
                tabIndex={-1}
                onClick={() => setIsDiscountOpen(true)}
                disabled={cartItems.length === 0}
                className="flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-50 font-medium cursor-pointer"
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

            {/* PPN Pajak */}
            {storeProfile.taxPercent > 0 && (
              <div className="flex justify-between text-slate-800 dark:text-slate-200 font-semibold">
                <span>
                  PPN {storeProfile.taxPercent}%{' '}
                  {storeProfile.isTaxInclusive ? '(Termasuk)' : ''}:
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
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

          {/* Big Checkout Pay Button (Tab directly lands here, Enter to Pay) */}
          <button
            ref={payButtonRef}
            onClick={() => cartItems.length > 0 && setIsPaymentOpen(true)}
            disabled={cartItems.length === 0}
            className={`w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md focus:outline-none focus:ring-4 focus:ring-emerald-400 focus:scale-[1.01] ${
              cartItems.length === 0
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border border-slate-300 dark:border-slate-700/60 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-[0.98] cursor-pointer'
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
          onClose={() => {
            setIsPaymentOpen(false);
            barcodeInputRef.current?.focus();
          }}
          onConfirmPayment={handlePaymentSuccess}
          defaultAutoPrint={storeProfile.autoPrintReceipt}
          defaultPaperFormat={
            storeProfile.defaultPrintFormat ||
            (storeProfile.autoPrintReceipt === false
              ? 'NONE'
              : storeProfile.paperWidth === 'A4' || storeProfile.paperWidth === 'F4'
              ? 'A4'
              : '58mm')
          }
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

      {/* Hidden Container for Direct Silent Printing without Preview Modal */}
      {directPrintJob && (
        <div className="hidden print:block">
          <PrintableReceipt
            transaction={directPrintJob.tx}
            storeProfile={storeProfile}
            paperFormat={directPrintJob.format}
          />
        </div>
      )}

      {/* Keyboard Shortcut Ribbon for Cashier & Admin Fast Productivity */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 shrink-0 select-none overflow-x-auto no-scrollbar gap-2">
        <div className="flex items-center gap-2.5 whitespace-nowrap">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mr-1">
            Shortcut Keyboard:
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[10px] font-bold">F2</kbd>
            <span>Scan/Cari</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[10px] font-bold">↑ / ↓</kbd>
            <span>Pilih Produk</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[10px] font-bold">Ctrl+↑↓ · + − · Del</kbd>
            <span>Baris Keranjang</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[10px] font-bold">Enter / DblClick</kbd>
            <span>+Keranjang</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold">F12 / Ctrl+Enter</kbd>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Bayar</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[10px] font-bold">F4</kbd>
            <span>Parkir</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[10px] font-bold">F6</kbd>
            <span>Antrean</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[10px] font-bold">F8</kbd>
            <span>Diskon</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[10px] font-bold">F9</kbd>
            <span>Kosongkan</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[10px] font-bold">F10</kbd>
            <span>Arus Kas</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[10px] font-bold">F1</kbd>
            <span>Bantuan</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[10px] font-bold">Alt+1..9</kbd>
            <span>Kategori</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[10px] font-bold">Qty*</kbd>
            <span>Jumlah Banyak (Cth: 5*Kabel)</span>
          </span>
        </div>
      </div>
    </div>
  );
};
