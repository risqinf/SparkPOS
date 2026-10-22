import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Users,
  Shield,
  Clock,
  KeyRound,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Edit2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { Employee } from '../../types/pos';
import { db } from '../../services/storage';

interface CashierManagementModalProps {
  currentUser: Employee;
  isOpen: boolean;
  onClose: () => void;
}

export const CashierManagementModal: React.FC<CashierManagementModalProps> = ({
  currentUser,
  isOpen,
  onClose,
}) => {
  const [cashiers, setCashiers] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [shiftSchedule, setShiftSchedule] = useState('Shift Pagi (08:00 - 16:00)');
  const [editingId, setEditingId] = useState<number | null>(null);

  const loadCashiers = async () => {
    setIsLoading(true);
    try {
      const all = await db.employees.toArray();
      // Show all employees, owner at top then cashiers
      setCashiers(all);
    } catch (err) {
      console.error('Gagal mengambil daftar kasir:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCashiers();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setFullName('');
    setUsername('');
    setPin('');
    setShiftSchedule('Shift Pagi (08:00 - 16:00)');
    setEditingId(null);
    setErrorMessage(null);
  };

  const handleEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setFullName(emp.fullName);
    setUsername(emp.username);
    setPin(emp.pin);
    setShiftSchedule(emp.shiftSchedule || 'Shift Pagi (08:00 - 16:00)');
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!fullName.trim()) {
      setErrorMessage('Nama kasir wajib diisi!');
      return;
    }
    if (!username.trim()) {
      setErrorMessage('Username kasir wajib diisi!');
      return;
    }
    if (!pin.trim() || pin.length < 4) {
      setErrorMessage('PIN kasir minimal 4 digit angka!');
      return;
    }

    try {
      const existing = await db.employees.where('username').equalsIgnoreCase(username.trim()).first();
      if (existing && (!editingId || existing.id !== editingId)) {
        setErrorMessage(`Username "${username}" sudah digunakan oleh staf lain.`);
        return;
      }

      const now = new Date().toISOString();

      if (editingId) {
        // Update existing
        await db.employees.update(editingId, {
          fullName: fullName.trim(),
          username: username.trim().toLowerCase(),
          pin: pin.trim(),
          shiftSchedule: shiftSchedule.trim(),
        });
        setSuccessMessage(`Data staf "${fullName}" berhasil diperbarui!`);
      } else {
        // Create new cashier
        await db.employees.add({
          fullName: fullName.trim(),
          username: username.trim().toLowerCase(),
          pin: pin.trim(),
          role: 'cashier',
          shiftSchedule: shiftSchedule.trim(),
          isActive: true,
          createdAt: now,
        } as any);
        setSuccessMessage(`Kasir baru "${fullName}" berhasil ditambahkan!`);
      }

      resetForm();
      await loadCashiers();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal menyimpan data kasir.');
    }
  };

  const handleToggleActive = async (emp: Employee) => {
    if (emp.role === 'admin' && emp.id === currentUser.id) {
      alert('Anda tidak dapat menonaktifkan akun Owner Anda sendiri!');
      return;
    }

    const nextState = emp.isActive === false ? true : false;
    await db.employees.update(emp.id, { isActive: nextState });
    await loadCashiers();
  };

  const handleDelete = async (emp: Employee) => {
    if (emp.role === 'admin') {
      alert('Akun Owner utama tidak dapat dihapus!');
      return;
    }

    if (confirm(`Yakin ingin menghapus kasir "${emp.fullName}" (@${emp.username})?`)) {
      await db.employees.delete(emp.id);
      setSuccessMessage(`Kasir "${emp.fullName}" berhasil dihapus.`);
      if (editingId === emp.id) resetForm();
      await loadCashiers();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800/80 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Panel Kelola Kasir & Staf</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Khusus Owner
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Tambah kasir baru, atur jadwal shift kerja, dan kelola PIN akses kasir
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Form Side (5 cols) */}
          <div className="md:col-span-5 bg-slate-950/60 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                  <span>{editingId ? 'Edit Data Kasir' : 'Tambah Kasir Baru'}</span>
                </span>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-[11px] text-slate-400 hover:text-white"
                  >
                    Batal Edit
                  </button>
                )}
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{successMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Nama Lengkap Kasir <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kasir 1 (Rian) atau Siti"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Username Login <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: kasir1 atau siti"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  PIN Akses POS (4 - 6 Angka) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  maxLength={6}
                  required
                  placeholder="Contoh: 1234"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono font-bold tracking-widest focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  PIN dipakai kasir saat login numpad di layar utama kasir.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Jadwal Shift Kerja
                </label>
                <select
                  value={shiftSchedule}
                  onChange={(e) => setShiftSchedule(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Shift Pagi (08:00 - 16:00)">Shift Pagi (08:00 - 16:00)</option>
                  <option value="Shift Siang (12:00 - 20:00)">Shift Siang (12:00 - 20:00)</option>
                  <option value="Shift Malam (16:00 - 24:00)">Shift Malam (16:00 - 24:00)</option>
                  <option value="Full Day (08:00 - 21:00)">Full Day (08:00 - 21:00)</option>
                  <option value="Fleksibel / Sesuai Kesepakatan">Fleksibel / Sesuai Kesepakatan</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition mt-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>{editingId ? 'Simpan Perubahan Kasir' : 'Daftarkan Kasir Baru'}</span>
              </button>
            </form>
          </div>

          {/* List Side (7 cols) */}
          <div className="md:col-span-7 flex flex-col space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                Daftar Staf & Kasir Terdaftar ({cashiers.length})
              </span>
              <span>Klik kasir untuk edit / ubah PIN</span>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-[460px] pr-1">
              {cashiers.map((emp) => {
                const isOwner = emp.role === 'admin';
                const isActive = emp.isActive !== false;

                return (
                  <div
                    key={emp.id}
                    className={`p-4 rounded-2xl border transition flex items-center justify-between gap-3 ${
                      isOwner
                        ? 'bg-slate-850/80 border-emerald-500/30'
                        : isActive
                        ? 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        : 'bg-slate-950 border-slate-850 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                          isOwner
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {isOwner ? <Shield className="w-5 h-5" /> : emp.fullName.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-white truncate">{emp.fullName}</span>
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              isOwner
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-blue-500/20 text-blue-300'
                            }`}
                          >
                            {isOwner ? 'Owner / Admin' : 'Kasir'}
                          </span>
                          {!isActive && (
                            <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300">
                              Non-Aktif
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                          <span className="font-mono">User: @{emp.username}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-slate-400">
                            <Clock className="w-3 h-3 text-emerald-400" />
                            <span>{emp.shiftSchedule || 'Shift Fleksibel'}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEdit(emp)}
                        title="Edit Data / PIN"
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {!isOwner && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(emp)}
                            title={isActive ? 'Nonaktifkan Kasir' : 'Aktifkan Kembali'}
                            className={`p-2 rounded-lg transition ${
                              isActive
                                ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-500'
                            }`}
                          >
                            {isActive ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(emp)}
                            title="Hapus Kasir"
                            className="p-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>
            Kasir yang terdaftar dapat langsung login di layar awal kasir menggunakan PIN masing-masing.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition"
          >
            Tutup Panel
          </button>
        </div>
      </div>
    </div>
  );
};
