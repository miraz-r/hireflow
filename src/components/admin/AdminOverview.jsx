import { useCallback, useEffect, useState } from 'react';
import { getAdminStats, getApplicationsTrend, getRecentApplications, getRecentActivity } from '../../utils/adminApi';
import AdminKpiCard from './AdminKpiCard';
import AdminStatsChart from './AdminStatsChart';
import './AdminOverview.css';

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState(null);
  const [recentApplications, setRecentApplications] = useState(null);
  const [recentActivity, setRecentActivity] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, trendRes, appsRes, activityRes] = await Promise.all([
        getAdminStats(),
        getApplicationsTrend(30),
        getRecentApplications(1, 4),
        getRecentActivity(6),
      ]);
      setStats(statsRes);
      setTrend(trendRes);
      setRecentApplications(appsRes?.applications || appsRes?.items || []);
      setRecentActivity(activityRes?.activity || activityRes?.items || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="admin-page admin-overview">
        <div className="admin-overview-grid" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="admin-skeleton admin-skeleton-kpi" />
          ))}
          <div className="admin-skeleton admin-skeleton-wide" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page admin-overview">
        <div className="admin-overview-error" role="alert">
          <h2 className="admin-overview-error-title">Unable to load overview</h2>
          <p className="admin-overview-error-text">
            {error?.message || 'Something went wrong while fetching admin data.'}
          </p>
          <button type="button" className="admin-btn admin-overview-retry" onClick={load}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const kpis = [
    { label: 'Total jobs', value: stats.totalJobs, context: 'All listings', tone: 'indigo' },
    {
      label: 'Active jobs',
      value: stats.activeJobs,
      context: 'Now accepting applications',
      tone: 'amber',
    },
    {
      label: 'Applications',
      value: stats.totalApplications,
      context: 'All time',
      tone: 'sky',
    },
    {
      label: 'Registered users',
      value: stats.totalUsers,
      context: 'Jobseekers + recruiters',
      tone: 'emerald',
    },
  ];

  const pipeline = [
    { key: 'applied', label: 'Applied' },
    { key: 'under-review', label: 'Screening' },
    { key: 'interview', label: 'Interview' },
    { key: 'offer', label: 'Shortlisted' },
    { key: 'hired', label: 'Hired' },
  ];

  const pipelineCounts = stats.pipeline || {};
  const pipelineMax = pipeline.reduce((max, stage) => {
    const count = pipelineCounts[stage.key] ?? 0;
    return Math.max(max, count);
  }, 0);

  return (
    <div className="admin-page admin-overview">
      <div className="admin-overview-kpis">
        {kpis.map((kpi) => (
          <AdminKpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="admin-overview-sections">
        <section className="admin-section admin-overview-chart-section admin-section-card" aria-labelledby="overview-chart-title">
          <div className="admin-section-head">
            <h3 id="overview-chart-title" className="admin-chart-title">
              Application Activity
            </h3>
          </div>
          <div className="admin-stats-chart-wrap">
            <AdminStatsChart points={trend?.points || []} />
          </div>
          <p
            className="admin-section-foot"
          >Daily applications, last 30 days.</p>
        </section>

        <section className="admin-section admin-overview-pipeline-section admin-section-card" aria-labelledby="overview-pipeline-title">
          <div className="admin-section-head">
            <h3 id="overview-pipeline-title" className="admin-chart-title">Application Pipeline</h3>
          </div>
          <AdminPipeline stages={pipeline} counts={pipelineCounts} max={pipelineMax} />
          <p className="admin-section-foot">
            How many applications are sitting in each stage right now.
          </p>
        </section>

        <section className="admin-section admin-overview-applications-section admin-section-card" aria-labelledby="overview-applications-title">
          <div className="admin-section-head">
            <h3 id="overview-applications-title" className="admin-chart-title">Recent Applications</h3>
          </div>
          <AdminRecentApplications applications={recentApplications || []} />
          <p className="admin-section-foot">
            The newest applications to arrive on the platform.
          </p>
        </section>

        <section className="admin-section admin-overview-activity-section admin-section-card" aria-labelledby="overview-activity-title">
          <div className="admin-section-head">
            <h3 id="overview-activity-title" className="admin-chart-title">Recent Activity</h3>
          </div>
          <AdminRecentActivity items={recentActivity || []} />
          <p className="admin-section-foot">
            The latest activity across the platform.
          </p>
        </section>
      </div>
    </div>
  );
}

function AdminPipeline({ stages, counts, max }) {
  return (
    <div className="admin-pipeline">
      {stages.map((stage) => {
        const count = counts[stage.key] ?? 0;
        const pct = max > 0 ? (count / max) * 100 : 0;
        return (
          <div className="admin-pipeline-stage" key={stage.key}>
            <div className="admin-pipeline-stage-row">
              <span className="admin-pipeline-stage-label">{stage.label}</span>
              <span className="admin-pipeline-stage-count">{count}</span>
            </div>
            <div className="admin-pipeline-stage-bar-wrap" aria-hidden="true">
              <div
                className={'admin-pipeline-stage-bar admin-pipeline-stage-bar--' + stage.key}
                style={{ width: pct + '%' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AdminRecentApplications({ applications }) {
  if (!applications.length) {
    return (
      <div className="admin-overview-empty">
        <p className="admin-overview-empty-title">No applications yet</p>
        <p className="admin-overview-empty-text">
          When jobseekers start applying, their applications appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="admin-overview-table-scroll">
      <table className="admin-overview-table">
        <thead>
          <tr>
            <th scope="col">Applicant</th>
            <th scope="col">Job</th>
            <th scope="col">Company</th>
            <th scope="col">Status</th>
            <th scope="col">Applied</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((app) => (
            <tr key={app._id}>
              <td>
                <div className="admin-overview-applicant">
                  <span className="admin-overview-applicant-name">{app.applicant?.name || app.fullName || 'Applicant'}</span>
                  <span className="admin-overview-applicant-mail">{app.email || app.applicant?.email || ''}</span>
                </div>
              </td>
              <td>{app.jobTitle || app.job?.title || 'Job'}</td>
              <td>{app.company || app.job?.company || ''}</td>
              <td>
                <span className={'admin-status-badge admin-status-badge--' + (app.status || 'applied')}>
                  {ADMIN_STATUS_LABELS[app.status] || app.status}
                </span>
              </td>
              <td>{formatDate(app.appliedAt || app.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminRecentActivity({ items }) {
  if (!items.length) {
    return (
      <div className="admin-overview-empty">
        <p className="admin-overview-empty-title">No recent activity</p>
        <p className="admin-overview-empty-text">
          Platform activity will appear here as it happens.
        </p>
      </div>
    );
  }

  return (
    <div className="admin-activity">
      {items.map((item) => (
        <div className="admin-activity-item" key={item._id || item.key}>
          <span className={'admin-activity-dot admin-activity-dot--' + (item.kind || 'default')} aria-hidden="true" />
          <div className="admin-activity-body">
            <span className="admin-activity-label">{item.label || item.type}</span>
            <span className="admin-activity-detail">{item.detail || ''}</span>
            <span className="admin-activity-time">{formatActivityTime(item.at || item.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const STATUS_COLORS = {};

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatActivityTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return time + ' · ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
import { ADMIN_STATUS_LABELS } from '../../constants/applicationStatus';
