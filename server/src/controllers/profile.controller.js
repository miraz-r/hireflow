const path = require('path');
const fs = require('fs');
const Profile = require('../models/Profile');
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const SavedJob = require('../models/SavedJob');
const { publicPathFor, UPLOAD_ROOT, AVATAR_DIR, sendResume } = require('../config/uploads');
const storage = require('../config/storage');

/**
 * Profile controller.
 *
 * Security invariants (DO NOT RELAX):
 *   - The owning user is ALWAYS `req.user.id`. The URL never carries a userId.
 *   - The profile role is ALWAYS `req.user.role`. Clients cannot set it.
 *   - Unknown fields sent by clients are silently dropped before persistence.
 *   - The response is built from a fresh DB read so internal fields like
 *     `__v` are never exposed (Profile.toJSON also strips `__v`).
 *
 * WORKSPACE SCOPING: an account may hold one Profile per workspace, so every
 * read and write here is scoped by BOTH `userId` and `role`. Scoping on
 * `userId` alone is ambiguous once a second profile exists and would let a
 * recruiter edit the jobseeker's profile (or vice versa). `req.user.role` is
 * the active workspace, so "the profile the user is working in" is addressed as
 * `{ userId: req.user.id, role: req.user.role }` everywhere below.
 */

// Fields that are valid on the profile document.
// Anything else in req.body is silently dropped.
const ALLOWED_FIELDS = [
  'fullName',
  'phone',
  'location',
  // NOTE: avatarUrl is intentionally NOT client-settable. It is only
  // assigned server-side by the avatar upload flow (publicPathFor), and
  // cleared by removeAvatar. Letting clients set it would let a crafted
  // value drive arbitrary filesystem deletion in removeAvatar.
  // jobseeker-only
  'headline',
  'bio',
  'skills',
  'education',
  'experience',
  'links',
  'resumeUrl',
  'resumeName',
  // recruiter-only
  'jobTitle',
  'companyName',
  'companyWebsite',
  'companyDescription',
];

// Format a Mongoose ValidationError into a fieldErrors map for the client.
const validationFieldErrors = (err) => {
  const fieldErrors = {};
  if (err && err.name === 'ValidationError' && err.errors) {
    for (const key of Object.keys(err.errors)) {
      const base = key.split('.')[0];
      if (!(base in fieldErrors)) fieldErrors[base] = err.errors[key].message;
    }
  }
  return fieldErrors;
};

/**
 * Build a clean document payload from req.body.
 * - Drops unknown fields (defense in depth: we never write what we don't know).
 * - REJECTS fields that belong to the other role with a 400-style error.
 *   This is the belt-and-braces check alongside the schema's pre('validate')
 *   mix-blocker. The schema would also reject these on save, but doing it
 *   here lets us return a 400 to the client instead of letting it bubble up
 *   as a Mongoose ValidationError with an internal message.
 *
 * @throws {{ status: number, message: string }} when forbidden fields are present
 */
const pickPayload = (body, role) => {
  const recruiterOnly = [
    'jobTitle',
    'companyName',
    'companyWebsite',
    'companyDescription',
  ];
  const jobseekerOnly = [
    'headline',
    'bio',
    'skills',
    'education',
    'experience',
    'links',
    'resumeUrl',
    'resumeName',
  ];
  const forbiddenForRole =
    role === 'jobseeker' ? recruiterOnly : jobseekerOnly;

  // Reject forbidden fields up front so we return a clean 400 with the
  // first offending field's name, matching the auth controller's 4xx style.
  for (const field of forbiddenForRole) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      const err = new Error(
        `Field "${field}" is not allowed for ${role} profiles`
      );
      err.status = 400;
      throw err;
    }
  }

  const out = {};
  for (const field of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      out[field] = body[field];
    }
  }
  return out;
};

/**
 * Format a profile document for the HTTP response.
 * Profile.toJSON already strips `__v`; we pass the doc through toJSON to
 * normalise the shape and rename `_id` -> `id`.
 */
const formatProfile = (doc) => {
  if (!doc) return null;
  const obj = doc.toJSON ? doc.toJSON() : doc;
  return {
    id: obj._id,
    userId: obj.userId,
    role: obj.role,
    fullName: obj.fullName,
    phone: obj.phone,
    location: obj.location,
    avatarUrl: obj.avatarUrl,
    headline: obj.headline,
    bio: obj.bio,
    skills: obj.skills,
    education: obj.education,
    experience: obj.experience,
    links: obj.links,
    resumeUrl: obj.resumeUrl,
    resumeName: obj.resumeName,
    jobTitle: obj.jobTitle,
    companyName: obj.companyName,
    companyWebsite: obj.companyWebsite,
    companyDescription: obj.companyDescription,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

/**
 * The profile document for the caller's ACTIVE workspace. This single helper
 * backs every /api/profile read and write so the workspace predicate can never
 * be forgotten in one of the nine call sites.
 */
const activeProfileQuery = (req) => ({
  userId: req.user.id,
  role: req.user.role,
});

// ---------------------------------------------------------------------------
// GET /api/profile
// ---------------------------------------------------------------------------
const getMyProfile = async (req, res, next) => {
  try {
    const profile = await Profile.findOne(activeProfileQuery(req));
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    return res.status(200).json(formatProfile(profile));
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/profile  (one-time create)
// ---------------------------------------------------------------------------
const createMyProfile = async (req, res, next) => {
  try {
    const role = req.user.role;
    const payload = pickPayload(req.body, role);

    try {
      const created = await Profile.create({
        ...payload,
        userId: req.user.id,
        role,
      });
      return res.status(201).json(formatProfile(created));
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ error: 'Profile already exists' });
      }
      if (err.name === 'ValidationError' || err.status === 400) {
        return res.status(400).json({ error: err.message, fieldErrors: validationFieldErrors(err) });
      }
      return next(err);
    }
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// PUT /api/profile  (full replace)
// ---------------------------------------------------------------------------
const updateMyProfile = async (req, res, next) => {
  try {
    const role = req.user.role;
    const payload = pickPayload(req.body, role);

    const updated = await Profile.findOneAndUpdate(
      activeProfileQuery(req),
      { $set: { ...payload, role } },
      { new: true, runValidators: true, context: 'query' }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    return res.status(200).json(formatProfile(updated));
  } catch (err) {
    if (err.name === 'ValidationError' || err.status === 400) {
      return res.status(400).json({ error: err.message, fieldErrors: validationFieldErrors(err) });
    }
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/profile  (partial update)
// ---------------------------------------------------------------------------
const patchMyProfile = async (req, res, next) => {
  try {
    const role = req.user.role;
    const payload = pickPayload(req.body, role);

    const updated = await Profile.findOneAndUpdate(
      activeProfileQuery(req),
      { $set: { ...payload, role } },
      { new: true, runValidators: true, context: 'query' }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    return res.status(200).json(formatProfile(updated));
  } catch (err) {
    if (err.name === 'ValidationError' || err.status === 400) {
      return res.status(400).json({ error: err.message, fieldErrors: validationFieldErrors(err) });
    }
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/profile/upload/avatar  — set the profile picture
// multer (avatarUpload) runs first and populates req.file.
// ---------------------------------------------------------------------------
const uploadAvatar = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No avatar file provided' });
  }
  try {
    // Persist through the active storage driver first; only expose the
    // reference on success. A failed DB update must roll back the new
    // stored file so it is not orphaned.
    const avatarUrl = await storage.save('avatar', req.file);
    let profile;
    try {
      profile = await Profile.findOneAndUpdate(
        activeProfileQuery(req),
        { $set: { avatarUrl } },
        { new: true, runValidators: true, context: 'query' }
      );
    } catch (err) {
      await storage.remove('avatar', avatarUrl);
      throw err;
    }
    if (!profile) {
      await storage.remove('avatar', avatarUrl);
      return res.status(404).json({ error: 'Profile not found' });
    }
    return res.status(200).json(formatProfile(profile));
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /api/profile/upload/resume  — set the jobseeker's CV
// Recruiters are not allowed to upload a resume.
// ---------------------------------------------------------------------------
const uploadResume = async (req, res, next) => {
  if (req.user.role !== 'jobseeker') {
    return res.status(403).json({ error: 'Only jobseekers can upload a resume' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No resume file provided' });
  }
  try {
    // Persist through the active storage driver first, then point the
    // profile at it. Roll back the new file if the update fails so we do
    // not replace the user's resume with a dangling reference.
    const resumeUrl = await storage.save('resume', req.file);
    let profile;
    try {
      profile = await Profile.findOneAndUpdate(
        activeProfileQuery(req),
        { $set: { resumeUrl, resumeName: req.file.originalname } },
        { new: true, runValidators: true, context: 'query' }
      );
    } catch (err) {
      await storage.remove('resume', resumeUrl);
      throw err;
    }
    if (!profile) {
      await storage.remove('resume', resumeUrl);
      return res.status(404).json({ error: 'Profile not found' });
    }
    return res.status(200).json(formatProfile(profile));
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/profile/avatar — remove the profile picture
// ---------------------------------------------------------------------------
const removeAvatar = async (req, res, next) => {
  try {
    const profile = await Profile.findOne(activeProfileQuery(req));
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const prevUrl = profile.avatarUrl;
    profile.avatarUrl = '';
    await profile.save();

    // Best-effort cleanup of the stored image file. Clearing the DB
    // reference is the outcome that matters, so a cleanup failure must
    // never fail the request.
    await storage.remove('avatar', prevUrl);

    return res.status(200).json(formatProfile(profile));
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/profile — delete the current user's account and all data
// ---------------------------------------------------------------------------
const deleteMyProfile = async (req, res, next) => {
  try {
    // req.user.id is derived from the JWT — never from the client body.
    const userId = req.user.id;

    // Remove associated data across every workspace this account holds:
    // all of its profiles (one per workspace), jobs posted, applications, and
    // saved jobs. Use independent deleteMany calls — if one collection is empty
    // the operation still succeeds. We deliberately do NOT cascade-delete
    // jobs posted by other users or unrelated global seed data.
    await Promise.all([
      Profile.deleteMany({ userId }),
      Job.deleteMany({ postedBy: userId }),
      Application.deleteMany({ userId }),
      SavedJob.deleteMany({ userId }),
    ]);

    // Finally remove the user account itself.
    const deleted = await User.findByIdAndDelete(userId);
    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /api/profile/resume  — the caller's OWN resume, protected delivery.
// ---------------------------------------------------------------------------
const getOwnResume = async (req, res, next) => {
  try {
    const profile = await Profile.findOne(activeProfileQuery(req))
      .select('resumeUrl resumeName')
      .lean();
    if (!profile || !profile.resumeUrl) {
      return res.status(404).json({ error: 'No resume uploaded' });
    }
    return sendResume(res, profile.resumeUrl, profile.resumeName, {
      download: req.query.download === '1',
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getMyProfile,
  createMyProfile,
  updateMyProfile,
  patchMyProfile,
  uploadAvatar,
  uploadResume,
  deleteMyProfile,
  removeAvatar,
  getOwnResume,
};
