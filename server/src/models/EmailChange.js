const mongoose = require('mongoose');

/**
 * Pending email-change requests.
 *
 * A user requests a new email address but their current `User.email` is only
 * replaced once a single-use, time-limited verification token is presented.
 * Only the SHA-256 hash of the token is stored here — never the raw token.
 *
 * Lifecycle:
 *   - created on request (one active request per user; older ones are removed)
 *   - `tokenHash` + `expiresAt` overwritten on resend (previous token dies)
 *   - `consumedAt` claimed atomically during verification so a token is
 *     single-use even under concurrent requests
 *   - document is deleted on successful verification or cancellation
 */
const emailChangeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      index: true,
    },
    newEmail: {
      type: String,
      required: [true, 'New email is required'],
      lowercase: true,
      trim: true,
    },
    tokenHash: {
      type: String,
      required: [true, 'Token hash is required'],
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiry is required'],
    },
    consumedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Housekeeping: drop requests whose 24h window has passed.
emailChangeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

emailChangeSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.tokenHash;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('EmailChange', emailChangeSchema);