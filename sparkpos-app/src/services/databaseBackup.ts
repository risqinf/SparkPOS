import { db } from './storage';

export interface DatabaseBackupPayload {
  version: number;
  appName: string;
  exportedAt: string;
  data: {
    products: any[];
    categories: any[];
    units: any[];
    stockMovements: any[];
    transactions: any[];
    shifts: any[];
    heldCarts: any[];
    settings: any[];
    employees: any[];
    cashFlows?: any[];
    suppliers?: any[];
    serviceOrders?: any[];
    serviceItems?: any[];
  };
}

/**
 * Ekspor seluruh isi database IndexedDB menjadi objek JSON terstruktur.
 */
export async function exportDatabaseToJson(): Promise<string> {
  const [
    products,
    categories,
    units,
    stockMovements,
    transactions,
    shifts,
    heldCarts,
    settings,
    employees,
    cashFlows,
    suppliers,
    serviceOrders,
    serviceItems,
  ] = await Promise.all([
    db.products.toArray(),
    db.categories.toArray(),
    db.units.toArray(),
    db.stockMovements.toArray(),
    db.transactions.toArray(),
    db.shifts.toArray(),
    db.heldCarts.toArray(),
    db.settings.toArray(),
    db.employees.toArray(),
    db.cashFlows.toArray(),
    db.suppliers.toArray(),
    db.serviceOrders.toArray(),
    db.serviceItems.toArray(),
  ]);

  const payload: DatabaseBackupPayload = {
    version: 4,
    appName: 'SparkPOS',
    exportedAt: new Date().toISOString(),
    data: {
      products,
      categories,
      units,
      stockMovements,
      transactions,
      shifts,
      heldCarts,
      settings,
      employees,
      cashFlows,
      suppliers,
      serviceOrders,
      serviceItems,
    },
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Simpan backup database ke file dengan membiarkan user memilih folder / drive (D:\, Flashdisk, dll)
 * Menggunakan File System Access API (showSaveFilePicker) jika tersedia di sistem Windows.
 */
export async function saveDatabaseToFile(suggestedFileName?: string): Promise<{
  success: boolean;
  fileName?: string;
  filePath?: string;
  message?: string;
}> {
  try {
    const jsonString = await exportDatabaseToJson();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = suggestedFileName || `SparkPOS_Backup_${timestamp}.sparkdb`;

    // 1. Coba File System Access API (Buka Windows File Dialog untuk pilih drive D:\ dll)
    if (typeof (window as any).showSaveFilePicker === 'function') {
      try {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: 'SparkPOS Database Backup (*.sparkdb, *.json)',
              accept: {
                'application/json': ['.sparkdb', '.json'],
              },
            },
          ],
        });

        const writable = await fileHandle.createWritable();
        await writable.write(jsonString);
        await writable.close();

        return {
          success: true,
          fileName: fileHandle.name || fileName,
          message: `Database berhasil disimpan ke: ${fileHandle.name || fileName}`,
        };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return { success: false, message: 'Pemilihan folder dibatalkan.' };
        }
        console.warn('showSaveFilePicker gagal, menggunakan fallback download:', err);
      }
    }

    // 2. Fallback: Standar Web Download Dialog
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return {
      success: true,
      fileName,
      message: `File cadangan berhasil diunduh (${fileName}). Anda dapat memindahkannya ke Drive D: atau penyimpanan eksternal.`,
    };
  } catch (error: any) {
    console.error('Gagal mencadangkan database:', error);
    return {
      success: false,
      message: `Gagal mencadangkan database: ${error?.message || error}`,
    };
  }
}

/**
 * Memulihkan (Restore) database dari string JSON cadangan.
 * Seluruh tabel yang ada akan digantikan dengan data yang dipulihkan.
 */
export async function importDatabaseFromJson(jsonContent: string): Promise<{
  success: boolean;
  message: string;
  itemCounts?: {
    products: number;
    categories: number;
    transactions: number;
    employees: number;
    suppliers?: number;
    serviceOrders?: number;
  };
}> {
  try {
    const parsed: DatabaseBackupPayload = JSON.parse(jsonContent);

    if (!parsed.data || typeof parsed.data !== 'object') {
      throw new Error('Format file backup tidak valid. Data tidak ditemukan.');
    }

    const {
      products = [],
      categories = [],
      units = [],
      stockMovements = [],
      transactions = [],
      shifts = [],
      heldCarts = [],
      settings = [],
      employees = [],
      cashFlows = [],
      suppliers = [],
      serviceOrders = [],
      serviceItems = [],
    } = parsed.data;

    // Bersihkan semua tabel lama dalam satu transaksi database
    await db.transaction('rw', [
      db.products,
      db.categories,
      db.units,
      db.stockMovements,
      db.transactions,
      db.shifts,
      db.heldCarts,
      db.settings,
      db.employees,
      db.cashFlows,
      db.suppliers,
      db.serviceOrders,
      db.serviceItems,
    ], async () => {
      await Promise.all([
        db.products.clear(),
        db.categories.clear(),
        db.units.clear(),
        db.stockMovements.clear(),
        db.transactions.clear(),
        db.shifts.clear(),
        db.heldCarts.clear(),
        db.settings.clear(),
        db.employees.clear(),
        db.cashFlows.clear(),
        db.suppliers.clear(),
        db.serviceOrders.clear(),
        db.serviceItems.clear(),
      ]);

      if (products.length > 0) await db.products.bulkAdd(products);
      if (categories.length > 0) await db.categories.bulkAdd(categories);
      if (units.length > 0) await db.units.bulkAdd(units);
      if (stockMovements.length > 0) await db.stockMovements.bulkAdd(stockMovements);
      if (transactions.length > 0) await db.transactions.bulkAdd(transactions);
      if (shifts.length > 0) await db.shifts.bulkAdd(shifts);
      if (heldCarts.length > 0) await db.heldCarts.bulkAdd(heldCarts);
      if (settings.length > 0) await db.settings.bulkAdd(settings);
      if (employees.length > 0) await db.employees.bulkAdd(employees);
      if (cashFlows.length > 0) await db.cashFlows.bulkAdd(cashFlows);
      if (suppliers.length > 0) await db.suppliers.bulkAdd(suppliers);
      if (serviceOrders.length > 0) await db.serviceOrders.bulkAdd(serviceOrders);
      if (serviceItems.length > 0) await db.serviceItems.bulkAdd(serviceItems);
    });

    return {
      success: true,
      message: 'Database berhasil dipulihkan secara penuh!',
      itemCounts: {
        products: products.length,
        categories: categories.length,
        transactions: transactions.length,
        employees: employees.length,
        suppliers: suppliers.length,
        serviceOrders: serviceOrders.length,
      },
    };
  } catch (err: any) {
    console.error('Gagal memulihkan database:', err);
    return {
      success: false,
      message: `Gagal memulihkan file database: ${err?.message || 'Format tidak dikenali'}`,
    };
  }
}

/**
 * Reset / Bersihkan seluruh database secara permanen (Factory Reset).
 */
export async function resetDatabase(reason?: string): Promise<void> {
  // Jika ada alasan penghapusan, catat di log/file sebelum menghapus
  if (reason) {
    console.log(`[Uninstall/Reset Request] Alasan: ${reason}`);
  }

  await Promise.all([
    db.products.clear(),
    db.categories.clear(),
    db.units.clear(),
    db.stockMovements.clear(),
    db.transactions.clear(),
    db.shifts.clear(),
    db.heldCarts.clear(),
    db.settings.clear(),
    db.employees.clear(),
    db.cashFlows.clear(),
  ]);
  localStorage.removeItem('sparkpos_current_user');
}
