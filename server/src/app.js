const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const { UPLOAD_ROOT } = require('./config/uploads');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const jobRoutes = require('./routes/job.routes');
const applicationRoutes = require('./routes/application.routes');
const savedJobRoutes = require('./routes/savedJob.routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// CORS restricted to the local Vite frontend
app.use(
  cors({
    origin: env.clientOrigin,
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  })
);

// Uploaded avatars and resumes are served back from /uploads/...
app.use('/uploads', express.static(UPLOAD_ROOT));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/saved-jobs', savedJobRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;