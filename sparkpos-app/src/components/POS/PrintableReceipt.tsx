import React from 'react';
import { Transaction, StoreProfile } from '../../types/pos';
import { generateReceiptText, calculateWarrantyExpiry, isWarrantyEligibleItem } from '../../services/printer';
import { formatRupiah } from '../../services/cartCalculator';
import { ShieldCheck } from 'lucide-react';

interface PrintableReceiptProps {
  transaction: Transaction;
  storeProfile: StoreProfile;
  paperFormat: '58mm' | 'A4';
}

export const PrintableReceipt: React.FC<PrintableReceiptProps> = ({
  transaction,
  storeProfile,
  paperFormat,
}) => {
  const activeProfile: StoreProfile = {
    ...storeProfile,
    paperWidth: '58mm',
  };

  const receiptText = generateReceiptText(transaction, activeProfile);

  const warrantyItems = transaction.items.filter(
    (item) =>
      isWarrantyEligibleItem(item) &&
      item.warrantyPeriod &&
      !['tidak ada', 'non-garansi', '-'].includes(item.warrantyPeriod.toLowerCase())
  );

  if (paperFormat === 'A4') {
    return (
      <div
        id="printable-receipt"
        className="paper-a4 bg-white text-slate-950 p-4 sm:p-6 font-sans text-xs w-full max-w-[210mm] mx-auto space-y-3"
      >
        {/* Kop Faktur Toko */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-2.5">
          <div className="space-y-1">
            <h1 className="text-xl font-black uppercase tracking-tight text-slate-950">
              {storeProfile.storeName || 'SPARKPOS COMPUTER'}
            </h1>
            {storeProfile.address && (
              <p className="text-xs text-slate-600 max-w-sm">{storeProfile.address}</p>
            )}
            {storeProfile.phone && (
              <p className="text-xs font-semibold text-slate-700">
                No. Telp / WhatsApp: {storeProfile.phone}
              </p>
            )}
          </div>

          <div className="text-right space-y-0.5">
            <div className="inline-block px-3 py-1 bg-slate-950 text-white font-extrabold uppercase tracking-wider text-xs rounded mb-1">
              FAKTUR PENJUALAN RESMI
            </div>
            <div className="font-mono text-xs font-black text-slate-900">
              No. {transaction.invoiceNumber}
            </div>
            <div className="text-slate-600 text-[11px]">
              Tanggal:{' '}
              {new Date(transaction.createdAt).toLocaleString('id-ID', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </div>
            <div className="text-slate-600 text-[11px]">
              Kasir: {transaction.cashierName || 'Kasir Toko'}
            </div>
            <div className="text-slate-900 font-bold text-xs mt-1">
              Kepada: {transaction.customerName || 'Pelanggan Umum'}
            </div>
          </div>
        </div>

        {/* Tabel Rincian Produk (Nomor Seri Dihapus Sesuai Permintaan) */}
        <div>
          <table className="w-full text-left border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-extrabold uppercase tracking-wider text-[11px] border-b border-slate-300">
                <th className="py-2 px-3 border-r border-slate-300 text-center w-10">No</th>
                <th className="py-2 px-3 border-r border-slate-300">Nama Produk / Unit Hardware</th>
                <th className="py-2 px-3 border-r border-slate-300">Garansi Unit</th>
                <th className="py-2 px-3 border-r border-slate-300 text-center w-12">Qty</th>
                <th className="py-2 px-3 border-r border-slate-300 text-right">Harga Satuan</th>
                <th className="py-2 px-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {transaction.items.map((item, idx) => {
                const warranty = calculateWarrantyExpiry(transaction.createdAt, item.warrantyPeriod);
                return (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 border-r border-slate-300 text-center font-bold">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-300 font-semibold text-slate-900">
                      <div>{item.name}</div>
                      {item.condition && item.condition !== 'BARU' && (
                        <span className="inline-block mt-0.5 text-[9px] font-extrabold px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded">
                          KONDISI: {item.condition}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-300 text-slate-800 font-medium">
                      {warranty.label !== 'Non-Garansi' ? (
                        <div>
                          <span className="font-bold text-emerald-700">{warranty.label}</span>
                          <div className="text-[10px] text-slate-500">
                            Hingga: {warranty.expiryDateStr}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">Non-Garansi</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-300 text-center font-bold">
                      {item.quantity}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-300 text-right font-mono">
                      {formatRupiah(item.unitPrice)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatRupiah(item.subtotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Rincian Total Finansial */}
        <div className="flex justify-end">
          <div className="w-72 space-y-1.5 border border-slate-300 rounded-lg p-3 bg-slate-50 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal:</span>
              <span className="font-mono font-semibold">{formatRupiah(transaction.subtotal)}</span>
            </div>
            {transaction.discountOrderAmount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Diskon Faktur:</span>
                <span className="font-mono font-semibold">
                  -{formatRupiah(transaction.discountOrderAmount)}
                </span>
              </div>
            )}
            {transaction.taxAmount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>PPN:</span>
                <span className="font-mono font-semibold">{formatRupiah(transaction.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-300 pt-1.5 text-sm font-black text-slate-900">
              <span>TOTAL AKHIR:</span>
              <span className="font-mono text-emerald-700">{formatRupiah(transaction.grandTotal)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-700 pt-1 border-t border-slate-200">
              <span>Metode Bayar:</span>
              <span className="font-bold uppercase">
                {transaction.paymentMethod === 'TRANSFER' ? '🏦 Transfer Bank' : '💵 Tunai (Cash)'}
              </span>
            </div>
          </div>
        </div>

        {/* KARTU GARANSI KHUSUS UNIT LAPTOP / SPAREPART / PRINTER */}
        {warrantyItems.length > 0 && (
          <div className="p-3.5 rounded-lg border-2 border-emerald-600 bg-emerald-50/50 space-y-1.5 text-center">
            <div className="flex items-center justify-center gap-1.5 text-emerald-900 font-extrabold text-xs uppercase tracking-wide">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Kartu Garansi Resmi Toko (Laptop / Sparepart / Printer)</span>
            </div>
            <p className="text-xs text-slate-800 font-bold">
              Terimakasih atas kunjungannya, sertakan kartu garansi ini saat klaim.
            </p>
            <p className="text-[10px] text-slate-600">
              Faktur ini merupakan bukti kartu garansi sah untuk unit laptop / sparepart / printer yang tertera. Mohon disimpan dengan baik.
            </p>
          </div>
        )}

        {/* Kolom Tanda Tangan */}
        <div className="pt-3 grid grid-cols-2 text-center text-xs text-slate-800">
          <div>
            <p className="font-semibold">Tanda Terima Pelanggan,</p>
            <div className="h-10"></div>
            <p className="font-bold underline">
              ( {transaction.customerName || '......................................'} )
            </p>
          </div>
          <div>
            <p className="font-semibold">Hormat Kami / Kasir,</p>
            <div className="h-10"></div>
            <p className="font-bold underline">
              ( {transaction.cashierName || storeProfile.storeName} )
            </p>
          </div>
        </div>

        <div className="text-center text-[10px] text-slate-500 pt-2 border-t border-slate-200">
          {storeProfile.receiptFooter || 'Terima kasih atas kepercayaan Anda bertransaksi di toko kami.'}
        </div>
      </div>
    );
  }

  return (
    <div
      id="printable-receipt"
      className="paper-thermal paper-58mm bg-white text-slate-950 p-2 font-mono text-xs leading-relaxed max-w-[290px] mx-auto"
    >
      {activeProfile.showLogoOnReceipt && activeProfile.appLogo && (
        <div className="flex justify-center mb-2">
          <img
            src={activeProfile.appLogo}
            alt="Receipt Logo"
            className="max-h-12 max-w-[120px] object-contain grayscale contrast-200"
          />
        </div>
      )}

      <pre className="whitespace-pre-wrap font-mono text-[11px] leading-tight select-all">
        {receiptText}
      </pre>
    </div>
  );
};
