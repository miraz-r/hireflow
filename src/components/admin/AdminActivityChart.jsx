import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import './AdminActivityChart.css';

/**
 * AdminActivityChart — trailing 30-day application volume.
 *
 * Data comes from the admin trend endpoint, which returns every calendar day
 * in the window (zero-count days included), so the area never invents a data
 * point or a gap and always flows left-to-right chronologically.
 *
 * Colours are applied via AdminActivityChart.css using the live design tokens,
 * so light and dark themes get visually consistent (not hard-coded) colours.
 * SVG presentation attributes cannot resolve CSS custom properties, so the
 * sheet owns all chart paints (line, area wash, grid, axes, cursor, tooltip).
 */
export default function AdminActivityChart({ points }) {
  const formatted = (points || []).map((p) => ({
    ...p,
    // Short human label ("Apr 3") for the axis; the full date stays in the
    // tooltip so the raw data remains the single source of truth.
    short: formatShortDate(p.date),
  }));

  return (
    <div className="admin-activity-chart">
      <div className="admin-chart-wrap" style={{ height: 264 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formatted} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="adminChartFill" x1="0" y1="0" x2="0" y2="1">
                {/* Presentation attributes are the safe fallback; the same
                    colours in AdminActivityChart.css (theme tokens) override
                    them, so light/dark stay consistent. */}
                <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.04" />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="short"
              tick={{ fontSize: 11 }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
              dy={6}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11 }}
              tickLine={false}
              width={40}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={<AdminChartTooltip />}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#4f46e5"
              strokeWidth={2}
              fill="url(#adminChartFill)"
              strokeLinejoin="round"
              isAnimationActive
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Full date (never just the axis label) for the tooltip, plus the count, so
// hovering always shows the exact underlying datum.
function AdminChartTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0].payload;
  return (
    <div className="admin-chart-tooltip" role="status">
      <span className="admin-chart-tooltip-date">{formatFullDate(point.date)}</span>
      <strong className="admin-chart-tooltip-count">
        {point.count} {point.count === 1 ? 'application' : 'applications'}
      </strong>
    </div>
  );
}

function formatShortDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  const month = MONTHS[parseInt(m, 10) - 1];
  return `${month} ${parseInt(d, 10)}`;
}

// "2026-04-09" -> "Apr 9" (medium -> "April 9, 2026" in the tooltip).
function formatFullDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  const month = MONTHS_LONG[parseInt(m, 10) - 1];
  return `${month} ${parseInt(d, 10)}, ${y}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
