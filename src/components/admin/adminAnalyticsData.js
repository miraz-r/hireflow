/* ===========================================================================
   ADMIN ANALYTICS - REPORT DATA
   ---------------------------------------------------------------------------
   One local dataset per supported date range. Nothing here touches the admin
   API: the Analytics page is mock-first, so every figure is derived from a
   single deterministic daily series and the cards, both charts, the funnel and
   the CSV export all read the same numbers and therefore cannot disagree.

   Consistency rules this module guarantees:
     - Every range's trend series is a true suffix of one year-long series, so
       "Last 7 days" is literally the last 7 days of "Last 30 days" and no two
       ranges contradict each other.
     - The Applications KPI, the donut centre total, the funnel's first stage
       and the CSV all read the same applications sum from that series.
     - Status percentages are shares of that same total (and sum to 100), so the
       calculated per-status count in the tooltip is a real figure, not a guess.
     - Top Companies and Most Applied Jobs are fixed shares of the jobs and
       applications totals, so they scale with the window instead of drifting.

   The per-status percentages, funnel rates and KPI deltas are the only authored
   numbers. Everything else follows from the series, so a range can never show a
   chart that disagrees with the card above it.
   =========================================================================== */

export const DEFAULT_RANGE = '30';

export const DATE_RANGE_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'year', label: 'This year' },
];

/* --------------------------------------------------------------------------
   Daily series
   -------------------------------------------------------------------------- */

// Every window ends on the same day, so the four ranges stay comparable.
const PERIOD_END = '2026-09-26';

// Jan 1 -> Sep 26, 2026 inclusive. "This year" is the whole built series and
// every other range is sliced off its tail.
const YEAR_DAYS = 269;

const WINDOW_DAYS = { 7: 7, 30: 30, 90: 90, year: YEAR_DAYS };

const RANGE_LABELS = {
  7: 'Last 7 days',
  30: 'Last 30 days',
  90: 'Last 90 days',
  year: 'This year',
};

/**
 * Deterministic value noise in [0, 1).
 *
 * Deliberately not Math.random: the same range must render - and export - the
 * same series on every visit, otherwise a CSV would never match the screen it
 * was downloaded from and the chart would flicker between renders.
 */
function noise(seed, index) {
  const x = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** "2026-09-26" minus N days -> ISO date. Pure: Date.UTC from explicit parts
    only, so it never depends on the current clock or the local timezone. */
function isoDaysBack(daysBack) {
  const [y, m, d] = PERIOD_END.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - daysBack);
  return date.toISOString().slice(0, 10);
}

/**
 * One point per day, oldest first. A gentle year-long growth curve with a mild
 * seasonal wave, so short windows show realistic day-to-day wobble instead of
 * a flat line. Animation is off on the chart, but the shape still has to hold
 * up when the admin reads 269 points.
 */
function buildYearSeries() {
  const points = [];
  for (let i = 0; i < YEAR_DAYS; i += 1) {
    const progress = i / (YEAR_DAYS - 1);
    const seasonal = 1 + Math.sin(progress * Math.PI * 4) * 0.12;
    const applicationWave = 0.78 + noise(11, i) * 0.44;
    const jobWave = 0.7 + noise(29, i) * 0.7;
    points.push({
      date: isoDaysBack(YEAR_DAYS - 1 - i),
      applications: Math.max(1, Math.round(36.04 * (1 + 0.85 * progress) * seasonal * applicationWave)),
      jobs: Math.max(1, Math.round(4.4 * (1 + 1.05 * progress) * seasonal * jobWave)),
    });
  }
  return points;
}

// Built once and reused: the output is constant, so re-deriving 269 points on
// every render would be pure waste.
let yearSeries = null;

function getTrend(range) {
  if (!yearSeries) yearSeries = buildYearSeries();
  return yearSeries.slice(yearSeries.length - WINDOW_DAYS[range]);
}

/* --------------------------------------------------------------------------
   Authored per-range inputs
   -------------------------------------------------------------------------- */

// Order, labels and slice colours live together so the donut, its legend and
// the tooltip swatch can never fall out of step. `value` is the share below.
const STATUS_SERIES = [
  { id: 'new', label: 'New', fill: '#4f46e5' },
  { id: 'reviewing', label: 'Reviewing', fill: '#8b5cf6' },
  { id: 'shortlisted', label: 'Shortlisted', fill: '#0ea5e9' },
  { id: 'interview', label: 'Interview', fill: '#f59e0b' },
  { id: 'hired', label: 'Hired', fill: '#10b981' },
  { id: 'rejected', label: 'Rejected', fill: '#94a3b8' },
];

// Share of applications per status. Each row sums to exactly 100.
const STATUS_SHARE = {
  7: { new: 19, reviewing: 24, shortlisted: 17, interview: 12, hired: 8, rejected: 20 },
  30: { new: 18, reviewing: 24, shortlisted: 17, interview: 12, hired: 8, rejected: 21 },
  90: { new: 17, reviewing: 25, shortlisted: 18, interview: 12, hired: 8, rejected: 20 },
  year: { new: 16, reviewing: 25, shortlisted: 18, interview: 13, hired: 9, rejected: 19 },
};

// Share of applications reaching each funnel stage. 30 days is the approved
// reference set (412 / 238 / 96 of 1,842) and is reproduced exactly.
const FUNNEL_RATE = {
  7: { shortlisted: 0.2301, interviewed: 0.1318, hired: 0.0549 },
  30: { shortlisted: 0.2237, interviewed: 0.1292, hired: 0.0521 },
  90: { shortlisted: 0.2201, interviewed: 0.1277, hired: 0.0513 },
  year: { shortlisted: 0.2161, interviewed: 0.1258, hired: 0.0503 },
};

// Jobseekers and recruiters are standing counts, not period volume, so they are
// authored per range and rise gently with the window. Total Jobs and
// Applications are period totals and come from the series instead.
const RANGE_HEADLINE = {
  7: { jobseekers: 3180, jobseekersDelta: '+4.1%', recruiters: 171, recruitersDelta: '+2.9%', jobsDelta: '+5.3%', applicationsDelta: '+9.8%' },
  30: { jobseekers: 3426, jobseekersDelta: '+8.2%', recruiters: 184, recruitersDelta: '+5.6%', jobsDelta: '+12.4%', applicationsDelta: '+18.7%' },
  90: { jobseekers: 3965, jobseekersDelta: '+12.6%', recruiters: 198, recruitersDelta: '+7.8%', jobsDelta: '+18.7%', applicationsDelta: '+22.4%' },
  year: { jobseekers: 4472, jobseekersDelta: '+21.4%', recruiters: 214, recruitersDelta: '+11.2%', jobsDelta: '+26.5%', applicationsDelta: '+29.1%' },
};

// Category cards break the window's job postings down completely, so each
// range's five entries are authored to sum to exactly that range's Total Jobs
// KPI. The location cards below are only the top five locations and so sum to
// less than the same total.
const CATEGORY_LABELS = ['Technology', 'Design', 'Marketing', 'Finance', 'Sales'];
const CATEGORY_TOP_FIVE = {
  7: [21, 15, 12, 9, 8],
  30: [80, 56, 45, 37, 30],
  90: [246, 171, 141, 111, 74],
  year: [627, 438, 361, 285, 190],
};

// Jobs by Location is a top-five card: postings outside these five buckets are
// not broken out, so the entries deliberately sum to less than Total Jobs.
const LOCATION_LABELS = ['Dhaka', 'Chattogram', 'Remote', 'Sylhet', 'Other'];
const LOCATION_TOP_FIVE = {
  7: [20, 13, 12, 8, 6],
  30: [74, 51, 46, 29, 22],
  90: [223, 149, 134, 89, 67],
  year: [570, 380, 342, 228, 171],
};

// Fixed shares of the jobs total, so the rankings hold their order and relative
// spacing at every window length. 30 days reproduces 42 / 36 / 31 / 28 / 24.
const TOP_COMPANY_LABELS = ['Stark Industries', 'Aperture Science', 'OmniCorp', 'LexCorp', 'Wayne Enterprises'];
const TOP_COMPANY_SHARE = [0.1694, 0.1452, 0.125, 0.1129, 0.0968];

// Fixed shares of the applications total. 30 days reproduces
// 184 / 161 / 137 / 121 / 96.
const MOST_APPLIED_LABELS = ['Frontend Developer', 'Software Engineer', 'Product Designer', 'Data Analyst', 'Marketing Manager'];
const MOST_APPLIED_SHARE = [0.0999, 0.0874, 0.0744, 0.0657, 0.0521];

/* --------------------------------------------------------------------------
   The activity feed
   --------------------------------------------------------------------------
   The same four records back the Analytics table and the /admin/activity page,
   so the "View all activity" link lands on exactly the rows it promised. */

export const RECENT_ACTIVITY = [
  { activity: 'Job posted', user: 'Stark Industries', date: 'Sep 26' },
  { activity: 'Application received', user: 'David Okafor', date: 'Sep 26' },
  { activity: 'Recruiter joined', user: 'Elena Petrova', date: 'Sep 25' },
  { activity: 'Jobseeker registered', user: 'Marcus Chen', date: 'Sep 25' },
];

/* --------------------------------------------------------------------------
   Report assembly
   -------------------------------------------------------------------------- */

const sumBy = (rows, key) => rows.reduce((total, row) => total + row[key], 0);

const toItems = (labels, values, unit) =>
  labels.map((label, index) => ({ label, value: values[index], ...(unit ? { unit } : {}) }));

/**
 * getAnalyticsReport - the complete, internally consistent report for one
 * range. Unknown or missing values fall back to the default range so the page
 * can never render an empty or half-populated report.
 */
export function getAnalyticsReport(range) {
  const key = Object.prototype.hasOwnProperty.call(WINDOW_DAYS, range) ? range : DEFAULT_RANGE;
  const trend = getTrend(key);
  const applications = sumBy(trend, 'applications');
  const jobs = sumBy(trend, 'jobs');
  const headline = RANGE_HEADLINE[key];
  const funnelRate = FUNNEL_RATE[key];

  return {
    range: key,
    label: RANGE_LABELS[key],
    trend,
    applications,
    jobs,
    kpis: [
      { id: 'jobs', label: 'Total Jobs', value: jobs, delta: headline.jobsDelta },
      { id: 'applications', label: 'Applications', value: applications, delta: headline.applicationsDelta },
      { id: 'jobseekers', label: 'Active Jobseekers', value: headline.jobseekers, delta: headline.jobseekersDelta },
      { id: 'recruiters', label: 'Active Recruiters', value: headline.recruiters, delta: headline.recruitersDelta },
    ],
    status: STATUS_SERIES.map((slice) => {
      const share = STATUS_SHARE[key][slice.id];
      return { ...slice, value: share, count: Math.round((applications * share) / 100) };
    }),
    category: toItems(CATEGORY_LABELS, CATEGORY_TOP_FIVE[key]),
    location: toItems(LOCATION_LABELS, LOCATION_TOP_FIVE[key]),
    topCompanies: TOP_COMPANY_LABELS.map((label, index) => ({
      label,
      value: Math.round(jobs * TOP_COMPANY_SHARE[index]),
      unit: 'jobs',
    })),
    mostApplied: MOST_APPLIED_LABELS.map((label, index) => ({
      label,
      value: Math.round(applications * MOST_APPLIED_SHARE[index]),
    })),
    funnel: [
      { label: 'Applications', value: applications },
      { label: 'Shortlisted', value: Math.round(applications * funnelRate.shortlisted) },
      { label: 'Interviewed', value: Math.round(applications * funnelRate.interviewed) },
      { label: 'Hired', value: Math.round(applications * funnelRate.hired) },
    ],
  };
}

/* --------------------------------------------------------------------------
   CSV export
   -------------------------------------------------------------------------- */

const needsQuotes = /[",\r\n]/;

function csvCell(value) {
  const text = String(value ?? '');
  return needsQuotes.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const csvRow = (cells) => cells.map(csvCell).join(',');

// Plain digits, deliberately not grouped: a quoted "1,842" parses as text in
// Excel and Sheets, which would defeat the point of exporting the numbers.
const csvNumber = (value) => String(value);

/** Section heading: a blank line, then a single bold-ish title cell. */
function csvSection(lines, title) {
  lines.push('');
  lines.push(csvRow([title]));
}

/**
 * buildAnalyticsCsv - serialises one report to CSV text.
 *
 * Pure: the caller decides what to do with the string (the page hands it to a
 * Blob download). Every figure comes from the same report object the screen is
 * showing, so the file and the view can never diverge. Section order mirrors
 * the page top-to-bottom, with the daily series last because "This year" makes
 * it the longest block.
 */
export function buildAnalyticsCsv(report) {
  const lines = [
    csvRow(['HireFlow Analytics Export']),
    csvRow(['Date range', report.label]),
    csvRow(['Window', `${report.trend[0].date} to ${report.trend[report.trend.length - 1].date}`]),
  ];

  csvSection(lines, 'KPI Metrics');
  lines.push(csvRow(['Metric', 'Value', 'Change vs previous period']));
  report.kpis.forEach((kpi) => lines.push(csvRow([kpi.label, csvNumber(kpi.value), kpi.delta])));

  csvSection(lines, 'Application Status');
  lines.push(csvRow(['Status', 'Share', 'Applications']));
  report.status.forEach((slice) => lines.push(csvRow([slice.label, `${slice.value}%`, csvNumber(slice.count)])));

  csvSection(lines, 'Jobs by Category (top 5)');
  lines.push(csvRow(['Category', 'Jobs']));
  report.category.forEach((item) => lines.push(csvRow([item.label, csvNumber(item.value)])));

  csvSection(lines, 'Jobs by Location (top 5)');
  lines.push(csvRow(['Location', 'Jobs']));
  report.location.forEach((item) => lines.push(csvRow([item.label, csvNumber(item.value)])));

  csvSection(lines, 'Top Companies (top 5)');
  lines.push(csvRow(['Company', 'Jobs Posted']));
  report.topCompanies.forEach((item) => lines.push(csvRow([item.label, csvNumber(item.value)])));

  csvSection(lines, 'Most Applied Jobs (top 5)');
  lines.push(csvRow(['Job', 'Applications']));
  report.mostApplied.forEach((item) => lines.push(csvRow([item.label, csvNumber(item.value)])));

  csvSection(lines, 'Hiring Funnel');
  lines.push(csvRow(['Stage', 'Applications', 'Share of applications']));
  report.funnel.forEach((stage) => {
    const share = report.applications > 0 ? (stage.value / report.applications) * 100 : 0;
    lines.push(csvRow([stage.label, csvNumber(stage.value), `${(Math.round(share * 10) / 10).toFixed(1)}%`]));
  });

  csvSection(lines, `Applications and Jobs by Day (${report.trend.length} days)`);
  lines.push(csvRow(['Date', 'Applications', 'Jobs Posted']));
  report.trend.forEach((point) => lines.push(csvRow([point.date, point.applications, point.jobs])));

  return `${lines.join('\n')}\n`;
}
