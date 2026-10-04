import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Select from '../ui/Select';
import Avatar from '../Avatar';
import { avatarFallback, resolveMediaUrl } from '../../lib/media';
import { ADMIN_STATUS_LABELS } from '../../constants/applicationStatus';
import { getAdminJobseekers, getAdminJobseeker } from '../../utils/adminApi';
import './AdminJobseekersPage.css';

const PAGE_SIZE = 10;

const DATE_OPTIONS = [
  { value: '', label: 'Any date' },
  { value: 'today', label: 'Today' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

// The backend stores the canonical pipeline statuses and nothing else. Each is
// mapped onto one of the tones this page already styled, so the badge palette
// is unchanged — only the vocabulary is now the real one. Labels come from
// ADMIN_STATUS_LABELS (under-review renders as "Screening", offer as
// "Shortlisted"), the same mapping the Admin Overview and Applications pages
// already use.
const APPLICATION_STATUS_TONES = {
  applied: { tone: 'new' },
  'under-review': { tone: 'reviewing' },
  interview: { tone: 'interview' },
  offer: { tone: 'shortlisted' },
  hired: { tone: 'hired' },
  rejected: { tone: 'rejected' },
};

const statusLabel = (status) => ADMIN_STATUS_LABELS[status] || status;

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

// Union the locations seen so far with the ones just returned, keeping the
// selected value present. Without this, filtering by a location would shrink
// the dropdown to just that location and leave no way back to "Any location".
const mergeLocations = (previous, incoming, selected) => {
  const set = new Set(previous);
  for (const value of incoming) if (value) set.add(value);
  if (selected && selected !== 'all') set.add(selected);
  return [...set].sort();
};

/**
 * AdminJobseekersPage - the /admin/jobseekers workspace.
 *
 * Fully backed by GET /api/admin/jobseekers (list) and GET
 * /api/admin/jobseekers/:userId (detail). Search, the location and date
 * filters, ordering, and paging all run on the server, so the page keeps no
 * second copy of the list to filter locally and the footer counts are real
 * totals.
 *
 * Rows come from each account's JOBSEEKER workspace profile, so a person whose
 * account is currently active in the recruiter workspace still appears here.
 *
 * There is no status column or status filter: the User model has no status
 * field, so no activity state can be reported for an account without inventing
 * one. The row's action menu therefore offers "View profile" instead.
 */
export default function AdminJobseekersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Debounced term actually sent to the server; `searchInput` is what the box
  // holds, so typing does not fire a request per keystroke.
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [dateRange, setDateRange] = useState('');

  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [locations, setLocations] = useState([]);

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  // Bumped to re-run the detail request without changing the selection.
  const [detailNonce, setDetailNonce] = useState(0);

  const [activeMenuId, setActiveMenuId] = useState(null);

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

  useEffect(() => {
    const timer = setTimeout(() => setQ(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Any filter or search change jumps back to page 1 and clears the selection
  // so it never points at a row that left the visible page. Only reacts to an
  // actual filter change, so a refresh with ?page=N never drops the param.
  const filterKey = JSON.stringify({ q, locationFilter, dateRange });
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
      const data = await getAdminJobseekers({
        page,
        limit: PAGE_SIZE,
        q,
        location: locationFilter,
        dateRange,
      });
      setList(data);
      setLocations((prev) =>
        mergeLocations(
          prev,
          (data.jobseekers || []).map((j) => j.location),
          locationFilter
        )
      );
    } catch (err) {
      setError(err);
      setList(null);
    } finally {
      setLoading(false);
    }
  }, [page, q, locationFilter, dateRange]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // Load the selected jobseeker's real profile. The row already in hand drives
  // the panel header so selecting a row feels instant; the request fills in the
  // contact details and the real recent-applications list.
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
      return undefined;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    getAdminJobseeker(selectedId)
      .then((data) => {
        if (!cancelled) setDetail(data.jobseeker);
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

  const filtersActive = q !== '' || locationFilter !== 'all' || dateRange !== '';

  const clearFilters = useCallback(() => {
    setSearchInput('');
    setLocationFilter('all');
    setDateRange('');
  }, []);

  // Selection is deliberate only: a row is picked by clicking it, never by the
  // page loading or the result set changing.
  const selectJobseeker = useCallback((id) => {
    setSelectedId(id);
    setActiveMenuId(null);
  }, []);

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

  // Opens the real applicant profile on the existing
  // /admin/jobseekers/:userId route, which reads the jobseeker's own workspace
  // profile regardless of the account's active workspace.
  const viewProfile = useCallback(
    (jobseeker) => {
      setActiveMenuId(null);
      navigate(`/admin/jobseekers/${jobseeker.id}`, { state: { from: '/admin/jobseekers' } });
    },
    [navigate]
  );

  const total = list?.total ?? 0;
  const totalPages = Math.max(1, list?.totalPages ?? 1);
  const rows = list?.jobseekers ?? [];
  const listStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const listEnd = Math.min(page * PAGE_SIZE, total);

  // An out-of-range ?page=N (a stale deep link, or the last page disappearing
  // after a filter change) is repaired instead of showing an empty table.
  useEffect(() => {
    if (loading || error) return;
    if (total > 0 && page > totalPages) goToPage(totalPages, { replace: true });
  }, [loading, error, total, page, totalPages, goToPage]);

  const selected = rows.find((j) => String(j.id) === String(selectedId)) || null;

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
              id="admin-jobseekers-location"
              name="location"
              className="admin-jobseekers-filter-select"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              aria-label="Location"
              options={[{ value: 'all', label: 'Any location' }, ...locations.map((name) => ({ value: name, label: name }))]}
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
              <col className="admin-jobseekers-col-applications" />
              <col className="admin-jobseekers-col-saved" />
              <col className="admin-jobseekers-col-joined" />
              <col className="admin-jobseekers-col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th className="admin-jobseekers-col-jobseeker">Jobseeker</th>
                <th className="admin-jobseekers-col-location">Location</th>
                <th className="admin-jobseekers-col-applications">Applications</th>
                <th className="admin-jobseekers-col-saved">Saved Jobs</th>
                <th className="admin-jobseekers-col-joined">Joined</th>
                <th className="admin-jobseekers-col-actions">
                  <span className="admin-jobseekers-sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-jobseekers-state">
                    <span className="admin-jobseekers-state-title">Loading jobseekers...</span>
                    <span className="admin-jobseekers-state-text">
                      Fetching the latest jobseekers from the server.
                    </span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="admin-jobseekers-state">
                    <span className="admin-jobseekers-state-title">Unable to load jobseekers</span>
                    <span className="admin-jobseekers-state-text">
                      {error?.message || 'Something went wrong while fetching jobseekers.'}
                    </span>
                    <button type="button" className="admin-jobseekers-btn" onClick={loadList}>
                      Try again
                    </button>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-jobseekers-state">
                    <span className="admin-jobseekers-state-title">No jobseekers found</span>
                    <span className="admin-jobseekers-state-text">
                      {filtersActive
                        ? 'Try adjusting your search or filters.'
                        : 'No jobseeker profiles have been created yet.'}
                    </span>
                    {filtersActive && (
                      <button type="button" className="admin-jobseekers-btn" onClick={clearFilters}>
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((jobseeker) => {
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
                            src={jobseeker.avatarUrl ? resolveMediaUrl(jobseeker.avatarUrl) : null}
                            fallbackSrc={avatarFallback(jobseeker.name, jobseeker.email)}
                            imgClassName="admin-jobseekers-avatar"
                            placeholderClassName="admin-jobseekers-avatar admin-jobseekers-avatar--initials"
                            imgAlt=""
                            iconSize={14}
                          />
                          <span className="admin-jobseekers-person-text">
                            <span className="admin-jobseekers-person-name">{jobseeker.name}</span>
                            <span className="admin-jobseekers-person-email">{jobseeker.email || '—'}</span>
                          </span>
                        </span>
                      </td>
                      <td className="admin-jobseekers-col-location">
                        <span className="admin-jobseekers-location">{jobseeker.location || '—'}</span>
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
                        <RowActions
                          jobseeker={jobseeker}
                          open={activeMenuId === String(jobseeker.id)}
                          onToggle={() =>
                            setActiveMenuId((prev) =>
                              prev === String(jobseeker.id) ? null : String(jobseeker.id)
                            )
                          }
                          onClose={() => setActiveMenuId(null)}
                          onViewProfile={viewProfile}
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
            {loading && rows.length === 0 ? (
              'Loading jobseekers...'
            ) : error ? (
              'Jobseekers could not be loaded'
            ) : (
              <>
                Showing <strong>{listStart}–{listEnd}</strong> of <strong>{total}</strong> jobseekers
              </>
            )}
          </p>
          {!loading && !error && totalPages > 1 && (
            <nav className="admin-jobseekers-pagination" aria-label="Jobseekers pagination">
              <button
                type="button"
                className="admin-jobseekers-page-btn admin-jobseekers-page-btn--nav"
                onClick={() => goToPage(Math.max(1, page - 1))}
                disabled={page <= 1}
              >
                {ARROW_LEFT}
                Previous
              </button>
              {getPageItems(page, totalPages).map((item, index) =>
                item === '…' ? (
                  <span key={`gap-${index}`} className="admin-jobseekers-page-gap">
                    {item}
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    className={`admin-jobseekers-page-btn${item === page ? ' admin-jobseekers-page-btn--current' : ''}`}
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
                className="admin-jobseekers-page-btn admin-jobseekers-page-btn--nav"
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

      <aside className="admin-jobseekers-panel" aria-label="Jobseeker details">
        {selected ? (
          <DetailPanel
            jobseeker={selected}
            detail={detail}
            loading={detailLoading}
            error={detailError}
            onRetry={reloadDetail}
            onViewApplications={viewApplications}
            onViewProfile={viewProfile}
          />
        ) : (
          <div className="admin-jobseekers-panel-state">
            <span className="admin-jobseekers-state-title">Select a jobseeker</span>
            <span className="admin-jobseekers-state-text">
              Choose a jobseeker from the list to view their details here.
            </span>
          </div>
        )}
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Row action menu - compact three-dot menu with the same interaction        */
/* language as the other Admin workspaces: portaled to <body>, anchored near  */
/* the trigger, closed on outside click / Escape / scroll / resize.          */
/* ------------------------------------------------------------------------ */

function RowActions({ jobseeker, open, onToggle, onClose, onViewProfile }) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e) => {
      const inMenu = menuRef?.current?.contains(e.target);
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
            <button
              type="button"
              role="menuitem"
              className="admin-jobseekers-menu-item"
              onClick={() => onViewProfile(jobseeker)}
            >
              <span className="admin-jobseekers-menu-check" />
              <span className="admin-jobseekers-menu-item-label">View profile</span>
            </button>
          </div>,
          document.body
        )}
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* Right-side detail panel - contextual inspector for the selected jobseeker. */
/* Header stays free of a status badge: there is no account status to report. */
/* The header renders from the list row so the panel fills instantly; the     */
/* sections below render from the loaded profile so contact details and the   */
/* recent-applications list are the real values.                              */
/* ------------------------------------------------------------------------ */

function DetailPanel({
  jobseeker,
  detail,
  loading,
  error,
  onRetry,
  onViewApplications,
  onViewProfile,
}) {
  const name = detail?.fullName || jobseeker.name;
  const email = detail?.email || jobseeker.email || '—';
  const phone = detail?.phone || jobseeker.phone || '—';
  const location = detail?.location || jobseeker.location || '—';
  const applications = detail?.applications ?? jobseeker.applications;
  const savedJobs = detail?.savedJobs ?? jobseeker.savedJobs;
  const recent = detail?.recentApplications || [];

  return (
    <div className="admin-jobseekers-detail">
      <header className="admin-jobseekers-detail-head">
        <Avatar
          src={
            detail?.avatarUrl || jobseeker.avatarUrl
              ? resolveMediaUrl(detail?.avatarUrl || jobseeker.avatarUrl)
              : null
          }
          fallbackSrc={avatarFallback(name, email)}
          imgClassName="admin-jobseekers-avatar admin-jobseekers-detail-avatar"
          placeholderClassName="admin-jobseekers-avatar admin-jobseekers-avatar--initials admin-jobseekers-detail-avatar"
          imgAlt=""
          iconSize={16}
        />
        <div className="admin-jobseekers-detail-titles">
          <h2 className="admin-jobseekers-detail-name">{name}</h2>
          <p className="admin-jobseekers-detail-email">{email}</p>
          {location !== '—' && (
            <p className="admin-jobseekers-detail-location">{location}</p>
          )}
        </div>
      </header>

      {error ? (
        <div className="admin-jobseekers-panel-state">
          <span className="admin-jobseekers-state-title">Unable to load this profile</span>
          <span className="admin-jobseekers-state-text">
            {error?.message || 'Something went wrong while fetching the profile.'}
          </span>
          <button type="button" className="admin-jobseekers-btn" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : loading && !detail ? (
        <div className="admin-jobseekers-panel-state">
          <span className="admin-jobseekers-state-title">Loading profile...</span>
          <span className="admin-jobseekers-state-text">
            Fetching this jobseeker's details from the server.
          </span>
        </div>
      ) : (
        <>
          <section className="admin-jobseekers-detail-section">
            <h3 className="admin-jobseekers-detail-sub">Profile</h3>
            <dl className="admin-jobseekers-detail-list">
              <div className="admin-jobseekers-detail-row">
                <dt>Full name</dt>
                <dd>{name}</dd>
              </div>
              <div className="admin-jobseekers-detail-row">
                <dt>Email</dt>
                <dd>{email}</dd>
              </div>
              <div className="admin-jobseekers-detail-row">
                <dt>Phone</dt>
                <dd>{phone}</dd>
              </div>
              <div className="admin-jobseekers-detail-row">
                <dt>Location</dt>
                <dd>{location}</dd>
              </div>
            </dl>
          </section>

          <section className="admin-jobseekers-detail-section">
            <h3 className="admin-jobseekers-detail-sub">Activity</h3>
            <dl className="admin-jobseekers-detail-list">
              <div className="admin-jobseekers-detail-row">
                <dt>Applications</dt>
                <dd>{applications}</dd>
              </div>
              <div className="admin-jobseekers-detail-row">
                <dt>Saved jobs</dt>
                <dd>{savedJobs}</dd>
              </div>
              <div className="admin-jobseekers-detail-row">
                <dt>Joined</dt>
                <dd>{formatJoinedDate(jobseeker.joinedAt)}</dd>
              </div>
            </dl>
          </section>

          <section className="admin-jobseekers-detail-section">
            <h3 className="admin-jobseekers-detail-sub">Recent applications</h3>
            {loading && !detail ? (
              <p className="admin-jobseekers-detail-empty">Loading applications...</p>
            ) : recent.length === 0 ? (
              <p className="admin-jobseekers-detail-empty">No applications yet.</p>
            ) : (
              <ul className="admin-jobseekers-recent">
                {recent.map((item, index) => {
                  const tone = APPLICATION_STATUS_TONES[item.status] || APPLICATION_STATUS_TONES.applied;
                  return (
                    <li key={`${item.id}-${index}`} className="admin-jobseekers-recent-item">
                      <span className="admin-jobseekers-recent-job">{item.job}</span>
                      <span className="admin-jobseekers-recent-meta">
                        <span className="admin-jobseekers-recent-company">{item.company}</span>
                        <span className={`admin-jobseekers-recent-status admin-jobseekers-recent-status--${tone.tone}`}>
                          {statusLabel(item.status)}
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
                onClick={() => onViewProfile(jobseeker)}
              >
                View Profile
              </button>
              <button
                type="button"
                className="admin-jobseekers-btn"
                onClick={() => onViewApplications(jobseeker)}
              >
                View Applications
              </button>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
