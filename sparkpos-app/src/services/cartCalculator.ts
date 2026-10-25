import { CartItem, CartSummary } from '../types/pos';

export function calculateLineSubtotal(unitPrice: number, quantity: number, discountAmount: number = 0): number {
  const gross = unitPrice * quantity;
  return Math.max(0, gross - discountAmount);
}

export function calculateCartSummary(
  items: CartItem[],
  orderDiscountPercent: number = 0,
  orderDiscountNominal: number = 0,
  taxPercent: number = 0,
  isTaxInclusive: boolean = false,
  shippingCost: number = 0
): CartSummary {
  if (items.length === 0) {
    return {
      subtotal: 0,
      discountItemTotal: 0,
      discountOrderAmount: 0,
      discountOrderPercent: orderDiscountPercent,
      taxPercent,
      taxAmount: 0,
      isTaxInclusive,
      shippingCost: shippingCost || 0,
      grandTotal: shippingCost || 0,
      totalItems: 0,
      rounding: 0,
    };
  }

  let subtotal = 0;
  let discountItemTotal = 0;
  let totalItems = 0;

  for (const item of items) {
    totalItems += item.quantity;
    discountItemTotal += item.discountAmount || 0;
    const lineSub = calculateLineSubtotal(item.unitPrice, item.quantity, item.discountAmount || 0);
    subtotal += lineSub;
  }

  // Calculate order-level discount
  let discountOrderAmount = 0;
  if (orderDiscountPercent > 0) {
    discountOrderAmount = Math.round((subtotal * orderDiscountPercent) / 100);
  } else if (orderDiscountNominal > 0) {
    discountOrderAmount = Math.min(subtotal, orderDiscountNominal);
  }

  const taxableBase = Math.max(0, subtotal - discountOrderAmount);

  // Calculate Tax (PPN)
  let taxAmount = 0;
  let grandTotal = 0;

  if (taxPercent > 0) {
    if (isTaxInclusive) {
      // Inclusive: Harga sudah termasuk pajak (Base = Total / (1 + Tax%))
      const netBase = taxableBase / (1 + taxPercent / 100);
      taxAmount = Math.round(taxableBase - netBase);
      grandTotal = taxableBase;
    } else {
      // Exclusive: Pajak ditambahkan di atas harga
      taxAmount = Math.round((taxableBase * taxPercent) / 100);
      grandTotal = taxableBase + taxAmount;
    }
  } else {
    grandTotal = taxableBase;
  }

  // Tambahkan biaya pengiriman / ongkir jika ada
  grandTotal += (shippingCost || 0);

  return {
    subtotal,
    discountItemTotal,
    discountOrderAmount,
    discountOrderPercent: orderDiscountPercent,
    taxPercent,
    taxAmount,
    isTaxInclusive,
    shippingCost: shippingCost || 0,
    grandTotal: Math.max(0, Math.round(grandTotal)),
    totalItems,
    rounding: 0,
  };
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value || 0);
}

export function formatCompactRupiah(value: number): string {
  const num = value || 0;
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    const formatted = (abs / 1_000_000_000).toLocaleString('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return `${sign}${formatted} M`; // Miliar
  }
  if (abs >= 1_000_000) {
    const formatted = (abs / 1_000_000).toLocaleString('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return `${sign}${formatted} Jt`; // Juta
  }
  if (abs >= 1_000) {
    const formatted = (abs / 1_000).toLocaleString('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
    return `${sign}${formatted} Rb`; // Ribu
  }
  return `${sign}${abs.toLocaleString('id-ID')}`;
}
