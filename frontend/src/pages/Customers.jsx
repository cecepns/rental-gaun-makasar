import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminLayout from '@/components/layout/AdminLayout';
import SearchInput from '@/components/ui/SearchInput';
import Pagination from '@/components/ui/Pagination';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import Badge from '@/components/ui/Badge';
import { useDebounce } from '@/hooks/useDebounce';
import { get, post, put, del } from '@/utils/request';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { CUSTOMER_STATUS, getErrorMessage } from '@/utils/helpers';

const emptyForm = { name: '', phone: '', address: '', instagram: '', facebook: '', notes: '', status: 'BARU' };

export default function Customers() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const debouncedSearch = useDebounce(search);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get(API_ENDPOINTS.CUSTOMERS.LIST, { page, limit, search: debouncedSearch });
      if (res.success) { setItems(res.data); setPagination(res.pagination); }
    } finally { setLoading(false); }
  }, [page, limit, debouncedSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => { setEditItem(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (item) => { setEditItem(item); setForm({ ...item }); setModalOpen(true); };

  const handleDelete = (item) => {
    toast((t) => (
      <div>
        <p className="font-medium">Hapus {item.name}?</p>
        <div className="mt-2 flex gap-2">
          <button className="btn-danger text-xs px-3 py-1" onClick={async () => {
            try { await del(API_ENDPOINTS.CUSTOMERS.DETAIL(item.id)); toast.success('Customer dihapus'); fetchData(); }
            catch (e) { toast.error(getErrorMessage(e)); }
            toast.dismiss(t.id);
          }}>Hapus</button>
          <button className="btn-secondary text-xs px-3 py-1" onClick={() => toast.dismiss(t.id)}>Batal</button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editItem) await put(API_ENDPOINTS.CUSTOMERS.DETAIL(editItem.id), form);
      else await post(API_ENDPOINTS.CUSTOMERS.LIST, form);
      toast.success(editItem ? 'Customer diperbarui' : 'Customer ditambahkan');
      setModalOpen(false);
      fetchData();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <AdminLayout title="Customer">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-sm flex-1"><SearchInput value={search} onChange={setSearch} placeholder="Cari nama atau HP..." /></div>
        <button onClick={openCreate} className="btn-primary"><Plus className="h-4 w-4" /> Tambah Customer</button>
      </div>

      {loading ? <LoadingSpinner /> : items.length === 0 ? <EmptyState /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">No HP</th>
                  <th className="px-4 py-3">Alamat</th>
                  <th className="px-4 py-3">Instagram</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3">{item.phone}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{item.address || '-'}</td>
                    <td className="px-4 py-3">{item.instagram || '-'}</td>
                    <td className="px-4 py-3"><Badge status={item.status} map={CUSTOMER_STATUS} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(item)} className="rounded p-1.5 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => handleDelete(item)} className="rounded p-1.5 hover:bg-red-50 text-red-500"><Trash2 className="h-4 w-4" /></button>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Customer' : 'Tambah Customer'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="label">Nama</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div><label className="label">No HP</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></div>
          <div><label className="label">Alamat</label><textarea className="input" rows={2} value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Instagram</label><input className="input" value={form.instagram || ''} onChange={(e) => setForm({ ...form, instagram: e.target.value })} /></div>
            <div><label className="label">Facebook</label><input className="input" value={form.facebook || ''} onChange={(e) => setForm({ ...form, facebook: e.target.value })} /></div>
          </div>
          <div><label className="label">Status</label>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.keys(CUSTOMER_STATUS).map((s) => <option key={s} value={s}>{CUSTOMER_STATUS[s].label}</option>)}
            </select>
          </div>
          <div><label className="label">Catatan</label><textarea className="input" rows={2} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Batal</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}
