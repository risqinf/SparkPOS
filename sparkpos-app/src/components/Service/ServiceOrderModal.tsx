import React, { useState, useEffect } from 'react';
import {
  X,
  Wrench,
  User,
  Phone,
  Laptop,
  FileText,
  Clock,
  Plus,
  Trash2,
  DollarSign,
  Printer,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Package,
} from 'lucide-react';
import {
  ServiceOrder,
  ServiceItem,
  ServiceStatus,
  Employee,
  Product,
} from '../../types/pos';
import { db, addServiceOrder, updateServiceOrder, generateServiceTicketNumber } from '../../services/storage';
import { formatRupiah } from '../../services/cartCalculator';

interface ServiceOrderModalProps {
  orderToEdit?: ServiceOrder | null;
  currentUser?: Employee | null;
  onClose: () => void;
  onSaved: (order: ServiceOrder, printReceipt?: boolean) => void;
}

export const ServiceOrderModal: React.FC<ServiceOrderModalProps> = ({
  orderToEdit,
  currentUser,
  onClose,
  onSaved,
}) => {
  const isEditing = !!orderToEdit?.id;

  // Form Fields
  const [ticketNumber, setTicketNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deviceType, setDeviceType] = useState('');
  const [deviceSerial, setDeviceSerial] = useState('');
  const [complaint, setComplaint] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [status, setStatus] = useState<ServiceStatus>('DITERIMA');
  const [assignedTechId, setAssignedTechId] = useState<number | undefined>(undefined);
  const [assignedTechName, setAssignedTechName] = useState('');
  const [estimatedDate, setEstimatedDate] = useState('');
  const [notes, setNotes] = useState('');

  // Service Items (Spareparts & Jasa)
  const [items, setItems] = useState<ServiceItem[]>([]);

  // Item Form Helper State
  const [newItemType, setNewItemType] = useState<'PART' | 'SERVICE'>('SERVICE');
  const [newItemName, setNewItemName] = useState('');
  const [newItemCost, setNewItemCost] = useState('0');
  const [newItemPrice, setNewItemPrice] = useState('50000');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemSupplier, setNewItemSupplier] = useState('');

  // Financial & Payment State
  const [discountAmount, setDiscountAmount] = useState('0');
  const [isPaid, setIsPaid] = useState(false);
  const [paidAmount, setPaidAmount] = useState('0');

  // Supporting master data
  const [technicians, setTechnicians] = useState<Employee[]>([]);
  const [stockProducts, setStockProducts] = useState<Product[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize
  useEffect(() => {
    // Load technicians and stock products
    const loadMasterData = async () => {
      const emps = await db.employees.toArray();
      // Filter technicians & owners
      const techs = emps.filter(
        (e) => e.role === 'teknisi' || e.role === 'owner' || e.role === 'admin' || e.role === 'supervisor'
      );
      setTechnicians(techs);

      const prods = await db.products.toArray();
      setStockProducts(prods.filter((p) => p.isActive !== false));

      if (orderToEdit) {
        setTicketNumber(orderToEdit.ticketNumber);
        setCustomerName(orderToEdit.customerName);
        setCustomerPhone(orderToEdit.customerPhone || '');
        setDeviceType(orderToEdit.deviceType);
        setDeviceSerial(orderToEdit.deviceSerial || '');
        setComplaint(orderToEdit.complaint);
        setDiagnosis(orderToEdit.diagnosis || '');
        setStatus(orderToEdit.status);
        setAssignedTechId(orderToEdit.assignedTechId);
        setAssignedTechName(orderToEdit.assignedTechName || '');
        setEstimatedDate(orderToEdit.estimatedDate || '');
        setNotes(orderToEdit.notes || '');
        setItems(orderToEdit.items || []);
        setDiscountAmount(orderToEdit.discountAmount.toString());
        setIsPaid(orderToEdit.isPaid);
        setPaidAmount(orderToEdit.paidAmount.toString());
      } else {
        const nextTicket = await generateServiceTicketNumber();
        setTicketNumber(nextTicket);
        if (currentUser?.role === 'teknisi' || currentUser?.role === 'owner') {
          setAssignedTechId(currentUser.id);
          setAssignedTechName(currentUser.fullName);
        }
      }
    };

    loadMasterData();
  }, [orderToEdit, currentUser]);

  // Recalculate totals
  const totalPartsCost = items
    .filter((i) => i.type === 'PART')
    .reduce((sum, i) => sum + i.costPrice * i.quantity, 0);

  const totalServiceFee = items
    .filter((i) => i.type === 'SERVICE')
    .reduce((sum, i) => sum + i.sellPrice * i.quantity, 0);

  const partsSellTotal = items
    .filter((i) => i.type === 'PART')
    .reduce((sum, i) => sum + i.sellPrice * i.quantity, 0);

  const discountNum = parseFloat(discountAmount) || 0;
  const grandTotal = Math.max(0, partsSellTotal + totalServiceFee - discountNum);

  // Add Item to list
  const handleAddItem = () => {
    if (!newItemName.trim()) {
      alert('Nama komponen atau jasa harus diisi!');
      return;
    }

    const price = parseFloat(newItemPrice) || 0;
    const cost = parseFloat(newItemCost) || 0;
    const qty = parseInt(newItemQty, 10) || 1;

    const newItem: ServiceItem = {
      id: Date.now().toString(),
      type: newItemType,
      name: newItemName.trim(),
      costPrice: cost,
      sellPrice: price,
      quantity: qty,
      subtotal: price * qty,
      supplierName: newItemSupplier.trim() || undefined,
    };

    setItems((prev) => [...prev, newItem]);
    setNewItemName('');
    setNewItemCost('0');
    setNewItemPrice('50000');
    setNewItemQty('1');
    setNewItemSupplier('');
  };

  // Quick select item from stock
  const handleSelectFromStock = (prodIdStr: string) => {
    const pId = parseInt(prodIdStr, 10);
    const prod = stockProducts.find((p) => p.id === pId);
    if (!prod) return;

    setNewItemType('PART');
    setNewItemName(prod.name);
    setNewItemCost(prod.buyPrice.toString());
    setNewItemPrice(prod.sellPrice.toString());
    setNewItemSupplier(prod.supplierName || '');
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleSave = async (printReceipt = false) => {
    setErrorMessage(null);
    if (!customerName.trim()) {
      setErrorMessage('Nama pelanggan wajib diisi!');
      return;
    }
    if (!deviceType.trim()) {
      setErrorMessage('Tipe perangkat (laptop/PC) wajib diisi!');
      return;
    }
    if (!complaint.trim()) {
      setErrorMessage('Keluhan kerusakan pelanggan wajib diisi!');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const finalPaid = isPaid ? grandTotal : parseFloat(paidAmount) || 0;

      const orderPayload: Omit<ServiceOrder, 'id'> = {
        ticketNumber,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        deviceType: deviceType.trim(),
        deviceSerial: deviceSerial.trim() || undefined,
        complaint: complaint.trim(),
        diagnosis: diagnosis.trim() || undefined,
        status,
        assignedTechId,
        assignedTechName: assignedTechName.trim() || undefined,
        items,
        totalPartsCost,
        totalServiceFee,
        discountAmount: discountNum,
        grandTotal,
        paidAmount: finalPaid,
        isPaid: isPaid || finalPaid >= grandTotal,
        estimatedDate: estimatedDate || undefined,
        receivedAt: orderToEdit?.receivedAt || now,
        startedAt: status === 'DIKERJAKAN' && !orderToEdit?.startedAt ? now : orderToEdit?.startedAt,
        completedAt:
          (status === 'SELESAI' || status === 'DIAMBIL') && !orderToEdit?.completedAt
            ? now
            : orderToEdit?.completedAt,
        pickedUpAt: status === 'DIAMBIL' && !orderToEdit?.pickedUpAt ? now : orderToEdit?.pickedUpAt,
        notes: notes.trim() || undefined,
        createdAt: orderToEdit?.createdAt || now,
        updatedAt: now,
      };

      let finalOrder: ServiceOrder;

      if (isEditing && orderToEdit?.id) {
        await updateServiceOrder(orderToEdit.id, orderPayload);
        finalOrder = { id: orderToEdit.id, ...orderPayload };
      } else {
        const id = await addServiceOrder(orderPayload);
        finalOrder = { id, ...orderPayload };
      }

      onSaved(finalOrder, printReceipt);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal menyimpan tiket servis.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-hidden">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {isEditing ? `Update Tiket Servis (${ticketNumber})` : 'Penerimaan Servis Baru'}
                </h3>
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700">
                  {status}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pencatatan perbaikan komputer/laptop, sparepart, jasa, dan status pengerjaan
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Body (Scrollable Split Form) */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          {/* Section 1: Data Pelanggan & Perangkat */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Box 1: Identitas Pelanggan */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 pb-1.5 border-b border-slate-800">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <span>1. Identitas Pelanggan</span>
              </h4>

              <div className="space-y-2.5">
                <div>
                  <label className="text-slate-400 block mb-1">
                    Nama Pelanggan <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Pak Herman / Siti"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">No. WhatsApp / HP</label>
                  <input
                    type="text"
                    placeholder="Contoh: 081234567890"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Box 2: Perangkat & Status Servis */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 pb-1.5 border-b border-slate-800">
                <Laptop className="w-3.5 h-3.5 text-amber-400" />
                <span>2. Perangkat & Status Pengerjaan</span>
              </h4>

              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-400 block mb-1">
                      Tipe Perangkat <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ThinkPad X201"
                      value={deviceType}
                      onChange={(e) => setDeviceType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">No. Seri / SN</label>
                    <input
                      type="text"
                      placeholder="e.g. SN-892301"
                      value={deviceSerial}
                      onChange={(e) => setDeviceSerial(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-400 block mb-1">Status Servis:</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as ServiceStatus)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-bold focus:outline-none focus:border-amber-500"
                    >
                      <option value="DITERIMA">📥 DITERIMA</option>
                      <option value="DIKERJAKAN">⚙️ DIKERJAKAN</option>
                      <option value="SELESAI">✅ SELESAI</option>
                      <option value="DIAMBIL">🤝 DIAMBIL</option>
                      <option value="DIBATALKAN">❌ DIBATALKAN</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Teknisi Penanggung Jawab:</label>
                    <select
                      value={assignedTechId || ''}
                      onChange={(e) => {
                        const id = e.target.value ? parseInt(e.target.value, 10) : undefined;
                        setAssignedTechId(id);
                        const tech = technicians.find((t) => t.id === id);
                        setAssignedTechName(tech ? tech.fullName : '');
                      }}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Pilih Teknisi...</option>
                      {technicians.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.fullName} ({t.role.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Keluhan & Diagnosa Kerusakan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-400 block mb-1 font-semibold">
                Keluhan Pelanggan <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={2}
                required
                placeholder="Contoh: Laptop mati total, lampu indikator charger berkedip..."
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1 font-semibold">
                Diagnosa & Catatan Teknisi
              </label>
              <textarea
                rows={2}
                placeholder="Contoh: Jalur VCore short 19V, perlu ganti mosfet & repasta thermal..."
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          </div>

          {/* Section 3: Rincian Sparepart & Jasa Servis */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                <span>3. Suku Cadang (Sparepart) & Biaya Jasa</span>
              </h4>
              <span className="text-slate-400 font-mono text-[11px]">
                {items.length} item dimasukkan
              </span>
            </div>

            {/* Input Row Tambah Item */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <div className="md:col-span-2">
                <label className="text-[10px] text-slate-400 block mb-1">Tipe Item:</label>
                <select
                  value={newItemType}
                  onChange={(e) => setNewItemType(e.target.value as 'PART' | 'SERVICE')}
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-semibold text-xs"
                >
                  <option value="SERVICE">🔧 JASA</option>
                  <option value="PART">📦 SPAREPART</option>
                </select>
              </div>

              {newItemType === 'PART' && (
                <div className="md:col-span-3">
                  <label className="text-[10px] text-slate-400 block mb-1">Ambil Dari Stok:</label>
                  <select
                    onChange={(e) => handleSelectFromStock(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                  >
                    <option value="">Pilih Produk...</option>
                    {stockProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Stok: {p.stock})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={newItemType === 'PART' ? 'md:col-span-3' : 'md:col-span-4'}>
                <label className="text-[10px] text-slate-400 block mb-1">Nama Jasa / Sparepart:</label>
                <input
                  type="text"
                  placeholder="e.g. Install OS Windows 11"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-[10px] text-slate-400 block mb-1">Harga Jual (Rp):</label>
                <input
                  type="number"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs"
                />
              </div>

              <div className="md:col-span-1">
                <label className="text-[10px] text-slate-400 block mb-1">Qty:</label>
                <input
                  type="number"
                  min="1"
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs text-center"
                />
              </div>

              <div className="md:col-span-1 flex items-end">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1 transition"
                  title="Tambahkan ke rincian servis"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {/* Items Table List */}
            {items.length === 0 ? (
              <p className="text-center py-4 text-slate-500 text-xs">
                Belum ada rincian jasa atau suku cadang yang dimasukkan. Anda dapat menambahkannya sekarang atau saat pengerjaan.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase">
                      <th className="py-2 px-2.5">Tipe</th>
                      <th className="py-2 px-2.5">Nama Komponen / Jasa</th>
                      <th className="py-2 px-2.5 text-center">Qty</th>
                      <th className="py-2 px-2.5 text-right">Harga Jual</th>
                      <th className="py-2 px-2.5 text-right">Subtotal</th>
                      <th className="py-2 px-2.5 text-center w-10">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-900/60">
                        <td className="py-2 px-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              item.type === 'PART'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-blue-500/20 text-blue-400'
                            }`}
                          >
                            {item.type}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 font-sans text-white font-medium">
                          {item.name}
                          {item.supplierName && (
                            <span className="text-[10px] text-slate-500 block">
                              Pemasok: {item.supplierName}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 text-center text-slate-300">{item.quantity}</td>
                        <td className="py-2 px-2.5 text-right text-slate-300">
                          {formatRupiah(item.sellPrice)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-bold text-emerald-400">
                          {formatRupiah(item.subtotal)}
                        </td>
                        <td className="py-2 px-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 4: Ringkasan Biaya, Diskon & Status Pembayaran */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <span className="font-bold text-white block text-xs uppercase tracking-wider">
                Pembayaran Pelanggan
              </span>

              <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPaid}
                  onChange={(e) => {
                    setIsPaid(e.target.checked);
                    if (e.target.checked) setPaidAmount(grandTotal.toString());
                  }}
                  className="rounded text-emerald-500 focus:ring-0"
                />
                <span className="font-bold text-emerald-400">
                  Tagihan Servis Sudah Lunas Dibayar
                </span>
              </label>

              {!isPaid && (
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Uang Muka / DP yang Diterima (Rp):
                  </label>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Total Modal Sparepart (HPP):</span>
                <span className="font-mono text-slate-300">{formatRupiah(totalPartsCost)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Biaya Jasa Kerja:</span>
                <span className="font-mono text-blue-400">{formatRupiah(totalServiceFee)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Potongan / Diskon:</span>
                <input
                  type="number"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  className="w-24 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-right font-mono text-amber-400"
                />
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline font-bold">
                <span className="text-white text-sm">Total Tagihan:</span>
                <span className="text-emerald-400 font-mono text-xl font-extrabold">
                  {formatRupiah(grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition disabled:opacity-50"
          >
            Batal
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSave(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold transition"
              title="Simpan data dan langsung cetak nota tanda terima servis"
            >
              <Printer className="w-4 h-4 text-indigo-400" />
              <span>Simpan & Cetak Nota</span>
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSave(false)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-md shadow-emerald-950/50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Tiket Servis'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
