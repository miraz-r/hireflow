const Job = require('../models/Job');
const Application = require('../models/Application');
const User = require('../models/User');
const Profile = require('../models/Profile');
const SavedJob = require('../models/SavedJob');
const { APPLICATION_STATUSES } = require('../utils/applicationStatus');

// Statuses an administrator can set through moderation. 'expired' is system-
// owned (derived from time) and is intentionally not in the manual set.
const MODERATION_STATUSES = ['active', 'pending', 'closed', 'draft'];
const VALID_EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship'];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------------------------------------------------------------------------
// GET /api/admin — platform-level stats for the Overview dashboard.
// ---------------------------------------------------------------------------
const getStats = async (req, res, next) => {
  try {
    const [
      totalJobs,
      activeJobs,
      totalApplications,
      totalUsers,
      pipeline,
    ] = await Promise.all([
      Job.countDocuments(),
      Job.countDocuments({ status: 'active' }),
      Application.countDocuments(),
      User.countDocuments(),
      Application.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const pipelineCounts = {};
    for (const { _id, count } of pipeline) {
      pipelineCounts[_id] = count;
    }

    return res.status(200).json({
      totalJobs,
      activeJobs,
      totalApplications,
      totalUsers,
      pipeline: pipelineCounts,
    });
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/applications/trend?days=30 — per-day application volume over
// the trailing window. Every calendar day is returned, including zero-count
// days, so the chart stays chronological and never invents data gaps.
// ---------------------------------------------------------------------------
const getApplicationsTrend = async (req, res, next) => {
  try {
    const days = Math.min(
      Math.max(parseInt(req.query.days, 10) || 30, 1),
      90
    );
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    start.setUTCHours(0, 0, 0, 0);

    const rows = await Application.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ]);

    const byDate = {};
    for (const { _id, count } of rows) {
      byDate[_id] = count;
    }

    const points = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      points.push({ date: key, count: byDate[key] || 0 });
    }

    return res.status(200).json({ days, points });
  } catch (err) {
    return next(err);
  }
};

// Count documents of `model` grouped by `userId` for the given accounts.
// Same shape as applicationCountsByJob, keyed on the account instead of the job.
const countsByUser = async (model, userIds) => {
  if (!userIds.length) return new Map();
  const rows = await model.aggregate([
    { $match: { userId: { $in: userIds } } },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
};

// ---------------------------------------------------------------------------
// GET /api/admin/jobseekers?page=1&limit=10&q=&location=&dateRange=
//
// The Admin Jobseekers workspace list.
//
// SOURCED FROM THE JOBSEEKER PROFILE, NOT THE ACCOUNT'S ACTIVE WORKSPACE.
// `User.role` is only which workspace an account is currently in, so someone
// who registered as a jobseeker and later opened the recruiter workspace still
// has a real jobseeker profile. Matching on `Profile.role === 'jobseeker'`
// therefore lists exactly the jobseekers, whatever workspace their account
// happens to be active in.
//
// INNER-JOINED TO THE OWNING ACCOUNT, and deliberately so: a profile whose
// account has been deleted is not a jobseeker, and listing it would render a
// row that GET /api/admin/jobseekers/:userId could never resolve. List and
// detail therefore agree on the same set of accounts.
//
// COUNTS are aggregated from Application and SavedJob rather than invented, and
// `activeWorkspace` reports the account's real current workspace so an admin can
// see at a glance that a jobseeker is currently hiring instead.
//
// NOTE ON `status`: the User model has no status field, so this endpoint
// deliberately exposes none. An account's activity state cannot be derived from
// existing data, and inventing one would be a fabrication.
// ---------------------------------------------------------------------------
const listAdminJobseekers = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;

    const filter = { role: 'jobseeker' };

    const { q, location, dateRange } = req.query;

    if (location && location.trim()) {
      filter.location = location.trim();
    }

    if (dateRange) {
      const start = new Date();
      if (dateRange === 'today') {
        start.setHours(0, 0, 0, 0);
      } else {
        const days = Math.min(Math.max(parseInt(dateRange, 10) || 7, 1), 365);
        start.setDate(start.getDate() - days);
      }
      filter.createdAt = { $gte: start };
    }

    // Search spans the profile name and the account email. The name lives on
    // Profile and the email on User, so the email arm matches the joined
    // account below.
    const searchRegex =
      q && q.trim() ? new RegExp(escapeRegex(q.trim()), 'i') : null;

    // Joined to the owning account so that only rows backed by a real account
    // are counted and returned. An orphaned profile (its User deleted) is not a
    // jobseeker account, and listing it would produce a row that the detail
    // endpoint could never load. `$unwind` drops those, and dropping them here
    // — before paging — keeps `total` and `totalPages` accurate.
    const pipeline = [
      { $match: filter },
      {
        $lookup: {
          from: User.collection.name,
          localField: 'userId',
          foreignField: '_id',
          as: 'account',
        },
      },
      { $unwind: '$account' },
    ];

    if (searchRegex) {
      pipeline.push({
        $match: {
          $or: [{ fullName: searchRegex }, { 'account.email': searchRegex }],
        },
      });
    }

    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({
      $facet: {
        rows: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: 'count' }],
      },
    });

    const [result] = await Profile.aggregate(pipeline);
    const profiles = result.rows || [];
    const total = result.total.length ? result.total[0].count : 0;

    const userIds = profiles.map((p) => p.userId);

    const [applicationCounts, savedJobCounts] = await Promise.all([
      countsByUser(Application, userIds),
      countsByUser(SavedJob, userIds),
    ]);

    const jobseekers = profiles.map((profile) => {
      const key = String(profile.userId);
      const email = (profile.account && profile.account.email) || '';
      return {
        id: profile.userId,
        name: profile.fullName || email,
        email,
        phone: profile.phone || '',
        location: profile.location || '',
        avatarUrl: profile.avatarUrl || '',
        headline: profile.headline || '',
        applications: applicationCounts.get(key) || 0,
        savedJobs: savedJobCounts.get(key) || 0,
        // The profile's own creation date: when this workspace was set up.
        joinedAt: profile.createdAt,
        // Where the account is right now (navigation), which is independent of
        // whether it holds a jobseeker profile.
        activeWorkspace: (profile.account && profile.account.role) || '',
      };
    });

    return res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      jobseekers,
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid filter id' });
    }
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/jobseekers/:userId
//
// The APPLICANT behind an application, for the Admin Applications "View
// Profile" action. This exists because there is no other way to read someone
// else's profile: GET /api/profile is scoped to the authenticated caller.
//
// WHY THE GUARD IS "HAS A JOBSEEKER PROFILE"
// `User.role` is only which workspace an account is CURRENTLY in, so it cannot
// answer "is this a jobseeker" — someone who registered as a jobseeker and later
// opened the recruiter workspace is still a jobseeker. The Profile is the
// per-workspace record, so presence of a jobseeker profile is the real answer.
//
// This also keeps the list and this endpoint in agreement. The Admin Jobseekers
// workspace lists every account holding a jobseeker profile, so this endpoint
// must serve exactly that set. An earlier version guarded on "has at least one
// application" instead; that is a proxy, not a definition, and it 404'd every
// listed jobseeker who had not applied yet (20 of 28 rows in the development
// database), so selecting a listed row reported "Jobseeker not found".
//
// WHAT IS AND IS NOT EXPOSED
//   - The JOBSEEKER profile is the subject, and it is read by
//     `{ userId, role: 'jobseeker' }` — the person's own profile,
//     independent of whichever workspace is currently active.
//   - Recruiter-only fields (jobTitle, companyName, companyWebsite,
//     companyDescription) are never returned, so an account that also has a
//     recruiter workspace is never presented as a jobseeker on those details.
//   - An account with NO jobseeker profile — a recruiter-only or admin-only
//     account — is still a 404, so the route cannot be used to read a profile
//     it was never meant to expose.
//   - `applications` and `recentApplications` are real: they are simply empty
//     for someone who has not applied to anything, rather than being padded or
//     the account being hidden.
//   - activeWorkspace is returned so the UI can say where the person is
//     working without implying that is the only workspace they have.
// ---------------------------------------------------------------------------
const getAdminJobseeker = async (req, res, next) => {
  try {
    const userId = req.params.userId;

    const user = await User.findById(userId)
      .select('email role createdAt')
      .lean();
    if (!user) {
      return res.status(404).json({ error: 'Jobseeker not found' });
    }

    // One profile per workspace, so read the jobseeker one explicitly rather
    // than "whatever profile this account happens to have".
    const [jobseekerProfile, recruiterProfile, applicationCount, savedJobCount] =
      await Promise.all([
        Profile.findOne({ userId, role: 'jobseeker' }).lean(),
        Profile.findOne({ userId, role: 'recruiter' }).lean(),
        Application.countDocuments({ userId }),
        SavedJob.countDocuments({ userId }),
      ]);

    // Not a jobseeker: the account exists but holds no jobseeker profile. Same
    // 404 as an unknown id, so the route cannot be used to read a
    // recruiter-only or admin-only profile.
    if (!jobseekerProfile) {
      return res.status(404).json({ error: 'Jobseeker not found' });
    }

    // The most recent applications, for the workspace detail panel. Joined to
    // their jobs so the panel can show what was applied to. `status` is the
    // canonical backend value; the UI maps it for display.
    const recentApplications = await Application.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('jobId status createdAt')
      .populate('jobId', 'title company')
      .lean();

    // The guard above guarantees a jobseeker profile exists, so it is the
    // source for identity and for every applicant-specific field. The
    // recruiter profile is read only to report which other workspaces the
    // account holds — none of its fields are ever returned.
    const identity = jobseekerProfile;
    const available = ['jobseeker', recruiterProfile ? 'recruiter' : null].filter(Boolean);

    return res.status(200).json({
      jobseeker: {
        id: user._id,
        email: user.email,
        joinedAt: user.createdAt,
        // Where the account is working right now (navigation/permissions).
        activeWorkspace: user.role,
        availableWorkspaces: available,
        isActiveJobseeker: user.role === 'jobseeker',
        // Always true on this response: a 404 is returned when it would not be.
        profileExists: true,
        fullName: (identity && identity.fullName) || '',
        location: (identity && identity.location) || '',
        phone: (identity && identity.phone) || '',
        avatarUrl: (identity && identity.avatarUrl) || '',
        resumeUrl: (identity && identity.resumeUrl) || '',
        resumeName: (identity && identity.resumeName) || '',
        // Applicant-specific content, only ever from the jobseeker profile.
        headline: (jobseekerProfile && jobseekerProfile.headline) || '',
        bio: (jobseekerProfile && jobseekerProfile.bio) || '',
        skills: (jobseekerProfile && jobseekerProfile.skills) || [],
        education: (jobseekerProfile && jobseekerProfile.education) || [],
        experience: (jobseekerProfile && jobseekerProfile.experience) || [],
        links: (jobseekerProfile && jobseekerProfile.links) || [],
        applications: applicationCount,
        savedJobs: savedJobCount,
        // Newest first, for the detail panel's "Recent applications" list.
        recentApplications: recentApplications.map((app) => ({
          id: app._id,
          job: (app.jobId && app.jobId.title) || 'Untitled job',
          company: (app.jobId && app.jobId.company) || 'Unknown company',
          status: app.status,
          appliedAt: app.createdAt,
        })),
      },
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid jobseeker id' });
    }
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/recruiters?page=1&limit=10&q=&company=&dateRange=
//
// The Admin Recruiters workspace list.
//
// SOURCED FROM THE RECRUITER PROFILE, NOT THE ACCOUNT'S ACTIVE WORKSPACE.
// `User.role` is only which workspace an account is currently in, so someone
// who registered as a jobseeker and later opened the recruiter workspace is
// still a recruiter. Matching on `Profile.role === 'recruiter'` therefore lists
// exactly the recruiters, whatever workspace their account happens to be
// active in. The account's current workspace is reported separately as
// `activeWorkspace` so an admin can still see who is currently hiring.
//
// INNER-JOINED TO THE OWNING ACCOUNT, and deliberately so, for the same reason
// as the jobseeker list: a profile whose account has been deleted is not a
// recruiter, and listing it would render a row backed by no real account.
// `$unwind` drops those, and dropping them here — before paging — keeps `total`
// and `totalPages` accurate.
//
// COUNTS are aggregated from Job and Application rather than invented. `jobs`
// is the number of listings the recruiter posted; `applications` is the number
// of applications received on those listings.
//
// NOTE ON `status`: the User model has no status field, so this endpoint
// deliberately exposes none. A recruiter's active/suspended state cannot be
// derived from existing data, and inventing one would be a fabrication.
//
// NO DETAIL ENDPOINT: the workspace's detail panel renders entirely from the
// list row, so every field it shows is already returned here. Adding a
// per-recruiter fetch would be a second round trip for data the panel already
// holds, and would create a second definition of "is a recruiter" that could
// drift from this list.
// ---------------------------------------------------------------------------
const listAdminRecruiters = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;

    const filter = { role: 'recruiter' };

    const { q, company, dateRange } = req.query;

    // Company is a free-text field on the recruiter profile, so this is an exact
    // match on what the recruiter typed — never a fuzzy or case-insensitive
    // guess that could merge two genuinely different companies.
    if (company && company.trim()) {
      filter.companyName = company.trim();
    }

    if (dateRange) {
      const start = new Date();
      if (dateRange === 'today') {
        start.setHours(0, 0, 0, 0);
      } else {
        const days = Math.min(Math.max(parseInt(dateRange, 10) || 7, 1), 365);
        start.setDate(start.getDate() - days);
      }
      filter.createdAt = { $gte: start };
    }

    // Search spans the recruiter's identity (profile name, job title, company)
    // and the account's email. The first three live on Profile and the email on
    // User, so the email arm matches the joined account below.
    const searchRegex =
      q && q.trim() ? new RegExp(escapeRegex(q.trim()), 'i') : null;

    const pipeline = [
      { $match: filter },
      {
        $lookup: {
          from: User.collection.name,
          localField: 'userId',
          foreignField: '_id',
          as: 'account',
        },
      },
      { $unwind: '$account' },
    ];

    if (searchRegex) {
      pipeline.push({
        $match: {
          $or: [
            { fullName: searchRegex },
            { jobTitle: searchRegex },
            { companyName: searchRegex },
            { 'account.email': searchRegex },
          ],
        },
      });
    }

    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({
      $facet: {
        rows: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: 'count' }],
      },
    });

    const [result] = await Profile.aggregate(pipeline);
    const profiles = result.rows || [];
    const total = result.total.length ? result.total[0].count : 0;

    const userIds = profiles.map((p) => p.userId);

    const { jobsByOwner, applicationsByOwner } = await hiringCountsByRecruiter(
      userIds
    );

    const recruiters = profiles.map((profile) => {
      const key = String(profile.userId);
      const email = (profile.account && profile.account.email) || '';
      return {
        id: profile.userId,
        name: profile.fullName || email,
        email,
        phone: profile.phone || '',
        location: profile.location || '',
        avatarUrl: profile.avatarUrl || '',
        // Recruiter-only profile fields, used by the detail panel and by the
        // company search arm above.
        jobTitle: profile.jobTitle || '',
        company: profile.companyName || '',
        companyWebsite: profile.companyWebsite || '',
        // Real aggregates, and genuinely zero for a recruiter with no activity.
        jobs: jobsByOwner.get(key) || 0,
        applications: applicationsByOwner.get(key) || 0,
        // The profile's own creation date: when this workspace was set up.
        joinedAt: profile.createdAt,
        // Where the account is right now (navigation), which is independent of
        // whether it holds a recruiter profile.
        activeWorkspace: (profile.account && profile.account.role) || '',
      };
    });

    return res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      recruiters,
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid filter id' });
    }
    return next(err);
  }
};

// Count jobs posted and applications received for a page of recruiter accounts.
//
// Applications have no recruiter of their own — they belong to a job, and a
// job belongs to whoever posted it — so "applications received" is resolved in
// two steps: group the accounts' jobs by owner, then group applications by job
// and attribute each job's total to its owner. A recruiter with no jobs
// produces no entries at all and is reported as a real zero.
//
// Two fixed-cost queries regardless of how many recruiters are on the page.
const hiringCountsByRecruiter = async (userIds) => {
  const jobsByOwner = new Map();
  const applicationsByOwner = new Map();

  if (!userIds.length) {
    return { jobsByOwner, applicationsByOwner };
  }

  const jobs = await Job.find({ postedBy: { $in: userIds } })
    .select('_id postedBy')
    .lean();

  if (!jobs.length) {
    return { jobsByOwner, applicationsByOwner };
  }

  // job id -> owning account id, so each job's application total can be
  // attributed to the recruiter who posted it.
  const ownerByJobId = new Map();
  for (const job of jobs) {
    const owner = String(job.postedBy);
    ownerByJobId.set(String(job._id), owner);
    jobsByOwner.set(owner, (jobsByOwner.get(owner) || 0) + 1);
  }

  const rows = await Application.aggregate([
    { $match: { jobId: { $in: jobs.map((job) => job._id) } } },
    { $group: { _id: '$jobId', count: { $sum: 1 } } },
  ]);

  for (const { _id, count } of rows) {
    const owner = ownerByJobId.get(String(_id));
    if (owner) {
      applicationsByOwner.set(owner, (applicationsByOwner.get(owner) || 0) + count);
    }
  }

  return { jobsByOwner, applicationsByOwner };
};

// ---------------------------------------------------------------------------
// GET /api/admin/analytics?range=7|30|90|year
//
// The Admin Analytics report.
//
// EVERY FIGURE IS AGGREGATED FROM REAL RECORDS. The previous implementation
// served a deterministic synthetic series, so nothing here is authored: the
// trends, KPIs, breakdowns and status mix are all read from Job, Application and
// Profile.
//
// WINDOWS ARE SERVER-SIDDEN AND UTC. The client cannot pick its own dates, so a
// report's numbers and its own trend series always describe the same period.
// Every boundary is a UTC midnight so grouping and filtering agree, and a day is
// bucketed by the same UTC calendar the range is built from.
//
// THE COMPARISON WINDOW IS DERIVED, NOT STORED. Each KPI carries its previous
// period's value and the percentage change against it. A zero previous value has
// no meaningful percentage, so it is reported as `null` rather than Infinity or
// NaN, and the UI renders that as "no prior period" — a real state, not a
// missing one.
//
// STATUS IS THE CANONICAL BACKEND VOCABULARY (applied, under-review, interview,
// offer, hired, rejected), counted from Application.status. No admin-only status
// is invented for reporting, and the display labels come from the shared
// ADMIN_STATUS_LABELS map.
//
// THE PIPELINE CARD IS A CURRENT-STATUS SNAPSHOT, NOT A CONVERSION FUNNEL.
// Application.status records where an application sits NOW, not every stage it
// has passed through, so the numbers are honestly presented as current counts per
// status. They are not forced to decrease down the list: an application that was
// rejected and then re-reviewed would otherwise be counted twice across stages,
// which is exactly the fabricated conversion the previous funnel invented.
//
// ONE SCAN PER COLLECTION. Job, Application and Profile are each read once,
// using $facet so a collection is traversed a single time and every figure for
// that collection comes out of the same pass.
// ---------------------------------------------------------------------------
const ANALYTICS_RANGES = {
  7: { days: 7, label: 'Last 7 days' },
  30: { days: 30, label: 'Last 30 days' },
  90: { days: 90, label: 'Last 90 days' },
  year: { yearToDate: true, label: 'This year' },
};

const ANALYTICS_TOP_N = 5;

// One day in milliseconds. UTC days are always exactly this long (no DST), which
// is why every boundary in this module can be built by adding this constant.
const DAY_MS = 24 * 60 * 60 * 1000;

// Canonical pipeline order. Anything outside this list still appears in the
// counts (a document cannot hold an invalid status), but these lead the display.
const ANALYTICS_STATUS_ORDER = APPLICATION_STATUSES;

// Start-of-day in UTC. Every window boundary and every daily bucket uses this,
// so a record is grouped into exactly the day the range counts it in.
const utcDayStart = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

// The reporting window plus the immediately preceding window of equal length.
const analyticsWindows = (rangeKey) => {
  const config = ANALYTICS_RANGES[rangeKey];
  const now = new Date();
  // The window ends at the last millisecond of the current UTC day, so a record
  // created a moment ago is inside it rather than in the future.
  const end = new Date(utcDayStart(now).getTime() + DAY_MS - 1);

  let start;
  if (config.yearToDate) {
    start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  } else {
    // The window opens at the UTC midnight `days - 1` days back, so "Last 7
    // days" is exactly seven whole calendar days including today. Deriving the
    // start from the end-of-day timestamp instead would shift the window nearly a
    // day forward and silently drop the oldest day.
    start = new Date(utcDayStart(now).getTime() - (config.days - 1) * DAY_MS);
  }

  const duration = end.getTime() - start.getTime();
  // The comparison window sits immediately before the reporting one and spans
  // exactly the same duration, so the two are directly comparable.
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration);

  return { start, end, previousStart, previousEnd, label: config.label };
};

const countByFacet = (rows, key) => {
  const row = rows[0];
  return row && key in row ? row[key] : 0;
};

// Percentage change from previous to current, or null when there is no previous
// value to compare against. Never returns Infinity or NaN: a zero baseline has
// no percentage, and inventing one (or dividing by it) would be a fabrication.
const percentChange = (current, previous) => {
  if (!previous) return null;
  const change = ((current - previous) / previous) * 100;
  return Number.isFinite(change) ? Math.round(change * 10) / 10 : null;
};

// Zero-fill a grouped-by-day result across the window so the chart is
// chronological and complete. Days with no activity are real zeroes, never gaps.
const zeroFilledDays = (start, end) => {
  const days = [];
  for (
    let day = utcDayStart(start);
    day.getTime() <= end.getTime();
    day = new Date(day.getTime() + DAY_MS)
  ) {
    days.push(day.toISOString().slice(0, 10));
  }
  return days;
};

const getAnalytics = async (req, res, next) => {
  try {
    const requested = req.query.range;
    const rangeKey =
      requested && Object.prototype.hasOwnProperty.call(ANALYTICS_RANGES, requested)
        ? requested
        : '30';
    const { start, end, previousStart, previousEnd, label } =
      analyticsWindows(rangeKey);

    const windowMatch = { createdAt: { $gte: start, $lte: end } };
    const previousMatch = { createdAt: { $gte: previousStart, $lte: previousEnd } };
    const dayFormat = { format: '%Y-%m-%d', timezone: 'UTC' };

    // ---- One pass over Job: totals, daily series, and the three breakdowns.
    const [jobFacet] = await Job.aggregate([
      {
        $facet: {
          current: [
            { $match: windowMatch },
            { $count: 'count' },
          ],
          previous: [
            { $match: previousMatch },
            { $count: 'count' },
          ],
          trend: [
            { $match: windowMatch },
            {
              $group: {
                _id: { $dateToString: { ...dayFormat, date: '$createdAt' } },
                count: { $sum: 1 },
              },
            },
          ],
          byCategory: [
            { $match: windowMatch },
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
            { $limit: ANALYTICS_TOP_N },
          ],
          // workType is a closed enum on the Job model, so this breakdown is
          // genuinely structured - unlike the free-text `location` field, whose
          // raw values cannot be bucketed into cities without guessing.
          byWorkType: [
            { $match: windowMatch },
            { $group: { _id: '$workType', count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
          ],
          byCompany: [
            { $match: windowMatch },
            { $group: { _id: '$company', count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
            { $limit: ANALYTICS_TOP_N },
          ],
        },
      },
    ]);

    // ---- One pass over Application: totals, daily series, status mix, and the
    // most-applied ranking. The ranking joins its jobs in the same pipeline.
    const [applicationFacet] = await Application.aggregate([
      {
        $facet: {
          current: [{ $match: windowMatch }, { $count: 'count' }],
          previous: [{ $match: previousMatch }, { $count: 'count' }],
          trend: [
            { $match: windowMatch },
            {
              $group: {
                _id: { $dateToString: { ...dayFormat, date: '$createdAt' } },
                count: { $sum: 1 },
              },
            },
          ],
          byStatus: [
            { $match: windowMatch },
            { $group: { _id: '$status', count: { $sum: 1 } } },
          ],
          mostApplied: [
            { $match: windowMatch },
            { $group: { _id: '$jobId', count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
            { $limit: ANALYTICS_TOP_N },
            {
              $lookup: {
                from: Job.collection.name,
                localField: '_id',
                foreignField: '_id',
                as: 'job',
              },
            },
            // A listing deleted after being applied to has no title left. It
            // keeps its real count and is labelled, never dropped or renamed.
            { $unwind: { path: '$job', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                count: 1,
                title: { $ifNull: ['$job.title', 'Deleted job'] },
              },
            },
          ],
        },
      },
    ]);

    // ---- One pass over Profile: new jobseekers and new recruiters. Counted
    // from the workspace profiles rather than User, so a person who holds both
    // workspaces is counted once per workspace, matching how the Recruiters and
    // Jobseekers workspaces count people.
    const [profileFacet] = await Profile.aggregate([
      { $match: { createdAt: { $gte: previousStart, $lte: end } } },
      {
        $facet: {
          jobseekers: [
            { $match: { role: 'jobseeker', ...windowMatch } },
            { $count: 'count' },
          ],
          jobseekersPrevious: [
            { $match: { role: 'jobseeker', ...previousMatch } },
            { $count: 'count' },
          ],
          recruiters: [
            { $match: { role: 'recruiter', ...windowMatch } },
            { $count: 'count' },
          ],
          recruitersPrevious: [
            { $match: { role: 'recruiter', ...previousMatch } },
            { $count: 'count' },
          ],
        },
      },
    ]);

    // ---- Assemble. Every figure below is a real aggregate.
    const jobsTotal = countByFacet(jobFacet.current, 'count');
    const jobsPrevious = countByFacet(jobFacet.previous, 'count');
    const applicationsTotal = countByFacet(applicationFacet.current, 'count');
    const applicationsPrevious = countByFacet(applicationFacet.previous, 'count');
    const jobseekersTotal = countByFacet(profileFacet.jobseekers, 'count');
    const jobseekersPrevious = countByFacet(profileFacet.jobseekersPrevious, 'count');
    const recruitersTotal = countByFacet(profileFacet.recruiters, 'count');
    const recruitersPrevious = countByFacet(profileFacet.recruitersPrevious, 'count');

    const jobDays = {};
    for (const row of jobFacet.trend || []) jobDays[row._id] = row.count;
    const applicationDays = {};
    for (const row of applicationFacet.trend || []) applicationDays[row._id] = row.count;
    // Every calendar day in the window is present, with real zeroes on the quiet
    // ones, so the chart is chronological and never implies missing data.
    const trend = zeroFilledDays(start, end).map((date) => ({
      date,
      jobs: jobDays[date] || 0,
      applications: applicationDays[date] || 0,
    }));

    const statusCounts = new Map(
      (applicationFacet.byStatus || []).map((row) => [row._id, row.count])
    );
    const status = ANALYTICS_STATUS_ORDER.map((id) => ({
      id,
      count: statusCounts.get(id) || 0,
    }));

    const report = {
      range: rangeKey,
      label,
      window: { start: start.toISOString(), end: end.toISOString() },
      previousWindow: {
        start: previousStart.toISOString(),
        end: previousEnd.toISOString(),
      },
      trend,
      applications: applicationsTotal,
      jobs: jobsTotal,
      kpis: [
        {
          id: 'jobs',
          label: 'Total Jobs',
          value: jobsTotal,
          previous: jobsPrevious,
          change: percentChange(jobsTotal, jobsPrevious),
        },
        {
          id: 'applications',
          label: 'Applications',
          value: applicationsTotal,
          previous: applicationsPrevious,
          change: percentChange(applicationsTotal, applicationsPrevious),
        },
        {
          id: 'jobseekers',
          label: 'New Jobseekers',
          value: jobseekersTotal,
          previous: jobseekersPrevious,
          change: percentChange(jobseekersTotal, jobseekersPrevious),
        },
        {
          id: 'recruiters',
          label: 'New Recruiters',
          value: recruitersTotal,
          previous: recruitersPrevious,
          change: percentChange(recruitersTotal, recruitersPrevious),
        },
      ],
      status,
      category: (jobFacet.byCategory || []).map((row) => ({
        label: row._id,
        value: row.count,
      })),
      workTypes: (jobFacet.byWorkType || []).map((row) => ({
        label: row._id,
        value: row.count,
      })),
      topCompanies: (jobFacet.byCompany || []).map((row) => ({
        label: row._id,
        value: row.count,
        unit: 'jobs',
      })),
      mostApplied: (applicationFacet.mostApplied || []).map((row) => ({
        label: row.title,
        value: row.count,
      })),
    };

    return res.status(200).json(report);
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/companies?page=1&limit=10&q=&dateRange=
//
// The Admin Companies workspace list.
//
// THERE IS NO COMPANY MODEL, and none is introduced here. A company is derived
// entirely from the recruiter profiles that claim it, grouped by the
// free-text `Profile.companyName`. Every field below is read or aggregated from
// data that already exists.
//
// SOURCED FROM RECRUITER PROFILES, NOT THE ACCOUNT'S ACTIVE WORKSPACE, for the
// same reason the recruiters list is: `User.role` only records which workspace
// an account is currently in. A person whose account is active in the jobseeker
// workspace still represents the company they work for.
//
// INNER-JOINED TO THE OWNING ACCOUNT, and deliberately so: a company whose only
// recruiters have been deleted is not a company this workspace can attribute
// anything to, and `$unwind` drops those profiles before grouping so they cannot
// inflate a recruiter count. Dropping them here — before the `$facet` — also
// keeps `total` and `totalPages` accurate.
//
// NAME IDENTITY IS THE NAME, EXACTLY AS TYPED. MongoDB groups and matches
// strings case-sensitively, so "Acme Corp" and "acme corp" remain two separate
// records. They may well be the same real-world company, but nothing stored
// says so, and merging them would silently collapse two distinct sets of
// recruiters. Normalising that is a data-modelling decision, not a display one.
//
// JOB ATTRIBUTION IS BY THE JOB'S OWN DECLARED EMPLOYER. `jobs` counts the
// listings whose `Job.company` is exactly this company name, and `applications`
// counts the applications received on those listings. It is deliberately NOT
// "jobs posted by this company's recruiters": a recruiter can post on behalf of
// a different employer, so the poster is not evidence of the company. In the
// development data this distinction is load-bearing — the seeded recruiters all
// work for one company while the listings they posted belong to many others —
// and crediting the poster's company for them would be plainly wrong.
//
// NO STATUS, NO INDUSTRY, NO FABRICATED DOMAIN. None of those are stored
// anywhere, so none are invented here, and no filter accepts them. The website
// comes from the recruiters' own `companyWebsite` and is reported only when no
// two of them recorded a different one.
//
// NO DETAIL ENDPOINT: the workspace panel renders entirely from the list row,
// so a per-company fetch would be a second round trip for data the panel
// already holds, and would create a second definition of "is a company" that
// could drift from this list.
// ---------------------------------------------------------------------------
const listAdminCompanies = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;

    const { q, dateRange } = req.query;

    // A company only exists here once a recruiter has claimed it by naming it.
    // Requiring a non-empty companyName also guarantees the `$group` key below
    // is never null, which keeps every row's id a real name.
    const filter = {
      role: 'recruiter',
      companyName: { $exists: true, $ne: '' },
    };

    if (dateRange) {
      const start = new Date();
      if (dateRange === 'today') {
        start.setHours(0, 0, 0, 0);
      } else {
        const days = Math.min(Math.max(parseInt(dateRange, 10) || 7, 1), 365);
        start.setDate(start.getDate() - days);
      }
      filter.createdAt = { $gte: start };
    }

    // Search spans the company name, its recruiters' names, and their account
    // emails, so an admin can find a company by the person who works there.
    // The first two live on Profile and the email on User, so the email arm
    // matches the joined account below.
    const searchRegex =
      q && q.trim() ? new RegExp(escapeRegex(q.trim()), 'i') : null;

    const pipeline = [
      { $match: filter },
      {
        $lookup: {
          from: User.collection.name,
          localField: 'userId',
          foreignField: '_id',
          as: 'account',
        },
      },
      { $unwind: '$account' },
    ];

    if (searchRegex) {
      pipeline.push({
        $match: {
          $or: [
            { companyName: searchRegex },
            { fullName: searchRegex },
            { 'account.email': searchRegex },
          ],
        },
      });
    }

    // Oldest recruiter first, so the group's `$first` is the company's earliest
    // recruiter — which is both the "joined" date and a real, deterministic
    // primary contact. `_id` breaks ties so the choice never depends on natural
    // document order.
    pipeline.push({ $sort: { createdAt: 1, _id: 1 } });

    pipeline.push({
      $group: {
        _id: '$companyName',
        recruiters: { $sum: 1 },
        joinedAt: { $first: '$createdAt' },
        contact: {
          $first: {
            id: '$userId',
            name: '$fullName',
            jobTitle: '$jobTitle',
            email: '$account.email',
            phone: '$phone',
          },
        },
        websites: { $addToSet: { $ifNull: ['$companyWebsite', ''] } },
      },
    });

    // Drop blank websites before deciding. A recruiter who never filled the
    // field in has made no claim about the company's site, so a blank is an
    // absence of information rather than a conflicting one — one blank among
    // agreeing recruiters does not erase a website they all recorded.
    // What does void it is two DIFFERENT recorded values: the company then has
    // no single website, and reporting either one would be a guess.
    pipeline.push({
      $set: {
        websites: {
          $filter: {
            input: '$websites',
            as: 'site',
            cond: { $ne: ['$$site', ''] },
          },
        },
      },
    });
    pipeline.push({
      $set: {
        companyWebsite: {
          $cond: [
            { $eq: [{ $size: '$websites' }, 1] },
            { $arrayElemAt: ['$websites', 0] },
            '',
          ],
        },
      },
    });

    // Most recently joined company first, name as a stable tie-break.
    pipeline.push({ $sort: { joinedAt: -1, _id: 1 } });
    pipeline.push({
      $facet: {
        rows: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: 'count' }],
      },
    });

    const [result] = await Profile.aggregate(pipeline);
    const groups = result.rows || [];
    const total = result.total.length ? result.total[0].count : 0;

    const { jobsByCompany, applicationsByCompany } =
      await jobsAndApplicationsByCompany(groups.map((group) => group._id));

    const companies = groups.map((group) => {
      const contact = group.contact;
      return {
        // No company document exists, so the name IS its identity and its key.
        id: group._id,
        name: group._id,
        companyWebsite: group.companyWebsite || '',
        recruiters: group.recruiters || 0,
        jobs: jobsByCompany.get(group._id) || 0,
        applications: applicationsByCompany.get(group._id) || 0,
        joinedAt: group.joinedAt,
        // Never a placeholder: every group is built from at least one real
        // recruiter profile that survived the join.
        primaryContact: {
          id: contact.id,
          name: contact.name || '',
          jobTitle: contact.jobTitle || '',
          email: contact.email || '',
          phone: contact.phone || '',
        },
      };
    });

    return res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      companies,
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid filter id' });
    }
    return next(err);
  }
};

// Count jobs and applications for a page of companies.
//
// JOB ATTRIBUTION, STATED ONCE: a listing belongs to a company when its own
// `company` field is exactly that company name. Nothing here looks at who
// posted it — see the attribution note on listAdminCompanies for why the
// poster is not evidence.
//
// Matching is case-sensitive, matching how the companies themselves were
// grouped. A listing for "acme corp" therefore does not count towards an
// "Acme Corp" row, and is reported against neither rather than guessed into the
// nearest one.
const jobsAndApplicationsByCompany = async (companyNames) => {
  const jobsByCompany = new Map();
  const applicationsByCompany = new Map();

  if (!companyNames.length) {
    return { jobsByCompany, applicationsByCompany };
  }

  const jobs = await Job.find({ company: { $in: companyNames } })
    .select('_id company')
    .lean();

  if (!jobs.length) {
    return { jobsByCompany, applicationsByCompany };
  }

  // job id -> the company name the job itself declares, so each job's
  // application total lands on the right company row.
  const companyByJobId = new Map();
  for (const job of jobs) {
    jobsByCompany.set(job.company, (jobsByCompany.get(job.company) || 0) + 1);
    companyByJobId.set(String(job._id), job.company);
  }

  const rows = await Application.aggregate([
    { $match: { jobId: { $in: jobs.map((job) => job._id) } } },
    { $group: { _id: '$jobId', count: { $sum: 1 } } },
  ]);

  for (const { _id, count } of rows) {
    const name = companyByJobId.get(String(_id));
    if (name) {
      applicationsByCompany.set(name, (applicationsByCompany.get(name) || 0) + count);
    }
  }

  return { jobsByCompany, applicationsByCompany };
};

// ---------------------------------------------------------------------------
// GET /api/admin/applications?page=1&limit=8
//
// Backs two consumers at once:
//   1. The Overview's "Recent Applications" table (page=1, limit=8, no filters).
//   2. The Admin Applications workspace, which adds optional search, status,
//      job, recruiter, and date-range filters over a full page of rows.
//
// BACKWARD COMPATIBILITY: the five fields the Overview already renders
// (applicant, jobTitle, company, status, appliedAt) keep their exact names and
// their exact fallback precedence, and the no-filter default still returns the
// newest 8 rows. Everything the workspace needs is added alongside them, so an
// Overview regression is impossible by construction.
// ---------------------------------------------------------------------------
const listAdminApplications = async (req, res, next) => {
  try {
    // Default 8 / default page 1 reproduce the Overview call exactly. The cap
    // rises from 25 to 50 so the workspace can request a full table page; the
    // Overview never asks for more than 8, so its behavior is untouched.
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 50);
    const skip = (page - 1) * limit;

    const filter = await buildApplicationFilter(req.query);

    const [applications, total] = await Promise.all([
      Application.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Application.countDocuments(filter),
    ]);

    const items = await hydrateAdminApplications(applications);

    return res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      applications: items,
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid filter id' });
    }
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/applications/:id — full admin detail for the workspace panel.
// Admin-scoped, so it is not subject to the recruiter ownership rule; it
// returns the same applicant/job information the recruiter detail view shows,
// plus the posting recruiter.
// ---------------------------------------------------------------------------
const getAdminApplication = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id).lean();
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const [job, profile, account] = await Promise.all([
      Job.findById(application.jobId).lean(),
      Profile.findOne({ userId: application.userId }).lean(),
      User.findById(application.userId).select('email').lean(),
    ]);

    const recruiterMap = job ? await recruiterInfoFor([job]) : new Map();
    const postedBy = job && job.postedBy ? job.postedBy.toString() : '';
    const accountEmail = (account && account.email) || '';
    const profileName = (profile && profile.fullName) || '';

    return res.status(200).json({
      application: {
        id: application._id,
        userId: application.userId,
        // Canonical backend status. The frontend maps it for display via
        // ADMIN_STATUS_LABELS; no admin-specific status is stored.
        status: application.status,
        appliedAt: application.createdAt,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
        coverLetter: application.coverLetter || '',
        applicant: {
          id: application.userId,
          // Application-submitted values win, then profile, then account —
          // the same precedence the recruiter detail view uses, so legacy
          // records without the submitted fields still render.
          fullName: application.fullName || profileName || accountEmail || 'Applicant',
          headline: (profile && profile.headline) || '',
          avatarUrl: (profile && profile.avatarUrl) || '',
          location: (profile && profile.location) || '',
          email: application.email || accountEmail || null,
          phone: application.phone || (profile && profile.phone) || '',
          resumeUrl: application.resumeUrl || (profile && profile.resumeUrl) || '',
          linkedin: application.linkedin || '',
          portfolio: application.portfolio || '',
          skills: (profile && profile.skills) || [],
        },
        job: job
          ? {
              id: job._id,
              title: job.title,
              company: job.company,
              location: job.location,
              workType: job.workType,
              employmentType: job.employmentType,
              experienceLevel: job.experienceLevel,
              category: job.category,
              salary: job.salary || {},
              skills: job.skills || [],
              description: job.description || '',
              accent: job.accent || '',
              // Mirrors the jobs workspace: a legacy job with no status is live.
              status: job.status || 'active',
            }
          : null,
        recruiter: postedBy ? recruiterMap.get(postedBy) || null : null,
      },
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid application id' });
    }
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/admin/applications/:id/status — admin moderation of an
// application's pipeline status.
//
// This is deliberately NOT the recruiter controller (updateApplicationStatus in
// application.controller.js). That handler enforces `job.postedBy === caller`,
// which an admin never satisfies, and — more importantly — it writes a
// RecruiterActivity row on every change. RecruiterActivity is the recruiter's
// own pipeline history keyed on `recruiterId`; recording an admin's moderation
// action there would invent a recruiter who owns the job and would surface a
// fabricated pipeline event in that recruiter's activity feed. So this handler
// writes the status only and leaves recruiter activity untouched. A future
// admin audit log should be a separate model, not this one.
// ---------------------------------------------------------------------------
const updateAdminApplicationStatus = async (req, res, next) => {
  try {
    const existing = await Application.findById(req.params.id).lean();
    if (!existing) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // statusUpdateValidators has already restricted `status` to the canonical
    // APPLICATION_STATUSES, so this write can only ever store an existing
    // pipeline value.
    const updated = await Application.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true, context: 'query' }
    ).lean();

    // Return the same normalized row shape the listing produced, so a client
    // can replace the row it is editing without reshaping it.
    const [item] = await hydrateAdminApplications([updated]);

    return res.status(200).json({ application: item });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid application id' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// Helpers for the applications workspace.
// ---------------------------------------------------------------------------

// Build the Mongo filter for the optional workspace filters. Every key is
// absent unless the client actually sent it, which is what keeps the
// no-filter Overview call identical to the original `Application.find({})`.
const buildApplicationFilter = async (query) => {
  const filter = {};
  const { q, status, job, recruiter, dateRange } = query;

  if (status && status !== 'all') {
    filter.status = status;
  }

  if (job) {
    filter.jobId = job;
  }

  // A recruiter filter resolves to the jobs that recruiter posted. An empty
  // `$in` matches nothing, which is the correct answer for a recruiter with
  // no jobs rather than an error.
  if (recruiter) {
    const posted = await Job.find({ postedBy: recruiter }, '_id').lean();
    filter.jobId = { $in: posted.map((j) => j._id) };
  }

  if (dateRange) {
    const start = new Date();
    if (dateRange === 'today') {
      start.setHours(0, 0, 0, 0);
    } else {
      const days = Math.min(Math.max(parseInt(dateRange, 10) || 7, 1), 365);
      start.setDate(start.getDate() - days);
    }
    filter.createdAt = { $gte: start };
  }

  if (q && q.trim()) {
    const regex = new RegExp(escapeRegex(q.trim()), 'i');
    const { userIds, jobIds } = await resolveApplicationSearch(q, regex);

    // The applicant name and email are denormalized onto the application, so
    // those two match the document directly. Profile name, account email, job
    // title/company, and recruiter name all live in other collections and come
    // back as resolved id sets — each branch is omitted when it resolved to
    // nothing, so a search never matches the whole collection by accident.
    const conditions = [{ fullName: regex }, { email: regex }];
    if (userIds.length) conditions.push({ userId: { $in: userIds } });
    if (jobIds.length) conditions.push({ jobId: { $in: jobIds } });

    filter.$or = conditions;
  }

  return filter;
};

// Resolve a search term to the job ids and user ids an application could match.
// Run as parallel lookups so a single search costs one round of queries.
const resolveApplicationSearch = async (q, regex) => {
  const [jobseekerProfiles, accountUsers, matchingJobs, recruiterProfiles] =
    await Promise.all([
      Profile.find({ role: 'jobseeker', fullName: regex }, 'userId').lean(),
      User.find({ email: regex }, '_id').lean(),
      Job.find({ $or: [{ title: regex }, { company: regex }] }, '_id').lean(),
      Profile.find({ role: 'recruiter', fullName: regex }, 'userId').lean(),
    ]);

  const userIds = new Set();
  for (const profile of jobseekerProfiles) userIds.add(profile.userId.toString());
  for (const user of accountUsers) userIds.add(user._id.toString());

  const jobIds = new Set(matchingJobs.map((job) => job._id.toString()));

  // A recruiter-name hit matches every application on the jobs they posted.
  const recruiterIds = recruiterProfiles.map((profile) => profile.userId);
  if (recruiterIds.length) {
    const posted = await Job.find({ postedBy: { $in: recruiterIds } }, '_id').lean();
    for (const job of posted) jobIds.add(job._id.toString());
  }

  return { userIds: [...userIds], jobIds: [...jobIds] };
};

// Resolve the job, applicant profile, account email, and posting recruiter for
// a page of applications in a fixed number of queries, then map each row
// through serializeAdminApplication.
const hydrateAdminApplications = async (applications) => {
  if (!applications.length) return [];

  const jobIds = [...new Set(applications.map((app) => String(app.jobId)))];
  const userIds = [...new Set(applications.map((app) => String(app.userId)))];

  const [jobs, profiles, accounts] = await Promise.all([
    Job.find({ _id: { $in: jobIds } })
      .select('title company location workType employmentType category postedBy')
      .lean(),
    Profile.find({ userId: { $in: userIds } })
      .select('userId fullName headline avatarUrl location phone resumeUrl skills')
      .lean(),
    User.find({ _id: { $in: userIds } }).select('email').lean(),
  ]);

  // Reuses the jobs-workspace recruiter resolver so both workspaces report a
  // recruiter in exactly the same shape.
  const recruiterMap = await recruiterInfoFor(jobs);

  return applications.map((app) =>
    serializeAdminApplication(app, {
      jobById: new Map(jobs.map((job) => [job._id.toString(), job])),
      profileByUserId: new Map(profiles.map((p) => [p.userId.toString(), p])),
      emailByUserId: new Map(accounts.map((u) => [u._id.toString(), u.email])),
      recruiterMap,
    })
  );
};

// Normalize one application row for the Admin Applications workspace.
//
// The first block is the original Overview contract, preserved field-for-field
// including fallback precedence. The blocks below it are additive.
const serializeAdminApplication = (
  app,
  { jobById, profileByUserId, emailByUserId, recruiterMap }
) => {
  const job = jobById.get(String(app.jobId));
  const profile = profileByUserId.get(String(app.userId));
  const accountEmail = emailByUserId.get(String(app.userId)) || '';
  const postedBy = job && job.postedBy ? job.postedBy.toString() : '';

  return {
    // --- Existing Overview contract (unchanged names and fallbacks) ---
    id: app._id,
    applicant: app.fullName || accountEmail || 'Anonymous',
    jobTitle: (job && job.title) || 'Untitled job',
    company: (job && job.company) || 'Unknown company',
    status: app.status,
    appliedAt: app.createdAt,

    // --- Workspace additions ---
    userId: app.userId,
    email: app.email || accountEmail || '',
    phone: app.phone || (profile && profile.phone) || '',
    location: (profile && profile.location) || '',
    avatarUrl: (profile && profile.avatarUrl) || '',
    resumeUrl: app.resumeUrl || (profile && profile.resumeUrl) || '',
    linkedin: app.linkedin || '',
    portfolio: app.portfolio || '',
    skills: (profile && profile.skills) || [],
    updatedAt: app.updatedAt,
    // The recruiter who posted the job this application targets, or null when
    // the job has no owner. Never invented.
    recruiter: postedBy ? recruiterMap.get(postedBy) || null : null,
    job: job
      ? {
          id: job._id,
          title: job.title,
          company: job.company,
          location: job.location,
          workType: job.workType,
          employmentType: job.employmentType,
          category: job.category,
          postedBy,
        }
      : null,
  };
};

// ---------------------------------------------------------------------------
// GET /api/admin/activity?limit=8 — a recent-activity feed derived purely from
// existing data (application creation + job creation/update timestamps). No
// dedicated audit-log/activity model exists, so the feed is computed on demand
// from data we already store.
// ---------------------------------------------------------------------------
const getRecentActivity = async (req, res, next) => {
  try {
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 8, 1),
      20
    );

    const [recentApplications, recentJobs] = await Promise.all([
      Application.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('jobId', 'title company')
        .populate('userId', 'email'),
      // Jobs order only guards which subset we examine; the final sort below
      // is the source of truth for the feed order.
      Job.find({}).sort({ updatedAt: -1 }).limit(limit),
    ]);

    const items = [];

    for (const app of recentApplications) {
      items.push({
        type: 'application-created',
        label: 'New application received',
        entity:
          app.fullName || app.userId?.email || app.jobId?.title || 'Jobseeker',
        detail: `Applied to ${app.jobId?.title || 'a job'} at ${
          app.jobId?.company || 'a company'
        }`,
        at: app.createdAt,
      });
    }

    for (const job of recentJobs) {
      const updatedAt = job.updatedAt || job.createdAt;
      const isUpdate =
        job.updatedAt && job.createdAt
          ? job.updatedAt.getTime() !== job.createdAt.getTime()
          : false;
      items.push({
        type: isUpdate ? 'job-updated' : 'job-created',
        label: isUpdate ? 'Job listing updated' : 'New job posted',
        entity: job.title,
        detail: `${job.company} • ${job.location}`,
        at: updatedAt,
      });
    }

    items.sort((a, b) => new Date(b.at) - new Date(a.at));

    return res.status(200).json({
      items: items.slice(0, limit).map((item) => ({
        ...item,
        at: item.at ? new Date(item.at).toISOString() : item.at,
      })),
    });
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/jobs?page=1&limit=10&q=&status=&employmentType=&postedDays=
// List of every job on the platform with the derived display fields the Admin
// Jobs table needs: application count and the posting recruiter (avatar, name,
// role, email). Supports pagination, one search box spanning title/company/
// recruiter name, and combined filters (status, employment type, posted date).
// ---------------------------------------------------------------------------
const listAdminJobs = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;

    const { q, status, employmentType, postedDays } = req.query;
    const filter = {};

    // Status: 'active' also matches legacy documents whose status was never
    // written, since those are exactly the jobs currently live on the platform.
    if (status && status !== 'all') {
      if (status === 'active') {
        filter.$or = [{ status: 'active' }, { status: { $exists: false } }];
      } else {
        filter.status = status;
      }
    }

    // Search spans job title, company, and recruiter name. Recruiter matches
    // are resolved by joining recruiter profiles up front.
    if (q && q.trim()) {
      const regex = new RegExp(escapeRegex(q.trim()), 'i');
      const conditions = [{ title: regex }, { company: regex }];
      const recruiterProfiles = await Profile.find(
        { role: 'recruiter', fullName: regex },
        { userId: 1 }
      ).lean();
      const recruiterIds = recruiterProfiles.map((p) => p.userId);
      if (recruiterIds.length) {
        conditions.push({ postedBy: { $in: recruiterIds } });
      }
      if (filter.$or) {
        // Status already contributed a top-level $or; combine both.
        filter.$and = [{ $or: filter.$or }, { $or: conditions }];
        delete filter.$or;
      } else {
        filter.$or = conditions;
      }
    }

    if (employmentType && employmentType !== 'all') {
      filter.employmentType = employmentType;
    }

    if (postedDays) {
      const days = Math.min(Math.max(parseInt(postedDays, 10) || 7, 1), 90);
      const start = new Date();
      if (days === 1) {
        // "Today" means from the start of the current calendar day.
        start.setHours(0, 0, 0, 0);
      } else {
        start.setDate(start.getDate() - days);
      }
      filter.createdAt = { $gte: start };
    }

    const [jobs, total] = await Promise.all([
      Job.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Job.countDocuments(filter),
    ]);

    const [counts, recruiterMap] = await Promise.all([
      applicationCountsByJob(jobs),
      recruiterInfoFor(jobs),
    ]);

    return res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      jobs: jobs.map((job) => serializeAdminJob(job, counts, recruiterMap)),
    });
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/admin/jobs/:id — full admin view of a single job, enriched with the
// application count and posting recruiter for the detail panel.
// ---------------------------------------------------------------------------
const getAdminJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id).lean();
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const [counts, recruiterMap] = await Promise.all([
      applicationCountsByJob([job]),
      recruiterInfoFor([job]),
    ]);

    return res.status(200).json({
      job: serializeAdminJob(job, counts, recruiterMap),
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid job id' });
    }
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/admin/jobs/:id/status — non-destructive moderation. Approving a
// pending job is `status: active`; closing sets closedAt, reopening clears it.
// ---------------------------------------------------------------------------
const updateAdminJobStatus = async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!MODERATION_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid job status' });
    }

    const patch = { status };
    if (status === 'closed') {
      patch.closedAt = new Date();
    } else {
      patch.closedAt = null;
    }

    const job = await Job.findByIdAndUpdate(req.params.id, patch, {
      new: true,
      runValidators: true,
    });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const [counts, recruiterMap] = await Promise.all([
      applicationCountsByJob([job]),
      recruiterInfoFor([job]),
    ]);

    return res.status(200).json({
      job: serializeAdminJob(job, counts, recruiterMap),
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid job id' });
    }
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// Helpers shared by the job moderation endpoints.
// ---------------------------------------------------------------------------
const applicationCountsByJob = async (jobs) => {
  const ids = jobs.map((job) => job._id);
  if (!ids.length) return new Map();
  const rows = await Application.aggregate([
    { $match: { jobId: { $in: ids } } },
    { $group: { _id: '$jobId', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [row._id.toString(), row.count]));
};

// Resolve the posting recruiter (Profile + User email) for a page of jobs.
// Jobs without an owner yield no entry, so callers fall back to a null
// recruiter rather than inventing a poster.
const recruiterInfoFor = async (jobs) => {
  const ids = [...new Set(jobs.map((job) => job.postedBy?.toString()).filter(Boolean))];
  if (!ids.length) return new Map();

  const [profiles, users] = await Promise.all([
    Profile.find({ role: 'recruiter', userId: { $in: ids } }).lean(),
    User.find({ _id: { $in: ids } }, { email: 1 }).lean(),
  ]);

  const emails = new Map(users.map((u) => [u._id.toString(), u.email]));
  const map = new Map();
  for (const profile of profiles) {
    const key = profile.userId.toString();
    map.set(key, {
      id: key,
      name: profile.fullName,
      jobTitle: profile.jobTitle || '',
      avatarUrl: profile.avatarUrl || '',
      email: emails.get(key) || '',
    });
  }
  return map;
};

// Normalize a raw job doc into the admin jobs workspace shape. A legacy job
// with no status field is reported as 'active' (it is live on the platform).
const serializeAdminJob = (job, counts, recruiterMap) => {
  const postedBy = job.postedBy ? job.postedBy.toString() : '';
  const recruiter = postedBy ? recruiterMap.get(postedBy) || null : null;
  return {
    id: job._id,
    title: job.title,
    company: job.company,
    location: job.location,
    workType: job.workType,
    employmentType: job.employmentType,
    status: job.status || 'active',
    closedAt: job.closedAt || null,
    salary: job.salary || {},
    experienceLevel: job.experienceLevel,
    skills: job.skills || [],
    description: job.description || '',
    category: job.category,
    accent: job.accent || '',
    postedAt: job.createdAt,
    applications: counts.get(job._id.toString()) || 0,
    postedBy,
    recruiter,
  };
};

module.exports = {
  getStats,
  getApplicationsTrend,
  getAdminJobseeker,
  listAdminJobseekers,
  listAdminRecruiters,
  listAdminCompanies,
  getAnalytics,
  listAdminApplications,
  getAdminApplication,
  updateAdminApplicationStatus,
  getRecentActivity,
  listAdminJobs,
  getAdminJob,
  updateAdminJobStatus,
};
