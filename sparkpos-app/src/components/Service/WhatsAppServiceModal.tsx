import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  MessageCircle,
  Copy,
  Check,
  Globe,
  Monitor,
  Phone,
  Sparkles,
  AlertCircle,
  Clock,
  ShieldCheck,
  Laptop,
} from 'lucide-react';
import { ServiceOrder, StoreProfile } from '../../types/pos';
import { useDialog } from '../../hooks/useDialog';
import {
  WhatsAppTemplateType,
  WHATSAPP_TEMPLATES,
  cleanWhatsAppPhone,
  generateWhatsAppMessage,
  sendWhatsAppMessage,
  WhatsAppTarget,
} from '../../services/whatsappService';

interface WhatsAppServiceModalProps {
  order: ServiceOrder | null;
  profile: StoreProfile;
  onClose: () => void;
}

export const WhatsAppServiceModal: React.FC<WhatsAppServiceModalProps> = ({
  order,
  profile,
  onClose,
}) => {
  const dialogRef = useDialog<HTMLDivElement>(!!order, onClose);

  // Tentukan template awal yang paling sesuai dengan status tiket saat ini
  const getDefaultTemplate = (status?: string): WhatsAppTemplateType => {
    switch (status) {
      case 'DITERIMA':
        return 'TERIMA';
      case 'DIKERJAKAN':
        return 'ESTIMASI';
      case 'SELESAI':
        return 'SELESAI';
      case 'DIAMBIL':
        return 'DIAMBIL';
      case 'DIBATALKAN':
        return 'BATAL';
      default:
        return 'SELESAI';
    }
  };

  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplateType>(
    getDefaultTemplate(order?.status)
  );
  const [phoneNumber, setPhoneNumber] = useState<string>(order?.customerPhone || '');
  const [message, setMessage] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [lastActionStatus, setLastActionStatus] = useState<string | null>(null);

  // Perbarui pesan setiap kali order atau template berganti
  useEffect(() => {
    if (order) {
      setPhoneNumber(order.customerPhone || '');
      const defaultMsg = generateWhatsAppMessage(order, profile, selectedTemplate);
      setMessage(defaultMsg);
      setLastActionStatus(null);
    }
  }, [order, selectedTemplate, profile]);

  if (!order) return null;

  const cleanedPhone = cleanWhatsAppPhone(phoneNumber);
  const isPhoneValid = cleanedPhone.length >= 10 && cleanedPhone.startsWith('62');

  const handleSend = async (target: WhatsAppTarget) => {
    if (!cleanedPhone) {
      setLastActionStatus('Nomor WhatsApp pelanggan belum diisi.');
      return;
    }

    try {
      await sendWhatsAppMessage({
        phone: cleanedPhone,
        message,
        target,
      });

      if (target === 'app') {
        setLastActionStatus('Membuka aplikasi WhatsApp Desktop...');
      } else if (target === 'web') {
        setLastActionStatus('Membuka WhatsApp Web di browser...');
      } else {
        setLastActionStatus('Membuka WhatsApp (otomatis)...');
      }
    } catch (err) {
      console.error('Gagal mengirim WhatsApp:', err);
      setLastActionStatus('Gagal membuka WhatsApp. Silakan gunakan tombol Salin Pesan.');
    }
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setIsCopied(true);
      setLastActionStatus('Teks pesan berhasil disalin ke clipboard!');
      setTimeout(() => setIsCopied(false), 2500);
    } catch (err) {
      console.error('Gagal menyalin:', err);
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header WhatsApp Hijau Khas */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/20 backdrop-blur-xs">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight">Kirim Notifikasi WhatsApp</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/25">
                  #{order.ticketNumber}
                </span>
              </div>
              <p className="text-[11px] text-emerald-100">
                Pemberitahuan resmi, sopan & langsung ke pelanggan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/20 transition"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Ringkasan Tiket & Pelanggan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block tracking-wider">
                Pelanggan & Perangkat
              </span>
              <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-sm">
                <span>{order.customerName}</span>
              </p>
              <p className="text-slate-600 dark:text-slate-400 flex items-center gap-1 font-medium">
                <Laptop className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{order.deviceType}</span>
                {order.deviceSerial && <span className="font-mono text-[11px]">({order.deviceSerial})</span>}
              </p>
            </div>

            <div className="space-y-1 sm:border-l sm:border-slate-200 sm:dark:border-slate-800 sm:pl-3">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block tracking-wider">
                Status Tiket & Biaya
              </span>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                  {order.status}
                </span>
                <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  Rp {order.grandTotal.toLocaleString('id-ID')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Keluhan: {order.complaint || '-'}
              </p>
            </div>
          </div>

          {/* Pemilih Template Pesan Sopan */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Pilih Template Pesan Sopan:</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {WHATSAPP_TEMPLATES.map((tmpl) => {
                const isSelected = selectedTemplate === tmpl.type;
                const isRecommended = tmpl.recommendedFor?.includes(order.status);
                return (
                  <button
                    type="button"
                    key={tmpl.type}
                    onClick={() => setSelectedTemplate(tmpl.type)}
                    className={`p-2.5 rounded-xl border text-left transition relative flex flex-col justify-between ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-500 font-bold'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 font-medium'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold">{tmpl.label}</span>
                      {isRecommended && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          Sesuai Status
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight block">
                      {tmpl.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input Nomor Telepon WhatsApp */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Nomor WhatsApp Pelanggan:</span>
              </label>
              {cleanedPhone && (
                <span className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  Target: +{cleanedPhone}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Contoh: 0812-3456-7890 atau 628123456789"
                className={`w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 ${
                  !isPhoneValid && phoneNumber
                    ? 'border-rose-400 dark:border-rose-700'
                    : 'border-slate-300 dark:border-slate-700'
                }`}
              />
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>
            {!phoneNumber ? (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Pelanggan belum memiliki nomor HP tersimpan. Anda dapat mengetik nomornya di atas.</span>
              </p>
            ) : !isPhoneValid ? (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Pastikan format nomor HP valid (minimal 10 digit, contoh: 08123456789).</span>
              </p>
            ) : null}
          </div>

          {/* Area Teks Pesan WhatsApp (Bisa diedit manual) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Pratinjau & Edit Pesan:</span>
              </label>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'Tersalin!' : 'Salin Pesan Saja'}</span>
              </button>
            </div>

            {/* Bubble Chat WhatsApp Style */}
            <div className="relative rounded-2xl bg-slate-100 dark:bg-slate-950 p-2.5 sm:p-3 border border-slate-300 dark:border-slate-800">
              <div className="max-w-full rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 p-3 shadow-xs">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={9}
                  className="w-full bg-transparent text-slate-900 dark:text-slate-100 text-xs font-sans leading-relaxed resize-y focus:outline-none placeholder:text-slate-400"
                  placeholder="Tulis atau sesuaikan pesan WhatsApp di sini..."
                />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 px-1 flex items-center justify-between">
                <span>* Pesan di atas dapat Anda ubah atau tambahkan keterangan khusus sebelum dikirim.</span>
                <span>{message.length} Karakter</span>
              </p>
            </div>
          </div>

          {/* Feedback Status / Info Bar */}
          {lastActionStatus && (
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 text-xs flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0" />
              <span>{lastActionStatus}</span>
            </div>
          )}
        </div>

        {/* Footer Actions: Multi-target Dispatcher */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          {/* Alternatif Manual: Buka Web / Desktop / Salin */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => handleSend('web')}
              disabled={!isPhoneValid}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              title="Buka langsung di WhatsApp Web (Browser)"
            >
              <Globe className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>WhatsApp Web</span>
            </button>

            <button
              type="button"
              onClick={() => handleSend('app')}
              disabled={!isPhoneValid}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              title="Buka di aplikasi WhatsApp Desktop Windows"
            >
              <Monitor className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>WhatsApp App (Desktop)</span>
            </button>

            <button
              type="button"
              onClick={handleCopyMessage}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition flex items-center gap-1.5"
              title="Salin teks pesan ke clipboard"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{isCopied ? 'Tersalin' : 'Salin Pesan'}</span>
            </button>
          </div>

          {/* Primary Action Button: Otomatis */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={() => handleSend('auto')}
              disabled={!isPhoneValid}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-950/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              <span>Kirim WhatsApp Sekarang</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
