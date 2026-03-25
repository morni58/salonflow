import logging
from datetime import date, datetime, time

from app.core.database import get_supabase

logger = logging.getLogger(__name__)


def _parse_hh_mm(val) -> tuple[int, int]:
    """
    PostgreSQL TIME часто приходит как '10:00:00' — нельзя делать
    h, m = map(int, s.split(':')) (3 части → crash → пустые слоты).
    """
    if val is None:
        return 10, 0
    s = str(val).strip()
    parts = s.split(":")
    if len(parts) < 2:
        return 10, 0
    try:
        h = int(parts[0]) % 24
        m = int(parts[1]) % 60
        return h, m
    except ValueError:
        return 10, 0


async def get_available_slots(tenant_id: str, target_date: date) -> list[str]:
    """Calculate available time slots for a given date."""
    try:
        sb = get_supabase()

        tenant = (
            sb.table("tenants")
            .select("working_hours_start, working_hours_end, slot_interval_minutes, buffer_minutes, timezone")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        )
        if not tenant.data:
            return []

        t = tenant.data[0]
        start_h, start_m = _parse_hh_mm(t.get("working_hours_start"))
        end_h, end_m = _parse_hh_mm(t.get("working_hours_end"))
        interval = int(t.get("slot_interval_minutes") or 60)
        buffer = int(t.get("buffer_minutes") or 15)

        if interval <= 0:
            interval = 60
        if buffer < 0:
            buffer = 0

        exception = (
            sb.table("schedule_exceptions")
            .select("is_closed, custom_start, custom_end")
            .eq("tenant_id", tenant_id)
            .eq("date", target_date.isoformat())
            .limit(1)
            .execute()
        )
        if exception.data:
            exc = exception.data[0]
            if exc.get("is_closed"):
                return []
            if exc.get("custom_start"):
                start_h, start_m = _parse_hh_mm(exc["custom_start"])
            if exc.get("custom_end"):
                end_h, end_m = _parse_hh_mm(exc["custom_end"])

        all_slots: list[time] = []
        current = time(start_h, start_m)
        end = time(end_h, end_m)

        start_min = start_h * 60 + start_m
        end_min = end_h * 60 + end_m
        if end_min <= start_min:
            logger.warning("tenant %s: invalid hours end<=start", tenant_id)
            return []

        while True:
            cm = current.hour * 60 + current.minute
            if cm >= end_min:
                break
            all_slots.append(current)
            next_min = cm + interval
            if next_min >= 24 * 60:
                break
            current = time(next_min // 60, next_min % 60)

        day_start = datetime.combine(target_date, time(0, 0))
        day_end = datetime.combine(target_date, time(23, 59, 59))

        bookings = (
            sb.table("bookings")
            .select("preferred_datetime, total_duration_minutes")
            .eq("tenant_id", tenant_id)
            .in_("status", ["pending", "waiting", "confirmed"])
            .gte("preferred_datetime", day_start.isoformat())
            .lte("preferred_datetime", day_end.isoformat())
            .execute()
        )

        occupied: list[tuple[int, int]] = []
        for b in bookings.data or []:
            raw = b.get("preferred_datetime")
            if not raw:
                continue
            dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
            bk_start = dt.hour * 60 + dt.minute
            dur = int(b.get("total_duration_minutes") or 0)
            bk_end = bk_start + dur + buffer
            occupied.append((bk_start, bk_end))

        available: list[str] = []
        for slot in all_slots:
            slot_min = slot.hour * 60 + slot.minute
            is_free = True
            for occ_start, occ_end in occupied:
                if occ_start <= slot_min < occ_end:
                    is_free = False
                    break
            if is_free:
                available.append(f"{slot.hour:02d}:{slot.minute:02d}")

        return available
    except Exception:
        logger.exception("get_available_slots failed tenant_id=%s date=%s", tenant_id, target_date)
        return []
