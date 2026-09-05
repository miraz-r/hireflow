const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const {
  createApplication,
  getMyApplication,
  listMyApplications,
  listJobseekerApplications,
} = require('../controllers/application.controller');
const {
  createValidators,
  jobIdParamValidators,
} = require('../validators/application.validators');

const router = express.Router();

// Every application route requires an authenticated user (identity derived
// server-side). Role checks are applied per-route below.
router.use(authenticate);

// Recruiter-only: applications for the recruiter's own jobs.
// Defined before the :jobId routes to keep the URL shape unambiguous.
router.get('/mine', authorize('recruiter'), listMyApplications);

// Jobseeker-only: list the current user's own applications
router.get('/my-applications', authorize('jobseeker'), listJobseekerApplications);

// Jobseeker-only: apply to a job
router.post('/', authorize('jobseeker'), createValidators, createApplication);

// Jobseeker-only: check whether the current user applied to a job
router.get('/:jobId/me', authorize('jobseeker'), jobIdParamValidators, getMyApplication);

module.exports = router;
