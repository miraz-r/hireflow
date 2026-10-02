const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const {
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
} = require('../controllers/admin.controller');
const {
  applicationIdValidators,
  statusUpdateValidators,
  adminApplicationQueryValidators,
  jobseekerIdParamValidators,
  adminJobseekerQueryValidators,
  adminRecruiterQueryValidators,
  adminCompanyQueryValidators,
  adminAnalyticsQueryValidators,
} = require('../validators/application.validators');

const router = express.Router();

// Admin-only. authentication guards identity; authorization restricts to the
// admin role. Every admin route is protected by both.
router.get('/', authenticate, authorize('admin'), getStats);
router.get(
  '/applications/trend',
  authenticate,
  authorize('admin'),
  getApplicationsTrend
);
// The Applications workspace listing. The filter validators are optional, so a
// bare request (what AdminOverview sends) still returns the same recent feed.
// Registered before the ':id' routes below.
router.get(
  '/applications',
  authenticate,
  authorize('admin'),
  adminApplicationQueryValidators,
  listAdminApplications
);
router.get(
  '/activity',
  authenticate,
  authorize('admin'),
  getRecentActivity
);
// Applications workspace detail + moderation. Declared after the literal
// '/applications' and '/applications/trend' paths so neither is shadowed by the
// ':id' pattern. Reuses the shared id/status validators.
router.get(
  '/applications/:id',
  authenticate,
  authorize('admin'),
  applicationIdValidators,
  getAdminApplication
);
router.patch(
  '/applications/:id/status',
  authenticate,
  authorize('admin'),
  statusUpdateValidators,
  updateAdminApplicationStatus
);
// Applicant profile viewer, reached from the Applications detail panel's
// "View Profile". Registered before '/jobs' so the literal 'jobseekers' path is
// unambiguous alongside the '/applications/:id' patterns above.
// The workspace list must be declared before '/jobseekers/:userId' so the
// literal path is never swallowed by the :userId segment.
router.get(
  '/jobseekers',
  authenticate,
  authorize('admin'),
  adminJobseekerQueryValidators,
  listAdminJobseekers
);
router.get(
  '/jobseekers/:userId',
  authenticate,
  authorize('admin'),
  jobseekerIdParamValidators,
  getAdminJobseeker
);
// Recruiters workspace: a paginated list of every account holding a recruiter
// profile. Admin-only. There is no per-recruiter detail route because the
// workspace panel renders entirely from the list row — see the controller for
// why a second definition of "is a recruiter" is deliberately avoided.
router.get(
  '/recruiters',
  authenticate,
  authorize('admin'),
  adminRecruiterQueryValidators,
  listAdminRecruiters
);
// Companies workspace: a paginated list of the companies named by real recruiter
// profiles. Admin-only. Company records are derived (there is no Company model),
// so there is likewise no per-company detail route - see the controller for the
// full derivation and job-attribution rules.
router.get(
  '/companies',
  authenticate,
  authorize('admin'),
  adminCompanyQueryValidators,
  listAdminCompanies
);
// Analytics reporting window. Admin-only. `range` picks the period and the
// response carries the immediately preceding period for the KPI comparisons -
// see the controller for the window and aggregation rules.
router.get(
  '/analytics',
  authenticate,
  authorize('admin'),
  adminAnalyticsQueryValidators,
  getAnalytics
);
// Jobs workspace: paginated list, single-job detail, and non-destructive
// moderation (activate/pending/draft/close). All admin-only.
router.get('/jobs', authenticate, authorize('admin'), listAdminJobs);
router.get('/jobs/:id', authenticate, authorize('admin'), getAdminJob);
router.patch(
  '/jobs/:id/status',
  authenticate,
  authorize('admin'),
  updateAdminJobStatus
);

module.exports = router;
