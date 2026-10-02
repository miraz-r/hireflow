import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Select from '../ui/Select';
import { AdminActivityTrendChart, AdminStatusDonut } from './AdminAnalyticsCharts';
import {
  DATE_RANGE_OPTIONS,
  DEFAULT_RANGE,
  STATUS_META,
  STATUS_FILLS,
  buildAnalyticsCsv,
} from './adminAnalyticsData';
import { getAdminAnalytics, getRecentActivity } from '../../utils/adminApi';
import { ADMIN_STATUS_LABELS } from '../../constants/applicationStatus';
import './AdminAnalyticsPage.css';

const TREND_COMPARE = 'vs previous period';

const EXPORT_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const TREND_ICON = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 15 12 9 18 15" />
  </svg>
);

const formatCount = (value) => Number(value || 0).toLocaleString('en-US');

/** "Last 30 days" -> "last-30-days" for the download filename. */
const slugify = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * The KPI comparison, formatted honestly.
 *
 * A null change means the previous period had no value at all, so there is no
 * percentage to report. That is stated plainly rather than shown as 0% (which
 * would read as "no change") or as NaN/Infinity.
 */
const formatChange = (change) =>
  change === null || change === undefined ? 'No prior period' : `${change > 0 ? '+' : ''}${change}%`;

const ACTIVITY_ICONS = {
  'application-created': 'Application received',
  'job-created': 'Job posted',
  'job-updated': 'Job listing updated',
};

const formatActivityDate = (iso) => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * AdminAnalyticsPage - the /admin/analytics workspace.
 *
 * Every figure is fetched from GET /api/admin/analytics, where it is aggregated
 * from Job, Application and Profile. Nothing on this page is authored: no
 * synthetic trend series, no fixed percentages, no invented conversion rates.
 *
 * The window the admin selects is server-side and mirrored into ?range= so a
 * refresh or a Back/Forward step restores the same report.
 *
 * The former "Hiring Funnel" is now a Current Pipeline card. Application.status
 * records where an application sits right now, not every stage it has passed
 * through, so these are honest current counts per status - not a conversion
 * funnel, and not forced to decrease down the list.
 */
export default function AdminAnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // The report period is a closed set. An unrecognised ?range= falls back to the
  // default rather than requesting a window the API would reject.
  const rangeParam = searchParams.get('range') || '';
  const range = DATE_RANGE_OPTIONS.some((option) => option.value === rangeParam)
    ? rangeParam
    : DEFAULT_RANGE;

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activity, setActivity] = useState([]);
  const [activityError, setActivityError] = useState(false);

  const setRange = useCallback(
    (next) => {
      const params = new URLSearchParams(searchParams);
      if (next === DEFAULT_RANGE) params.delete('range');
      else params.set('range', next);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminAnalytics({ range });
      setReport(data);
    } catch (err) {
      setError(err);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // The activity card is independent of the report window, so it loads once and
  // a report failure never costs the admin this feed.
  const loadActivity = useCallback(async () => {
    try {
      const data = await getRecentActivity(8);
      setActivity(data.items || []);
      setActivityError(false);
    } catch {
      setActivityError(true);
    }
  }, []);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  /**
   * Client-side CSV over the fetched report. The object is already exactly what
   * is on screen, so the download can never disagree with the page. Revoking the
   * object URL is deferred to a macrotask because Firefox and Safari can still
   * be reading the Blob when the click handler returns.
   */
  const handleExport = useCallback(() => {
    if (!report) return;
    const blob = new Blob([buildAnalyticsCsv(report)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hireflow-analytics-${slugify(report.label)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [report]);

  // Status rows for the donut and its legend, in canonical pipeline order and
  // carrying the API's real counts. A status with no applications still appears,
  // so the legend describes the full pipeline rather than only the used part.
  const statusRows = useMemo(
    () =>
      (report?.status || []).map((slice) => ({
        id: slice.id,
        label: ADMIN_STATUS_LABELS[slice.id] || slice.id,
        count: slice.count,
        fill: STATUS_FILLS[slice.id],
      })),
    [report]
  );

  const statusTotal = statusRows.reduce((sum, slice) => sum + slice.count, 0);

  const hasData = useMemo(
    () =>
      (report?.kpis || []).some((kpi) => kpi.value > 0) ||
      (report?.trend || []).some((point) => point.jobs > 0 || point.applications > 0),
    [report]
  );

  return (
    <div className="admin-page admin-analytics">
      <div className="admin-analytics-toolbar">
        <div className="admin-analytics-range">
          <Select
            id="admin-analytics-range"
            name="range"
            className="admin-analytics-range-select"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            aria-label="Date range"
            options={DATE_RANGE_OPTIONS}
          />
        </div>

        <button
          type="button"
          className="admin-analytics-export"
          onClick={handleExport}
          disabled={!report}
        >
          {EXPORT_ICON}
          Export
        </button>
      </div>

      {loading && !report ? (
        <AnalyticsState
          title="Loading analytics..."
          text={`Fetching the ${report?.label || ''} report from the server.`}
        />
      ) : error ? (
        <AnalyticsState
          title="Unable to load analytics"
          text={error?.message || 'Something went wrong while fetching the report.'}
          actionLabel="Try again"
          onAction={loadReport}
        />
      ) : !hasData ? (
        <AnalyticsState
          title="No data in this period"
          text={`Nothing was created in ${report?.label.toLowerCase()}. Try a wider date range.`}
        />
      ) : (
        <>
          <div className="admin-analytics-kpis">
            {report.kpis.map((kpi) => (
              <KpiCard key={kpi.id} kpi={kpi} />
            ))}
          </div>

          <div className="admin-analytics-row-main">
            <section className="admin-analytics-card" aria-labelledby="analytics-trend-title">
              <div className="admin-analytics-card-head">
                <div className="admin-analytics-card-headings">
                  <h2 className="admin-analytics-card-title" id="analytics-trend-title">
                    Jobs &amp; Applications
                  </h2>
                  <p className="admin-analytics-card-sub">
                    Records created each day over {report.label.toLowerCase()}.
                  </p>
                </div>
                <ChartLegend />
              </div>
              <AdminActivityTrendChart data={report.trend} />
            </section>

            <section className="admin-analytics-card" aria-labelledby="analytics-status-title">
              <div className="admin-analytics-card-head">
                <div className="admin-analytics-card-headings">
                  <h2 className="admin-analytics-card-title" id="analytics-status-title">
                    Application Status
                  </h2>
                  <p className="admin-analytics-card-sub">
                    Where applications created in this period sit today.
                  </p>
                </div>
              </div>
              <AdminStatusDonut
                data={statusRows}
                total={formatCount(statusTotal)}
                totalLabel="Applications"
              />
              <StatusLegend items={statusRows} total={statusTotal} />
            </section>
          </div>

          <div className="admin-analytics-row-split">
            <section className="admin-analytics-card" aria-labelledby="analytics-category-title">
              <div className="admin-analytics-card-head">
                <div className="admin-analytics-card-headings">
                  <h2 className="admin-analytics-card-title" id="analytics-category-title">
                    Jobs by Category
                  </h2>
                  <p className="admin-analytics-card-sub">Top five categories in this period.</p>
                </div>
              </div>
              <BarList items={report.category} />
            </section>

            <section className="admin-analytics-card" aria-labelledby="analytics-worktype-title">
              <div className="admin-analytics-card-head">
                <div className="admin-analytics-card-headings">
                  <h2 className="admin-analytics-card-title" id="analytics-worktype-title">
                    Jobs by Work Type
                  </h2>
                  <p className="admin-analytics-card-sub">
                    Every listing carries one of the platform&rsquo;s work types.
                  </p>
                </div>
              </div>
              <BarList items={report.workTypes} />
            </section>
          </div>

          <div className="admin-analytics-row-insights">
            <section className="admin-analytics-card" aria-labelledby="analytics-companies-title">
              <div className="admin-analytics-card-head">
                <div className="admin-analytics-card-headings">
                  <h2 className="admin-analytics-card-title" id="analytics-companies-title">
                    Top Companies
                  </h2>
                  <p className="admin-analytics-card-sub">Most listings posted in this period.</p>
                </div>
              </div>
              <RankedList items={report.topCompanies} />
            </section>

            <section className="admin-analytics-card" aria-labelledby="analytics-applied-title">
              <div className="admin-analytics-card-head">
                <div className="admin-analytics-card-headings">
                  <h2 className="admin-analytics-card-title" id="analytics-applied-title">
                    Most Applied Jobs
                  </h2>
                  <p className="admin-analytics-card-sub">Highest application counts in this period.</p>
                </div>
              </div>
              <RankedList items={report.mostApplied} />
            </section>

            <section className="admin-analytics-card" aria-labelledby="analytics-pipeline-title">
              <div className="admin-analytics-card-head">
                <div className="admin-analytics-card-headings">
                  <h2 className="admin-analytics-card-title" id="analytics-pipeline-title">
                    Current Pipeline
                  </h2>
                </div>
              </div>
              {/* Deliberately a set of independent current counts, NOT a
                  conversion funnel: an application only holds the status it is
                  in now, so these are not cumulative stage totals and they are
                  not ordered to look like a funnel. */}
              <StatusCounts items={statusRows} total={statusTotal} />
            </section>
          </div>

          <section className="admin-analytics-card" aria-labelledby="analytics-activity-title">
            <div className="admin-analytics-card-head">
              <div className="admin-analytics-card-headings">
                <h2 className="admin-analytics-card-title" id="analytics-activity-title">
                  Recent Platform Activity
                </h2>
              </div>
              <button
                type="button"
                className="admin-analytics-link"
                onClick={() => navigate('/admin/activity')}
              >
                View all activity
              </button>
            </div>
            <ActivityTable items={activity} loading={activityError} />
          </section>
        </>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Sub-components
   -------------------------------------------------------------------------- */

/**
 * Shared empty / loading / error block, so every report-level state looks the
 * same and offers the same single retry affordance.
 */
function AnalyticsState({ title, text, actionLabel, onAction }) {
  return (
    <section className="admin-analytics-state" role="status">
      <span className="admin-analytics-state-title">{title}</span>
      <span className="admin-analytics-state-text">{text}</span>
      {actionLabel && (
        <button type="button" className="admin-analytics-btn" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </section>
  );
}

/**
 * KpiCard - neutral surface with one restrained green trend indicator. The
 * Analytics KPIs deliberately do not reuse AdminKpiCard: that component carries
 * the Overview's per-tone tinted backgrounds, while this reference is built on
 * neutral surfaces with a single subtle accent.
 */
function KpiCard({ kpi }) {
  const hasChange = kpi.change !== null && kpi.change !== undefined;
  // A fall is not a failure, so it is called out rather than dressed up in the
  // same green as a rise.
  const fell = hasChange && kpi.change < 0;

  return (
    <div className="admin-analytics-kpi">
      <p className="admin-analytics-kpi-label">{kpi.label}</p>
      <strong className="admin-analytics-kpi-value">{formatCount(kpi.value)}</strong>
      <p className="admin-analytics-kpi-trend">
        {hasChange ? (
          <span className={`admin-analytics-kpi-delta${fell ? ' admin-analytics-kpi-delta--down' : ''}`}>
            {TREND_ICON}
            {formatChange(kpi.change)}
          </span>
        ) : (
          <span className="admin-analytics-kpi-delta admin-analytics-kpi-delta--none">
            {formatChange(kpi.change)}
          </span>
        )}
        <span className="admin-analytics-kpi-compare">
          {hasChange ? TREND_COMPARE : 'nothing in the preceding period'}
        </span>
      </p>
    </div>
  );
}

/** ChartLegend - the two line series, mirroring each line's stroke. */
function ChartLegend() {
  return (
    <ul className="admin-analytics-legend" aria-label="Chart series">
      <li className="admin-analytics-legend-item">
        <span className="admin-analytics-legend-line admin-analytics-legend-line--applications" aria-hidden="true" />
        Applications
      </li>
      <li className="admin-analytics-legend-item">
        <span className="admin-analytics-legend-line admin-analytics-legend-line--jobs" aria-hidden="true" />
        Jobs Posted
      </li>
    </ul>
  );
}

/** StatusLegend - donut slices with each status's real count and share. */
function StatusLegend({ items, total }) {
  return (
    <ul className="admin-analytics-legend admin-analytics-legend--status" aria-label="Application status breakdown">
      {items.map((item) => (
        <li className="admin-analytics-legend-item" key={item.id}>
          <span
            className={`admin-analytics-legend-dot admin-analytics-legend-dot--${item.id}`}
            aria-hidden="true"
          />
          <span className="admin-analytics-legend-text">{item.label}</span>
          <span className="admin-analytics-legend-value">{formatCount(item.count)}</span>
        </li>
      ))}
    </ul>
  );
}

/** BarList - horizontal bars scaled against the largest value in the set. */
function BarList({ items }) {
  if (!items.length) return <p className="admin-analytics-empty">No data in this period.</p>;
  const max = items.reduce((peak, item) => Math.max(peak, item.value), 0);

  return (
    <ul className="admin-analytics-bars">
      {items.map((item) => (
        <li className="admin-analytics-bar" key={item.label}>
          <span className="admin-analytics-bar-label">{item.label}</span>
          <span className="admin-analytics-bar-track" aria-hidden="true">
            <span
              className="admin-analytics-bar-fill"
              style={{ width: (max > 0 ? (item.value / max) * 100 : 0) + '%' }}
            />
          </span>
          <span className="admin-analytics-bar-value">{formatCount(item.value)}</span>
        </li>
      ))}
    </ul>
  );
}

/** RankedList - compact top-N rows: rank, label, value. The <ol> already
    conveys the order, so the visible index is hidden from assistive tech. */
function RankedList({ items }) {
  if (!items.length) return <p className="admin-analytics-empty">No data in this period.</p>;
  return (
    <ol className="admin-analytics-ranked">
      {items.map((item, index) => (
        <li className="admin-analytics-ranked-row" key={`${item.label}-${index}`}>
          <span className="admin-analytics-ranked-index" aria-hidden="true">
            {index + 1}
          </span>
          <span className="admin-analytics-ranked-label">{item.label}</span>
          <span className="admin-analytics-ranked-value">
            {formatCount(item.value)}
            {item.unit && <span className="admin-analytics-ranked-unit">{item.unit}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * StatusCounts - the current pipeline as a flat list of per-status counts.
 *
 * Replaces the previous conversion funnel. Each row is independent, so the
 * widths are scaled against the largest status and nothing is implied about
 * stage-to-stage conversion or a narrowing progression.
 */
function StatusCounts({ items, total }) {
  const max = items.reduce((peak, item) => Math.max(peak, item.count), 0);
  const share = total > 0 ? (count) => Math.round(((count / total) * 1000) / 10) : () => 0;

  return (
    <ul className="admin-analytics-status-counts">
      {items.map((item) => (
        <li className="admin-analytics-status-count" key={item.id}>
          <span className="admin-analytics-status-count-label">{item.label}</span>
          <span className="admin-analytics-status-count-track" aria-hidden="true">
            <span
              className="admin-analytics-status-count-fill"
              style={{ width: (max > 0 ? (item.count / max) * 100 : 0) + '%' }}
            />
          </span>
          <span className="admin-analytics-status-count-value">
            {formatCount(item.count)}
            <span className="admin-analytics-status-count-share">{share(item.count)}%</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** ActivityTable - the real activity feed, held to a fixed layout so the header
    and every row stay aligned at any card width. */
function ActivityTable({ items, loading }) {
  if (loading) {
    return <p className="admin-analytics-empty">Activity is unavailable right now.</p>;
  }
  if (!items.length) {
    return <p className="admin-analytics-empty">No recent activity.</p>;
  }

  return (
    <div className="admin-analytics-table-scroll">
      <table className="admin-analytics-table">
        <colgroup>
          <col className="admin-analytics-col-activity" />
          <col className="admin-analytics-col-user" />
          <col className="admin-analytics-col-date" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Activity</th>
            <th scope="col">Detail</th>
            <th scope="col">Date</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.type}-${index}`}>
              <td className="admin-analytics-cell-activity">
                {ACTIVITY_ICONS[item.type] || item.label}
              </td>
              <td className="admin-analytics-cell-user">{item.detail || item.entity || '—'}</td>
              <td className="admin-analytics-cell-date">{formatActivityDate(item.at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}