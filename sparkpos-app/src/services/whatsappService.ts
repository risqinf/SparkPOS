import { invoke } from '@tauri-apps/api/core';
import { ServiceOrder, StoreProfile } from '../types/pos';
import { formatRupiah } from './cartCalculator';
import { isTauriRuntime } from './printService';

export type WhatsAppTarget = 'auto' | 'web' | 'app';

export type WhatsAppTemplateType =
  | 'TERIMA'    // Tanda Terima Unit Masuk
  | 'ESTIMASI'  // Konfirmasi Service
  | 'SELESAI'   // Selesai & Siap Ambil
  | 'KRITIK'    // Kritik & Saran (Google Maps)
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
    label: 'Tanda Terima',
    badge: 'Unit Baru Masuk',
    description: 'Konfirmasi perangkat diterima, nomor nota, tanggal masuk, kelengkapan & keluhan.',
    recommendedFor: ['DITERIMA'],
  },
  {
    type: 'ESTIMASI',
    label: 'Konfirmasi Service',
    badge: 'Estimasi & Diagnosa',
    description: 'Hasil diagnosa teknisi, estimasi pengerjaan/komponen, total biaya & garansi servis.',
    recommendedFor: ['DITERIMA', 'DIKERJAKAN'],
  },
  {
    type: 'SELESAI',
    label: 'Selesai & Siap Ambil',
    badge: 'Unit Selesai',
    description: 'Pemberitahuan unit telah selesai, rincian tindakan, garansi, status lunas & syarat ambil.',
    recommendedFor: ['SELESAI'],
  },
  {
    type: 'KRITIK',
    label: 'Kritik & Saran',
    badge: 'Ulasan Google Maps',
    description: 'Ucapan terima kasih, permohonan kritik/saran, dan ajakan ulasan di Google Maps.',
    recommendedFor: ['DIAMBIL'],
  },
  {
    type: 'DIAMBIL',
    label: 'Konfirmasi Garansi',
    badge: 'Unit Diambil',
    description: 'Tanda serah terima unit lunas & informasi ketentuan masa garansi servis.',
    recommendedFor: ['DIAMBIL'],
  },
  {
    type: 'BATAL',
    label: 'Pembatalan Servis',
    badge: 'Servis Dibatalkan',
    description: 'Pemberitahuan pembatalan servis beserta alasan & instruksi pengambilan kembali unit.',
    recommendedFor: ['DIBATALKAN'],
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
  const rawStoreName = profile.storeName?.trim();
  const storeName = (rawStoreName && rawStoreName !== 'Nama Toko Saya' ? rawStoreName : 'FALAH KOMPUTER').toUpperCase();
  const storeNameTitle = rawStoreName && rawStoreName !== 'Nama Toko Saya' ? rawStoreName : 'Falah Komputer';
  const ticketNumber = order.ticketNumber;
  const device = `${order.deviceType}${order.deviceSerial ? ` (SN: ${order.deviceSerial})` : ''}`;
  const warranty = order.warrantyDays && order.warrantyDays > 0 ? `${order.warrantyDays} Hari` : 'Tidak Ada Garansi';

  const entryDate = new Date(order.receivedAt || order.createdAt).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const totalCost = formatRupiah(order.grandTotal);
  const dpAmount = order.downPayment || 0;
  const downPayment = formatRupiah(dpAmount);
  const remaining = formatRupiah(Math.max(0, order.grandTotal - dpAmount));

  // Rincian tindakan / sparepart
  const itemsText =
    order.items && order.items.length > 0
      ? order.items.map((it) => `  • ${it.name} (${it.quantity}x @${formatRupiah(it.sellPrice)})`).join('\n')
      : null;

  switch (templateType) {
    // -------------------------------------------------------------------------
    // 1. TANDA TERIMA
    // -------------------------------------------------------------------------
    case 'TERIMA': {
      return (
`*Assalamualaikum*
*Kami dari ${storeName}*
Ingin mengkonfirmasi bahwa perangkat anda dengan deskripsi :
📋 *No. Nota*: #${ticketNumber}
📅 *Tanggal Masuk*: ${entryDate}
💻 *Perangkat*: ${device}
📦 *Kelengkapan*: ${order.completeness || 'Unit Saja'}
🔍 *Kondisi Fisik*: ${order.physicalCondition || 'kondisi mulus'}
⚠️ *Keluhan*: ${order.complaint || '-'}
Saat ini perangkat Anda telah kami terima dan tercatat dalam sistem antrean. Kami akan segera menghubungi Anda setalah pengecekan dan diagnosa.
Terimakasih,
*${storeName}*
SENIN-SABTU 07.30-16.30 WIB`
      ).trim();
    }

    // -------------------------------------------------------------------------
    // 2. KONFIRMASI SERVICE
    // -------------------------------------------------------------------------
    case 'ESTIMASI': {
      return (
`*Assalamualaikum*
*Kami dari ${storeName}*
Ingin mengkonfirmasi bahwa perangkat anda dengan deskripsi :
📋 *No. Nota*: #${ticketNumber}
💻 *Perangkat*: ${device}
⚠️ *Keluhan Awal*: ${order.complaint || '-'}
🔎 *Hasil Diagnosa*: ${order.diagnosis || 'perlu direset, pembuangan penuh dan dibersihkan'}
*Estimasi Pengerjaan & Komponen:*
${itemsText || '  • Pemeriksaan & Perbaikan Unit'}
💰 *Total Estimasi Biaya*: *${totalCost}*
🛡️ *Garansi Servis*: ${warranty}
Mohon konfirmasi apakah perbaikan ini dapat kami lanjutkan sekarang?
Silakan balas pesan ini dengan *SETUJU* atau hubungi kami jika ada yang ingin ditanyakan terlebih dahulu.
Terimakasih,
*${storeName}*
SENIN-SABTU 07.30-16.30 WIB`
      ).trim();
    }

    // -------------------------------------------------------------------------
    // 3. SELESAI DAN SIAP AMBIL
    // -------------------------------------------------------------------------
    case 'SELESAI': {
      return (
`*Assalamualaikum*
*Kami dari ${storeName}*
Ingin mengkonfirmasi bahwa perangkat anda dengan deskripsi :
📋 *No. Tiket*: #${ticketNumber}
💻 *Perangkat*: ${device}
🔧 *Tindakan/Perbaikan*:
${itemsText || '  • Perbaikan & Perawatan Unit'}
🛡️ *Garansi Servis*: *${warranty}*
💰 *Total Biaya*: *${totalCost}*
💵 *DP yang Sudah Masuk*: ${downPayment}
💳 *Sisa Tagihan*: *${order.isPaid ? 'Rp 0 (LUNAS)' : remaining}*
📊 *Status Pembayaran*: *${order.isPaid ? 'LUNAS' : 'Belum Lunas'}*
Perbaikan perangkat Anda telah *SELESAI* dikerjakan dan siap di ambil sekarang.
*Syarat Pengambilan:*
* Membawa Nota Tanda Terima.
Terimakasih,
*${storeName}*
SENIN-SABTU 07.30-16.30 WIB`
      ).trim();
    }

    // -------------------------------------------------------------------------
    // 4. KRITIK DAN SARAN (GOOGLE MAPS)
    // -------------------------------------------------------------------------
    case 'KRITIK': {
      return (
`🙏 TERIMA KASIH TELAH MEMERCAYAI ${storeName}! 💻
Kami sangat menghargai setiap masukan dari pelanggan. Jika ada kritik dan saran untuk pelayanan kami, silakan sampaikan agar ${storeNameTitle} bisa terus meningkatkan kualitas pelayanan dan service menjadi lebih baik.
⭐ BANTU KAMI DENGAN MEMBERIKAN ULASAN DI GOOGLE MAPS!
Ulasan Anda sangat berarti bagi kami dan membantu pelanggan lain menemukan layanan komputer yang terpercaya.
https://maps.app.goo.gl/wNxb1yAHrTtyA7Lu7
Terima kasih atas kepercayaan dan dukungan Anda! 🙏
*${storeName}*
SENIN-SABTU 07.30-16.30 WIB`
      ).trim();
    }

    // -------------------------------------------------------------------------
    // 5. PEMBATALAN SERVIS
    // -------------------------------------------------------------------------
    case 'BATAL': {
      return (
`*Assalamualaikum*
*Kami dari ${storeName}*
Ingin mengkonfirmasi pembatalan pengerjaan perangkat anda dengan deskripsi :
📋 *No. Tiket*: #${ticketNumber}
💻 *Perangkat*: ${device}
❌ *Status*: Dibatalkan
⚠️ *Alasan / Keterangan*: *${order.cancelReason || 'Dibatalkan oleh pelanggan / kendala teknis'}*
${order.downPayment && order.downPayment > 0 ? `💵 *Catatan DP*: ${downPayment}\n` : ''}
Perangkat Anda sudah siap dan dapat diambil kembali di toko kami.
*Syarat Pengambilan:*
* Membawa Nota Tanda Terima.
Terimakasih,
*${storeName}*
SENIN-SABTU 07.30-16.30 WIB`
      ).trim();
    }

    // -------------------------------------------------------------------------
    // 6. KONFIRMASI PENGAMBILAN & GARANSI AKTIF
    // -------------------------------------------------------------------------
    case 'DIAMBIL': {
      return (
`*Assalamualaikum*
*Kami dari ${storeName}*
Terima kasih telah mengambil kembali perangkat Anda di *${storeName}*. Unit Anda telah berhasil diserahkan dan dinyatakan selesai dengan baik.
📋 *No. Tiket*: #${ticketNumber}
💻 *Perangkat*: ${device}
💰 *Total Biaya*: ${totalCost} (${order.isPaid ? 'LUNAS' : 'Telah Diselesaikan'})
🛡️ *Masa Garansi Servis*: *${warranty}*
_(Garansi berlaku terhitung sejak tanggal pengambilan unit)_

*Ketentuan Garansi:*
* Garansi berlaku untuk bagian/kerusakan yang sama dengan yang telah diperbaiki.
* Segel servis toko dalam kondisi utuh dan tidak terkena cairan / benturan fisik.

Jika ada kendala lebih lanjut mengenai perangkat Anda, jangan ragu untuk menghubungi kami kembali.
Terimakasih,
*${storeName}*
SENIN-SABTU 07.30-16.30 WIB`
      ).trim();
    }

    default:
      return '';
  }
}
