# FairView: An AI-Powered Bias Detector for Employee Performance Evaluation

AIML mini project, GLA University. Abhishek Goswami (12515500018), Team ID 123.

In most companies the manager who assigns work also gives the performance rating, and nobody checks it independently. FairView adds a second rating from the client who receives the work. The manager cannot edit the client's rating, and an ML module compares the two to flag managers whose ratings keep differing from the client's for particular employees. Flags go to HR for review; the system does not take any action on its own.

## Roles

| Role | What they do |
| --- | --- |
| Client | Creates projects and rates the delivered work |
| Manager | Splits projects into tasks, assigns them with a work share, rates each task before delivery |
| Employee | Works on tasks, submits work, sees client ratings |
| HR | Creates accounts and reviews flagged cases |

## Status (week 3 of 12)

- [x] Requirements, database design, API list
- [x] Backend: login and roles, projects and tasks, locked ratings, audit log ([server/](server/))
- [x] Backend tests (88 passing)
- [ ] React frontend (weeks 4-5)
- [ ] Synthetic dataset and survey (week 6)
- [ ] Z-score gap analysis (week 7)
- [ ] Python ML service and Isolation Forest (weeks 8-9)
- [ ] Sentiment check on feedback (week 10, optional)
- [ ] Testing, report and demo (weeks 11-12)

## Tech stack

- Frontend: React, Tailwind CSS, Recharts
- Backend: Node.js, Express, JWT, bcrypt
- Database: MongoDB (Mongoose)
- ML service: Python, FastAPI, scikit-learn, pandas, NumPy
- Testing: Jest, Supertest

## Structure

```
server/   Express API (done)
client/   React frontend (next)
ml/       Python ML service (planned)
docs/     project synopsis
```

## Running the backend

See [server/README.md](server/README.md).

## Limitations

- A rating gap does not prove bias. The manager may know about problems the client did not see, so flags are only for review.
- Bias in how tasks are assigned (easier work for favourites) is not detected.
- The client rates a whole project, so per-employee comparison uses the work share and is an approximation.
- The ML module will be tested on synthetic data, which shows the method works but not how it performs on real company data.

## Synopsis

[docs/FairView_Project_Synopsis.pdf](docs/FairView_Project_Synopsis.pdf)
