import { invoke } from '@tauri-apps/api/core';
import { ServiceOrder, StoreProfile } from '../types/pos';
import { formatRupiah } from './cartCalculator';
import { isTauriRuntime } from './printService';

export type WhatsAppTarget = 'auto' | 'web' | 'app';

export type WhatsAppTemplateType =
  | 'TERIMA'    // Tanda Terima Unit Masuk
  | 'ESTIMASI'  // Konfirmasi Diagnosa & Estimasi Biaya
  | 'SELESAI'   // Servis Selesai & Siap Diambil
  | 'DIAMBIL'   // Konfirmasi Unit Telah Diambil (Masa Garansi Aktif)
  | 'BATAL';    // Pemberitahuan Servis Dibatalkan

export interface WhatsAppTemplateOption {
  type: WhatsAppTemplateType;
  label: string;
  badge: string;
  description: string;
  recommendedFor?: string[];
}

export const WHATSAPP_TEMPLATES: WhatsAppTemplateOption[] = [
  {
    type: 'TERIMA',
    label: 'Tanda Terima Masuk',
    badge: 'Unit Baru Masuk',
    description: 'Bukti tanda terima servis masuk, nomor tiket, keluhan & kelengkapan unit.',
    recommendedFor: ['DITERIMA'],
  },
  {
    type: 'ESTIMASI',
    label: 'Estimasi Biaya',
    badge: 'Konfirmasi Pelanggan',
    description: 'Kabar hasil diagnosa teknisi, estimasi kebutuhan sparepart/jasa & persetujuan biaya.',
    recommendedFor: ['DITERIMA', 'DIKERJAKAN'],
  },
  {
    type: 'SELESAI',
    label: 'Selesai & Siap Diambil',
    badge: 'Unit Selesai',
    description: 'Kabar gembira unit selesai diperbaiki, rincian biaya, DP, sisa tagihan & garansi servis.',
    recommendedFor: ['SELESAI'],
  },
  {
    type: 'BATAL',
    label: 'Pembatalan Servis',
    badge: 'Servis Dibatalkan',
    description: 'Pemberitahuan pembatalan servis beserta alasan & instruksi pengambilan kembali unit.',
    recommendedFor: ['DIBATALKAN'],
  },
  {
    type: 'DIAMBIL',
    label: 'Terima Kasih & Garansi',
    badge: 'Unit Diambil',
    description: 'Ucapan terima kasih telah mengambil unit, tanda terima lunas & pengingat masa garansi.',
    recommendedFor: ['DIAMBIL'],
  },
];

/**
 * Format nomor telepon Indonesia ke format standar WhatsApp internasional (628xxx).
 * Menghapus spasi, strip, tanda kurung, dan karakter non-digit.
 */
export function cleanWhatsAppPhone(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');

  // Jika diawali 08xx -> 628xx
  if (cleaned.startsWith('08')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  } else if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  }

  return cleaned;
}

/**
 * Membuka URL eksternal baik di runtime desktop Tauri maupun browser web.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (isTauriRuntime()) {
    try {
      await invoke('open_url', { url });
      return;
    } catch (err) {
      console.warn('invoke open_url gagal, dialihkan ke window.open:', err);
    }
  }

  // Fallback standar browser
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Membuka percakapan WhatsApp dengan nomor & pesan tertentu.
 * Mendukung 3 metode:
 * - 'auto': https://api.whatsapp.com (Otomatis mendeteksi WhatsApp Web atau memicu WA Desktop jika ada)
 * - 'web': https://web.whatsapp.com (Langsung membuka WhatsApp Web di peramban)
 * - 'app': whatsapp://send (Memicu aplikasi WhatsApp Desktop yang terinstal di komputer)
 */
export async function sendWhatsAppMessage({
  phone,
  message,
  target = 'auto',
}: {
  phone: string;
  message: string;
  target?: WhatsAppTarget;
}): Promise<void> {
  const cleanPhone = cleanWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(message);

  let url = '';
  switch (target) {
    case 'web':
      url = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
      break;
    case 'app':
      url = `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`;
      break;
    case 'auto':
    default:
      url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
      break;
  }

  await openExternalUrl(url);
}

/**
 * Menghasilkan pesan WhatsApp yang sangat sopan, rapi, dan profesional
 * berdasarkan status tiket servis dan profil toko.
 */
export function generateWhatsAppMessage(
  order: ServiceOrder,
  profile: StoreProfile,
  templateType: WhatsAppTemplateType
): string {
  const storeName = (profile.storeName || 'Toko Komputer & Servis').toUpperCase();
  const customerName = order.customerName || 'Pelanggan';
  const ticketNumber = order.ticketNumber;
  const device = `${order.deviceType}${order.deviceSerial ? ` (SN: ${order.deviceSerial})` : ''}`;
  const address = profile.address ? `\n📍 *Alamat Toko*: ${profile.address}` : '';
  const phone = profile.phone ? `\n📞 *Hotline/WA*: ${profile.phone}` : '';
  const warranty = order.warrantyDays && order.warrantyDays > 0 ? `${order.warrantyDays} Hari` : 'Tidak Ada Garansi';

  const entryDate = new Date(order.createdAt).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const totalCost = formatRupiah(order.grandTotal);
  const downPayment = order.downPayment && order.downPayment > 0 ? formatRupiah(order.downPayment) : 'Rp 0';
  const remaining = formatRupiah(Math.max(0, order.grandTotal - (order.downPayment || 0)));

  // Rincian tindakan / sparepart
  const itemsText =
    order.items && order.items.length > 0
      ? order.items.map((it) => `  • ${it.name} (${it.quantity}x @${formatRupiah(it.sellPrice)})`).join('\n')
      : null;

  switch (templateType) {
    // -------------------------------------------------------------------------
    // 1. TANDA TERIMA SERVIS MASUK
    // -------------------------------------------------------------------------
    case 'TERIMA': {
      return (
`*TANDA TERIMA SERVIS - ${storeName}*
_No. Nota / Tiket: #${ticketNumber}_

Yth. Kak/Bpk/Ibu *${customerName}*,
Terima kasih telah mempercayakan perbaikan perangkat Anda kepada kami di *${storeName}*.

Berikut rincian tanda terima servis:
📋 *No. Tiket*: #${ticketNumber}
📅 *Tanggal Masuk*: ${entryDate}
💻 *Perangkat*: ${device}
📦 *Kelengkapan*: ${order.completeness || 'Unit Saja'}
🔍 *Kondisi Fisik*: ${order.physicalCondition || 'Normal / Standar'}
⚠️ *Keluhan*: ${order.complaint || '-'}
${order.diagnosis ? `🔎 *Diagnosa Awal*: ${order.diagnosis}\n` : ''}💵 *Uang Muka (DP)*: ${downPayment}

Saat ini perangkat Anda telah tercatat dalam sistem antrean dan sedang dipersiapkan untuk pengecekan oleh teknisi kami. Kami akan segera menghubungi Anda jika ada perkembangan hasil pemeriksaan.

_Harap simpan pesan ini atau membawa nota tanda terima fisik saat pengambilan unit._

Terima kasih atas kepercayaannya. 🙏

Salam hormat,
*${storeName}*${address}${phone}`
      ).trim();
    }

    // -------------------------------------------------------------------------
    // 2. KONFIRMASI DIAGNOSA & ESTIMASI BIAYA
    // -------------------------------------------------------------------------
    case 'ESTIMASI': {
      return (
`*KONFIRMASI HASIL DIAGNOSA & ESTIMASI BIAYA - ${storeName}*
_No. Nota / Tiket: #${ticketNumber}_

Yth. Kak/Bpk/Ibu *${customerName}*,
Semoga dalam keadaan sehat selalu. Teknisi kami telah selesai melakukan pengecekan awal pada perangkat Anda:

📋 *No. Tiket*: #${ticketNumber}
💻 *Perangkat*: ${device}
⚠️ *Keluhan Awal*: ${order.complaint || '-'}
🔎 *Hasil Diagnosa*: ${order.diagnosis || 'Pengecekan komponen & pengetesan'}

*Estimasi Pengerjaan & Komponen:*
${itemsText ? `${itemsText}\n` : ''}💰 *Total Estimasi Biaya*: *${totalCost}*
${order.downPayment && order.downPayment > 0 ? `💵 *DP yang Sudah Masuk*: ${downPayment}\n` : ''}💳 *Sisa Pembayaran Nanti*: *${remaining}*
🛡️ *Garansi Servis*: ${warranty}

Mohon konfirmasi apakah perbaikan ini dapat kami lanjutkan sekarang?
Silakan balas pesan ini dengan *SETUJU* atau hubungi kami jika ada yang ingin ditanyakan terlebih dahulu.

Terima kasih atas perhatian dan kerjasamanya. 🙏

Salam hormat,
*${storeName}*${address}${phone}`
      ).trim();
    }

    // -------------------------------------------------------------------------
    // 3. SERVIS SELESAI & SIAP DIAMBIL
    // -------------------------------------------------------------------------
    case 'SELESAI': {
      return (
`*PEMBERITAHUAN SERVIS SELESAI - ${storeName}*
_No. Nota / Tiket: #${ticketNumber}_

Kabar gembira untuk Kak/Bpk/Ibu *${customerName}*! 🎉
Perbaikan perangkat Anda telah *SELESAI* dikerjakan oleh teknisi kami dan telah lolos tahap pengujian (*Quality Control*).

Rincian servis:
📋 *No. Tiket*: #${ticketNumber}
💻 *Perangkat*: ${device}
${itemsText ? `🔧 *Tindakan/Perbaikan*:\n${itemsText}\n` : ''}🛡️ *Garansi Servis*: *${warranty}*
💰 *Total Biaya*: *${totalCost}*
💵 *DP yang Sudah Masuk*: ${downPayment}
💳 *Sisa Tagihan*: *${order.isPaid ? 'Rp 0 (LUNAS)' : remaining}*
📊 *Status Pembayaran*: *${order.isPaid ? 'LUNAS' : 'Belum Lunas'}*

Perangkat sudah siap untuk diambil kembali di toko kami pada jam operasional toko.
*Syarat Pengambilan:*
- Harap menunjukkan pesan WhatsApp ini atau membawa Nota Tanda Terima fisik saat penyerahan unit.

Terima kasih atas kepercayaan Anda kepada *${storeName}*. Kami tunggu kehadirannya! 🙏

Salam hangat,
*${storeName}*${address}${phone}`
      ).trim();
    }

    // -------------------------------------------------------------------------
    // 4. PEMBATALAN SERVIS
    // -------------------------------------------------------------------------
    case 'BATAL': {
      return (
`*PEMBERITAHUAN PEMBATALAN SERVIS - ${storeName}*
_No. Nota / Tiket: #${ticketNumber}_

Yth. Kak/Bpk/Ibu *${customerName}*,
Kami menginformasikan bahwa proses perbaikan perangkat Anda saat ini berstatus *DIBATALKAN*:

📋 *No. Tiket*: #${ticketNumber}
💻 *Perangkat*: ${device}
❌ *Status*: Dibatalkan
⚠️ *Alasan / Keterangan*: *${order.cancelReason || 'Dibatalkan oleh pelanggan / teknisi'}*
${order.downPayment && order.downPayment > 0 ? `💵 *Catatan DP*: ${downPayment} (Dapat dikonfirmasi kembali di kasir toko)\n` : ''}
Perangkat Anda sudah siap dan dapat diambil kembali di toko kami.
Mohon membawa Nota Tanda Terima fisik atau menunjukkan pesan ini saat pengambilan unit.

Kami mohon maaf atas ketidaknyamanan ini dan berterima kasih atas pengertian serta kerja sama Anda. 🙏

Salam hormat,
*${storeName}*${address}${phone}`
      ).trim();
    }

    // -------------------------------------------------------------------------
    // 5. TERIMA KASIH UNIT TELAH DIAMBIL & GARANSI AKTIF
    // -------------------------------------------------------------------------
    case 'DIAMBIL': {
      return (
`*TERIMA KASIH ATAS KUNJUNGAN ANDA - ${storeName}*
_No. Nota / Tiket: #${ticketNumber}_

Yth. Kak/Bpk/Ibu *${customerName}*,
Terima kasih telah mengambil kembali perangkat Anda di *${storeName}*. Unit Anda telah berhasil diserahkan dan dinyatakan selesai dengan baik.

Rincian serah terima:
📋 *No. Tiket*: #${ticketNumber}
💻 *Perangkat*: ${device}
💰 *Total Biaya*: ${totalCost} (${order.isPaid ? 'LUNAS' : 'Telah Diselesaikan'})
🛡️ *Masa Garansi Servis*: *${warranty}*
_(Garansi berlaku terhitung sejak tanggal pengambilan unit)_

*Ketentuan Garansi:*
- Garansi berlaku untuk bagian/kerusakan yang sama dengan yang telah diperbaiki.
- Segel servis toko dalam kondisi utuh dan tidak terkena cairan / benturan fisik.

Jika ada kendala lebih lanjut mengenai perangkat Anda, jangan ragu untuk menghubungi kami kembali. Senang bisa membantu Anda! 🙏

Salam hangat,
*${storeName}*${address}${phone}`
      ).trim();
    }

    default:
      return '';
  }
}
