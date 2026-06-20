import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AdminLayout from '@/components/layout/AdminLayout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { get, put, upload } from '@/utils/request';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { getErrorMessage, getAssetUrl } from '@/utils/helpers';
import { useAuth } from '@/context/AuthContext';

const emptyAccountForm = {
  email: '',
  current_password: '',
  new_password: '',
  confirm_password: '',
};

export default function Settings() {
  const { user, login } = useAuth();
  const [form, setForm] = useState({});
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [logoFile, setLogoFile] = useState(null);

  useEffect(() => {
    Promise.all([
      get(API_ENDPOINTS.SETTINGS),
      get(API_ENDPOINTS.AUTH.PROFILE),
    ])
      .then(([settingsRes, profileRes]) => {
        if (settingsRes.success) setForm(settingsRes.data);
        if (profileRes.success) {
          setAccountForm((prev) => ({ ...prev, email: profileRes.data.email || '' }));
        }
      })
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

  const handleAccountSubmit = async (e) => {
    e.preventDefault();
    if (!accountForm.current_password) {
      return toast.error('Password saat ini wajib diisi');
    }
    if (accountForm.new_password && accountForm.new_password !== accountForm.confirm_password) {
      return toast.error('Konfirmasi password tidak cocok');
    }
    setSavingAccount(true);
    try {
      const payload = {
        email: accountForm.email,
        current_password: accountForm.current_password,
      };
      if (accountForm.new_password) payload.new_password = accountForm.new_password;

      const res = await put(API_ENDPOINTS.AUTH.UPDATE_PROFILE, payload);
      if (res.success) {
        const token = localStorage.getItem('token');
        if (token) login(token, { ...user, ...res.data });
        toast.success('Akun admin diperbarui');
        setAccountForm((prev) => ({
          ...emptyAccountForm,
          email: res.data.email,
        }));
      }
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSavingAccount(false); }
  };

  if (loading) return <AdminLayout title="Pengaturan"><LoadingSpinner /></AdminLayout>;

  return (
    <AdminLayout title="Pengaturan">
      <div className="max-w-2xl space-y-6">
        <form onSubmit={handleAccountSubmit} className="card p-5 space-y-4">
          <h3 className="font-semibold">Akun Admin</h3>
          <p className="text-xs text-slate-400">Ubah email dan/atau password. Password saat ini wajib diisi untuk menyimpan perubahan.</p>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={accountForm.email}
              onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Password Saat Ini *</label>
            <input
              type="password"
              className="input"
              value={accountForm.current_password}
              onChange={(e) => setAccountForm({ ...accountForm, current_password: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Password Baru (opsional)</label>
              <input
                type="password"
                className="input"
                value={accountForm.new_password}
                onChange={(e) => setAccountForm({ ...accountForm, new_password: e.target.value })}
                placeholder="Kosongkan jika tidak diubah"
              />
            </div>
            <div>
              <label className="label">Konfirmasi Password Baru</label>
              <input
                type="password"
                className="input"
                value={accountForm.confirm_password}
                onChange={(e) => setAccountForm({ ...accountForm, confirm_password: e.target.value })}
                placeholder="Ulangi password baru"
              />
            </div>
          </div>
          <button type="submit" disabled={savingAccount} className="btn-primary">
            {savingAccount ? 'Menyimpan...' : 'Simpan Akun'}
          </button>
        </form>

        <form onSubmit={handleSubmit} className="space-y-6">
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
      </div>
    </AdminLayout>
  );
}
