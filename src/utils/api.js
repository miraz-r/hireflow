import axios from 'axios';

// Production builds must point at a real API, never a developer's localhost.
// In dev (vite serve), falling back to the local API keeps things convenient.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
if (import.meta.env.PROD && !API_BASE_URL) {
  throw new Error(
    'VITE_API_BASE_URL is required for production builds. Set it to the deployed API URL, e.g. https://api.yourdomain.com/api'
  );
}

const api = axios.create({
  baseURL: API_BASE_URL || 'http://localhost:5000/api',
  timeout: 10000,
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
      // Server responded with a non-2xx status - normalize it.
      const { status, data } = error.response;
      const normalized = new Error(data?.error || 'An unexpected error occurred');
      normalized.status = status;
      normalized.data = data;
      return Promise.reject(normalized);
    }
    // Network or request-level failure - surface as-is.
    return Promise.reject(error);
  }
);

export const apiGet = (url, config) => api.get(url, config);
export const apiPost = (url, data, config) => api.post(url, data, config);
export const apiPatch = (url, data, config) => api.patch(url, data, config);
export const apiDelete = (url, config) => api.delete(url, config);

/**
 * Multipart upload helper. The instance defaults to `application/json`, but
 * axios must let the browser set the `multipart/form-data` boundary. Passing an
 * explicit `multipart/form-data` header makes axios fill in the boundary.
 */
export const apiUpload = (url, formData) =>
  api.post(url, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 20000,
  });

// Fetch a protected file (e.g. a resume) as an object URL using the shared
// authenticated client, then hand it to the caller for preview/download.
export const apiFetchBlobUrl = async (url) => {
  const res = await api.get(url, { responseType: 'blob' });
  return URL.createObjectURL(res.data);
};

export default api;
