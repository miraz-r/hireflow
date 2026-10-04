const mongoose = require('mongoose');

// Files stored directly in MongoDB when STORAGE_DRIVER=mongodb. Local disk
// mode never writes to this collection, and resume payloads never expose
// anything other than the reference id — access still goes through the
// ownership-checked delivery endpoints created in Task 6.
const storedFileSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['avatar', 'resume'], required: true },
    contentType: { type: String, required: true, maxlength: 100 },
    originalName: { type: String, required: true, maxlength: 200 },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

storedFileSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.data;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('StoredFile', storedFileSchema);
