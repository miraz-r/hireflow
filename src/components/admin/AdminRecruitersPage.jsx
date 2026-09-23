import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Select from '../ui/Select';
import Toast from '../Toast';
import './AdminRecruitersPage.css';

const PAGE_SIZE = 10;

const STATUS_META = {
  active: { label: 'Active', tone: 'active' },
  suspended: { label: 'Suspended', tone: 'suspended' },
  pending: { label: 'Pending', tone: 'pending' },
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

// Static per-company extras used by the detail panel. Mock data until the
// admin recruiters API exists; joined dates are fixed so the date filter can
// still compare them against today.
const COMPANY_META = {
  'Stark Industries': { website: 'starkindustries.com', status: 'active' },
  'LexCorp': { website: 'lexcorp.com', status: 'active' },
  'Aperture Science': { website: 'aperturescience.com', status: 'active' },
  'OmniCorp': { website: 'omnicorp.com', status: 'active' },
  'Umbrella Corp.': { website: 'umbrellacorp.com', status: 'suspended' },
};

const MOCK_RECRUITERS = [
  { id: '1', name: 'Daniel Morgan', email: 'daniel.morgan@stark.com', phone: '+1 (212) 555-0147', location: 'New York, NY', company: 'Stark Industries', status: 'active', jobs: 15, applications: 120, joinedAt: '2026-09-01T10:00:00.000Z' },
  { id: '2', name: 'Sophia Carter', email: 'sophia.carter@lexcorp.com', phone: '+1 (415) 555-0192', location: 'San Francisco, CA', company: 'LexCorp', status: 'active', jobs: 12, applications: 98, joinedAt: '2026-09-05T10:00:00.000Z' },
  { id: '3', name: 'Marcus Lee', email: 'marcus.lee@aperture.com', phone: '+1 (512) 555-0114', location: 'Austin, TX', company: 'Aperture Science', status: 'pending', jobs: 8, applications: 42, joinedAt: '2026-10-10T10:00:00.000Z' },
  { id: '4', name: 'Ava Williams', email: 'ava.williams@omnicorp.com', phone: '+1 (425) 555-0168', location: 'Seattle, WA', company: 'OmniCorp', status: 'active', jobs: 20, applications: 178, joinedAt: '2026-08-12T10:00:00.000Z' },
  { id: '5', name: 'Leo Garcia', email: 'leo.garcia@umbrella.com', phone: '+1 (305) 555-0121', location: 'Miami, FL', company: 'Umbrella Corp.', status: 'suspended', jobs: 6, applications: 34, joinedAt: '2025-11-15T10:00:00.000Z' },
  { id: '6', name: 'Emily Tran', email: 'emily.tran@stark.com', phone: '+1 (312) 555-0183', location: 'Chicago, IL', company: 'Stark Industries', status: 'active', jobs: 18, applications: 143, joinedAt: '2026-06-02T10:00:00.000Z' },
  { id: '7', name: 'Noah Patel', email: 'noah.patel@omnicorp.com', phone: '+1 (206) 555-0159', location: 'Seattle, WA', company: 'OmniCorp', status: 'pending', jobs: 4, applications: 21, joinedAt: '2026-11-01T10:00:00.000Z' },
  { id: '8', name: 'Mia Kowalski', email: 'mia.kowalski@lexcorp.com', phone: '+1 (646) 555-0117', location: 'New York, NY', company: 'LexCorp', status: 'active', jobs: 11, applications: 87, joinedAt: '2026-07-19T10:00:00.000Z' },
  { id: '9', name: 'Lucas Braun', email: 'lucas.braun@aperture.com', phone: '+1 (617) 555-0198', location: 'Boston, MA', company: 'Aperture Science', status: 'suspended', jobs: 5, applications: 29, joinedAt: '2025-10-08T10:00:00.000Z' },
  { id: '10', name: 'Hannah Kim', email: 'hannah.kim@stark.com', phone: '+1 (213) 555-0134', location: 'Los Angeles, CA', company: 'Stark Industries', status: 'active', jobs: 14, applications: 105, joinedAt: '2026-04-25T10:00:00.000Z' },
  { id: '11', name: 'Oliver Bennett', email: 'oliver.bennett@umbrella.com', phone: '+1 (303) 555-0165', location: 'Denver, CO', company: 'Umbrella Corp.', status: 'active', jobs: 9, applications: 51, joinedAt: '2026-02-14T10:00:00.000Z' },
  { id: '12', name: 'Zoe Chen', email: 'zoe.chen@omnicorp.com', phone: '+1 (408) 555-0127', location: 'San Jose, CA', company: 'OmniCorp', status: 'pending', jobs: 3, applications: 10, joinedAt: '2026-11-20T10:00:00.000Z' },
  { id: '13', name: 'Adrian Foster', email: 'adrian.foster@aperture.com', phone: '+1 (602) 555-0140', location: 'Phoenix, AZ', company: 'Aperture Science', status: 'active', jobs: 16, applications: 122, joinedAt: '2026-01-30T10:00:00.000Z' },
  { id: '14', name: 'Nora Silva', email: 'nora.silva@lexcorp.com', phone: '+1 (713) 555-0189', location: 'Houston, TX', company: 'LexCorp', status: 'suspended', jobs: 7, applications: 39, joinedAt: '2025-09-17T10:00:00.000Z' },
  { id: '15', name: 'Ethan Brooks', email: 'ethan.brooks@stark.com', phone: '+1 (404) 555-0172', location: 'Atlanta, GA', company: 'Stark Industries', status: 'active', jobs: 13, applications: 96, joinedAt: '2026-03-11T10:00:00.000Z' },
];

const initialOf = (name) => (name || '?').trim().charAt(0).toUpperCase();

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
 * AdminRecruitersPage - the /admin/recruiters workspace.
 *
 * Lists recruiters with local search (name/email/company) plus status, company,
 * and date filters, selected-row state, a compact row action menu, pagination,
 * and a right-side detail panel for the selected recruiter. Data is UI mock
 * data for now; status changes stay local for the current session.
 */
export default function AdminRecruitersPage() {
  const [recruiters, setRecruiters] = useState(MOCK_RECRUITERS);
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('all');
  const [company, setCompany] = useState('all');
  const [dateRange, setDateRange] = useState('');
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3200);
  }, []);

  // Any filter or search change jumps back to page 1 and clears the selection
  // so it never points at a row that left the visible page.
  useEffect(() => {
    setPage(1);
    setSelectedId(null);
  }, [searchInput, status, company, dateRange]);

  const uniqueCompanies = useMemo(
    () => [...new Set(recruiters.map((r) => r.company))].sort(),
    [recruiters]
  );

  const filtered = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    return recruiters.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (company !== 'all' && r.company !== company) return false;
      if (dateRange) {
        const cutoff = new Date();
        if (dateRange === 'today') {
          cutoff.setHours(0, 0, 0, 0);
        } else {
          cutoff.setDate(cutoff.getDate() - Number(dateRange));
        }
        if (new Date(r.joinedAt) < cutoff) return false;
      }
      if (q) {
        const haystack = `${r.name} ${r.email} ${r.company}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [recruiters, searchInput, status, company, dateRange]);

  const filtersActive = searchInput !== '' || status !== 'all' || company !== 'all' || dateRange !== '';

  const clearFilters = useCallback(() => {
    setSearchInput('');
    setStatus('all');
    setCompany('all');
    setDateRange('');
  }, []);

  const selectRecruiter = useCallback((id) => {
    setSelectedId(id);
    setActiveMenuId(null);
  }, []);

  const changeStatus = useCallback(
    (id, nextStatus) => {
      setActiveMenuId(null);
      setRecruiters((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: nextStatus } : r))
      );
      const recruiter = recruiters.find((r) => r.id === id);
      if (recruiter) {
        showToast(`“${recruiter.name}” moved to ${STATUS_META[nextStatus].label.toLowerCase()} status`);
      }
    },
    [recruiters, showToast]
  );

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const listStart = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const listEnd = Math.min(safePage * PAGE_SIZE, total);

  // Read the selection straight from the live list so a status change lands in
  // both the table row and the detail panel on the same render.
  const selected =
    recruiters.find((r) => String(r.id) === String(selectedId)) || null;

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
              id="admin-recruiters-status"
              name="status"
              className="admin-recruiters-filter-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Status"
              options={[
                { value: 'all', label: 'All statuses' },
                ...STATUS_OPTIONS.map((value) => ({ value, label: STATUS_META[value].label })),
              ]}
            />
          </div>
          <div className="admin-recruiters-filter">
            <Select
              id="admin-recruiters-company"
              name="company"
              className="admin-recruiters-filter-select"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              aria-label="Company"
              options={[{ value: 'all', label: 'All companies' }, ...uniqueCompanies.map((name) => ({ value: name, label: name }))]}
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
              <col className="admin-recruiters-col-status" />
              <col className="admin-recruiters-col-jobs" />
              <col className="admin-recruiters-col-applications" />
              <col className="admin-recruiters-col-joined" />
              <col className="admin-recruiters-col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th className="admin-recruiters-col-recruiter">Recruiter</th>
                <th className="admin-recruiters-col-company">Company</th>
                <th className="admin-recruiters-col-status">Status</th>
                <th className="admin-recruiters-col-jobs">Jobs</th>
                <th className="admin-recruiters-col-applications">Applications</th>
                <th className="admin-recruiters-col-joined">Joined</th>
                <th className="admin-recruiters-col-actions">
                  <span className="admin-recruiters-sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-recruiters-state">
                    <span className="admin-recruiters-state-title">No recruiters found</span>
                    <span className="admin-recruiters-state-text">
                      Try adjusting your search or filters.
                    </span>
                    {filtersActive && (
                      <button type="button" className="admin-recruiters-btn" onClick={clearFilters}>
                        Clear Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                pageItems.map((recruiter) => {
                  const meta = STATUS_META[recruiter.status] || STATUS_META.active;
                  const isSelected = String(recruiter.id) === String(selectedId);
                  return (
                    <tr
                      key={recruiter.id}
                      className={`admin-recruiters-row${isSelected ? ' admin-recruiters-row--selected' : ''}`}
                      onClick={() => selectRecruiter(recruiter.id)}
                    >
                      <td className="admin-recruiters-col-recruiter">
                        <span className="admin-recruiters-recruiter">
                          <span className="admin-recruiters-avatar admin-recruiters-avatar--initials" aria-hidden="true">
                            {initialOf(recruiter.name)}
                          </span>
                          <span className="admin-recruiters-recruiter-text">
                            <span className="admin-recruiters-recruiter-name">{recruiter.name}</span>
                            <span className="admin-recruiters-recruiter-email">{recruiter.email}</span>
                          </span>
                        </span>
                      </td>
                      <td className="admin-recruiters-col-company">
                        <span className="admin-recruiters-company">{recruiter.company}</span>
                      </td>
                      <td className="admin-recruiters-col-status">
                        <span className={`admin-recruiters-badge admin-recruiters-badge--${meta.tone}`}>
                          {meta.label}
                        </span>
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
                        <RowMenu
                          recruiter={recruiter}
                          open={activeMenuId === String(recruiter.id)}
                          onToggle={() =>
                            setActiveMenuId((prev) =>
                              prev === String(recruiter.id) ? null : String(recruiter.id)
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

        <footer className="admin-recruiters-footer">
          <p className="admin-recruiters-footer-count">
            Showing <strong>{listStart}–{listEnd}</strong> of <strong>{total}</strong> recruiters
          </p>
          {totalPages > 1 && (
            <nav className="admin-recruiters-pagination" aria-label="Recruiters pagination">
              <button
                type="button"
                className="admin-recruiters-page-btn admin-recruiters-page-btn--nav"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
              >
                {ARROW_LEFT}
                Previous
              </button>
              {getPageItems(safePage, totalPages).map((item, index) =>
                item === '…' ? (
                  <span key={`gap-${index}`} className="admin-recruiters-page-gap">
                    {item}
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    className={`admin-recruiters-page-btn${item === safePage ? ' admin-recruiters-page-btn--current' : ''}`}
                    onClick={() => setPage(item)}
                    aria-label={`Go to page ${item}`}
                    aria-current={item === safePage ? 'page' : undefined}
                  >
                    {item}
                  </button>
                )
              )}
              <button
                type="button"
                className="admin-recruiters-page-btn admin-recruiters-page-btn--nav"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
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
          <DetailPanel recruiter={selected} notify={showToast} />
        ) : (
          <div className="admin-recruiters-panel-state">
            <span className="admin-recruiters-state-title">Select a recruiter</span>
            <span className="admin-recruiters-state-text">
              Choose a recruiter from the list to view their details here.
            </span>
          </div>
        )}
      </aside>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Row action menu - compact three-dot menu portaled to <body>, anchored     */
/* near the trigger, closed on outside click / Escape / scroll / resize.    */
/* The single action, Change Status, opens a status submenu that flips the   */
/* local mock status.                                                        */
/* ------------------------------------------------------------------------ */

function RowMenu({ recruiter, open, onToggle, onClose, onChangeStatus }) {
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
            {statusView ? (
              <>
                <div className="admin-recruiters-menu-head">
                  <button
                    type="button"
                    className="admin-recruiters-menu-subhead"
                    onClick={() => setStatusView(false)}
                    aria-label="Back"
                  >
                    {ARROW_LEFT}
                  </button>
                  <span className="admin-recruiters-menu-label">Change status</span>
                </div>
                <div className="admin-recruiters-menu-divider" />
                {STATUS_OPTIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={recruiter.status === value}
                    className={`admin-recruiters-menu-item${
                      recruiter.status === value ? ' admin-recruiters-menu-item--selected' : ''
                    }`}
                    onClick={() => onChangeStatus(recruiter.id, value)}
                  >
                    <span className="admin-recruiters-menu-check">
                      {recruiter.status === value ? CHECK_ICON : null}
                    </span>
                    <span className="admin-recruiters-menu-item-label">{STATUS_META[value].label}</span>
                  </button>
                ))}
              </>
            ) : (
              <button
                type="button"
                role="menuitem"
                className="admin-recruiters-menu-item"
                onClick={() => setStatusView(true)}
              >
                <span className="admin-recruiters-menu-check" />
                <span className="admin-recruiters-menu-item-label">Change Status</span>
                <span className="admin-recruiters-menu-chevron" aria-hidden="true">{ARROW_RIGHT}</span>
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* Right-side detail panel - contextual inspector for the selected row.      */
/* There is no company route yet, so View Company surfaces feedback through  */
/* the existing Toast.                                                       */
/* ------------------------------------------------------------------------ */

function DetailPanel({ recruiter, notify }) {
  const companyMeta = COMPANY_META[recruiter.company] || { website: '—', status: 'active' };
  const companyStatus = STATUS_META[companyMeta.status] || STATUS_META.active;

  return (
    <div className="admin-recruiters-detail">
      <header className="admin-recruiters-detail-head">
        <span
          className="admin-recruiters-avatar admin-recruiters-avatar--initials admin-recruiters-detail-avatar"
          aria-hidden="true"
        >
          {initialOf(recruiter.name)}
        </span>
        <div className="admin-recruiters-detail-titles">
          <h2 className="admin-recruiters-detail-name">{recruiter.name}</h2>
          <p className="admin-recruiters-detail-email">{recruiter.email}</p>
        </div>
      </header>

      <section className="admin-recruiters-detail-section">
        <h3 className="admin-recruiters-detail-sub">Recruiter</h3>
        <dl className="admin-recruiters-detail-list">
          <div className="admin-recruiters-detail-row">
            <dt>Full name</dt>
            <dd>{recruiter.name}</dd>
          </div>
          <div className="admin-recruiters-detail-row">
            <dt>Email</dt>
            <dd>{recruiter.email}</dd>
          </div>
          <div className="admin-recruiters-detail-row">
            <dt>Phone</dt>
            <dd>{recruiter.phone}</dd>
          </div>
          <div className="admin-recruiters-detail-row">
            <dt>Location</dt>
            <dd>{recruiter.location}</dd>
          </div>
        </dl>
      </section>

      <section className="admin-recruiters-detail-section">
        <h3 className="admin-recruiters-detail-sub">Company</h3>
        <dl className="admin-recruiters-detail-list">
          <div className="admin-recruiters-detail-row">
            <dt>Company name</dt>
            <dd>{recruiter.company}</dd>
          </div>
          <div className="admin-recruiters-detail-row">
            <dt>Company website</dt>
            <dd>{companyMeta.website}</dd>
          </div>
          <div className="admin-recruiters-detail-row">
            <dt>Company status</dt>
            <dd>{companyStatus.label}</dd>
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
            onClick={() => notify('Company profiles are not available in this preview.')}
          >
            View Company
          </button>
        </div>
      </footer>
    </div>
  );
}