const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const StoredFile = require('../models/StoredFile');
const { UPLOAD_ROOT, AVATAR_DIR, RESUME_DIR, extFromMime } = require('./uploads');
const env = require('./env');

// Storage driver: 'local' (default, developer-friendly) or 'mongodb'
// (persistent across restarts/instances, the same MongoDB we already require).
const driver = env.storageDriver === 'mongodb' ? 'mongodb' : 'local';

const sanitizeBase = (originalName) =>
  path
    .basename(originalName || '', path.extname(originalName || ''))
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .slice(0, 60) || 'file';

const writeLocal = (kind, file) => {
  const dir = kind === 'avatar' ? AVATAR_DIR : RESUME_DIR;
  const ext = extFromMime(file.mimetype) || (path.extname(file.originalname || '').toLowerCase().replace(/[^a-z0-9.]/g, '') || '.bin');
  const fileName = `${sanitizeBase(file.originalname)}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  fs.writeFileSync(path.join(dir, fileName), file.buffer);
  const folder = kind === 'avatar' ? 'avatars' : 'resumes';
  return `/uploads/${folder}/${fileName}`;
};

const save = async (kind, file) => {
  if (driver === 'mongodb') {
    const doc = await StoredFile.create({
      kind,
      contentType: file.mimetype,
      originalName: file.originalname || 'file',
      size: file.size,
      data: file.buffer,
    });
    return `/api/files/${doc._id}`;
  }
  return writeLocal(kind, file);
};

// Remove a previously stored reference. Never delete a local file that does
// not resolve strictly inside the expected directory.
const remove = async (kind, ref) => {
  if (!ref || typeof ref !== 'string') return;

  if (ref.startsWith('/api/files/')) {
    const id = ref.slice('/api/files/'.length);
    if (mongoose.isValidObjectId(id)) {
      await StoredFile.deleteOne({ _id: id, kind }).catch(() => {});
    }
    return;
  }

  if (ref.startsWith('/uploads/')) {
    const rel = ref.slice('/uploads/'.length);
    const absPath = path.resolve(UPLOAD_ROOT, rel);
    const base = path.resolve(kind === 'avatar' ? AVATAR_DIR : RESUME_DIR);
    const safe = absPath.startsWith(base + path.sep);
    if (safe && fs.existsSync(absPath)) {
      try { fs.unlinkSync(absPath); } catch { /* best-effort */ }
    }
  }
};

const findStored = async (id, kind) => {
  if (!mongoose.isValidObjectId(id)) return null;
  return StoredFile.findOne({ _id: id, kind });
};

module.exports = { driver, save, remove, findStored };
