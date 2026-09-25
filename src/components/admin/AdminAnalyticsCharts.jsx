import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import './AdminAnalyticsCharts.css';

/**
 * AdminAnalyticsCharts - the two chart primitives on the Analytics page.
 *
 * Reuses Recharts (already the project's chart library via AdminActivityChart).
 * SVG presentation attributes cannot resolve CSS custom properties, so every
 * paint (line, grid, axes, slice fill, cursor, tooltip) is owned by
 * AdminAnalyticsCharts.css reading the live admin tokens. The hex values passed
 * below are only a light-theme fallback, and CSS wins over them anyway.
 *
 * Both charts are static: animation is disabled so the page never pulses or
 * redraws while the admin is reading it.
 */
export function AdminActivityTrendChart({ data }) {
  const rows = (data || []).map((row) => ({
    ...row,
    // Short human label ("Aug 28") for the axis; the full date stays in the
    // tooltip so the raw data remains the single source of truth.
    label: formatShortDate(row.date),
  }));

  return (
    <div className="admin-analytics-chart">
      <div className="admin-analytics-chart-plot" style={{ height: 262 }}>
        <ResponsiveContainer width="100%" height="100%">
          {/* Two scales, one per series: applications run in the tens-to-hundreds
              per day while jobs posted run in single digits, so a shared axis
              would flatten the jobs line onto the baseline. Each Line is bound
              to its own yAxisId so Recharts scales it against real data. */}
          <LineChart data={rows} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={30}
              dy={6}
            />
            <YAxis
              yAxisId="applications"
              allowDecimals={false}
              tick={{ fontSize: 11 }}
              tickLine={false}
              width={38}
            />
            <YAxis
              yAxisId="jobs"
              orientation="right"
              allowDecimals={false}
              tick={{ fontSize: 11 }}
              tickLine={false}
              width={30}
            />
            <Tooltip content={<TrendTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Line
              yAxisId="applications"
              type="monotone"
              dataKey="applications"
              name="Applications"
              className="an-series-applications"
              stroke="#4f46e5"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Line
              yAxisId="jobs"
              type="monotone"
              dataKey="jobs"
              name="Jobs Posted"
              className="an-series-jobs"
              stroke="#7c3aed"
              strokeWidth={2}
              strokeDasharray="5 4"
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * AdminStatusDonut - application status mix. The total sits in a plain overlay
 * rather than a Recharts label so it inherits the page's own typography and
 * stays centred at every card width.
 */
export function AdminStatusDonut({ data, total, totalLabel }) {
  return (
    <div className="admin-analytics-donut">
      <div className="admin-analytics-donut-plot">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="94%"
              paddingAngle={1.5}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((slice) => (
                // The per-slice class is what the stylesheet themes; `fill` is
                // only the light-theme fallback for the tooltip swatch.
                <Cell
                  key={slice.id}
                  className={`admin-analytics-slice admin-analytics-slice--${slice.id}`}
                  fill={slice.fill}
                />
              ))}
            </Pie>
            <Tooltip content={<StatusTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="admin-analytics-donut-center">
          <strong className="admin-analytics-donut-total">{total}</strong>
          <span className="admin-analytics-donut-label">{totalLabel}</span>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Tooltips - the full underlying datum on hover, never just the axis label.
   -------------------------------------------------------------------------- */

function TrendTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0].payload;
  return (
    <div className="admin-analytics-tooltip" role="status">
      <span className="admin-analytics-tooltip-date">{formatFullDate(point.date)}</span>
      <span className="admin-analytics-tooltip-row">
        <span
          className="admin-analytics-tooltip-swatch admin-analytics-tooltip-swatch--applications"
          aria-hidden="true"
        />
        Applications
        <strong>{point.applications}</strong>
      </span>
      <span className="admin-analytics-tooltip-row">
        <span
          className="admin-analytics-tooltip-swatch admin-analytics-tooltip-swatch--jobs"
          aria-hidden="true"
        />
        Jobs Posted
        <strong>{point.jobs}</strong>
      </span>
    </div>
  );
}

/**
 * StatusTooltip - the hovered slice's status, its share, and the application
 * count that share works out to. The count is precomputed on the report row
 * (adminAnalyticsData), so the tooltip reports the same figure as the KPI card
 * and the CSV rather than re-deriving it at hover time.
 */
function StatusTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0].payload;
  return (
    <div className="admin-analytics-tooltip" role="status">
      <span className="admin-analytics-tooltip-date">{point.label}</span>
      <span className="admin-analytics-tooltip-row">
        <span
          className={`admin-analytics-tooltip-dot admin-analytics-legend-dot--${point.id}`}
          aria-hidden="true"
        />
        Share of applications
        <strong>{point.value}%</strong>
      </span>
      <span className="admin-analytics-tooltip-row">
        <span className="admin-analytics-tooltip-dot admin-analytics-tooltip-dot--count" aria-hidden="true" />
        Applications
        <strong>{point.count.toLocaleString('en-US')}</strong>
      </span>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Dates
   -------------------------------------------------------------------------- */

// "2026-08-28" -> "Aug 28" on the axis; "August 28, 2026" in the tooltip.
function formatShortDate(iso) {
  if (!iso) return '';
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}

function formatFullDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${MONTHS_LONG[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
