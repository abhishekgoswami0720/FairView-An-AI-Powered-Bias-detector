# FairView

**Every rating gets a second witness.**

In most IT services companies, one manager's memory decides an engineer's yearly rating, and nobody checks it. The client who accepted the work every sprint is never asked. FairView asks them, in 10 seconds, at the moment they accept each piece of work, and compares that with the manager's own rating of the same work.

Started as an AIML mini project at GLA University (Abhishek Goswami, 12515500018, Team ID 123) and built to become a product.

## How it works

1. **The employee submits work**, the way she already does.
2. **The manager rates it first, blind**, 1 to 5 stars, before the client has seen it. Then he delivers it.
3. **The client gets an email link and taps 1 to 5 stars.** No account, no password, about 10 seconds.
4. **Both ratings are locked.** Nobody can change or delete them, HR included. Every attempt is logged.
5. **The ML service compares the two ratings** for every manager-employee pair. When one manager keeps rating one person far from what clients see, and differently from how he rates his other people, HR gets a **Gap Card**: "worth a look", never a verdict.

## What's in this repository

| Folder | What it is | Stack |
| --- | --- | --- |
| [`client/`](client/) | Web app for HR, managers and employees, plus the client's rating page | React, Vite, Tailwind CSS, Recharts |
| [`server/`](server/) | API: rules, locked ratings, rating links, invites, audit log | Node.js, Express, MongoDB (Mongoose) |
| [`ml/`](ml/) | Gap analysis: z-score and Isolation Forest, simulator and evaluation | Python, FastAPI, scikit-learn |
| [`docs/`](docs/) | Project synopsis (version 1 design) | |

## Run it on your laptop

You need Node.js 20+, Python 3.10+ and a MongoDB Atlas database (the free tier works).

```bash
# 1. ML service (terminal 1)
cd ml
python -m venv .venv
.venv\Scripts\activate          # Windows   (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --port 8000

# 2. API (terminal 2)
cd server
npm install
copy .env.example .env          # Windows   (macOS/Linux: cp .env.example .env), then fill it in
npm run seed -- --reset         # demo company; WIPES the database in MONGODB_URI
npm run dev                     # http://localhost:5000

# 3. Web app (terminal 3)
cd client
npm install
npm run dev                     # open http://localhost:5173
```

Log in with password `password123`:

| Who | Email | What to look at |
| --- | --- | --- |
| HR | `hr@fairview.test` | Overview, two Gap Cards (Rahul and Priya, Sara and Arjun), People, Audit log |
| Manager | `rahul@fairview.test` | Review work: rate and send to the client; My team |
| Employee | `priya@fairview.test` | My work, My record |
| Client | no login | Open `http://localhost:5173/dev/outbox` and click "Open as the client" |

Each part's README has the details: [server](server/README.md), [ml](ml/README.md), [client](client/README.md).

## Tests

```bash
cd server && npm test          # 146 tests against an in-memory MongoDB (first run downloads it)
cd ml && pip install -r requirements-dev.txt && python -m pytest    # 19 tests
cd ml && python -m sim.evaluate                                     # detector accuracy on made-up companies
```

Latest evaluation: [ml/reports/evaluation.md](ml/reports/evaluation.md). With 15 rated pieces of work per pair and a bias of 1 star, about 8 in 10 Gap Cards point at a really biased pair and about 8 in 10 biased pairs are found. That is on synthetic data, not real companies.

## Project docs

- [Decision.md](Decision.md): every design decision, why it was made, and what was given up for it
- [flow.md](flow.md): how the code runs, from the first command to the reply, and which function calls which
- [docs/FairView_Project_Synopsis.pdf](docs/FairView_Project_Synopsis.pdf): the submitted synopsis. Version 2 changes its design: the client now rates each piece of work (not the whole project), both sides use 1 to 5 stars, and the client rates through an email link instead of logging in. See Decision.md D-34 onwards.

## Limitations

- **A gap is not proof of bias.** The manager may know things the client doesn't. Cards are for HR to ask, not to act on alone.
- **Clients have to rate.** With too few client ratings there is nothing to compare; HR's overview shows the share rated and warns below 40%.
- **Who gets which work is not checked.** A manager who gives his favourite the easy, visible work is not caught.
- **The detector is tested on made-up data only.** A pilot with a real company is the real test.
- More in [Decision.md, Known gaps](Decision.md#known-gaps-left-on-purpose-for-now).
