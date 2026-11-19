# FairView API

Express API for FairView: companies and people, projects and work, the blind manager rating, one-time client rating links, locked ratings, the audit log, and Gap Cards from the ML service.

## Setup

Requires Node.js 20+ and MongoDB **running as a replica set** (ratings are saved in transactions). MongoDB Atlas, including the free tier, always is one.

```bash
cd server
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

Fill in `.env` (each setting is explained in `.env.example`). The two you must set:

- `MONGODB_URI`: your Atlas connection string, on one line, ending in `/fairview`
- `JWT_SECRET`: a long random string: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

```bash
npm run seed -- --reset     # demo company (WIPES the database in MONGODB_URI first)
npm run dev                 # API at http://localhost:5000, health check at /api/health
```

`npm run seed` without `--reset` adds the demo company only if it isn't there yet.

### Local MongoDB

A plain local install is not a replica set, and the server will say so and stop. To make it one:

```bash
mongod --replSet rs0 --dbpath <some folder>
mongosh --eval "rs.initiate()"
```

Then use `MONGODB_URI=mongodb://127.0.0.1:27017/fairview?replicaSet=rs0`.

### Email

Without `SMTP_URL`, emails (client rating links, invites, reminders) are printed in the terminal. With `DEV_OUTBOX=true` they also appear at `/api/dev/outbox` and on the web app's `/dev/outbox` page, so you can open the client's rating page without real email. Never set `DEV_OUTBOX` on a real server; it is ignored when `NODE_ENV=production`.

To send real email, set `SMTP_URL` to any SMTP service, for example Gmail with an app password: `smtps://you%40gmail.com:app-password@smtp.gmail.com:465`.

### Reminders

`npm run reminders` sends one reminder for each rating link that is still unused after `REMINDER_AFTER_DAYS` (default 3). Run it once a day with a scheduler (cron, Render cron job, GitHub Actions).

## Tests

```bash
npm test
```

146 tests. They start a throw-away MongoDB replica set in memory, so you need no database of your own. The first run downloads MongoDB (about 100 MB). They cover sign-up, login and invites, the full work loop, the rating links (typos, two clicks at once, expiry, resend), who can see what, company isolation, the lock through the API and the database, and Gap Cards with a fake ML service.

`requests.http` walks the whole loop by hand with the VS Code REST Client extension.

## API

All routes start with `/api`. "Public" routes need no login; all others need `Authorization: Bearer <token>`.

| Method and route | Who | Purpose |
| --- | --- | --- |
| POST /orgs | public | A new company signs up; creates its first HR admin |
| POST /auth/login | public | Log in |
| GET /auth/me | logged in | Who am I |
| GET, POST /public/invite/:token | public | Read an invite; choose a password |
| GET, POST /public/rate/:token | public | What the client is rating; give the rating (1-5) |
| POST /users | HR | Invite a person |
| POST /users/import | HR | Invite everyone in a CSV (`name,email,role`) |
| POST /users/:id/resend-invite | HR | New invite link |
| GET /users?role= | logged in | People in my company (HR also sees emails and status) |
| PATCH /users/:id | HR | Deactivate, reactivate, change role |
| GET, POST /projects | logged in; create: manager, HR | Projects with their client contact |
| GET /projects/:id | HR, its manager, its employees | Project and its work |
| PATCH /projects/:id/client | HR | Change the client contact (logged) |
| PATCH /projects/:id/status | its manager, HR | Close or reopen |
| GET, POST /tasks | logged in; create: manager | Work (one owner each) |
| GET /tasks/:id | HR, its manager, its employee | One piece of work with the ratings you may see |
| PATCH /tasks/:id/status | employee, manager | Start, submit, send back for rework |
| POST /tasks/:id/rating | manager | The blind rating (before delivery) |
| POST /tasks/:id/deliver | manager | Deliver; emails the client a one-time link |
| POST /tasks/:id/resend-link | manager, HR | New link; the old one stops working |
| PUT, PATCH, DELETE /ratings/client/:id, /ratings/manager/:id | nobody | Always 403, logged as blocked |
| GET /insights/record | employee | My delivered work and ratings |
| GET /insights/team | manager | My ratings vs clients', person by person |
| GET /insights/overview | HR | Client rating rate, Gap Cards, analysis status, managers |
| GET /insights/audit | HR | Audit log |
| GET /gap-cards, /gap-cards/:id | HR | Gap Cards and every rating behind one |
| POST /gap-cards/:id/review | HR | Record what HR found |
| POST /gap-cards/analyse | HR | Run the gap analysis now |
| GET /dev/outbox | development only | Emails that would have been sent |

## The rating lock

Ratings are protected twice:

1. **API:** edit and delete routes always answer 403 and write a "blocked" line to the audit log.
2. **Model:** `src/models/lockRecord.js` is a Mongoose plugin that refuses every update and delete on `ClientRating`, `ManagerRating` and `AuditLog` before the query reaches MongoDB.

The lock is enforced by FairView's code. Someone with direct admin access to the database could still change data; database permissions or tamper-evident hashing would be needed to stop that.

## Folder structure

```
src/
  index.js        start: settings, database, listen
  app.js          the Express app: middleware and routes in order
  config/         settings (.env) and the database connection
  models/         Organization, User, Project, Task, ManagerRating, ClientRating,
                  RatingLink, GapCard, AuditLog, and the lockRecord plugin
  middleware/     login and role checks, rate limits, edit blocker, error handler
  routes/         one file per group of routes
  services/       workflow (rate, deliver, client rating), accounts, links, emails,
                  analysis (ML service and Gap Cards), views (who sees what)
  utils/          audit log, errors, id compare, input checks
  scripts/        seed (demo company), reminders
tests/
  setup/          in-memory MongoDB for the test run
  helpers/        test database and a fake company
  unit/           no database
  integration/    the real API against the test database
```

How a request moves through these files: [../flow.md](../flow.md). Why the code is built this way: [../Decision.md](../Decision.md).
