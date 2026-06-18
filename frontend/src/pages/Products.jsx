import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminLayout from '@/components/layout/AdminLayout';
import SearchInput from '@/components/ui/SearchInput';
import Pagination from '@/components/ui/Pagination';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import ProductImageFields from '@/components/products/ProductImageFields';
import { useDebounce } from '@/hooks/useDebounce';
import { get, del, upload } from '@/utils/request';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { getErrorMessage, getAssetUrl, formatCurrency } from '@/utils/helpers';

const emptyForm = { code: '', name: '', category_id: '', description: '', rent_price: '', deposit: '', stock: '1', is_active: true };

const emptyImages = { existingMain: null, pendingMain: null };

export default function Products() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [images, setImages] = useState(emptyImages);
  const [loadingImages, setLoadingImages] = useState(false);
  const [removingMain, setRemovingMain] = useState(false);
  const [saving, setSaving] = useState(false);
  const debouncedSearch = useDebounce(search);

  const resetImages = () => {
    if (images.pendingMain?.preview) URL.revokeObjectURL(images.pendingMain.preview);
    setImages(emptyImages);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get(API_ENDPOINTS.PRODUCTS.LIST, { page, limit, search: debouncedSearch, category_id: categoryFilter || undefined });
      if (res.success) { setItems(res.data); setPagination(res.pagination); }
    } finally { setLoading(false); }
  }, [page, limit, debouncedSearch, categoryFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    get(API_ENDPOINTS.CATEGORIES.ALL).then((res) => res.success && setCategories(res.data));
  }, []);

  useEffect(() => () => {
    if (images.pendingMain?.preview) URL.revokeObjectURL(images.pendingMain.preview);
  }, []);

  const loadProductImages = async (productId) => {
    setLoadingImages(true);
    try {
      const res = await get(API_ENDPOINTS.PRODUCTS.DETAIL(productId));
      if (res.success) {
        setImages({
          existingMain: res.data.main_image || null,
          pendingMain: null,
        });
      }
    } finally { setLoadingImages(false); }
  };

  const openCreate = () => {
    setEditItem(null);
    setForm(emptyForm);
    resetImages();
    setModalOpen(true);
  };

  const openEdit = async (item) => {
    setEditItem(item);
    setForm({ ...item, category_id: item.category_id, is_active: !!item.is_active });
    resetImages();
    setModalOpen(true);
    await loadProductImages(item.id);
  };

  const closeModal = () => {
    resetImages();
    setModalOpen(false);
  };

  const handleSelectMain = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('File harus berupa gambar');
    if (file.size > 5 * 1024 * 1024) return toast.error('Ukuran maksimal 5MB');
    setImages((prev) => {
      if (prev.pendingMain?.preview) URL.revokeObjectURL(prev.pendingMain.preview);
      return { ...prev, pendingMain: { file, preview: URL.createObjectURL(file) } };
    });
  };

  const handleRemovePendingMain = () => {
    setImages((prev) => {
      if (prev.pendingMain?.preview) URL.revokeObjectURL(prev.pendingMain.preview);
      return { ...prev, pendingMain: null };
    });
  };

  const handleRemoveExistingMain = () => {
    if (!editItem) {
      setImages((prev) => ({ ...prev, existingMain: null }));
      return;
    }
    toast((t) => (
      <div>
        <p className="font-medium">Hapus foto utama?</p>
        <div className="mt-2 flex gap-2">
          <button className="btn-danger text-xs px-3 py-1" onClick={async () => {
            setRemovingMain(true);
            try {
              await del(API_ENDPOINTS.PRODUCTS.MAIN_IMAGE(editItem.id));
              setImages((prev) => ({ ...prev, existingMain: null }));
              toast.success('Foto utama dihapus');
              fetchData();
            } catch (err) { toast.error(getErrorMessage(err)); }
            finally { setRemovingMain(false); toast.dismiss(t.id); }
          }}>Hapus</button>
          <button className="btn-secondary text-xs px-3 py-1" onClick={() => toast.dismiss(t.id)}>Batal</button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  const handleDelete = (item) => {
    toast((t) => (
      <div>
        <p className="font-medium">Hapus {item.name}?</p>
        <div className="mt-2 flex gap-2">
          <button className="btn-danger text-xs px-3 py-1" onClick={async () => {
            try {
              await del(API_ENDPOINTS.PRODUCTS.DETAIL(item.id));
              toast.success('Barang dihapus');
              fetchData();
            } catch (e) { toast.error(getErrorMessage(e)); }
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
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (images.pendingMain?.file) fd.append('main_image', images.pendingMain.file);
      if (editItem) await upload(API_ENDPOINTS.PRODUCTS.DETAIL(editItem.id), fd, 'put');
      else await upload(API_ENDPOINTS.PRODUCTS.LIST, fd);
      toast.success(editItem ? 'Barang diperbarui' : 'Barang ditambahkan');
      closeModal();
      fetchData();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <AdminLayout title="Master Barang">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-3">
          <div className="flex-1 max-w-sm"><SearchInput value={search} onChange={setSearch} placeholder="Cari warna atau kode..." /></div>
          <select className="input w-auto" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
            <option value="">Semua Kategori</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus className="h-4 w-4" /> Tambah Barang</button>
      </div>

      {loading ? <LoadingSpinner /> : items.length === 0 ? <EmptyState /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3">Kode</th>
                  <th className="px-4 py-3">Warna</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Harga</th>
                  <th className="px-4 py-3">Stok</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">{item.code}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.main_image && <img src={getAssetUrl(item.main_image)} alt="" className="h-8 w-8 rounded object-cover" />}
                        {item.name}
                      </div>
                    </td>
                    <td className="px-4 py-3">{item.category_name}</td>
                    <td className="px-4 py-3">{formatCurrency(item.rent_price)}</td>
                    <td className="px-4 py-3">{item.stock}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {item.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link to={`/products/${item.id}`} className="rounded p-1.5 hover:bg-slate-100"><Eye className="h-4 w-4" /></Link>
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

      <Modal open={modalOpen} onClose={closeModal} title={editItem ? 'Edit Barang' : 'Tambah Barang'} size="lg">
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Kode Barang</label><input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></div>
          <div><label className="label">Warna Barang</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div><label className="label">Kategori</label>
            <select className="input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} required>
              <option value="">Pilih kategori</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="label">Harga Sewa</label><input type="number" className="input" value={form.rent_price} onChange={(e) => setForm({ ...form, rent_price: e.target.value })} required /></div>
          <div><label className="label">Deposit</label><input type="number" className="input" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} /></div>
          <div><label className="label">Stok</label><input type="number" className="input" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} min="1" /></div>
          <div className="sm:col-span-2"><label className="label">Deskripsi</label><textarea className="input" rows={2} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>

          {loadingImages ? (
            <div className="sm:col-span-2"><LoadingSpinner className="py-6" /></div>
          ) : (
            <ProductImageFields
              existingMain={images.existingMain}
              pendingMain={images.pendingMain}
              onSelectMain={handleSelectMain}
              onRemoveExistingMain={handleRemoveExistingMain}
              onRemovePendingMain={handleRemovePendingMain}
              removingMain={removingMain}
            />
          )}

          <div className="sm:col-span-2 flex items-center gap-2">
            <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            <label htmlFor="is_active" className="text-sm">Status Aktif</label>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={closeModal} className="btn-secondary">Batal</button>
            <button type="submit" disabled={saving || loadingImages} className="btn-primary">{saving ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}
