/**
 * Kategori & contoh keterangan arus kas toko komputer.
 * Disusun dari pola pencatatan kas harian toko (beli unit/bahan, listrik & air, perlengkapan, ongkir, dll).
 */
export const CASH_OUT_CATEGORIES = [
  'Beli Unit / Bahan dari Pelanggan',
  'Beli Stok / Sparepart dari Distributor',
  'Listrik, Air & Internet',
  'Perlengkapan & Kemasan (lakban, dus, bubble wrap)',
  'Ongkos Kirim / Ekspedisi',
  'Jasa Servis Pihak Ketiga',
  'Konsumsi & Air Minum',
  'Kebersihan, Keamanan & Sumbangan',
  'Setoran / Kas Titipan',
  'Lain-lain',
];

export const CASH_IN_CATEGORIES = [
  'Tambah Modal Kas Laci',
  'Pemasukan Non-Penjualan',
  'Setoran / Titipan Diterima',
  'Lain-lain',
];

export const CASH_OUT_NOTE_EXAMPLES = [
  'Bayar listrik bulan ini',
  'Beli lakban 12 roll & bubble wrap',
  'Ongkir kirim paket ke pelanggan',
  'Bayar servis mobo ke teknisi luar',
  'Beli keyboard Asus E401M untuk stok',
];

export const CASH_IN_NOTE_EXAMPLES = [
  'Tambah modal kas laci pagi hari',
  'Titipan uang dari pemilik',
  'Pengembalian dana dari supplier',
];

export function noteExample(type: 'IN' | 'OUT'): string {
  const list = type === 'OUT' ? CASH_OUT_NOTE_EXAMPLES : CASH_IN_NOTE_EXAMPLES;
  return `Contoh: ${list[0]} / ${list[1] ?? list[0]}`;
}
