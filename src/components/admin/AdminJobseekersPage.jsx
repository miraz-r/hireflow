import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Select from '../ui/Select';
import Toast from '../Toast';
import Avatar from '../Avatar';
import { avatarFallback } from '../../lib/media';
import './AdminJobseekersPage.css';

const PAGE_SIZE = 10;

// Same dot + soft tint badge language as the other Admin sections; the three
// tones are reused from the existing Applications/Recruiters palette so no new
// status color is introduced here.
const STATUS_META = {
  active: { label: 'Active', tone: 'active' },
  inactive: { label: 'Inactive', tone: 'inactive' },
  suspended: { label: 'Suspended', tone: 'suspended' },
};
const STATUS_OPTIONS = Object.keys(STATUS_META);

const DATE_OPTIONS = [
  { value: '', label: 'Any date' },
  { value: 'today', label: 'Today' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

const SEARCH_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const X_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CHECK_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const MORE_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </svg>
);

const ARROW_LEFT = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ARROW_RIGHT = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

// UI mock data for now: there is no admin jobseekers endpoint yet and backend
// changes are out of scope for this phase. Names are picked from the shared
// DEMO_PORTRAITS list so the shared Avatar resolves a real photo for each of
// them, and joined dates are fixed so the date filter can still compare them
// against today.
// Application status vocabulary for the panel's recent list, reusing the same
// labels/tones the Admin Applications page already renders.
const APPLICATION_STATUS_META = {
  new: { label: 'New', tone: 'new' },
  reviewing: { label: 'Reviewing', tone: 'reviewing' },
  shortlisted: { label: 'Shortlisted', tone: 'shortlisted' },
  interview: { label: 'Interview', tone: 'interview' },
  rejected: { label: 'Rejected', tone: 'rejected' },
  hired: { label: 'Hired', tone: 'hired' },
};

const MOCK_JOBSEEKERS = [
  { id: '1', name: 'Aisha Khan', email: 'aisha.khan@gmail.com', phone: '+1 (917) 555-0142', location: 'New York, NY', status: 'active', applications: 24, savedJobs: 11, joinedAt: '2026-09-01T10:00:00.000Z' },
  { id: '2', name: 'Marcus Chen', email: 'marcus.chen@outlook.com', phone: '+1 (415) 555-0164', location: 'San Francisco, CA', status: 'active', applications: 18, savedJobs: 7, joinedAt: '2026-09-05T10:00:00.000Z' },
  { id: '3', name: 'Sofia Ramirez', email: 'sofia.ramirez@gmail.com', phone: '+1 (512) 555-0127', location: 'Austin, TX', status: 'inactive', applications: 6, savedJobs: 3, joinedAt: '2026-09-12T10:00:00.000Z' },
  { id: '4', name: 'David Okafor', email: 'david.okafor@yahoo.com', phone: '+1 (206) 555-0183', location: 'Seattle, WA', status: 'active', applications: 31, savedJobs: 15, joinedAt: '2026-09-18T10:00:00.000Z' },
  { id: '5', name: 'Priya Sharma', email: 'priya.sharma@gmail.com', phone: '+1 (312) 555-0158', location: 'Chicago, IL', status: 'active', applications: 12, savedJobs: 9, joinedAt: '2026-09-23T10:00:00.000Z' },
  { id: '6', name: 'Lucas Meyer', email: 'lucas.meyer@outlook.com', phone: '+1 (617) 555-0136', location: 'Boston, MA', status: 'suspended', applications: 9, savedJobs: 2, joinedAt: '2026-08-30T10:00:00.000Z' },
  { id: '7', name: 'Natalia Reyes', email: 'natalia.reyes@gmail.com', phone: '+1 (305) 555-0171', location: 'Miami, FL', status: 'active', applications: 27, savedJobs: 13, joinedAt: '2026-08-14T10:00:00.000Z' },
  { id: '8', name: 'James Rodriguez', email: 'james.rodriguez@yahoo.com', phone: '+1 (303) 555-0149', location: 'Denver, CO', status: 'inactive', applications: 4, savedJobs: 1, joinedAt: '2026-08-02T10:00:00.000Z' },
  { id: '9', name: 'Grace Liu', email: 'grace.liu@gmail.com', phone: '+1 (213) 555-0122', location: 'Los Angeles, CA', status: 'active', applications: 22, savedJobs: 18, joinedAt: '2026-07-21T10:00:00.000Z' },
  { id: '10', name: 'Tom Becker', email: 'tom.becker@outlook.com', phone: '+1 (646) 555-0193', location: 'New York, NY', status: 'active', applications: 15, savedJobs: 6, joinedAt: '2026-07-09T10:00:00.000Z' },
  { id: '11', name: 'Maya Singh', email: 'maya.singh@gmail.com', phone: '+1 (628) 555-0157', location: 'San Francisco, CA', status: 'active', applications: 29, savedJobs: 12, joinedAt: '2026-06-25T10:00:00.000Z' },
  { id: '12', name: 'Jordan Fields', email: 'jordan.fields@yahoo.com', phone: '+1 (503) 555-0118', location: 'Portland, OR', status: 'inactive', applications: 7, savedJobs: 4, joinedAt: '2026-06-11T10:00:00.000Z' },
  { id: '13', name: 'Nina Petrova', email: 'nina.petrova@gmail.com', phone: '+1 (617) 555-0166', location: 'Boston, MA', status: 'active', applications: 19, savedJobs: 8, joinedAt: '2026-05-28T10:00:00.000Z' },
  { id: '14', name: 'Oliver Smith', email: 'oliver.smith@outlook.com', phone: '+1 (312) 555-0198', location: 'Chicago, IL', status: 'suspended', applications: 11, savedJobs: 5, joinedAt: '2026-05-06T10:00:00.000Z' },
  { id: '15', name: 'Fatima Noor', email: 'fatima.noor@gmail.com', phone: '+1 (512) 555-0175', location: 'Austin, TX', status: 'active', applications: 26, savedJobs: 10, joinedAt: '2026-04-22T10:00:00.000Z' },
  { id: '16', name: 'Ryan O Connor', email: 'ryan.oconnor@yahoo.com', phone: '+1 (206) 555-0131', location: 'Seattle, WA', status: 'active', applications: 14, savedJobs: 6, joinedAt: '2026-04-03T10:00:00.000Z' },
  { id: '17', name: 'Emily Davis', email: 'emily.davis@gmail.com', phone: '+1 (303) 555-0162', location: 'Denver, CO', status: 'active', applications: 33, savedJobs: 21, joinedAt: '2026-03-19T10:00:00.000Z' },
  { id: '18', name: 'Michael Chen', email: 'michael.chen@outlook.com', phone: '+1 (213) 555-0184', location: 'Los Angeles, CA', status: 'inactive', applications: 8, savedJobs: 3, joinedAt: '2026-02-27T10:00:00.000Z' },
  { id: '19', name: 'Isabella Rossi', email: 'isabella.rossi@gmail.com', phone: '+1 (305) 555-0115', location: 'Miami, FL', status: 'active', applications: 21, savedJobs: 14, joinedAt: '2026-01-15T10:00:00.000Z' },
  { id: '20', name: 'Marcus Hill', email: 'marcus.hill@yahoo.com', phone: '+1 (503) 555-0177', location: 'Portland, OR', status: 'active', applications: 16, savedJobs: 9, joinedAt: '2025-12-08T10:00:00.000Z' },
  { id: '21', name: 'Sarah Johnson', email: 'sarah.johnson@gmail.com', phone: '+1 (212) 555-0129', location: 'New York, NY', status: 'suspended', applications: 10, savedJobs: 2, joinedAt: '2025-11-14T10:00:00.000Z' },
  { id: '22', name: 'Zoe Carter', email: 'zoe.carter@outlook.com', phone: '+1 (415) 555-0146', location: 'San Francisco, CA', status: 'active', applications: 25, savedJobs: 17, joinedAt: '2025-10-02T10:00:00.000Z' },
  { id: '23', name: 'Daniel Lopez', email: 'daniel.lopez@gmail.com', phone: '+1 (312) 555-0188', location: 'Chicago, IL', status: 'active', applications: 13, savedJobs: 5, joinedAt: '2025-08-19T10:00:00.000Z' },
  { id: '24', name: 'Priya Patel', email: 'priya.patel@yahoo.com', phone: '+1 (512) 555-0139', location: 'Austin, TX', status: 'inactive', applications: 5, savedJobs: 2, joinedAt: '2025-06-25T10:00:00.000Z' },
];

// Recent applications shown in the detail panel. Kept beside the records rather
// than inside them so the table rows stay scannable - same split the Recruiters
// page uses for its company extras.
const MOCK_RECENT_APPLICATIONS = {
  '1': [
    { job: 'Senior Frontend Engineer', company: 'Stark Industries', status: 'interview' },
    { job: 'Product Designer', company: 'LexCorp', status: 'shortlisted' },
    { job: 'UI/UX Designer', company: 'OmniCorp', status: 'new' },
  ],
  '2': [
    { job: 'Backend Engineer', company: 'Aperture Science', status: 'reviewing' },
    { job: 'DevOps Engineer', company: 'Stark Industries', status: 'new' },
  ],
  '3': [
    { job: 'Marketing Manager', company: 'OmniCorp', status: 'rejected' },
  ],
  '4': [
    { job: 'Data Analyst', company: 'Aperture Science', status: 'hired' },
    { job: 'Business Analyst', company: 'LexCorp', status: 'shortlisted' },
  ],
  '5': [
    { job: 'Customer Success Manager', company: 'Stark Industries', status: 'reviewing' },
    { job: 'QA Engineer', company: 'Umbrella Corp.', status: 'new' },
    { job: 'Product Designer', company: 'OmniCorp', status: 'rejected' },
  ],
  '6': [
    { job: 'Mobile Engineer', company: 'Umbrella Corp.', status: 'new' },
  ],
  '7': [
    { job: 'Account Executive', company: 'LexCorp', status: 'interview' },
    { job: 'Marketing Manager', company: 'Stark Industries', status: 'reviewing' },
  ],
  '8': [
    { job: 'Business Analyst', company: 'OmniCorp', status: 'rejected' },
  ],
  '9': [
    { job: 'UI/UX Designer', company: 'OmniCorp', status: 'hired' },
    { job: 'Senior Frontend Engineer', company: 'LexCorp', status: 'shortlisted' },
    { job: 'Product Designer', company: 'Aperture Science', status: 'interview' },
  ],
  '10': [
    { job: 'Data Analyst', company: 'Stark Industries', status: 'reviewing' },
    { job: 'QA Engineer', company: 'LexCorp', status: 'new' },
  ],
  '11': [
    { job: 'Senior Frontend Engineer', company: 'Aperture Science', status: 'interview' },
    { job: 'Backend Engineer', company: 'Stark Industries', status: 'shortlisted' },
  ],
  '12': [
    { job: 'QA Engineer', company: 'OmniCorp', status: 'reviewing' },
  ],
  '13': [
    { job: 'Product Designer', company: 'Aperture Science', status: 'new' },
    { job: 'Marketing Manager', company: 'LexCorp', status: 'rejected' },
    { job: 'Business Analyst', company: 'Stark Industries', status: 'shortlisted' },
  ],
  '14': [
    { job: 'Backend Engineer', company: 'Umbrella Corp.', status: 'rejected' },
    { job: 'DevOps Engineer', company: 'Stark Industries', status: 'reviewing' },
  ],
  '15': [
    { job: 'Customer Success Manager', company: 'Aperture Science', status: 'interview' },
    { job: 'Data Analyst', company: 'Stark Industries', status: 'new' },
  ],
  '16': [
    { job: 'Mobile Engineer', company: 'LexCorp', status: 'hired' },
    { job: 'QA Engineer', company: 'Stark Industries', status: 'shortlisted' },
  ],
  '17': [
    { job: 'Senior Frontend Engineer', company: 'Stark Industries', status: 'hired' },
    { job: 'Data Analyst', company: 'Aperture Science', status: 'interview' },
    { job: 'Business Analyst', company: 'OmniCorp', status: 'shortlisted' },
  ],
  '18': [
    { job: 'DevOps Engineer', company: 'OmniCorp', status: 'reviewing' },
  ],
  '19': [
    { job: 'UI/UX Designer', company: 'LexCorp', status: 'interview' },
    { job: 'Product Designer', company: 'Stark Industries', status: 'new' },
  ],
  '20': [
    { job: 'Account Executive', company: 'Aperture Science', status: 'shortlisted' },
    { job: 'Marketing Manager', company: 'OmniCorp', status: 'reviewing' },
  ],
  '21': [
    { job: 'Customer Success Manager', company: 'LexCorp', status: 'rejected' },
  ],
  '22': [
    { job: 'Senior Frontend Engineer', company: 'Aperture Science', status: 'shortlisted' },
    { job: 'UI/UX Designer', company: 'Stark Industries', status: 'interview' },
  ],
  '23': [
    { job: 'Backend Engineer', company: 'Stark Industries', status: 'new' },
    { job: 'Mobile Engineer', company: 'OmniCorp', status: 'reviewing' },
  ],
  '24': [
    { job: 'QA Engineer', company: 'Aperture Science', status: 'rejected' },
  ],
};

const formatJoinedDate = (iso) => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getPageItems = (page, totalPages) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items = [1];
  const lo = Math.max(2, page - 1);
  const hi = Math.min(totalPages - 1, page + 1);
  if (lo > 2) items.push('…');
  for (let p = lo; p <= hi; p += 1) items.push(p);
  if (hi < totalPages - 1) items.push('…');
  items.push(totalPages);
  return items;
};

/**
 * AdminJobseekersPage - the /admin/jobseekers workspace.
 *
 * Lists jobseekers with local search (name/email) plus status, location, and
 * date filters, explicit selected-row state, a compact row action menu, and
 * URL-backed pagination. Nothing is auto-selected: the panel keeps its empty
 * state until the user clicks a row. Data is UI mock data for now, so status
 * changes stay local for the current session.
 */
export default function AdminJobseekersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [jobseekers, setJobseekers] = useState(MOCK_JOBSEEKERS);
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [dateRange, setDateRange] = useState('');

  // The current page lives in the URL (?page=N) so a browser refresh or a
  // Back/Forward step restores the exact page instead of falling back to 1.
  // Anything but a positive whole number is treated as page 1.
  const pageParam = Number.parseInt(searchParams.get('page') || '', 10);
  const pageInvalid = !(Number.isInteger(pageParam) && pageParam > 0);
  const page = pageInvalid ? 1 : pageParam;

  const goToPage = useCallback(
    (next, { replace = false } = {}) => {
      const clamped = Math.max(1, Number.isInteger(next) ? next : 1);
      const params = new URLSearchParams(searchParams);
      if (clamped <= 1) params.delete('page');
      else params.set('page', String(clamped));
      if (params.toString() === searchParams.toString()) return;
      setSearchParams(params, { replace });
    },
    [searchParams, setSearchParams]
  );

  const [selectedId, setSelectedId] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3200);
  }, []);

  // Any filter or search change jumps back to page 1 and clears the selection
  // so it never points at a row that left the visible page. Only reacts to an
  // actual filter change, so a refresh with ?page=N never drops the param.
  const prevFiltersRef = useRef(`${searchInput}|${status}|${locationFilter}|${dateRange}`);
  useEffect(() => {
    const filtersKey = `${searchInput}|${status}|${locationFilter}|${dateRange}`;
    if (filtersKey === prevFiltersRef.current) return;
    prevFiltersRef.current = filtersKey;
    setSelectedId(null);
    if (searchParams.has('page')) {
      const params = new URLSearchParams(searchParams);
      params.delete('page');
      setSearchParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, status, locationFilter, dateRange]);

  const uniqueLocations = useMemo(
    () => [...new Set(jobseekers.map((j) => j.location))].sort(),
    [jobseekers]
  );

  const filtered = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    return jobseekers.filter((j) => {
      if (status !== 'all' && j.status !== status) return false;
      if (locationFilter !== 'all' && j.location !== locationFilter) return false;
      if (dateRange) {
        const cutoff = new Date();
        if (dateRange === 'today') {
          cutoff.setHours(0, 0, 0, 0);
        } else {
          cutoff.setDate(cutoff.getDate() - Number(dateRange));
        }
        if (new Date(j.joinedAt) < cutoff) return false;
      }
      if (q) {
        const haystack = `${j.name} ${j.email}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [jobseekers, searchInput, status, locationFilter, dateRange]);

  const filtersActive = searchInput !== '' || status !== 'all' || locationFilter !== 'all' || dateRange !== '';

  const clearFilters = useCallback(() => {
    setSearchInput('');
    setStatus('all');
    setLocationFilter('all');
    setDateRange('');
  }, []);

  // Selection is deliberate only: a row is picked by clicking it, never by the
  // page loading or the result set changing.
  const selectJobseeker = useCallback((id) => {
    setSelectedId(id);
    setActiveMenuId(null);
  }, []);

  const changeStatus = useCallback(
    (id, nextStatus) => {
      setActiveMenuId(null);
      setJobseekers((prev) =>
        prev.map((j) => (j.id === id ? { ...j, status: nextStatus } : j))
      );
      const jobseeker = jobseekers.find((j) => j.id === id);
      if (jobseeker) {
        showToast(`“${jobseeker.name}” moved to ${STATUS_META[nextStatus].label.toLowerCase()} status`);
      }
    },
    [jobseekers, showToast]
  );

  // View Applications hands the selected person over to the existing Admin
  // Applications workspace, which seeds its search box from ?search= and so
  // already lists that person's applications. No new page and no extra state.
  const viewApplications = useCallback(
    (jobseeker) => {
      setActiveMenuId(null);
      navigate(`/admin/applications?search=${encodeURIComponent(jobseeker.name)}`);
    },
    [navigate]
  );

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const listStart = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const listEnd = Math.min(safePage * PAGE_SIZE, total);

  // An invalid or out-of-range ?page=N (e.g. after a refresh with stale data)
  // is repaired to a valid page instead of silently showing an empty one.
  useEffect(() => {
    if (pageInvalid) goToPage(1, { replace: true });
    else if (page > totalPages) goToPage(totalPages, { replace: true });
  }, [page, pageInvalid, totalPages, goToPage]);

  // Read the selection straight from the live list so a status change lands in
  // the table row on the same render.
  const selected =
    jobseekers.find((j) => String(j.id) === String(selectedId)) || null;

  return (
    <div className="admin-page admin-jobseekers">
      <section className="admin-jobseekers-card" aria-label="Jobseekers list">
        <div className="admin-jobseekers-toolbar">
          <div className="admin-jobseekers-search">
            <span className="admin-jobseekers-search-icon" aria-hidden="true">{SEARCH_ICON}</span>
            <input
              type="text"
              id="admin-jobseekers-search"
              name="search"
              className="admin-jobseekers-search-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search jobseekers..."
              aria-label="Search jobseekers"
            />
            {searchInput && (
              <button
                type="button"
                className="admin-jobseekers-search-clear"
                onClick={() => setSearchInput('')}
                aria-label="Clear search"
              >
                {X_ICON}
              </button>
            )}
          </div>

          <div className="admin-jobseekers-filter">
            <Select
              id="admin-jobseekers-status"
              name="status"
              className="admin-jobseekers-filter-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Status"
              options={[
                { value: 'all', label: 'All statuses' },
                ...STATUS_OPTIONS.map((value) => ({ value, label: STATUS_META[value].label })),
              ]}
            />
          </div>
          <div className="admin-jobseekers-filter">
            <Select
              id="admin-jobseekers-location"
              name="location"
              className="admin-jobseekers-filter-select"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              aria-label="Location"
              options={[{ value: 'all', label: 'Any location' }, ...uniqueLocations.map((name) => ({ value: name, label: name }))]}
            />
          </div>
          <div className="admin-jobseekers-filter">
            <Select
              id="admin-jobseekers-date"
              name="dateRange"
              className="admin-jobseekers-filter-select"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              aria-label="Date"
              options={DATE_OPTIONS}
            />
          </div>

          {filtersActive && (
            <button type="button" className="admin-jobseekers-clear" onClick={clearFilters}>
              {X_ICON}
              Clear filters
            </button>
          )}
        </div>

        <div className="admin-jobseekers-table-scroll">
          <table className="admin-jobseekers-table">
            <colgroup>
              <col className="admin-jobseekers-col-jobseeker" />
              <col className="admin-jobseekers-col-location" />
              <col className="admin-jobseekers-col-status" />
              <col className="admin-jobseekers-col-applications" />
              <col className="admin-jobseekers-col-saved" />
              <col className="admin-jobseekers-col-joined" />
              <col className="admin-jobseekers-col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th className="admin-jobseekers-col-jobseeker">Jobseeker</th>
                <th className="admin-jobseekers-col-location">Location</th>
                <th className="admin-jobseekers-col-status">Status</th>
                <th className="admin-jobseekers-col-applications">Applications</th>
                <th className="admin-jobseekers-col-saved">Saved Jobs</th>
                <th className="admin-jobseekers-col-joined">Joined</th>
                <th className="admin-jobseekers-col-actions">
                  <span className="admin-jobseekers-sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-jobseekers-state">
                    <span className="admin-jobseekers-state-title">No jobseekers found</span>
                    <span className="admin-jobseekers-state-text">
                      Try adjusting your search or filters.
                    </span>
                    {filtersActive && (
                      <button type="button" className="admin-jobseekers-btn" onClick={clearFilters}>
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                pageItems.map((jobseeker) => {
                  const meta = STATUS_META[jobseeker.status] || STATUS_META.active;
                  const isSelected = String(jobseeker.id) === String(selectedId);
                  return (
                    <tr
                      key={jobseeker.id}
                      className={`admin-jobseekers-row${isSelected ? ' admin-jobseekers-row--selected' : ''}`}
                      onClick={() => selectJobseeker(jobseeker.id)}
                    >
                      <td className="admin-jobseekers-col-jobseeker">
                        <span className="admin-jobseekers-person">
                          <Avatar
                            src={null}
                            fallbackSrc={avatarFallback(jobseeker.name, jobseeker.email)}
                            imgClassName="admin-jobseekers-avatar"
                            placeholderClassName="admin-jobseekers-avatar admin-jobseekers-avatar--initials"
                            imgAlt=""
                            iconSize={14}
                          />
                          <span className="admin-jobseekers-person-text">
                            <span className="admin-jobseekers-person-name">{jobseeker.name}</span>
                            <span className="admin-jobseekers-person-email">{jobseeker.email}</span>
                          </span>
                        </span>
                      </td>
                      <td className="admin-jobseekers-col-location">
                        <span className="admin-jobseekers-location">{jobseeker.location}</span>
                      </td>
                      <td className="admin-jobseekers-col-status">
                        <span className={`admin-jobseekers-badge admin-jobseekers-badge--${meta.tone}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="admin-jobseekers-col-applications">
                        <span className="admin-jobseekers-count">{jobseeker.applications}</span>
                      </td>
                      <td className="admin-jobseekers-col-saved">
                        <span className="admin-jobseekers-count">{jobseeker.savedJobs}</span>
                      </td>
                      <td className="admin-jobseekers-col-joined">
                        <span className="admin-jobseekers-date">{formatJoinedDate(jobseeker.joinedAt)}</span>
                      </td>
                      <td className="admin-jobseekers-col-actions" onClick={(e) => e.stopPropagation()}>
                        <RowMenu
                          jobseeker={jobseeker}
                          open={activeMenuId === String(jobseeker.id)}
                          onToggle={() =>
                            setActiveMenuId((prev) =>
                              prev === String(jobseeker.id) ? null : String(jobseeker.id)
                            )
                          }
                          onClose={() => setActiveMenuId(null)}
                          onChangeStatus={changeStatus}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <footer className="admin-jobseekers-footer">
          <p className="admin-jobseekers-footer-count">
            Showing <strong>{listStart}–{listEnd}</strong> of <strong>{total}</strong> jobseekers
          </p>
          {totalPages > 1 && (
            <nav className="admin-jobseekers-pagination" aria-label="Jobseekers pagination">
              <button
                type="button"
                className="admin-jobseekers-page-btn admin-jobseekers-page-btn--nav"
                onClick={() => goToPage(Math.max(1, page - 1))}
                disabled={safePage <= 1}
              >
                {ARROW_LEFT}
                Previous
              </button>
              {getPageItems(safePage, totalPages).map((item, index) =>
                item === '…' ? (
                  <span key={`gap-${index}`} className="admin-jobseekers-page-gap">
                    {item}
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    className={`admin-jobseekers-page-btn${item === safePage ? ' admin-jobseekers-page-btn--current' : ''}`}
                    onClick={() => goToPage(item)}
                    aria-label={`Go to page ${item}`}
                    aria-current={item === safePage ? 'page' : undefined}
                  >
                    {item}
                  </button>
                )
              )}
              <button
                type="button"
                className="admin-jobseekers-page-btn admin-jobseekers-page-btn--nav"
                onClick={() => goToPage(Math.min(totalPages, page + 1))}
                disabled={safePage >= totalPages}
              >
                Next
                {ARROW_RIGHT}
              </button>
            </nav>
          )}
        </footer>
      </section>

      <aside className="admin-jobseekers-panel" aria-label="Jobseeker details">
        {selected ? (
          <DetailPanel jobseeker={selected} onViewApplications={viewApplications} />
        ) : (
          <div className="admin-jobseekers-panel-state">
            <span className="admin-jobseekers-state-title">Select a jobseeker</span>
            <span className="admin-jobseekers-state-text">
              Choose a jobseeker from the list to view their details here.
            </span>
          </div>
        )}
      </aside>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Row action menu - compact three-dot menu portaled to <body>, anchored      */
/* near the trigger, closed on outside click / Escape / scroll / resize.     */
/* Change Status is the only entry: the selected row already opens the        */
/* person's details, so there is nothing else to offer here.                 */
/* ------------------------------------------------------------------------ */

function RowMenu({ jobseeker, open, onToggle, onClose, onChangeStatus }) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);
  const [statusView, setStatusView] = useState(false);

  useEffect(() => {
    if (!open) setStatusView(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e) => {
      const inMenu = menuRef.current?.contains(e.target);
      const inTrigger = triggerRef.current?.contains(e.target);
      if (!inMenu && !inTrigger) onClose();
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const anchorEl = triggerRef.current;
    const menuEl = menuRef.current;
    if (!anchorEl || !menuEl) return;

    const measure = () => {
      const a = anchorEl.getBoundingClientRect();
      const m = menuEl.getBoundingClientRect();
      const gap = 6;
      const spaceBelow = window.innerHeight - a.bottom;
      const spaceAbove = a.top;
      const openBelow = spaceBelow >= m.height + gap || spaceBelow >= spaceAbove;
      const top = openBelow ? a.bottom + gap : Math.max(gap, a.top - m.height - gap);
      const menuW = m.width || a.width;
      let left = a.left;
      if (left + menuW > window.innerWidth - gap) left = window.innerWidth - menuW - gap;
      if (left < gap) left = gap;
      setPos({ top, left });
    };

    measure();
    const closeOnScroll = () => onClose();
    window.addEventListener('resize', closeOnScroll);
    window.addEventListener('scroll', closeOnScroll, true);
    return () => {
      window.removeEventListener('resize', closeOnScroll);
      window.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [open, onClose]);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`admin-jobseekers-menu-btn${open ? ' admin-jobseekers-menu-btn--open' : ''}`}
        onClick={onToggle}
        aria-label={`Actions for ${jobseeker.name}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {MORE_ICON}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="admin-jobseekers-menu"
            role="menu"
            aria-label={`Actions for ${jobseeker.name}`}
            style={{
              ...(pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }),
              minWidth: 196,
            }}
          >
            {statusView ? (
              <>
                <div className="admin-jobseekers-menu-head">
                  <button
                    type="button"
                    className="admin-jobseekers-menu-subhead"
                    onClick={() => setStatusView(false)}
                    aria-label="Back"
                  >
                    {ARROW_LEFT}
                  </button>
                  <span className="admin-jobseekers-menu-label">Change status</span>
                </div>
                <div className="admin-jobseekers-menu-divider" />
                {STATUS_OPTIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={jobseeker.status === value}
                    className={`admin-jobseekers-menu-item${
                      jobseeker.status === value ? ' admin-jobseekers-menu-item--selected' : ''
                    }`}
                    onClick={() => onChangeStatus(jobseeker.id, value)}
                  >
                    <span className="admin-jobseekers-menu-check">
                      {jobseeker.status === value ? CHECK_ICON : null}
                    </span>
                    <span className="admin-jobseekers-menu-item-label">{STATUS_META[value].label}</span>
                  </button>
                ))}
              </>
            ) : (
              <button
                type="button"
                role="menuitem"
                className="admin-jobseekers-menu-item"
                onClick={() => setStatusView(true)}
              >
                <span className="admin-jobseekers-menu-check" />
                <span className="admin-jobseekers-menu-item-label">Change Status</span>
                <span className="admin-jobseekers-menu-chevron" aria-hidden="true">{ARROW_RIGHT}</span>
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* Right-side detail panel - contextual inspector for the selected jobseeker. */
/* Header stays free of a status badge: the status belongs to the table row    */
/* and to the row's Change Status menu, so repeating it here would be noise.   */
/* ------------------------------------------------------------------------ */

function DetailPanel({ jobseeker, onViewApplications }) {
  const recent = MOCK_RECENT_APPLICATIONS[String(jobseeker.id)] || [];

  return (
    <div className="admin-jobseekers-detail">
      <header className="admin-jobseekers-detail-head">
        <Avatar
          src={null}
          fallbackSrc={avatarFallback(jobseeker.name, jobseeker.email)}
          imgClassName="admin-jobseekers-avatar admin-jobseekers-detail-avatar"
          placeholderClassName="admin-jobseekers-avatar admin-jobseekers-avatar--initials admin-jobseekers-detail-avatar"
          imgAlt=""
          iconSize={16}
        />
        <div className="admin-jobseekers-detail-titles">
          <h2 className="admin-jobseekers-detail-name">{jobseeker.name}</h2>
          <p className="admin-jobseekers-detail-email">{jobseeker.email}</p>
          <p className="admin-jobseekers-detail-location">{jobseeker.location}</p>
        </div>
      </header>

      <section className="admin-jobseekers-detail-section">
        <h3 className="admin-jobseekers-detail-sub">Profile</h3>
        <dl className="admin-jobseekers-detail-list">
          <div className="admin-jobseekers-detail-row">
            <dt>Full name</dt>
            <dd>{jobseeker.name}</dd>
          </div>
          <div className="admin-jobseekers-detail-row">
            <dt>Email</dt>
            <dd>{jobseeker.email}</dd>
          </div>
          <div className="admin-jobseekers-detail-row">
            <dt>Phone</dt>
            <dd>{jobseeker.phone}</dd>
          </div>
          <div className="admin-jobseekers-detail-row">
            <dt>Location</dt>
            <dd>{jobseeker.location}</dd>
          </div>
        </dl>
      </section>

      <section className="admin-jobseekers-detail-section">
        <h3 className="admin-jobseekers-detail-sub">Activity</h3>
        <dl className="admin-jobseekers-detail-list">
          <div className="admin-jobseekers-detail-row">
            <dt>Applications</dt>
            <dd>{jobseeker.applications}</dd>
          </div>
          <div className="admin-jobseekers-detail-row">
            <dt>Saved jobs</dt>
            <dd>{jobseeker.savedJobs}</dd>
          </div>
          <div className="admin-jobseekers-detail-row">
            <dt>Joined</dt>
            <dd>{formatJoinedDate(jobseeker.joinedAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="admin-jobseekers-detail-section">
        <h3 className="admin-jobseekers-detail-sub">Recent applications</h3>
        {recent.length === 0 ? (
          <p className="admin-jobseekers-detail-empty">No applications yet.</p>
        ) : (
          <ul className="admin-jobseekers-recent">
            {recent.map((item, index) => {
              const meta = APPLICATION_STATUS_META[item.status] || APPLICATION_STATUS_META.new;
              return (
                <li key={`${item.job}-${index}`} className="admin-jobseekers-recent-item">
                  <span className="admin-jobseekers-recent-job">{item.job}</span>
                  <span className="admin-jobseekers-recent-meta">
                    <span className="admin-jobseekers-recent-company">{item.company}</span>
                    <span className={`admin-jobseekers-recent-status admin-jobseekers-recent-status--${meta.tone}`}>
                      {meta.label}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <footer className="admin-jobseekers-detail-actions">
        <div className="admin-jobseekers-detail-actions-row">
          <button
            type="button"
            className="admin-jobseekers-btn"
            onClick={() => onViewApplications(jobseeker)}
          >
            View Applications
          </button>
        </div>
      </footer>
    </div>
  );
}
