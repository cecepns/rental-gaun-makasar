import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { get, post, put, del } from '@/utils/request';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { getErrorMessage } from '@/utils/helpers';

export default function CategoryManageModal({ open, onClose, onUpdated }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get(API_ENDPOINTS.CATEGORIES.ALL);
      if (res.success) setItems(res.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (open) fetchCategories();
  }, [open, fetchCategories]);

  const notifyUpdate = () => onUpdated?.();

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return toast.error('Nama kategori wajib diisi');
    setSaving(true);
    try {
      await post(API_ENDPOINTS.CATEGORIES.LIST, { name: newName.trim() });
      toast.success('Kategori ditambahkan');
      setNewName('');
      await fetchCategories();
      notifyUpdate();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const handleSaveEdit = async (id) => {
    if (!editName.trim()) return toast.error('Nama kategori wajib diisi');
    setSaving(true);
    try {
      await put(API_ENDPOINTS.CATEGORIES.DETAIL(id), { name: editName.trim() });
      toast.success('Kategori diperbarui');
      setEditId(null);
      setEditName('');
      await fetchCategories();
      notifyUpdate();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const handleDelete = (item) => {
    toast((t) => (
      <div>
        <p className="font-medium">Hapus kategori &quot;{item.name}&quot;?</p>
        <div className="mt-2 flex gap-2">
          <button className="btn-danger text-xs px-3 py-1" onClick={async () => {
            try {
              await del(API_ENDPOINTS.CATEGORIES.DETAIL(item.id));
              toast.success('Kategori dihapus');
              await fetchCategories();
              notifyUpdate();
            } catch (e) { toast.error(getErrorMessage(e)); }
            toast.dismiss(t.id);
          }}>Hapus</button>
          <button className="btn-secondary text-xs px-3 py-1" onClick={() => toast.dismiss(t.id)}>Batal</button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  return (
    <Modal open={open} onClose={onClose} title="Kelola Kategori" size="md">
      <form onSubmit={handleAdd} className="mb-4 flex gap-2">
        <input
          className="input flex-1"
          placeholder="Nama kategori baru"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" disabled={saving} className="btn-primary shrink-0">
          <Plus className="h-4 w-4" />
        </button>
      </form>

      {loading ? <LoadingSpinner className="py-8" /> : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Belum ada kategori</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 px-3 py-2.5">
              {editId === item.id ? (
                <>
                  <input
                    className="input flex-1 text-sm"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                  />
                  <button type="button" onClick={() => handleSaveEdit(item.id)} disabled={saving} className="btn-primary text-xs px-2 py-1">
                    Simpan
                  </button>
                  <button type="button" onClick={() => { setEditId(null); setEditName(''); }} className="btn-secondary text-xs px-2 py-1">
                    Batal
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium">{item.name}</span>
                  <button
                    type="button"
                    onClick={() => { setEditId(item.id); setEditName(item.name); }}
                    className="rounded p-1.5 hover:bg-slate-100"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="rounded p-1.5 hover:bg-red-50 text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
