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
  body('role')
    .isIn(['jobseeker', 'recruiter'])
    .withMessage('Role must be jobseeker or recruiter'),
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

  const { email, password, role, fullName, phone } = req.body;

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

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { register, registerValidators, login, loginValidators };