import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Select from '../ui/Select';
import { getAdminActivity } from '../../utils/adminApi';
import './AdminActivityPage.css';

const PAGE_SIZE = 10;

const ARROW_LEFT_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 18 9 12 15 6" />
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

const X_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/**
 * Event type filter options, in canonical pipeline order.
 *
 * The ids are exactly the `type` values the API returns, so the filter and the
 * feed can never drift apart. A dual-workspace account registers once, and is
 * reported under the workspace it signed up in.
 */
const TYPE_OPTIONS = [
  { value: 'all', label: 'All activity' },
  { value: 'application-created', label: 'Applications received' },
  { value: 'job-created', label: 'Jobs posted' },
  { value: 'job-updated', label: 'Job listing updates' },
  { value: 'jobseeker-registered', label: 'Jobseekers registered' },
  { value: 'recruiter-registered', label: 'Recruiters joined' },
];

const formatEventDate = (iso) => {
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
 * AdminActivityPage - the /admin/activity workspace, and the destination of the
 * Analytics "View all activity" link.
 *
 * Fully backed by GET /api/admin/activity. The feed is reconstructed on the
 * server from timestamps that already exist - application arrivals, job
 * postings and edits, and account registrations - because no audit-log record is
 * stored. Nothing here is invented and there is no mock fallback: a failed
 * request renders an error with a retry rather than placeholder rows.
 *
 * The third column is "Detail", not "User". The feed has no single actor field:
 * an application event's entity is the applicant, while a job event's entity is
 * the listing. The label already names what happened, so the informative field
 * is the detail, exactly as the Analytics activity card renders it.
 */
export default function AdminActivityPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // The type filter and the page both live in the URL, so a refresh or a
  // Back/Forward step restores the exact view.
  const typeParam = searchParams.get('type') || 'all';
  const type = TYPE_OPTIONS.some((option) => option.value === typeParam)
    ? typeParam
    : 'all';

  const pageParam = Number.parseInt(searchParams.get('page') || '', 10);
  const pageInvalid = !(Number.isInteger(pageParam) && pageParam > 0);
  const page = pageInvalid ? 1 : pageParam;

  const setParams = useCallback(
    (next, { replace = false } = {}) => {
      const params = new URLSearchParams(searchParams);
      for (const key of ['page', 'type']) params.delete(key);
      if (next.type && next.type !== 'all') params.set('type', next.type);
      if (next.page && next.page > 1) params.set('page', String(next.page));
      if (params.toString() === searchParams.toString()) return;
      setSearchParams(params, { replace });
    },
    [searchParams, setSearchParams]
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminActivity({ page, limit: PAGE_SIZE, type });
      setList(data);
    } catch (err) {
      setError(err);
      setList(null);
    } finally {
      setLoading(false);
    }
  }, [page, type]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const changeType = useCallback(
    (next) => {
      // A new filter starts at page 1: page 4 of the old filter says nothing
      // about page 1 of the new one.
      setParams({ page: 1, type: next });
    },
    [setParams]
  );

  const total = list?.total ?? 0;
  const totalPages = Math.max(1, list?.totalPages ?? 1);
  const rows = list?.items ?? [];
  const listStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const listEnd = Math.min(page * PAGE_SIZE, total);

  const filtersActive = type !== 'all';

  const clearFilters = useCallback(() => {
    setParams({ page: 1, type: 'all' });
  }, [setParams]);

  // An out-of-range ?page=N (a stale deep link, or the last page disappearing
  // after a filter change) is repaired to a valid page instead of silently
  // showing an empty table. Waited on the request so the page number is never
  // compared against totals the server has not returned yet.
  useEffect(() => {
    if (loading || error) return;
    if (pageInvalid) setParams({ page: 1, type }, { replace: true });
    else if (total > 0 && page > totalPages) setParams({ page: totalPages, type }, { replace: true });
  }, [loading, error, pageInvalid, total, page, totalPages, type, setParams]);

  // Two events can share a label and a timestamp to the millisecond, so the row
  // key includes the type and position rather than assuming uniqueness.
  const rowKeys = useMemo(() => rows.map((item, index) => `${item.type}-${item.at}-${index}`), [rows]);

  return (
    <div className="admin-page admin-activity-page">
      <section className="admin-activity-page-card" aria-labelledby="admin-activity-title">
        <div className="admin-activity-page-card-head">
          <div className="admin-activity-page-card-headings">
            <h2 className="admin-activity-page-card-title" id="admin-activity-title">
              Platform Activity
            </h2>
            <p className="admin-activity-page-card-sub">
              Newest first. Job postings and edits, applications received, and new
              jobseeker and recruiter accounts.
            </p>
          </div>
          <Link to="/admin/analytics" className="admin-activity-page-back">
            {ARROW_LEFT_ICON}
            Back to Analytics
          </Link>
        </div>

        <div className="admin-activity-page-toolbar">
          <div className="admin-activity-page-filter">
            <Select
              id="admin-activity-page-type"
              name="type"
              className="admin-activity-page-filter-select"
              value={type}
              onChange={(e) => changeType(e.target.value)}
              aria-label="Activity type"
              options={TYPE_OPTIONS}
            />
          </div>
          {filtersActive && (
            <button type="button" className="admin-activity-page-clear" onClick={clearFilters}>
              {X_ICON}
              Clear filter
            </button>
          )}
        </div>

        <div className="admin-activity-page-table-scroll">
          <table className="admin-activity-page-table">
            <colgroup>
              <col className="admin-activity-page-col-activity" />
              <col className="admin-activity-page-col-detail" />
              <col className="admin-activity-page-col-date" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Activity</th>
                <th scope="col">Detail</th>
                <th scope="col">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="admin-activity-page-state">
                    <span className="admin-activity-page-state-title">Loading activity...</span>
                    <span className="admin-activity-page-state-text">
                      Fetching the latest events from the server.
                    </span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={3} className="admin-activity-page-state">
                    <span className="admin-activity-page-state-title">Unable to load activity</span>
                    <span className="admin-activity-page-state-text">
                      {error?.message || 'Something went wrong while fetching activity.'}
                    </span>
                    <button type="button" className="admin-activity-page-btn" onClick={loadList}>
                      Try again
                    </button>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="admin-activity-page-state">
                    <span className="admin-activity-page-state-title">
                      {filtersActive ? 'No activity of this type' : 'No activity yet'}
                    </span>
                    <span className="admin-activity-page-state-text">
                      {filtersActive
                        ? 'Try a different activity type.'
                        : 'Jobs, applications and new accounts will appear here as they happen.'}
                    </span>
                    {filtersActive && (
                      <button type="button" className="admin-activity-page-btn" onClick={clearFilters}>
                        Show all activity
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((item, index) => (
                  <tr key={rowKeys[index]}>
                    <td className="admin-activity-page-cell-activity">
                      <span className="admin-activity-page-label">{item.label || item.type}</span>
                      {item.entity && (
                        <span className="admin-activity-page-entity">{item.entity}</span>
                      )}
                    </td>
                    <td className="admin-activity-page-cell-detail">{item.detail || '—'}</td>
                    <td className="admin-activity-page-cell-date">{formatEventDate(item.at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="admin-activity-page-foot">
          <p className="admin-activity-page-foot-count">
            {loading && rows.length === 0 ? (
              'Loading activity...'
            ) : error ? (
              'Activity could not be loaded'
            ) : total === 0 ? (
              'No recent events'
            ) : (
              <>
                Showing <strong>{listStart}–{listEnd}</strong> of <strong>{total}</strong>{' '}
                {total === 1 ? 'event' : 'events'}
              </>
            )}
          </p>
          {!loading && !error && totalPages > 1 && (
            <nav className="admin-activity-page-pagination" aria-label="Activity pagination">
              <button
                type="button"
                className="admin-activity-page-page-btn admin-activity-page-page-btn--nav"
                onClick={() => setParams({ page: Math.max(1, page - 1), type })}
                disabled={page <= 1}
              >
                {ARROW_LEFT}
                Previous
              </button>
              {getPageItems(page, totalPages).map((item, index) =>
                item === '…' ? (
                  <span key={`gap-${index}`} className="admin-activity-page-page-gap">
                    {item}
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    className={`admin-activity-page-page-btn${item === page ? ' admin-activity-page-page-btn--current' : ''}`}
                    onClick={() => setParams({ page: item, type })}
                    aria-label={`Go to page ${item}`}
                    aria-current={item === page ? 'page' : undefined}
                  >
                    {item}
                  </button>
                )
              )}
              <button
                type="button"
                className="admin-activity-page-page-btn admin-activity-page-page-btn--nav"
                onClick={() => setParams({ page: Math.min(totalPages, page + 1), type })}
                disabled={page >= totalPages}
              >
                Next
                {ARROW_RIGHT}
              </button>
            </nav>
          )}
        </footer>
      </section>
    </div>
  );
}