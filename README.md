# HireFlow

HireFlow is a job marketplace platform: public job discovery, jobseeker
applications and profile, a recruiter workspace, and a platform-admin
workspace.

- Frontend: React 18 + Vite (`/`)
- Backend: Node.js (Express, Mongoose, JWT) (`/server`)
- Database: MongoDB

## Prerequisites

- Node.js >= 18
- A MongoDB connection string (Atlas SRV or local `mongodb://`)

## Setup

```bash
npm install
cd server && npm install
cp server/.env.example server/.env   # fill in real values
cp .env.example .env                  # frontend overrides (optional in dev)
```

### Environment variables

**Backend** (`server/.env`, backend-only secrets — never expose to Vite):

| Variable | Required | Notes |
| --- | --- | --- |
| `MONGODB_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | Long random string |
| `JWT_EXPIRES_IN` | no | Default `7d` |
| `BCRYPT_ROUNDS` | no | Default `12` |
| `PORT` | no | Default `5000` |
| `NODE_ENV` | no | `development` / `production` |
| `CLIENT_ORIGIN` | **production: yes** | CORS origin for the deployed frontend |
| `RESEND_API_KEY` | no | Email sending disabled (with warning) when unset |
| `EMAIL_FROM` | no | Verified sender address |
| `DNS_SERVERS` | no | Custom DNS override (comma-separated) for SRV lookups |
| `ADMIN_BOOTSTRAP_*` | no | Seeds an initial admin via `npm run seed:admin` |

**Frontend** (build-time only, prefixed `VITE_` — inlined into the client
bundle):

| Variable | Required (prod build) | Dev default |
| --- | --- | --- |
| `VITE_API_BASE_URL` | yes | `http://localhost:5000/api` |
| `VITE_MEDIA_BASE` | yes | `http://localhost:5000` |

Production builds (`npm run build`) **fail loudly at runtime** if the two
`VITE_` variables are missing — they never silently fall back to localhost.
In production mode the backend additionally fails fast at boot if
`MONGODB_URI`, `JWT_SECRET`, or `CLIENT_ORIGIN` are unset, or if MongoDB is
unreachable, and will not have accepted traffic with a degraded dependency.

## Development

```bash
# Backend (port 5000)
cd server
npm run dev

# Frontend (port 5173)
npm run dev
```

Useful scripts: `npm run seed` / `npm run seed:admin` (server) seed demo data.
The admin bootstrap seed refuses to run in production unless
`ADMIN_BOOTSTRAP_ALLOW_PRODUCTION=true` is set.

## Testing

```bash
cd server && npm test      # backend test suite (node --test)
npm run build              # frontend production build
npx oxlint src             # static checks for the frontend
```

## Production

```bash
# Frontend
VITE_API_BASE_URL=https://api.yourdomain.com/api \
VITE_MEDIA_BASE=https://api.yourdomain.com \
npm run build
# Serve dist/ with your static host or CDN of choice.

# Backend
cd server
NODE_ENV=production \
MONGODB_URI=... \
JWT_SECRET=... \
CLIENT_ORIGIN=https://hireflow.yourdomain.com \
npm start
```

## Health endpoints

- `GET /api/health` — liveness. Always 200 while the process is serving;
  reports `database: connected|disconnected`.
- `GET /api/health/ready` — readiness. `200` only when MongoDB is connected;
  `503` otherwise. Point load balancers/orchestrators at this.

## Known deferred items

- Resume access control and private delivery (Task 6)
- Upload storage persistence (Task 7)
- Live deployment & smoke testing (Task 8)
- Full-site responsive audit (Task 9)
