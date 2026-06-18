import { api } from './api';

export const get = async (endpoint, params = {}) => {
  const { data } = await api.get(endpoint, { params });
  return data;
};

export const post = async (endpoint, body = {}, config = {}) => {
  const { data } = await api.post(endpoint, body, config);
  return data;
};

export const put = async (endpoint, body = {}, config = {}) => {
  const { data } = await api.put(endpoint, body, config);
  return data;
};

export const del = async (endpoint) => {
  const { data } = await api.delete(endpoint);
  return data;
};

export const upload = async (endpoint, formData, method = 'post') => {
  const fn = method === 'put' ? api.put : api.post;
  const { data } = await fn(endpoint, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};
