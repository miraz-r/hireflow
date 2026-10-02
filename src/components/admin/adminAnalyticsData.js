/* ===========================================================================
   ADMIN ANALYTICS - PRESENTATION CONSTANTS AND CSV EXPORT
   ---------------------------------------------------------------------------
   This module no longer holds any DATA. The report itself is fetched from
   GET /api/admin/analytics, where every figure is aggregated from Job,
   Application and Profile.

   What remains here is only what genuinely belongs to the client:

     - DATE_RANGE_OPTIONS / DEFAULT_RANGE: the window the admin picks.
     - STATUS_META: presentation only. Ids are the canonical backend statuses
       and fills are the chart's colours. The counts come from the API; nothing
       here invents or overrides them.
     - buildAnalyticsCsv: a pure serialiser over the report the screen is
       already showing, so the exported file can never disagree with the page.

   The former RECENT_ACTIVITY mock constant lived here too. It is gone: the
   Analytics activity card and the Activity workspace both read the real feed
   from GET /api/admin/activity, so no consumer imports this module for data.
   =========================================================================== */

export const DEFAULT_RANGE = '30';

export const DATE_RANGE_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'year', label: 'This year' },
];

/* --------------------------------------------------------------------------
   Application status presentation
   --------------------------------------------------------------------------
   Ids are exactly the canonical backend statuses (see APPLICATION_STATUSES in
   the server and ADMIN_STATUS_LABELS for their display wording), so the donut,
   its legend and the tooltip all key off the same vocabulary the rest of the
   admin area uses. There is no admin-only status here.

   `fill` is only a light-theme fallback: the stylesheet themes the slices via
   the per-status class, and CSS wins.
   -------------------------------------------------------------------------- */
export const STATUS_META = [
  { id: 'applied', fill: '#4f46e5' },
  { id: 'under-review', fill: '#8b5cf6' },
  { id: 'interview', fill: '#f59e0b' },
  { id: 'offer', fill: '#0ea5e9' },
  { id: 'hired', fill: '#10b981' },
  { id: 'rejected', fill: '#94a3b8' },
];

export const STATUS_FILLS = Object.fromEntries(
  STATUS_META.map((status) => [status.id, status.fill])
);

/* --------------------------------------------------------------------------
   CSV export
   -------------------------------------------------------------------------- */

const needsQuotes = /[",\r\n]/;

function csvCell(value) {
  const text = String(value ?? '');
  return needsQuotes.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRow(cells) {
  return cells.map(csvCell).join(',');
}

// Plain digits, deliberately not grouped: a quoted "1,842" parses as text in
// Excel and Sheets, which would defeat the point of exporting the numbers.
const csvNumber = (value) => String(value);

// A KPI's change is null when there was no previous period to compare against.
// That is a real state, so it is written as an explicit marker rather than an
// empty cell or a fabricated 0%.
const csvChange = (change) => (change === null || change === undefined ? 'no prior period' : `${change}%`);

/** Section heading: a blank line, then a single bold-ish title cell. */
function csvSection(lines, title) {
  lines.push('');
  lines.push(csvRow([title]));
}

/**
 * buildAnalyticsCsv - serialises one fetched report to CSV text.
 *
 * Pure: the caller decides what to do with the string (the page hands it to a
 * Blob download). Every figure is read straight off the report the screen is
 * showing, so the file and the view can never diverge. Section order mirrors the
 * page top-to-bottom, with the daily series last because "This year" makes it the
 * longest block.
 */
export function buildAnalyticsCsv(report) {
  const lines = [
    csvRow(['HireFlow Analytics Export']),
    csvRow(['Date range', report.label]),
    csvRow(['Window', `${report.window.start} to ${report.window.end}`]),
    csvRow(['Comparison window', `${report.previousWindow.start} to ${report.previousWindow.end}`]),
  ];

  csvSection(lines, 'KPI Metrics');
  lines.push(csvRow(['Metric', 'Value', 'Previous period', 'Change vs previous period']));
  report.kpis.forEach((kpi) =>
    lines.push(csvRow([kpi.label, csvNumber(kpi.value), csvNumber(kpi.previous), csvChange(kpi.change)]))
  );

  csvSection(lines, 'Applications by Status');
  lines.push(csvRow(['Status', 'Applications']));
  report.status.forEach((slice) =>
    lines.push(csvRow([slice.label || slice.id, csvNumber(slice.count)]))
  );

  csvSection(lines, 'Jobs by Category (top 5)');
  lines.push(csvRow(['Category', 'Jobs']));
  report.category.forEach((item) => lines.push(csvRow([item.label, csvNumber(item.value)])));

  csvSection(lines, 'Jobs by Work Type');
  lines.push(csvRow(['Work type', 'Jobs']));
  report.workTypes.forEach((item) => lines.push(csvRow([item.label, csvNumber(item.value)])));

  csvSection(lines, 'Top Companies (top 5)');
  lines.push(csvRow(['Company', 'Jobs Posted']));
  report.topCompanies.forEach((item) => lines.push(csvRow([item.label, csvNumber(item.value)])));

  csvSection(lines, 'Most Applied Jobs (top 5)');
  lines.push(csvRow(['Job', 'Applications']));
  report.mostApplied.forEach((item) => lines.push(csvRow([item.label, csvNumber(item.value)])));

  csvSection(lines, `Jobs and Applications by Day (${report.trend.length} days)`);
  lines.push(csvRow(['Date', 'Jobs Posted', 'Applications']));
  report.trend.forEach((point) =>
    lines.push(csvRow([point.date, point.jobs, point.applications]))
  );

  return `${lines.join('\n')}\n`;
}