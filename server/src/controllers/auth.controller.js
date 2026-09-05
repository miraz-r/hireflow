const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Profile = require('../models/Profile');
const env = require('../config/env');

const registerValidators = [
  body('email')
    .isEmail()
    .withMessage('Invalid email')
    .normalizeEmail(),
  body('password')
    .isString()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Za-z]/)
    .withMessage('Password must contain at least one letter')
    .matches(/\d/)
    .withMessage('Password must contain at least one number'),
  body('fullName')
    .isString()
    .withMessage('Full name is required')
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('Full name must be 1-120 characters'),
  body('phone')
    .isString()
    .withMessage('Phone is required')
    .trim()
    .matches(/^[+0-9()\-\s]{6,32}$/)
    .withMessage('Invalid phone format'),
];

const register = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  // Everyone starts as a jobseeker. Users switch to recruiter from the UI
  // after signing up (see toggleRole).
  const { email, password, fullName, phone } = req.body;
  const role = 'jobseeker';

  try {
    const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
    const user = await User.create({ email, passwordHash, role });

    try {
      await Profile.create({
        userId: user._id,
        role: user.role,
        fullName,
        phone,
      });
    } catch (profileErr) {
      // Roll back the User so registration does not leave an orphan.
      await User.findByIdAndDelete(user._id).catch(() => {});
      if (profileErr.code === 11000) {
        return res.status(409).json({ error: 'Profile already exists for this user' });
      }
      return next(profileErr);
    }

    return res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    return next(err);
  }
};

const loginValidators = [
  body('email').isEmail().withMessage('Invalid email').normalizeEmail(),
  body('password').isString().withMessage('Password is required'),
];

const login = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    // Surface the user's name in the auth response so the UI can greet them
    // without a separate profile fetch. The Profile holds fullName (1:1).
    const profile = await Profile.findOne({ userId: user.id }).select('fullName avatarUrl').lean();
    const fullName = profile && profile.fullName ? profile.fullName : null;
    const avatarUrl = profile && profile.avatarUrl ? profile.avatarUrl : null;

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName,
        avatarUrl,
      },
    });
  } catch (err) {
    return next(err);
  }
};

const roleValidators = [
  body('role')
    .isIn(['jobseeker', 'recruiter'])
    .withMessage('Role must be jobseeker or recruiter'),
];

// Fields that are only valid for one role. On toggle we clear the fields
// belonging to the *previous* role so the profile stays valid for the new one.
const RECRUITER_ONLY_FIELDS = [
  'jobTitle',
  'companyName',
  'companyWebsite',
  'companyDescription',
];
const JOBSEEKER_ONLY_FIELDS = [
  'headline',
  'bio',
  'skills',
  'education',
  'experience',
  'links',
];

/**
 * POST /api/auth/role — switch the signed-in user between jobseeker and
 * recruiter. Updates the User and mirrors it onto the Profile (clearing the
 * previous role's fields so the profile passes schema validation), then
 * re-issues a JWT that reflects the new role.
 */
const toggleRole = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const newRole = req.body.role;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (newRole !== user.role) {
      user.role = newRole;
      await user.save();

      await Profile.updateOne(
        { userId: user._id },
        {
          $set: { role: newRole },
          $unset: Object.fromEntries(
            (newRole === 'jobseeker'
              ? RECRUITER_ONLY_FIELDS
              : JOBSEEKER_ONLY_FIELDS
            ).map((f) => [f, 1])
          ),
        }
      ).catch((err) => next(err));
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    const profile = await Profile.findOne({ userId: user.id }).select('fullName avatarUrl').lean();
    const fullName = profile && profile.fullName ? profile.fullName : null;
    const avatarUrl = profile && profile.avatarUrl ? profile.avatarUrl : null;

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName,
        avatarUrl,
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  register,
  registerValidators,
  login,
  loginValidators,
  toggleRole,
  roleValidators,
};