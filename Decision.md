# FairView: Decision Log

This file records every meaningful decision made while writing FairView's code: what was chosen, why, what else was possible, and what we gave up. The synopsis promises that "each decision and its reason will be recorded and shared with the mentor". This file is that record.

**Rules for this file**

1. Every code change that involves a real choice (a library, a rule, a trade-off) gets an entry here in the same commit.
2. Old entries are never deleted. If a decision changes, mark the old entry **Replaced by D-xx** and add a new one.
3. Entries D-01 to D-33 were written on 17 Nov 2026, after the backend was built (22 Oct 2026). They were rebuilt from the code, its comments, the synopsis and our design notes.

**Status:** Done = in the code · Planned = agreed in the synopsis, not built yet · Proposed = suggested, waiting for a yes · Replaced = no longer true

How code moves between files is explained in [flow.md](flow.md).

## Index

| ID | Decision | Status |
| --- | --- | --- |
| D-01 | Node.js + Express 5 for the API | Done |
| D-02 | MongoDB with Mongoose | Done |
| D-03 | JWT login tokens, not sessions | Done |
| D-04 | bcryptjs for password hashing | Done |
| D-05 | Settings in `.env`, loaded by dotenv | Done |
| D-06 | CORS: one allowed website | Done |
| D-07 | Jest + Supertest for tests, nodemon for development | Done |
| D-08 | Folder layout by kind of code | Done |
| D-09 | `app.js` builds the app, `index.js` starts it | Done |
| D-10 | One error handler and an `httpError` helper | Done |
| D-11 | `sameId` helper to compare ids | Done |
| D-12 | Ratings and the audit log are write-once | Done |
| D-13 | The lock lives in two layers: API and model | Done |
| D-14 | `lockRecord` blocks every update and delete operation | Done |
| D-15 | Lock check also runs at `validate`, not only `save` | Done |
| D-16 | Blocked edit attempts are written to the audit log | Done |
| D-17 | Blind manager rating: rate every task before delivery | Done |
| D-18 | Status flows that only move forward | Done |
| D-19 | Work share is fixed at creation and capped at 100% | Done |
| D-20 | Who owns a project or task can never change | Done |
| D-21 | Client rates the whole project, manager rates each task | Done (P-01 proposes a change) |
| D-22 | Unique indexes stop double rating | Done |
| D-23 | No public sign-up; only HR creates accounts | Done |
| D-24 | Role check on every route, ownership check inside it | Done |
| D-25 | Same error for unknown email and wrong password | Done |
| D-26 | Who can see which rating | Done |
| D-27 | Every important action goes into the audit log | Done |
| D-28 | No database transactions | Done |
| D-29 | Fail fast at startup | Done |
| D-30 | Demo accounts from a seed script | Done |
| D-31 | Tests run without a database | Done |
| D-32 | `validate()` instead of `validateSync()` in tests | Done |
| D-33 | `requests.http` passes tokens and ids along by itself | Done |
| PL-01 to PL-05 | Frontend and ML plan | Planned |
| P-01 to P-04 | Changes from the Problem and USP doc | Proposed |

---

## 1. Tech stack and libraries

### D-01 · Node.js + Express 5 for the API
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/package.json`, `server/src/app.js`
- **Decision:** Write the backend in Node.js with Express 5.
- **Why:** Express is the most widely used Node framework and is part of the MERN stack named in the synopsis, so help for any problem is easy to find. Express 5 sends errors from `async` route code to the error handler by itself, so the routes need no `try/catch` and no extra package.
- **Instead of:** Express 4 (needs `express-async-errors` or a wrapper on every route). NestJS (a lot of structure for six route files). Fastify (faster, but speed doesn't matter at our size, and it is less familiar).
- **Trade-off accepted:** Express gives no structure of its own, so we chose our own folder layout (D-08).

### D-02 · MongoDB with Mongoose
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/config/db.js`, `server/src/models/*`
- **Decision:** Store data in MongoDB (free Atlas cluster or local install) through Mongoose 9.
- **Why:** Atlas is free to host. There are no table migrations to manage while the design is still changing. Mongoose gives schemas, validation and hooks, and hooks are what make the rating lock possible (D-14).
- **Instead of:** PostgreSQL (real foreign keys and easy transactions, but needs migrations and separate hosting). The plain MongoDB driver (no schemas, no validation, no hooks).
- **Trade-off accepted:** MongoDB does not check that a linked record exists. The route code checks it instead, for example that `managerId` belongs to a real manager. We also don't use transactions (D-28).

### D-03 · JWT login tokens, not sessions
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/routes/auth.js`, `server/src/middleware/auth.js`
- **Decision:** After login, the server returns a signed token (JWT) holding the user's id (`sub`) and role. The frontend sends it with every request in `Authorization: Bearer <token>`.
- **Why:** The server stores nothing about who is logged in. This works the same for a React frontend on a different port and for the Python ML service later. No session store is needed.
- **Instead of:** Server sessions with cookies (need a session store and are harder to use across ports).
- **Trade-off accepted:** A token can't be cancelled before it expires. If HR changes someone's role, the old role keeps working until the token runs out. That's why the expiry is short: 2 hours by default (`JWT_EXPIRES_IN`).

### D-04 · bcryptjs for password hashing
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/routes/users.js`, `server/src/routes/auth.js`, `server/src/scripts/seed.js`
- **Decision:** Store passwords only as bcrypt hashes made with `bcryptjs`, cost factor 10.
- **Why:** bcrypt is slow on purpose, so stolen hashes are hard to crack. `bcryptjs` is plain JavaScript, so `npm install` works on any laptop. The native `bcrypt` package needs C++ build tools, which often fail on Windows.
- **Instead of:** Native `bcrypt` (faster, but install problems). `argon2` (newer and stronger, but also a native build).
- **Trade-off accepted:** `bcryptjs` is slower than the native version. With a handful of users, this doesn't matter.

### D-05 · Settings in `.env`, loaded by dotenv
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/config/env.js`, `server/.env.example`, `.gitignore`
- **Decision:** Keep the database address, JWT secret, port, token expiry and allowed website in a `.env` file. `.env.example` shows what is needed, and `.env` is in `.gitignore`. dotenv runs with `quiet: true` so it doesn't print a line on every start.
- **Why:** The database password and JWT secret must never reach GitHub. One `env.js` file loads them for the server, the seed script and anything else that needs them.
- **Instead of:** Node's built-in `--env-file` flag (works too, but has to be added to every npm script).
- **Trade-off accepted:** One more dependency.

### D-06 · CORS: one allowed website
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/app.js`, `server/src/config/env.js`
- **Decision:** Allow browser requests only from `CORS_ORIGIN`. The default is `http://localhost:5173`, the port Vite uses for the React app.
- **Why:** The frontend and the API run on different ports, and browsers block that unless the API allows it. Allowing only one website stops other sites from calling the API from a user's browser.
- **Trade-off accepted:** The value must be changed in `.env` when the frontend is put online.

### D-07 · Jest + Supertest for tests, nodemon for development
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/package.json`, `server/tests/*`
- **Decision:** Jest runs the tests. Supertest sends HTTP requests straight to the Express app. nodemon restarts the server whenever a file is saved (`npm run dev`).
- **Why:** Jest has the test runner, the checks (`expect`) and mocking in one package. Supertest calls the app without starting a real server or opening a port (D-09).
- **Instead of:** Mocha + Chai + Sinon (three packages for the same job). Vitest (a better fit for Vite frontends; Jest is more common for Node APIs). `node --watch` could replace nodemon.
- **Trade-off accepted:** Jest is heavier than this project strictly needs.

## 2. Code structure

### D-08 · Folder layout by kind of code
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/`
- **Decision:** One folder per kind of code: `config/`, `models/`, `middleware/`, `routes/`, `utils/`, `scripts/`.
- **Why:** Each file has one job, which makes things easy to find and test. It is the most common Express layout, so an examiner will recognise it.
- **Instead of:** One big file (hard to read and test). Folders per feature such as `projects/` and `ratings/` (good for big apps, too much for this size).
- **Trade-off accepted:** Some files are tiny; `sameId.js` is 6 lines.

### D-09 · `app.js` builds the app, `index.js` starts it
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/app.js`, `server/src/index.js`
- **Decision:** `app.js` creates and exports the Express app without connecting to the database or opening a port. `index.js` connects and listens.
- **Why:** Tests import `app.js` and send requests to it with no database and no open port.
- **Trade-off accepted:** None.

### D-10 · One error handler and an `httpError` helper
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/middleware/errorHandler.js`, `server/src/utils/httpError.js`
- **Decision:** Route code throws `httpError(status, message)`. `errorHandler.js` is the only place that turns errors into replies:

  | Error | Reply |
  | --- | --- |
  | Mongoose `ValidationError` | 400 with the validation messages |
  | Mongoose `CastError` (badly formed id) | 400 `Invalid <field>.` |
  | Duplicate key (code `11000`) | 409 `This already exists.` |
  | Any error with a `status` (our `httpError`, `LockedRecordError`) | That status and message |
  | Anything else | 500 with a general message; the details go to the server console only |

- **Why:** Every error reply has the same shape, `{ "error": "..." }`, so the frontend handles them in one way. Routes stay short. Internal details are never sent to the user.
- **Trade-off accepted:** The error handler has to know Mongoose's error names.

### D-11 · `sameId` helper to compare ids
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/utils/sameId.js`
- **Decision:** Every "is this yours?" check uses `sameId(a, b)`, which compares the two ids as text and returns false if either is missing.
- **Why:** Ids from the database are ObjectId objects, but the id in the token is text. `===` between them is always false, which would refuse the real owner.
- **Trade-off accepted:** None.

## 3. The rating lock (the core of FairView)

### D-12 · Ratings and the audit log are write-once
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/models/ClientRating.js`, `ManagerAssessment.js`, `AuditLog.js`
- **Decision:** Client ratings, manager ratings and audit entries can be created, but never changed or deleted, by anyone, HR included.
- **Why:** FairView only works if the client's rating is an outside check that the manager can't touch. If ratings could be edited, comparing them would prove nothing. The manager's rating is locked too, so he can't change it after he sees the client's score.
- **Trade-off accepted:** A rating given by mistake can't be fixed. This is on purpose: anything that allows fixing also allows tampering. If corrections are ever needed, they should be a new record shown next to the original, never a change to it.

### D-13 · The lock lives in two layers: API and model
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/middleware/blockEdits.js`, `server/src/models/lockRecord.js`
- **Decision:** (1) Every edit or delete route for ratings always answers 403 (`blockEdits`). (2) The Mongoose plugin `lockRecord` refuses every update or delete on the locked models before the request reaches the database.
- **Why:** The API layer alone is not enough. One careless route written later could change a rating. The model layer catches that.
- **Trade-off accepted:** The lock is enforced by our code, not by MongoDB. Someone with direct database access (the Atlas admin, or raw driver calls through `Model.collection`) can still change data. Stopping that needs database permissions or a chain of hashes, which is beyond a mini project. This is also written in `server/README.md`.

### D-14 · `lockRecord` blocks every update and delete operation
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/models/lockRecord.js`, `server/tests/locks.test.js`
- **Decision:** Hook every Mongoose operation that can change or delete existing records: `updateOne`, `updateMany`, `replaceOne`, `findOneAndUpdate`, `findOneAndReplace`, `findOneAndDelete`, `deleteOne`, `deleteMany`, `bulkWrite`, and `save()` on a record that is not new. Each hook is an `async` function that throws a `LockedRecordError`, which carries status 403.
- **Why:** Listing every operation by name means none is forgotten. Shortcuts such as `findByIdAndUpdate` and `findByIdAndDelete` run through these operations, so they are blocked too. `locks.test.js` checks all of them on all three models.
- **Trade-off accepted:** If a future Mongoose version adds a new kind of write, it has to be added to the list by hand.

### D-15 · Lock check also runs at `validate`, not only `save`
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/models/lockRecord.js`
- **Decision:** The "is this an edit?" check runs at `pre('validate')` as well as `pre('save')`.
- **Why:** Mongoose validates a record before its save hooks run. With only the save hook, an edit with bad data was refused by validation (400) instead of the lock (403). Now the lock always answers first. We found this while writing the tests.
- **Trade-off accepted:** None.

### D-16 · Blocked edit attempts are written to the audit log
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/middleware/blockEdits.js`, `server/src/routes/ratings.js`, `server/src/routes/assessments.js`
- **Decision:** `PUT`, `PATCH` and `DELETE` routes exist for ratings only to refuse. Each writes an audit entry with outcome `blocked`, then answers 403.
- **Why:** HR can see who tried to change a rating. Without these routes the request would just get a 404, and the attempt would leave no trace.
- **Trade-off accepted:** A logged-in user could fill the audit log by sending blocked requests over and over. There is no rate limit yet (see Known gaps).

## 4. Workflow rules

### D-17 · Blind manager rating: rate every task before delivery
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/routes/projects.js` (deliver), `server/src/routes/assessments.js`
- **Decision:** A project can be delivered only when every task is submitted and rated by the manager. Once it is delivered, the manager can't rate any more.
- **Why:** The client can rate only after delivery. So the manager always rates before the client's score exists, and he can't copy it or shift his own rating towards it. Two places enforce this: `deliver` counts manager ratings against tasks, and the assessments route refuses if the project is no longer `open`.
- **Trade-off accepted:** The manager can't change his view after seeing how the work turned out for the client. That is the point.

### D-18 · Status flows that only move forward
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/models/Project.js`, `server/src/models/Task.js`, `server/src/routes/tasks.js`
- **Decision:** Project: `open → delivered → rated`. Task: `assigned → in_progress → submitted`. An employee can only take the next step. A manager can only send `submitted` work back to `in_progress` for rework, and only before he has rated it.
- **Why:** Fixed steps are what make the other rules enforceable: no rating before submission, no delivery before rating. Rework is allowed because real work gets sent back. It is blocked after rating so that a rated piece of work can't be swapped for different work.
- **Trade-off accepted:** There is no way to reopen a delivered project or cancel a task.

### D-19 · Work share is fixed at creation and capped at 100%
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/models/Task.js`, `server/src/routes/tasks.js`
- **Decision:** Each task has a `workShare` between 0.01 and 1. It is `immutable`, and all shares in one project must add up to 1 or less, with a tiny tolerance `EPSILON = 1e-9`.
- **Why:** The client rates the whole project, and work share is how that score is split between people (synopsis section 11.2). If shares could change after the client's rating, a manager could shrink a good employee's part of a good score. The tolerance is needed because computers store decimals inexactly: shares of 0.2, 0.4 and 0.3 plus a last 0.1 add up to `1.0000000000000002` in JavaScript, which would wrongly refuse the last 10%.
- **Trade-off accepted:** Work share is the manager's own estimate, so bias can still hide in it. Fixing it early limits this but doesn't check it. A wrong share can't be corrected. Mongoose also ignores a change to an `immutable` field without raising an error, so a mistake gives no warning.

### D-20 · Who owns a project or task can never change
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/models/Project.js`, `server/src/models/Task.js`
- **Decision:** `Project.client`, `Project.manager`, `Task.project`, `Task.manager` and `Task.employee` are `immutable`.
- **Why:** Swapping the manager or employee after ratings exist would attach ratings to the wrong person.
- **Trade-off accepted:** If a manager leaves in the middle of a project, there is no handover. That needs a proper "reassign" feature, recorded in the audit log.

### D-21 · Client rates the whole project, manager rates each task
- **Status:** Done (P-01 proposes a change) · **Date:** 2026-10-22 · **Files:** `server/src/models/ClientRating.js`, `server/src/models/ManagerAssessment.js`
- **Decision:** One client rating per project, one manager rating per task. Both are whole numbers from 1 to 10.
- **Why:** In the first design the client sees only the finished product, not who built which part. Both sides use the same 1 to 10 scale planned in the synopsis, so the two ratings can be compared directly.
- **Trade-off accepted:** This is the biggest weakness of the current build. One project score can't tell team members apart, so comparing per person depends on work share and is only an estimate. P-01 fixes this.

### D-22 · Unique indexes stop double rating
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/models/ClientRating.js`, `server/src/models/ManagerAssessment.js`
- **Decision:** `ClientRating.project` and `ManagerAssessment.task` are `unique`.
- **Why:** The routes check the status first, which catches the normal case. If two requests arrive at the same moment, the database refuses the second one (409 through the error handler).
- **Trade-off accepted:** The tests use mocks (D-31), so this protection is not tested.

## 5. Security and access

### D-23 · No public sign-up; only HR creates accounts
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/routes/users.js`
- **Decision:** `POST /api/users` is for HR only. There is no register route.
- **Why:** With open sign-up, anyone could register as `hr` or `manager` and read or rate everything. In a company, roles are given, not chosen.
- **Trade-off accepted:** HR creates every account by hand. A spreadsheet import is planned.

### D-24 · Role check on every route, ownership check inside it
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/middleware/auth.js`, all route files
- **Decision:** Requests pass `requireAuth` (valid token?) and then `requireRole(...)` (right role?). Inside the handler, `sameId` checks that the record belongs to this user.
- **Why:** Role alone is not enough. A manager must not touch another manager's project.
- **Trade-off accepted:** Each handler does its own ownership check, so a new route has to remember it. The tests cover the existing routes.

### D-25 · Same error for unknown email and wrong password
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/routes/auth.js`, `server/src/models/User.js`
- **Decision:** Login answers `Wrong email or password.` in both cases. `passwordHash` has `select: false`, so it is never read unless the code asks for it, which only login does (`.select('+passwordHash')`).
- **Why:** An attacker can't use the login form to find out which emails exist. The hash can't leak into an API reply by accident.
- **Trade-off accepted:** For an unknown email the reply comes back slightly faster, because no bcrypt check runs. A careful attacker could measure that difference (see Known gaps).

### D-26 · Who can see which rating
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/routes/ratings.js`, `server/src/routes/assessments.js`, `server/src/routes/users.js`
- **Decision:**

  | Record | Who can see it |
  | --- | --- |
  | Client rating | The client who gave it, that project's manager, employees with a task on the project, HR |
  | Manager rating | The manager who gave it, the employee it is about, HR |
  | List of users | Any logged-in user, names and roles only (no emails) |

- **Why:** The employee needs to see the client's rating, because it is her evidence. The manager can see it only after he can no longer rate (D-17). The user list is needed so a client can pick a manager and a manager can pick employees.
- **Trade-off accepted:** Any logged-in user, a client included, can see the names and roles of everyone in the system. Fine for a demo; a real company would limit this.

### D-27 · Every important action goes into the audit log
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/utils/audit.js`, all route files
- **Decision:** After each important action, `audit()` writes one entry: `user.create`, `project.create`, `project.deliver`, `task.create`, `task.<status>`, `assessment.create`, `rating.create`, and every blocked edit. Request bodies are also capped at 100 KB (`express.json({ limit: '100kb' })`).
- **Why:** HR gets a timeline of who did what and when, which is the proof needed if a rating is questioned later.
- **Trade-off accepted:** Logins are not logged. The audit entry is written after the action, not together with it, so if the audit write fails the action is saved but the user sees a 500 error.

### D-28 · No database transactions
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/routes/ratings.js`, `server/src/routes/tasks.js`, `server/src/routes/projects.js`
- **Decision:** Writes that take several steps run one after another, without a transaction.
- **Why:** Transactions need MongoDB running as a replica set. Atlas does, but a plain local install doesn't, and the code would get harder to read. With one manager per project, two clashing requests at the same instant are very unlikely.
- **Trade-off accepted:** Two edge cases. (1) `POST /api/ratings` saves the rating and then marks the project `rated`. If the second step fails, the rating exists but the project still says `delivered`; the unique index still stops a second rating. (2) `POST /api/tasks` reads the used work share and then creates the task, so two requests at the same moment could both pass the check and go over 100%. Fix later with transactions on Atlas.

## 6. Startup and developer experience

### D-29 · Fail fast at startup
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/config/env.js`, `server/src/index.js`, `server/src/config/db.js`
- **Decision:** `required()` throws `Missing X in .env` straight away. `index.js` checks `JWT_SECRET` before connecting. `db.js` gives up after 5 seconds (`serverSelectionTimeoutMS: 5000`) instead of Mongoose's default 30.
- **Why:** A broken `.env` was the most common setup problem (we hit `Missing MONGODB_URI` ourselves). A clear message at once is better than a server that starts and fails on the first request, or hangs for 30 seconds.
- **Trade-off accepted:** On a very slow network, 5 seconds may be too short for Atlas. Raise it if needed. `seed.js` doesn't use this limit yet (see Known gaps).

### D-30 · Demo accounts from a seed script
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/scripts/seed.js`
- **Decision:** `npm run seed` creates five users (HR, client, manager, Priya, Aman) with the password `password123`, and skips any email that already exists.
- **Why:** Anyone can log in and try the full flow at once. Running the script twice is safe.
- **Trade-off accepted:** The password is public. Use it only on a local or test database, never a real one.

### D-31 · Tests run without a database
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/tests/*`
- **Decision:** Route tests replace the models with `jest.mock` fakes. `locks.test.js` uses the real models, because the lock hooks throw before any database call. `tests/setup.js` sets a test `JWT_SECRET` and turns off Mongoose's command buffering, so an accidental database call fails at once instead of hanging.
- **Why:** All 88 tests run in a few seconds on any laptop, with no MongoDB and no internet. The alternative, `mongodb-memory-server`, downloads a full MongoDB program, which is slow on college Wi-Fi and unreliable on Windows.
- **Trade-off accepted:** The tests don't prove real database behaviour: unique indexes, the real query filters and Mongoose's actual talk with MongoDB are not tested. Bugs there would show only against a real database. A few integration tests against a test database would close this gap.

### D-32 · `validate()` instead of `validateSync()` in tests
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/tests/locks.test.js`
- **Decision:** Tests check schema rules with `await doc.validate()`.
- **Why:** `validateSync()` printed Mongoose deprecation warnings in every test run, which hid real problems in the output.
- **Trade-off accepted:** None.

### D-33 · `requests.http` passes tokens and ids along by itself
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/requests.http`
- **Decision:** Each request is named (`# @name clientLogin`), and later requests read values from earlier replies, such as `{{clientLogin.response.body.$.token}}`.
- **Why:** Copying tokens by hand caused 401 errors during setup. Now all 14 steps run top to bottom with nothing to copy.
- **Trade-off accepted:** It only works in VS Code with the REST Client extension, and the steps must be run in order.

---

## Known gaps (left on purpose for now)

| Gap | What could go wrong | Fix later |
| --- | --- | --- |
| No rate limit on login or blocked routes | Password guessing; audit log spam | `express-rate-limit` |
| Unknown email answers faster (D-25) | Someone could find out which emails exist | Always run one bcrypt check |
| `seed.js` has no 5 s timeout | Waits 30 s on a wrong address | Reuse `connectDB` from `config/db.js` |
| List routes return everything | Slow with a lot of data | Add `limit` and paging |
| Role change waits for token expiry (D-03) | Old role works for up to 2 hours | Check the user's role in the database on sensitive routes |
| Lock is enforced by our code only (D-13) | A database admin can still edit | Database permissions or hashed records |
| No transactions (D-28) | Rare inconsistent states | Transactions on Atlas |
| Tests never touch a real database (D-31) | Database-level bugs go unseen | A few integration tests |
| Changes to immutable fields are silently ignored (D-19) | A mistake gives no warning | Refuse such changes with a clear error |

## Planned (agreed in the synopsis, not built yet)

### PL-01 · Frontend: React + Vite + Tailwind CSS + Recharts
- **Why:** React is the MERN standard, Vite is the fastest way to start a React app (the CORS default already points at Vite's port 5173), Tailwind keeps styling in the same file as the page, and Recharts draws the rating charts.
- **Trade-off:** Another app to build and run alongside the API.

### PL-02 · ML as a separate Python service (FastAPI)
- **Why:** pandas and scikit-learn are Python. A separate service keeps the API working even when the ML part is down, and it is not exposed to the public.
- **Trade-off:** Two servers to run and connect.

### PL-03 · Z-score gap analysis first
- **Decision:** For each manager–employee pair, measure how unusual the gap between manager and client ratings is compared with that manager's normal gap. A value above 2 or below −2 counts as unusual, and only pairs with at least 10 rated pieces of work are checked.
- **Why:** Easy to explain to HR and examiners, and it works with little data. This is the minimum ML deliverable.
- **Trade-off:** 10 is a small sample, and the method assumes gaps are spread in a roughly normal way.

### PL-04 · Isolation Forest second
- **Why:** Finds unusual pairs using several features together, with no labelled "biased" examples needed.
- **Trade-off:** Harder to explain than a z-score, and it will be tested only on made-up data.

### PL-05 · Sentiment check on feedback text (optional)
- **Decision:** DistilBERT, with TF-IDF + Logistic Regression as a lighter fallback.
- **Why:** Spots feedback whose tone doesn't match its score.
- **Trade-off:** The model may be too slow on free hosting. It is the first feature to drop if the project falls behind.

## Proposed (from the Problem and USP doc, waiting for a yes)

### P-01 · The client rates each accepted piece of work, not the whole project
- **Why:** Removes the guesswork of D-21. Each rating is about one person's work.
- **Trade-off:** More ratings for the client to give, and the database design changes. If accepted, it **replaces D-21** and must be built before the frontend.

### P-02 · 1 to 5 stars on both sides, instead of 1 to 10
- **Why:** Everyone already knows 5 stars from food and taxi apps, so it is faster and needs no explanation.
- **Trade-off:** Fewer steps on the scale, so the gap analysis gets less detail.

### P-03 · The client rates through a one-time link, with no account
- **Why:** A client won't create an account just to give a rating.
- **Trade-off:** Anyone holding the link can rate, so each link must work once, expire, and be tied to one piece of work.

### P-04 · Work share only when several people built one piece of work together
- **Why:** With per-piece ratings (P-01), most work has one owner, so splitting is rarely needed.
- **Trade-off:** Two ways of linking ratings to people, which makes the code a little more complex. Changes D-19.

---

## Template for new entries

```
### D-xx · Short title
- **Status:** Done · **Date:** YYYY-MM-DD · **Files:** path/to/file.js
- **Decision:** What we chose.
- **Why:** The reason.
- **Instead of:** What else we could have done, and why we didn't.
- **Trade-off accepted:** What we gave up.
```
