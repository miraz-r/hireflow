const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const { UPLOAD_AVATAR_DIR } = require('./config/uploads');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const profileRoutes = require('./routes/profile.routes');
const jobRoutes = require('./routes/job.routes');
const applicationRoutes = require('./routes/application.routes');
const savedJobRoutes = require('./routes/savedJob.routes');
const emailChangeRoutes = require('./routes/emailChange.routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Do not advertise the framework in every response.
app.disable('x-powered-by');

// Minimal, dependency-free security headers. This server returns JSON and
// static files only, so no CSP is needed here.
app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'no-referrer');
  next();
});

// CORS restricted to the local Vite frontend
app.use(
  cors({
    origin: env.clientOrigin,
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  })
);

// Uploaded avatars and resumes are stored on disk. Avatars are public static
// assets; resumes are NOT served statically — every resume read goes through
// an ownership-checked protected endpoint (profile/applications controllers).
app.use('/uploads/avatars', express.static(UPLOAD_AVATAR_DIR));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/saved-jobs', savedJobRoutes);
app.use('/api/email-change', emailChangeRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;