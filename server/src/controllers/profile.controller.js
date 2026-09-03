const Profile = require('../models/Profile');
const { publicPathFor } = require('../config/uploads');

/**
 * Profile controller.
 *
 * Security invariants (DO NOT RELAX):
 *   - The owning user is ALWAYS `req.user.id`. The URL never carries a userId.
 *   - The profile role is ALWAYS `req.user.role`. Clients cannot set it.
 *   - Unknown fields sent by clients are silently dropped before persistence.
 *   - The response is built from a fresh DB read so internal fields like
 *     `__v` are never exposed (Profile.toJSON also strips `__v`).
 */

// Fields that are valid on the profile document.
// Anything else in req.body is silently dropped.
const ALLOWED_FIELDS = [
  'fullName',
  'phone',
  'location',
  'avatarUrl',
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

// ---------------------------------------------------------------------------
// GET /api/profile
// ---------------------------------------------------------------------------
const getMyProfile = async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ userId: req.user.id });
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
      { userId: req.user.id },
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
      { userId: req.user.id },
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
    const avatarUrl = publicPathFor(req.file.path);
    const profile = await Profile.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { avatarUrl } },
      { new: true, runValidators: true, context: 'query' }
    );
    if (!profile) {
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
    const resumeUrl = publicPathFor(req.file.path);
    const profile = await Profile.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { resumeUrl, resumeName: req.file.originalname } },
      { new: true, runValidators: true, context: 'query' }
    );
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    return res.status(200).json(formatProfile(profile));
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
};
