import { useState, useEffect, useLayoutEffect, useRef, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate } from 'react-router-dom';
import { apiGet, apiPatch } from '../utils/api';
import { STATUS_LABELS } from '../constants/applicationStatus';
import { useAuth } from '../context/AuthContext';
import Select from './ui/Select';
import './RecruiterDashboard.css';

const AVATAR_BASE = 'http://localhost:5000';

const PIPELINE = ['applied', 'under-review', 'interview', 'offer', 'hired'];

const STAGE_COLORS = {
  applied: 'var(--color-brand-primary)',
  'under-review': 'var(--color-warning)',
  interview: 'var(--rd-purple)',
  offer: 'var(--color-success)',
  hired: 'var(--color-success)',
};

function Icon({ children, size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ICONS = {
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),
  user: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  check: <polyline points="20 6 9 17 4 12" />,
  arrowRight: (
    <>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </>
  ),
  inbox: (
    <>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </>
  ),
  x: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  briefcase: (
    <>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </>
  ),
};

/* ======================================================================= */
/* Recruiter dashboard: applications for the recruiter's own jobs.          */
/* Renders as a normal HireFlow page (public Navbar/Footer layout) — the    */
/* approved polished content (KPIs, pipeline, jobs, recent applicants,      */
/* activity, applicants workspace) without a separate application shell.    */
/* ======================================================================= */
export default function RecruiterDashboard() {
  const { user } = useAuth();

  const [applications, setApplications] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [jobFilter, setJobFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [detailAppId, setDetailAppId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const detailIdRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiGet('/applications/mine');
        if (!cancelled) setApplications(res.data?.applications || []);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Unable to load your applications.');
          setApplications([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const [activity, setActivity] = useState(null);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await apiGet('/applications/activity');
      setActivity(res.data?.items || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  // Whenever the user ARRIVES at /dashboard from another route (including
  // browser history POP/BACK traversal), the dashboard must open at the top.
  // On a history traversal the browser natively restores the /dashboard entry's
  // previously saved scroll position (e.g. the Applicants section) AFTER this
  // component mounts, overriding any scroll reset. Disabling native restoration
  // here, before the traversal's restore task applies, makes every arrival
  // deterministic at the top. Native restoration is re-enabled on unmount so
  // other routes keep their normal Back/Forward scroll behavior.
  useLayoutEffect(() => {
    history.scrollRestoration = 'manual';
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    return () => {
      history.scrollRestoration = 'auto';
    };
  }, []);

  /* Company name for the page sub-line (non-blocking). */
  useEffect(() => {
    let cancelled = false;
    apiGet('/api/profile', { timeout: 4000 })
      .then((res) => {
        if (!cancelled) setCompanyName(res.data?.companyName || '');
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  /* This route is recruiter-only; keep non-recruiters on their own areas.
     Placed after all hooks so hook order stays stable across renders. */
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'jobseeker') return <Navigate to="/" replace />;

  const handleStatusChange = async (app, newStatus) => {
    if (updatingId === app.id || newStatus === app.status) return;
    setActionError('');
    setUpdatingId(app.id);
    try {
      await apiPatch(`/applications/${app.id}/status`, { status: newStatus });
      setApplications((prev) => prev.map((a) => (a.id === app.id ? { ...a, status: newStatus } : a)));
      fetchActivity();
    } catch (err) {
      setActionError(err?.message || 'Unable to update status. Please try again.');
    } finally {
      setUpdatingId(null);
    }
  };

  const openDetail = async (app) => {
    detailIdRef.current = app.id;
    setDetailAppId(app.id);
    setDetailData(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const res = await apiGet(`/applications/${app.id}`);
      if (detailIdRef.current !== app.id) return;
      setDetailData(res.data);
    } catch (err) {
      if (detailIdRef.current !== app.id) return;
      setDetailError(err?.message || 'Unable to load applicant details.');
    } finally {
      if (detailIdRef.current === app.id) setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    detailIdRef.current = null;
    setDetailAppId(null);
    setDetailData(null);
    setDetailError('');
  };

  const resolveAvatar = (url) =>
    url ? (url.startsWith('http') ? url : `${AVATAR_BASE}${url}`) : null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = (user?.fullName || '').trim().split(/\s+/)[0] || 'Recruiter';

  const fmtDate = (dateStr) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const fmtTimeAgo = (dateStr) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return fmtDate(dateStr);
  };

  const list = applications || [];

  const countByStatus = (items) => {
    const c = {};
    for (const s of PIPELINE) c[s] = 0;
    c.rejected = 0;
    for (const app of items) {
      if (c[app.status] !== undefined) c[app.status]++;
      else if (app.status === 'rejected') c.rejected++;
      else c[app.status] = (c[app.status] || 0) + 1;
    }
    return c;
  };

  const uniqueJobs = [];
  const seenJobIds = new Set();
  for (const app of list) {
    const jid = app.job?.id || app.job?._id;
    if (jid && !seenJobIds.has(String(jid))) {
      seenJobIds.add(String(jid));
      uniqueJobs.push({ id: String(jid), title: app.job?.title || 'Job' });
    }
  }

  const searchTerm = searchQuery.trim().toLowerCase();
  const filtered = list.filter((app) => {
    const okJob = jobFilter === 'all' || String(app.job?.id || app.job?._id) === jobFilter;
    if (!okJob) return false;
    if (!searchTerm) return true;
    const hay = [
      app.applicant?.fullName,
      app.applicant?.headline,
      app.job?.title,
      app.job?.company,
    ].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(searchTerm);
  });

  const metrics = countByStatus(list);
  const total = list.length;

  const jobsByCount = [];
  const jobCountMap = new Map();
  for (const app of list) {
    const jid = String(app.job?.id || app.job?._id);
    if (!jobCountMap.has(jid)) {
      jobCountMap.set(jid, { title: app.job?.title || 'Job', company: app.job?.company || '', count: 0 });
    }
    jobCountMap.get(jid).count++;
  }
  for (const [, v] of jobCountMap) jobsByCount.push(v);
  jobsByCount.sort((a, b) => b.count - a.count);
  const maxJobCount = jobsByCount.length > 0 ? Math.max(...jobsByCount.map((j) => j.count)) : 1;

  const recentApps = [...list]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  const activityItems = (activity || []).map((item) => {
    const name = item.applicant?.fullName || 'Applicant';
    const jobTitle = item.job?.title || 'a job';
    const company = item.job?.company || 'Your listing';
    if (item.type === 'status-changed') {
      return {
        key: item.id,
        status: item.newStatus || 'applied',
        title: `${name} moved to ${STATUS_LABELS[item.newStatus] || item.newStatus}`,
        detail: `${jobTitle} · ${company}`,
        time: fmtTimeAgo(item.at),
      };
    }
    return {
      key: item.id,
      status: 'applied',
      title: 'New application received',
      detail: `${jobTitle} · ${company}`,
      time: fmtTimeAgo(item.at),
    };
  });

  const clearFilters = () => {
    setJobFilter('all');
    setSearchQuery('');
  };

  const pctOf = (n) => (total > 0 ? (n / total) * 100 : 0);

  // "Applicants" / "Review applicants" / "View all" jump to the applicants
  // workspace. They must NOT add a "#applicants" fragment to the URL: a hash
  // on /dashboard is preserved in the history entry, so a later browser Back
  // (e.g. Dashboard -> Post a Job -> Back) restores /dashboard#applicants and
  // ScrollToTop then forces the viewport down to #applicants. Scrolling
  // programmatically keeps the jump but leaves the URL clean, so every history
  // traversal into /dashboard opens at the top.
  const jumpToApplicants = (e) => {
    e.preventDefault();
    document.getElementById('applicants')?.scrollIntoView({ block: 'start' });
    if (window.location.hash) {
      history.replaceState(history.state, '', window.location.pathname + window.location.search);
    }
  };

  return (
    <div className="rd-dashboard">
      <div className="container">
        {error && (
          <div className="rd-alert" role="alert">
            <span>{error}</span>
          </div>
        )}
        {actionError && (
          <div className="rd-alert" role="alert">
            <span>{actionError}</span>
          </div>
        )}

        {loading ? (
          <div className="rd-state" role="status" aria-live="polite">
            <span className="rd-state-spinner" aria-hidden="true" />
            <span className="rd-state-text">Loading your hiring workspace…</span>
          </div>
        ) : list.length === 0 ? (
          <div className="rd-empty">
            <div className="rd-empty-icon" aria-hidden="true">
              <Icon size={32}>{ICONS.inbox}</Icon>
            </div>
            <h2 className="rd-empty-title">No applications yet</h2>
            <p className="rd-empty-desc">
              When jobseekers apply to the jobs you post, their applications will appear here.
              Start by posting a new job to begin building your pipeline.
            </p>
            <div className="rd-empty-actions">
              <Link
                className="btn btn-primary"
                to="/profile?tab=post"
              >
                Post a job
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* ── Page header ───────────────────────────────── */}
            <div className="rd-page-header">
              <div className="rd-page-heading">
                <h1 className="rd-page-title">Dashboard</h1>
                <p className="rd-page-sub">
                  {greeting}, {firstName}. Here's what's happening with your hiring
                  {companyName ? ` at ${companyName}` : ''}.
                </p>
              </div>
              <div className="rd-page-actions">
                <Link
                  className="btn btn-primary"
                  to="/profile?tab=post"
                >
                  <Icon size={16}>{ICONS.briefcase}</Icon>
                  Post a job
                </Link>
              </div>
            </div>

            {/* ── KPI cards ─────────────────────────────────── */}
            <div className="rd-kpis">
              <div className="rd-kpi rd-kpi--brand">
                <div className="rd-kpi-head">
                  <span className="rd-kpi-icon"><Icon size={18}>{ICONS.users}</Icon></span>
                  <span className="rd-kpi-label">Total applicants</span>
                </div>
                <div className="rd-kpi-value">{total}</div>
                <div className="rd-kpi-sub">
                  {total === 1 ? 'candidate' : 'candidates'} across all your jobs
                </div>
                <div className="rd-kpi-strip" aria-hidden="true">
                  {PIPELINE.map((s) => {
                    const w = metrics[s];
                    return w > 0 ? (
                      <span key={s} className="rd-kpi-strip-seg" style={{ flex: w, backgroundColor: STAGE_COLORS[s] }} />
                    ) : null;
                  })}
                  {metrics.rejected > 0 && (
                    <span
                      className="rd-kpi-strip-seg"
                      style={{ flex: metrics.rejected, backgroundColor: 'var(--color-error)' }}
                    />
                  )}
                </div>
              </div>

              <div className="rd-kpi rd-kpi--warning">
                <div className="rd-kpi-head">
                  <span className="rd-kpi-icon"><Icon size={18}>{ICONS.search}</Icon></span>
                  <span className="rd-kpi-label">Under review</span>
                </div>
                <div className="rd-kpi-value">{metrics['under-review']}</div>
                <div className="rd-kpi-sub">actively being screened</div>
                <div className="rd-kpi-track" aria-hidden="true">
                  <div className="rd-kpi-fill" style={{ width: `${pctOf(metrics['under-review'])}%` }} />
                </div>
              </div>

              <div className="rd-kpi rd-kpi--purple">
                <div className="rd-kpi-head">
                  <span className="rd-kpi-icon"><Icon size={18}>{ICONS.user}</Icon></span>
                  <span className="rd-kpi-label">Interviews</span>
                </div>
                <div className="rd-kpi-value">{metrics['interview']}</div>
                <div className="rd-kpi-sub">scheduled conversations</div>
                <div className="rd-kpi-track" aria-hidden="true">
                  <div className="rd-kpi-fill" style={{ width: `${pctOf(metrics['interview'])}%` }} />
                </div>
              </div>

              <div className="rd-kpi rd-kpi--success">
                <div className="rd-kpi-head">
                  <span className="rd-kpi-icon"><Icon size={18}>{ICONS.check}</Icon></span>
                  <span className="rd-kpi-label">Offers &amp; hired</span>
                </div>
                <div className="rd-kpi-value">{metrics['offer'] + metrics['hired']}</div>
                <div className="rd-kpi-sub">successful placements</div>
                <div className="rd-kpi-track" aria-hidden="true">
                  <div className="rd-kpi-fill" style={{ width: `${pctOf(metrics['offer'] + metrics['hired'])}%` }} />
                </div>
              </div>
            </div>

            {/* ── Hiring pipeline + Applications by job ────── */}
            <div className="rd-grid-row">
              <section className="rd-panel" id="pipeline" aria-labelledby="rd-pipe-title">
                <div className="rd-panel-head">
                  <div className="rd-panel-title-wrap">
                    <h2 className="rd-panel-title" id="rd-pipe-title">Hiring pipeline</h2>
                    <span className="rd-panel-sub">{total} total applications</span>
                  </div>
                  <a className="rd-panel-link" href="#applicants" onClick={jumpToApplicants}>
                    Applicants <Icon size={15}>{ICONS.arrowRight}</Icon>
                  </a>
                </div>
                <div className="rd-pipe">
                  {PIPELINE.map((s) => {
                    const count = metrics[s];
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div className="rd-pipe-stage" key={s}>
                        <div className="rd-pipe-head">
                          <span className="rd-pipe-dot" style={{ backgroundColor: STAGE_COLORS[s] }} aria-hidden="true" />
                          <span className="rd-pipe-name">{STATUS_LABELS[s]}</span>
                          <span className="rd-pipe-count">{count}</span>
                        </div>
                        <div className="rd-pipe-track" aria-hidden="true">
                          <div
                            className="rd-pipe-fill"
                            style={{ width: `${pctOf(count)}%`, backgroundColor: STAGE_COLORS[s] }}
                          />
                        </div>
                        {total > 0 && <span className="rd-pipe-pct">{pct}%</span>}
                      </div>
                    );
                  })}
                  {metrics.rejected > 0 && (
                    <div className="rd-pipe-stage">
                      <div className="rd-pipe-head">
                        <span className="rd-pipe-dot" style={{ backgroundColor: 'var(--color-error)' }} aria-hidden="true" />
                        <span className="rd-pipe-name">Rejected</span>
                        <span className="rd-pipe-count">{metrics.rejected}</span>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="rd-panel rd-panel--scroll" aria-labelledby="rd-jobs-title">
                <div className="rd-panel-head">
                  <div className="rd-panel-title-wrap">
                    <h2 className="rd-panel-title" id="rd-jobs-title">Applications by job</h2>
                    <span className="rd-panel-sub">
                      {jobsByCount.length} job{jobsByCount.length === 1 ? '' : 's'} receiving applications
                    </span>
                  </div>
                  <span className="rd-panel-static">All jobs</span>
                </div>
                <div className="rd-jobs-list">
                  {jobsByCount.map((j) => (
                    <div className="rd-job-row" key={j.title}>
                      <div className="rd-job-head">
                        <span className="rd-job-title">{j.title}</span>
                        <span className="rd-job-count">{j.count}</span>
                      </div>
                      <div className="rd-job-track" aria-hidden="true">
                        <div className="rd-job-fill" style={{ width: `${(j.count / maxJobCount) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                {jobsByCount.length > 0 && (
                  <div className="rd-jobs-footer">
                    <a className="rd-panel-link" href="#applicants" onClick={jumpToApplicants}>
                      Review applicants <Icon size={15}>{ICONS.arrowRight}</Icon>
                    </a>
                  </div>
                )}
              </section>
            </div>

            {/* ── Recent applicants + Recent activity ──────── */}
            <div className="rd-grid-row">
              <section className="rd-panel" aria-labelledby="rd-recent-title">
                <div className="rd-panel-head">
                  <div className="rd-panel-title-wrap">
                    <h2 className="rd-panel-title" id="rd-recent-title">Recent applicants</h2>
                    <span className="rd-panel-sub">Latest applications across your jobs</span>
                  </div>
                  <a className="rd-panel-link" href="#applicants" onClick={jumpToApplicants}>
                    View all <Icon size={15}>{ICONS.arrowRight}</Icon>
                  </a>
                </div>
                <div className="rd-table-scroll">
                  <table className="rd-table rd-table--recent">
                    <thead>
                      <tr>
                        <th>Candidate</th>
                        <th>Job</th>
                        <th>Applied</th>
                        <th className="rd-cell-status">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentApps.map((app) => (
                        <tr key={app.id}>
                          <td className="rd-cell-candidate">
                            <div className="rd-candidate">
                              {app.applicant?.avatarUrl ? (
                                <span className="rd-candidate-avatar">
                                  <img className="rd-candidate-avatar-img" src={resolveAvatar(app.applicant.avatarUrl)} alt="" />
                                </span>
                              ) : (
                                <span className="rd-candidate-avatar">
                                  <span className="rd-candidate-avatar-ph" aria-hidden="true">
                                    {(app.applicant?.fullName || 'A').charAt(0).toUpperCase()}
                                  </span>
                                </span>
                              )}
                              <div className="rd-candidate-meta">
                                <span className="rd-candidate-name">{app.applicant?.fullName || 'Applicant'}</span>
                                <span className="rd-candidate-title">{app.applicant?.headline || 'Candidate'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="rd-cell-job">
                            <span className="rd-cell-job-title">{app.job?.title || 'Job'}</span>
                            <span className="rd-cell-job-meta">
                              {app.job?.company}
                              {app.job?.location ? ` · ${app.job.location}` : ''}
                            </span>
                          </td>
                          <td className="rd-cell-date">{fmtDate(app.createdAt)}</td>
                          <td className="rd-cell-status">
                            <span className={`rd-badge rd-badge--${app.status || 'applied'}`}>
                              {STATUS_LABELS[app.status] || app.status || 'Applied'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rd-panel rd-panel--scroll" id="activity" aria-labelledby="rd-activity-title">
                <div className="rd-panel-head">
                  <div className="rd-panel-title-wrap">
                    <h2 className="rd-panel-title" id="rd-activity-title">Recent activity</h2>
                    <span className="rd-panel-sub">Latest updates in your pipeline</span>
                  </div>
                </div>
                <div className="rd-feed">
                  {activityItems.map((item) => (
                    <div className="rd-feed-item" key={item.key}>
                      <span
                        className="rd-feed-dot"
                        style={{ backgroundColor: STAGE_COLORS[item.status] || 'var(--color-error)' }}
                        aria-hidden="true"
                      />
                      <div className="rd-feed-body">
                        <p className="rd-feed-title">{item.title}</p>
                        <p className="rd-feed-detail">{item.detail}</p>
                        <span className="rd-feed-time">{item.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* ── Applicants workspace (full management) ───── */}
            <section className="rd-panel rd-workspace" id="applicants" aria-labelledby="rd-applicants-title">
              <div className="rd-workspace-head">
                <div className="rd-workspace-title-wrap">
                  <h2 className="rd-panel-title" id="rd-applicants-title">Applicants</h2>
                  <span className="rd-workspace-count">
                    {filtered.length} {filtered.length === 1 ? 'candidate' : 'candidates'}
                    {jobFilter !== 'all' || searchQuery ? ' matching filters' : ''}
                  </span>
                </div>
                <div className="rd-workspace-filters">
                  <div className="rd-filter-field">
                    <label className="rd-filter-label sr-only" htmlFor="rd-search">Search applicants or jobs</label>
                    <input
                      id="rd-search"
                      className="rd-search"
                      type="search"
                      placeholder="Search applicants or jobs…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  {uniqueJobs.length > 1 && (
                    <div className="rd-filter-field">
                      <label className="rd-filter-label" htmlFor="rd-workspace-job-select">Filter by job</label>
                      <Select
                        id="rd-workspace-job-select"
                        className="rd-filter-select"
                        value={jobFilter}
                        onChange={(e) => setJobFilter(e.target.value)}
                        options={[
                          { value: 'all', label: 'All jobs' },
                          ...uniqueJobs.map((j) => ({ value: j.id, label: j.title })),
                        ]}
                      />
                    </div>
                  )}
                  {(jobFilter !== 'all' || searchQuery) && (
                    <button type="button" className="btn btn-sm btn-secondary" onClick={clearFilters}>
                      Clear filters
                    </button>
                  )}
                </div>
              </div>

              <div className="rd-table-scroll">
                <table className="rd-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Job</th>
                      <th>Applied</th>
                      <th>Status</th>
                      <th className="rd-cell-status"><span className="sr-only">Details</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((app) => (
                      <tr key={app.id}>
                        <td className="rd-cell-candidate">
                          <div className="rd-candidate">
                            {app.applicant?.avatarUrl ? (
                              <span className="rd-candidate-avatar">
                                <img className="rd-candidate-avatar-img" src={resolveAvatar(app.applicant.avatarUrl)} alt="" />
                              </span>
                            ) : (
                              <span className="rd-candidate-avatar">
                                <span className="rd-candidate-avatar-ph" aria-hidden="true">
                                  {(app.applicant?.fullName || 'A').charAt(0).toUpperCase()}
                                </span>
                              </span>
                            )}
                            <div className="rd-candidate-meta">
                              <span className="rd-candidate-name">{app.applicant?.fullName || 'Applicant'}</span>
                              <span className="rd-candidate-title">{app.applicant?.headline || 'Candidate'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="rd-cell-job">
                          <span className="rd-cell-job-title">{app.job?.title || 'Job'}</span>
                          <span className="rd-cell-job-meta">
                            {app.job?.company}
                            {app.job?.location ? ` · ${app.job.location}` : ''}
                          </span>
                        </td>
                        <td className="rd-cell-date">{fmtDate(app.createdAt)}</td>
                        <td>
                          <div className="rd-status-select-wrap">
                            <label className="sr-only" htmlFor={`app-status-${app.id}`}>
                              Status for {app.applicant?.fullName || 'applicant'}
                            </label>
                            <Select
                              id={`app-status-${app.id}`}
                              className={`rd-status-select rd-status-select--${app.status || 'applied'}`}
                              value={app.status || 'applied'}
                              disabled={updatingId === app.id}
                              onChange={(e) => handleStatusChange(app, e.target.value)}
                              options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                            />
                            {updatingId === app.id && <span className="rd-spinner" aria-hidden="true" />}
                          </div>
                        </td>
                        <td className="rd-cell-status">
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => openDetail(app)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="rd-table-empty" role="status">
                    No applicants match the current filters.
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      <ApplicantDetailModal
        open={Boolean(detailAppId)}
        loading={detailLoading}
        error={detailError}
        data={detailData}
        onClose={closeDetail}
        onRetry={() => openDetail({ id: detailAppId })}
      />
    </div>
  );
}

/* ======================================================================= */
/* Applicant detail modal - fetches GET /applications/:id only when opened. */
/* Portal-backed so the overlay roots at the viewport. Displays ONLY what   */
/* the authorized detail endpoint returns; missing data hides the section.  */
/* ======================================================================= */
function ApplicantDetailModal({ open, loading, error, data, onClose, onRetry }) {
  const titleId = useId();
  const dialogRef = useRef(null);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const scrollY = window.scrollY;

    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const container = dialogRef.current;
      if (!container) return;

      const candidates = container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]'
      );
      const focusable = Array.from(candidates).filter((el) => {
        if (el.tabIndex < 0) return false;
        if (el.hasAttribute('disabled')) return false;
        if (el.hidden || el.getAttribute('aria-hidden') === 'true') return false;
        if (el.getClientRects().length === 0) return false;
        return window.getComputedStyle(el).visibility !== 'hidden';
      });

      if (focusable.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    const raf = window.requestAnimationFrame(() => {
      if (dialogRef.current) {
        dialogRef.current.focus();
      }
    });

    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo({ top: scrollY, left: 0, behavior: 'instant' });
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  const resolveMediaUrl = (url) => (url ? (url.startsWith('http') ? url : `${AVATAR_BASE}${url}`) : '');

  const fmtDate = (dateStr) => {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const applicant = data?.applicant;
  const job = data?.job;
  const status = data?.status;
  const email = applicant?.email;
  const phone = applicant?.phone;
  const resumeUrl = applicant?.resumeUrl;
  const coverLetter = data?.coverLetter;

  return createPortal(
    <div className="rd-detail-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="rd-detail" ref={dialogRef} tabIndex={-1}>
        <div className="rd-detail-top">
          <h3 id={titleId} className="rd-detail-title">Applicant details</h3>
          <button
            type="button"
            className="rd-detail-close"
            onClick={onClose}
            aria-label="Close applicant details"
          >
            <Icon size={16}>{ICONS.x}</Icon>
          </button>
        </div>

        {loading && (
          <div className="rd-detail-state" role="status" aria-live="polite">
            <span className="rd-detail-spinner" aria-hidden="true" />
            <p className="rd-detail-state-text">Loading applicant details…</p>
          </div>
        )}

        {!loading && error && (
          <div className="rd-detail-state">
            <div className="rd-alert" role="alert">
              <span>{error}</span>
            </div>
            <p className="rd-detail-state-text">We could not load this applicant's details. Please try again.</p>
            <div className="rd-detail-state-actions">
              <button type="button" className="btn btn-secondary" onClick={onRetry}>Try again</button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        )}

        {!loading && !error && data && (
          <div className="rd-detail-body">
            <div className="rd-detail-identity">
              <div className="rd-detail-avatar" aria-hidden="true">
                {applicant?.avatarUrl ? (
                  <img className="rd-detail-avatar-img" src={resolveMediaUrl(applicant.avatarUrl)} alt="" />
                ) : (
                  <span className="rd-detail-avatar-ph">{(applicant?.fullName || 'A').charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="rd-detail-identity-text">
                <span className="rd-detail-name">{applicant?.fullName || 'Applicant'}</span>
                {applicant?.headline && <span className="rd-detail-headline">{applicant.headline}</span>}
              </div>
            </div>

            {(email || phone) && (
              <div className="rd-detail-section">
                <h4 className="rd-detail-section-title">Contact</h4>
                <div className="rd-detail-contact">
                  {email && (
                    <a className="btn btn-sm btn-secondary" href={`mailto:${email}`}>
                      Email
                    </a>
                  )}
                  {phone && (
                    <a className="btn btn-sm btn-secondary" href={`tel:${phone}`}>
                      Call
                    </a>
                  )}
                  {phone && (
                    <a className="btn btn-sm btn-secondary" href={`sms:${phone}`}>
                      Text
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="rd-detail-section">
              <h4 className="rd-detail-section-title">Application</h4>
              <dl className="rd-detail-rows">
                <div className="rd-detail-row">
                  <dt>Job</dt>
                  <dd>{job?.title || '-'}</dd>
                </div>
                {job?.company && (
                  <div className="rd-detail-row">
                    <dt>Company</dt>
                    <dd>{job.company}{job?.location ? ` · ${job.location}` : ''}</dd>
                  </div>
                )}
                <div className="rd-detail-row">
                  <dt>Applied</dt>
                  <dd>{fmtDate(data.createdAt) || '-'}</dd>
                </div>
                <div className="rd-detail-row">
                  <dt>Status</dt>
                  <dd>
                    <span className={`rd-status-badge rd-status-badge--${status || 'applied'}`}>
                      {STATUS_LABELS[status] || status || 'Unknown'}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            {resumeUrl && (
              <div className="rd-detail-section">
                <h4 className="rd-detail-section-title">Resume</h4>
                <a
                  className="btn btn-sm btn-secondary"
                  href={resolveMediaUrl(resumeUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View resume
                </a>
              </div>
            )}

            <div className="rd-detail-section">
              <h4 className="rd-detail-section-title">Cover letter</h4>
              {coverLetter ? (
                <p className="rd-detail-letter">{coverLetter}</p>
              ) : (
                <p className="rd-detail-letter rd-detail-letter--empty">No cover letter provided.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}