from dataclasses import replace

import numpy as np

from app.analysis import analyse
from sim.simulate import CompanyConfig, simulate_company


def test_simulated_company_has_the_requested_shape():
    cfg = CompanyConfig(managers=2, employees_per_manager=3, pieces_per_employee=5)
    company = simulate_company(np.random.default_rng(1), cfg)
    assert len(company.pairs) == 2 * 3 * 5
    assert all(1 <= p.manager_score <= 5 and 1 <= p.client_score <= 5 for p in company.pairs)


def test_detector_finds_most_strong_bias_with_few_false_alarms():
    # A quick version of sim/evaluate.py: 20 companies, 20 pieces of work, bias of 1.5 stars.
    rng = np.random.default_rng(42)
    cfg = replace(CompanyConfig(), pieces_per_employee=20, bias_size=1.5)
    tp = fp = fn = tn = 0
    for _ in range(20):
        company = simulate_company(rng, cfg)
        for r in analyse(company.pairs):
            if not r["eligible"]:
                continue
            biased = (r["managerId"], r["employeeId"]) in company.biased
            tp += r["flagged"] and biased
            fp += r["flagged"] and not biased
            fn += biased and not r["flagged"]
            tn += not biased and not r["flagged"]
    assert tp / (tp + fn) > 0.8          # recall
    assert tp / (tp + fp) > 0.75         # precision
    assert fp / (fp + tn) < 0.06         # false alarm rate
