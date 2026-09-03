const mongoose = require('mongoose');

// Sub-schemas for collections embedded on a jobseeker profile.
// Kept inline (not separate model files) because they only exist as part of Profile.
const educationSchema = new mongoose.Schema(
  {
    school: { type: String, required: true, trim: true, maxlength: 200 },
    degree: { type: String, trim: true, maxlength: 120 },
    field: { type: String, trim: true, maxlength: 120 },
    startDate: { type: Date },
    endDate: { type: Date },
    current: { type: Boolean, default: false },
    description: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: true }
);

const experienceSchema = new mongoose.Schema(
  {
    company: { type: String, required: true, trim: true, maxlength: 200 },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    location: { type: String, trim: true, maxlength: 160 },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    current: { type: Boolean, default: false },
    description: { type: String, trim: true, maxlength: 2000 },
  },
  { _id: true }
);

const linkSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 60 },
    url: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
      match: [/^https?:\/\/[^\s]+$/i, 'Link must be a valid http(s) URL'],
    },
  },
  { _id: true }
);

const profileSchema = new mongoose.Schema(
  {
    // Owning user — 1:1. Unique index enforces at most one profile per user.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Profile must belong to a user'],
      unique: true,
      index: true,
    },

    // Mirrored from User.role. User is the source of truth; this guards the
    // profile from accidentally holding data for the wrong role.
    role: {
      type: String,
      required: [true, 'Profile role is required'],
      enum: {
        values: ['jobseeker', 'recruiter'],
        message: 'Profile role must be jobseeker or recruiter',
      },
    },

    // ---------- Shared fields (valid for both roles) ----------
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: 120,
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true,
      maxlength: 32,
      match: [/^[+0-9()\-\s]{6,32}$/, 'Invalid phone format'],
    },
    location: {
      type: String,
      trim: true,
      maxlength: 160,
      default: '',
    },
    avatarUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },

    // ---------- Jobseeker-only fields ----------
    headline: {
      type: String,
      trim: true,
      maxlength: 140,
      default: '',
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    skills: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length <= 50,
        message: 'Skills cannot exceed 50 entries',
      },
    },
    education: { type: [educationSchema], default: [] },
    experience: { type: [experienceSchema], default: [] },
    links: { type: [linkSchema], default: [] },
    resumeUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    resumeName: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },

    // ---------- Recruiter-only fields ----------
    jobTitle: {
      type: String,
      trim: true,
      maxlength: 160,
      default: '',
    },
    companyName: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    companyWebsite: {
      type: String,
      trim: true,
      maxlength: 500,
      match: [/^https?:\/\/[^\s]+$/i, 'Company website must be a valid URL'],
      default: '',
    },
    companyDescription: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
  },
  { timestamps: true }
);

// Block accidental mixing of jobseeker and recruiter fields.
// This runs as part of .validate() / .save().
profileSchema.pre('validate', function (next) {
  const isJobseeker = this.role === 'jobseeker';
  const isRecruiter = this.role === 'recruiter';

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

  const hasValue = (v) => {
    if (v == null) return false;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    return true;
  };

  if (isJobseeker) {
    const bad = recruiterOnly.find((f) => hasValue(this[f]));
    if (bad) {
      return next(
        new Error(`Field "${bad}" is not allowed for jobseeker profiles`)
      );
    }
  }
  if (isRecruiter) {
    const bad = jobseekerOnly.find((f) => hasValue(this[f]));
    if (bad) {
      return next(
        new Error(`Field "${bad}" is not allowed for recruiter profiles`)
      );
    }
  }
  return next();
});

// Normalize skills: trim, drop empties, dedupe case-insensitively, cap at 50.
// Runs on both validate() (e.g. Profile.create()) and save().
profileSchema.pre('validate', function (next) {
  if (Array.isArray(this.skills)) {
    const seen = new Set();
    const cleaned = [];
    for (const raw of this.skills) {
      if (typeof raw !== 'string') continue;
      const s = raw.trim();
      if (!s) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      cleaned.push(s);
      if (cleaned.length >= 50) break;
    }
    this.skills = cleaned;
  }
  return next();
});

profileSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Profile', profileSchema);
