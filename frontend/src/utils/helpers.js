export const formatCurrency = (value) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);

export { getAssetUrl } from './config';

export const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export const toInputDate = (date) => {
  if (!date) return '';
  return new Date(date).toISOString().split('T')[0];
};

export const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Terjadi kesalahan';

export const BOOKING_STATUS = {
  KEEP: { label: 'Keep', color: 'bg-yellow-100 text-yellow-800' },
  DP: { label: 'DP', color: 'bg-blue-100 text-blue-800' },
  LUNAS: { label: 'Lunas', color: 'bg-green-100 text-green-800' },
  SEDANG_DISEWA: { label: 'Sedang Disewa', color: 'bg-purple-100 text-purple-800' },
  SELESAI: { label: 'Selesai', color: 'bg-slate-100 text-slate-600' },
  BATAL: { label: 'Batal', color: 'bg-red-100 text-red-800' },
};

export const KEEP_STATUS = {
  KEEP: { label: 'Keep', color: 'bg-yellow-100 text-yellow-800' },
  EXPIRED: { label: 'Expired', color: 'bg-slate-100 text-slate-600' },
  CANCEL: { label: 'Cancel', color: 'bg-red-100 text-red-800' },
};

export const CUSTOMER_STATUS = {
  BARU: { label: 'Baru', color: 'bg-blue-100 text-blue-800' },
  AKTIF: { label: 'Aktif', color: 'bg-green-100 text-green-800' },
  PELANGGAN_TETAP: { label: 'Pelanggan Tetap', color: 'bg-purple-100 text-purple-800' },
  BLACKLIST: { label: 'Blacklist', color: 'bg-red-100 text-red-800' },
};

export const PAYMENT_METHODS = ['CASH', 'TRANSFER', 'QRIS'];
