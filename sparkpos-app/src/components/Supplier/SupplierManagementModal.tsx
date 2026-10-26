import React, { useState, useEffect } from 'react';
import {
  X,
  Truck,
  Plus,
  Trash2,
  Edit2,
  Phone,
  MapPin,
  FileText,
  CheckCircle2,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { Supplier } from '../../types/pos';
import {
  getSuppliers,
  addSupplier,
  updateSupplier,
  deleteSupplier,
} from '../../services/storage';
import { useDialog } from '../../hooks/useDialog';

interface SupplierManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSupplierSelected?: (supplier: Supplier) => void;
}

export const SupplierManagementModal: React.FC<SupplierManagementModalProps> = ({
  isOpen,
  onClose,
  onSupplierSelected,
}) => {
  const dialogRef = useDialog<HTMLDivElement>(true, onClose);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await getSuppliers();
      setSuppliers(data);
    } catch (err) {
      console.error('Gagal mengambil data supplier:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setName('');
    setPhone('');
    setAddress('');
    setNotes('');
    setEditingId(null);
    setErrorMessage(null);
  };

  const handleEdit = (sup: Supplier) => {
    if (!sup.id) return;
    setEditingId(sup.id);
    setName(sup.name);
    setPhone(sup.phone || '');
    setAddress(sup.address || '');
    setNotes(sup.notes || '');
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!name.trim()) {
      setErrorMessage('Nama supplier wajib diisi!');
      return;
    }

    try {
      if (editingId) {
        await updateSupplier(editingId, {
          name: name.trim(),
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        setSuccessMessage(`Supplier "${name}" berhasil diperbarui!`);
      } else {
        await addSupplier({
          name: name.trim(),
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
          createdAt: new Date().toISOString(),
        });
        setSuccessMessage(`Supplier baru "${name}" berhasil ditambahkan!`);
      }

      resetForm();
      await loadData();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal menyimpan supplier.');
    }
  };

  const handleDelete = async (sup: Supplier) => {
    if (!sup.id) return;
    if (confirm(`Yakin ingin menghapus supplier "${sup.name}"?`)) {
      await deleteSupplier(sup.id);
      await loadData();
    }
  };

  if (!isOpen) return null;

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Kelola Data Pemasok (Supplier)</h3>
              <p className="text-xs text-slate-400">
                Pencatatan distributor & supplier barang (Hardisk, RAM, Laptop, Sparepart)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Notifications */}
        {(errorMessage || successMessage) && (
          <div className="px-6 pt-4 pb-0 shrink-0">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 text-xs">
          {/* Form Side (5 cols) */}
          <div className="md:col-span-5 bg-slate-950/60 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  <span>{editingId ? 'Edit Data Supplier' : 'Tambah Supplier Baru'}</span>
                </span>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-[11px] text-slate-400 hover:text-white"
                  >
                    Batal
                  </button>
                )}
              </div>

              <div>
                <label className="text-slate-400 block mb-1">
                  Nama Supplier / Distributor <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PT Hardisk Jaya / Mangga Dua"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">No. Telepon / Sales WA</label>
                <input
                  type="text"
                  placeholder="e.g. 0812-9988-7766"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Alamat Kantor / Toko</label>
                <input
                  type="text"
                  placeholder="e.g. Harco Mangga Dua Lt. 2 Blok B"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Catatan / Kontak PIC</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Sales: Mas Deni, Minimal order 5 pcs"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{editingId ? 'Simpan Perubahan' : 'Tambah Supplier'}</span>
              </button>
            </form>
          </div>

          {/* List Side (7 cols) */}
          <div className="md:col-span-7 flex flex-col space-y-3">
            <span className="font-bold text-white uppercase tracking-wider text-[11px] px-1">
              Daftar Supplier ({suppliers.length})
            </span>

            <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1">
              {suppliers.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-1">
                  <Truck className="w-8 h-8 opacity-20 mx-auto" />
                  <p>Belum ada data supplier terdaftar.</p>
                </div>
              ) : (
                suppliers.map((sup) => (
                  <div
                    key={sup.id}
                    className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start justify-between gap-3 hover:border-slate-700 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-white text-xs truncate">{sup.name}</h4>
                      {sup.phone && (
                        <p className="text-[11px] text-emerald-400 font-mono flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" />
                          <span>{sup.phone}</span>
                        </p>
                      )}
                      {sup.address && (
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{sup.address}</span>
                        </p>
                      )}
                      {sup.notes && (
                        <p className="text-[10px] text-slate-500 mt-1 italic line-clamp-1">
                          {sup.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {onSupplierSelected && (
                        <button
                          type="button"
                          onClick={() => {
                            onSupplierSelected(sup);
                            onClose();
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition"
                        >
                          Pilih
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleEdit(sup)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                        title="Edit Supplier"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(sup)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                        title="Hapus Supplier"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
