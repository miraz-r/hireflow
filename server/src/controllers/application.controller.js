const Job = require('../models/Job');
const Profile = require('../models/Profile');
const Application = require('../models/Application');
const User = require('../models/User');

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
      fullName: req.body.fullName || '',
      email: req.body.email || '',
      linkedin: req.body.linkedin || '',
      portfolio: req.body.portfolio || '',
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

// ---------------------------------------------------------------------------
// PATCH /api/applications/:id/status  — recruiter advances an application
// Only the recruiter who posted the application's job may update it. The job
// is resolved from the application's server-side jobId — never from the
// client. Sensitive applicant fields (phone, resume URL, cover letter) are not
// included in the response.
// ---------------------------------------------------------------------------
const updateApplicationStatus = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Ownership is derived from the application's own jobId, so a client can
    // never point us at a job the recruiter does not own.
    const job = await Job.findById(application.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (String(job.postedBy) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await Application.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true, context: 'query' }
    );

    return res.status(200).json({
      id: updated.id,
      jobId: updated.jobId,
      status: updated.status,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
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
// GET /api/applications/:id  — recruiter views a single application detail
// Recruiter-only. The application must belong to a job posted by this
// recruiter; ownership is resolved through the application's server-side
// jobId — never from anything the client sends. Returns the applicant's
// contact/personal data because this is an authorized recruiter detail view.
// ---------------------------------------------------------------------------
const getApplicationDetail = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Ownership is derived from the application's own jobId, so a recruiter
    // can never view a job — and therefore an applicant — they do not own.
    const job = await Job.findById(application.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (String(job.postedBy) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Only the applicant's email from User (passwordHash is excluded by the
    // model). Profile contributes name/headline/avatar + phone/resume as a
    // fallback when the application record has no value.
    const [user, profile] = await Promise.all([
      User.findById(application.userId).select('email').lean(),
      Profile.findOne({ userId: application.userId })
        .select('userId fullName headline avatarUrl phone resumeUrl')
        .lean(),
    ]);

    return res.status(200).json({
      id: application.id,
      status: application.status,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        workType: job.workType,
        employmentType: job.employmentType,
        experienceLevel: job.experienceLevel,
        category: job.category,
        salary: job.salary,
        skills: job.skills,
        description: job.description,
        accent: job.accent,
      },
      applicant: {
        id: application.userId,
        // Prefer the values the applicant submitted with this application;
        // fall back to profile/user data for pre-existing records.
        fullName: application.fullName || (profile ? profile.fullName : '') || 'Applicant',
        headline: profile ? profile.headline || '' : '',
        avatarUrl: profile ? profile.avatarUrl || '' : '',
        email: application.email || (user ? user.email : null) || null,
        // Prefer the phone the applicant submitted with this application;
        // fall back to the profile phone when it is missing.
        phone: application.phone || (profile ? profile.phone : '') || '',
        resumeUrl: application.resumeUrl || (profile ? profile.resumeUrl : '') || '',
        linkedin: application.linkedin || '',
        portfolio: application.portfolio || '',
      },
      coverLetter: application.coverLetter,
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid application id' });
    }
    return next(err);
  }
};

module.exports = {
  createApplication,
  getMyApplication,
  listMyApplications,
  listJobseekerApplications,
  updateApplicationStatus,
  getApplicationDetail,
};

