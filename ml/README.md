# FairView ML service

Compares managers' ratings with clients' ratings of the same work and finds manager-employee pairs that are unusual. Only the FairView API calls it; never expose it to the internet.

## Run

Python 3.10 or newer.

```bash
cd ml
python -m venv .venv
.venv\Scripts\activate              # Windows   (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

Set the same `ML_API_KEY` here (as an environment variable) and in `server/.env`, and `ML_URL=http://localhost:8000` in `server/.env`. Without `ML_API_KEY` the service accepts every call.

```bash
# Windows PowerShell
$env:ML_API_KEY="the-same-value-as-in-server-env"; uvicorn app.main:app --port 8000
# macOS/Linux
ML_API_KEY=the-same-value-as-in-server-env uvicorn app.main:app --port 8000
```

## API

`GET /health` → `{ "ok": true }`

`POST /analyze` (header `x-api-key` when `ML_API_KEY` is set)

```json
{
  "pairs": [{ "managerId": "m1", "employeeId": "e1", "managerScore": 2, "clientScore": 5 }],
  "settings": { "minPair": 10, "minRest": 10, "threshold": 2.5 }
}
```

One row per piece of work rated by both sides. The answer has one result per manager-employee pair: `n`, `managerAvg`, `clientAvg`, `meanGap`, `restN`, `restMeanGap`, `z`, `eligible`, `flagged`, `direction` (`lower` or `higher`) and `patternScore`.

## The method, in plain words

For each piece of work, **gap = manager stars − client stars**.

1. **z-score (raises the Gap Card).** For one manager and one employee, compare the average gap with the same manager's average gap for his other employees. A manager who is strict with everyone is not flagged; a manager who is strict with one person is. A pair needs 10 rated pieces of work, and the manager 10 more with other people. A card appears at |z| ≥ 2.5. If one colleague is strongly flagged, they are left out of the others' comparison and everything is worked out again, so one favourite can't make the whole team look under-rated.
2. **Isolation Forest (ranks cards, never raises one).** Scores how unusual each pair's pattern is compared with every other pair in the company, from six numbers. About 0.5 is ordinary; clearly higher is unusual.

Details and the reasons for each choice: `app/analysis.py` and [../Decision.md](../Decision.md) (D-52 to D-55).

## Tests and evaluation

```bash
pip install -r requirements-dev.txt
python -m pytest             # 19 tests
python -m sim.evaluate       # a few minutes; writes reports/evaluation.md and .csv
```

`sim/simulate.py` makes up companies where we know which pairs are biased. `sim/evaluate.py` measures precision, recall and false alarms for the z-score, a naive "gap of 1 star" rule and Isolation Forest alone. Results: [reports/evaluation.md](reports/evaluation.md). This shows the method works on made-up data; only a pilot can show how it does on real companies.
