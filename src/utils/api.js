import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT from localStorage on every outgoing request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalize all error responses so callers get a predictable shape.
// Preserves HTTP status, backend `error` message, and validation errors.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with a non-2xx status — normalize it.
      const { status, data } = error.response;
      const normalized = new Error(data?.error || 'An unexpected error occurred');
      normalized.status = status;
      normalized.data = data;
      return Promise.reject(normalized);
    }
    // Network or request-level failure — surface as-is.
    return Promise.reject(error);
  }
);

export const apiGet = (url, config) => api.get(url, config);
export const apiPost = (url, data, config) => api.post(url, data, config);
export const apiPut = (url, data, config) => api.put(url, data, config);
export const apiPatch = (url, data, config) => api.patch(url, data, config);
export const apiDelete = (url, config) => api.delete(url, config);

export default api;
