import { useState } from 'react';
import AsyncSelect from 'react-select/async';
import { components } from 'react-select';
import { Plus } from 'lucide-react';
import { get, post } from '@/utils/request';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { getErrorMessage } from '@/utils/helpers';
import toast from 'react-hot-toast';

export const formatCustomerOption = (customer) => ({
  value: customer.id,
  label: `${customer.name} - ${customer.phone}`,
  customer,
});

export const loadCustomerOptions = async (inputValue) => {
  try {
    const res = await get(API_ENDPOINTS.CUSTOMERS.LIST, {
      search: inputValue || undefined,
      limit: 20,
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
        <p className="text-xs text-slate-500">{customer.phone}{customer.address ? ` · ${customer.address}` : ''}</p>
      </div>
    </components.Option>
  );
}

export default function CustomerSelect({ value, onChange, onCustomerCreated }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '' });
  const [saving, setSaving] = useState(false);

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomer.name.trim() || !newCustomer.phone.trim()) {
      toast.error('Nama dan nomor HP wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const res = await post(API_ENDPOINTS.CUSTOMERS.LIST, {
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim(),
        address: newCustomer.address.trim() || null,
        status: 'BARU',
      });
      if (res.success) {
        const created = res.data;
        const option = formatCustomerOption(created);
        onChange(option);
        onCustomerCreated?.(created);
        toast.success('Customer berhasil ditambahkan');
        setShowAddForm(false);
        setNewCustomer({ name: '', phone: '', address: '' });
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (showAddForm) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
        <p className="text-sm font-medium text-slate-700">Tambah Customer Baru</p>
        <form onSubmit={handleCreateCustomer} className="space-y-2">
          <input
            className="input"
            placeholder="Nama *"
            value={newCustomer.name}
            onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
            required
          />
          <input
            className="input"
            placeholder="No. HP *"
            value={newCustomer.phone}
            onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
            required
          />
          <input
            className="input"
            placeholder="Alamat (opsional)"
            value={newCustomer.address}
            onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowAddForm(false)} className="btn-secondary text-xs flex-1">
              Batal
            </button>
            <button type="submit" disabled={saving} className="btn-primary text-xs flex-1">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    );
  }

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
        components={{
          Option: CustomerOption,
          MenuList: (props) => (
            <>
              <components.MenuList {...props} />
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-sm font-medium text-primary-600 hover:bg-primary-50"
              >
                <Plus className="h-4 w-4" /> Tambah Customer Baru
              </button>
            </>
          ),
        }}
        styles={selectStyles}
        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
        menuPosition="fixed"
        noOptionsMessage={({ inputValue }) => (inputValue ? 'Customer tidak ditemukan' : 'Ketik untuk mencari customer')}
        loadingMessage={() => 'Mencari customer...'}
      />
    </div>
  );
}
