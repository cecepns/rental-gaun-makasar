import { useEffect, useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus, Eye, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminLayout from '@/components/layout/AdminLayout';
import SearchInput from '@/components/ui/SearchInput';
import Pagination from '@/components/ui/Pagination';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import Badge from '@/components/ui/Badge';
import ProductSelect, { formatProductOption } from '@/components/ui/ProductSelect';
import CustomerSelect from '@/components/ui/CustomerSelect';
import DatePickerInput from '@/components/ui/DatePickerInput';
import { useDebounce } from '@/hooks/useDebounce';
import { get, post, put } from '@/utils/request';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatCurrency, formatDate, BOOKING_STATUS, getErrorMessage, getAssetUrl } from '@/utils/helpers';

const emptyForm = {
  customer_id: '',
  product_id: '',
  event_date: '',
  pickup_date: '',
  return_date: '',
  deposit: '',
  dp_amount: '',
  notes: '',
  quantity: 1,
};

export default function Bookings() {
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedProductOption, setSelectedProductOption] = useState(null);
  const [selectedCustomerOption, setSelectedCustomerOption] = useState(null);
  const debouncedSearch = useDebounce(search);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get(API_ENDPOINTS.BOOKINGS.LIST, { page, limit, search: debouncedSearch, status: statusFilter || undefined });
      if (res.success) { setItems(res.data); setPagination(res.pagination); }
    } finally { setLoading(false); }
  }, [page, limit, debouncedSearch, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setForm(emptyForm);
    setSelectedProduct(null);
    setSelectedProductOption(null);
    setSelectedCustomerOption(null);
    setAvailability(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const loadProductById = async (productId) => {
    const res = await get(API_ENDPOINTS.PRODUCTS.DETAIL(productId));
    if (!res.success) return;
    const option = formatProductOption(res.data);
    setSelectedProductOption(option);
    setSelectedProduct(res.data);
    setForm((f) => ({ ...f, product_id: String(res.data.id) }));
  };

  useEffect(() => {
    if (!location.state?.productId) return;
    loadProductById(location.state.productId).then(() => setModalOpen(true));
  }, [location.state]);

  const handleProductChange = (option) => {
    setSelectedProductOption(option);
    setSelectedProduct(option?.product || null);
    setForm((f) => ({ ...f, product_id: option ? String(option.value) : '' }));
    setAvailability(null);
  };

  const checkAvailability = async () => {
    if (!form.product_id || !form.pickup_date || !form.return_date) return;
    try {
      const res = await post(API_ENDPOINTS.AVAILABILITY.CHECK, {
        product_id: form.product_id,
        pickup_date: form.pickup_date,
        return_date: form.return_date,
      });
      if (res.success) setAvailability(res.data);
    } catch (e) { toast.error(getErrorMessage(e)); }
  };

  useEffect(() => {
    if (form.product_id && form.pickup_date && form.return_date) checkAvailability();
  }, [form.product_id, form.pickup_date, form.return_date]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_id) {
      toast.error('Pilih customer terlebih dahulu');
      return;
    }
    if (!form.product_id) {
      toast.error('Pilih barang terlebih dahulu');
      return;
    }
    if (availability && !availability.available) {
      toast.error('Gaun itu sudah terbooking. Silakan ubah tanggal atau kode gaun.');
      return;
    }
    setSaving(true);
    try {
      await post(API_ENDPOINTS.BOOKINGS.LIST, {
        customer_id: form.customer_id,
        event_date: form.event_date,
        pickup_date: form.pickup_date,
        return_date: form.return_date,
        deposit: form.deposit || selectedProduct?.deposit || 0,
        dp_amount: form.dp_amount || 0,
        notes: form.notes,
        items: [{ product_id: Number(form.product_id), quantity: Number(form.quantity) || 1 }],
      });
      toast.success('Booking berhasil dibuat');
      closeModal();
      fetchData();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const handleCancel = (item) => {
    toast((t) => (
      <div>
        <p className="font-medium">Batalkan booking {item.booking_number}?</p>
        <div className="mt-2 flex gap-2">
          <button className="btn-danger text-xs px-3 py-1" onClick={async () => {
            try { await put(API_ENDPOINTS.BOOKINGS.CANCEL(item.id));
              toast.success('Booking dibatalkan'); fetchData();
            } catch (e) { toast.error(getErrorMessage(e)); }
            toast.dismiss(t.id);
          }}>Batalkan</button>
          <button className="btn-secondary text-xs px-3 py-1" onClick={() => toast.dismiss(t.id)}>Tutup</button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  return (
    <AdminLayout title="Booking">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-3">
          <div className="max-w-sm flex-1"><SearchInput value={search} onChange={setSearch} placeholder="Cari booking atau customer..." /></div>
          <select className="input w-auto" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">Semua Status</option>
            {Object.keys(BOOKING_STATUS).map((s) => <option key={s} value={s}>{BOOKING_STATUS[s].label}</option>)}
          </select>
        </div>
        <button onClick={openCreateModal} className="btn-primary"><Plus className="h-4 w-4" /> Buat Booking</button>
      </div>

      {loading ? <LoadingSpinner /> : items.length === 0 ? <EmptyState /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3">No. Booking</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Barang</th>
                  <th className="px-4 py-3">Tgl Acara</th>
                  <th className="px-4 py-3">Ambil/Kembali</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">{item.booking_number}</td>
                    <td className="px-4 py-3">{item.customer_name}</td>
                    <td className="px-4 py-3 max-w-[150px] truncate">{item.products}</td>
                    <td className="px-4 py-3">{formatDate(item.event_date)}</td>
                    <td className="px-4 py-3 text-xs">{formatDate(item.pickup_date)} - {formatDate(item.return_date)}</td>
                    <td className="px-4 py-3">{formatCurrency(item.total)}</td>
                    <td className="px-4 py-3"><Badge status={item.status} map={BOOKING_STATUS} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link to={`/bookings/${item.id}`} className="rounded p-1.5 hover:bg-slate-100"><Eye className="h-4 w-4" /></Link>
                        {item.status !== 'BATAL' && item.status !== 'SELESAI' && (
                          <button onClick={() => handleCancel(item)} className="rounded p-1.5 hover:bg-red-50 text-red-500"><XCircle className="h-4 w-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 p-4">
            <Pagination pagination={pagination} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title="Buat Booking" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Customer</label>
              <CustomerSelect
                value={selectedCustomerOption}
                onChange={(option) => {
                  setSelectedCustomerOption(option);
                  setForm({ ...form, customer_id: option ? String(option.value) : '' });
                }}
              />
            </div>
            <div>
              <label className="label">Barang</label>
              <ProductSelect value={selectedProductOption} onChange={handleProductChange} />
            </div>
            <DatePickerInput
              label="Tanggal Ambil"
              value={form.pickup_date}
              onChange={(pickup_date) => setForm({ ...form, pickup_date, return_date: form.return_date && form.return_date < pickup_date ? pickup_date : form.return_date })}
              disablePast
              required
            />
            <DatePickerInput
              label="Tanggal Acara"
              value={form.event_date}
              onChange={(event_date) => setForm({ ...form, event_date })}
              disablePast
              required
            />
            <DatePickerInput
              label="Tanggal Kembali"
              value={form.return_date}
              onChange={(return_date) => setForm({ ...form, return_date })}
              minDate={form.pickup_date}
              disablePast
              required
            />
            <div>
              <label className="label">DP</label>
              <input type="number" className="input" value={form.dp_amount} onChange={(e) => setForm({ ...form, dp_amount: e.target.value })} />
            </div>
          </div>

          {selectedProduct && (
            <div className="flex gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              {selectedProduct.main_image ? (
                <img
                  src={getAssetUrl(selectedProduct.main_image)}
                  alt={selectedProduct.name}
                  className="h-20 w-20 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-xs text-slate-500">
                  No image
                </div>
              )}
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-slate-800">{selectedProduct.name}</p>
                <p className="text-slate-500">{selectedProduct.code}</p>
                <p className="mt-1">Harga: {formatCurrency(selectedProduct.rent_price)} | Deposit: {formatCurrency(selectedProduct.deposit)}</p>
                <p className="font-semibold text-primary-700">
                  Estimasi Total: {formatCurrency(Number(selectedProduct.rent_price) + Number(form.deposit || selectedProduct.deposit))}
                </p>
              </div>
            </div>
          )}

          {availability && (
            <div className={`rounded-lg p-3 text-sm ${availability.available ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {availability.available
                ? `✓ Tersedia (sisa ${availability.remaining} unit)`
                : '✗ Gaun itu sudah terbooking. Silakan ubah tanggal atau kode gaun.'}
            </div>
          )}

          <div>
            <label className="label">Catatan</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeModal} className="btn-secondary">Batal</button>
            <button type="submit" disabled={saving || !form.product_id || (availability && !availability.available)} className="btn-primary">
              {saving ? 'Menyimpan...' : 'Simpan Booking'}
            </button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}
