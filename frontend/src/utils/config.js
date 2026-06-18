/** Base URL API tanpa trailing slash */
export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'https://api.kingcreativestudio.my.id/rental-gaun'
).replace(/\/$/, '');

/** Prefix route API backend */
export const API_PREFIX = '/api';

/** Full base URL untuk axios: {BASE}/api */
export const getApiBaseUrl = () => `${API_BASE_URL}${API_PREFIX}`;

/** Resolve path upload relatif (/uploads/...) ke URL absolut */
export const getAssetUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};
