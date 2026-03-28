"""
In-process TTL cache for frequently-read data.
Dramatically reduces Supabase round-trips in bot handlers.

Usage:
    from app.bot.cache import get_user_sync, invalidate_user

    user = get_user_sync(telegram_user_id)   # cached, sync, call inside run_sync or directly
"""
from __future__ import annotations

import time
import logging
from app.core.database import get_supabase

logger = logging.getLogger(__name__)

# ── User cache (TTL = 5 minutes) ─────────────────────────────────────────────
_USER_CACHE: dict[int, tuple[dict | None, float]] = {}
_USER_TTL: float = 300.0


def get_user_sync(tg_id: int) -> dict | None:
    """
    Cached lookup: users WHERE telegram_user_id = tg_id.
    Returns dict with id, tenant_id, role, name — or None if not found.
    Cache TTL = 5 min. Safe to call from threads (GIL protects dict ops).
    """
    now = time.monotonic()
    entry = _USER_CACHE.get(tg_id)
    if entry is not None and now - entry[1] < _USER_TTL:
        return entry[0]

    sb = get_supabase()
    r = (
        sb.table("users")
        .select("id, tenant_id, role, name")
        .eq("telegram_user_id", tg_id)
        .limit(1)
        .execute()
    )
    result = r.data[0] if r.data else None
    _USER_CACHE[tg_id] = (result, now)
    return result


def invalidate_user(tg_id: int) -> None:
    """Call after changing a user's role/status to force a fresh fetch."""
    _USER_CACHE.pop(tg_id, None)


def cache_stats() -> dict:
    return {"user_cache_size": len(_USER_CACHE)}
