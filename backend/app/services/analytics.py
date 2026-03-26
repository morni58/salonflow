from datetime import datetime, timedelta
from collections import Counter

import logging

from app.core.async_utils import run_sync
from app.core.database import get_supabase

logger = logging.getLogger(__name__)


def _track_event_sync(tenant_id: str, event_type: str, session_id: str) -> None:
    sb = get_supabase()
    if event_type == "visit":
        existing = (
            sb.table("analytics")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("session_id", session_id)
            .eq("event_type", "visit")
            .limit(1)
            .execute()
        )
        if existing.data:
            return

    sb.table("analytics").insert({
        "tenant_id": tenant_id,
        "event_type": event_type,
        "session_id": session_id,
    }).execute()


async def track_event(tenant_id: str, event_type: str, session_id: str) -> None:
    """Track an analytics event."""
    await run_sync(_track_event_sync, tenant_id, event_type, session_id)


def _get_period_stats_sync(sb, tenant_id: str, start: datetime, end: datetime) -> dict:
    """Get stats for a specific period."""
    # Analytics events
    events = (
        sb.table("analytics")
        .select("event_type, session_id")
        .eq("tenant_id", tenant_id)
        .gte("created_at", start.isoformat())
        .lte("created_at", end.isoformat())
        .execute()
    )

    visits = len(set(e["session_id"] for e in events.data if e["event_type"] == "visit"))
    cart_opens = len(set(e["session_id"] for e in events.data if e["event_type"] == "cart_open"))
    checkouts = len(set(e["session_id"] for e in events.data if e["event_type"] == "checkout"))

    # Bookings with service_ids for top service
    bookings = (
        sb.table("bookings")
        .select("status, total_price, client_id, source, service_ids")
        .eq("tenant_id", tenant_id)
        .gte("created_at", start.isoformat())
        .lte("created_at", end.isoformat())
        .execute()
    )

    confirmed = [b for b in bookings.data if b["status"] in ("confirmed", "completed")]
    total_revenue = sum(b["total_price"] for b in confirmed)
    avg_check = total_revenue // len(confirmed) if confirmed else 0

    # Unique clients
    client_ids = set(b["client_id"] for b in confirmed if b.get("client_id"))

    # Top service (most booked)
    service_counter: Counter = Counter()
    for b in confirmed:
        for sid in (b.get("service_ids") or []):
            service_counter[sid] += 1

    top_service_id = service_counter.most_common(1)[0][0] if service_counter else None
    top_service_name = None
    top_service_count = 0
    if top_service_id:
        top_service_count = service_counter[top_service_id]
        svc = sb.table("services").select("name").eq("id", top_service_id).limit(1).execute()
        if svc.data:
            top_service_name = svc.data[0]["name"]

    # New vs returning clients
    new_clients = 0
    returning_clients = 0
    for cid in client_ids:
        cl = sb.table("clients").select("visit_count").eq("id", cid).limit(1).execute()
        if cl.data:
            if cl.data[0]["visit_count"] <= 1:
                new_clients += 1
            else:
                returning_clients += 1

    return {
        "visits": visits,
        "cart_opens": cart_opens,
        "checkouts": checkouts,
        "confirmed_count": len(confirmed),
        "total_revenue": total_revenue,
        "avg_check": avg_check,
        "unique_clients": len(client_ids),
        "top_service_name": top_service_name,
        "top_service_count": top_service_count,
        "new_clients": new_clients,
        "returning_clients": returning_clients,
    }


def _get_weekly_stats_sync(tenant_id: str) -> dict:
    sb = get_supabase()
    now = datetime.utcnow()
    current_start = now - timedelta(days=now.weekday(), hours=now.hour, minutes=now.minute)
    current_end = now
    prev_start = current_start - timedelta(days=7)
    prev_end = current_start

    current = _get_period_stats_sync(sb, tenant_id, current_start, current_end)
    previous = _get_period_stats_sync(sb, tenant_id, prev_start, prev_end)

    return {
        "current": current,
        "previous": previous,
        "deltas": _calc_deltas(current, previous),
    }


async def get_weekly_stats(tenant_id: str) -> dict:
    """Get analytics stats for current and previous week."""
    return await run_sync(_get_weekly_stats_sync, tenant_id)


def _calc_deltas(current: dict, previous: dict) -> dict:
    """Calculate percentage deltas between periods."""
    deltas = {}
    numeric_keys = ["visits", "cart_opens", "checkouts", "confirmed_count",
                    "total_revenue", "avg_check", "unique_clients"]
    for key in numeric_keys:
        curr = current.get(key, 0)
        prev = previous.get(key, 0)
        if prev > 0:
            deltas[key] = round((curr - prev) / prev * 100, 1)
        elif curr > 0:
            deltas[key] = 100.0
        else:
            deltas[key] = 0.0
    return deltas
