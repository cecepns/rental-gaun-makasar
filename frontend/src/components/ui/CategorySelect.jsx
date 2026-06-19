import { useMemo } from 'react';
import Select from 'react-select';
import { Settings2 } from 'lucide-react';

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
};

export const formatCategoryOption = (category) => ({
  value: category.id,
  label: category.name,
  category,
});

export default function CategorySelect({
  categories = [],
  value,
  onChange,
  placeholder = 'Pilih kategori',
  allowAll = false,
  isClearable = false,
  className = '',
  onManage,
}) {
  const options = useMemo(() => {
    const items = categories.map((c) => formatCategoryOption(c));
    return allowAll ? [{ value: '', label: 'Semua Kategori' }, ...items] : items;
  }, [categories, allowAll]);

  const selected = useMemo(() => {
    if (allowAll && !value) return options[0] || null;
    return options.find((o) => String(o.value) === String(value)) || null;
  }, [options, value, allowAll]);

  return (
    <div className={`flex gap-2 ${className}`}>
      <div className="min-w-0 flex-1">
        <Select
          options={options}
          value={selected}
          onChange={(opt) => onChange(opt ? String(opt.value) : '')}
          placeholder={placeholder}
          isClearable={isClearable}
          styles={selectStyles}
          menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
          menuPosition="fixed"
          noOptionsMessage={() => 'Kategori tidak ditemukan'}
        />
      </div>
      {onManage && (
        <button
          type="button"
          onClick={onManage}
          className="btn-secondary shrink-0 px-3"
          title="Kelola kategori"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
