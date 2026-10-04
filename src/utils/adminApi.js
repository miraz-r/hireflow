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
// (application creation, job creation/update, and account registration
// timestamps). No dedicated audit-log model exists; the feed is computed on
// demand from stored data.
//
// The single-argument form is kept for the Overview and Analytics callers, which
// only need the newest N events and predate pagination.
export async function getRecentActivity(limit = 8) {
  const res = await api.get('/admin/activity', {
    params: { limit },
  });
  return res.data;
}

// The Admin Activity workspace feed: a page of the merged event stream.
//
// Type filtering and paging run on the server, so the page holds no second
// copy of the feed to filter locally and the footer counts are real totals.
// `type` is one of the canonical event types or 'all'.
export async function getAdminActivity({
  page = 1,
  limit = 10,
  type = 'all',
} = {}) {
  const params = { page, limit };
  if (type && type !== 'all') params.type = type;
  const res = await api.get('/admin/activity', { params });
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

// ---------------------------------------------------------------------------
// Admin Applications workspace.
//
// Listing, single-application detail, and status moderation. Filtering, paging,
// and search all happen on the server, so the page holds no second copy of the
// list to filter locally.
//
// `status` values are the canonical backend pipeline states (applied,
// under-review, interview, offer, hired, rejected). The admin display labels
// come from ADMIN_STATUS_LABELS in src/constants/applicationStatus.js — the
// backend never sees an admin-only status.
// ---------------------------------------------------------------------------

export async function getAdminApplications({
  page = 1,
  limit = 10,
  q = '',
  status = 'all',
  job = 'all',
  recruiter = 'all',
  dateRange = '',
} = {}) {
  const params = { page, limit };
  if (q && q.trim()) params.q = q.trim();
  if (status && status !== 'all') params.status = status;
  if (job && job !== 'all') params.job = job;
  if (recruiter && recruiter !== 'all') params.recruiter = recruiter;
  if (dateRange) params.dateRange = dateRange;
  const res = await api.get('/admin/applications', { params });
  return res.data;
}

// Full detail for the workspace side panel: applicant contact details, the job,
// the posting recruiter, cover letter, and the real resumeUrl. The resumeUrl is
// a path served by the API's static /uploads mount; resolve it with
// resolveMediaUrl() before opening or downloading it.
export async function getAdminApplication(id) {
  const res = await api.get(`/admin/applications/${id}`);
  return res.data;
}

// Admin moderation of an application's pipeline status. `status` must be a
// canonical value; the backend rejects anything else. Returns the normalized
// application so the caller can replace the row it is editing.
export async function updateAdminApplicationStatus(id, status) {
  const res = await api.patch(`/admin/applications/${id}/status`, { status });
  return res.data;
}

// An applicant's full profile, for the "View Profile" action. `userId` is the
// applicant's account id (Application.userId), not an application id.
// Always returns the JOBSEEKER workspace profile, independently of whichever
// workspace the account is currently active in.
export async function getAdminJobseeker(userId) {
  const res = await api.get(`/admin/jobseekers/${userId}`);
  return res.data;
}

// The Admin Jobseekers workspace list. Search, location, date range, ordering
// and paging all happen on the server, so the page holds no second copy of the
// list to filter locally.
//
// Sourced from each account's jobseeker workspace profile, so a person whose
// account is currently active in the recruiter workspace still appears, with
// `activeWorkspace` telling the admin which workspace they are in.
//
// There is deliberately no `status` filter: the User model has no status field,
// so no activity state can be reported without inventing one.
export async function getAdminJobseekers({
  page = 1,
  limit = 10,
  q = '',
  location = 'all',
  dateRange = '',
} = {}) {
  const params = { page, limit };
  if (q && q.trim()) params.q = q.trim();
  if (location && location !== 'all') params.location = location;
  if (dateRange) params.dateRange = dateRange;
  const res = await api.get('/admin/jobseekers', { params });
  return res.data;
}

// The Admin Recruiters workspace list. Search, company, date range, ordering,
// and paging all happen on the server, so the page holds no second copy of the
// list to filter locally.
//
// Sourced from each account's recruiter workspace profile, so a person whose
// account is currently active in the jobseeker workspace still appears, with
// `activeWorkspace` telling the admin which workspace they are in.
//
// There is deliberately no `status` filter: the User model has no status field,
// so no activity state can be reported without inventing one.
export async function getAdminRecruiters({
  page = 1,
  limit = 10,
  q = '',
  company = 'all',
  dateRange = '',
} = {}) {
  const params = { page, limit };
  if (q && q.trim()) params.q = q.trim();
  if (company && company !== 'all') params.company = company;
  if (dateRange) params.dateRange = dateRange;
  const res = await api.get('/admin/recruiters', { params });
  return res.data;
}

// The Admin Companies workspace list. Search, date range, ordering, and paging
// all happen on the server, so the page holds no second copy of the list to
// filter locally.
//
// There is deliberately no `status`, `industry`, or `domain` filter: no company
// record exists to hold any of them, so filtering on them could only match
// invented values.
//
// Derived data, not a company record: companies are grouped from the
// free-text companyName on recruiter profiles, grouped and matched exactly as
// typed so "Acme Corp" and "acme corp" stay distinct. `jobs` counts listings
// whose own `company` is that name — never "jobs this company's recruiters
// posted", which would credit a company for other employers' work.
export async function getAdminCompanies({
  page = 1,
  limit = 10,
  q = '',
  dateRange = '',
} = {}) {
  const params = { page, limit };
  if (q && q.trim()) params.q = q.trim();
  if (dateRange) params.dateRange = dateRange;
  const res = await api.get('/admin/companies', { params });
  return res.data;
}

// The Admin Analytics report for one period.
//
// The window is built and aggregated server-side, so the totals, the trend
// series and the breakdowns all describe the same period and cannot disagree.
// The response also carries the immediately preceding period, so the KPI
// comparisons are computed from real totals rather than authored.
//
// `range` is '7' | '30' | '90' | 'year'. A KPI's `change` is the percentage
// against the previous period, or null when there was no previous value to
// compare against - never NaN or Infinity.
export async function getAdminAnalytics({ range = '30' } = {}) {
  const res = await api.get('/admin/analytics', { params: { range } });
  return res.data;
}
