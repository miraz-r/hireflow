import api from './api';

// Admin endpoints. Unlike the public job catalogue, admin data is never
// replaced with mock/fallback content.
export async function getAdminStats() {
  const res = await api.get('/admin');
  return res.data;
}