const express = require('express');
const { register, registerValidators, login, loginValidators, switchWorkspace, roleValidators, availableWorkspaces } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const User = require('../models/User');
const Profile = require('../models/Profile');

const router = express.Router();

// Brute-force / credential-stuffing protection. Keyed by client IP: these are
// unauthenticated endpoints, so no trusted user identity exists yet. Placed
// before the validators so every attempt counts, not just well-formed ones.
const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });
const registerLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });

router.post('/register', registerLimiter, registerValidators, register);
router.post('/login', loginLimiter, loginValidators, login);

// Switches the account's active workspace. Non-destructive: the workspace being
// left keeps its own profile.
router.post('/role', authenticate, roleValidators, switchWorkspace);

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    // Scoped to the active workspace so the greeting matches the workspace the
    // user is currently in, and includes every workspace the account holds.
    const [profile, workspaces] = await Promise.all([
      Profile.findOne({ userId: user.id, role: user.role })
        .select('fullName avatarUrl')
        .lean(),
      availableWorkspaces(user.id),
    ]);
    return res.status(200).json({
      id: user.id,
      email: user.email,
      role: user.role,
      workspaces,
      fullName: profile && profile.fullName ? profile.fullName : null,
      avatarUrl: profile && profile.avatarUrl ? profile.avatarUrl : null,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;