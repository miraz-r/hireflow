import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import Select from '../ui/Select';
import Toast from '../Toast';
import CompanyLogo from '../CompanyLogo';
import './AdminCompaniesPage.css';

const PAGE_SIZE = 10;

const STATUS_META = {
  active: { label: 'Active', tone: 'active' },
  pending: { label: 'Pending', tone: 'pending' },
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

const MOCK_COMPANIES = [
  { id: '1', name: 'Stark Industries', domain: 'starkindustries.com', industry: 'Aerospace & Defense', status: 'active', recruiters: 4, jobs: 12, applications: 84, joinedAt: '2026-10-12T10:00:00.000Z', location: 'New York, NY', contact: 'Pepper Potts', email: 'pepper.potts@starkindustries.com', phone: '+1 (212) 555-0147', mark: { bg: '#dbeafe', fg: '#1d4ed8' } },
  { id: '2', name: 'LexCorp', domain: 'lexcorp.com', industry: 'Conglomerate', status: 'active', recruiters: 3, jobs: 9, applications: 61, joinedAt: '2026-09-01T10:00:00.000Z', location: 'Metropolis, DE', contact: 'Talia al Ghul', email: 'talia@lexcorp.com', phone: '+1 (302) 555-0192', mark: { bg: '#e5e7eb', fg: '#111827' } },
  { id: '3', name: 'Aperture Science', domain: 'aperturescience.com', industry: 'Research & Development', status: 'pending', recruiters: 2, jobs: 6, applications: 37, joinedAt: '2026-09-18T10:00:00.000Z', location: 'Ann Arbor, MI', contact: 'Cave Johnson', email: 'cave.johnson@aperturescience.com', phone: '+1 (734) 555-0114', mark: { bg: '#fae8e7', fg: '#b91c1c' } },
  { id: '4', name: 'OmniCorp', domain: 'omnicorp.com', industry: 'Robotics', status: 'active', recruiters: 3, jobs: 11, applications: 73, joinedAt: '2026-08-05T10:00:00.000Z', location: 'Burbank, CA', contact: 'Andrew Miles', email: 'andrew.miles@omnicorp.com', phone: '+1 (818) 555-0168', mark: { bg: '#dcfce7', fg: '#15803d' } },
  { id: '5', name: 'Umbrella Corp.', domain: 'umbrella.com', industry: 'Pharmaceuticals', status: 'suspended', recruiters: 2, jobs: 4, applications: 19, joinedAt: '2026-07-22T10:00:00.000Z', location: 'Raccoon City, OR', contact: 'Albert Wesker', email: 'a.wesker@umbrella.com', phone: '+1 (503) 555-0121', mark: { bg: '#fce7f0', fg: '#be185d' } },
  { id: '6', name: 'Wayne Enterprises', domain: 'wayneenterprises.com', industry: 'Conglomerate', status: 'active', recruiters: 2, jobs: 8, applications: 52, joinedAt: '2026-06-30T10:00:00.000Z', location: 'Gotham City, NJ', contact: 'Lucius Fox', email: 'lucius.fox@wayneenterprises.com', phone: '+1 (201) 555-0183', mark: { bg: '#dbe7f3', fg: '#1e3a5f' } },
  { id: '7', name: 'Hooli', domain: 'hooli.com', industry: 'Technology', status: 'active', recruiters: 3, jobs: 15, applications: 96, joinedAt: '2026-06-12T10:00:00.000Z', location: 'Glendale, CA', contact: 'Gavin Belson', email: 'gavin@hooli.com', phone: '+1 (818) 555-0159', mark: { bg: '#e0f2fe', fg: '#0369a1' } },
  { id: '8', name: 'Initech', domain: 'initech.com', industry: 'Software', status: 'active', recruiters: 2, jobs: 7, applications: 44, joinedAt: '2026-05-08T10:00:00.000Z', location: 'Austin, TX', contact: 'Bill Lumbergh', email: 'bill@initech.com', phone: '+1 (512) 555-0117', mark: { bg: '#f1f5f9', fg: '#475569' } },
  { id: '9', name: 'Globex Corporation', domain: 'globex.com', industry: 'Manufacturing', status: 'pending', recruiters: 1, jobs: 3, applications: 12, joinedAt: '2026-04-21T10:00:00.000Z', location: 'Springfield, IL', contact: 'Hank Scorpio', email: 'hank.scorpio@globex.com', phone: '+1 (217) 555-0198', mark: { bg: '#fef3c7', fg: '#b45309' } },
  { id: '10', name: 'Vandelay Industries', domain: 'vandelay.com', industry: 'Import & Export', status: 'active', recruiters: 2, jobs: 5, applications: 28, joinedAt: '2026-03-15T10:00:00.000Z', location: 'New York, NY', contact: 'Art Vandelay', email: 'art.vandelay@vandelay.com', phone: '+1 (212) 555-0134', mark: { bg: '#f3e8ff', fg: '#6b21a8' } },
  { id: '11', name: 'Cyberdyne Systems', domain: 'cyberdyne.com', industry: 'Robotics', status: 'suspended', recruiters: 1, jobs: 2, applications: 9, joinedAt: '2026-02-02T10:00:00.000Z', location: 'El Segundo, CA', contact: 'Miles Dyson', email: 'm.dyson@cyberdyne.com', phone: '+1 (310) 555-0165', mark: { bg: '#e2e8f0', fg: '#334155' } },
  { id: '12', name: 'Sirius Cybernetics', domain: 'siriuscybernetics.com', industry: 'AI & Software', status: 'active', recruiters: 2, jobs: 6, applications: 33, joinedAt: '2026-01-20T10:00:00.000Z', location: 'London, UK', contact: 'Trillian Astra', email: 'trillian@siriuscybernetics.com', phone: '+44 (0) 555 0127', mark: { bg: '#e0e7ff', fg: '#4338ca' } },
];

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
 * AdminCompaniesPage - the /admin/companies workspace.
 *
 * Lists companies with local search (name/domain) plus status, industry, and
 * date filters, selected-row state, a compact row action menu, and pagination.
 * Data is UI mock data for now; status changes stay local for the session.
 * A right-side detail panel is planned for Part 2.
 */
export default function AdminCompaniesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [companies, setCompanies] = useState(MOCK_COMPANIES);
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('all');
  const [industry, setIndustry] = useState('all');
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
  const prevFiltersRef = useRef(`${searchInput}|${status}|${industry}|${dateRange}`);
  useEffect(() => {
    const filtersKey = `${searchInput}|${status}|${industry}|${dateRange}`;
    if (filtersKey === prevFiltersRef.current) return;
    prevFiltersRef.current = filtersKey;
    setSelectedId(null);
    if (searchParams.has('page')) {
      const params = new URLSearchParams(searchParams);
      params.delete('page');
      setSearchParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, status, industry, dateRange]);

  const uniqueIndustries = useMemo(
    () => [...new Set(companies.map((c) => c.industry))].sort(),
    [companies]
  );

  const filtered = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    return companies.filter((company) => {
      if (status !== 'all' && company.status !== status) return false;
      if (industry !== 'all' && company.industry !== industry) return false;
      if (dateRange) {
        const cutoff = new Date();
        if (dateRange === 'today') {
          cutoff.setHours(0, 0, 0, 0);
        } else {
          cutoff.setDate(cutoff.getDate() - Number(dateRange));
        }
        if (new Date(company.joinedAt) < cutoff) return false;
      }
      if (q) {
        const haystack = `${company.name} ${company.domain} ${company.industry}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [companies, searchInput, status, industry, dateRange]);

  const filtersActive = searchInput !== '' || status !== 'all' || industry !== 'all' || dateRange !== '';

  const clearFilters = useCallback(() => {
    setSearchInput('');
    setStatus('all');
    setIndustry('all');
    setDateRange('');
  }, []);

  const selectCompany = useCallback((id) => {
    setSelectedId(id);
    setActiveMenuId(null);
  }, []);

  const changeStatus = useCallback(
    (id, nextStatus) => {
      setActiveMenuId(null);
      setCompanies((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: nextStatus } : c))
      );
      const company = companies.find((c) => c.id === id);
      if (company) {
        showToast(`“${company.name}” moved to ${STATUS_META[nextStatus].label.toLowerCase()} status`);
      }
    },
    [companies, showToast]
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
  // both the table row and the detail panel on the same render.
  const selected =
    companies.find((company) => String(company.id) === String(selectedId)) || null;

  return (
    <div className="admin-page admin-companies">
      <section className="admin-companies-card" aria-label="Companies list">
        <div className="admin-companies-toolbar">
          <div className="admin-companies-search">
            <span className="admin-companies-search-icon" aria-hidden="true">{SEARCH_ICON}</span>
            <input
              type="text"
              id="admin-companies-search"
              name="search"
              className="admin-companies-search-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search companies..."
              aria-label="Search companies"
            />
            {searchInput && (
              <button
                type="button"
                className="admin-companies-search-clear"
                onClick={() => setSearchInput('')}
                aria-label="Clear search"
              >
                {X_ICON}
              </button>
            )}
          </div>

          <div className="admin-companies-filter">
            <Select
              id="admin-companies-status"
              name="status"
              className="admin-companies-filter-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Status"
              options={[
                { value: 'all', label: 'All statuses' },
                ...STATUS_OPTIONS.map((value) => ({ value, label: STATUS_META[value].label })),
              ]}
            />
          </div>
          <div className="admin-companies-filter">
            <Select
              id="admin-companies-industry"
              name="industry"
              className="admin-companies-filter-select"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              aria-label="Industry"
              options={[{ value: 'all', label: 'Any industry' }, ...uniqueIndustries.map((name) => ({ value: name, label: name }))]}
            />
          </div>
          <div className="admin-companies-filter">
            <Select
              id="admin-companies-date"
              name="dateRange"
              className="admin-companies-filter-select"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              aria-label="Date"
              options={DATE_OPTIONS}
            />
          </div>

          {filtersActive && (
            <button type="button" className="admin-companies-clear" onClick={clearFilters}>
              {X_ICON}
              Clear Filters
            </button>
          )}
        </div>

        <div className="admin-companies-table-scroll">
          <table className="admin-companies-table">
            <colgroup>
              <col className="admin-companies-col-company" />
              <col className="admin-companies-col-industry" />
              <col className="admin-companies-col-status" />
              <col className="admin-companies-col-recruiters" />
              <col className="admin-companies-col-jobs" />
              <col className="admin-companies-col-applications" />
              <col className="admin-companies-col-joined" />
              <col className="admin-companies-col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th className="admin-companies-col-company">Company</th>
                <th className="admin-companies-col-industry">Industry</th>
                <th className="admin-companies-col-status">Status</th>
                <th className="admin-companies-col-recruiters">Recruiters</th>
                <th className="admin-companies-col-jobs">Jobs</th>
                <th className="admin-companies-col-applications">Applications</th>
                <th className="admin-companies-col-joined">Joined</th>
                <th className="admin-companies-col-actions">
                  <span className="admin-companies-sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-companies-state">
                    <span className="admin-companies-state-title">No companies found</span>
                    <span className="admin-companies-state-text">
                      Try adjusting your search or filters.
                    </span>
                    {filtersActive && (
                      <button type="button" className="admin-companies-btn" onClick={clearFilters}>
                        Clear Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                pageItems.map((company) => {
                  const meta = STATUS_META[company.status] || STATUS_META.active;
                  const isSelected = String(company.id) === String(selectedId);
                  return (
                    <tr
                      key={company.id}
                      className={`admin-companies-row${isSelected ? ' admin-companies-row--selected' : ''}`}
                      onClick={() => selectCompany(company.id)}
                    >
                      <td className="admin-companies-col-company">
                        <span className="admin-companies-company">
                          <CompanyLogo
                            name={company.name}
                            domain={company.domain}
                            color={company.mark?.bg}
                            initialsStyle={{ backgroundColor: company.mark?.bg, color: company.mark?.fg }}
                            imgClassName="admin-companies-mark"
                            initialsClassName="admin-companies-mark"
                          />
                          <span className="admin-companies-company-text">
                            <span className="admin-companies-company-name">{company.name}</span>
                            <span className="admin-companies-company-domain">{company.domain}</span>
                          </span>
                        </span>
                      </td>
                      <td className="admin-companies-col-industry">
                        <span className="admin-companies-industry">{company.industry}</span>
                      </td>
                      <td className="admin-companies-col-status">
                        <span className={`admin-companies-badge admin-companies-badge--${meta.tone}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="admin-companies-col-recruiters">
                        <span className="admin-companies-count">{company.recruiters}</span>
                      </td>
                      <td className="admin-companies-col-jobs">
                        <span className="admin-companies-count">{company.jobs}</span>
                      </td>
                      <td className="admin-companies-col-applications">
                        <span className="admin-companies-count">{company.applications}</span>
                      </td>
                      <td className="admin-companies-col-joined">
                        <span className="admin-companies-date">{formatJoinedDate(company.joinedAt)}</span>
                      </td>
                      <td className="admin-companies-col-actions" onClick={(e) => e.stopPropagation()}>
                        <RowMenu
                          company={company}
                          open={activeMenuId === String(company.id)}
                          onToggle={() =>
                            setActiveMenuId((prev) =>
                              prev === String(company.id) ? null : String(company.id)
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

        <footer className="admin-companies-footer">
          <p className="admin-companies-footer-count">
            Showing <strong>{listStart}–{listEnd}</strong> of <strong>{total}</strong> companies
          </p>
          {totalPages > 1 && (
            <nav className="admin-companies-pagination" aria-label="Companies pagination">
              <button
                type="button"
                className="admin-companies-page-btn admin-companies-page-btn--nav"
                onClick={() => goToPage(Math.max(1, page - 1))}
                disabled={safePage <= 1}
              >
                {ARROW_LEFT}
                Previous
              </button>
              {getPageItems(safePage, totalPages).map((item, index) =>
                item === '…' ? (
                  <span key={`gap-${index}`} className="admin-companies-page-gap">
                    {item}
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    className={`admin-companies-page-btn${item === safePage ? ' admin-companies-page-btn--current' : ''}`}
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
                className="admin-companies-page-btn admin-companies-page-btn--nav"
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

      <aside className="admin-companies-panel" aria-label="Company details">
        {selected ? (
          <DetailPanel company={selected} notify={showToast} />
        ) : (
          <div className="admin-companies-panel-state">
            <span className="admin-companies-state-title">Select a company</span>
            <span className="admin-companies-state-text">
              Choose a company from the list to view its details here.
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
/* near the trigger, closed on outside click / Escape / scroll / resize.     */
/* Selecting a row already opens the detail panel, so the menu keeps only    */
/* Change Status (Active / Pending / Suspended).                             */
/* ------------------------------------------------------------------------ */

function RowMenu({ company, open, onToggle, onClose, onChangeStatus }) {
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
        className={`admin-companies-menu-btn${open ? ' admin-companies-menu-btn--open' : ''}`}
        onClick={onToggle}
        aria-label={`Actions for ${company.name}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {MORE_ICON}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="admin-companies-menu"
            role="menu"
            aria-label={`Actions for ${company.name}`}
            style={{
              ...(pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }),
              minWidth: 196,
            }}
          >
            {statusView ? (
              <>
                <div className="admin-companies-menu-head">
                  <button
                    type="button"
                    className="admin-companies-menu-subhead"
                    onClick={() => setStatusView(false)}
                    aria-label="Back"
                  >
                    {ARROW_LEFT}
                  </button>
                  <span className="admin-companies-menu-label">Change status</span>
                </div>
                <div className="admin-companies-menu-divider" />
                {STATUS_OPTIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={company.status === value}
                    className={`admin-companies-menu-item${
                      company.status === value ? ' admin-companies-menu-item--selected' : ''
                    }`}
                    onClick={() => onChangeStatus(company.id, value)}
                  >
                    <span className="admin-companies-menu-check">
                      {company.status === value ? CHECK_ICON : null}
                    </span>
                    <span className="admin-companies-menu-item-label">{STATUS_META[value].label}</span>
                  </button>
                ))}
              </>
            ) : (
              <button
                type="button"
                role="menuitem"
                className="admin-companies-menu-item"
                onClick={() => setStatusView(true)}
              >
                <span className="admin-companies-menu-check" />
                <span className="admin-companies-menu-item-label">Change Status</span>
                <span className="admin-companies-menu-chevron" aria-hidden="true">{ARROW_RIGHT}</span>
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
/* Header shows only the mark, name, and domain (no status pill); status     */
/* lives in the row badge and RowMenu. View Recruiters is the single action; */
/* recruiters data is outside this workspace's scope for now, so it surfaces */
/* feedback through the existing Toast.                                      */
/* ------------------------------------------------------------------------ */

function DetailPanel({ company, notify }) {
  return (
    <div className="admin-companies-detail">
      <header className="admin-companies-detail-head">
        <CompanyLogo
          name={company.name}
          domain={company.domain}
          color={company.mark?.bg}
          initialsStyle={{ backgroundColor: company.mark?.bg, color: company.mark?.fg }}
          imgClassName="admin-companies-mark admin-companies-detail-mark"
          initialsClassName="admin-companies-mark admin-companies-detail-mark"
        />
        <div className="admin-companies-detail-titles">
          <h2 className="admin-companies-detail-name">{company.name}</h2>
          <p className="admin-companies-detail-domain">{company.domain}</p>
        </div>
      </header>

      <section className="admin-companies-detail-section">
        <h3 className="admin-companies-detail-sub">Company</h3>
        <dl className="admin-companies-detail-list">
          <div className="admin-companies-detail-row">
            <dt>Industry</dt>
            <dd>{company.industry}</dd>
          </div>
          <div className="admin-companies-detail-row">
            <dt>Location</dt>
            <dd>{company.location}</dd>
          </div>
          <div className="admin-companies-detail-row">
            <dt>Website</dt>
            <dd>{company.domain}</dd>
          </div>
          <div className="admin-companies-detail-row">
            <dt>Joined</dt>
            <dd>{formatJoinedDate(company.joinedAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="admin-companies-detail-section">
        <h3 className="admin-companies-detail-sub">Recruitment</h3>
        <dl className="admin-companies-detail-list">
          <div className="admin-companies-detail-row">
            <dt>Recruiters</dt>
            <dd>{company.recruiters}</dd>
          </div>
          <div className="admin-companies-detail-row">
            <dt>Active jobs</dt>
            <dd>{company.jobs}</dd>
          </div>
          <div className="admin-companies-detail-row">
            <dt>Total applications</dt>
            <dd>{company.applications}</dd>
          </div>
        </dl>
      </section>

      <section className="admin-companies-detail-section">
        <h3 className="admin-companies-detail-sub">Contact</h3>
        <dl className="admin-companies-detail-list">
          <div className="admin-companies-detail-row">
            <dt>Contact person</dt>
            <dd>{company.contact}</dd>
          </div>
          <div className="admin-companies-detail-row">
            <dt>Email</dt>
            <dd>{company.email}</dd>
          </div>
          <div className="admin-companies-detail-row">
            <dt>Phone</dt>
            <dd>{company.phone}</dd>
          </div>
        </dl>
      </section>

      <footer className="admin-companies-detail-actions">
        <div className="admin-companies-detail-actions-row">
          <button
            type="button"
            className="admin-companies-btn"
            onClick={() => notify(`Recruiters for ${company.name} are not available in this preview.`)}
          >
            View Recruiters
          </button>
        </div>
      </footer>
    </div>
  );
}