"""Нормализация полей tenant из Supabase (JSONB, отсутствующие колонки)."""
from __future__ import annotations

import json
from typing import Any


def normalize_working_days(raw: Any) -> list[int]:
    default = list(range(7))
    if raw is None:
        return default
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            return default
    if not isinstance(raw, list):
        return default
    out: list[int] = []
    for x in raw:
        try:
            d = int(x)
            if 0 <= d <= 6:
                out.append(d)
        except (TypeError, ValueError):
            continue
    return sorted(set(out)) if out else [0]


def normalize_site_content(raw: Any) -> dict[str, Any]:
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            o = json.loads(raw)
            return o if isinstance(o, dict) else {}
        except Exception:
            return {}
    return {}


def normalize_contact_json(raw: Any) -> dict[str, Any]:
    return normalize_site_content(raw)


def normalize_schedule_mode(raw: Any) -> str:
    s = (raw or "weekdays").strip().lower()
    if s in ("weekdays", "every_n_days"):
        return s
    return "weekdays"


def normalize_every_n_days(raw: Any) -> int:
    try:
        n = int(raw)
        return max(1, min(n, 30))
    except (TypeError, ValueError):
        return 1


def normalize_every_n_days_anchor(raw: Any) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()[:10]
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        return s
    return None
