const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const {
  getStats,
  getApplicationsTrend,
  getRecentApplications,
  getRecentActivity,
  listAdminJobs,
  getAdminJob,
  updateAdminJobStatus,
} = require('../controllers/admin.controller');

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
router.get(
  '/applications',
  authenticate,
  authorize('admin'),
  getRecentApplications
);
router.get(
  '/activity',
  authenticate,
  authorize('admin'),
  getRecentActivity
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
