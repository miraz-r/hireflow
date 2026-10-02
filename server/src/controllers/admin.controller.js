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

// ---------------------------------------------------------------------------
// GET /api/admin/jobseekers/:userId
//
// The APPLICANT behind an application, for the Admin Applications "View
// Profile" action. This exists because there is no other way to read someone
// else's profile: GET /api/profile is scoped to the authenticated caller.
//
// WHY THE GUARD IS "HAS APPLICATIONS", NOT "ACTIVE WORKSPACE IS jobseeker"
// An account keeps one Profile per workspace and its User.role is only the
// *active* workspace. Someone who registered as a jobseeker, applied to jobs,
// and later opened the recruiter workspace is a perfectly normal applicant
// whose active workspace is now 'recruiter'. Guarding on the active workspace
// made "View Profile" fail for exactly those applicants.
//
// This endpoint is only ever reached from an application row, so the real
// question is "is this account an applicant?". An account with no applications
// is not an applicant and is a 404, which keeps the route from being used to
// read a recruiter or admin account that has never applied.
//
// WHAT IS AND IS NOT EXPOSED
//   - The JOBSEEKER profile is the subject, and it is read by
//     `{ userId, role: 'jobseeker' }` — i.e. the applicant's own historical
//     profile, independent of whichever workspace is currently active.
//   - Recruiter-only fields (jobTitle, companyName, companyWebsite,
//     companyDescription) are never returned, so an account that also has a
//     recruiter workspace is never presented as a jobseeker on those details.
//   - If the account has no jobseeker profile at all, nothing is invented:
//     profileExists is false and the applicant fields come back empty.
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

    // Not an applicant. Same 404 as an unknown id so the route cannot be used
    // to read a recruiter or admin account that has never applied.
    if (applicationCount === 0) {
      return res.status(404).json({ error: 'Jobseeker not found' });
    }

    const hasJobseekerProfile = !!jobseekerProfile;
    // Shared identity (name/phone/location/avatar) belongs to the person, so it
    // can come from whichever profile exists. These are the same fields
    // GET /api/applications/:id already returns for this application.
    const identity = jobseekerProfile || recruiterProfile;
    const available = [
      hasJobseekerProfile ? 'jobseeker' : null,
      recruiterProfile ? 'recruiter' : null,
    ].filter(Boolean);

    return res.status(200).json({
      jobseeker: {
        id: user._id,
        email: user.email,
        joinedAt: user.createdAt,
        // Where the account is working right now (navigation/permissions).
        activeWorkspace: user.role,
        availableWorkspaces: available,
        isActiveJobseeker: user.role === 'jobseeker',
        // Whether the account holds a jobseeker profile at all.
        profileExists: hasJobseekerProfile,
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
  listAdminApplications,
  getAdminApplication,
  updateAdminApplicationStatus,
  getRecentActivity,
  listAdminJobs,
  getAdminJob,
  updateAdminJobStatus,
};
