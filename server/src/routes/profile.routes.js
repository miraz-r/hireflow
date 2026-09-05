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
  uploadAvatar,
  uploadResume,
  deleteMyProfile,
} = require('../controllers/profile.controller');
const { avatarUpload, resumeUpload } = require('../config/uploads');

const router = express.Router();

// Translate multer errors (size limits, unexpected field) into a 400 status.
const hookMulterError =
  (mw) =>
  (req, res, next) =>
    mw(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        err.status = 400;
        err.message = 'File is too large';
      } else if (!err.status) {
        err.status = 400;
      }
      return next(err);
    });

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

// ---------------------------------------------------------------------------
// Uploads (multipart) — do not run the JSON body validators.
// ---------------------------------------------------------------------------
router.post('/upload/avatar', hookMulterError(avatarUpload), uploadAvatar);
router.post('/upload/resume', hookMulterError(resumeUpload), uploadResume);

// ---------------------------------------------------------------------------
// DELETE /api/profile — account deletion
// ---------------------------------------------------------------------------
router.delete('/', deleteMyProfile);

module.exports = router;
