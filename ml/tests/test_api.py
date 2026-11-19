from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def body(**settings):
    pairs = []
    for employee, (m, c) in {"aman": (4, 4), "kabir": (4, 4), "isha": (4, 4), "priya": (2, 4)}.items():
        pairs += [{"managerId": "rahul", "employeeId": employee, "managerScore": m, "clientScore": c} for _ in range(12)]
    return {"pairs": pairs, **({"settings": settings} if settings else {})}


def test_health():
    assert client.get("/health").json()["ok"] is True


def test_analyze_returns_one_result_per_pair():
    res = client.post("/analyze", json=body())
    assert res.status_code == 200
    pairs = {p["employeeId"]: p for p in res.json()["pairs"]}
    assert set(pairs) == {"aman", "kabir", "isha", "priya"}
    assert pairs["priya"]["flagged"] is True
    assert pairs["priya"]["direction"] == "lower"


def test_settings_are_used():
    res = client.post("/analyze", json=body(minPair=20))  # only 12 pieces each, so nobody is judged
    assert not any(p["eligible"] or p["flagged"] for p in res.json()["pairs"])


def test_scores_outside_1_to_5_are_refused():
    bad = body()
    bad["pairs"][0]["clientScore"] = 9
    assert client.post("/analyze", json=bad).status_code == 422


def test_unknown_fields_are_refused():
    bad = body()
    bad["pairs"][0]["extra"] = 1
    assert client.post("/analyze", json=bad).status_code == 422


def test_empty_input_is_fine():
    res = client.post("/analyze", json={"pairs": []})
    assert res.status_code == 200 and res.json()["pairs"] == []


def test_api_key_is_checked_when_set(monkeypatch):
    monkeypatch.setenv("ML_API_KEY", "s3cret")
    assert client.post("/analyze", json=body()).status_code == 401
    assert client.post("/analyze", json=body(), headers={"x-api-key": "wrong"}).status_code == 401
    assert client.post("/analyze", json=body(), headers={"x-api-key": "s3cret"}).status_code == 200
