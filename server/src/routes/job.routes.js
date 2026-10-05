const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const {
  listJobs,
  listMyJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
} = require('../controllers/job.controller');
const {
  createValidators,
  updateValidators,
  listQueryValidators,
} = require('../validators/job.validators');

const router = express.Router();

// Public: list + single job
router.get('/', listQueryValidators, listJobs);

// Recruiter-only: the caller's own postings (all statuses, including jobs
// with zero applications). Defined before /:id so the literal path is never
// shadowed by the single-job route.
router.get('/mine', authenticate, authorize('recruiter'), listMyJobs);

router.get('/:id', getJob);

// Recruiter-only: create, update, delete
router.post('/', authenticate, authorize('recruiter'), createValidators, createJob);
router.put('/:id', authenticate, authorize('recruiter'), updateValidators, updateJob);
router.delete('/:id', authenticate, authorize('recruiter'), deleteJob);

module.exports = router;
