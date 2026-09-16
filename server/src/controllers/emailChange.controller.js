const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const EmailChange = require('../models/EmailChange');
const emailService = require('../services/email.service');

const TOKEN_BYTES = 32;
const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000;

const generateToken = () => crypto.randomBytes(TOKEN_BYTES).toString('hex');

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const requestEmailChangeValidators = [
  body('newEmail').isEmail().withMessage('Invalid email').normalizeEmail(),
];

const verifyEmailChangeValidators = [
  body('token')
    .isString()
    .withMessage('Verification token is required')
    .trim()
    .notEmpty()
    .withMessage('Verification token is required'),
];

/**
 * POST /api/email-change
 * Starts a pending email change. The current email is untouched until the
 * new email is verified. Identity always comes from `req.user.id` (auth
 * middleware) — never from the request body.
 */
const requestEmailChange = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const newEmail = req.body.newEmail;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (newEmail === user.email) {
      return res
        .status(400)
        .json({ error: 'New email must be different from your current email' });
    }

    const taken = await User.exists({
      email: newEmail,
      _id: { $ne: user._id },
    });
    if (taken) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + EMAIL_CHANGE_TTL_MS);

    // Invalidate any previous pending request before storing a new one.
    await EmailChange.deleteMany({ userId: user._id });

    await EmailChange.create({
      userId: user._id,
      newEmail,
      tokenHash: hashToken(token),
      expiresAt,
    });

    try {
      await emailService.sendEmailChangeVerification({ to: newEmail, token });
    } catch (err) {
      await EmailChange.deleteMany({ userId: user._id }).catch(() => {});
      return next(err);
    }

    return res.status(201).json({
      message: 'Verification email sent',
      newEmail,
      expiresAt,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/email-change/verify-email
 * Validates the single-use token and, only when every check passes, replaces
 * the user's current email with the verified pending email.
 */
const verifyEmailChange = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const tokenHash = hashToken(req.body.token);
  const now = new Date();

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Claim the token atomically: expired, unknown or already-consumed tokens
    // (including ones invalidated by a resend) fail to match these conditions.
    const request = await EmailChange.findOneAndUpdate(
      {
        userId: user._id,
        tokenHash,
        consumedAt: null,
        expiresAt: { $gt: now },
      },
      { $set: { consumedAt: now } },
      { new: true }
    );

    if (!request) {
      return res
        .status(400)
        .json({ error: 'Invalid or expired verification token' });
    }

    const taken = await User.exists({
      email: request.newEmail,
      _id: { $ne: user._id },
    });
    if (taken) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const oldEmail = user.email;
    user.email = request.newEmail;

    try {
      await user.save();
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      return next(err);
    }

    // Token is single-use: remove the pending request so it cannot be reused.
    await request.deleteOne().catch(() => {});

    try {
      await emailService.sendEmailChangedNotification({
        to: oldEmail,
        newEmail: request.newEmail,
      });
    } catch {
      // The change is complete; a failed notification must not revert it.
    }

    return res.status(200).json({
      message: 'Email address updated',
      email: user.email,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/email-change/resend
 * Reissues a fresh single-use token for the user's pending change. The old
 * token hash is overwritten, invalidating the previous token.
 */
const resendVerification = async (req, res, next) => {
  try {
    const request = await EmailChange.findOne({
      userId: req.user.id,
      consumedAt: null,
    });

    if (!request) {
      return res
        .status(404)
        .json({ error: 'No pending email change request' });
    }

    const token = generateToken();
    request.tokenHash = hashToken(token);
    request.consumedAt = null;
    request.expiresAt = new Date(Date.now() + EMAIL_CHANGE_TTL_MS);
    await request.save();

    try {
      await emailService.sendEmailChangeVerification({
        to: request.newEmail,
        token,
      });
    } catch (err) {
      return next(err);
    }

    return res.status(200).json({
      message: 'Verification email resent',
      expiresAt: request.expiresAt,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/email-change
 * Cancels the user's pending email change. The current email is untouched.
 */
const cancelEmailChange = async (req, res, next) => {
  try {
    const result = await EmailChange.deleteOne({
      userId: req.user.id,
      consumedAt: null,
    });

    if (result.deletedCount === 0) {
      return res
        .status(404)
        .json({ error: 'No pending email change request' });
    }

    return res
      .status(200)
      .json({ message: 'Email change request cancelled' });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  requestEmailChange,
  requestEmailChangeValidators,
  verifyEmailChange,
  verifyEmailChangeValidators,
  resendVerification,
  cancelEmailChange,
};