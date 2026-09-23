import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { getAdminJobs, getAdminJob, updateAdminJobStatus } from '../../utils/adminApi';
import Toast from '../Toast';
import { formatSalary } from '../../utils/salary';
import './AdminJobsPage.css';

const AVATAR_BASE = 'http://localhost:5000';
const PAGE_SIZE = 10;

const STATUS_META = {
  active: { label: 'Active', tone: 'active' },
  pending: { label: 'Pending', tone: 'pending' },
  closed: { label: 'Closed', tone: 'closed' },
  draft: { label: 'Draft', tone: 'draft' },
};
const STATUS_OPTIONS = Object.keys(STATUS_META);

const EMPLOYMENT_OPTIONS = ['Full-time', 'Part-time', 'Contract', 'Internship'];

const DATE_OPTIONS = [
  { value: '', label: 'Any date' },
  { value: '1', label: 'Today' },
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

const CHEVRON_DOWN = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CHECK_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const BRIEFCASE_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

const MORE_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </svg>
);

const EXTERNAL_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
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

const hexToRgba = (hex, alpha) => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!match) return '';
  const value = parseInt(match[1], 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
};

const resolveAvatar = (url) =>
  url ? (url.startsWith('http') ? url : `${AVATAR_BASE}${url}`) : null;

const formatPostedDate = (iso) => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const appCountLabel = (count) => {
  const n = Number(count);
  return Number.isFinite(n) ? String(n) : '0';
};

const initialOf = (name) => (name || '?').trim().charAt(0).toUpperCase();

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
 * AdminJobsPage - the /admin/jobs workspace.
 *
 * Lists every job on the platform (search, status/employment/date filters,
 * page-scoped selection, bulk actions, pagination) beside a ~320px detail
 * panel. All moderation (approve / close / draft / pending) goes through the
 * protected admin API and never fabricates data. CSS is self-contained on the
 * admin tokens because the Overview stylesheet is not loaded on this route.
 */
export default function AdminJobsPage() {
  const { jobId: urlJobId } = useParams();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [employmentType, setEmploymentType] = useState('all');
  const [postedDays, setPostedDays] = useState('');
  const [page, setPage] = useState(1);

  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState(urlJobId || null);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const [toast, setToast] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [detailDismissed, setDetailDismissed] = useState(false);

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setQ(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filterKey = JSON.stringify({ q, status, employmentType, postedDays });
  const lastFilterKeyRef = useRef(filterKey);
  useEffect(() => {
    if (lastFilterKeyRef.current === filterKey) return;
    lastFilterKeyRef.current = filterKey;
    setPage(1);
    setDetailDismissed(false);
    if (!urlJobId) setSelectedId(null);
  }, [filterKey, urlJobId]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminJobs({
        page,
        limit: PAGE_SIZE,
        q,
        status,
        employmentType,
        postedDays,
      });
      setList(data);
    } catch (err) {
      setError(err);
      setList(null);
    } finally {
      setLoading(false);
    }
  }, [page, q, status, employmentType, postedDays]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const selectJob = useCallback(
    (id) => {
      setSelectedId(id);
      setActiveMenuId(null);
      setDetailDismissed(false);
      navigate(`/admin/jobs/${id}`, { replace: true });
    },
    [navigate]
  );

  const loadSelected = useCallback(async (id) => {
    if (!id) {
      setSelected(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    setDetailError(null);
    try {
      const data = await getAdminJob(id);
      setSelected(data.job);
    } catch (err) {
      setDetailError(err);
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSelected(selectedId);
  }, [selectedId, loadSelected]);

  const closePanel = useCallback(() => {
    setDetailDismissed(true);
    setSelectedId(null);
    setActiveMenuId(null);
    navigate('/admin/jobs', { replace: true });
  }, [navigate]);

  const applyStatus = useCallback(
    async (id, nextStatus) => {
      setBusyId(id);
      setActiveMenuId(null);
      try {
        const data = await updateAdminJobStatus(id, nextStatus);
        if (String(id) === String(selectedId)) setSelected(data.job);
        setList((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            jobs: prev.jobs.map((job) =>
              String(job.id) === String(id) ? data.job : job
            ),
          };
        });
        showToast(`“${data.job.title}” moved to ${STATUS_META[nextStatus].label.toLowerCase()} status`);
      } catch (err) {
        showToast(err?.message || 'Could not update that job status.');
      } finally {
        setBusyId(null);
      }
    },
    [selectedId, showToast]
  );

  // Auto-select the first job once a page loads and nothing is selected yet.
  // Filter/search changes reset the selection (above), so the freshest result
  // set always populates the panel. Deliberate row clicks and deep links are
  // never overridden, and a dismissed panel stays dismissed until the user
  // acts again.
  const visibleJobs = list?.jobs || [];
  useEffect(() => {
    if (detailDismissed) return;
    if (loading || !list?.jobs?.length || selectedId) return;
    setSelectedId(String(list.jobs[0].id));
  }, [list, loading, selectedId, detailDismissed]);

  const filtersActive =
    q !== '' || status !== 'all' || employmentType !== 'all' || postedDays !== '';

  const clearFilters = useCallback(() => {
    setSearchInput('');
    setQ('');
    setStatus('all');
    setEmploymentType('all');
    setPostedDays('');
  }, []);

  const total = list?.total || 0;
  const totalPages = list?.totalPages || 0;
  const listStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const listEnd = Math.min(page * PAGE_SIZE, total);
  const hasJobs = !loading && !error && total > 0;

  return (
    <div className="admin-page admin-jobs">
      <div className="admin-jobs-workspace">
        <section className="admin-jobs-card" aria-label="Jobs list">
          <div className="admin-jobs-toolbar">
            <div className="admin-jobs-search">
              <span className="admin-jobs-search-icon" aria-hidden="true">{SEARCH_ICON}</span>
              <input
                type="text"
                id="admin-jobs-search"
                name="search"
                className="admin-jobs-search-input"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search jobs, companies, or recruiters…"
                aria-label="Search jobs"
              />
              {searchInput && (
                <button
                  type="button"
                  className="admin-jobs-search-clear"
                  onClick={() => setSearchInput('')}
                  aria-label="Clear search"
                >
                  {X_ICON}
                </button>
              )}
            </div>

            <FilterDropdown
              id="admin-jobs-status"
              name="status"
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: 'all', label: 'All statuses' },
                ...STATUS_OPTIONS.map((value) => ({
                  value,
                  label: STATUS_META[value].label,
                })),
              ]}
            />
            <FilterDropdown
              id="admin-jobs-employment"
              name="employmentType"
              label="Employment Type"
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              options={[
                { value: 'all', label: 'Any type' },
                ...EMPLOYMENT_OPTIONS.map((value) => ({ value, label: value })),
              ]}
            />
            <FilterDropdown
              id="admin-jobs-posted"
              name="postedDate"
              label="Posted Date"
              value={postedDays}
              onChange={(e) => setPostedDays(e.target.value)}
              options={DATE_OPTIONS}
            />

            {filtersActive && (
              <button
                type="button"
                className="admin-jobs-clear"
                onClick={clearFilters}
              >
                {X_ICON}
                Clear Filters
              </button>
            )}
          </div>

          <div className="admin-jobs-table-scroll">
            <table className="admin-jobs-table">
              <colgroup>
                <col className="admin-jobs-col-job" />
                <col className="admin-jobs-col-company" />
                <col className="admin-jobs-col-recruiter" />
                <col className="admin-jobs-col-status" />
                <col className="admin-jobs-col-apps" />
                <col className="admin-jobs-col-posted" />
                <col className="admin-jobs-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th className="admin-jobs-col-job">Job</th>
                  <th className="admin-jobs-col-company">Company</th>
                  <th className="admin-jobs-col-recruiter">Recruiter</th>
                  <th className="admin-jobs-col-status">Status</th>
                  <th className="admin-jobs-col-apps">Applications</th>
                  <th className="admin-jobs-col-posted">Posted</th>
                  <th className="admin-jobs-col-actions">
                    <span className="admin-jobs-sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows count={PAGE_SIZE} />
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="admin-jobs-state">
                      <span className="admin-jobs-state-title">Unable to load jobs</span>
                      <span className="admin-jobs-state-text">
                        {error?.message || 'Something went wrong while fetching job data.'}
                      </span>
                      <button type="button" className="admin-jobs-btn" onClick={loadList}>
                        Try again
                      </button>
                    </td>
                  </tr>
                ) : visibleJobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="admin-jobs-state">
                      <span className="admin-jobs-state-title">No jobs found</span>
                      <span className="admin-jobs-state-text">
                        Try adjusting your search or filters.
                      </span>
                      {filtersActive && (
                        <button type="button" className="admin-jobs-btn" onClick={clearFilters}>
                          Clear Filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  visibleJobs.map((job) => {
                    const meta = STATUS_META[job.status] || STATUS_META.active;
                    const isSelected = String(job.id) === String(selectedId);
                    const isBusy = String(job.id) === busyId;
                    const jobMetaLine = [job.employmentType, job.location].filter(Boolean).join(' · ');
                    return (
                      <tr
                        key={job.id}
                        className={`admin-jobs-row${isSelected ? ' admin-jobs-row--selected' : ''}`}
                        onClick={() => selectJob(job.id)}
                      >
                        <td className="admin-jobs-col-job">
                          <button
                            type="button"
                            className="admin-jobs-job"
                            onClick={() => selectJob(job.id)}
                          >
                            <span className="admin-jobs-job-icon" aria-hidden="true">
                              {BRIEFCASE_ICON}
                            </span>
                            <span className="admin-jobs-job-text">
                              <span className="admin-jobs-job-title">{job.title}</span>
                              {jobMetaLine && (
                                <span className="admin-jobs-job-meta">{jobMetaLine}</span>
                              )}
                            </span>
                          </button>
                        </td>
                        <td className="admin-jobs-col-company">
                          <span className="admin-jobs-company">{job.company}</span>
                        </td>
                        <td className="admin-jobs-col-recruiter">
                          {job.recruiter ? (
                            <span className="admin-jobs-recruiter">
                              <RecruiterAvatar recruiter={job.recruiter} />
                              <span className="admin-jobs-recruiter-name">{job.recruiter.name}</span>
                            </span>
                          ) : (
                            <span className="admin-jobs-recruiter-none">—</span>
                          )}
                        </td>
                        <td className="admin-jobs-col-status">
                          <span className={`admin-jobs-badge admin-jobs-badge--${meta.tone}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="admin-jobs-col-apps">
                          <span className="admin-jobs-count">{appCountLabel(job.applications)}</span>
                        </td>
                        <td className="admin-jobs-col-posted">{formatPostedDate(job.postedAt)}</td>
                        <td
                          className="admin-jobs-col-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <RowMenu
                            job={job}
                            open={activeMenuId === String(job.id)}
                            onToggle={() =>
                              setActiveMenuId((prev) =>
                                prev === String(job.id) ? null : String(job.id)
                              )
                            }
                            onClose={() => setActiveMenuId(null)}
                            onSelect={applyStatus}
                            busy={isBusy}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <footer className="admin-jobs-footer">
            <p className="admin-jobs-footer-count">
              Showing <strong>{listStart}–{listEnd}</strong> of <strong>{total}</strong> jobs
            </p>
            {list && totalPages > 0 && (
              <nav className="admin-jobs-pagination" aria-label="Jobs pagination">
                <button
                  type="button"
                  className="admin-jobs-page-btn admin-jobs-page-btn--nav"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  {ARROW_LEFT}
                  Previous
                </button>
                {getPageItems(page, totalPages).map((item, index) =>
                  item === '…' ? (
                    <span key={`gap-${index}`} className="admin-jobs-page-gap">
                      {item}
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      className={`admin-jobs-page-btn${item === page ? ' admin-jobs-page-btn--current' : ''}`}
                      onClick={() => setPage(item)}
                      aria-label={`Go to page ${item}`}
                      aria-current={item === page ? 'page' : undefined}
                    >
                      {item}
                    </button>
                  )
                )}
                <button
                  type="button"
                  className="admin-jobs-page-btn admin-jobs-page-btn--nav"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                  {ARROW_RIGHT}
                </button>
              </nav>
            )}
          </footer>
        </section>

        <aside className="admin-jobs-panel" aria-label="Job details">
          {detailLoading ? (
            <div className="admin-jobs-panel-state" aria-busy="true">
              <div className="admin-jobs-skeleton admin-jobs-skeleton--title" />
              <div className="admin-jobs-skeleton admin-jobs-skeleton--line" />
              <div className="admin-jobs-skeleton admin-jobs-skeleton--block" />
            </div>
          ) : detailError ? (
            <div className="admin-jobs-panel-state" role="alert">
              <span className="admin-jobs-state-title">Unable to load job details</span>
              <span className="admin-jobs-state-text">
                {detailError?.message || 'Something went wrong while fetching this job.'}
              </span>
              <button
                type="button"
                className="admin-jobs-btn"
                onClick={() => loadSelected(selectedId)}
              >
                Try again
              </button>
            </div>
          ) : selected ? (
            <DetailPanel
              job={selected}
              busy={busyId !== null}
              onStatus={applyStatus}
              onClose={closePanel}
            />
          ) : hasJobs ? (
            <div className="admin-jobs-panel-state">
              <span className="admin-jobs-state-title">Select a job</span>
              <span className="admin-jobs-state-text">
                Choose a job from the list to view its details here.
              </span>
            </div>
          ) : (
            <div className="admin-jobs-panel-state">
              <span className="admin-jobs-state-title">No jobs found</span>
              <span className="admin-jobs-state-text">
                Try adjusting your search or filters.
              </span>
            </div>
          )}
        </aside>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Sub-components                                                            */
/* ------------------------------------------------------------------------ */

function FilterDropdown({ id, name, label, value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const closeMenu = useCallback(() => setOpen(false), []);
  const current = options.find((opt) => opt.value === value) || options[0];

  return (
    <span className="admin-jobs-filter">
      <button
        type="button"
        ref={triggerRef}
        className={`admin-jobs-filter-trigger${open ? ' admin-jobs-filter-trigger--open' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
      >
        <span className="admin-jobs-filter-head">
          <span className="admin-jobs-filter-label">{label}</span>
          <span className="admin-jobs-filter-value">{current.label}</span>
        </span>
        <span className="admin-jobs-filter-chevron" aria-hidden="true">{CHEVRON_DOWN}</span>
      </button>
      <select
        id={id}
        name={name}
        tabIndex={-1}
        aria-hidden="true"
        className="admin-jobs-filter-native"
        value={value}
        onChange={onChange}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <FloatingMenu
        open={open}
        anchorRef={triggerRef}
        excludeRef={triggerRef}
        onClose={closeMenu}
        role="listbox"
        id={`${id}-menu`}
        label={label}
        minWidth={176}
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="option"
            aria-selected={value === opt.value}
            className={`admin-jobs-floating-item admin-jobs-filter-option${
              value === opt.value ? ' admin-jobs-floating-item--selected' : ''
            }`}
            onClick={() => {
              onChange({ target: { value: opt.value } });
              closeMenu();
            }}
          >
            <span className="admin-jobs-floating-check">
              {value === opt.value ? CHECK_ICON : null}
            </span>
            <span className="admin-jobs-floating-item-label">{opt.label}</span>
          </button>
        ))}
      </FloatingMenu>
    </span>
  );
}

/**
 * FloatingMenu - a small portal-based dropdown rendered on <body> so the card's
 * overflow:hidden can never clip it. Anchored below the trigger when there is
 * room, above it otherwise, horizontally clamped to the viewport. Closes on
 * outside-click (except the trigger itself), Escape, scroll, and resize.
 */
function FloatingMenu({ open, anchorRef, excludeRef, onClose, children, role, label, id, width, minWidth }) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e) => {
      const inMenu = menuRef.current?.contains(e.target);
      const inTrigger = excludeRef?.current?.contains(e.target);
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
  }, [open, onClose, excludeRef]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const anchorEl = anchorRef.current;
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
  }, [open, anchorRef, children, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      ref={menuRef}
      id={id}
      className="admin-jobs-floating"
      role={role}
      aria-label={label}
      style={{
        ...(pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }),
        ...(width ? { width } : {}),
        ...(minWidth ? { minWidth } : {}),
      }}
    >
      {children}
    </div>,
    document.body
  );
}

function RecruiterAvatar({ recruiter }) {
  const src = resolveAvatar(recruiter?.avatarUrl);
  const name = recruiter?.name || '';
  if (src) {
    return (
      <img
        className="admin-jobs-avatar admin-jobs-avatar--img"
        src={src}
        alt={`${name} avatar`}
        loading="lazy"
      />
    );
  }
  return (
    <span className="admin-jobs-avatar admin-jobs-avatar--initials" aria-hidden="true">
      {initialOf(name)}
    </span>
  );
}

function RowMenu({ job, open, onToggle, onClose, onSelect, busy }) {
  const triggerRef = useRef(null);
  const [statusView, setStatusView] = useState(false);

  useEffect(() => {
    if (!open) setStatusView(false);
  }, [open]);

  const trigger = (
    <button
      type="button"
      ref={triggerRef}
      className={`admin-jobs-menu-btn${open ? ' admin-jobs-menu-btn--open' : ''}`}
      onClick={onToggle}
      disabled={busy}
      aria-label={`Actions for ${job.title}`}
      aria-expanded={open}
      aria-haspopup="menu"
    >
      {MORE_ICON}
    </button>
  );

  return (
    <>
      {trigger}
      <FloatingMenu
        open={open}
        anchorRef={triggerRef}
        excludeRef={triggerRef}
        onClose={onClose}
        role="menu"
        label={`Actions for ${job.title}`}
        minWidth={196}
      >
        {statusView ? (
          <>
            <div className="admin-jobs-floating-head">
              <button
                type="button"
                className="admin-jobs-floating-subhead"
                onClick={() => setStatusView(false)}
                aria-label="Back"
              >
                {ARROW_LEFT}
              </button>
              <span className="admin-jobs-floating-label">Change status</span>
            </div>
            <div className="admin-jobs-floating-divider" />
            {STATUS_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={job.status === value}
                className={`admin-jobs-floating-item${
                  job.status === value ? ' admin-jobs-floating-item--selected' : ''
                }`}
                disabled={busy}
                onClick={() => onSelect(job.id, value)}
              >
                <span className="admin-jobs-floating-check">
                  {job.status === value ? CHECK_ICON : null}
                </span>
                <span className="admin-jobs-floating-item-label">{STATUS_META[value].label}</span>
              </button>
            ))}
          </>
        ) : (
          <>
            <a
              className="admin-jobs-floating-item admin-jobs-floating-item--link"
              href={`/jobs/${job.id}`}
              target="_blank"
              rel="noreferrer"
            >
              <span className="admin-jobs-floating-check">{EXTERNAL_ICON}</span>
              <span className="admin-jobs-floating-item-label">View posting</span>
            </a>
            <button
              type="button"
              role="menuitem"
              className="admin-jobs-floating-item"
              onClick={() => setStatusView(true)}
            >
              <span className="admin-jobs-floating-check" />
              <span className="admin-jobs-floating-item-label">Change status</span>
              <span className="admin-jobs-floating-chevron" aria-hidden="true">{ARROW_RIGHT}</span>
            </button>
            {job.status !== 'closed' && (
              <button
                type="button"
                role="menuitem"
                className="admin-jobs-floating-item admin-jobs-floating-item--danger"
                disabled={busy}
                onClick={() => onSelect(job.id, 'closed')}
              >
                <span className="admin-jobs-floating-check" />
                <span className="admin-jobs-floating-item-label">Close job</span>
              </button>
            )}
          </>
        )}
      </FloatingMenu>
    </>
  );
}

function SkeletonRows({ count }) {
  return Array.from({ length: count }, (_, index) => (
    <tr key={index} className="admin-jobs-row">
      <td className="admin-jobs-col-job">
        <span className="admin-jobs-skeleton admin-jobs-skeleton--title" />
        <span className="admin-jobs-skeleton admin-jobs-skeleton--line" />
      </td>
      <td className="admin-jobs-col-company">
        <span className="admin-jobs-skeleton admin-jobs-skeleton--line" />
      </td>
      <td className="admin-jobs-col-recruiter">
        <span className="admin-jobs-skeleton admin-jobs-skeleton--avatar" />
        <span className="admin-jobs-skeleton admin-jobs-skeleton--line" />
      </td>
      <td className="admin-jobs-col-status">
        <span className="admin-jobs-skeleton admin-jobs-skeleton--badge" />
      </td>
      <td className="admin-jobs-col-apps">
        <span className="admin-jobs-skeleton admin-jobs-skeleton--line" />
      </td>
      <td className="admin-jobs-col-posted">
        <span className="admin-jobs-skeleton admin-jobs-skeleton--line" />
      </td>
      <td className="admin-jobs-col-actions">
        <span className="admin-jobs-skeleton admin-jobs-skeleton--check" />
      </td>
    </tr>
  ));
}

function DetailPanel({ job, busy, onStatus, onClose }) {
  const meta = STATUS_META[job.status] || STATUS_META.active;

  const requirements = [];
  if (job.experienceLevel) {
    requirements.push(`${job.experienceLevel} experience in a related role.`);
  }
  if (job.skills && job.skills.length) {
    requirements.push(`Strong proficiency in ${job.skills.join(', ')}.`);
  }
  if (job.employmentType) {
    requirements.push(`${job.employmentType} engagement${job.workType ? `, ${job.workType.toLowerCase()} work` : ''}.`);
  }

  return (
    <div className="admin-jobs-detail">
      <header className="admin-jobs-detail-head">
        <div className="admin-jobs-detail-titles">
          <h2 className="admin-jobs-detail-title">{job.title}</h2>
          <p className="admin-jobs-detail-company">{job.company}</p>
          <p className="admin-jobs-detail-employment">
            {[job.employmentType, job.location].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
        <button
          type="button"
          className="admin-jobs-detail-close"
          onClick={onClose}
          aria-label="Close job details"
        >
          {X_ICON}
        </button>
      </header>

      <div className="admin-jobs-detail-status-row">
        <span className={`admin-jobs-badge admin-jobs-badge--${meta.tone}`}>{meta.label}</span>
        {job.status === 'pending' && (
          <button
            type="button"
            className="admin-jobs-btn admin-jobs-btn--primary"
            onClick={() => onStatus(job.id, 'active')}
            disabled={busy}
          >
            {CHECK_ICON}Approve
          </button>
        )}
        {job.status === 'active' && (
          <a
            className="admin-jobs-btn admin-jobs-btn--ghost"
            href={`/jobs/${job.id}`}
            target="_blank"
            rel="noreferrer"
          >
            {EXTERNAL_ICON}View posting
          </a>
        )}
      </div>

      <dl className="admin-jobs-detail-meta">
        <div className="admin-jobs-detail-meta-item">
          <dt>Salary</dt>
          <dd>{formatSalary(job.salary)}</dd>
        </div>
        <div className="admin-jobs-detail-meta-item">
          <dt>Applications</dt>
          <dd>{appCountLabel(job.applications)}</dd>
        </div>
        <div className="admin-jobs-detail-meta-item">
          <dt>Posted</dt>
          <dd>{formatPostedDate(job.postedAt)}</dd>
        </div>
        <div className="admin-jobs-detail-meta-item">
          <dt>Employment</dt>
          <dd>{job.employmentType || '—'}</dd>
        </div>
      </dl>

      <div className="admin-jobs-detail-section">
        <h3 className="admin-jobs-detail-sub">About the role</h3>
        <p className="admin-jobs-detail-text">{job.description || 'No description provided.'}</p>
      </div>

      {requirements.length > 0 && (
        <div className="admin-jobs-detail-section">
          <h3 className="admin-jobs-detail-sub">Requirements</h3>
          <ul className="admin-jobs-detail-list">
            {requirements.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {job.skills && job.skills.length > 0 && (
        <div className="admin-jobs-detail-section">
          <h3 className="admin-jobs-detail-sub">Skills</h3>
          <div className="admin-jobs-detail-skills">
            {job.skills.map((skill) => (
              <span key={skill} className="admin-jobs-detail-chip">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {job.recruiter && (
        <div className="admin-jobs-detail-section">
          <h3 className="admin-jobs-detail-sub">Recruiter</h3>
          <div className="admin-jobs-detail-recruiter">
            <RecruiterAvatar recruiter={job.recruiter} />
            <div className="admin-jobs-detail-recruiter-info">
              <span className="admin-jobs-detail-recruiter-name">{job.recruiter.name}</span>
              {job.recruiter.jobTitle && (
                <span className="admin-jobs-detail-recruiter-role">{job.recruiter.jobTitle}</span>
              )}
              {job.recruiter.email && (
                <a
                  href={`mailto:${job.recruiter.email}`}
                  className="admin-jobs-detail-recruiter-mail"
                >
                  {job.recruiter.email}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {job.closedAt && (
        <footer className="admin-jobs-detail-actions">
          <span className="admin-jobs-detail-closed">
            Closed {formatPostedDate(job.closedAt)}
          </span>
        </footer>
      )}
    </div>
  );
}