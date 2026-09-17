const express = require('express');
const { authenticate } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const {
  requestEmailChange,
  requestEmailChangeValidators,
  verifyEmailChange,
  verifyEmailChangeValidators,
  resendVerification,
  cancelEmailChange,
  getPendingEmailChange,
} = require('../controllers/emailChange.controller');

const router = express.Router();

// All email-change endpoints require a signed-in user whose identity is
// derived exclusively from the JWT via the authenticate middleware.
router.use(authenticate);

// Authenticated, per-user limiters. authenticate runs above, so req.user.id is
// the trusted identity — never a client-supplied header.
const initiateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => String(req.user.id),
});
const verifyLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => String(req.user.id),
});
const resendLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => String(req.user.id),
});

router.get('/', getPendingEmailChange);
router.post('/', initiateLimiter, requestEmailChangeValidators, requestEmailChange);
router.post('/verify-email', verifyLimiter, verifyEmailChangeValidators, verifyEmailChange);
router.post('/resend', resendLimiter, resendVerification);
router.delete('/', cancelEmailChange);

module.exports = router;