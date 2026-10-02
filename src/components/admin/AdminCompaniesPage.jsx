import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Select from '../ui/Select';
import CompanyLogo from '../CompanyLogo';
import { getAdminCompanies } from '../../utils/adminApi';
import './AdminCompaniesPage.css';

const PAGE_SIZE = 10;

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

/**
 * Hostname of a stored company website, for the logo lookup and the sub-line.
 *
 * The API returns the website exactly as the recruiter stored it, which is a
 * URL. The logo services and the table sub-line both want a bare host, so this
 * parses the real URL rather than guessing a domain: a company with no website
 * returns '' and falls back to the initials mark, exactly as before.
 */
const hostnameOf = (website) => {
  if (!website) return '';
  try {
    return new URL(website).hostname || '';
  } catch {
    // Stored without a scheme; the value is still real, so read the host from it
    // instead of discarding a website the recruiter actually entered.
    return String(website).split(/[/?#]/)[0].trim();
  }
};

/**
 * AdminCompaniesPage - the /admin/companies workspace.
 *
 * Fully backed by GET /api/admin/companies. Search, the date filter, ordering,
 * and paging all run on the server, so the page keeps no second copy of the list
 * to filter locally and the footer counts are real totals.
 *
 * There is no company record behind these rows: each company is derived from the
 * free-text companyName on real recruiter profiles, so the name is its identity.
 *
 * REMOVED, because nothing stored them and inventing them would be fabrication:
 *   - Status column, status filter, and Change Status. There is no company
 *     status anywhere in the data, so there is nothing to set or report.
 *   - Industry column and filter. No industry is stored on any record.
 *   - Company domain, which used to be a fabricated string. The website now
 *     comes from the recruiters' own `companyWebsite`, and only when they all
 *     agree on one.
 *   - The row action menu and its "View Recruiters" placeholder toast. There is
 *     no company-to-recruiters route to navigate to, and the real destination
 *     (the Recruiters workspace) does not accept a company deep link, so wiring
 *     it would mean changing that page.
 */
export default function AdminCompaniesPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Debounced term actually sent to the server; `searchInput` is what the box
  // holds, so typing does not fire a request per keystroke.
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [dateRange, setDateRange] = useState('');

  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedName, setSelectedName] = useState(null);

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

  // Any filter or search change jumps back to page 1 and clears the selection so
  // it never points at a row that left the visible page. Only reacts to an
  // actual filter change, so a refresh with ?page=N never drops the param.
  const filterKey = JSON.stringify({ q, dateRange });
  const lastFilterKeyRef = useRef(filterKey);
  useEffect(() => {
    if (lastFilterKeyRef.current === filterKey) return;
    lastFilterKeyRef.current = filterKey;
    setSelectedName(null);
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
      const data = await getAdminCompanies({
        page,
        limit: PAGE_SIZE,
        q,
        dateRange,
      });
      setList(data);
    } catch (err) {
      setError(err);
      setList(null);
    } finally {
      setLoading(false);
    }
  }, [page, q, dateRange]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const filtersActive = q !== '' || dateRange !== '';

  const clearFilters = useCallback(() => {
    setSearchInput('');
    setDateRange('');
  }, []);

  // Selection is deliberate only: a row is picked by clicking it, never by the
  // page loading or the result set changing.
  const selectCompany = useCallback((name) => {
    setSelectedName(name);
  }, []);

  const total = list?.total ?? 0;
  const totalPages = Math.max(1, list?.totalPages ?? 1);
  const rows = list?.companies ?? [];
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
    () => rows.find((c) => c.name === selectedName) || null,
    [rows, selectedName]
  );

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
              placeholder="Search companies or recruiters..."
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
              <col className="admin-companies-col-recruiters" />
              <col className="admin-companies-col-jobs" />
              <col className="admin-companies-col-applications" />
              <col className="admin-companies-col-joined" />
            </colgroup>
            <thead>
              <tr>
                <th className="admin-companies-col-company">Company</th>
                <th className="admin-companies-col-recruiters">Recruiters</th>
                <th className="admin-companies-col-jobs">Jobs</th>
                <th className="admin-companies-col-applications">Applications</th>
                <th className="admin-companies-col-joined">Joined</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="admin-companies-state">
                    <span className="admin-companies-state-title">Loading companies...</span>
                    <span className="admin-companies-state-text">
                      Fetching the latest companies from the server.
                    </span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="admin-companies-state">
                    <span className="admin-companies-state-title">Unable to load companies</span>
                    <span className="admin-companies-state-text">
                      {error?.message || 'Something went wrong while fetching companies.'}
                    </span>
                    <button type="button" className="admin-companies-btn" onClick={loadList}>
                      Try again
                    </button>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="admin-companies-state">
                    <span className="admin-companies-state-title">No companies found</span>
                    <span className="admin-companies-state-text">
                      {filtersActive
                        ? 'Try adjusting your search or filters.'
                        : 'No recruiter has named a company yet.'}
                    </span>
                    {filtersActive && (
                      <button type="button" className="admin-companies-btn" onClick={clearFilters}>
                        Clear Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((company) => {
                  const isSelected = company.name === selectedName;
                  return (
                    <tr
                      key={company.id}
                      className={`admin-companies-row${isSelected ? ' admin-companies-row--selected' : ''}`}
                      onClick={() => selectCompany(company.name)}
                    >
                      <td className="admin-companies-col-company">
                        <span className="admin-companies-company">
                          <CompanyLogo
                            name={company.name}
                            domain={hostnameOf(company.companyWebsite)}
                            imgClassName="admin-companies-mark"
                            initialsClassName="admin-companies-mark admin-companies-mark--initials"
                          />
                          <span className="admin-companies-company-text">
                            <span className="admin-companies-company-name">{company.name}</span>
                            <span className="admin-companies-company-domain">
                              {hostnameOf(company.companyWebsite) || '—'}
                            </span>
                          </span>
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
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <footer className="admin-companies-footer">
          <p className="admin-companies-footer-count">
            {loading && rows.length === 0 ? (
              'Loading companies...'
            ) : error ? (
              'Companies could not be loaded'
            ) : (
              <>
                Showing <strong>{listStart}–{listEnd}</strong> of <strong>{total}</strong> companies
              </>
            )}
          </p>
          {!loading && !error && totalPages > 1 && (
            <nav className="admin-companies-pagination" aria-label="Companies pagination">
              <button
                type="button"
                className="admin-companies-page-btn admin-companies-page-btn--nav"
                onClick={() => goToPage(Math.max(1, page - 1))}
                disabled={page <= 1}
              >
                {ARROW_LEFT}
                Previous
              </button>
              {getPageItems(page, totalPages).map((item, index) =>
                item === '…' ? (
                  <span key={`gap-${index}`} className="admin-companies-page-gap">
                    {item}
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    className={`admin-companies-page-btn${item === page ? ' admin-companies-page-btn--current' : ''}`}
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
                className="admin-companies-page-btn admin-companies-page-btn--nav"
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

      <aside className="admin-companies-panel" aria-label="Company details">
        {selected ? (
          <DetailPanel company={selected} />
        ) : (
          <div className="admin-companies-panel-state">
            <span className="admin-companies-state-title">Select a company</span>
            <span className="admin-companies-state-text">
              Choose a company from the list to view their details here.
            </span>
          </div>
        )}
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Right-side detail panel - contextual inspector for the selected company.   */
/* Every value shown here is already on the list row, so the panel renders    */
/* from that row directly and needs no second request.                        */
/* ------------------------------------------------------------------------ */

function DetailPanel({ company }) {
  const website = company.companyWebsite || '';
  const hostname = hostnameOf(website);
  const contact = company.primaryContact;

  return (
    <div className="admin-companies-detail">
      <header className="admin-companies-detail-head">
        <CompanyLogo
          name={company.name}
          domain={hostname}
          imgClassName="admin-companies-mark admin-companies-detail-mark"
          initialsClassName="admin-companies-mark admin-companies-mark--initials admin-companies-detail-mark"
        />
        <div className="admin-companies-detail-titles">
          <h2 className="admin-companies-detail-name">{company.name}</h2>
          <p className="admin-companies-detail-domain">{hostname || 'No website on file'}</p>
        </div>
      </header>

      <section className="admin-companies-detail-section">
        <h3 className="admin-companies-detail-sub">Company</h3>
        <dl className="admin-companies-detail-list">
          <div className="admin-companies-detail-row">
            <dt>Website</dt>
            <dd>{website || '—'}</dd>
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
            <dt>Jobs</dt>
            <dd>{company.jobs}</dd>
          </div>
          <div className="admin-companies-detail-row">
            <dt>Applications received</dt>
            <dd>{company.applications}</dd>
          </div>
        </dl>
      </section>

      {/* Labelled "primary" on purpose: a company can have several recruiters,
          and only one real recruiter record is shown. It is the earliest
          recruiter who named this company, not a company-level contact that the
          platform stores. */}
      <section className="admin-companies-detail-section">
        <h3 className="admin-companies-detail-sub">Primary contact</h3>
        <dl className="admin-companies-detail-list">
          <div className="admin-companies-detail-row">
            <dt>Recruiter</dt>
            <dd>{contact?.name || '—'}</dd>
          </div>
          <div className="admin-companies-detail-row">
            <dt>Job title</dt>
            <dd>{contact?.jobTitle || '—'}</dd>
          </div>
          <div className="admin-companies-detail-row">
            <dt>Email</dt>
            <dd>{contact?.email || '—'}</dd>
          </div>
          <div className="admin-companies-detail-row">
            <dt>Phone</dt>
            <dd>{contact?.phone || '—'}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}