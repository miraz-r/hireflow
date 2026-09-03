const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    // The job being applied to.
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: [true, 'Application must reference a job'],
      index: true,
    },

    // The jobseeker who applied. Server-derived from the auth token.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Application must belong to a user'],
      index: true,
    },

    // Hiring stage. Always starts at "applied"; recruiters advance it later in
    // the roadmap (status management is out of scope for this task).
    status: {
      type: String,
      enum: {
        values: ['applied', 'under-review', 'interview', 'offer', 'hired', 'rejected'],
        message: 'Invalid application status',
      },
      default: 'applied',
    },
  },
  { timestamps: true }
);

// A jobseeker can apply to a given job at most once. Enforced at the database
// level so even a race between two concurrent requests cannot create a
// duplicate application.
applicationSchema.index({ jobId: 1, userId: 1 }, { unique: true });

applicationSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Application', applicationSchema);
