import React, { useState, useEffect } from 'react';
import { X, Printer, Copy, Check, FileText, ShieldCheck, Sparkles, Building2, User } from 'lucide-react';
import { Transaction, StoreProfile } from '../../types/pos';
import {
  generateReceiptText,
  printReceiptSilent,
  calculateWarrantyExpiry,
  detectOptimalPaperFormat,
} from '../../services/printer';
import { formatRupiah } from '../../services/cartCalculator';

interface ReceiptModalProps {
  transaction: Transaction;
  storeProfile: StoreProfile;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  transaction,
  storeProfile,
  onClose,
}) => {
  // Auto-detect optimal paper format: A4 if Laptop/High-value/Warranty, otherwise 80mm/58mm
  const [paperFormat, setPaperFormat] = useState<'58mm' | '80mm' | 'A4'>(() => {
    return detectOptimalPaperFormat(transaction, storeProfile.paperWidth);
  });

  const [copied, setCopied] = useState(false);

  const activeProfile: StoreProfile = {
    ...storeProfile,
    paperWidth: paperFormat === 'A4' ? '80mm' : paperFormat,
  };

  const receiptText = generateReceiptText(transaction, activeProfile);

  const handlePrint = () => {
    // Inject appropriate paper class dynamically to the printable container before printing
    const el = document.getElementById('printable-receipt');
    if (el) {
      el.className =
        paperFormat === 'A4'
          ? 'paper-a4 bg-white text-slate-950 p-8 font-sans max-w-[210mm] mx-auto'
          : `paper-thermal paper-${paperFormat} bg-white text-slate-950 p-4 font-mono text-xs leading-tight ${
              paperFormat === '58mm' ? 'w-[290px]' : 'w-[370px]'
            } mx-auto`;
    }
    printReceiptSilent(transaction, activeProfile);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(receiptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Find items with warranty (Laptop / Hardware)
  const warrantyItems = transaction.items.filter(
    (item) =>
      item.warrantyPeriod &&
      !['tidak ada', 'non-garansi', '-'].includes(item.warrantyPeriod.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-850 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Pratinjau Struk & Faktur Penjualan</span>
                {warrantyItems.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Ada Garansi Unit Laptop</span>
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-400">
                Support Semua Printer: Thermal Kasir (58mm/80mm) & Printer Kantor (A4/F4)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paper Format Auto-Detect & Switcher Toolbar */}
        <div className="px-5 py-2.5 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between shrink-0 text-xs flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-bold">Format Kertas Printer:</span>
            <span className="text-[10px] text-emerald-400 font-semibold">
              (Auto-Detect Rekomendasi: {paperFormat === 'A4' ? 'Faktur A4/F4' : `${paperFormat} Kasir`})
            </span>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setPaperFormat('58mm')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                paperFormat === '58mm'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ⚡ 58mm Mini Kasir
            </button>
            <button
              type="button"
              onClick={() => setPaperFormat('80mm')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                paperFormat === '80mm'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🧾 80mm POS Kasir
            </button>
            <button
              type="button"
              onClick={() => setPaperFormat('A4')}
              className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                paperFormat === 'A4'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>📄 A4 / F4 Faktur Resmi</span>
            </button>
          </div>
        </div>

        {/* Paper Canvas Preview Area */}
        <div className="p-6 overflow-y-auto flex-1 flex justify-center bg-slate-950/90">
          {paperFormat === 'A4' ? (
            /* ================= CORPORATE A4 / F4 OFFICIAL INVOICE & WARRANTY CARD ================= */
            <div
              id="printable-receipt"
              className="paper-a4 bg-white text-slate-950 p-8 rounded-lg shadow-2xl font-sans text-xs w-full max-w-[760px] border border-slate-300 space-y-6"
            >
              {/* Kop Faktur Toko */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
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

              {/* Tabel Rincian Produk & Hardware */}
              <div>
                <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 font-extrabold uppercase tracking-wider text-[11px] border-b border-slate-300">
                      <th className="py-2 px-3 border-r border-slate-300 text-center w-10">No</th>
                      <th className="py-2 px-3 border-r border-slate-300">Nama Produk / Unit Hardware</th>
                      <th className="py-2 px-3 border-r border-slate-300">No. Seri (SN)</th>
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
                          <td className="py-2.5 px-3 border-r border-slate-300 font-mono text-[11px] text-slate-700">
                            {item.serialNumber || '-'}
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

              {/* KARTU GARANSI & SYARAT KETENTUAN RESMI TOKO */}
              {warrantyItems.length > 0 && (
                <div className="p-4 rounded-lg border-2 border-emerald-600 bg-emerald-50/50 space-y-2">
                  <div className="flex items-center gap-1.5 text-emerald-900 font-extrabold text-xs uppercase tracking-wide">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Kartu Garansi Resmi Unit Komputer / Laptop</span>
                  </div>
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    Faktur ini merupakan <strong>bukti kartu garansi sah</strong> dari toko kami. Mohon simpan nota ini dengan baik untuk keperluan klaim garansi hardware.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-700 border-t border-emerald-200 pt-2">
                    <div>
                      <strong>Syarat & Ketentuan Klaim Garansi:</strong>
                      <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                        <li>Segel garansi toko pada baut/unit dalam keadaan utuh.</li>
                        <li>Membawa unit laptop beserta charger dan nota ini.</li>
                      </ul>
                    </div>
                    <div>
                      <strong>Garansi Batal / Void Apabila:</strong>
                      <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                        <li>Kerusakan fisik (pecah, retak, terjatuh, engsel patah).</li>
                        <li>Terkena cairan/air, terbakar, korsleting petir/listrik.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Kolom Tanda Tangan */}
              <div className="pt-6 grid grid-cols-2 text-center text-xs text-slate-800">
                <div>
                  <p className="font-semibold">Tanda Terima Pelanggan,</p>
                  <div className="h-16"></div>
                  <p className="font-bold underline">
                    ( {transaction.customerName || '......................................'} )
                  </p>
                </div>
                <div>
                  <p className="font-semibold">Hormat Kami / Kasir,</p>
                  <div className="h-16"></div>
                  <p className="font-bold underline">
                    ( {transaction.cashierName || storeProfile.storeName} )
                  </p>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-500 pt-2 border-t border-slate-200">
                {storeProfile.receiptFooter || 'Terima kasih atas kepercayaan Anda bertransaksi di toko kami.'}
              </div>
            </div>
          ) : (
            /* ================= CLASSIC 58mm / 80mm THERMAL RECEIPT ================= */
            <div
              id="printable-receipt"
              className={`paper-thermal paper-${paperFormat} bg-white text-slate-950 p-6 rounded shadow-2xl font-mono text-xs leading-relaxed border-t-8 border-slate-300 ${
                paperFormat === '58mm' ? 'w-[290px]' : 'w-[370px]'
              }`}
            >
              {/* Store Logo if configured */}
              {activeProfile.showLogoOnReceipt && activeProfile.appLogo && (
                <div className="flex justify-center mb-3">
                  <img
                    src={activeProfile.appLogo}
                    alt="Receipt Logo"
                    className="max-h-14 max-w-[140px] object-contain grayscale contrast-200"
                  />
                </div>
              )}

              <pre className="whitespace-pre-wrap font-mono text-[11px] leading-tight select-all">
                {receiptText}
              </pre>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-850 border-t border-slate-800 flex items-center justify-between shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750 font-bold text-xs transition cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Tersalin!' : 'Salin Teks Nota'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-750 font-bold text-xs transition cursor-pointer"
            >
              Tutup (Esc)
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition shadow-lg shadow-emerald-950/40 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak ({paperFormat === 'A4' ? 'Printer Biasa A4/F4' : `Thermal ${paperFormat}`})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
