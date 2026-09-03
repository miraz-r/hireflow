const mongoose = require('mongoose');

const salarySchema = new mongoose.Schema(
  {
    min: { type: Number, min: 0 },
    max: { type: Number, min: 0 },
    currency: { type: String, default: 'USD', maxlength: 10 },
    period: {
      type: String,
      enum: {
        values: ['yearly', 'hourly'],
        message: 'Salary period must be yearly or hourly',
      },
      default: 'yearly',
    },
  },
  { _id: false }
);

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
      maxlength: 160,
    },
    company: {
      type: String,
      required: [true, 'Company is required'],
      trim: true,
      maxlength: 200,
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
      maxlength: 160,
    },
    workType: {
      type: String,
      required: [true, 'Work type is required'],
      enum: {
        values: ['Remote', 'Hybrid', 'On-site'],
        message: 'Work type must be Remote, Hybrid, or On-site',
      },
    },
    employmentType: {
      type: String,
      required: [true, 'Employment type is required'],
      enum: {
        values: ['Full-time', 'Part-time', 'Contract'],
        message: 'Employment type must be Full-time, Part-time, or Contract',
      },
    },
    salary: { type: salarySchema, default: {} },
    experienceLevel: {
      type: String,
      required: [true, 'Experience level is required'],
      enum: {
        values: ['Entry-level', 'Mid-level', 'Senior', 'Lead', 'Manager'],
        message: 'Invalid experience level',
      },
    },
    skills: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length <= 50,
        message: 'Skills cannot exceed 50 entries',
      },
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      maxlength: 100,
    },
    // Optional company logo color (used by the frontend avatar).
    accent: {
      type: String,
      trim: true,
      maxlength: 40,
      default: '',
    },
  },
  { timestamps: true }
);

// Normalize skills: trim, drop empties, dedupe case-insensitively, cap at 50.
jobSchema.pre('validate', function (next) {
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

// Indexes for common list + filter queries.
jobSchema.index({ category: 1 });
jobSchema.index({ company: 1 });
jobSchema.index({ workType: 1, employmentType: 1 });

jobSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Job', jobSchema);
