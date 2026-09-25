import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Select from '../ui/Select';
import { AdminActivityTrendChart, AdminStatusDonut } from './AdminAnalyticsCharts';
import {
  DATE_RANGE_OPTIONS,
  DEFAULT_RANGE,
  RECENT_ACTIVITY,
  buildAnalyticsCsv,
  getAnalyticsReport,
} from './adminAnalyticsData';
import './AdminAnalyticsPage.css';

const TREND_COMPARISON = 'vs previous period';

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

const formatCount = (value) => value.toLocaleString('en-US');

/** "Last 30 days" -> "last-30-days" for the download filename. */
const slugify = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * AdminAnalyticsPage - the /admin/analytics workspace.
 *
 * Composes the shared Admin shell chrome (sidebar + topbar, which already carry
 * the page title) with a dense reporting grid: KPI row, an activity line chart
 * beside the application-status donut, two horizontal-breakdown cards, three
 * platform-insight cards, and the recent-activity table.
 *
 * All data is local mock data supplied by adminAnalyticsData, and the date
 * range drives it: selecting a window rebuilds the KPIs, both charts, the
 * breakdowns and the export payload from one internally consistent report.
 * There is no endpoint, no loading or error state, and no fabricated server
 * content. The stylesheet is self-contained on the admin tokens so the page
 * themes correctly without the Overview stylesheet.
 */
export default function AdminAnalyticsPage() {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const navigate = useNavigate();

  const report = useMemo(() => getAnalyticsReport(range), [range]);

  /**
   * Client-side CSV. The report is already the exact object on screen, so the
   * file always matches what the admin is looking at. Revoking the object URL
   * is deferred to a macrotask because Firefox and Safari can still be
   * reading the Blob when the click handler returns.
   */
  const handleExport = useCallback(() => {
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

  return (
    <div className="admin-page admin-analytics">
      <div className="admin-analytics-toolbar">
        <div className="admin-analytics-range">
          <Select
            id="admin-analytics-range"
            name="dateRange"
            className="admin-analytics-range-select"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            aria-label="Date range"
            options={DATE_RANGE_OPTIONS}
          />
        </div>

        <button type="button" className="admin-analytics-export" onClick={handleExport}>
          {EXPORT_ICON}
          Export
        </button>
      </div>

      <div className="admin-analytics-kpis">
        {report.kpis.map((kpi) => (
          <KpiCard key={kpi.id} {...kpi} />
        ))}
      </div>

      <div className="admin-analytics-row-main">
        <section className="admin-analytics-card" aria-labelledby="analytics-trend-title">
          <div className="admin-analytics-card-head">
            <div className="admin-analytics-card-headings">
              <h2 className="admin-analytics-card-title" id="analytics-trend-title">
                Applications &amp; Jobs
              </h2>
              <p className="admin-analytics-card-sub">Platform activity over time</p>
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
            </div>
          </div>
          <AdminStatusDonut
            data={report.status}
            total={formatCount(report.applications)}
            totalLabel="Applications"
          />
          <StatusLegend items={report.status} />
        </section>
      </div>

      <div className="admin-analytics-row-split">
        <section className="admin-analytics-card" aria-labelledby="analytics-category-title">
          <div className="admin-analytics-card-head">
            <div className="admin-analytics-card-headings">
              <h2 className="admin-analytics-card-title" id="analytics-category-title">
                Jobs by Category
              </h2>
            </div>
          </div>
          <BarList items={report.category} />
        </section>

        <section className="admin-analytics-card" aria-labelledby="analytics-location-title">
          <div className="admin-analytics-card-head">
            <div className="admin-analytics-card-headings">
              <h2 className="admin-analytics-card-title" id="analytics-location-title">
                Jobs by Location
              </h2>
            </div>
          </div>
          <BarList items={report.location} />
        </section>
      </div>

      <div className="admin-analytics-row-insights">
        <section className="admin-analytics-card" aria-labelledby="analytics-companies-title">
          <div className="admin-analytics-card-head">
            <div className="admin-analytics-card-headings">
              <h2 className="admin-analytics-card-title" id="analytics-companies-title">
                Top Companies
              </h2>
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
            </div>
          </div>
          <RankedList items={report.mostApplied} />
        </section>

        <section className="admin-analytics-card" aria-labelledby="analytics-funnel-title">
          <div className="admin-analytics-card-head">
            <div className="admin-analytics-card-headings">
              <h2 className="admin-analytics-card-title" id="analytics-funnel-title">
                Hiring Funnel
              </h2>
            </div>
          </div>
          <Funnel stages={report.funnel} />
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
        <ActivityTable rows={RECENT_ACTIVITY} />
      </section>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Sub-components
   -------------------------------------------------------------------------- */

/**
 * KpiCard - neutral surface with one restrained green trend indicator. The
 * Analytics KPIs deliberately do not reuse AdminKpiCard: that component carries
 * the Overview's per-tone tinted backgrounds, while this reference is built on
 * neutral surfaces with a single subtle accent.
 */
function KpiCard({ label, value, delta }) {
  return (
    <div className="admin-analytics-kpi">
      <p className="admin-analytics-kpi-label">{label}</p>
      <strong className="admin-analytics-kpi-value">{formatCount(value)}</strong>
      <p className="admin-analytics-kpi-trend">
        <span className="admin-analytics-kpi-delta">
          {TREND_ICON}
          {delta}
        </span>
        <span className="admin-analytics-kpi-compare">{TREND_COMPARISON}</span>
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

/** StatusLegend - donut slices, two columns so the card stays compact. */
function StatusLegend({ items }) {
  return (
    <ul className="admin-analytics-legend admin-analytics-legend--status" aria-label="Application status breakdown">
      {items.map((item) => (
        <li className="admin-analytics-legend-item" key={item.id}>
          <span
            className={`admin-analytics-legend-dot admin-analytics-legend-dot--${item.id}`}
            aria-hidden="true"
          />
          <span className="admin-analytics-legend-text">{item.label}</span>
          <span className="admin-analytics-legend-value">{item.value}%</span>
        </li>
      ))}
    </ul>
  );
}

/** BarList - horizontal bars scaled against the largest value in the set. */
function BarList({ items }) {
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
  return (
    <ol className="admin-analytics-ranked">
      {items.map((item, index) => (
        <li className="admin-analytics-ranked-row" key={item.label}>
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

/** Funnel - each stage bar is sized against the top of the funnel, so the
    narrowing proportions read as a progression at a glance. */
function Funnel({ stages }) {
  const top = stages.length ? stages[0].value : 0;

  return (
    <ol className="admin-analytics-funnel">
      {stages.map((stage) => {
        const share = top > 0 ? (stage.value / top) * 100 : 0;
        return (
          <li className="admin-analytics-funnel-stage" key={stage.label}>
            <div className="admin-analytics-funnel-head">
              <span className="admin-analytics-funnel-label">{stage.label}</span>
              <span className="admin-analytics-funnel-meta">
                <strong className="admin-analytics-funnel-value">{formatCount(stage.value)}</strong>
                <span className="admin-analytics-funnel-rate">
                  {Math.round(share * 10) / 10}%
                </span>
              </span>
            </div>
            <div className="admin-analytics-funnel-track" aria-hidden="true">
              <div
                className="admin-analytics-funnel-fill"
                style={{ width: share + '%' }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** ActivityTable - exactly three columns, held to a fixed layout so the header
    and every row stay aligned at any card width. */
function ActivityTable({ rows }) {
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
            <th scope="col">User</th>
            <th scope="col">Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.activity}-${row.user}`}>
              <td className="admin-analytics-cell-activity">{row.activity}</td>
              <td className="admin-analytics-cell-user">{row.user}</td>
              <td className="admin-analytics-cell-date">{row.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
