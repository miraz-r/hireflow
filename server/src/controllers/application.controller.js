const Job = require('../models/Job');
const Profile = require('../models/Profile');
const Application = require('../models/Application');

// ---------------------------------------------------------------------------
// POST /api/applications  — jobseeker applies to a job
// The authenticated user id + role come from the auth middleware (req.user).
// Never trust client-supplied ownership/role fields.
// ---------------------------------------------------------------------------
const createApplication = async (req, res, next) => {
  try {
    const jobId = req.body.jobId;

    // The job must exist before we record an application to it.
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Friendly duplicate check (the unique index is the hard backstop).
    const existing = await Application.findOne({ jobId, userId: req.user.id });
    if (existing) {
      return res.status(409).json({
        error: 'You have already applied to this job',
        application: existing,
      });
    }

    const application = await Application.create({
      jobId,
      userId: req.user.id,
      coverLetter: req.body.coverLetter || '',
      phone: req.body.phone || '',
      resumeUrl: req.body.resumeUrl || '',
    });

    return res.status(201).json(application);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'You have already applied to this job' });
    }
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
// GET /api/applications/:jobId/me  — did the current jobseeker apply?
// Used by the frontend to restore the applied state after a refresh.
// ---------------------------------------------------------------------------
const getMyApplication = async (req, res, next) => {
  try {
    const application = await Application.findOne({
      jobId: req.params.jobId,
      userId: req.user.id,
    });

    if (!application) {
      return res.status(200).json({ applied: false });
    }

    return res.status(200).json({ applied: true, application });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid job id' });
    }
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/applications/mine  — recruiter sees applicants for their own jobs
// Recruiter identity is derived from req.user.id. Only jobs whose `postedBy`
// matches this recruiter are considered, so another recruiter's applications
// are never exposed. Returns a valid empty list when there are none.
// ---------------------------------------------------------------------------
const listMyApplications = async (req, res, next) => {
  try {
    // Jobs owned by this recruiter.
    const jobs = await Job.find({ postedBy: req.user.id }).select('_id');
    const jobIds = jobs.map((j) => j._id);

    if (jobIds.length === 0) {
      return res.status(200).json({ applications: [] });
    }

    const applications = await Application.find({ jobId: { $in: jobIds } })
      .sort({ createdAt: -1 })
      .populate('jobId', 'title company location workType');

    // Resolve each applicant's public-ish profile fields in one query. We only
    // expose what the recruiter list needs — no email, phone, or resume URL.
    const applicantIds = [...new Set(applications.map((a) => String(a.userId)))];
    const profiles = await Profile.find({ userId: { $in: applicantIds } }).select(
      'userId fullName headline avatarUrl'
    );
    const profileByUserId = new Map(profiles.map((p) => [String(p.userId), p]));

    const applicationsWithApplicant = applications.map((a) => {
      const profile = profileByUserId.get(String(a.userId));
      return {
        id: a.id,
        status: a.status,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        job: a.jobId,
        applicant: profile
          ? {
            id: profile.userId,
            fullName: profile.fullName,
            headline: profile.headline || '',
            avatarUrl: profile.avatarUrl || '',
          }
          : { id: a.userId, fullName: 'Applicant', headline: '', avatarUrl: '' },
      };
    });

    return res.status(200).json({ applications: applicationsWithApplicant });
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/applications/my-applications  — jobseeker sees their own applications
// Returns the jobseeker's applications with populated job data.
// ---------------------------------------------------------------------------
const listJobseekerApplications = async (req, res, next) => {
  try {
    const applications = await Application.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .populate('jobId', 'title company location workType employmentType experienceLevel category');

    const result = applications.map((a) => ({
      id: a.id,
      status: a.status,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      job: a.jobId
        ? {
            id: a.jobId._id,
            title: a.jobId.title,
            company: a.jobId.company,
            location: a.jobId.location,
            workType: a.jobId.workType,
            employmentType: a.jobId.employmentType,
            experienceLevel: a.jobId.experienceLevel,
            category: a.jobId.category,
          }
        : null,
    }));

    return res.status(200).json({ applications: result });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  createApplication,
  getMyApplication,
  listMyApplications,
  listJobseekerApplications,
};

