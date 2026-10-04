import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Select from '../ui/Select';
import Toast from '../Toast';
import Avatar from '../Avatar';
import { avatarFallback, resolveMediaUrl } from '../../lib/media';
import api, { apiFetchBlobUrl } from '../../utils/api';
import { ADMIN_STATUS_LABELS } from '../../constants/applicationStatus';
import {
  getAdminApplications,
  getAdminApplication,
  updateAdminApplicationStatus,
} from '../../utils/adminApi';
import './AdminApplicationsPage.css';

const PAGE_SIZE = 10;

// The backend stores the canonical pipeline statuses and nothing else. Each one
// is paired with the tone that already existed on this page, so the badge
// palette is unchanged — only the vocabulary is now the real one. Labels come
// from ADMIN_STATUS_LABELS (under-review renders as "Screening", offer as
// "Shortlisted") exactly as the Admin Overview already does.
const STATUS_META = {
  applied: { tone: 'new' },
  'under-review': { tone: 'reviewing' },
  interview: { tone: 'interview' },
  offer: { tone: 'shortlisted' },
  hired: { tone: 'hired' },
  rejected: { tone: 'rejected' },
};
const STATUS_OPTIONS = Object.keys(STATUS_META);

const statusLabel = (status) => ADMIN_STATUS_LABELS[status] || status;

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

const DOC_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
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

const formatAppliedDate = (iso) => {
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

// Derive a filename from the stored resume path. The API returns a path such as
// /uploads/resumes/name-123.pdf, so the last path segment is the real file name.
const fileNameFromUrl = (url) => {
  const clean = String(url).split(/[?#]/)[0];
  const base = clean.slice(clean.lastIndexOf('/') + 1);
  try {
    return decodeURIComponent(base) || 'resume';
  } catch {
    return base || 'resume';
  }
};

// Union the options seen so far with the ones just returned, keeping the
// currently selected value present even if the current page no longer contains
// it. Without this, choosing a recruiter would shrink the dropdown to just that
// recruiter and leave no way back to "All".
const mergeOptions = (previous, incoming, selectedValue) => {
  const byValue = new Map();
  for (const option of previous) byValue.set(option.value, option);
  for (const option of incoming) {
    if (option && option.value && !byValue.has(option.value)) {
      byValue.set(option.value, option);
    }
  }
  if (selectedValue && selectedValue !== 'all' && !byValue.has(selectedValue)) {
    byValue.set(selectedValue, { value: selectedValue, label: selectedValue });
  }
  return [...byValue.values()].sort((a, b) => a.label.localeCompare(b.label));
};

/**
 * AdminApplicationsPage - the /admin/applications workspace.
 *
 * Fully backed by GET /api/admin/applications, GET /api/admin/applications/:id
 * and PATCH /api/admin/applications/:id/status. Search, every filter, ordering,
 * and paging run on the server, so the page keeps no second copy of the list to
 * filter locally and the counts in the footer are the real totals.
 *
 * Selecting a row loads that application's detail from the API; the panel shows
 * the real resume (open/download against the uploaded file) and links to the
 * applicant's real profile. Nothing here falls back to placeholder content: a
 * failed request renders an error with a retry, and a missing resume renders
 * "No resume uploaded".
 */
export default function AdminApplicationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Debounced search term actually sent to the server; `searchInput` is what the
  // box holds. Keeps typing from firing a request per keystroke.
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '');
  const [q, setQ] = useState(() => searchParams.get('search') || '');

  // When the search term in the URL changes (e.g. navigating here from
  // Recruiters/Jobseekers "View applications" while already on this route),
  // sync the input and the active query instead of dropping the seed value.
  useEffect(() => {
    const seeded = searchParams.get('search') || '';
    setSearchInput(seeded);
    setQ(seeded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('search')]);
  const [status, setStatus] = useState('all');
  const [job, setJob] = useState('all');
  const [recruiter, setRecruiter] = useState('all');
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

  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  // Bumped to re-run the detail request without changing the selection.
  const [detailNonce, setDetailNonce] = useState(0);

  const [busyId, setBusyId] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [toast, setToast] = useState(null);

  const [jobOptions, setJobOptions] = useState([]);
  const [recruiterOptions, setRecruiterOptions] = useState([]);

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setQ(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Any filter or search change jumps back to page 1 and clears the selection
  // so it never points at a row that left the visible page. Only reacts to an
  // actual filter change, so a refresh with ?page=N never drops the param.
  const filterKey = JSON.stringify({ q, status, job, recruiter, dateRange });
  const lastFilterKeyRef = useRef(filterKey);
  useEffect(() => {
    if (lastFilterKeyRef.current === filterKey) return;
    lastFilterKeyRef.current = filterKey;
    setSelectedId(null);
    if (searchParams.has('page')) {
      const params = new URLSearchParams(searchParams);
      params.delete('page');
      setSearchParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminApplications({
        page,
        limit: PAGE_SIZE,
        q,
        status,
        job,
        recruiter,
        dateRange,
      });
      setList(data);

      // Filter dropdowns are built from real rows the API has returned. They
      // accumulate across pages rather than being replaced, so narrowing the
      // list never removes a choice the admin still needs.
      setJobOptions((prev) =>
        mergeOptions(
          prev,
          (data.applications || [])
            .map((app) => app.job)
            .filter(Boolean)
            .map((entry) => ({ value: entry.id, label: entry.title })),
          job
        )
      );
      setRecruiterOptions((prev) =>
        mergeOptions(
          prev,
          (data.applications || [])
            .map((app) => app.recruiter)
            .filter(Boolean)
            .map((entry) => ({ value: entry.id, label: entry.name })),
          recruiter
        )
      );
    } catch (err) {
      setError(err);
      setList(null);
    } finally {
      setLoading(false);
    }
  }, [page, q, status, job, recruiter, dateRange]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // Load the selected application's detail. The row already in hand drives the
  // panel header so selecting a row feels instant; the detail request fills in
  // the contact, resume, and links sections.
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
      return undefined;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    getAdminApplication(selectedId)
      .then((data) => {
        if (!cancelled) setDetail(data.application);
      })
      .catch((err) => {
        if (cancelled) return;
        setDetail(null);
        setDetailError(err);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, detailNonce]);

  const reloadDetail = useCallback(() => {
    setDetailNonce((n) => n + 1);
  }, []);

  const filtersActive =
    q !== '' || status !== 'all' || job !== 'all' || recruiter !== 'all' || dateRange !== '';

  const clearFilters = useCallback(() => {
    setSearchInput('');
    setStatus('all');
    setJob('all');
    setRecruiter('all');
    setDateRange('');
  }, []);

  const selectApplication = useCallback((id) => {
    setSelectedId(id);
    setActiveMenuId(null);
  }, []);

  const changeStatus = useCallback(
    async (id, nextStatus) => {
      setActiveMenuId(null);
      setBusyId(id);
      try {
        const data = await updateAdminApplicationStatus(id, nextStatus);
        const updated = data.application;

        // Replace the row with the server's normalized version so the badge and
        // the panel can never disagree with what was stored.
        setList((prev) =>
          prev
            ? {
                ...prev,
                applications: prev.applications.map((app) =>
                  String(app.id) === String(id) ? { ...app, ...updated } : app
                ),
              }
            : prev
        );
        // The panel's detail shape is richer than the list row, so only the
        // status is carried over rather than replacing the whole object.
        setDetail((prev) =>
          prev && String(prev.id) === String(id)
            ? { ...prev, status: updated.status, updatedAt: updated.updatedAt }
            : prev
        );
        showToast(
          `“${updated.applicant}” moved to ${statusLabel(updated.status).toLowerCase()} status`
        );
      } catch (err) {
        // Surface the real reason; never pretend the change succeeded.
        showToast(err?.message || 'Could not update the application status.');
      } finally {
        setBusyId(null);
      }
    },
    [showToast]
  );

  // Open the real uploaded file in a new tab. The resume endpoint is
  // protected, so it is fetched through the shared authenticated client and
  // handed to the browser as a blob object URL.
  const viewResume = useCallback(
    async (applicationId) => {
      if (!applicationId) return;
      try {
        const objectUrl = await apiFetchBlobUrl(`/applications/${applicationId}/resume`);
        window.open(objectUrl, '_blank', 'noopener,noreferrer');
      } catch {
        showToast('Could not open the resume right now.');
      }
    },
    [showToast]
  );

  // Download the real file. The API is a different origin from the app, so a
  // plain `download` attribute would be ignored by the browser; fetching the
  // bytes and handing them over as a blob object URL forces a real download.
  const downloadResume = useCallback(
    async (applicationId) => {
      if (!applicationId) return;
      setDownloading(true);
      let objectUrl = null;
      try {
        const res = await api.get(`/applications/${applicationId}/resume`, { responseType: 'blob' });
        const blob = res.data;
        objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = `resume-${applicationId}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (err) {
        // Report the actual failure. A resume that cannot be downloaded is
        // never papered over with a success message.
        showToast(err?.response?.data?.error || err?.message || 'Could not download the resume.');
      } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        setDownloading(false);
      }
    },
    [showToast]
  );

  const viewProfile = useCallback(
    (userId) => {
      if (!userId) {
        showToast('This application is not linked to an account.');
        return;
      }
      navigate(`/admin/jobseekers/${userId}`, { state: { from: '/admin/applications' } });
    },
    [navigate, showToast]
  );

  const total = list?.total ?? 0;
  const totalPages = Math.max(1, list?.totalPages ?? 1);
  const rows = list?.applications ?? [];
  const listStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const listEnd = Math.min(page * PAGE_SIZE, total);

  // An out-of-range ?page=N (e.g. a deep link past the end, or the last page
  // disappearing after a status filter change) is repaired instead of showing
  // an empty table.
  useEffect(() => {
    if (loading || error) return;
    if (total > 0 && page > totalPages) goToPage(totalPages, { replace: true });
  }, [loading, error, total, page, totalPages, goToPage]);

  // Read the selection straight from the live list so a status change lands in
  // both the table row and the detail panel on the same render.
  const selected = rows.find((app) => String(app.id) === String(selectedId)) || null;

  return (
    <div className="admin-page admin-applications">
      <section className="admin-applications-card" aria-label="Applications list">
        <div className="admin-applications-toolbar">
          <div className="admin-applications-search">
            <span className="admin-applications-search-icon" aria-hidden="true">{SEARCH_ICON}</span>
            <input
              type="text"
              id="admin-applications-search"
              name="search"
              className="admin-applications-search-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search applicants, jobs, or companies..."
              aria-label="Search applications"
            />
            {searchInput && (
              <button
                type="button"
                className="admin-applications-search-clear"
                onClick={() => setSearchInput('')}
                aria-label="Clear search"
              >
                {X_ICON}
              </button>
            )}
          </div>

          <div className="admin-applications-filter">
            <Select
              id="admin-applications-status"
              name="status"
              className="admin-applications-filter-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Status"
              options={[
                { value: 'all', label: 'All statuses' },
                ...STATUS_OPTIONS.map((value) => ({ value, label: statusLabel(value) })),
              ]}
            />
          </div>
          <div className="admin-applications-filter">
            <Select
              id="admin-applications-job"
              name="job"
              className="admin-applications-filter-select"
              value={job}
              onChange={(e) => setJob(e.target.value)}
              aria-label="Job"
              options={[
                { value: 'all', label: 'All jobs' },
                ...jobOptions.map((option) => ({ value: option.value, label: option.label })),
              ]}
            />
          </div>
          <div className="admin-applications-filter">
            <Select
              id="admin-applications-recruiter"
              name="recruiter"
              className="admin-applications-filter-select"
              value={recruiter}
              onChange={(e) => setRecruiter(e.target.value)}
              aria-label="Recruiter"
              options={[
                { value: 'all', label: 'All recruiters' },
                ...recruiterOptions.map((option) => ({ value: option.value, label: option.label })),
              ]}
            />
          </div>
          <div className="admin-applications-filter">
            <Select
              id="admin-applications-date"
              name="dateRange"
              className="admin-applications-filter-select"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              aria-label="Date"
              options={DATE_OPTIONS}
            />
          </div>

          {filtersActive && (
            <button type="button" className="admin-applications-clear" onClick={clearFilters}>
              {X_ICON}
              Clear Filters
            </button>
          )}
        </div>

        <div className="admin-applications-table-scroll">
          <table className="admin-applications-table">
            <colgroup>
              <col className="admin-applications-col-applicant" />
              <col className="admin-applications-col-job" />
              <col className="admin-applications-col-company" />
              <col className="admin-applications-col-status" />
              <col className="admin-applications-col-applied" />
              <col className="admin-applications-col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th className="admin-applications-col-applicant">Applicant</th>
                <th className="admin-applications-col-job">Job</th>
                <th className="admin-applications-col-company">Company</th>
                <th className="admin-applications-col-status">Status</th>
                <th className="admin-applications-col-applied">Applied</th>
                <th className="admin-applications-col-actions">
                  <span className="admin-applications-sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-applications-state">
                    <span className="admin-applications-state-title">Loading applications...</span>
                    <span className="admin-applications-state-text">
                      Fetching the latest applications from the server.
                    </span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="admin-applications-state">
                    <span className="admin-applications-state-title">Unable to load applications</span>
                    <span className="admin-applications-state-text">
                      {error?.message || 'Something went wrong while fetching applications.'}
                    </span>
                    <button type="button" className="admin-applications-btn" onClick={loadList}>
                      Try again
                    </button>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-applications-state">
                    <span className="admin-applications-state-title">No applications found</span>
                    <span className="admin-applications-state-text">
                      {filtersActive
                        ? 'Try adjusting your search or filters.'
                        : 'No applications have been submitted yet.'}
                    </span>
                    {filtersActive && (
                      <button type="button" className="admin-applications-btn" onClick={clearFilters}>
                        Clear Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((app) => {
                  const meta = STATUS_META[app.status] || STATUS_META.applied;
                  const isSelected = String(app.id) === String(selectedId);
                  const isBusy = String(app.id) === busyId;
                  return (
                    <tr
                      key={app.id}
                      className={`admin-applications-row${isSelected ? ' admin-applications-row--selected' : ''}`}
                      onClick={() => selectApplication(app.id)}
                    >
                      <td className="admin-applications-col-applicant">
                        <span className="admin-applications-applicant">
                          <Avatar
                            src={app.avatarUrl ? resolveMediaUrl(app.avatarUrl) : null}
                            fallbackSrc={avatarFallback(app.applicant, app.email)}
                            imgClassName="admin-applications-avatar"
                            placeholderClassName="admin-applications-avatar admin-applications-avatar--initials"
                            imgAlt=""
                            iconSize={14}
                          />
                          <span className="admin-applications-applicant-text">
                            <span className="admin-applications-applicant-name">{app.applicant}</span>
                            <span className="admin-applications-applicant-email">{app.email || '—'}</span>
                          </span>
                        </span>
                      </td>
                      <td className="admin-applications-col-job">
                        <span className="admin-applications-job">{app.jobTitle}</span>
                      </td>
                      <td className="admin-applications-col-company">
                        <span className="admin-applications-company">{app.company}</span>
                      </td>
                      <td className="admin-applications-col-status">
                        <span className={`admin-applications-badge admin-applications-badge--${meta.tone}`}>
                          {statusLabel(app.status)}
                        </span>
                      </td>
                      <td className="admin-applications-col-applied">
                        <span className="admin-applications-date">{formatAppliedDate(app.appliedAt)}</span>
                      </td>
                      <td className="admin-applications-col-actions" onClick={(e) => e.stopPropagation()}>
                        <RowActions
                          app={app}
                          busy={isBusy}
                          open={activeMenuId === String(app.id)}
                          onToggle={() =>
                            setActiveMenuId((prev) =>
                              prev === String(app.id) ? null : String(app.id)
                            )
                          }
                          onClose={() => setActiveMenuId(null)}
                          onSelect={selectApplication}
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

        <footer className="admin-applications-footer">
          <p className="admin-applications-footer-count">
            {loading && rows.length === 0 ? (
              'Loading applications...'
            ) : error ? (
              'Applications could not be loaded'
            ) : (
              <>
                Showing <strong>{listStart}–{listEnd}</strong> of <strong>{total}</strong> applications
              </>
            )}
          </p>
          {!loading && !error && totalPages > 1 && (
            <nav className="admin-applications-pagination" aria-label="Applications pagination">
              <button
                type="button"
                className="admin-applications-page-btn admin-applications-page-btn--nav"
                onClick={() => goToPage(Math.max(1, page - 1))}
                disabled={page <= 1}
              >
                {ARROW_LEFT}
                Previous
              </button>
              {getPageItems(page, totalPages).map((item, index) =>
                item === '…' ? (
                  <span key={`gap-${index}`} className="admin-applications-page-gap">
                    {item}
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    className={`admin-applications-page-btn${item === page ? ' admin-applications-page-btn--current' : ''}`}
                    onClick={() => goToPage(item)}
                    aria-label={`Go to page ${item}`}
                    aria-current={item === page ? 'page' : undefined}
                  >
                    {item}
                  </button>
                )
              )}
              <button
                type="button"
                className="admin-applications-page-btn admin-applications-page-btn--nav"
                onClick={() => goToPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
              >
                Next
                {ARROW_RIGHT}
              </button>
            </nav>
          )}
        </footer>
      </section>

      <aside className="admin-applications-panel" aria-label="Application details">
        {selected ? (
          <DetailPanel
            row={selected}
            detail={detail}
            loading={detailLoading}
            error={detailError}
            onClose={() => setSelectedId(null)}
            onRetry={reloadDetail}
            onViewResume={viewResume}
            onDownloadResume={downloadResume}
            downloading={downloading}
            onViewProfile={viewProfile}
          />
        ) : (
          <div className="admin-applications-panel-state">
            <span className="admin-applications-state-title">Select an application</span>
            <span className="admin-applications-state-text">
              Choose an application from the list to view its details here.
            </span>
          </div>
        )}
      </aside>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Row action menu - compact three-dot menu with the same interaction        */
/* language as Admin Jobs: portaled to <body>, anchored near the trigger,    */
/* closed on outside click / Escape / scroll / resize.                       */
/* ------------------------------------------------------------------------ */

function RowActions({ app, busy, open, onToggle, onClose, onSelect, onChangeStatus }) {
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
      const inMenu = menuRef?.current?.contains(e.target);
      const inTrigger = triggerRef.current?.contains(e.target);
      if (!inMenu && !inTrigger) onClose();
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
      const menu = menuRef?.current;
      if (!menu) return;
      const items = Array.from(menu.querySelectorAll('button:not([disabled])'));
      if (!items.length) return;
      const index = items.indexOf(document.activeElement);
      let next;
      if (e.key === 'Home') next = items[0];
      else if (e.key === 'End') next = items[items.length - 1];
      else if (index < 0) next = e.key === 'ArrowDown' ? items[0] : items[items.length - 1];
      else next = items[(index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
      e.preventDefault();
      next.focus();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    // Move focus into the menu when it opens so keyboard users land on the
    // first action instead of a control behind the overlay.
    const firstItem = menuRef?.current?.querySelector('button:not([disabled])');
    if (firstItem) firstItem.focus();

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
        className={`admin-applications-menu-btn${open ? ' admin-applications-menu-btn--open' : ''}`}
        onClick={onToggle}
        disabled={busy}
        aria-label={`Actions for ${app.applicant}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {MORE_ICON}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="admin-applications-menu"
            role="menu"
            aria-label={`Actions for ${app.applicant}`}
            style={{
              ...(pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }),
              minWidth: 196,
            }}
          >
            {statusView ? (
              <>
                <div className="admin-applications-menu-head">
                  <button
                    type="button"
                    className="admin-applications-menu-subhead"
                    onClick={() => setStatusView(false)}
                    aria-label="Back"
                  >
                    {ARROW_LEFT}
                  </button>
                  <span className="admin-applications-menu-label">Change status</span>
                </div>
                <div className="admin-applications-menu-divider" />
                {STATUS_OPTIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={app.status === value}
                    className={`admin-applications-menu-item${
                      app.status === value ? ' admin-applications-menu-item--selected' : ''
                    }`}
                    onClick={() => onChangeStatus(app.id, value)}
                  >
                    <span className="admin-applications-menu-check">
                      {app.status === value ? CHECK_ICON : null}
                    </span>
                    <span className="admin-applications-menu-item-label">{statusLabel(value)}</span>
                  </button>
                ))}
              </>
            ) : (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className="admin-applications-menu-item"
                  onClick={() => setStatusView(true)}
                >
                  <span className="admin-applications-menu-check" />
                  <span className="admin-applications-menu-item-label">Change status</span>
                  <span className="admin-applications-menu-chevron" aria-hidden="true">{ARROW_RIGHT}</span>
                </button>
                {app.email && (
                  <a
                    className="admin-applications-menu-item admin-applications-menu-item--link"
                    href={`mailto:${app.email}`}
                  >
                    <span className="admin-applications-menu-check" />
                    <span className="admin-applications-menu-item-label">Contact applicant</span>
                  </a>
                )}
              </>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* Right-side detail panel - contextual inspector for the selected row.      */
/*                                                                          */
/* The header renders from the list row so the panel fills instantly; the     */
/* sections below it render from the application's detail once it has loaded,  */
/* so contact details, links, and the resume are always the real values.      */
/* The resume actions act on the stored file: View opens it, Download fetches  */
/* the bytes. A record with no resume says so instead of offering a button.   */
/* ------------------------------------------------------------------------ */

function DetailPanel({
  row,
  detail,
  loading,
  error,
  onClose,
  onRetry,
  onViewResume,
  onDownloadResume,
  downloading,
  onViewProfile,
}) {
  const applicant = detail?.applicant || null;
  const status = detail?.status ?? row.status;
  const meta = STATUS_META[status] || STATUS_META.applied;
  const resumeUrl = applicant?.resumeUrl || '';
  const skills = applicant?.skills?.length ? applicant.skills : row.skills;

  return (
    <div className="admin-applications-detail">
      <header className="admin-applications-detail-head">
        <Avatar
          src={(detail?.applicant?.avatarUrl || row.avatarUrl)
            ? resolveMediaUrl(detail?.applicant?.avatarUrl || row.avatarUrl)
            : null}
          fallbackSrc={avatarFallback(detail?.applicant?.fullName || row.applicant, row.email)}
          imgClassName="admin-applications-avatar admin-applications-detail-avatar"
          placeholderClassName="admin-applications-avatar admin-applications-avatar--initials admin-applications-detail-avatar"
          imgAlt=""
          iconSize={16}
        />
        <div className="admin-applications-detail-titles">
          <h2 className="admin-applications-detail-name">
            {applicant?.fullName || row.applicant}
          </h2>
          <p className="admin-applications-detail-email">{applicant?.email || row.email || '—'}</p>
          {(applicant?.location || row.location) && (
            <p className="admin-applications-detail-location">
              {applicant?.location || row.location}
            </p>
          )}
        </div>
        <div className="admin-applications-detail-head-side">
          <span className={`admin-applications-badge admin-applications-badge--${meta.tone}`}>
            {statusLabel(status)}
          </span>
          <button
            type="button"
            className="admin-applications-detail-close"
            onClick={onClose}
            aria-label="Close application details"
          >
            {X_ICON}
          </button>
        </div>
      </header>

      {error ? (
        <div className="admin-applications-panel-state">
          <span className="admin-applications-state-title">Unable to load this application</span>
          <span className="admin-applications-state-text">
            {error?.message || 'Something went wrong while fetching the application detail.'}
          </span>
          <button
            type="button"
            className="admin-applications-btn"
            onClick={onRetry}
          >
            Try again
          </button>
        </div>
      ) : loading && !detail ? (
        <div className="admin-applications-panel-state">
          <span className="admin-applications-state-title">Loading application...</span>
          <span className="admin-applications-state-text">
            Fetching the applicant's details from the server.
          </span>
        </div>
      ) : (
        <>
          <section className="admin-applications-detail-section">
            <h3 className="admin-applications-detail-sub">Application</h3>
            <dl className="admin-applications-detail-list">
              <div className="admin-applications-detail-row">
                <dt>Job title</dt>
                <dd>{detail?.job?.title || row.jobTitle}</dd>
              </div>
              <div className="admin-applications-detail-row">
                <dt>Company</dt>
                <dd>{detail?.job?.company || row.company}</dd>
              </div>
              <div className="admin-applications-detail-row">
                <dt>Recruiter</dt>
                <dd>{detail?.recruiter?.name || row.recruiter?.name || 'Unassigned'}</dd>
              </div>
              <div className="admin-applications-detail-row">
                <dt>Applied</dt>
                <dd>{formatAppliedDate(detail?.appliedAt || row.appliedAt)}</dd>
              </div>
            </dl>
          </section>

          <section className="admin-applications-detail-section">
            <h3 className="admin-applications-detail-sub">Candidate</h3>
            <dl className="admin-applications-detail-list">
              <div className="admin-applications-detail-row">
                <dt>Location</dt>
                <dd>{applicant?.location || row.location || '—'}</dd>
              </div>
              <div className="admin-applications-detail-row">
                <dt>Skills</dt>
                <dd>
                  {skills && skills.length ? (
                    <span className="admin-applications-detail-skills">
                      {skills.map((skill) => (
                        <span key={skill} className="admin-applications-detail-skill">
                          {skill}
                        </span>
                      ))}
                    </span>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              {applicant?.portfolio && (
                <div className="admin-applications-detail-row">
                  <dt>Portfolio</dt>
                  <dd>
                    <a
                      className="admin-applications-detail-link"
                      href={applicant.portfolio}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {applicant.portfolio}
                    </a>
                  </dd>
                </div>
              )}
              {applicant?.linkedin && (
                <div className="admin-applications-detail-row">
                  <dt>LinkedIn</dt>
                  <dd>
                    <a
                      className="admin-applications-detail-link"
                      href={applicant.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {applicant.linkedin}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section className="admin-applications-detail-section">
            <h3 className="admin-applications-detail-sub">Resume</h3>
            {resumeUrl ? (
              <div className="admin-applications-detail-resume">
                <span className="admin-applications-detail-resume-icon" aria-hidden="true">
                  {DOC_ICON}
                </span>
                <div className="admin-applications-detail-resume-info">
                  <span className="admin-applications-detail-resume-name">
                    {fileNameFromUrl(resumeUrl)}
                  </span>
                  <span className="admin-applications-detail-resume-actions">
                    <button type="button" onClick={() => onViewResume(detail?.id)}>
                      View
                    </button>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => onDownloadResume(detail?.id)}
                      disabled={downloading}
                    >
                      {downloading ? 'Downloading...' : 'Download'}
                    </button>
                  </span>
                </div>
              </div>
            ) : (
              <p className="admin-applications-detail-resume-missing">No resume uploaded</p>
            )}
          </section>

          <section className="admin-applications-detail-section">
            <h3 className="admin-applications-detail-sub">Contact</h3>
            <dl className="admin-applications-detail-list">
              <div className="admin-applications-detail-row">
                <dt>Email</dt>
                <dd>{applicant?.email || row.email || '—'}</dd>
              </div>
              <div className="admin-applications-detail-row">
                <dt>Phone</dt>
                <dd>{applicant?.phone || row.phone || '—'}</dd>
              </div>
            </dl>
          </section>

          {detail?.coverLetter && (
            <section className="admin-applications-detail-section">
              <h3 className="admin-applications-detail-sub">Cover letter</h3>
              <p className="admin-applications-detail-cover">{detail.coverLetter}</p>
            </section>
          )}

          <footer className="admin-applications-detail-actions">
            <div className="admin-applications-detail-actions-row">
              <button
                type="button"
                className="admin-applications-btn"
                onClick={() => onViewProfile(row.userId)}
              >
                View Profile
              </button>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
