const Job = require('../models/Job');
const Application = require('../models/Application');
const User = require('../models/User');
const Profile = require('../models/Profile');

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
// GET /api/admin/applications?page=1&limit=8 — most recent applications with
// the derived display fields the Overview's Recent Applications table needs
// (applicant, job, company, status, applied date).
// ---------------------------------------------------------------------------
const getRecentApplications = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 8, 1),
      25
    );
    const skip = (page - 1) * limit;

    const [applications, total] = await Promise.all([
      Application.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('jobId', 'title company')
        .populate('userId', 'email'),
      Application.countDocuments(),
    ]);

    const items = applications.map((app) => ({
      id: app._id,
      applicant: app.fullName || app.userId?.email || 'Anonymous',
      jobTitle: app.jobId?.title || 'Untitled job',
      company: app.jobId?.company || 'Unknown company',
      status: app.status,
      appliedAt: app.createdAt,
    }));

    return res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      applications: items,
    });
  } catch (err) {
    return next(err);
  }
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
  getRecentApplications,
  getRecentActivity,
  listAdminJobs,
  getAdminJob,
  updateAdminJobStatus,
};
