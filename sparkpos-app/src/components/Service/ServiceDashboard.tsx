import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Printer,
  Edit,
  Trash2,
  ExternalLink,
  Laptop,
  User,
  Phone,
  DollarSign,
  TrendingUp,
  Cpu,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { ServiceOrder, ServiceStatus, Employee, StoreProfile } from '../../types/pos';
import { getServiceOrders, deleteServiceOrder, updateServiceOrder } from '../../services/storage';
import { formatRupiah } from '../../services/cartCalculator';
import { ServiceOrderModal } from './ServiceOrderModal';
import { ServiceReceiptModal } from './ServiceReceiptModal';
import { exportServicesToExcel } from '../../services/excelExport';

interface ServiceDashboardProps {
  currentUser?: Employee | null;
  storeProfile: StoreProfile;
  onRequestAdminAccess?: () => void;
}

export const ServiceDashboard: React.FC<ServiceDashboardProps> = ({
  currentUser,
  storeProfile,
  onRequestAdminAccess,
}) => {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedOrderToEdit, setSelectedOrderToEdit] = useState<ServiceOrder | null>(null);
  const [orderToPrint, setOrderToPrint] = useState<ServiceOrder | null>(null);
  const [noteModalOrder, setNoteModalOrder] = useState<ServiceOrder | null>(null);
  const [quickNoteText, setQuickNoteText] = useState('');

  const isOwner = currentUser?.role === 'owner' || currentUser?.role === 'admin';
  const isTeknisi = currentUser?.role === 'teknisi' || currentUser?.role === 'supervisor';

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const data = await getServiceOrders();
      setOrders(data);
    } catch (err) {
      console.error('Gagal mengambil data servis:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // Filtered Orders
  const filteredOrders = orders.filter((o) => {
    const matchesStatus = selectedStatus === 'ALL' || o.status === selectedStatus;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      query === '' ||
      o.ticketNumber.toLowerCase().includes(query) ||
      o.customerName.toLowerCase().includes(query) ||
      o.deviceType.toLowerCase().includes(query) ||
      (o.customerPhone && o.customerPhone.includes(query)) ||
      (o.deviceSerial && o.deviceSerial.toLowerCase().includes(query));

    return matchesStatus && matchesSearch;
  });

  // Calculate Metrics
  const countDiterima = orders.filter((o) => o.status === 'DITERIMA').length;
  const countDikerjakan = orders.filter((o) => o.status === 'DIKERJAKAN').length;
  const countSelesai = orders.filter((o) => o.status === 'SELESAI').length;
  const countDiambil = orders.filter((o) => o.status === 'DIAMBIL').length;

  const totalRevenue = orders
    .filter((o) => o.isPaid || o.status === 'DIAMBIL')
    .reduce((sum, o) => sum + (o.paidAmount || o.grandTotal), 0);

  const totalSparepartsHPP = orders
    .filter((o) => o.isPaid || o.status === 'DIAMBIL')
    .reduce((sum, o) => sum + (o.totalPartsCost || 0), 0);

  const netServiceProfit = totalRevenue - totalSparepartsHPP;

  const handleDelete = async (order: ServiceOrder) => {
    if (!isOwner) {
      alert('Hanya Owner yang dapat menghapus riwayat order servis.');
      return;
    }
    if (confirm(`Hapus tiket servis ${order.ticketNumber} milik ${order.customerName}?`)) {
      if (order.id) {
        await deleteServiceOrder(order.id);
        await loadOrders();
      }
    }
  };

  const handleQuickStart = async (order: ServiceOrder) => {
    if (!order.id) return;
    const techName = order.assignedTechName || currentUser?.fullName || 'Teknisi';
    const techId = order.assignedTechId || currentUser?.id;
    await updateServiceOrder(order.id, {
      status: 'DIKERJAKAN',
      assignedTechName: techName,
      assignedTechId: techId,
      startedAt: new Date().toISOString(),
    });
    await loadOrders();
  };

  const handleQuickFinish = async (order: ServiceOrder) => {
    if (!order.id) return;
    const now = new Date().toISOString();
    await updateServiceOrder(order.id, {
      status: 'SELESAI',
      completedAt: now,
    });
    await loadOrders();
  };

  const handleQuickPickup = async (order: ServiceOrder) => {
    if (!order.id) return;
    const now = new Date().toISOString();
    await updateServiceOrder(order.id, {
      status: 'DIAMBIL',
      pickedUpAt: now,
      isPaid: true,
      paidAmount: order.paidAmount || order.grandTotal,
      paymentMethod: order.paymentMethod || 'CASH',
    });
    await loadOrders();
  };

  const handleOpenNoteModal = (order: ServiceOrder) => {
    setNoteModalOrder(order);
    setQuickNoteText(order.notes || '');
  };

  const handleSaveQuickNote = async () => {
    if (!noteModalOrder?.id) return;
    await updateServiceOrder(noteModalOrder.id, {
      notes: quickNoteText.trim() || undefined,
    });
    setNoteModalOrder(null);
    await loadOrders();
  };

  const getWhatsAppLink = (order: ServiceOrder) => {
    if (!order.customerPhone) return '#';
    const cleanPhone = order.customerPhone.replace(/\D/g, '').replace(/^0/, '62');
    const message = `Halo Kak ${order.customerName}, perbaikan ${order.deviceType} (No. Tiket: ${order.ticketNumber}) di ${storeProfile.storeName} saat ini sudah SELESAI dikerjakan oleh teknisi kami dan siap diambil di toko. Total biaya: ${formatRupiah(order.grandTotal)}. Terima kasih!`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const getStatusBadge = (status: ServiceStatus) => {
    switch (status) {
      case 'DITERIMA':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
            📥 Diterima
          </span>
        );
      case 'DIKERJAKAN':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            ⚙️ Dikerjakan
          </span>
        );
      case 'SELESAI':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            ✅ Selesai (Siap Diambil)
          </span>
        );
      case 'DIAMBIL':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
            Diambil & Selesai
          </span>
        );
      case 'DIBATALKAN':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
            ❌ Dibatalkan
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950 p-4 lg:p-6 space-y-5">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Manajemen Servis Komputer & Laptop
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Tracking antrean perbaikan unit masuk, estimasi biaya sparepart, diagnosa, hingga penyerahan ke pelanggan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadOrders}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-white transition"
            title="Refresh antrean servis"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => exportServicesToExcel(filteredOrders, storeProfile.storeName)}
            disabled={filteredOrders.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 disabled:opacity-50 text-slate-300 hover:text-white text-xs font-semibold transition"
            title="Export data antrean service ke format Excel (.csv)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedOrderToEdit(null);
              setIsFormModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-md shadow-amber-950/40"
          >
            <Plus className="w-4 h-4" />
            <span>Terima Servis Baru</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 shrink-0">
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
            📥
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
              Unit Masuk
            </span>
            <span className="text-lg font-black text-white">{countDiterima} unit</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            ⚙️
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
              Dikerjakan
            </span>
            <span className="text-lg font-black text-amber-400">{countDikerjakan} unit</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            ✅
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
              Selesai Siap Ambil
            </span>
            <span className="text-lg font-black text-emerald-400">{countSelesai} unit</span>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-750 text-zinc-300 flex items-center justify-center font-bold text-xs">
            ✓
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">
              Sudah Diambil
            </span>
            <span className="text-base font-bold text-zinc-200">{countDiambil} unit</span>
          </div>
        </div>

        {/* Keuangan Servis (Owner only display) */}
        {isOwner && (
          <div className="p-2.5 rounded-xl bg-zinc-900 border border-emerald-500/30 flex items-center gap-2.5 col-span-2 md:col-span-4 lg:col-span-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
              Rp
            </div>
            <div>
              <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block">
                Laba Jasa Bersih
              </span>
              <span className="text-sm font-black text-emerald-400 font-mono">
                {formatRupiah(netServiceProfit)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Cari no tiket, pelanggan, tipe laptop (ThinkPad)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-medium"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto scrollbar-none text-xs">
          {[
            { id: 'ALL', label: `Semua (${orders.length})` },
            { id: 'DITERIMA', label: `Diterima (${countDiterima})` },
            { id: 'DIKERJAKAN', label: `Dikerjakan (${countDikerjakan})` },
            { id: 'SELESAI', label: `Selesai (${countSelesai})` },
            { id: 'DIAMBIL', label: `Diambil (${countDiambil})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
                selectedStatus === tab.id
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white bg-slate-950/60 border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Service Orders Table List */}
      <div className="flex-1 overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl">
        {filteredOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 py-16 space-y-3">
            <Wrench className="w-12 h-12 opacity-20 text-amber-400" />
            <p className="text-sm font-bold text-slate-300">
              {orders.length === 0 ? 'Belum Ada Data Servis' : 'Tidak Ada Tiket Servis yang Cocok'}
            </p>
            <p className="text-xs text-slate-500 max-w-sm text-center">
              Klik tombol <strong>"+ Terima Servis Baru"</strong> untuk mencatat komputer/laptop pelanggan yang masuk untuk diservis.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase bg-slate-950/60 sticky top-0 z-10">
                  <th className="py-3 px-4">No. Tiket & Masuk</th>
                  <th className="py-3 px-4">Pelanggan & Kontak</th>
                  <th className="py-3 px-4">Perangkat & Keluhan</th>
                  <th className="py-3 px-4">Teknisi</th>
                  <th className="py-3 px-4 text-right">Tagihan Servis</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredOrders.map((order) => {
                  const dateStr = new Date(order.receivedAt || order.createdAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });

                  return (
                    <tr key={order.id} className="hover:bg-slate-850/60 transition group">
                      {/* Ticket No & Date */}
                      <td className="py-3 px-4 font-mono">
                        <span className="font-bold text-amber-400 block">{order.ticketNumber}</span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{dateStr}</span>
                        </span>
                      </td>

                      {/* Customer Info */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-white block">{order.customerName}</span>
                        {order.customerPhone ? (
                          <a
                            href={`https://wa.me/${order.customerPhone.replace(/\D/g, '').replace(/^0/, '62')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 mt-0.5 font-mono"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{order.customerPhone}</span>
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-500">Tanpa no HP</span>
                        )}
                      </td>

                      {/* Device & Complaint */}
                      <td className="py-3 px-4 max-w-xs">
                        <span className="font-semibold text-slate-200 block truncate flex items-center gap-1.5">
                          <Laptop className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{order.deviceType}</span>
                          {order.deviceSerial && (
                            <span className="text-[10px] text-slate-500 font-mono">({order.deviceSerial})</span>
                          )}
                        </span>
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                          {order.complaint}
                        </p>
                        {order.diagnosis && (
                          <div className="text-[10px] text-cyan-300 mt-1 bg-cyan-950/50 border border-cyan-800/40 rounded px-1.5 py-0.5 line-clamp-1">
                            🔍 <strong>Diagnosa:</strong> {order.diagnosis}
                          </div>
                        )}
                        {order.notes && (
                          <div className="text-[10px] text-amber-300 mt-1 bg-amber-950/50 border border-amber-800/40 rounded px-1.5 py-0.5 line-clamp-2">
                            💬 <strong>Info Teknisi:</strong> {order.notes}
                          </div>
                        )}
                      </td>

                      {/* Technician */}
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-300 block">
                          {order.assignedTechName || 'Belum Ditentukan'}
                        </span>
                      </td>

                      {/* Financial Total */}
                      <td className="py-3 px-4 text-right font-mono">
                        <span className="font-bold text-emerald-400 text-sm block">
                          {formatRupiah(order.grandTotal)}
                        </span>
                        <span
                          className={`text-[9px] font-bold uppercase ${
                            order.isPaid ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {order.isPaid ? '✓ Lunas' : 'Belum Lunas'}
                        </span>
                      </td>

                      {/* Status Badge & Quick Status Action */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          {getStatusBadge(order.status)}

                          {/* Quick buttons per workflow status */}
                          {order.status === 'DITERIMA' && (
                            <button
                              type="button"
                              onClick={() => handleQuickStart(order)}
                              className="px-2 py-0.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[10px] font-bold transition flex items-center gap-1 shadow-sm"
                              title="Teknisi klik untuk mulai memproses unit ini"
                            >
                              <span>⚙️ Mulai Proses</span>
                            </button>
                          )}

                          {order.status === 'DIKERJAKAN' && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleQuickFinish(order)}
                                className="px-2 py-0.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold transition flex items-center gap-1 shadow-sm"
                                title="Tandai unit sudah selesai dikerjakan"
                              >
                                <span>✅ Selesai</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenNoteModal(order)}
                                className="px-1.5 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-cyan-400 text-[10px] font-bold border border-slate-700 transition"
                                title="Kirim info / catatan progres ke Admin & Kasir"
                              >
                                💬
                              </button>
                            </div>
                          )}

                          {order.status === 'SELESAI' && (
                            <div className="flex items-center gap-1">
                              {order.customerPhone && (
                                <a
                                  href={getWhatsAppLink(order)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition flex items-center gap-1 shadow-sm"
                                  title="Kabari Pelanggan via WhatsApp"
                                >
                                  <span>📲 Chat WA</span>
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => handleQuickPickup(order)}
                                className="px-2 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-[10px] font-semibold transition flex items-center gap-1 shadow-xs"
                                title="Kasir serahkan unit ke pelanggan"
                              >
                                <span>Serahkan Unit</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Print Receipt */}
                          <button
                            type="button"
                            onClick={() => setOrderToPrint(order)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white transition"
                            title="Cetak Tanda Terima Servis"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Note Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenNoteModal(order)}
                            className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition"
                            title="Beri Catatan Progres Pengerjaan ke Admin"
                          >
                            💬
                          </button>

                          {/* Edit / Full Details */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrderToEdit(order);
                              setIsFormModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition"
                            title="Rincian Lengkap & Sparepart"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete (Owner only) */}
                          {isOwner && (
                            <button
                              type="button"
                              onClick={() => handleDelete(order)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition"
                              title="Hapus Tiket Servis"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODALS */}
      {isFormModalOpen && (
        <ServiceOrderModal
          orderToEdit={selectedOrderToEdit}
          currentUser={currentUser}
          onClose={() => setIsFormModalOpen(false)}
          onSaved={async (savedOrder, printNow) => {
            setIsFormModalOpen(false);
            await loadOrders();
            if (printNow) {
              setOrderToPrint(savedOrder);
            }
          }}
        />
      )}

      {orderToPrint && (
        <ServiceReceiptModal
          order={orderToPrint}
          storeProfile={storeProfile}
          onClose={() => setOrderToPrint(null)}
        />
      )}

      {/* Quick Note Modal: Teknisi Update Info ke Admin & Kasir */}
      {noteModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
              <div className="flex items-center gap-2">
                <span className="text-base">💬</span>
                <div>
                  <h3 className="text-sm font-bold text-white">Update Info Proses ke Admin & Kasir</h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Tiket #{noteModalOrder.ticketNumber} • {noteModalOrder.deviceType}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNoteModalOrder(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Catatan Progres Pengerjaan:
                </label>
                <textarea
                  rows={3}
                  value={quickNoteText}
                  onChange={(e) => setQuickNoteText(e.target.value)}
                  placeholder="Ketik status terkini pengerjaan agar Kasir & Admin di kasir tahu..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Quick Template Buttons */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
                  Pilihan Cepat:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    '⚙️ Sedang proses install OS & driver',
                    '🔍 Sedang cek jalur motherboard & tegangan',
                    '📦 Menunggu konfirmasi penggantian part',
                    '🧪 Sedang running-test stabilitas suhu & performa',
                    '✅ Pengerjaan beres, unit normal & siap diambil',
                  ].map((tpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setQuickNoteText(tpl)}
                      className="text-[10px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white transition text-left"
                    >
                      {tpl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setNoteModalOrder(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveQuickNote}
                className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-sm"
              >
                Simpan & Beritahu Admin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
