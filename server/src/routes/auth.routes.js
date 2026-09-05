const express = require('express');
const { register, registerValidators, login, loginValidators, toggleRole, roleValidators } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const User = require('../models/User');
const Profile = require('../models/Profile');

const router = express.Router();

router.post('/register', registerValidators, register);
router.post('/login', loginValidators, login);

router.post('/role', authenticate, roleValidators, toggleRole);

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const profile = await Profile.findOne({ userId: user.id }).select('fullName avatarUrl').lean();
    return res.status(200).json({
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: profile && profile.fullName ? profile.fullName : null,
      avatarUrl: profile && profile.avatarUrl ? profile.avatarUrl : null,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;