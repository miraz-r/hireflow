const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { parsePhoneNumber } = require('libphonenumber-js');
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
    .notEmpty()
    .withMessage('Phone is required')
    // The client submits a complete international number (e.g. +8801712345678).
    // This is the authoritative safety layer: keep any clearly-invalid phone
    // structure out of the database even when the client-side check is bypassed.
    .custom((value) => {
      try {
        const parsed = parsePhoneNumber(value);
        return Boolean(parsed && parsed.isValid());
      } catch {
        return false;
      }
    })
    .withMessage('Invalid phone number')
    .isLength({ max: 32 })
    .withMessage('Phone number must be at most 32 characters'),

  // The workspace the account starts in. Optional so existing clients that omit
  // it keep working; anything unrecognised falls back to 'jobseeker' in the
  // controller. This is the *active* workspace, not a permanent restriction —
  // the account can open the other workspace later without losing this one.
  body('role')
    .optional()
    .isString()
    .isIn(['jobseeker', 'recruiter'])
    .withMessage('Role must be jobseeker or recruiter'),
];

const register = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  // The account opens in the workspace the user chose at signup. This is the
  // active workspace, not a limit on the account: the other workspace can be
  // opened later via POST /api/auth/role, which no longer discards this one.
  const { email, password, fullName, phone } = req.body;
  const role = req.body.role === 'recruiter' ? 'recruiter' : 'jobseeker';

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
        workspaces: [user.role],
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

// ---------------------------------------------------------------------------
// Workspace helpers.
//
// An account's available workspaces are simply the workspaces it holds a
// profile for. Deriving this instead of storing a separate list means the value
// can never drift out of sync with the profiles that actually exist.
// ---------------------------------------------------------------------------
const availableWorkspaces = async (userId) => {
  const profiles = await Profile.find({ userId })
    .select('role')
    .lean();
  const roles = profiles.map((p) => p.role).filter((r) => r && r !== 'admin');
  return roles.length ? [...new Set(roles)] : ['jobseeker'];
};

// Make sure the account has a profile row for `workspace`, so switching never
// lands the user on a 404 profile.
//
// A brand-new workspace profile is seeded ONLY with the person's own shared
// identity details (name, phone, location, avatar) copied from their other
// profile. Nothing from the other workspace's data is copied or invented — the
// new profile starts with its workspace-specific fields empty, and the previous
// profile is left completely untouched.
const ensureWorkspaceProfile = async (userId, workspace) => {
  const existing = await Profile.findOne({ userId, role: workspace }).lean();
  if (existing) return existing;

  const source = await Profile.findOne({
    userId,
    role: workspace === 'jobseeker' ? 'recruiter' : 'jobseeker',
  }).lean();

  // fullName and phone are required by the schema. Without a source profile
  // there is nothing honest to seed from, so we leave the row absent rather
  // than write placeholder data.
  if (!source || !source.fullName || !source.phone) return null;

  return Profile.create({
    userId,
    role: workspace,
    fullName: source.fullName,
    phone: source.phone,
    location: source.location || '',
    avatarUrl: source.avatarUrl || '',
  });
};

// Build the standard auth payload: identity, the active workspace, and the
// workspaces this account has available.
const authUserPayload = async (user) => {
  const [profile, workspaces] = await Promise.all([
    Profile.findOne({ userId: user.id, role: user.role })
      .select('fullName avatarUrl')
      .lean(),
    availableWorkspaces(user.id),
  ]);
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    workspaces,
    fullName: profile && profile.fullName ? profile.fullName : null,
    avatarUrl: profile && profile.avatarUrl ? profile.avatarUrl : null,
  };
};

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
    // without a separate profile fetch. Scoped to the active workspace so the
    // greeting matches the profile the user is currently working in.
    const payload = await authUserPayload(user);

    return res.status(200).json({
      token,
      user: payload,
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

// Workspace-specific field groups are documented in the Profile model, which
// enforces the split at validation time. They are listed here for reference
// only; the workspace switch no longer clears either group.
//
//   Recruiter-only : jobTitle, companyName, companyWebsite, companyDescription
//   Jobseeker-only : headline, bio, skills, education, experience, links

/**
 * POST /api/auth/role — switch the signed-in account's ACTIVE WORKSPACE
 * between jobseeker and recruiter, then re-issue a JWT reflecting it.
 *
 * NON-DESTRUCTIVE. The previous implementation rewrote the single Profile's
 * role and `$unset` the outgoing workspace's fields, which permanently deleted
 * a jobseeker's headline, bio, skills, education, experience and links the
 * first time they switched. Accounts now hold one Profile per workspace, so a
 * switch only:
 *   1. changes User.role (the active workspace), and
 *   2. ensures a profile row exists for the target workspace.
 *
 * Nothing belonging to the workspace being left is read, written, or removed.
 * Switching back restores that workspace exactly as it was.
 */
const switchWorkspace = async (req, res, next) => {
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

    // Admins are never switchable via the public role endpoint. The only way
    // in or out of the admin role is the protected server-side bootstrap.
    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Admin role cannot be changed' });
    }

    if (newRole !== user.role) {
      const previousRole = user.role;
      user.role = newRole;

      try {
        await user.save();
        await ensureWorkspaceProfile(user._id, newRole);
      } catch (err) {
        // A failed switch must not leave the account half-moved, nor report
        // success. Restore the previous active workspace and surface the error.
        user.role = previousRole;
        await user.save().catch(() => {});

        // E11000 on `userId` means the collection still carries the legacy
        // unique index (userId_1) that permits only ONE profile per account.
        // An account needs one profile per workspace, so opening the second
        // workspace is impossible until that index is replaced by the
        // compound {userId, role} one. This is a deployment that has not run
        // the profile-workspaces migration — report it explicitly instead of
        // returning an opaque 500 that looks like an application bug.
        if (err && err.code === 11000) {
          const onUserId =
            err.keyPattern && Object.keys(err.keyPattern).length === 1 && 'userId' in err.keyPattern;
          if (onUserId || (err.message || '').includes('userId_1')) {
            return res.status(409).json({
              error:
                'This deployment has not run the profile-workspaces migration, so an account cannot hold more than one profile. Run "npm run migrate:profile-workspaces -- --apply" on the database, then retry.',
              code: 'PROFILE_WORKSPACES_MIGRATION_PENDING',
            });
          }
        }
        return next(err);
      }
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    return res.status(200).json({
      token,
      user: await authUserPayload(user),
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
  // Exported under both names: switchWorkspace is the accurate name, and
  // toggleRole is kept so existing imports keep working.
  switchWorkspace,
  toggleRole: switchWorkspace,
  roleValidators,
  availableWorkspaces,
};