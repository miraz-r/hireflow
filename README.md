# HireFlow

HireFlow is a full-stack job marketplace connecting jobseekers and recruiters.
Jobseekers can discover openings, manage applications, and track saved jobs,
while recruiters get a dedicated workspace for postings and applicant review.
A protected admin workspace handles platform management.

## Live Demo

[Visit HireFlow](https://hireflow-rho-indol.vercel.app)

## Features

### Jobseeker

- Browse, search, and filter jobs
- User registration and login
- Profile management
- Resume upload
- Apply to jobs
- View application history
- Saved jobs

### Recruiter

- Recruiter registration and login
- Post jobs
- Recruiter dashboard
- View applications for posted jobs
- Application and pipeline tracking

### Admin

- Protected admin dashboard
- User management
- Job management
- Application management
- Platform analytics and activity
- Global search

Admin accounts are privately provisioned — there is no public admin signup.

## Tech Stack

| Area | Technologies |
| --- | --- |
| Frontend | React, Vite, React Router, Axios, Recharts, JavaScript |
| Backend | Node.js, Express, MongoDB, Mongoose, JWT, bcrypt, Multer, express-validator |
| Deployment | Vercel (frontend), Render (backend), MongoDB Atlas (database) |

## Project Structure

```text
hireflow/
├── src/                  # React frontend
├── server/               # Express REST API
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── seed/
│   │   └── services/
│   └── test/
├── package.json
├── server/package.json
└── README.md
```

## Local Development

1. Clone the repository:

```bash
git clone https://github.com/miraz-r/hireflow.git
cd hireflow
```

2. Install frontend dependencies:

```bash
npm install
```

3. Install backend dependencies:

```bash
cd server && npm install && cd ..
```

4. Configure environment variables using the provided `.env.example` files:

```bash
cp server/.env.example server/.env
cp .env.example .env
```

5. Start the backend:

```bash
cd server
npm run dev
```

6. Start the frontend (in a second terminal, from the repo root):

```bash
npm run dev
```

The backend runs on `http://localhost:5000` and the frontend on
`http://localhost:5173`.

## Environment Variables

- Backend variables live in `server/.env`.
- Frontend variables live in the root `.env`.
- `.env.example` files are provided for both — copy them and fill in real values.
- Real secrets must never be committed.

## Deployment

- Frontend deployed on Vercel.
- Backend deployed on Render.
- MongoDB Atlas used for production data.
- MongoDB-backed file storage is used in production so uploaded resumes and files persist across deployments.

## Author

**Mirazur Rahman**

- GitHub: https://github.com/miraz-r
- LinkedIn: https://www.linkedin.com/in/miraz-r/
