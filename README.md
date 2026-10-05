# HireFlow

HireFlow is a job marketplace platform with public job discovery, jobseeker
applications and profiles, a recruiter workspace for managing listings, and a
platform-admin workspace for moderation and analytics.

## Features

- **Public job discovery** — browse, search, and filter live listings; no
  account required.
- **Jobseeker workspace** — profile, resume upload, job applications, and
  saved jobs.
- **Recruiter workspace** — post, update, and manage job listings; review
  applications. Accounts can hold both jobseeker and recruiter profiles and
  switch between them.
- **Admin workspace** — manage users, jobs, and applications; view analytics
  and activity; global search across the platform.
- **Authentication** — JWT-based sessions with rate-limited login and
  registration, and verified email-change flow.
- **Protected file delivery** — resumes are served only through
  ownership-checked endpoints; avatars are publicly served.
- **Health reporting** — liveness and readiness endpoints for hosting
  probes and load balancers.

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 18, Vite 5, React Router 7, Axios, Recharts |
| Backend | Node.js, Express 4, Mongoose 8, JWT, Bcrypt, Multer, express-validator |
| Database | MongoDB (Atlas SRV or self-hosted/local) |
| Email | Resend (optional — email delivery is skipped with a warning when unset) |

## Project structure

```text
hireflow/
├── src/                 # React frontend (Vite)
├── server/
│   ├── src/
│   │   ├── config/      # env, database, uploads, storage driver
│   │   ├── controllers/ # request handlers
│   │   ├── middleware/  # auth, validation, error handling
│   │   ├── models/      # Mongoose models
│   │   ├── routes/      # API routes (mounted under /api)
│   │   ├── seed/        # demo-job seeder, admin bootstrapper
│   │   ├── services/    # email delivery
│   │   ├── app.js       # Express app
│   │   └── server.js    # startup (DB connect, then listen)
│   ├── test/            # backend test suite (node --test)
│   └── uploads/         # local dev file storage (gitignored)
├── package.json         # frontend npm project
└── server/package.json  # backend npm project
```

The repository holds two separate npm projects: the frontend at the root and
the backend in `server/`. Each has its own `package.json`, lockfile, and
install step.

## Prerequisites

- Node.js >= 18
- A MongoDB connection string (Atlas `mongodb+srv://` or local `mongodb://`)

## Setup

```bash
# Frontend dependencies
npm install

# Backend dependencies
cd server && npm install && cd ..

# Backend configuration (required — fill in real values)
cp server/.env.example server/.env

# Frontend configuration (optional in dev; required for production builds)
cp .env.example .env
```

## Environment variables

Backend variables live in `server/.env` and are never exposed to the
frontend. See `server/.env.example` for the full documented list.

| Variable | Required | Notes |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Long random signing secret |
| `JWT_EXPIRES_IN` | No | Default `7d` |
| `BCRYPT_ROUNDS` | No | Default `12` |
| `PORT` | No | Default `5000`; hosting platforms inject their own |
| `NODE_ENV` | No | `development` / `production` |
| `CLIENT_ORIGIN` | Production: yes | Exact public origin of the deployed frontend; locks CORS and email-change links |
| `STORAGE_DRIVER` | No | `local` (development default) or `mongodb` (intended for production) |
| `RESEND_API_KEY` | No | When unset, email sending is skipped with a warning |
| `EMAIL_FROM` | No | Verified sender address for outbound email |
| `DNS_SERVERS` | No | Comma-separated DNS override, only if `mongodb+srv://` lookups fail on the host |

Admin provisioning variables (used by `npm run seed:admin` in `server/`):

| Variable | Required | Notes |
| --- | --- | --- |
| `ADMIN_BOOTSTRAP_EMAIL` | Yes, for seeding | Login email for the first admin |
| `ADMIN_BOOTSTRAP_PASSWORD` | Yes, for seeding | Initial admin password |
| `ADMIN_BOOTSTRAP_FULL_NAME` | Yes, for seeding | Display name for the admin profile |
| `ADMIN_BOOTSTRAP_PHONE` | Yes, for seeding | Contact phone for the admin profile |
| `ADMIN_BOOTSTRAP_ALLOW_PRODUCTION` | Production: yes, to seed | Must be `true` to run the seeder with `NODE_ENV=production` |

Frontend variables are build-time only (`VITE_` prefix — inlined into the
client bundle, so never put secrets in them). See `.env.example`.

| Variable | Required (production build) | Development default |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Yes | `http://localhost:5000/api` |
| `VITE_MEDIA_BASE` | Yes | `http://localhost:5000` |

Production builds fail loudly at startup if the two `VITE_` variables are
missing — they never silently fall back to localhost. The backend likewise
fails fast at boot when `MONGODB_URI`, `JWT_SECRET`, or (in production)
`CLIENT_ORIGIN` is unset, or when MongoDB is unreachable.

## Running locally

```bash
# Backend — http://localhost:5000
cd server
npm run dev

# Frontend — http://localhost:5173 (in a second terminal, from the repo root)
npm run dev
```

## Available scripts

Frontend (repo root):

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Preview the production build locally (port 4173) |

Backend (`server/`):

| Command | Purpose |
| --- | --- |
| `npm start` | Start the API server (`node src/server.js`) |
| `npm run dev` | Start with auto-reload (`nodemon`) |
| `npm test` | Run the backend test suite (`node --test`) |
| `npm run seed` | Seed the demo job catalogue (idempotent) |
| `npm run seed:admin` | Create the first admin from `ADMIN_BOOTSTRAP_*` (idempotent) |

Static checks:

```bash
npx oxlint src              # frontend lint
cd server && npm test       # backend tests
```

## Authentication and roles

| Role | How it is created | Capabilities |
| --- | --- | --- |
| Jobseeker | Public registration | Profile, resume upload, applications, saved jobs |
| Recruiter | Public registration | Post and manage listings, review applications |
| Admin | Private bootstrap only (`npm run seed:admin`) | Platform moderation, users, jobs, applications, analytics |

Registration is public for jobseekers and recruiters only — there is no
public admin signup. The admin role is provisioned privately via environment
credentials:

```bash
cd server
ADMIN_BOOTSTRAP_EMAIL=... \
ADMIN_BOOTSTRAP_PASSWORD=... \
ADMIN_BOOTSTRAP_FULL_NAME=... \
ADMIN_BOOTSTRAP_PHONE=... \
npm run seed:admin
```

In production, additionally set `ADMIN_BOOTSTRAP_ALLOW_PRODUCTION=true`.
The seeder is idempotent: it skips when the email already exists.

## File storage

- **Development default (`STORAGE_DRIVER=local`)** — uploads are written to
  the server's `uploads/` directory. Simple and convenient; files do not
  survive redeploys on ephemeral hosting.
- **Production (`STORAGE_DRIVER=mongodb`)** — avatars and resumes are stored
  in MongoDB via the `StoredFile` collection, so they persist across
  restarts and instances.
- **Resumes are private** — never served as static files; every read goes
  through an ownership/role-checked endpoint.
- **Avatars are public** — served as static assets (local mode) or through
  the public file endpoint (MongoDB mode).

## Production notes

Provider-neutral requirements for deploying this project:

- **Frontend** — a static host that serves Vite's `dist/` output with a
  single-page-application fallback (all routes serve `index.html`).
  Inject `VITE_API_BASE_URL` and `VITE_MEDIA_BASE` at build time, pointing
  at the deployed backend.
- **Backend** — a Node.js >= 18 host running `npm start`, honoring the
  platform's `PORT`, with `NODE_ENV=production`, `MONGODB_URI`,
  `JWT_SECRET`, `CLIENT_ORIGIN`, and `STORAGE_DRIVER=mongodb` configured.
- **Database** — a reachable MongoDB instance; collections are created
  automatically by the application models.
- **Operations** — `GET /api/health` is the liveness check (always 200
  while serving; reports database status); `GET /api/health/ready` is the
  readiness check (200 only when MongoDB is connected, 503 otherwise).

```bash
# Frontend
VITE_API_BASE_URL=https://api.yourdomain.com/api \
VITE_MEDIA_BASE=https://api.yourdomain.com \
npm run build
# Serve dist/ from a static host with SPA fallback.

# Backend
cd server
NODE_ENV=production \
MONGODB_URI=... \
JWT_SECRET=... \
CLIENT_ORIGIN=https://hireflow.yourdomain.com \
STORAGE_DRIVER=mongodb \
npm start
```

## Project status

The application is feature-complete and in deployment preparation. The
remaining step before going live is provisioning hosting, configuring the
production environment above, and running deployment smoke tests.
