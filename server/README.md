# FairView Server

Backend API for FairView. Handles login for four roles, the project and task workflow, and the locked manager and client ratings.

## Status

| Part | Status |
| --- | --- |
| JWT login with four roles (client, manager, employee, hr) | Done |
| Account creation by HR only (no public sign-up) | Done |
| Projects, tasks and work shares (total capped at 100%, fixed once set) | Done |
| Task status flow with manager rework | Done |
| Manager rating: locked, must be given before delivery | Done |
| Client rating: locked, edit/delete always refused and logged | Done |
| Audit log | Done |
| Tests | 88 passing |
| ML / fairness score | Planned (separate Python service) |

## Setup

Requires Node.js 20+ and a MongoDB database (local or MongoDB Atlas).

```bash
cd server
npm install
cp .env.example .env      # set MONGODB_URI and JWT_SECRET
npm run seed              # creates 5 demo accounts, password: password123
npm run dev               # API at http://localhost:5000
```

Health check: http://localhost:5000/api/health should return `{"ok":true}`.

Demo accounts: `hr@`, `client@`, `manager@`, `priya@`, `aman@` (all `@fairview.test`).

`requests.http` walks through the full flow and can be run with the VS Code REST Client extension.

## Tests

```bash
npm test
```

The tests run without a database. They cover every way of editing a locked rating, role checks, forged and expired tokens, the 100% work share limit and the rule that a manager must rate before delivering.

## API

| Method and route | Role | Purpose |
| --- | --- | --- |
| POST /api/auth/login | any | Log in, get a token |
| GET /api/auth/me | logged in | Current user |
| POST /api/users | hr | Create an account |
| GET /api/users?role= | logged in | List names and roles |
| POST /api/projects | client | Create a project and choose its manager |
| GET /api/projects | logged in | Projects related to the user |
| POST /api/projects/:id/deliver | manager | Deliver (all tasks submitted and rated) |
| POST /api/tasks | manager | Create a task with a work share |
| GET /api/tasks | employee, manager, hr | Tasks related to the user |
| PATCH /api/tasks/:id/status | employee, manager | Move a task forward or send back for rework |
| POST /api/assessments | manager | Rate a submitted task (locked) |
| GET /api/assessments | manager, employee, hr | Ratings related to the user |
| POST /api/ratings | client | Rate a delivered project (locked) |
| GET /api/ratings/project/:id | users on that project, hr | View the client rating |
| PUT / PATCH / DELETE /api/ratings/:id | none | Always 403, logged as blocked |

## Rating lock

Ratings are protected at two levels:

1. **API:** the edit and delete routes always return 403 and write a "blocked" entry to the audit log.
2. **Model:** `src/models/lockRecord.js` is a Mongoose plugin that rejects every update and delete operation on the locked collections before the query reaches MongoDB, so a new route cannot change a rating by mistake.

The lock is enforced by the application. Someone with direct admin access to the database could still change data. Database-level permissions or tamper-evident hashing would be needed to prevent that.

## Blind manager rating

A manager has to rate every task before the project is delivered and cannot rate afterwards. This way the manager never sees the client's rating first and cannot simply copy it.

## Folder structure

```
src/
  app.js              Express app (routes + error handling)
  index.js            server entry point
  config/             environment variables and database connection
  models/             User, Project, Task, ratings, AuditLog, lockRecord plugin
  middleware/         auth, role check, edit blocker, error handler
  routes/             route files
  utils/              helpers (audit, errors, id compare)
  scripts/seed.js     demo accounts
tests/                Jest + Supertest tests
```
