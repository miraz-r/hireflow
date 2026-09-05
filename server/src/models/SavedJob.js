const mongoose = require('mongoose');

const savedJobSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: [true, 'Saved job must reference a job'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Saved job must belong to a user'],
      index: true,
    },
  },
  { timestamps: true }
);

savedJobSchema.index({ jobId: 1, userId: 1 }, { unique: true });

savedJobSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('SavedJob', savedJobSchema);
