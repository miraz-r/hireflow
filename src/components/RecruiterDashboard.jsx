import { useState, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { apiGet, apiPatch } from '../utils/api';

const AVATAR_BASE = 'http://localhost:5000';

export const STATUS_LABELS = {
  applied: 'Applied',
  'under-review': 'Under review',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
};

/* ======================================================================= */
/* Recruiter dashboard: applications for the recruiter's own jobs.          */
/* Rendered by the Admin Dashboard (/admin) as the single dashboard view.   */
/* ======================================================================= */
export default function RecruiterDashboard() {
  const [applications, setApplications] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [jobFilter, setJobFilter] = useState('all');
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

  const handleStatusChange = async (app, newStatus) => {
    if (updatingId === app.id || newStatus === app.status) return;
    setActionError('');
    setUpdatingId(app.id);
    try {
      await apiPatch(`/applications/${app.id}/status`, { status: newStatus });
      setApplications((prev) => prev.map((a) => (a.id === app.id ? { ...a, status: newStatus } : a)));
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

  if (loading) return <div className="app-loading" aria-busy="true" />;

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

  const PIPELINE = ['applied', 'under-review', 'interview', 'offer', 'hired'];

  const countByStatus = (list) => {
    const c = {};
    for (const s of PIPELINE) c[s] = 0;
    c.rejected = 0;
    for (const app of list) {
      if (c[app.status] !== undefined) c[app.status]++;
      else if (app.status === 'rejected') c.rejected++;
    }
    return c;
  };

  const uniqueJobs = [];
  const seenJobIds = new Set();
  for (const app of applications) {
    const jid = app.job?.id || app.job?._id;
    if (jid && !seenJobIds.has(String(jid))) {
      seenJobIds.add(String(jid));
      uniqueJobs.push({ id: String(jid), title: app.job?.title || 'Job' });
    }
  }

  const filtered = jobFilter === 'all'
    ? applications
    : applications.filter((app) => String(app.job?.id || app.job?._id) === jobFilter);

  const metrics = countByStatus(filtered);
  const total = filtered.length;

  const jobsByCount = [];
  const jobCountMap = new Map();
  for (const app of applications) {
    const jid = app.job?.id || app.job?._id;
    const key = String(jid);
    if (!jobCountMap.has(key)) {
      jobCountMap.set(key, { title: app.job?.title || 'Job', company: app.job?.company || '', count: 0 });
    }
    jobCountMap.get(key).count++;
  }
  for (const [, v] of jobCountMap) jobsByCount.push(v);
  jobsByCount.sort((a, b) => b.count - a.count);

  const maxJobCount = jobsByCount.length > 0 ? Math.max(...jobsByCount.map((j) => j.count)) : 1;

  const recentApps = [...applications]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  const stageColors = {
    applied: '#4F46E5',
    'under-review': '#6B7280',
    interview: '#7C3AED',
    offer: '#059669',
    hired: '#10B981',
  };

  const header = (
    <>
      <h1 className="rc-header-title">Admin Dashboard</h1>
      <p className="rc-header-sub">Your hiring workspace. Manage your pipeline and applicants.</p>
    </>
  );

  if (total === 0 && !error) {
    return (
      <div className="rc-dashboard">
        <div className="rc-header">
          <div className="rc-header-text">
            {header}
          </div>
        </div>
        <div className="rc-empty-state">
          <div className="rc-empty-icon" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3 className="rc-empty-title">No applications yet</h3>
          <p className="rc-empty-desc">
            When jobseekers apply to the jobs you post, their applications will appear here.
            You can start by posting a new job.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rc-dashboard">
      {/* ── Header / Workspace Context ───────────────────────── */}
      <div className="rc-header">
        <div className="rc-header-text">
          {header}
        </div>
        {uniqueJobs.length > 1 && (
          <div className="rc-job-filter">
            <label className="rc-filter-label" htmlFor="rc-job-select">Filter by job</label>
            <select
              id="rc-job-select"
              className="input rc-filter-select"
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
            >
              <option value="all">All jobs</option>
              {uniqueJobs.map((j) => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <div className="auth-alert auth-alert-error" role="alert"><span>{error}</span></div>}
      {actionError && <div className="auth-alert auth-alert-error" role="alert"><span>{actionError}</span></div>}

      {/* ── Metric Cards ─────────────────────────────────────── */}
      <div className="rc-metrics">
        <div className="rc-metric-card rc-metric--blue">
          <div className="rc-metric-top">
            <div className="rc-metric-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <span className="rc-metric-label">Total applicants</span>
          </div>
          <div className="rc-metric-value">{total}</div>
          <div className="rc-metric-context">{total === 1 ? 'candidate' : 'candidates'} across all jobs</div>
          <div className="rc-metric-distribution" aria-hidden="true">
            {PIPELINE.map((s) => {
              const w = total > 0 ? (metrics[s] / total) * 100 : 0;
              return w > 0 ? <div key={s} className="rc-metric-dist-seg" style={{ flex: w, backgroundColor: stageColors[s] }} /> : null;
            })}
            {total > 0 && (
              <div className="rc-metric-dist-seg" style={{ flex: metrics.rejected > 0 ? (metrics.rejected / total) * 100 : 0.5, backgroundColor: '#E5E7EB' }} />
            )}
          </div>
        </div>

        <div className="rc-metric-card rc-metric--indigo">
          <div className="rc-metric-top">
            <div className="rc-metric-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <span className="rc-metric-label">Under review</span>
          </div>
          <div className="rc-metric-value">{metrics['under-review']}</div>
          <div className="rc-metric-context">actively being screened</div>
          <div className="rc-metric-progress-track" aria-hidden="true">
            <div className="rc-metric-progress-fill rc-metric-progress-fill--indigo" style={{ width: total > 0 ? `${(metrics['under-review'] / total) * 100}%` : '0%' }} />
          </div>
        </div>

        <div className="rc-metric-card rc-metric--purple">
          <div className="rc-metric-top">
            <div className="rc-metric-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M14 9l-2 2-2-2" />
              </svg>
            </div>
            <span className="rc-metric-label">Interviews</span>
          </div>
          <div className="rc-metric-value">{metrics['interview']}</div>
          <div className="rc-metric-context">scheduled conversations</div>
          <div className="rc-metric-progress-track" aria-hidden="true">
            <div className="rc-metric-progress-fill rc-metric-progress-fill--purple" style={{ width: total > 0 ? `${(metrics['interview'] / total) * 100}%` : '0%' }} />
          </div>
        </div>

        <div className="rc-metric-card rc-metric--green">
          <div className="rc-metric-top">
            <div className="rc-metric-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <span className="rc-metric-label">Offers &amp; hired</span>
          </div>
          <div className="rc-metric-value">{metrics['offer'] + metrics['hired']}</div>
          <div className="rc-metric-context">successful placements</div>
          <div className="rc-metric-progress-track" aria-hidden="true">
            <div className="rc-metric-progress-fill rc-metric-progress-fill--green" style={{ width: total > 0 ? `${((metrics['offer'] + metrics['hired']) / total) * 100}%` : '0%' }} />
          </div>
        </div>
      </div>

      {/* ── Main Content: Pipeline + Insights ────────────────── */}
      <div className="rc-content-grid">
        {/* Hiring Pipeline — Hero Panel */}
        <div className="rc-pipeline">
          <div className="rc-pipeline-header">
            <h2 className="rc-panel-title">Hiring pipeline</h2>
            <span className="rc-pipeline-total">{total} total applications</span>
          </div>
          <div className="rc-pipeline-funnel">
            {PIPELINE.map((s, i) => {
              const pct = total > 0 ? Math.round((metrics[s] / total) * 100) : 0;
              const barWidth = total > 0 ? (metrics[s] / total) * 100 : 0;
              return (
                <div className="rc-funnel-step" key={s}>
                  <div className="rc-funnel-visual">
                    <div className="rc-funnel-bar" style={{ width: `${Math.max(barWidth, metrics[s] > 0 ? 8 : 2)}%`, backgroundColor: stageColors[s] }} />
                  </div>
                  <div className="rc-funnel-meta">
                    <div className="rc-funnel-stage-row">
                      <span className="rc-funnel-dot" style={{ backgroundColor: stageColors[s] }} />
                      <span className="rc-funnel-stage-name">{STATUS_LABELS[s]}</span>
                      <span className="rc-funnel-count">{metrics[s]}</span>
                    </div>
                    {total > 0 && <span className="rc-funnel-pct">{pct}%</span>}
                  </div>
                  {i < PIPELINE.length - 1 && (
                    <div className="rc-funnel-connector" aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>

          {metrics.rejected > 0 && (
            <div className="rc-pipeline-rejected">
              <span className="rc-rejected-dot" />
              {metrics.rejected} {metrics.rejected === 1 ? 'applicant' : 'applicants'} rejected
            </div>
          )}
        </div>

        {/* Insights Column */}
        <div className="rc-insights">
          {/* Applications by Job */}
          <div className="rc-insight-panel">
            <h3 className="rc-insight-title">Applications by job</h3>
            <div className="rc-jobs-list">
              {jobsByCount.map((j, i) => (
                <div className="rc-job-row" key={i}>
                  <div className="rc-job-row-head">
                    <span className="rc-job-rank">{i + 1}</span>
                    <span className="rc-job-row-title">{j.title}</span>
                    <span className="rc-job-row-count">{j.count}</span>
                  </div>
                  <div className="rc-job-bar-track">
                    <div
                      className="rc-job-bar-fill"
                      style={{ width: `${maxJobCount > 0 ? (j.count / maxJobCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
              {jobsByCount.length === 0 && (
                <p className="rc-insight-empty">No job applications yet</p>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rc-insight-panel rc-insight-panel--activity">
            <h3 className="rc-insight-title">Recent activity</h3>
            <div className="rc-activity-timeline">
              {recentApps.map((app, idx) => (
                <div className="rc-activity-entry" key={app.id}>
                  {idx < recentApps.length - 1 && <div className="rc-activity-line" aria-hidden="true" />}
                  <div className="rc-activity-dot" aria-hidden="true">
                    <div className="rc-activity-avatar-sm">
                      {app.applicant?.avatarUrl ? (
                        <img src={`${AVATAR_BASE}${app.applicant.avatarUrl}`} alt="" />
                      ) : (
                        (app.applicant?.fullName || 'A').charAt(0).toUpperCase()
                      )}
                    </div>
                  </div>
                  <div className="rc-activity-content">
                    <div className="rc-activity-text">
                      <span className="rc-activity-name">{app.applicant?.fullName || 'Applicant'}</span>
                      <span className="rc-activity-action">applied to</span>
                      <span className="rc-activity-job">{app.job?.title || 'a job'}</span>
                    </div>
                    <span className="rc-activity-time">{fmtTimeAgo(app.createdAt)}</span>
                  </div>
                </div>
              ))}
              {recentApps.length === 0 && (
                <p className="rc-insight-empty">No recent activity</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Applicants Workspace ──────────────────────────────── */}
      <div className="rc-applicants">
        <div className="rc-applicants-header">
          <h2 className="rc-panel-title">Applicants</h2>
          <span className="rc-applicants-count">{total} {total === 1 ? 'candidate' : 'candidates'}</span>
        </div>
        <div className="rc-table-header">
          <span className="rc-th rc-th--candidate">Candidate</span>
          <span className="rc-th rc-th--job">Job</span>
          <span className="rc-th rc-th--date">Applied</span>
          <span className="rc-th rc-th--status">Status</span>
          <span className="rc-th rc-th--actions"><span className="sr-only">Details</span></span>
        </div>
        <div className="rc-table-body">
          {filtered.map((app) => (
            <div className="rc-table-row" key={app.id}>
              <div className="rc-td rc-td--candidate">
                <div className="rc-candidate-avatar" aria-hidden="true">
                  {app.applicant?.avatarUrl ? (
                    <img src={`${AVATAR_BASE}${app.applicant.avatarUrl}`} alt="" />
                  ) : (
                    (app.applicant?.fullName || 'A').charAt(0).toUpperCase()
                  )}
                </div>
                <div className="rc-candidate-info">
                  <strong className="rc-candidate-name">{app.applicant?.fullName || 'Applicant'}</strong>
                  {app.applicant?.headline && (
                    <span className="rc-candidate-role">{app.applicant.headline}</span>
                  )}
                </div>
              </div>
              <div className="rc-td rc-td--job">
                <span className="rc-td-job-title">{app.job?.title || 'Job'}</span>
                <span className="rc-td-job-meta">
                  {app.job?.company}
                  {app.job?.location ? ` · ${app.job.location}` : ''}
                </span>
              </div>
              <span className="rc-td rc-td--date">{fmtDate(app.createdAt)}</span>
              <div className="rc-td rc-td--status">
                <label className="sr-only" htmlFor={`app-status-${app.id}`}>
                  Status for {app.applicant?.fullName || 'applicant'}
                </label>
                <select
                  id={`app-status-${app.id}`}
                  className={`rc-status-select rc-status-select--${app.status}`}
                  value={app.status}
                  disabled={updatingId === app.id}
                  onChange={(e) => handleStatusChange(app, e.target.value)}
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                {updatingId === app.id && <span className="rc-status-spinner" aria-hidden="true" />}
              </div>
              <div className="rc-td rc-td--actions">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary rc-view-btn"
                  onClick={() => openDetail(app)}
                >
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
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
/* Applicant detail modal — fetches GET /applications/:id only when opened. */
/* Portal-backed like ConfirmModal so the overlay roots at the viewport.    */
/* Displays ONLY what the authorized detail endpoint returns; missing data  */
/* hides the corresponding section/action.                                 */
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

  const resolveMediaUrl = (url) => {
    if (!url) return '';
    return url.startsWith('http') ? url : `${AVATAR_BASE}${url}`;
  };

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
    <div className="rc-detail-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="rc-detail" ref={dialogRef} tabIndex={-1}>
        <div className="rc-detail-top">
          <h3 id={titleId} className="rc-detail-title">Applicant details</h3>
          <button
            type="button"
            className="rc-detail-close"
            onClick={onClose}
            aria-label="Close applicant details"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {loading && (
          <div className="rc-detail-state" role="status" aria-live="polite">
            <span className="rc-detail-spinner" aria-hidden="true" />
            <p className="rc-detail-state-text">Loading applicant details…</p>
          </div>
        )}

        {!loading && error && (
          <div className="rc-detail-state">
            <div className="auth-alert auth-alert-error" role="alert">
              <span>{error}</span>
            </div>
            <p className="rc-detail-state-text">We could not load this applicant's details. Please try again.</p>
            <div className="rc-detail-state-actions">
              <button type="button" className="btn btn-secondary" onClick={onRetry}>Try again</button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        )}

        {!loading && !error && data && (
          <div className="rc-detail-body">
            <div className="rc-detail-identity">
              <div className="rc-detail-avatar" aria-hidden="true">
                {applicant?.avatarUrl ? (
                  <img src={resolveMediaUrl(applicant.avatarUrl)} alt="" />
                ) : (
                  (applicant?.fullName || 'A').charAt(0).toUpperCase()
                )}
              </div>
              <div className="rc-detail-identity-text">
                <span className="rc-detail-name">{applicant?.fullName || 'Applicant'}</span>
                {applicant?.headline && <span className="rc-detail-headline">{applicant.headline}</span>}
              </div>
            </div>

            {(email || phone) && (
              <div className="rc-detail-section">
                <h4 className="rc-detail-section-title">Contact</h4>
                <div className="rc-detail-contact">
                  {email && (
                    <a className="btn btn-sm btn-secondary rc-contact-btn" href={`mailto:${email}`}>
                      Email
                    </a>
                  )}
                  {phone && (
                    <a className="btn btn-sm btn-secondary rc-contact-btn" href={`tel:${phone}`}>
                      Call
                    </a>
                  )}
                  {phone && (
                    <a className="btn btn-sm btn-secondary rc-contact-btn" href={`sms:${phone}`}>
                      Text
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="rc-detail-section">
              <h4 className="rc-detail-section-title">Application</h4>
              <dl className="rc-detail-rows">
                <div className="rc-detail-row">
                  <dt>Job</dt>
                  <dd>{job?.title || '—'}</dd>
                </div>
                {job?.company && (
                  <div className="rc-detail-row">
                    <dt>Company</dt>
                    <dd>{job.company}{job?.location ? ` · ${job.location}` : ''}</dd>
                  </div>
                )}
                <div className="rc-detail-row">
                  <dt>Applied</dt>
                  <dd>{fmtDate(data.createdAt) || '—'}</dd>
                </div>
                <div className="rc-detail-row">
                  <dt>Status</dt>
                  <dd>
                    <span className={`rc-status-badge rc-status-badge--${status}`}>
                      {STATUS_LABELS[status] || status || 'Unknown'}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            {resumeUrl && (
              <div className="rc-detail-section">
                <h4 className="rc-detail-section-title">Resume</h4>
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

            <div className="rc-detail-section">
              <h4 className="rc-detail-section-title">Cover letter</h4>
              {coverLetter ? (
                <p className="rc-detail-letter">{coverLetter}</p>
              ) : (
                <p className="rc-detail-letter rc-detail-letter--empty">No cover letter provided.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}