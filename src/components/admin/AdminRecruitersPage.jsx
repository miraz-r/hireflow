import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Select from '../ui/Select';
import Avatar from '../Avatar';
import { avatarFallback, resolveMediaUrl } from '../../lib/media';
import { getAdminRecruiters } from '../../utils/adminApi';
import './AdminRecruitersPage.css';

const PAGE_SIZE = 10;

const DATE_OPTIONS = [
  { value: '', label: 'Any date' },
  { value: 'today', label: 'Today' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

// The account's active workspace, as reported by the API. `User.role` records
// only where the person is working right now, which is not the same question as
// which workspaces they hold.
const WORKSPACE_LABELS = {
  jobseeker: 'Jobseeker',
  recruiter: 'Recruiter',
  admin: 'Admin',
};

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

// Union the companies seen so far with the ones just returned, keeping the
// selected value present. Without this, filtering by a company would shrink the
// dropdown to just that company and leave no way back to "All companies".
const mergeCompanies = (previous, incoming, selected) => {
  const set = new Set(previous);
  for (const value of incoming) if (value) set.add(value);
  if (selected && selected !== 'all') set.add(selected);
  return [...set].sort();
};

/**
 * AdminRecruitersPage - the /admin/recruiters workspace.
 *
 * Fully backed by GET /api/admin/recruiters. Search, the company and date
 * filters, ordering, and paging all run on the server, so the page keeps no
 * second copy of the list to filter locally and the footer counts are real
 * totals.
 *
 * Rows come from each account's RECRUITER workspace profile, so a person whose
 * account is currently active in the jobseeker workspace still appears here.
 *
 * There is no status column, status filter, or status action: the User model
 * has no status field, so no activity state can be reported for an account
 * without inventing one. The row menu therefore offers the one real
 * cross-workspace action instead.
 *
 * There is also no detail request. Every value the detail panel shows is
 * already on the list row, so the panel renders from it directly rather than
 * paying for a second round trip.
 */
export default function AdminRecruitersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Debounced term actually sent to the server; `searchInput` is what the box
  // holds, so typing does not fire a request per keystroke.
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [dateRange, setDateRange] = useState('');

  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [companies, setCompanies] = useState([]);

  const [selectedId, setSelectedId] = useState(null);
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
  const filterKey = JSON.stringify({ q, companyFilter, dateRange });
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
      const data = await getAdminRecruiters({
        page,
        limit: PAGE_SIZE,
        q,
        company: companyFilter,
        dateRange,
      });
      setList(data);
      setCompanies((prev) =>
        mergeCompanies(
          prev,
          (data.recruiters || []).map((r) => r.company),
          companyFilter
        )
      );
    } catch (err) {
      setError(err);
      setList(null);
    } finally {
      setLoading(false);
    }
  }, [page, q, companyFilter, dateRange]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const filtersActive = q !== '' || companyFilter !== 'all' || dateRange !== '';

  const clearFilters = useCallback(() => {
    setSearchInput('');
    setCompanyFilter('all');
    setDateRange('');
  }, []);

  // Selection is deliberate only: a row is picked by clicking it, never by the
  // page loading or the result set changing.
  const selectRecruiter = useCallback((id) => {
    setSelectedId(id);
    setActiveMenuId(null);
  }, []);

  // Hands the selected recruiter's activity over to the existing Admin
  // Applications workspace, which seeds its search box from ?search= and so
  // already resolves the applications posted on this recruiter's jobs. No new
  // page and no extra state.
  const viewApplications = useCallback(
    (recruiter) => {
      setActiveMenuId(null);
      navigate(`/admin/applications?search=${encodeURIComponent(recruiter.name)}`);
    },
    [navigate]
  );

  const total = list?.total ?? 0;
  const totalPages = Math.max(1, list?.totalPages ?? 1);
  const rows = list?.recruiters ?? [];
  const listStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const listEnd = Math.min(page * PAGE_SIZE, total);

  // An invalid or out-of-range ?page=N (a stale deep link, or the last page
  // disappearing after a filter change) is repaired to a valid page instead of
  // silently showing an empty table. Waited on the request so a page number is
  // never compared against totals the server has not returned yet.
  useEffect(() => {
    if (loading || error) return;
    if (pageInvalid) goToPage(1, { replace: true });
    else if (total > 0 && page > totalPages) goToPage(totalPages, { replace: true });
  }, [loading, error, pageInvalid, total, page, totalPages, goToPage]);

  const selected = useMemo(
    () => rows.find((r) => String(r.id) === String(selectedId)) || null,
    [rows, selectedId]
  );

  return (
    <div className="admin-page admin-recruiters">
      <section className="admin-recruiters-card" aria-label="Recruiters list">
        <div className="admin-recruiters-toolbar">
          <div className="admin-recruiters-search">
            <span className="admin-recruiters-search-icon" aria-hidden="true">{SEARCH_ICON}</span>
            <input
              type="text"
              id="admin-recruiters-search"
              name="search"
              className="admin-recruiters-search-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search recruiters or companies..."
              aria-label="Search recruiters"
            />
            {searchInput && (
              <button
                type="button"
                className="admin-recruiters-search-clear"
                onClick={() => setSearchInput('')}
                aria-label="Clear search"
              >
                {X_ICON}
              </button>
            )}
          </div>

          <div className="admin-recruiters-filter">
            <Select
              id="admin-recruiters-company"
              name="company"
              className="admin-recruiters-filter-select"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              aria-label="Company"
              options={[{ value: 'all', label: 'All companies' }, ...companies.map((name) => ({ value: name, label: name }))]}
            />
          </div>
          <div className="admin-recruiters-filter">
            <Select
              id="admin-recruiters-date"
              name="dateRange"
              className="admin-recruiters-filter-select"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              aria-label="Date"
              options={DATE_OPTIONS}
            />
          </div>

          {filtersActive && (
            <button type="button" className="admin-recruiters-clear" onClick={clearFilters}>
              {X_ICON}
              Clear Filters
            </button>
          )}
        </div>

        <div className="admin-recruiters-table-scroll">
          <table className="admin-recruiters-table">
            <colgroup>
              <col className="admin-recruiters-col-recruiter" />
              <col className="admin-recruiters-col-company" />
              <col className="admin-recruiters-col-jobs" />
              <col className="admin-recruiters-col-applications" />
              <col className="admin-recruiters-col-joined" />
              <col className="admin-recruiters-col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th className="admin-recruiters-col-recruiter">Recruiter</th>
                <th className="admin-recruiters-col-company">Company</th>
                <th className="admin-recruiters-col-jobs">Jobs</th>
                <th className="admin-recruiters-col-applications">Applications</th>
                <th className="admin-recruiters-col-joined">Joined</th>
                <th className="admin-recruiters-col-actions">
                  <span className="admin-recruiters-sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-recruiters-state">
                    <span className="admin-recruiters-state-title">Loading recruiters...</span>
                    <span className="admin-recruiters-state-text">
                      Fetching the latest recruiters from the server.
                    </span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="admin-recruiters-state">
                    <span className="admin-recruiters-state-title">Unable to load recruiters</span>
                    <span className="admin-recruiters-state-text">
                      {error?.message || 'Something went wrong while fetching recruiters.'}
                    </span>
                    <button type="button" className="admin-recruiters-btn" onClick={loadList}>
                      Try again
                    </button>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-recruiters-state">
                    <span className="admin-recruiters-state-title">No recruiters found</span>
                    <span className="admin-recruiters-state-text">
                      {filtersActive
                        ? 'Try adjusting your search or filters.'
                        : 'No recruiter profiles have been created yet.'}
                    </span>
                    {filtersActive && (
                      <button type="button" className="admin-recruiters-btn" onClick={clearFilters}>
                        Clear Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((recruiter) => {
                  const isSelected = String(recruiter.id) === String(selectedId);
                  return (
                    <tr
                      key={recruiter.id}
                      className={`admin-recruiters-row${isSelected ? ' admin-recruiters-row--selected' : ''}`}
                      onClick={() => selectRecruiter(recruiter.id)}
                    >
                      <td className="admin-recruiters-col-recruiter">
                        <span className="admin-recruiters-recruiter">
                          <Avatar
                            src={recruiter.avatarUrl ? resolveMediaUrl(recruiter.avatarUrl) : null}
                            fallbackSrc={avatarFallback(recruiter.name, recruiter.email)}
                            imgClassName="admin-recruiters-avatar"
                            placeholderClassName="admin-recruiters-avatar admin-recruiters-avatar--initials"
                            imgAlt=""
                            iconSize={14}
                          />
                          <span className="admin-recruiters-recruiter-text">
                            <span className="admin-recruiters-recruiter-name">{recruiter.name}</span>
                            <span className="admin-recruiters-recruiter-email">{recruiter.email || '—'}</span>
                          </span>
                        </span>
                      </td>
                      <td className="admin-recruiters-col-company">
                        <span className="admin-recruiters-company">{recruiter.company || '—'}</span>
                      </td>
                      <td className="admin-recruiters-col-jobs">
                        <span className="admin-recruiters-count">{recruiter.jobs}</span>
                      </td>
                      <td className="admin-recruiters-col-applications">
                        <span className="admin-recruiters-count">{recruiter.applications}</span>
                      </td>
                      <td className="admin-recruiters-col-joined">
                        <span className="admin-recruiters-date">{formatJoinedDate(recruiter.joinedAt)}</span>
                      </td>
                      <td className="admin-recruiters-col-actions" onClick={(e) => e.stopPropagation()}>
                        <RowActions
                          recruiter={recruiter}
                          open={activeMenuId === String(recruiter.id)}
                          onToggle={() =>
                            setActiveMenuId((prev) =>
                              prev === String(recruiter.id) ? null : String(recruiter.id)
                            )
                          }
                          onClose={() => setActiveMenuId(null)}
                          onViewApplications={viewApplications}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <footer className="admin-recruiters-footer">
          <p className="admin-recruiters-footer-count">
            {loading && rows.length === 0 ? (
              'Loading recruiters...'
            ) : error ? (
              'Recruiters could not be loaded'
            ) : (
              <>
                Showing <strong>{listStart}–{listEnd}</strong> of <strong>{total}</strong> recruiters
              </>
            )}
          </p>
          {!loading && !error && totalPages > 1 && (
            <nav className="admin-recruiters-pagination" aria-label="Recruiters pagination">
              <button
                type="button"
                className="admin-recruiters-page-btn admin-recruiters-page-btn--nav"
                onClick={() => goToPage(Math.max(1, page - 1))}
                disabled={page <= 1}
              >
                {ARROW_LEFT}
                Previous
              </button>
              {getPageItems(page, totalPages).map((item, index) =>
                item === '…' ? (
                  <span key={`gap-${index}`} className="admin-recruiters-page-gap">
                    {item}
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    className={`admin-recruiters-page-btn${item === page ? ' admin-recruiters-page-btn--current' : ''}`}
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
                className="admin-recruiters-page-btn admin-recruiters-page-btn--nav"
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

      <aside className="admin-recruiters-panel" aria-label="Recruiter details">
        {selected ? (
          <DetailPanel recruiter={selected} onViewApplications={viewApplications} />
        ) : (
          <div className="admin-recruiters-panel-state">
            <span className="admin-recruiters-state-title">Select a recruiter</span>
            <span className="admin-recruiters-state-text">
              Choose a recruiter from the list to view their details here.
            </span>
          </div>
        )}
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Row action menu - compact three-dot menu with the same interaction        */
/* language as the other Admin workspaces: portaled to <body>, anchored near */
/* the trigger, closed on outside click / Escape / scroll / resize.          */
/* ------------------------------------------------------------------------ */

function RowActions({ recruiter, open, onToggle, onClose, onViewApplications }) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);

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
        className={`admin-recruiters-menu-btn${open ? ' admin-recruiters-menu-btn--open' : ''}`}
        onClick={onToggle}
        aria-label={`Actions for ${recruiter.name}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {MORE_ICON}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="admin-recruiters-menu"
            role="menu"
            aria-label={`Actions for ${recruiter.name}`}
            style={{
              ...(pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }),
              minWidth: 196,
            }}
          >
            <button
              type="button"
              role="menuitem"
              className="admin-recruiters-menu-item"
              onClick={() => onViewApplications(recruiter)}
            >
              <span className="admin-recruiters-menu-check" />
              <span className="admin-recruiters-menu-item-label">View applications</span>
            </button>
          </div>,
          document.body
        )}
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* Right-side detail panel - contextual inspector for the selected recruiter. */
/* Every value shown here is already on the list row, so the panel renders     */
/* from that row directly and needs no second request.                        */
/* ------------------------------------------------------------------------ */

function DetailPanel({ recruiter, onViewApplications }) {
  const name = recruiter.name;
  const email = recruiter.email || '—';
  const website = recruiter.companyWebsite || '—';

  return (
    <div className="admin-recruiters-detail">
      <header className="admin-recruiters-detail-head">
        <Avatar
          src={recruiter.avatarUrl ? resolveMediaUrl(recruiter.avatarUrl) : null}
          fallbackSrc={avatarFallback(name, email)}
          imgClassName="admin-recruiters-avatar admin-recruiters-detail-avatar"
          placeholderClassName="admin-recruiters-avatar admin-recruiters-avatar--initials admin-recruiters-detail-avatar"
          imgAlt=""
          iconSize={16}
        />
        <div className="admin-recruiters-detail-titles">
          <h2 className="admin-recruiters-detail-name">{name}</h2>
          <p className="admin-recruiters-detail-email">{email}</p>
        </div>
      </header>

      <section className="admin-recruiters-detail-section">
        <h3 className="admin-recruiters-detail-sub">Recruiter</h3>
        <dl className="admin-recruiters-detail-list">
          <div className="admin-recruiters-detail-row">
            <dt>Full name</dt>
            <dd>{name}</dd>
          </div>
          <div className="admin-recruiters-detail-row">
            <dt>Email</dt>
            <dd>{email}</dd>
          </div>
          <div className="admin-recruiters-detail-row">
            <dt>Phone</dt>
            <dd>{recruiter.phone || '—'}</dd>
          </div>
          <div className="admin-recruiters-detail-row">
            <dt>Location</dt>
            <dd>{recruiter.location || '—'}</dd>
          </div>
          {/* Where the account is working right now. Reported because it is not
              the same question as "is this a recruiter": an account can hold
              this recruiter profile while being active in the jobseeker
              workspace. */}
          <div className="admin-recruiters-detail-row">
            <dt>Active workspace</dt>
            <dd>{WORKSPACE_LABELS[recruiter.activeWorkspace] || recruiter.activeWorkspace || '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="admin-recruiters-detail-section">
        <h3 className="admin-recruiters-detail-sub">Company</h3>
        <dl className="admin-recruiters-detail-list">
          <div className="admin-recruiters-detail-row">
            <dt>Company name</dt>
            <dd>{recruiter.company || '—'}</dd>
          </div>
          <div className="admin-recruiters-detail-row">
            <dt>Company website</dt>
            <dd>{website}</dd>
          </div>
        </dl>
      </section>

      <section className="admin-recruiters-detail-section">
        <h3 className="admin-recruiters-detail-sub">Activity</h3>
        <dl className="admin-recruiters-detail-list">
          <div className="admin-recruiters-detail-row">
            <dt>Jobs posted</dt>
            <dd>{recruiter.jobs}</dd>
          </div>
          <div className="admin-recruiters-detail-row">
            <dt>Applications received</dt>
            <dd>{recruiter.applications}</dd>
          </div>
          <div className="admin-recruiters-detail-row">
            <dt>Joined</dt>
            <dd>{formatJoinedDate(recruiter.joinedAt)}</dd>
          </div>
        </dl>
      </section>

      <footer className="admin-recruiters-detail-actions">
        <div className="admin-recruiters-detail-actions-row">
          <button
            type="button"
            className="admin-recruiters-btn"
            onClick={() => onViewApplications(recruiter)}
          >
            View Applications
          </button>
        </div>
      </footer>
    </div>
  );
}