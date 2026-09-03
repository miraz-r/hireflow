const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  buildChain,
  runValidation,
} = require('../validators/profile.validators');
const {
  getMyProfile,
  createMyProfile,
  updateMyProfile,
  patchMyProfile,
} = require('../controllers/profile.controller');

const router = express.Router();

// All profile routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /api/profile
// ---------------------------------------------------------------------------
router.get('/', getMyProfile);

// ---------------------------------------------------------------------------
// POST /api/profile  — create profile (one-time per user)
// buildChain internally calls runValidation once validators have completed.
// ---------------------------------------------------------------------------
router.post('/', buildChain('createOrReplace'), createMyProfile);

// ---------------------------------------------------------------------------
// PUT /api/profile  — full replace
// ---------------------------------------------------------------------------
router.put('/', buildChain('createOrReplace'), updateMyProfile);

// ---------------------------------------------------------------------------
// PATCH /api/profile  — partial update
// ---------------------------------------------------------------------------
router.patch('/', buildChain('patch'), patchMyProfile);

module.exports = router;
