import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminLayout from '@/components/layout/AdminLayout';
import SearchInput from '@/components/ui/SearchInput';
import Pagination from '@/components/ui/Pagination';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import Badge from '@/components/ui/Badge';
import ProductSelect, { formatProductOption } from '@/components/ui/ProductSelect';
import DatePickerInput from '@/components/ui/DatePickerInput';
import { useDebounce } from '@/hooks/useDebounce';
import { get, post, put } from '@/utils/request';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatCurrency, formatDate, KEEP_STATUS, getErrorMessage, getAssetUrl } from '@/utils/helpers';

const emptyForm = {
  product_id: '',
  customer_id: '',
  start_date: '',
  end_date: '',
  notes: '',
};

export default function Keeps() {
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedProductOption, setSelectedProductOption] = useState(null);
  const debouncedSearch = useDebounce(search);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get(API_ENDPOINTS.KEEPS.LIST, { page, limit, search: debouncedSearch });
      if (res.success) { setItems(res.data); setPagination(res.pagination); }
    } finally { setLoading(false); }
  }, [page, limit, debouncedSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    get(API_ENDPOINTS.CUSTOMERS.LIST, { limit: 100 }).then((r) => r.success && setCustomers(r.data));
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setSelectedProduct(null);
    setSelectedProductOption(null);
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.product_id) {
      toast.error('Pilih barang terlebih dahulu');
      return;
    }
    setSaving(true);
    try {
      await post(API_ENDPOINTS.KEEPS.LIST, form);
      toast.success('Keep berhasil dibuat (berlaku 24 jam)');
      closeModal();
      fetchData();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const handleCancel = (item) => {
    toast((t) => (
      <div>
        <p className="font-medium">Batalkan keep ini?</p>
        <div className="mt-2 flex gap-2">
          <button className="btn-danger text-xs px-3 py-1" onClick={async () => {
            try { await put(API_ENDPOINTS.KEEPS.CANCEL(item.id)); toast.success('Keep dibatalkan'); fetchData(); }
            catch (e) { toast.error(getErrorMessage(e)); }
            toast.dismiss(t.id);
          }}>Batalkan</button>
          <button className="btn-secondary text-xs px-3 py-1" onClick={() => toast.dismiss(t.id)}>Tutup</button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  return (
    <AdminLayout title="Keep">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-sm flex-1"><SearchInput value={search} onChange={setSearch} placeholder="Cari keep..." /></div>
        <button onClick={openCreateModal} className="btn-primary"><Plus className="h-4 w-4" /> Buat Keep</button>
      </div>

      <div className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
        Keep berlaku 24 jam. Jika tidak ada pembayaran DP, keep otomatis expired.
      </div>

      {loading ? <LoadingSpinner /> : items.length === 0 ? <EmptyState /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3">Barang</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Periode</th>
                  <th className="px-4 py-3">Expired</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3"><p className="font-medium">{item.product_name}</p><p className="text-xs text-slate-400">{item.product_code}</p></td>
                    <td className="px-4 py-3">{item.customer_name}</td>
                    <td className="px-4 py-3">{formatDate(item.start_date)} - {formatDate(item.end_date)}</td>
                    <td className="px-4 py-3 text-xs">{new Date(item.expired_at).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3"><Badge status={item.status} map={KEEP_STATUS} /></td>
                    <td className="px-4 py-3">
                      {item.status === 'KEEP' && (
                        <button onClick={() => handleCancel(item)} className="rounded p-1.5 hover:bg-red-50 text-red-500"><XCircle className="h-4 w-4" /></button>
                      )}
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

      <Modal open={modalOpen} onClose={closeModal} title="Buat Keep">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Barang</label>
            <ProductSelect value={selectedProductOption} onChange={handleProductChange} />
          </div>
          <div>
            <label className="label">Customer</label>
            <select className="input" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required>
              <option value="">Pilih customer</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatePickerInput
              label="Tanggal Mulai"
              value={form.start_date}
              onChange={(start_date) => setForm({
                ...form,
                start_date,
                end_date: form.end_date && form.end_date < start_date ? start_date : form.end_date,
              })}
              disablePast
              required
            />
            <DatePickerInput
              label="Tanggal Selesai"
              value={form.end_date}
              onChange={(end_date) => setForm({ ...form, end_date })}
              minDate={form.start_date}
              disablePast
              required
            />
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
              </div>
            </div>
          )}

          <div>
            <label className="label">Catatan</label>
            <textarea className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeModal} className="btn-secondary">Batal</button>
            <button type="submit" disabled={saving || !form.product_id} className="btn-primary">
              {saving ? 'Menyimpan...' : 'Simpan Keep'}
            </button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}
