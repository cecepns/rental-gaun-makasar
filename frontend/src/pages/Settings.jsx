import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AdminLayout from '@/components/layout/AdminLayout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { get, upload } from '@/utils/request';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { getErrorMessage, getAssetUrl } from '@/utils/helpers';

export default function Settings() {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState(null);

  useEffect(() => {
    get(API_ENDPOINTS.SETTINGS)
      .then((res) => res.success && setForm(res.data))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v != null) fd.append(k, v); });
      if (logoFile) fd.append('logo', logoFile);
      const res = await upload(API_ENDPOINTS.SETTINGS, fd, 'put');
      if (res.success) { setForm(res.data); toast.success('Pengaturan disimpan'); }
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  if (loading) return <AdminLayout title="Pengaturan"><LoadingSpinner /></AdminLayout>;

  return (
    <AdminLayout title="Pengaturan">
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold">Informasi Toko</h3>
          <div><label className="label">Nama Toko</label><input className="input" value={form.store_name || ''} onChange={(e) => setForm({ ...form, store_name: e.target.value })} /></div>
          <div><label className="label">Logo</label>
            {form.logo && <img src={getAssetUrl(form.logo)} alt="Logo" className="mb-2 h-16 object-contain" />}
            <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files[0])} />
          </div>
          <div><label className="label">Alamat</label><textarea className="input" rows={2} value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">No HP</label><input className="input" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="label">WhatsApp</label><input className="input" value={form.whatsapp || ''} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="628xxx" /></div>
          </div>
          <div><label className="label">Instagram</label><input className="input" value={form.instagram || ''} onChange={(e) => setForm({ ...form, instagram: e.target.value })} /></div>
        </div>

        <div className="card p-5 space-y-4">
          <h3 className="font-semibold">Pengaturan Default</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Durasi Keep (jam)</label><input type="number" className="input" value={form.keep_default_hours || 24} onChange={(e) => setForm({ ...form, keep_default_hours: e.target.value })} /></div>
            <div><label className="label">Deposit Default</label><input type="number" className="input" value={form.deposit_default || ''} onChange={(e) => setForm({ ...form, deposit_default: e.target.value })} /></div>
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <h3 className="font-semibold">Template WhatsApp</h3>
          <p className="text-xs text-slate-400">Variabel: {'{nama}'}, {'{barang}'}, {'{tanggal}'}, {'{total}'}</p>
          <div><label className="label">Template Booking</label><textarea className="input" rows={4} value={form.wa_template_booking || ''} onChange={(e) => setForm({ ...form, wa_template_booking: e.target.value })} /></div>
          <div><label className="label">Reminder DP</label><textarea className="input" rows={3} value={form.wa_template_dp_reminder || ''} onChange={(e) => setForm({ ...form, wa_template_dp_reminder: e.target.value })} /></div>
          <div><label className="label">Reminder Pengambilan</label><textarea className="input" rows={3} value={form.wa_template_pickup || ''} onChange={(e) => setForm({ ...form, wa_template_pickup: e.target.value })} /></div>
          <div><label className="label">Reminder Pengembalian</label><textarea className="input" rows={3} value={form.wa_template_return || ''} onChange={(e) => setForm({ ...form, wa_template_return: e.target.value })} /></div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</button>
      </form>
    </AdminLayout>
  );
}
