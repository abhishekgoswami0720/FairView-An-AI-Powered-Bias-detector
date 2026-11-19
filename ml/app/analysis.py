"""FairView gap analysis.

Input: one row per piece of work that BOTH the manager and the client rated (1-5 stars).
For each piece of work:      gap = manager stars - client stars

Step 1, z-score (decides when a Gap Card is raised)
    For each manager-employee pair, compare the average gap for that employee with the
    same manager's average gap for his other employees:

        z = (mean gap for this employee - mean gap for his other employees)
            / standard error of that difference

    Comparing a manager with himself cancels out a manager who is simply strict or
    generous with everyone (that is calibration's job, not ours). What is left is a
    manager who treats ONE person differently from how clients see that person's work.

    Two refinements, both chosen from the synthetic evaluation (reports/evaluation.md):
      - Round by round (up to 3 rounds), the most extreme flagged employee of each
        manager is left out of his colleagues' comparison group and the z-scores are
        worked out again. Otherwise one person the manager favours makes everyone else
        in the team look under-rated.
      - The default threshold is |z| >= 2.5, not the 2 planned in the synopsis. At 2, about
        3 in 10 cards were false alarms; at 2.5, about 2 in 10, at the cost of missing more
        of the weaker biases (see reports/evaluation.md).

Step 2, Isolation Forest (only ranks cards, never raises one)
    Looks at several numbers per pair at once and scores how unusual the pair's pattern
    is compared with every other pair in the company. Score from 0 to 1: about 0.5 or
    below is ordinary, clearly above 0.5 is unusual. It is shown on the card and used to
    sort cards, because it is harder to explain than the z-score.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from math import sqrt

import numpy as np
from sklearn.ensemble import IsolationForest

# The smallest spread (in stars) assumed for any group of gaps. Without it, a pair whose
# gaps are all identical would have a spread of 0 and an infinite z-score.
STD_FLOOR = 0.5
MAX_ROUNDS = 3
# Isolation Forest needs a few pairs to compare against before its score means anything.
MIN_PAIRS_FOR_FOREST = 6
FOREST_TREES = 200
BIG_GAP = 2  # a gap of 2 or more stars on one piece of work


@dataclass(frozen=True)
class Settings:
    min_pair: int = 10       # rated pieces of work needed for the pair
    min_rest: int = 10       # rated pieces of work the manager gave his other employees
    threshold: float = 2.5   # |z| at or above this raises a Gap Card


@dataclass(frozen=True)
class Pair:
    manager_id: str
    employee_id: str
    manager_score: int
    client_score: int


Key = tuple[str, str]  # (manager id, employee id)


def _std(values: np.ndarray) -> float:
    return float(values.std(ddof=1)) if len(values) > 1 else 0.0


def gap_z(pair_gaps: np.ndarray, rest_gaps: np.ndarray, floor: float = STD_FLOOR) -> float:
    """Welch-style z-score for the difference between two average gaps."""
    s1 = max(_std(pair_gaps), floor)
    s2 = max(_std(rest_gaps), floor)
    se = sqrt(s1**2 / len(pair_gaps) + s2**2 / len(rest_gaps))
    return float((pair_gaps.mean() - rest_gaps.mean()) / se)


def _r(x: float | None, digits: int = 3) -> float | None:
    return None if x is None else round(float(x), digits)


def _z_round(gaps: dict[Key, np.ndarray], by_manager: dict[str, list[Key]], s: Settings, excluded: set[Key]) -> dict[Key, dict]:
    stats: dict[Key, dict] = {}
    for key, own in gaps.items():
        if len(own) < s.min_pair:
            continue
        others = [k for k in by_manager[key[0]] if k != key]
        clean = [k for k in others if k not in excluded]
        # Keep left-out colleagues in if leaving them out would leave too little to compare with.
        use = clean if sum(len(gaps[k]) for k in clean) >= s.min_rest else others
        rest = np.concatenate([gaps[k] for k in use]) if use else np.array([], float)
        if len(rest) < s.min_rest:
            continue
        stats[key] = {"z": gap_z(own, rest), "rest": rest, "leftOut": len(others) - len(use)}
    return stats


def _z_scores(gaps: dict[Key, np.ndarray], by_manager: dict[str, list[Key]], s: Settings) -> dict[Key, dict]:
    """z-score for every pair with enough data.

    Each round, the most extreme flagged pair of each manager is left out of his other
    employees' comparison group, and everything is worked out again. This stops one
    strongly biased pair from making the rest of the team look biased the other way.
    """
    excluded: set[Key] = set()
    stats = _z_round(gaps, by_manager, s, excluded)
    for _ in range(MAX_ROUNDS):
        added = False
        for keys in by_manager.values():
            flagged = [k for k in keys if k in stats and k not in excluded and abs(stats[k]["z"]) >= s.threshold]
            if flagged:
                excluded.add(max(flagged, key=lambda k: abs(stats[k]["z"])))
                added = True
        if not added:
            break
        stats = _z_round(gaps, by_manager, s, excluded)
    return stats


def analyse(pairs: list[Pair], settings: Settings = Settings()) -> list[dict]:
    """Returns one result per manager-employee pair (camelCase keys, ready for JSON)."""
    groups: dict[Key, dict[str, list[int]]] = defaultdict(lambda: {"m": [], "c": []})
    for p in pairs:
        g = groups[(p.manager_id, p.employee_id)]
        g["m"].append(p.manager_score)
        g["c"].append(p.client_score)

    gaps = {k: np.array(g["m"], float) - np.array(g["c"], float) for k, g in groups.items()}
    by_manager: dict[str, list[Key]] = defaultdict(list)
    for key in groups:
        by_manager[key[0]].append(key)
    z_stats = _z_scores(gaps, by_manager, settings)

    results = []
    for key, g in groups.items():
        own = gaps[key]
        all_rest = [gaps[k] for k in by_manager[key[0]] if k != key]
        st = z_stats.get(key)
        rest = st["rest"] if st else (np.concatenate(all_rest) if all_rest else np.array([], float))
        result = {
            "managerId": key[0],
            "employeeId": key[1],
            "n": int(len(own)),
            "managerAvg": _r(np.mean(g["m"])),
            "clientAvg": _r(np.mean(g["c"])),
            "meanGap": _r(own.mean()),
            "gapStd": _r(_std(own)),
            "bigGapShare": _r(float(np.mean(np.abs(own) >= BIG_GAP))),
            "restN": int(len(rest)),
            "restMeanGap": _r(rest.mean()) if len(rest) else None,
            "leftOutOfComparison": st["leftOut"] if st else 0,
            "z": None,
            "eligible": False,
            "flagged": False,
            "direction": None,
            "patternScore": None,
        }
        if st:
            z = st["z"]
            result.update(
                z=_r(z),
                eligible=True,
                flagged=abs(z) >= settings.threshold,
                direction="lower" if z < 0 else "higher" if z > 0 else None,
            )
        results.append(result)

    _add_pattern_scores(results, settings)
    return results


def _features(r: dict) -> list[float]:
    relative = r["meanGap"] - (r["restMeanGap"] if r["restMeanGap"] is not None else 0.0)
    return [r["meanGap"], relative, r["gapStd"], r["bigGapShare"], r["managerAvg"], r["clientAvg"]]


def _add_pattern_scores(results: list[dict], settings: Settings) -> None:
    candidates = [r for r in results if r["n"] >= settings.min_pair]
    if len(candidates) < MIN_PAIRS_FOR_FOREST:
        return
    X = np.array([_features(r) for r in candidates], float)
    forest = IsolationForest(n_estimators=FOREST_TREES, random_state=0).fit(X)
    # score_samples is minus the anomaly score from the original paper (0..1, 0.5 = ordinary).
    scores = -forest.score_samples(X)
    for r, s in zip(candidates, scores):
        r["patternScore"] = _r(s)
