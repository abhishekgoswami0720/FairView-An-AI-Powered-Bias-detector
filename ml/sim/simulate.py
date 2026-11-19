"""Makes up realistic companies where we KNOW which managers are unfair to whom,
so we can measure how often the gap analysis finds them (and how often it cries wolf).

How one made-up company works:
  - each employee has a true quality (how good their work really is)
  - each client is a little strict or a little generous
  - each manager is a little strict or a little generous with everyone
  - a few manager-employee pairs are biased: the manager adds or removes stars for that one person
  - every rating is the truth plus some random noise, rounded to 1-5 stars
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from app.analysis import Pair


@dataclass
class CompanyConfig:
    managers: int = 6
    employees_per_manager: int = 6
    pieces_per_employee: int = 15
    clients_per_manager: int = 2
    biased_share: float = 0.15       # share of employees whose manager is biased against/for them
    bias_size: float = 1.0           # stars added or removed by a biased manager
    quality_mean: float = 3.6
    quality_sd: float = 0.5
    manager_strictness_sd: float = 0.3
    client_strictness_sd: float = 0.25
    manager_noise: float = 0.55
    client_noise: float = 0.55


@dataclass
class Company:
    pairs: list[Pair]
    biased: dict[tuple[str, str], int] = field(default_factory=dict)  # (manager, employee) -> +1 or -1


def _stars(x: np.ndarray) -> np.ndarray:
    return np.clip(np.rint(x), 1, 5).astype(int)


def simulate_company(rng: np.random.Generator, cfg: CompanyConfig = CompanyConfig()) -> Company:
    pairs: list[Pair] = []
    biased: dict[tuple[str, str], int] = {}
    for m in range(cfg.managers):
        manager_id = f"m{m}"
        strictness = rng.normal(0, cfg.manager_strictness_sd)
        clients = rng.normal(0, cfg.client_strictness_sd, cfg.clients_per_manager)
        for e in range(cfg.employees_per_manager):
            employee_id = f"m{m}e{e}"
            quality = rng.normal(cfg.quality_mean, cfg.quality_sd)
            bias = 0.0
            if rng.random() < cfg.biased_share:
                sign = 1 if rng.random() < 0.5 else -1
                bias = sign * cfg.bias_size
                biased[(manager_id, employee_id)] = sign
            n = cfg.pieces_per_employee
            client_of_piece = clients[rng.integers(0, cfg.clients_per_manager, n)]
            client = _stars(quality + client_of_piece + rng.normal(0, cfg.client_noise, n))
            manager = _stars(quality + strictness + bias + rng.normal(0, cfg.manager_noise, n))
            pairs.extend(Pair(manager_id, employee_id, int(a), int(b)) for a, b in zip(manager, client))
    return Company(pairs, biased)
