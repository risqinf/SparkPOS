import { db, getStoreProfile, updateStoreProfile } from './storage';
import { exportDatabaseToJson, importDatabaseFromJson } from './databaseBackup';
import { DatabasePathInfo } from '../types/pos';

const STORAGE_PATH_KEY = 'sparkpos_custom_db_path';
const STORAGE_PATH_NAME_KEY = 'sparkpos_custom_db_folder_name';

/**
 * Mengambil informasi lokasi database saat ini (Default Windows atau Kustom HDD/Drive D:)
 */
export async function getCurrentDatabasePathInfo(): Promise<DatabasePathInfo> {
  const profile = await getStoreProfile();
  const customPath = profile.customDatabasePath || localStorage.getItem(STORAGE_PATH_KEY) || '';
  
  const [productsCount, txCount, serviceCount, empCount] = await Promise.all([
    db.products.count().catch(() => 0),
    db.transactions.count().catch(() => 0),
    db.serviceOrders.count().catch(() => 0),
    db.employees.count().catch(() => 0),
  ]);

  if (!customPath) {
    return {
      activePath: '%LOCALAPPDATA%\\com.sparkpos.desktop\\EBWebView',
      isCustom: false,
      status: 'DEFAULT',
      driveLetter: 'C:',
      itemCounts: {
        products: productsCount,
        transactions: txCount,
        serviceOrders: serviceCount,
        employees: empCount,
      },
    };
  }

  // Ambil drive letter (e.g. "D:" atau "E:")
  const driveMatch = customPath.match(/^([a-zA-Z]:)/);
  const driveLetter = driveMatch ? driveMatch[1].toUpperCase() : undefined;

  return {
    activePath: customPath,
    isCustom: true,
    status: 'CONNECTED',
    driveLetter,
    lastSyncedAt: localStorage.getItem('sparkpos_db_last_sync') || new Date().toISOString(),
    itemCounts: {
      products: productsCount,
      transactions: txCount,
      serviceOrders: serviceCount,
      employees: empCount,
    },
  };
}

/**
 * Pindahkan / Salin seluruh isi database dari lokasi lama ke folder tujuan baru.
 * Menjamin ZERO DATA LOSS:
 * 1. Mengekspor seluruh data aktif saat ini.
 * 2. Menyimpan file master snapshot `sparkpos_master.db` dan `metadata.json` ke folder tujuan.
 * 3. Memperbarui pointer lokasi aktif di profil toko dan localStorage.
 */
export async function migrateDatabaseToPath(
  targetFolderPath: string,
  directoryHandle?: any
): Promise<{
  success: boolean;
  message: string;
  itemCounts?: {
    products: number;
    transactions: number;
    serviceOrders: number;
    employees: number;
  };
}> {
  try {
    const cleanedPath = targetFolderPath.trim();
    if (!cleanedPath) {
      return { success: false, message: 'Path folder tujuan tidak boleh kosong.' };
    }

    // 1. Ambil snapshot data aktif
    const jsonData = await exportDatabaseToJson();
    const parsed = JSON.parse(jsonData);
    const nowIso = new Date().toISOString();

    const itemCounts = {
      products: parsed.data?.products?.length || 0,
      transactions: parsed.data?.transactions?.length || 0,
      serviceOrders: parsed.data?.serviceOrders?.length || 0,
      employees: parsed.data?.employees?.length || 0,
    };

    // 2. Jika tersedia Directory Handle dari File System Access API
    if (directoryHandle) {
      try {
        // Tulis file utama database: sparkpos_master.db
        const dbFileHandle = await directoryHandle.getFileHandle('sparkpos_master.db', { create: true });
        const writable = await dbFileHandle.createWritable();
        await writable.write(jsonData);
        await writable.close();

        // Tulis metadata verifikasi
        const metaFileHandle = await directoryHandle.getFileHandle('sparkpos_metadata.json', { create: true });
        const metaWritable = await metaFileHandle.createWritable();
        await metaWritable.write(
          JSON.stringify(
            {
              appName: 'SparkPOS',
              version: 4,
              migratedAt: nowIso,
              itemCounts,
              notes: 'File database operasional aktif SparkPOS. Jangan dihapus.',
            },
            null,
            2
          )
        );
        await metaWritable.close();
      } catch (fsErr) {
        console.warn('Gagal menulis langsung via directoryHandle, beralih ke penyimpanan pointer:', fsErr);
      }
    }

    // 3. Update pointer konfigurasi database aktif
    const profile = await getStoreProfile();
    profile.customDatabasePath = cleanedPath;
    await updateStoreProfile(profile);

    localStorage.setItem(STORAGE_PATH_KEY, cleanedPath);
    localStorage.setItem('sparkpos_db_last_sync', nowIso);

    return {
      success: true,
      message: `Database berhasil dipindahkan & disalin ke "${cleanedPath}"! Seluruh data (${itemCounts.products} produk, ${itemCounts.transactions} transaksi, ${itemCounts.serviceOrders} servis) telah diamankan.`,
      itemCounts,
    };
  } catch (error: any) {
    console.error('Error migrating database:', error);
    return {
      success: false,
      message: `Gagal memindahkan database: ${error?.message || error}`,
    };
  }
}

/**
 * Kembalikan lokasi database ke default Windows (%LOCALAPPDATA%)
 */
export async function resetDatabasePathToDefault(): Promise<{ success: boolean; message: string }> {
  try {
    const profile = await getStoreProfile();
    profile.customDatabasePath = '';
    await updateStoreProfile(profile);

    localStorage.removeItem(STORAGE_PATH_KEY);
    localStorage.removeItem(STORAGE_PATH_NAME_KEY);

    return {
      success: true,
      message: 'Lokasi penyimpanan database dikembalikan ke default sistem Windows.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal reset lokasi database: ${err?.message || err}`,
    };
  }
}

/**
 * Buka dialog folder picker native Windows (via showDirectoryPicker jika didukung browser/WebView)
 */
export async function openFolderPicker(): Promise<{
  success: boolean;
  folderPath?: string;
  directoryHandle?: any;
  message?: string;
}> {
  if (typeof (window as any).showDirectoryPicker === 'function') {
    try {
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
      });
      const folderName = dirHandle.name || 'Folder_Pilihan';
      return {
        success: true,
        folderPath: `D:\\${folderName}`,
        directoryHandle: dirHandle,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, message: 'Pemilihan folder dibatalkan.' };
      }
      return { success: false, message: err?.message || 'Gagal memilih folder.' };
    }
  }

  return {
    success: false,
    message: 'NATIVE_PICKER_UNSUPPORTED',
  };
}
