const SavedJob = require('../models/SavedJob');
const Job = require('../models/Job');

// ---------------------------------------------------------------------------
// GET /api/saved-jobs  — list the current jobseeker's saved jobs
// ---------------------------------------------------------------------------
const listSavedJobs = async (req, res, next) => {
  try {
    const saved = await SavedJob.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .populate('jobId', 'title company location workType employmentType experienceLevel salary category skills');

    const jobs = saved
      .map((s) => s.jobId)
      .filter(Boolean)
      .map((job) => ({
        id: job._id,
        title: job.title,
        company: job.company,
        location: job.location,
        workType: job.workType,
        employmentType: job.employmentType,
        experienceLevel: job.experienceLevel,
        salary: job.salary,
        category: job.category,
        skills: job.skills,
      }));

    return res.status(200).json({ savedJobs: jobs });
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/saved-jobs  — save a job
// ---------------------------------------------------------------------------
const saveJob = async (req, res, next) => {
  try {
    const { jobId } = req.body;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const existing = await SavedJob.findOne({ jobId, userId: req.user.id });
    if (existing) {
      return res.status(200).json({ saved: true, savedJob: existing });
    }

    const savedJob = await SavedJob.create({ jobId, userId: req.user.id });
    return res.status(201).json({ saved: true, savedJob });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(200).json({ saved: true });
    }
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid job id' });
    }
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/saved-jobs/:jobId  — unsave a job
// ---------------------------------------------------------------------------
const unsaveJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const deleted = await SavedJob.findOneAndDelete({
      jobId,
      userId: req.user.id,
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Saved job not found' });
    }

    return res.status(200).json({ saved: false });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid job id' });
    }
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/saved-jobs/check/:jobId  — check if the current user saved a job
// ---------------------------------------------------------------------------
const checkSaved = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const saved = await SavedJob.findOne({ jobId, userId: req.user.id });
    return res.status(200).json({ saved: !!saved });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid job id' });
    }
    return next(err);
  }
};

module.exports = {
  listSavedJobs,
  saveJob,
  unsaveJob,
  checkSaved,
};
