# FairView: Decision Log

This file records every meaningful decision made while writing FairView's code: what was chosen, why, what else was possible, and what we gave up. The synopsis promises that "each decision and its reason will be recorded and shared with the mentor". This file is that record.

**Rules for this file**

1. Every code change that involves a real choice (a library, a rule, a trade-off) gets an entry here in the same commit.
2. Old entries are never deleted. If a decision changes, mark the old entry **Replaced by D-xx** and add a new one.
3. Entries D-01 to D-33 were written on 17 Nov 2026, after the first backend was built (22 Oct 2026). They were rebuilt from the code, its comments, the synopsis and our design notes. Entries from D-34 on were written at the time of the change.

**Status:** Done = in the code · Planned = agreed in the synopsis, not built yet · Proposed = suggested, waiting for a yes · Replaced = no longer true

How code moves between files is explained in [flow.md](flow.md).

## Index

| ID | Decision | Status |
| --- | --- | --- |
| D-01 | Node.js + Express 5 for the API | Done |
| D-02 | MongoDB with Mongoose | Done |
| D-03 | JWT login tokens, not sessions | Done (trade-off fixed by D-40) |
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
| D-17 | Blind manager rating: rate every task before delivery | Replaced by D-37 |
| D-18 | Status flows that only move forward | Replaced by D-38 |
| D-19 | Work share is fixed at creation and capped at 100% | Replaced by D-36 |
| D-20 | Who owns a project or task can never change | Done |
| D-21 | Client rates the whole project, manager rates each task | Replaced by D-34 |
| D-22 | Unique indexes stop double rating | Done |
| D-23 | No public sign-up; only HR creates accounts | Replaced by D-44 |
| D-24 | Role check on every route, ownership check inside it | Done |
| D-25 | Same error for unknown email and wrong password | Done (timing gap fixed by D-43) |
| D-26 | Who can see which rating | Replaced by D-45 |
| D-27 | Every important action goes into the audit log | Done (now in the same transaction, D-39) |
| D-28 | No database transactions | Replaced by D-39 |
| D-29 | Fail fast at startup | Done |
| D-30 | Demo accounts from a seed script | Replaced by D-50 |
| D-31 | Tests run without a database | Replaced by D-49 |
| D-32 | `validate()` instead of `validateSync()` in tests | Done |
| D-33 | `requests.http` passes tokens and ids along by itself | Done (rewritten for version 2) |
| D-34 | Client rates each piece of work; 1 to 5 stars on both sides | Done |
| D-35 | ManagerAssessment renamed ManagerRating | Done |
| D-36 | One owner per piece of work; work share removed | Done |
| D-37 | Blind rating per piece: rate, deliver, then the client rates | Done |
| D-38 | New status flows; "rated" is never stored | Done |
| D-39 | Transactions for multi-step writes; replica set required | Done |
| D-40 | The person is loaded from the database on every request | Done |
| D-41 | Many companies from day one | Done |
| D-42 | Clients rate through a signed one-time link | Done |
| D-43 | Login timing guard, rate limits and security headers | Done |
| D-44 | Company sign-up and invites | Done |
| D-45 | Ratings shown to the employee only when both are in | Done |
| D-46 | Rules for the client contact | Done |
| D-47 | Email through any SMTP service, console otherwise | Done |
| D-48 | Input checks instead of Mongoose's sanitizeFilter | Done |
| D-49 | Tests against a real MongoDB replica set | Done |
| D-50 | Demo company with planted biases | Done |
| D-51 | How the gap analysis runs | Done |
| D-52 | z-score method and threshold 2.5 | Done |
| D-53 | Isolation Forest only ranks cards | Done |
| D-54 | ML service contract and API key | Done |
| D-55 | Synthetic evaluation of the detector | Done |
| D-56 | Managers see their own comparison | Done |
| D-57 | How HR reviews a Gap Card | Done |
| D-58 | Client rating rate is HR's headline number | Done |
| D-59 | People are deactivated, never deleted | Done |
| D-60 | List limits instead of paging | Done |
| D-61 | Frontend stack and visual system | Done |
| D-62 | Login token kept in localStorage | Done |
| D-63 | "Rate and send to client" in one step | Done |
| D-64 | The client's page is built for 10 seconds on a phone | Done |
| D-65 | `npm run demo`: a temporary database, no Atlas needed | Done |
| PL-01 to PL-04 | Frontend, ML service, z-score, Isolation Forest | Done (D-51 to D-61) |
| PL-05 | Sentiment check | Deferred |
| P-01 to P-04 | Changes from the Problem and USP doc | P-01 to P-03 accepted, P-04 replaced by D-36 |

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
- **Status:** Done (trade-off fixed by D-40) · **Date:** 2026-10-22 · **Files:** `server/src/routes/auth.js`, `server/src/middleware/auth.js`
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
- **Status:** Done (ManagerAssessment is now ManagerRating, D-35) · **Date:** 2026-10-22 · **Files:** `server/src/models/ClientRating.js`, `ManagerAssessment.js`, `AuditLog.js`
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
- **Status:** Replaced by D-37 · **Date:** 2026-10-22 · **Files:** `server/src/routes/projects.js` (deliver), `server/src/routes/assessments.js`
- **Decision:** A project can be delivered only when every task is submitted and rated by the manager. Once it is delivered, the manager can't rate any more.
- **Why:** The client can rate only after delivery. So the manager always rates before the client's score exists, and he can't copy it or shift his own rating towards it. Two places enforce this: `deliver` counts manager ratings against tasks, and the assessments route refuses if the project is no longer `open`.
- **Trade-off accepted:** The manager can't change his view after seeing how the work turned out for the client. That is the point.

### D-18 · Status flows that only move forward
- **Status:** Replaced by D-38 · **Date:** 2026-10-22 · **Files:** `server/src/models/Project.js`, `server/src/models/Task.js`, `server/src/routes/tasks.js`
- **Decision:** Project: `open → delivered → rated`. Task: `assigned → in_progress → submitted`. An employee can only take the next step. A manager can only send `submitted` work back to `in_progress` for rework, and only before he has rated it.
- **Why:** Fixed steps are what make the other rules enforceable: no rating before submission, no delivery before rating. Rework is allowed because real work gets sent back. It is blocked after rating so that a rated piece of work can't be swapped for different work.
- **Trade-off accepted:** There is no way to reopen a delivered project or cancel a task.

### D-19 · Work share is fixed at creation and capped at 100%
- **Status:** Replaced by D-36 · **Date:** 2026-10-22 · **Files:** `server/src/models/Task.js`, `server/src/routes/tasks.js`
- **Decision:** Each task has a `workShare` between 0.01 and 1. It is `immutable`, and all shares in one project must add up to 1 or less, with a tiny tolerance `EPSILON = 1e-9`.
- **Why:** The client rates the whole project, and work share is how that score is split between people (synopsis section 11.2). If shares could change after the client's rating, a manager could shrink a good employee's part of a good score. The tolerance is needed because computers store decimals inexactly: shares of 0.2, 0.4 and 0.3 plus a last 0.1 add up to `1.0000000000000002` in JavaScript, which would wrongly refuse the last 10%.
- **Trade-off accepted:** Work share is the manager's own estimate, so bias can still hide in it. Fixing it early limits this but doesn't check it. A wrong share can't be corrected. Mongoose also ignores a change to an `immutable` field without raising an error, so a mistake gives no warning.

### D-20 · Who owns a project or task can never change
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/models/Project.js`, `server/src/models/Task.js`
- **Decision:** `Project.client`, `Project.manager`, `Task.project`, `Task.manager` and `Task.employee` are `immutable`.
- **Why:** Swapping the manager or employee after ratings exist would attach ratings to the wrong person.
- **Trade-off accepted:** If a manager leaves in the middle of a project, there is no handover. That needs a proper "reassign" feature, recorded in the audit log.

### D-21 · Client rates the whole project, manager rates each task
- **Status:** Replaced by D-34 · **Date:** 2026-10-22 · **Files:** `server/src/models/ClientRating.js`, `server/src/models/ManagerAssessment.js`
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
- **Status:** Replaced by D-44 · **Date:** 2026-10-22 · **Files:** `server/src/routes/users.js`
- **Decision:** `POST /api/users` is for HR only. There is no register route.
- **Why:** With open sign-up, anyone could register as `hr` or `manager` and read or rate everything. In a company, roles are given, not chosen.
- **Trade-off accepted:** HR creates every account by hand. A spreadsheet import is planned.

### D-24 · Role check on every route, ownership check inside it
- **Status:** Done · **Date:** 2026-10-22 · **Files:** `server/src/middleware/auth.js`, all route files
- **Decision:** Requests pass `requireAuth` (valid token?) and then `requireRole(...)` (right role?). Inside the handler, `sameId` checks that the record belongs to this user.
- **Why:** Role alone is not enough. A manager must not touch another manager's project.
- **Trade-off accepted:** Each handler does its own ownership check, so a new route has to remember it. The tests cover the existing routes.

### D-25 · Same error for unknown email and wrong password
- **Status:** Done (timing gap fixed by D-43) · **Date:** 2026-10-22 · **Files:** `server/src/routes/auth.js`, `server/src/models/User.js`
- **Decision:** Login answers `Wrong email or password.` in both cases. `passwordHash` has `select: false`, so it is never read unless the code asks for it, which only login does (`.select('+passwordHash')`).
- **Why:** An attacker can't use the login form to find out which emails exist. The hash can't leak into an API reply by accident.
- **Trade-off accepted:** For an unknown email the reply comes back slightly faster, because no bcrypt check runs. A careful attacker could measure that difference (see Known gaps).

### D-26 · Who can see which rating
- **Status:** Replaced by D-45 · **Date:** 2026-10-22 · **Files:** `server/src/routes/ratings.js`, `server/src/routes/assessments.js`, `server/src/routes/users.js`
- **Decision:**

  | Record | Who can see it |
  | --- | --- |
  | Client rating | The client who gave it, that project's manager, employees with a task on the project, HR |
  | Manager rating | The manager who gave it, the employee it is about, HR |
  | List of users | Any logged-in user, names and roles only (no emails) |

- **Why:** The employee needs to see the client's rating, because it is her evidence. The manager can see it only after he can no longer rate (D-17). The user list is needed so a client can pick a manager and a manager can pick employees.
- **Trade-off accepted:** Any logged-in user, a client included, can see the names and roles of everyone in the system. Fine for a demo; a real company would limit this.

### D-27 · Every important action goes into the audit log
- **Status:** Done (now saved in the same transaction, D-39) · **Date:** 2026-10-22 · **Files:** `server/src/utils/audit.js`, all route files
- **Decision:** After each important action, `audit()` writes one entry: `user.create`, `project.create`, `project.deliver`, `task.create`, `task.<status>`, `assessment.create`, `rating.create`, and every blocked edit. Request bodies are also capped at 100 KB (`express.json({ limit: '100kb' })`).
- **Why:** HR gets a timeline of who did what and when, which is the proof needed if a rating is questioned later.
- **Trade-off accepted:** Logins are not logged. The audit entry is written after the action, not together with it, so if the audit write fails the action is saved but the user sees a 500 error.

### D-28 · No database transactions
- **Status:** Replaced by D-39 · **Date:** 2026-10-22 · **Files:** `server/src/routes/ratings.js`, `server/src/routes/tasks.js`, `server/src/routes/projects.js`
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
- **Status:** Replaced by D-50 · **Date:** 2026-10-22 · **Files:** `server/src/scripts/seed.js`
- **Decision:** `npm run seed` creates five users (HR, client, manager, Priya, Aman) with the password `password123`, and skips any email that already exists.
- **Why:** Anyone can log in and try the full flow at once. Running the script twice is safe.
- **Trade-off accepted:** The password is public. Use it only on a local or test database, never a real one.

### D-31 · Tests run without a database
- **Status:** Replaced by D-49 · **Date:** 2026-10-22 · **Files:** `server/tests/*`
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

## 7. Version 2: the product rebuild (17 Nov 2026)

Abhishek asked for FairView to be built as a future market product, not only a college project. These decisions came with that rebuild. Each was written when the change was made.

### D-34 · Client rates each piece of work; 1 to 5 stars on both sides
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `server/src/models/ClientRating.js`, `server/src/models/ManagerRating.js` · Replaces D-21, accepts P-01 and P-02
- **Decision:** One client rating per piece of work (not per project). Manager and client both give whole stars from 1 to 5.
- **Why:** Each rating is now about one person's work, so no splitting or guessing is needed. Five stars is a scale every client already knows, and using the same scale on both sides lets the two ratings be compared directly.
- **Instead of:** Keeping one rating per project with work shares (the biggest weakness in version 1).
- **Trade-off accepted:** The client is asked more often, about 10 seconds each time. A 5-step scale holds less detail than 10 steps; the evaluation (D-55) shows the detector still works with it.

### D-35 · ManagerAssessment renamed ManagerRating
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `server/src/models/ManagerRating.js`
- **Decision:** The manager's record is now called ManagerRating, next to ClientRating.
- **Why:** Two names that match make the code and the screens easier to follow.
- **Trade-off accepted:** Data from version 1 does not fit version 2. The demo database has to be reset (`npm run seed -- --reset`).

### D-36 · One owner per piece of work; work share removed
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `server/src/models/Task.js`, `server/src/routes/tasks.js` · Replaces D-19 and P-04
- **Decision:** Every piece of work has exactly one employee, like a Jira ticket's assignee. Work share no longer exists.
- **Why:** With one rating per piece of work (D-34) there is nothing to split. P-04 (work share only for shared work) would have kept two ways of linking ratings to people for a rare case.
- **Trade-off accepted:** Work done by two people is credited to one. Teams should split such work into two pieces.

### D-37 · Blind rating per piece: rate, deliver, then the client rates
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `server/src/services/workflow.js`, `server/src/routes/tasks.js` · Replaces D-17
- **Decision:** A piece of work can be delivered only after the manager has rated it. Delivery creates the client's rating link. Once delivered, the manager can no longer rate it.
- **Why:** Same idea as D-17, now per piece: the client's score cannot exist when the manager rates, so he cannot copy it or lean towards it.
- **Trade-off accepted:** The manager cannot wait to see how the client reacts. That is the point.

### D-38 · New status flows; "rated" is never stored
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `server/src/models/Task.js`, `server/src/models/Project.js`, `server/src/services/views.js` · Replaces D-18
- **Decision:** Work: `assigned → in_progress → submitted → delivered`. The manager can send submitted work back until he rates it. Projects are `active` or `closed`. Whether a piece of work is rated is worked out from the rating records, never saved as a status.
- **Why:** If "rated" were saved in two places, the two could disagree after a failure. The rating record is the only truth.
- **Trade-off accepted:** Lists need one extra lookup to find the ratings.

### D-39 · Transactions for multi-step writes; replica set required
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `server/src/services/workflow.js`, `server/src/services/accounts.js`, `server/src/config/db.js` · Replaces D-28, fixes the D-27 trade-off
- **Decision:** Manager rating, delivery, resending a link, the client's rating and company sign-up each run in a transaction, together with their audit line. Emails are sent only after the transaction is saved. At start-up the server checks that MongoDB is a replica set and stops with a clear message if not.
- **Why:** A half-saved rating (link used up, no rating saved) is the worst failure FairView can have. Putting the audit line in the same transaction means no action is ever saved without its record.
- **Trade-off accepted:** A plain local MongoDB install is not enough; it must run as a replica set (`server/README.md` shows how). Atlas already is one.

### D-40 · The person is loaded from the database on every request
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `server/src/middleware/auth.js` · Fixes the D-03 trade-off
- **Decision:** After checking the token, `requireAuth` reads the person's role, company and active flag from the database. The token now lasts 8 hours (one working day).
- **Why:** When someone leaves or changes role, it takes effect on their very next click, not hours later.
- **Trade-off accepted:** One small database read per request.

### D-41 · Many companies from day one
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `server/src/models/*`, every route
- **Decision:** Every record carries `org`. Every query filters by the logged-in person's company. Asking for another company's record gives 404, the same as a record that doesn't exist.
- **Why:** A product sold to many companies must never mix their data. Adding this later would mean changing every query and migrating every record.
- **Trade-off accepted:** Every new query must remember the company filter. `tests/integration/visibility.test.js` checks this for every kind of record.

### D-42 · Clients rate through a signed one-time link, with no account
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `server/src/services/links.js`, `server/src/services/workflow.js`, `server/src/models/RatingLink.js`, `server/src/scripts/reminders.js` · Accepts P-03
- **Decision:** The link is `<record id>.<signature>`, signed with a key made from `JWT_SECRET`. Nothing secret is stored, so a stolen database cannot be turned into links, and a reminder can rebuild the same link. The link is used up with one conditional update, so two clicks at once save one rating. Input is checked before the link is used up. Links expire after 14 days. Resending revokes the old link (at most 3 links per piece of work). `npm run reminders` sends one reminder after 3 days.
- **Why:** A client will not create an account to give a rating (Problem and USP doc).
- **Instead of:** Client accounts (friction). A random token stored as a hash (reminders would need a new link each time).
- **Trade-off accepted:** Anyone the email is forwarded to can rate. Changing `JWT_SECRET` stops every open link and logs everyone out.

### D-43 · Login timing guard, rate limits and security headers
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `server/src/services/accounts.js`, `server/src/middleware/rateLimits.js`, `server/src/app.js` · Fixes the D-25 gap
- **Decision:** Login always runs one bcrypt check, even for an unknown email. `express-rate-limit`: login 20 per 15 minutes, sign-up 10 per hour, public link pages 100 per 15 minutes, per address. `helmet` adds the standard security headers. `TRUST_PROXY` makes the address correct behind a hosting proxy.
- **Why:** Stops password guessing, link guessing and finding out which emails have accounts.
- **Trade-off accepted:** The counters live in memory: they reset on restart and are not shared between several server copies. A shared store (Redis) is needed when scaling out.

### D-44 · Company sign-up and invites
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `server/src/routes/orgs.js`, `server/src/services/accounts.js`, `server/src/routes/users.js` · Replaces D-23
- **Decision:** `POST /api/orgs` creates only a brand-new company and its first HR admin. HR adds everyone else; each person gets an invite link and chooses their own password. A new invite changes a nonce, which kills older invite links. HR can import a CSV (`name,email,role`, up to 500 rows); each row is added on its own and problems are reported by line number.
- **Why:** HR never knows anyone's password, nobody can join a company or pick a role by themselves, and a company with hundreds of people can start in minutes.
- **Trade-off accepted:** Anyone can create a company, and the sign-up email is not verified yet. Sign-up is rate limited.

### D-45 · Ratings shown to the employee only when both are in
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `server/src/services/views.js` · Replaces D-26
- **Decision:** The employee sees both scores once the client has rated, or once the rating link has run out. Before that, she sees only whether each side has rated. The manager sees his own rating, and the client's once it exists. HR sees everything, including the client's email. Employees never see client emails.
- **Why:** If the employee saw a low manager score first, she could ask the client for a high one. Showing both together keeps the two ratings independent.
- **Trade-off accepted:** The employee may wait up to 14 days to see her manager's score.

### D-46 · Rules for the client contact
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `server/src/routes/projects.js`
- **Decision:** The client email cannot belong to anyone with a FairView account. Only HR can change a project's client contact, and every change is logged with the old and new email. Links already sent keep going to the old contact.
- **Why:** The client is the second witness. A manager must not be able to send the rating link to himself or a colleague.
- **Trade-off accepted:** A manager could still type a friend's personal email when creating a project. HR sees every client contact on the Projects page and on each Gap Card. Checking the client's email domain is a later step.

### D-47 · Email through any SMTP service, console otherwise
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `server/src/services/mailer.js`, `server/src/services/emails.js`, `server/src/routes/dev.js`
- **Decision:** With `SMTP_URL` set, `nodemailer` sends the email (Gmail, Brevo, SendGrid and others all give an SMTP address). Without it, emails are printed in the server terminal and kept in a small in-memory outbox, shown at `/api/dev/outbox` and on the app's `/dev/outbox` page only when `DEV_OUTBOX=true` and never in production. If sending fails, the API answers `emailSent: false` and the link can be resent. `CORS_ORIGIN` now accepts a comma-separated list.
- **Why:** Works with any email provider, and the whole flow can be tried locally without one.
- **Trade-off accepted:** The outbox shows working rating links, so it must never run on a real server. The code refuses to turn it on in production.

### D-48 · Input checks instead of Mongoose's sanitizeFilter
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `server/src/utils/validate.js`
- **Decision:** Every value from a request goes through a small check (`id`, `text`, `email`, `stars`, `oneOf`, `password`) before it reaches a query. An object like `{ "$ne": null }` is refused.
- **Instead of:** Mongoose's `sanitizeFilter` setting, which would also wrap our own `$in` filters and need `mongoose.trusted()` all over the code.
- **Trade-off accepted:** Each route has to use the checks. The tests try injection on login and ids.

### D-49 · Tests against a real MongoDB replica set
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `server/tests/setup/*`, `server/tests/helpers/*`, `server/tests/integration/*` · Replaces D-31
- **Decision:** `mongodb-memory-server` starts a throw-away replica set in memory for the test run; each test file gets its own database. The lock tests in `tests/unit` still run without a database. Inside Jest, the driver is given Node's `os` module directly (`runtimeAdapters`), because its dynamic `import('os')` fails in Jest's sandbox with a misleading "Missing required sub-document 'driver'" error.
- **Why:** Transactions, unique indexes, two clicks at the same moment and company isolation can only be proven against a real database. Mocks would have hidden all of them.
- **Trade-off accepted:** The first test run downloads MongoDB (about 100 MB). The 146 tests take about 10 seconds instead of 3.

### D-50 · Demo company with planted biases
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `server/src/scripts/seed.js` · Replaces D-30
- **Decision:** `npm run seed` creates "Bluepeak Digital": HR, 2 managers, 8 employees, 4 client projects and 108 pieces of work over six months. Rahul quietly under-rates Priya by 1.5 stars and Sara over-rates Arjun by 1.3. A fixed random seed makes the demo identical every time. `--reset` wipes the database first.
- **Why:** Every screen has realistic data, and the analysis has two real patterns to find (it finds both, and nothing else).
- **Trade-off accepted:** `--reset` deletes everything in the configured database. Use it only on a demo database.

### D-51 · How the gap analysis runs
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `server/src/services/analysis.js`, `server/src/models/GapCard.js`, `server/src/routes/gapCards.js`
- **Decision:** The backend collects every piece of work rated by both sides and sends it to the ML service: 3 seconds after a client rating (several ratings in a row cause one run), or when HR presses "Run analysis now". There is at most one open card per manager-employee pair. A card's `snapshot` (the reason it was raised) never changes; its `latest` numbers refresh on every run. A reviewed pair is flagged again only after 5 more ratings. A failed run is saved and shown to HR. There is no backup calculation in Node.
- **Why:** HR always sees why a card exists, the same card does not keep coming back, and the method lives in one place only.
- **Trade-off accepted:** Each run sends the whole company. Fine for thousands of ratings; a very large company needs runs per manager. While the ML service is down, no new cards appear (the Overview says so).

### D-52 · z-score method and threshold 2.5
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `ml/app/analysis.py` · Changes PL-03
- **Decision:** gap = manager stars − client stars. For each pair, the average gap is compared with the same manager's gap for his other employees (Welch-style standard error, spread never assumed below 0.5 stars). A pair needs 10 rated pieces of work, and the manager 10 more with others. Round by round, the most extreme flagged employee of each manager is left out of the colleagues' comparison. A card appears at |z| ≥ 2.5, not the 2 planned in the synopsis.
- **Why:** Comparing a manager with himself ignores a manager who is simply strict or generous with everyone. Leaving out the flagged colleague stops one favourite from making the whole team look under-rated (a real false alarm found while testing). At 2, about 3 in 10 cards were false alarms; at 2.5, about 2 in 10 (D-55).
- **Trade-off accepted:** Small biases are often missed (half a star: about 3 in 10 found at 15 pieces of work). A manager with a single employee cannot be checked.

### D-53 · Isolation Forest only ranks cards
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `ml/app/analysis.py` · Changes PL-04
- **Decision:** Isolation Forest (200 trees, fixed random seed) scores each pair's pattern from six numbers. The score is the anomaly score from the original paper (0 to 1, about 0.5 is ordinary), so it means the same in every company. It needs at least 6 pairs. It sorts cards and is shown on them, but never raises one.
- **Why:** In the evaluation it was precise but found only about a third of biased pairs as a trigger, against about three quarters for the z-score, and it is much harder to explain to HR.
- **Trade-off accepted:** One more number on the card that needs explaining.

### D-54 · ML service contract and API key
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `ml/app/main.py` · Done for PL-02
- **Decision:** FastAPI with `GET /health` and `POST /analyze`. If `ML_API_KEY` is set, every call must send it in `x-api-key`. Unknown fields are refused, scores must be 1 to 5, at most 200,000 rows per call.
- **Why:** Only the backend should talk to it, and bad input should fail loudly.
- **Trade-off accepted:** Without `ML_API_KEY` the service is open, so it must never be reachable from the internet.

### D-55 · Synthetic evaluation of the detector
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `ml/sim/simulate.py`, `ml/sim/evaluate.py`, `ml/reports/evaluation.md`
- **Decision:** A simulator makes up companies where we know which pairs are biased (true quality per employee, strict or generous managers and clients, rating noise, rounding to stars). The evaluation runs 60 companies per setting and reports precision, recall, false alarms and AUC, against a naive "gap of 1 star" rule and Isolation Forest alone.
- **Result:** With 15 rated pieces of work and a bias of 1 star: about 8 in 10 flags are right and about 8 in 10 biased pairs are found, with about 3% false alarms. The naive rule finds only about 4 in 10.
- **Trade-off accepted:** Made-up data shows the method works and how to tune it, not how it performs on real companies. A pilot with real data is the only real test. Numbers move a few points between runs.

### D-56 · Managers see their own comparison
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `server/src/services/views.js` (`teamView`), `client/src/pages/manager/Team.jsx`
- **Decision:** The "My team" page shows each manager his average next to the clients' average, person by person.
- **Why:** He can notice and correct a gap himself before HR has to. A fair manager gets proof that he is fair.
- **Trade-off accepted:** A manager who knows he is compared may move future ratings towards the clients'. That means rating closer to the outside view, which is acceptable.

### D-57 · How HR reviews a Gap Card
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `server/src/routes/gapCards.js`, `client/src/pages/hr/GapCards.jsx`
- **Decision:** HR records one outcome (no issue, discussed with the manager, escalated) and an optional note, once. Cards are never deleted. Cards say "worth a look", and the card page lists what a gap does not prove.
- **Why:** A card is a reason to ask, not a verdict, and what HR did about it stays on record.
- **Trade-off accepted:** A wrong review cannot be edited; a new card can follow after more ratings (D-51).

### D-58 · Client rating rate is HR's headline number
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `server/src/services/views.js` (`overview`), `client/src/pages/hr/Overview.jsx`
- **Decision:** The Overview leads with the share of delivered work that clients rated in the last 90 days, and warns below 40%.
- **Why:** It is FairView's biggest risk (Problem and USP doc): without client ratings there is nothing to compare.
- **Trade-off accepted:** 40% is our own target, not a researched number.

### D-59 · People are deactivated, never deleted
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `server/src/routes/users.js`
- **Decision:** HR can deactivate and reactivate people and change roles, but not delete anyone, and cannot deactivate themselves or drop their own HR role.
- **Why:** Ratings must keep a name. A company must never lock out its last HR admin by mistake.
- **Trade-off accepted:** A data-deletion request (privacy law) needs a separate, careful process later.

### D-60 · List limits instead of paging
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `server/src/routes/*`
- **Decision:** Lists return at most 500 tasks, 200 Gap Cards or the 100 newest audit entries (older ones with `?before=`).
- **Why:** Enough for a pilot, and a big company cannot overload the server.
- **Trade-off accepted:** A big company needs real paging and search.

### D-61 · Frontend stack and visual system
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `client/*` · Done for PL-01
- **Decision:** React 19 with Vite, React Router, Tailwind CSS 4 and Recharts. One typeface, Atkinson Hyperlegible Next, served with the app. The manager's mark is always an indigo square and the client's a teal ring, joined by a line (the gap) on the same 1-5 scale. The Gap Card pages load separately, so the other pages, including the client's, skip the chart library (318 KB instead of 688 KB).
- **Why:** Shape plus colour reads for colour-blind people too. A typeface built for legibility suits a product about fairness, and hosting it ourselves means no third-party request on the client's page.
- **Trade-off accepted:** The app and the API are hosted separately and must agree on `APP_URL`, `CORS_ORIGIN` and `VITE_API_URL`.

### D-62 · Login token kept in localStorage
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `client/src/lib/api.js`
- **Decision:** The app keeps the login token in `localStorage` and sends it in the `Authorization` header.
- **Why:** Simple with the API on a different address, and no cookies means no cross-site request forgery.
- **Trade-off accepted:** A cross-site scripting bug could read the token. React escapes all output and `helmet` sets safe headers; an httpOnly cookie is the stronger option later.

### D-63 · "Rate and send to client" in one step
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `client/src/pages/manager/Review.jsx`
- **Decision:** The manager picks stars, adds an optional comment and presses one button that saves the rating and delivers the work. "Send back for rework" sits next to it.
- **Why:** A rating that is never delivered is useless, so two buttons would only add a step to forget.
- **Trade-off accepted:** To rate now and deliver later, the API still allows it, and such work shows under "Rated, ready to deliver".

### D-64 · The client's page is built for 10 seconds on a phone
- **Status:** Done · **Date:** 2026-11-17 · **Files:** `client/src/pages/Rate.jsx`
- **Decision:** One column, the work's name and who built it, five large stars (a keyboard-accessible radio group), a comment box that appears only after a star is chosen, and a button that says exactly what it sends ("Send 5 stars – Excellent"). Used, replaced and expired links each explain what to do.
- **Why:** The client gains the least from FairView (Problem and USP doc), so their part must cost almost nothing.
- **Trade-off accepted:** No space to explain FairView to the client beyond one line.

### D-65 · `npm run demo`: a temporary database, no Atlas needed
- **Status:** Done · **Date:** 2026-11-20 · **Files:** `server/src/scripts/demo.js`, `server/src/scripts/seed.js`
- **Decision:** `npm run demo` starts a MongoDB replica set inside the server process (`mongodb-memory-server`, already used by the tests), fills it with the demo company and starts the API. Its settings win over `.env`, so the Atlas address is never touched. The seed script now exports `seedDemo()` so both commands share it.
- **Why:** On Abhishek's laptop, Atlas refused the connection (the IP list or a blocked network port). A demo, a viva or a judge's laptop should not depend on a cloud database, an IP list or the venue's Wi-Fi.
- **Instead of:** Asking everyone who runs the demo to set up Atlas or install MongoDB.
- **Trade-off accepted:** Everything is deleted when the demo stops, and the first run downloads MongoDB (about 100 MB). Real use still needs `npm run dev` with a real database.

---

## Known gaps (left on purpose for now)

| Gap | What could go wrong | Status |
| --- | --- | --- |
| No rate limit on login or blocked routes | Password guessing; audit log spam | Fixed (D-43) |
| Unknown email answers faster (D-25) | Someone could find out which emails exist | Fixed (D-43) |
| `seed.js` has no 5 s timeout | Waits 30 s on a wrong address | Fixed: the seed uses `connectDB` |
| Role change waits for token expiry (D-03) | Old role works for hours | Fixed (D-40) |
| No transactions (D-28) | Rare inconsistent states | Fixed (D-39) |
| Tests never touch a real database (D-31) | Database-level bugs go unseen | Fixed (D-49) |
| Lists have limits, not paging (D-60) | A big company cannot see everything | Open |
| Lock is enforced by our code only (D-13) | A database admin can still edit | Open: database permissions or hashed records |
| Changes to immutable fields are silently ignored | A mistake gives no warning | Open |
| Rate-limit counters are per server (D-43) | Limits weaker with several servers | Open: shared store when scaling |
| Sign-up email not verified (D-44) | Fake companies | Open |
| Client contact could be a friend's email (D-46) | A manager rates through someone he knows | Open: domain checks, HR review of contacts |
| Forwarded rating links (D-42) | Someone other than the client rates | Open |
| No data-deletion process (D-59) | Privacy requests | Open |

## Planned (from the synopsis)

| ID | Plan | Status |
| --- | --- | --- |
| PL-01 | Frontend: React + Vite + Tailwind + Recharts | Done (D-61 to D-64) |
| PL-02 | ML as a separate Python service (FastAPI) | Done (D-54) |
| PL-03 | Z-score gap analysis first | Done, threshold changed to 2.5 (D-52) |
| PL-04 | Isolation Forest second | Done, as a ranking only (D-53) |
| PL-05 | Sentiment check on feedback text (DistilBERT, TF-IDF fallback) | Deferred: the first feature to drop in the synopsis, and the core loop matters more |

## Proposed (from the Problem and USP doc)

| ID | Proposal | Outcome |
| --- | --- | --- |
| P-01 | The client rates each piece of work | Accepted (D-34) |
| P-02 | 1 to 5 stars on both sides | Accepted (D-34) |
| P-03 | One-time rating link, no client account | Accepted (D-42) |
| P-04 | Work share only for shared work | Replaced: one owner per piece of work (D-36) |

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
