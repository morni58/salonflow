"""Simple in-memory undo stack per tenant (max 5 actions)."""
from __future__ import annotations
from typing import Any

MAX_HISTORY = 5

# tenant_id -> list of undo entries (oldest first)
_history: dict[str, list[dict]] = {}


def push_undo(tenant_id: str, table: str, row_id: str, field: str, old_value: Any) -> None:
    """Record a reversible change before applying it."""
    stack = _history.setdefault(tenant_id, [])
    stack.append({"table": table, "id": row_id, "field": field, "old_value": old_value})
    # Keep only last MAX_HISTORY
    if len(stack) > MAX_HISTORY:
        _history[tenant_id] = stack[-MAX_HISTORY:]


def pop_undo(tenant_id: str) -> dict | None:
    """Return and remove the most recent undo entry, or None if empty."""
    stack = _history.get(tenant_id)
    return stack.pop() if stack else None


def has_undo(tenant_id: str) -> bool:
    return bool(_history.get(tenant_id))


def undo_count(tenant_id: str) -> int:
    return len(_history.get(tenant_id, []))


def clear_history(tenant_id: str) -> None:
    _history[tenant_id] = []
