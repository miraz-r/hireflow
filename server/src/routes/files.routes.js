const express = require('express');
const mongoose = require('mongoose');
const StoredFile = require('../models/StoredFile');

const router = express.Router();

// Public file serving for non-sensitive uploads. Only avatars are served
// through this route — resumes are private and must go through the
// ownership-checked delivery endpoints (GET /api/profile/resume,
// GET /api/applications/:id/resume).
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'File not found' });
    }
    const doc = await StoredFile.findById(req.params.id).catch(() => null);
    if (!doc || doc.kind !== 'avatar') {
      return res.status(404).json({ error: 'File not found' });
    }
    res.setHeader('Content-Type', doc.contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(doc.data);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
