import AsyncSelect from 'react-select/async';
import { components } from 'react-select';
import { get } from '@/utils/request';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatCurrency, getAssetUrl } from '@/utils/helpers';

export const formatProductOption = (product) => ({
  value: product.id,
  label: `${product.code} - ${product.name}`,
  product,
});

export const loadProductOptions = async (inputValue) => {
  try {
    const res = await get(API_ENDPOINTS.PRODUCTS.LIST, {
      search: inputValue || undefined,
      limit: 20,
      is_active: true,
    });
    return res.success ? res.data.map(formatProductOption) : [];
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

function ProductImage({ src, className }) {
  if (!src) {
    return (
      <div className={`${className} flex shrink-0 items-center justify-center bg-slate-100 text-xs text-slate-400`}>
        —
      </div>
    );
  }
  return <img src={getAssetUrl(src)} alt="" className={`${className} shrink-0 object-cover`} />;
}

function ProductOption(props) {
  const { product } = props.data;
  return (
    <components.Option {...props}>
      <div className="flex items-center gap-3 py-0.5">
        <ProductImage src={product.main_image} className="h-10 w-10 rounded-lg" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{product.name}</p>
          <p className="text-xs text-slate-500">
            {product.code} · {formatCurrency(product.rent_price)}
            {product.category_name ? ` · ${product.category_name}` : ''}
          </p>
        </div>
      </div>
    </components.Option>
  );
}

function ProductSingleValue(props) {
  return (
    <components.SingleValue {...props}>
      <div className="flex items-center gap-2">
        <ProductImage src={props.data.product.main_image} className="h-6 w-6 rounded" />
        <span className="truncate">{props.data.label}</span>
      </div>
    </components.SingleValue>
  );
}

export default function ProductSelect({ value, onChange, placeholder = 'Cari nama atau kode barang...' }) {
  return (
    <AsyncSelect
      cacheOptions
      defaultOptions
      loadOptions={loadProductOptions}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      isClearable
      components={{ Option: ProductOption, SingleValue: ProductSingleValue }}
      styles={selectStyles}
      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
      menuPosition="fixed"
      noOptionsMessage={({ inputValue }) => (inputValue ? 'Barang tidak ditemukan' : 'Ketik untuk mencari barang')}
      loadingMessage={() => 'Mencari barang...'}
    />
  );
}
