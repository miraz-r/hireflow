const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Uploaded files are stored on the local filesystem and served back via the
// /uploads static route. Relative to the server package root.
const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');
const AVATAR_DIR = path.join(UPLOAD_ROOT, 'avatars');
const RESUME_DIR = path.join(UPLOAD_ROOT, 'resumes');

// Ensure the directories exist at startup.
for (const dir of [UPLOAD_ROOT, AVATAR_DIR, RESUME_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_RESUME_TYPES = [
  'application/pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'text/plain', // .txt
];

const extFromMime = (mime) => {
  switch (mime) {
    case 'image/jpeg': return '.jpg';
    case 'image/png': return '.png';
    case 'image/webp': return '.webp';
    case 'image/gif': return '.gif';
    case 'application/pdf': return '.pdf';
    case 'application/msword': return '.doc';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return '.docx';
    case 'text/plain': return '.txt';
    default: return '';
  }
};

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const isAvatar = file.fieldname === 'avatar';
    cb(null, isAvatar ? AVATAR_DIR : RESUME_DIR);
  },
  filename(req, file, cb) {
    const safeBase = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .slice(0, 60) || 'file';
    const ext = extFromMime(file.mimetype);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${safeBase}-${unique}${ext}`);
  },
});

// Shared filter selects the destination by field name, then validates mime.
const fileFilter = (req, file, cb) => {
  const isAvatar = file.fieldname === 'avatar';
  const allowed = isAvatar ? ALLOWED_IMAGE_TYPES : ALLOWED_RESUME_TYPES;
  if (allowed.includes(file.mimetype)) {
    return cb(null, true);
  }
  const err = new Error(isAvatar ? 'Only image files are allowed' : 'Only PDF, DOC, DOCX or TXT files are allowed');
  err.status = 400;
  return cb(err);
};

// avatar: max 5MB; resume: max 10MB
const avatarUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('avatar');

const resumeUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('resume');

const publicPathFor = (absPath) => {
  const rel = path.relative(UPLOAD_ROOT, absPath).split(path.sep).join('/');
  return `/uploads/${rel}`;
};

module.exports = {
  UPLOAD_ROOT,
  AVATAR_DIR,
  RESUME_DIR,
  avatarUpload,
  resumeUpload,
  publicPathFor,
};
