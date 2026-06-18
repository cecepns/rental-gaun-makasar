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
import { useDebounce } from '@/hooks/useDebounce';
import { get, post, put } from '@/utils/request';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatDate, KEEP_STATUS, getErrorMessage } from '@/utils/helpers';

export default function Keeps() {
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ product_id: '', customer_id: '', start_date: '', end_date: '', notes: '' });
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
    get(API_ENDPOINTS.PRODUCTS.LIST, { limit: 100, is_active: true }).then((r) => r.success && setProducts(r.data));
    if (location.state?.productId) {
      setForm((f) => ({ ...f, product_id: location.state.productId }));
      setModalOpen(true);
    }
  }, [location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await post(API_ENDPOINTS.KEEPS.LIST, form);
      toast.success('Keep berhasil dibuat (berlaku 24 jam)');
      setModalOpen(false);
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
        <button onClick={() => setModalOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> Buat Keep</button>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Buat Keep">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="label">Barang</label>
            <select className="input" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} required>
              <option value="">Pilih barang</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
            </select>
          </div>
          <div><label className="label">Customer</label>
            <select className="input" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required>
              <option value="">Pilih customer</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Tanggal Mulai</label><input type="date" className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required /></div>
            <div><label className="label">Tanggal Selesai</label><input type="date" className="input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required /></div>
          </div>
          <div><label className="label">Catatan</label><textarea className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Batal</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Menyimpan...' : 'Simpan Keep'}</button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}
