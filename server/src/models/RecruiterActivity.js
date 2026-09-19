const mongoose = require('mongoose');
const { APPLICATION_STATUSES } = require('../utils/applicationStatus');

const recruiterActivitySchema = new mongoose.Schema(
  {
    // The recruiter who triggered the event.
    recruiterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Activity must reference a recruiter'],
    },

    // The application the event refers to.
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: [true, 'Activity must reference an application'],
    },

    // Status before the change (empty for the initial applied state).
    previousStatus: {
      type: String,
      trim: true,
      default: '',
    },

    // Status after the change.
    newStatus: {
      type: String,
      enum: {
        values: APPLICATION_STATUSES,
        message: 'Invalid application status',
      },
      required: [true, 'Activity must record the new status'],
    },
  },
  { timestamps: true }
);

recruiterActivitySchema.index({ recruiterId: 1, createdAt: -1 });

recruiterActivitySchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('RecruiterActivity', recruiterActivitySchema);