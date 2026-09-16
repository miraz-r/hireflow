const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  requestEmailChange,
  requestEmailChangeValidators,
  verifyEmailChange,
  verifyEmailChangeValidators,
  resendVerification,
  cancelEmailChange,
} = require('../controllers/emailChange.controller');

const router = express.Router();

// All email-change endpoints require a signed-in user whose identity is
// derived exclusively from the JWT via the authenticate middleware.
router.use(authenticate);

router.post('/', requestEmailChangeValidators, requestEmailChange);
router.post('/verify-email', verifyEmailChangeValidators, verifyEmailChange);
router.post('/resend', resendVerification);
router.delete('/', cancelEmailChange);

module.exports = router;