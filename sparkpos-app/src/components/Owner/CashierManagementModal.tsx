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
  Plus,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { Employee, WorkShiftTemplate } from '../../types/pos';
import {
  db,
  getWorkShiftTemplates,
  saveWorkShiftTemplates,
  DEFAULT_WORK_SHIFTS,
} from '../../services/storage';

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
  const [activeTab, setActiveTab] = useState<'cashiers' | 'shifts'>('cashiers');

  // Cashiers state
  const [cashiers, setCashiers] = useState<Employee[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<WorkShiftTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Cashier Form state
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  // Shift assignment state for cashier
  const [shiftMode, setShiftMode] = useState<'template' | 'custom' | 'flexible'>('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('shift-pagi');
  const [customStart, setCustomStart] = useState<string>('08:00');
  const [customEnd, setCustomEnd] = useState<string>('16:00');

  // Master Shift Template Form state
  const [newShiftName, setNewShiftName] = useState('');
  const [newShiftIsFlexible, setNewShiftIsFlexible] = useState(false);
  const [newShiftStart, setNewShiftStart] = useState('08:00');
  const [newShiftEnd, setNewShiftEnd] = useState('16:00');
  const [newShiftDesc, setNewShiftDesc] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const allEmps = await db.employees.toArray();
      setCashiers(allEmps);

      const templates = await getWorkShiftTemplates();
      setShiftTemplates(templates);
      if (templates.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(templates[0].id);
      }
    } catch (err) {
      console.error('Gagal mengambil data kasir & shift:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      resetCashierForm();
      resetShiftTemplateForm();
    }
  }, [isOpen]);

  const resetCashierForm = () => {
    setFullName('');
    setUsername('');
    setPin('');
    setShiftMode('template');
    setSelectedTemplateId(shiftTemplates[0]?.id || 'shift-pagi');
    setCustomStart('08:00');
    setCustomEnd('16:00');
    setEditingId(null);
    setErrorMessage(null);
  };

  const resetShiftTemplateForm = () => {
    setNewShiftName('');
    setNewShiftIsFlexible(false);
    setNewShiftStart('08:00');
    setNewShiftEnd('16:00');
    setNewShiftDesc('');
  };

  const handleEditCashier = (emp: Employee) => {
    setEditingId(emp.id);
    setFullName(emp.fullName);
    setUsername(emp.username);
    setPin(emp.pin);

    if (emp.isFlexibleShift) {
      setShiftMode('flexible');
    } else if (emp.shiftStart && emp.shiftEnd) {
      // Check if matches an existing template
      const matched = shiftTemplates.find(
        (t) => !t.isFlexible && t.startTime === emp.shiftStart && t.endTime === emp.shiftEnd
      );
      if (matched) {
        setShiftMode('template');
        setSelectedTemplateId(matched.id);
      } else {
        setShiftMode('custom');
        setCustomStart(emp.shiftStart);
        setCustomEnd(emp.shiftEnd);
      }
    } else {
      setShiftMode('template');
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setActiveTab('cashiers');
  };

  // Submit Add / Edit Cashier
  const handleSubmitCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!fullName.trim()) {
      setErrorMessage('Nama kasir wajib diisi!');
      return;
    }
    if (!username.trim()) {
      setErrorMessage('Username login kasir wajib diisi!');
      return;
    }
    if (!pin.trim() || pin.length < 4) {
      setErrorMessage('PIN kasir minimal 4 digit angka!');
      return;
    }

    // Determine final shift schedule string
    let finalSchedule = '';
    let finalStart = '';
    let finalEnd = '';
    let isFlex = false;

    if (shiftMode === 'flexible') {
      finalSchedule = 'Shift Fleksibel (Tanpa Jam Tetap)';
      isFlex = true;
    } else if (shiftMode === 'custom') {
      finalSchedule = `Kustom (${customStart} - ${customEnd})`;
      finalStart = customStart;
      finalEnd = customEnd;
      isFlex = false;
    } else {
      const template = shiftTemplates.find((t) => t.id === selectedTemplateId) || shiftTemplates[0];
      if (template?.isFlexible) {
        finalSchedule = `${template.name} (Fleksibel)`;
        isFlex = true;
      } else {
        finalSchedule = `${template?.name || 'Shift'} (${template?.startTime || '08:00'} - ${
          template?.endTime || '16:00'
        })`;
        finalStart = template?.startTime || '08:00';
        finalEnd = template?.endTime || '16:00';
        isFlex = false;
      }
    }

    try {
      const existing = await db.employees.where('username').equalsIgnoreCase(username.trim()).first();
      if (existing && (!editingId || existing.id !== editingId)) {
        setErrorMessage(`Username "${username}" sudah digunakan oleh staf lain.`);
        return;
      }

      const now = new Date().toISOString();

      if (editingId) {
        await db.employees.update(editingId, {
          fullName: fullName.trim(),
          username: username.trim().toLowerCase(),
          pin: pin.trim(),
          shiftSchedule: finalSchedule,
          shiftStart: finalStart || undefined,
          shiftEnd: finalEnd || undefined,
          isFlexibleShift: isFlex,
        });
        setSuccessMessage(`Data staf "${fullName}" berhasil diperbarui!`);
      } else {
        await db.employees.add({
          fullName: fullName.trim(),
          username: username.trim().toLowerCase(),
          pin: pin.trim(),
          role: 'cashier',
          shiftSchedule: finalSchedule,
          shiftStart: finalStart || undefined,
          shiftEnd: finalEnd || undefined,
          isFlexibleShift: isFlex,
          isActive: true,
          createdAt: now,
        } as any);
        setSuccessMessage(`Kasir baru "${fullName}" berhasil ditambahkan!`);
      }

      resetCashierForm();
      await loadData();
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
    await loadData();
  };

  const handleDeleteCashier = async (emp: Employee) => {
    if (emp.role === 'admin') {
      alert('Akun Owner utama tidak dapat dihapus!');
      return;
    }

    if (confirm(`Yakin ingin menghapus kasir "${emp.fullName}" (@${emp.username})?`)) {
      await db.employees.delete(emp.id);
      setSuccessMessage(`Kasir "${emp.fullName}" berhasil dihapus.`);
      if (editingId === emp.id) resetCashierForm();
      await loadData();
    }
  };

  // Submit Add Shift Template
  const handleAddShiftTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShiftName.trim()) {
      alert('Nama shift wajib diisi!');
      return;
    }

    const newTemplate: WorkShiftTemplate = {
      id: `shift-custom-${Date.now()}`,
      name: newShiftName.trim(),
      startTime: newShiftIsFlexible ? undefined : newShiftStart,
      endTime: newShiftIsFlexible ? undefined : newShiftEnd,
      isFlexible: newShiftIsFlexible,
      description: newShiftDesc.trim() || undefined,
    };

    const updated = [...shiftTemplates, newTemplate];
    await saveWorkShiftTemplates(updated);
    setShiftTemplates(updated);
    resetShiftTemplateForm();
    setSuccessMessage(`Template shift "${newTemplate.name}" berhasil ditambahkan!`);
  };

  // Delete Shift Template
  const handleDeleteShiftTemplate = async (templateId: string) => {
    if (shiftTemplates.length <= 1) {
      alert('Minimal harus ada satu shift template!');
      return;
    }

    const t = shiftTemplates.find((x) => x.id === templateId);
    if (confirm(`Hapus template shift "${t?.name}"?`)) {
      const updated = shiftTemplates.filter((x) => x.id !== templateId);
      await saveWorkShiftTemplates(updated);
      setShiftTemplates(updated);
      if (selectedTemplateId === templateId) {
        setSelectedTemplateId(updated[0]?.id || '');
      }
      setSuccessMessage(`Template shift telah dihapus.`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl xl:max-w-6xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with Title and Mode Switcher */}
        <div className="p-6 border-b border-slate-800/80 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Panel Staf & Management Shift</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Khusus Owner
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Kelola akun kasir, atur jadwal kerja custom (jam masuk & selesai), atau buat template shift toko
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab Buttons */}
            <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('cashiers');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'cashiers'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>1. Kelola Kasir ({cashiers.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('shifts');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'shifts'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>2. Management Shift ({shiftTemplates.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Alert Messages */}
        {(errorMessage || successMessage) && (
          <div className="px-6 pt-4 pb-0">
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
          </div>
        )}

        {/* TAB 1: KELOLA KASIR */}
        {activeTab === 'cashiers' && (
          <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Form Side (5 cols) */}
            <div className="md:col-span-5 bg-slate-950/60 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
              <form onSubmit={handleSubmitCashier} className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-emerald-400" />
                    <span>{editingId ? 'Edit Data Kasir' : 'Tambah Kasir Baru'}</span>
                  </span>
                  {editingId && (
                    <button
                      type="button"
                      onClick={resetCashierForm}
                      className="text-[11px] text-slate-400 hover:text-white"
                    >
                      Batal Edit
                    </button>
                  )}
                </div>

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
                </div>

                {/* Pengaturan Jam Kerja Shift Kasir */}
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-white flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Jadwal & Jam Kerja Shift</span>
                    </label>
                    <span className="text-[10px] text-slate-500">Pilih skema waktu</span>
                  </div>

                  {/* 3 Selector Mode: Template, Custom Jam, Flexible */}
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800 text-[10px] font-bold text-center">
                    <button
                      type="button"
                      onClick={() => setShiftMode('template')}
                      className={`py-1.5 rounded-lg transition ${
                        shiftMode === 'template'
                          ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Template
                    </button>
                    <button
                      type="button"
                      onClick={() => setShiftMode('custom')}
                      className={`py-1.5 rounded-lg transition ${
                        shiftMode === 'custom'
                          ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Atur Jam
                    </button>
                    <button
                      type="button"
                      onClick={() => setShiftMode('flexible')}
                      className={`py-1.5 rounded-lg transition ${
                        shiftMode === 'flexible'
                          ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Fleksibel
                    </button>
                  </div>

                  {/* Mode 1: Pilih dari Template Shift */}
                  {shiftMode === 'template' && (
                    <div>
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        {shiftTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} {t.isFlexible ? '(Fleksibel)' : `(${t.startTime} - ${t.endTime})`}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setActiveTab('shifts')}
                        className="text-[11px] text-emerald-400 hover:underline mt-1 block"
                      >
                        + Tambah template shift baru di tab Management Shift
                      </button>
                    </div>
                  )}

                  {/* Mode 2: Atur Jam Kerja Sendiri (Jam Masuk + Jam Selesai) */}
                  {shiftMode === 'custom' && (
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2.5">
                      <span className="text-[11px] text-slate-400 block font-medium">
                        Tentukan jam masuk dan jam selesai untuk kasir ini:
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Jam Masuk:</label>
                          <input
                            type="time"
                            required
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Jam Selesai:</label>
                          <input
                            type="time"
                            required
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="text-[10px] text-emerald-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800">
                        <span>Jadwal Aktif:</span>
                        <span>{customStart} s/d {customEnd}</span>
                      </div>
                    </div>
                  )}

                  {/* Mode 3: Shift Fleksibel */}
                  {shiftMode === 'flexible' && (
                    <div className="p-3 bg-slate-900 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 space-y-1">
                      <p className="font-bold flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Shift Fleksibel Tanpa Batasan Jam</span>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Kasir ini dapat membuka kasir shift kapan saja tanpa terikat jam masuk atau jam selesai kerja.
                      </p>
                    </div>
                  )}
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
                  Daftar Kasir & Jadwal Kerja ({cashiers.length})
                </span>
                <span>Klik edit untuk ubah jadwal / PIN</span>
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
                              {isOwner ? 'Owner' : 'Kasir'}
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
                            <span className="flex items-center gap-1 text-emerald-400 font-medium">
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
                          onClick={() => handleEditCashier(emp)}
                          title="Edit Data / Jam Kerja"
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
                              onClick={() => handleDeleteCashier(emp)}
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
        )}

        {/* TAB 2: MANAGEMENT SHIFT (MASTER TEMPLATE JAM KERJA) */}
        {activeTab === 'shifts' && (
          <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Form Buat Template Shift Baru (5 cols) */}
            <div className="md:col-span-5 bg-slate-950/60 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
              <form onSubmit={handleAddShiftTemplate} className="space-y-4">
                <div className="pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span>Tambah Template Shift Toko Baru</span>
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Buat jam kerja standar toko untuk ditetapkan ke kasir
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Nama Template Shift <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Shift Pagi, Shift Weekend, Lembur"
                    value={newShiftName}
                    onChange={(e) => setNewShiftName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>

                {/* Pilihan: Jam Tertentu vs Fleksibel */}
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2.5">
                  <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer font-semibold">
                    <input
                      type="checkbox"
                      checked={newShiftIsFlexible}
                      onChange={(e) => setNewShiftIsFlexible(e.target.checked)}
                      className="rounded text-emerald-500 focus:ring-0 bg-slate-950 border-slate-700"
                    />
                    <span>Ini adalah Shift Fleksibel (Tanpa jam tetap)</span>
                  </label>

                  {!newShiftIsFlexible ? (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Jam Masuk Kerja:</label>
                        <input
                          type="time"
                          required
                          value={newShiftStart}
                          onChange={(e) => setNewShiftStart(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Jam Selesai Kerja:</label>
                        <input
                          type="time"
                          required
                          value={newShiftEnd}
                          onChange={(e) => setNewShiftEnd(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400">
                      Shift fleksibel mengizinkan kasir masuk kapan saja tanpa jadwal tetap.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Keterangan / Catatan Shift
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Khusus hari libur / jam sibuk"
                    value={newShiftDesc}
                    onChange={(e) => setNewShiftDesc(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition mt-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Simpan Template Shift Baru</span>
                </button>
              </form>
            </div>

            {/* List Template Shift (7 cols) */}
            <div className="md:col-span-7 flex flex-col space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                  Master Template Jam Kerja Toko ({shiftTemplates.length})
                </span>
                <span>Template yang aktif dapat dipilih di form kasir</span>
              </div>

              <div className="space-y-2.5 overflow-y-auto max-h-[460px] pr-1">
                {shiftTemplates.map((t) => {
                  const usedCount = cashiers.filter((c) => c.shiftSchedule?.includes(t.name)).length;

                  return (
                    <div
                      key={t.id}
                      className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 text-emerald-400 border border-slate-700 flex items-center justify-center shrink-0">
                          <Clock className="w-5 h-5" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white">{t.name}</span>
                            <span
                              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                                t.isFlexible
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {t.isFlexible ? 'Fleksibel' : `${t.startTime} - ${t.endTime}`}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                            <span>{t.description || (t.isFlexible ? 'Shift bebas' : 'Jam kerja operasional')}</span>
                            <span>•</span>
                            <span className="text-slate-400">Dipakai oleh {usedCount} kasir</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDeleteShiftTemplate(t.id)}
                          title="Hapus Template Shift"
                          className="p-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>
            Jadwal shift memudahkan Owner memonitor kehadiran dan jam operasional kasir.
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
