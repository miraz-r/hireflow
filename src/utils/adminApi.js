import api from './api';

// Admin endpoints. Unlike the public job catalogue, admin data is never
// replaced with mock/fallback content. If the platform stats endpoint fails,
// the Overview shows an explicit error state instead of inventing numbers.
export async function getAdminStats() {
  const res = await api.get('/admin');
  return res.data;
}

// Per-day application volume over the trailing window (default 30 days).
// The backend returns every calendar day in the window (zero-count days
// included) so the chart stays chronological and never invents gaps.
export async function getApplicationsTrend(days = 30) {
  const res = await api.get('/admin/applications/trend', {
    params: { days },
  });
  return res.data;
}

// Most recent applications (default: first page, 8 rows). The backend sorts
// by createdAt desc and returns derived display fields (applicant, job,
// company, status, applied date) for the Overview's Recent Applications table.
export async function getRecentApplications(page = 1, limit = 8) {
  const res = await api.get('/admin/applications', {
    params: { page, limit },
  });
  return res.data;
}

// Recent-activity feed (default 8 items) derived from existing data
// (application creation + job creation/update timestamps). No dedicated
// audit-log model exists; the feed is computed on demand from stored data.
export async function getRecentActivity(limit = 8) {
  const res = await api.get('/admin/activity', {
    params: { limit },
  });
  return res.data;
}

// Jobs workspace. The backend normalizes every job into the admin shape with
// derived display fields (applications count, posting recruiter profile) and
// treats missing legacy statuses as 'active'. Filters combine: q (title /
// company / recruiter name), status (active|pending|closed|draft), employment
// type, and how far back `postedDays` goes (1 = today).
export async function getAdminJobs({
  page = 1,
  limit = 10,
  q = '',
  status = 'all',
  employmentType = 'all',
  postedDays = '',
} = {}) {
  const params = { page, limit };
  if (q && q.trim()) params.q = q.trim();
  if (status && status !== 'all') params.status = status;
  if (employmentType && employmentType !== 'all') params.employmentType = employmentType;
  if (postedDays) params.postedDays = postedDays;
  const res = await api.get('/admin/jobs', { params });
  return res.data;
}

// Full admin view of one job (application count + posting recruiter) for the
// detail panel. Independent of the list fetch so the page can deep-link to a
// job id or refresh a single panel after a status change.
export async function getAdminJob(id) {
  const res = await api.get(`/admin/jobs/${id}`);
  return res.data;
}

// Non-destructive moderation: status is one of active | pending | closed |
// draft. Closing stamps closedAt; any other value clears it so re-opening
// a job never leaves a stale timestamp behind. Returns the updated job.
export async function updateAdminJobStatus(id, status) {
  const res = await api.patch(`/admin/jobs/${id}/status`, { status });
  return res.data;
}
