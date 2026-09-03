const Job = require('../models/Job');

// Fields we accept from the client. Anything else is silently dropped.
const PICK_FIELDS = [
  'title',
  'company',
  'location',
  'workType',
  'employmentType',
  'salary',
  'experienceLevel',
  'skills',
  'description',
  'category',
  'accent',
];

const pickFields = (body) => {
  const out = {};
  for (const field of PICK_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      out[field] = body[field];
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// GET /api/jobs  — public list with filters + pagination
// ---------------------------------------------------------------------------
const listJobs = async (req, res, next) => {
  try {
    const { q, category, location, workType, employmentType, experienceLevel, minSalary } = req.query;

    const filter = {};
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { title: regex },
        { company: regex },
        { skills: regex },
      ];
    }
    if (category) filter.category = category;
    if (location) filter.location = new RegExp(location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (workType) filter.workType = workType;
    if (employmentType) filter.employmentType = employmentType;
    if (experienceLevel) filter.experienceLevel = experienceLevel;
    if (minSalary) filter['salary.min'] = { $gte: Number(minSalary) };

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      Job.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Job.countDocuments(filter),
    ]);

    return res.status(200).json({
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/jobs/:id  — public single job
// ---------------------------------------------------------------------------
const getJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    return res.status(200).json(job);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid job id' });
    }
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/jobs  — recruiter creates a job
// ---------------------------------------------------------------------------
const createJob = async (req, res, next) => {
  try {
    const payload = pickFields(req.body);
    const job = await Job.create(payload);
    return res.status(201).json(job);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// PUT /api/jobs/:id  — recruiter replaces a job
// ---------------------------------------------------------------------------
const updateJob = async (req, res, next) => {
  try {
    const payload = pickFields(req.body);
    const job = await Job.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
      context: 'query',
    });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    return res.status(200).json(job);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid job id' });
    }
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/jobs/:id  — recruiter deletes a job
// ---------------------------------------------------------------------------
const deleteJob = async (req, res, next) => {
  try {
    const job = await Job.findByIdAndDelete(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    return res.status(204).end();
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid job id' });
    }
    return next(err);
  }
};

module.exports = {
  listJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
};
