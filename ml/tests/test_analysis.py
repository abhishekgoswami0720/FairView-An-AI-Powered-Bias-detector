import numpy as np

from app.analysis import Pair, Settings, analyse, gap_z


def team(manager="m1", employees=None, score=(4, 4), n=12):
    """n pieces of work for each employee, all with the same (manager stars, client stars)."""
    employees = employees or {}
    pairs = []
    for employee, (m, c) in employees.items():
        pairs += [Pair(manager, employee, m, c) for _ in range(n)]
    return pairs


def by_employee(results):
    return {r["employeeId"]: r for r in results}


def test_under_rated_employee_is_flagged_lower():
    # Clients give everyone 4 stars. The manager agrees for three people but gives Priya 2.
    pairs = team(employees={"aman": (4, 4), "kabir": (4, 4), "isha": (4, 4), "priya": (2, 4)})
    r = by_employee(analyse(pairs))
    assert r["priya"]["flagged"] is True
    assert r["priya"]["direction"] == "lower"
    assert r["priya"]["z"] < -2.5
    assert r["aman"]["flagged"] is False


def test_over_rated_employee_is_flagged_higher():
    pairs = team(employees={"a": (3, 3), "b": (3, 3), "c": (3, 3), "fav": (5, 3)})
    r = by_employee(analyse(pairs))
    assert r["fav"]["flagged"] and r["fav"]["direction"] == "higher"


def test_strict_manager_with_everyone_is_not_flagged():
    # He gives everyone 1 star less than clients. That is calibration's job, not a Gap Card.
    pairs = team(employees={"a": (3, 4), "b": (3, 4), "c": (3, 4), "d": (3, 4)})
    assert not any(r["flagged"] for r in analyse(pairs))


def test_flagged_colleague_is_left_out_of_the_comparison():
    # One favourite with a +2 gap must not make the fair colleagues look under-rated.
    pairs = team(employees={"a": (4, 4), "b": (4, 4), "c": (4, 4), "fav": (5, 3)})
    r = by_employee(analyse(pairs))
    assert r["fav"]["flagged"]
    for name in ("a", "b", "c"):
        assert not r[name]["flagged"], name
        assert r[name]["leftOutOfComparison"] == 1


def test_too_little_data_is_never_judged():
    pairs = team(employees={"a": (4, 4), "priya": (1, 5)}, n=9)  # 9 < min_pair of 10
    for r in analyse(pairs):
        assert r["eligible"] is False and r["flagged"] is False and r["z"] is None


def test_needs_other_employees_to_compare_with():
    # Only one employee: there is nothing to compare the manager with, so no judgement.
    r = analyse(team(employees={"priya": (1, 5)}, n=30))[0]
    assert r["eligible"] is False and r["restN"] == 0


def test_identical_gaps_do_not_divide_by_zero():
    z = gap_z(np.array([1.0] * 10), np.array([0.0] * 10))
    assert np.isfinite(z) and z > 0


def test_settings_are_respected():
    pairs = team(employees={"a": (4, 4), "b": (4, 4), "c": (3, 4)})
    strict = by_employee(analyse(pairs, Settings(threshold=50)))
    assert not strict["c"]["flagged"]
    lenient = by_employee(analyse(pairs, Settings(min_pair=20)))
    assert not lenient["c"]["eligible"]


def test_pattern_score_needs_enough_pairs_and_is_between_0_and_1():
    few = analyse(team(employees={"a": (4, 4), "b": (4, 4)}))
    assert all(r["patternScore"] is None for r in few)

    rng = np.random.default_rng(0)
    pairs = []
    for e in range(8):
        for _ in range(12):
            c = int(rng.integers(3, 6))
            pairs.append(Pair("m1", f"e{e}", c, c))
    pairs += [Pair("m1", "odd", 1, 5) for _ in range(12)]
    results = by_employee(analyse(pairs))
    scores = [r["patternScore"] for r in results.values()]
    assert all(s is not None and 0 < s <= 1 for s in scores)
    assert results["odd"]["patternScore"] == max(scores)


def test_results_are_repeatable():
    pairs = team(employees={"a": (4, 4), "b": (3, 4), "c": (4, 3), "d": (2, 4), "e": (4, 4), "f": (5, 4)})
    assert analyse(pairs) == analyse(pairs)
