/**
 * Path route API (relatif ke base URL di utils/config.js)
 * Full URL: {API_BASE_URL}/api{path}
 * Contoh: https://api.kingcreativestudio.my.id/rental-gaun/api/products
 */
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    PROFILE: '/auth/profile',
    UPDATE_PROFILE: '/auth/profile',
  },
  DASHBOARD: '/dashboard',
  CATEGORIES: {
    LIST: '/categories',
    ALL: '/categories/all',
    DETAIL: (id) => `/categories/${id}`,
  },
  PRODUCTS: {
    LIST: '/products',
    DETAIL: (id) => `/products/${id}`,
    MAIN_IMAGE: (id) => `/products/${id}/main-image`,
    GALLERY_IMAGE: (id, imageId) => `/products/${id}/images/${imageId}`,
  },
  CUSTOMERS: {
    LIST: '/customers',
    DETAIL: (id) => `/customers/${id}`,
  },
  BOOKINGS: {
    LIST: '/bookings',
    DETAIL: (id) => `/bookings/${id}`,
    CANCEL: (id) => `/bookings/${id}/cancel`,
    PICKUP: (id) => `/bookings/${id}/pickup`,
    RETURN: (id) => `/bookings/${id}/return`,
    WHATSAPP: (id) => `/bookings/${id}/whatsapp`,
  },
  KEEPS: {
    LIST: '/keeps',
    CANCEL: (id) => `/keeps/${id}/cancel`,
  },
  PAYMENTS: {
    LIST: '/payments',
  },
  AVAILABILITY: {
    CHECK: '/availability/check',
  },
  CALENDAR: '/calendar',
  REPORTS: '/reports',
  NOTIFICATIONS: {
    LIST: '/notifications',
    READ: (id) => `/notifications/${id}/read`,
    READ_ALL: '/notifications/read-all',
  },
  SETTINGS: '/settings',
};
