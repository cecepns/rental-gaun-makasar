import { useState } from 'react';
import { createPortal } from 'react-dom';
import AsyncSelect from 'react-select/async';
import { components } from 'react-select';
import { Plus, X } from 'lucide-react';
import { get, post } from '@/utils/request';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { getErrorMessage } from '@/utils/helpers';
import toast from 'react-hot-toast';

const CUSTOMER_LIST_LIMIT = 4;

export const formatCustomerOption = (customer) => ({
  value: customer.id,
  label: customer.phone && customer.phone !== '-'
    ? `${customer.name} - ${customer.phone}`
    : customer.name,
  customer,
});

export const loadCustomerOptions = async (inputValue) => {
  try {
    const res = await get(API_ENDPOINTS.CUSTOMERS.LIST, {
      search: inputValue || undefined,
      limit: CUSTOMER_LIST_LIMIT,
    });
    return res.success ? res.data.map(formatCustomerOption) : [];
  } catch {
    return [];
  }
};

const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '38px',
    borderRadius: '0.5rem',
    borderColor: state.isFocused ? '#3b82f6' : '#e2e8f0',
    boxShadow: state.isFocused ? '0 0 0 2px rgb(59 130 246 / 0.1)' : 'none',
    '&:hover': { borderColor: state.isFocused ? '#3b82f6' : '#cbd5e1' },
  }),
  menu: (base) => ({ ...base, zIndex: 50, borderRadius: '0.75rem', overflow: 'hidden' }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? '#eff6ff' : state.isFocused ? '#f8fafc' : 'white',
    color: '#1e293b',
    cursor: 'pointer',
  }),
  placeholder: (base) => ({ ...base, color: '#94a3b8', fontSize: '0.875rem' }),
  singleValue: (base) => ({ ...base, color: '#1e293b', fontSize: '0.875rem' }),
  input: (base) => ({ ...base, fontSize: '0.875rem' }),
};

function CustomerOption(props) {
  const { customer } = props.data;
  return (
    <components.Option {...props}>
      <div className="py-0.5">
        <p className="text-sm font-medium text-slate-800">{customer.name}</p>
        {customer.phone && customer.phone !== '-' && (
          <p className="text-xs text-slate-500">
            {customer.phone}{customer.address ? ` · ${customer.address}` : ''}
          </p>
        )}
      </div>
    </components.Option>
  );
}

function AddCustomerModal({ open, onClose, onCreated }) {
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '' });
  const [saving, setSaving] = useState(false);

  const handleClose = () => {
    setNewCustomer({ name: '', phone: '', address: '' });
    onClose();
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomer.name.trim()) {
      toast.error('Nama customer wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const res = await post(API_ENDPOINTS.CUSTOMERS.LIST, {
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim() || '-',
        address: newCustomer.address.trim() || null,
        status: 'BARU',
      });
      if (res.success) {
        const option = formatCustomerOption(res.data);
        onCreated?.(option, res.data);
        toast.success('Customer berhasil ditambahkan');
        handleClose();
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative w-full max-w-md card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-semibold">Tambah Customer Baru</h3>
          <button type="button" onClick={handleClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleCreateCustomer} className="space-y-3 p-5">
          <div>
            <label className="label">Nama *</label>
            <input
              className="input"
              placeholder="Nama customer"
              value={newCustomer.name}
              onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">No. HP (opsional)</label>
            <input
              className="input"
              type="tel"
              placeholder="08xxxxxxxxxx"
              value={newCustomer.phone}
              onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Alamat (opsional)</label>
            <input
              className="input"
              placeholder="Alamat customer"
              value={newCustomer.address}
              onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={handleClose} className="btn-secondary flex-1">Batal</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default function CustomerSelect({ value, onChange, onCustomerCreated }) {
  const [addModalOpen, setAddModalOpen] = useState(false);

  return (
    <div className="space-y-2">
      <AsyncSelect
        cacheOptions
        defaultOptions
        loadOptions={loadCustomerOptions}
        value={value}
        onChange={onChange}
        placeholder="Cari nama atau nomor HP..."
        isClearable
        components={{ Option: CustomerOption }}
        styles={selectStyles}
        maxMenuHeight={200}
        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
        menuPosition="fixed"
        noOptionsMessage={({ inputValue }) => (inputValue ? 'Customer tidak ditemukan' : 'Ketik untuk mencari customer')}
        loadingMessage={() => 'Mencari customer...'}
      />

      <button
        type="button"
        onClick={() => setAddModalOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-primary-200 bg-primary-50/50 px-3 py-2 text-sm font-medium text-primary-600 transition hover:border-primary-300 hover:bg-primary-50"
      >
        <Plus className="h-4 w-4" /> Tambah Customer Baru
      </button>

      <AddCustomerModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onCreated={(option, customer) => {
          onChange(option);
          onCustomerCreated?.(customer);
        }}
      />
    </div>
  );
}
