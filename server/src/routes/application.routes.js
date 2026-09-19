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

// Jobseeker-only: list the current user's own applications
router.get('/my-applications', authorize('jobseeker'), listJobseekerApplications);

// Recruiter-only: single application detail (ownership enforced in the
// controller against the application's own job). Defined after the literal
// /mine and /my-applications paths so it never shadows them.
router.get('/:id', authorize('recruiter'), applicationIdValidators, getApplicationDetail);

// Jobseeker-only: apply to a job
router.post('/', authorize('jobseeker'), createValidators, createApplication);

// Jobseeker-only: check whether the current user applied to a job
router.get('/:jobId/me', authorize('jobseeker'), jobIdParamValidators, getMyApplication);

module.exports = router;
