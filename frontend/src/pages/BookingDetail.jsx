import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, MessageCircle, Truck, RotateCcw, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminLayout from '@/components/layout/AdminLayout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { get, post, upload } from '@/utils/request';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatCurrency, formatDate, BOOKING_STATUS, PAYMENT_METHODS, getErrorMessage } from '@/utils/helpers';
import { generateInvoicePdf, printInvoice } from '@/utils/invoice';

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pickupModal, setPickupModal] = useState(false);
  const [returnModal, setReturnModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [pickupForm, setPickupForm] = useState({ pickup_by: '', pickup_notes: '', file: null });
  const [returnForm, setReturnForm] = useState({ return_date: '', condition: 'Baik', fine: '', notes: '', file: null });
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'CASH', notes: '' });

  const fetchData = () => {
    get(API_ENDPOINTS.BOOKINGS.DETAIL(id))
      .then((res) => res.success && setBooking(res.data))
      .finally(() => setLoading(false));
    get(API_ENDPOINTS.SETTINGS).then((res) => res.success && setSettings(res.data));
  };

  useEffect(() => { fetchData(); }, [id]);

  const handlePickup = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('pickup_by', pickupForm.pickup_by);
      fd.append('pickup_notes', pickupForm.pickup_notes);
      if (pickupForm.file) fd.append('pickup_proof', pickupForm.file);
      await upload(API_ENDPOINTS.BOOKINGS.PICKUP(id), fd);
      toast.success('Barang diambil');
      setPickupModal(false);
      fetchData();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const handleReturn = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      Object.entries(returnForm).forEach(([k, v]) => { if (k !== 'file') fd.append(k, v); });
      if (returnForm.file) fd.append('photo', returnForm.file);
      await upload(API_ENDPOINTS.BOOKINGS.RETURN(id), fd);
      toast.success('Barang dikembalikan');
      setReturnModal(false);
      fetchData();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    try {
      await post(API_ENDPOINTS.PAYMENTS.LIST, { booking_id: id, ...paymentForm });
      toast.success('Pembayaran dicatat');
      setPaymentModal(false);
      fetchData();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const openWhatsApp = async (type) => {
    try {
      const res = await get(API_ENDPOINTS.BOOKINGS.WHATSAPP(id), { type });
      if (res.success) window.open(res.data.url, '_blank');
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  if (loading) return <AdminLayout title="Detail Booking"><LoadingSpinner /></AdminLayout>;
  if (!booking) return <AdminLayout title="Detail Booking"><p>Booking tidak ditemukan</p></AdminLayout>;

  const summary = booking.paymentSummary || {};

  return (
    <AdminLayout title="Detail Booking">
      <button onClick={() => navigate('/bookings')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Kembali
      </button>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm text-slate-400">{booking.booking_number}</p>
                <h2 className="text-xl font-bold">{booking.customer_name}</h2>
                <p className="text-sm text-slate-500">{booking.customer_phone}</p>
              </div>
              <Badge status={booking.status} map={BOOKING_STATUS} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 text-sm">
              <div><p className="text-slate-400">Tanggal Acara</p><p className="font-medium">{formatDate(booking.event_date)}</p></div>
              <div><p className="text-slate-400">Ambil</p><p className="font-medium">{formatDate(booking.pickup_date)}</p></div>
              <div><p className="text-slate-400">Kembali</p><p className="font-medium">{formatDate(booking.return_date)}</p></div>
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Barang:</p>
              {booking.items?.map((it) => (
                <div key={it.id} className="flex justify-between rounded bg-slate-50 px-3 py-2 text-sm mb-1">
                  <span>{it.product_name} x{it.quantity}</span>
                  <span>{formatCurrency(it.rent_price)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold mb-3">Riwayat Pembayaran</h3>
            {booking.payments?.length ? booking.payments.map((p) => (
              <div key={p.id} className="flex justify-between border-b border-slate-100 py-2 text-sm last:border-0">
                <div><p>{formatDate(p.paid_at)} • {p.method}</p><p className="text-xs text-slate-400">{p.admin_name}</p></div>
                <p className="font-medium">{formatCurrency(p.amount)}</p>
              </div>
            )) : <p className="text-sm text-slate-400">Belum ada pembayaran</p>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold mb-3">Ringkasan</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Total Tagihan</span><span className="font-medium">{formatCurrency(booking.total)}</span></div>
              <div className="flex justify-between"><span>Total Dibayar</span><span className="font-medium text-green-600">{formatCurrency(summary.totalPaid)}</span></div>
              <div className="flex justify-between border-t pt-2"><span>Sisa Tagihan</span><span className="font-bold text-red-600">{formatCurrency(summary.remaining)}</span></div>
            </div>
          </div>

          <div className="card p-5 space-y-2">
            <button onClick={() => setPaymentModal(true)} className="btn-primary w-full">Tambah Pembayaran</button>
            {['DP', 'LUNAS'].includes(booking.status) && (
              <button onClick={() => setPickupModal(true)} className="btn-secondary w-full"><Truck className="h-4 w-4" /> Pengambilan Barang</button>
            )}
            {booking.status === 'SEDANG_DISEWA' && (
              <button onClick={() => setReturnModal(true)} className="btn-secondary w-full"><RotateCcw className="h-4 w-4" /> Pengembalian Barang</button>
            )}
            <button type="button" onClick={() => generateInvoicePdf({ booking, settings })} className="btn-secondary w-full">
              <Download className="h-4 w-4" /> Download PDF
            </button>
            <button type="button" onClick={() => printInvoice({ booking, settings })} className="btn-secondary w-full">
              <Printer className="h-4 w-4" /> Print
            </button>
            <button onClick={() => openWhatsApp('booking')} className="btn-secondary w-full"><MessageCircle className="h-4 w-4" /> Kirim WhatsApp</button>
          </div>
        </div>
      </div>

      <Modal open={pickupModal} onClose={() => setPickupModal(false)} title="Pengambilan Barang">
        <form onSubmit={handlePickup} className="space-y-4">
          <div><label className="label">Penerima</label><input className="input" value={pickupForm.pickup_by} onChange={(e) => setPickupForm({ ...pickupForm, pickup_by: e.target.value })} required /></div>
          <div><label className="label">Foto Bukti</label><input type="file" accept="image/*" onChange={(e) => setPickupForm({ ...pickupForm, file: e.target.files[0] })} /></div>
          <div><label className="label">Catatan</label><textarea className="input" value={pickupForm.pickup_notes} onChange={(e) => setPickupForm({ ...pickupForm, pickup_notes: e.target.value })} /></div>
          <button type="submit" className="btn-primary w-full">Konfirmasi Ambil</button>
        </form>
      </Modal>

      <Modal open={returnModal} onClose={() => setReturnModal(false)} title="Pengembalian Barang">
        <form onSubmit={handleReturn} className="space-y-4">
          <div><label className="label">Tanggal Kembali</label><input type="date" className="input" value={returnForm.return_date} onChange={(e) => setReturnForm({ ...returnForm, return_date: e.target.value })} required /></div>
          <div><label className="label">Kondisi Barang</label>
            <select className="input" value={returnForm.condition} onChange={(e) => setReturnForm({ ...returnForm, condition: e.target.value })}>
              <option>Baik</option><option>Rusak Ringan</option><option>Rusak Berat</option>
            </select>
          </div>
          <div><label className="label">Denda</label><input type="number" className="input" value={returnForm.fine} onChange={(e) => setReturnForm({ ...returnForm, fine: e.target.value })} /></div>
          <div><label className="label">Foto Barang</label><input type="file" accept="image/*" onChange={(e) => setReturnForm({ ...returnForm, file: e.target.files[0] })} /></div>
          <div><label className="label">Catatan</label><textarea className="input" value={returnForm.notes} onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })} /></div>
          <button type="submit" className="btn-primary w-full">Konfirmasi Kembali</button>
        </form>
      </Modal>

      <Modal open={paymentModal} onClose={() => setPaymentModal(false)} title="Tambah Pembayaran">
        <form onSubmit={handlePayment} className="space-y-4">
          <div><label className="label">Nominal</label><input type="number" className="input" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} required /></div>
          <div><label className="label">Metode</label>
            <select className="input" value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div><label className="label">Keterangan</label><textarea className="input" value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} /></div>
          <button type="submit" className="btn-primary w-full">Simpan Pembayaran</button>
        </form>
      </Modal>
    </AdminLayout>
  );
}
