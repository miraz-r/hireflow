const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const {
  createApplication,
  getMyApplication,
  listMyApplications,
  listJobseekerApplications,
  updateApplicationStatus,
  getApplicationDetail,
  getRecruiterActivity,
  getApplicationResume,
} = require('../controllers/application.controller');
const {
  createValidators,
  jobIdParamValidators,
  applicationIdValidators,
  statusUpdateValidators,
} = require('../validators/application.validators');

const router = express.Router();

// Every application route requires an authenticated user (identity derived
// server-side). Role checks are applied per-route below.
router.use(authenticate);

// Recruiter-only: applications for the recruiter's own jobs.
// Defined before the :jobId routes to keep the URL shape unambiguous.
router.get('/mine', authorize('recruiter'), listMyApplications);

// Recruiter-only: recent activity feed for the recruiter's own pipeline.
// Defined before :id routes so the literal path is never shadowed.
router.get('/activity', authorize('recruiter'), getRecruiterActivity);

// Recruiter-only: update an application's status. Ownership is enforced in the
// controller against the application's own job.
router.patch('/:id/status', authorize('recruiter'), statusUpdateValidators, updateApplicationStatus);

// The current user's OWN applications. Available in any workspace: the records
// belong to the account (matched on req.user.id inside the controller), not to
// the active workspace, so switching workspace must not hide a user's own
// history. This is a read of the caller's own data, not a privilege change —
// the caller can never see another account's applications here.
router.get('/my-applications', listJobseekerApplications);

// Recruiter-only: single application detail (ownership enforced in the
// controller against the application's own job). Defined after the literal
// /mine and /my-applications paths so it never shadows them.
router.get('/:id', authorize('recruiter'), applicationIdValidators, getApplicationDetail);

// Protected resume delivery for an application. Application-scoped: the
// applicant, the job's owner recruiter, or an admin.
router.get(
  '/:id/resume',
  authorize('jobseeker', 'recruiter', 'admin'),
  applicationIdValidators,
  getApplicationResume
);

// Jobseeker-workspace action: applying to a job.
router.post('/', authorize('jobseeker'), createValidators, createApplication);

// Own-data read: "did I apply to this job". Available in any workspace for the
// same reason as /my-applications.
router.get('/:jobId/me', jobIdParamValidators, getMyApplication);

module.exports = router;
