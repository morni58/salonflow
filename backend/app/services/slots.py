from datetime import date, datetime, time, timedelta
from app.core.database import get_supabase


async def get_available_slots(tenant_id: str, target_date: date) -> list[str]:
    """Calculate available time slots for a given date."""
    sb = get_supabase()

    # 1. Get tenant settings
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
    start_h, start_m = map(int, t["working_hours_start"].split(":"))
    end_h, end_m = map(int, t["working_hours_end"].split(":"))
    interval = t["slot_interval_minutes"]
    buffer = t["buffer_minutes"]

    # 2. Check if day is closed
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
        if exc["is_closed"]:
            return []
        # Custom hours for this day
        if exc.get("custom_start"):
            start_h, start_m = map(int, exc["custom_start"].split(":"))
        if exc.get("custom_end"):
            end_h, end_m = map(int, exc["custom_end"].split(":"))

    # 3. Generate all possible slots
    all_slots: list[time] = []
    current = time(start_h, start_m)
    end = time(end_h, end_m)

    while current < end:
        all_slots.append(current)
        total_minutes = current.hour * 60 + current.minute + interval
        if total_minutes >= 24 * 60:
            break
        current = time(total_minutes // 60, total_minutes % 60)

    # 4. Get existing bookings for this date
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

    # 5. Build set of occupied time ranges (start_min, end_min inclusive of buffer)
    occupied: list[tuple[int, int]] = []
    for b in bookings.data:
        dt = datetime.fromisoformat(b["preferred_datetime"].replace("Z", "+00:00"))
        bk_start = dt.hour * 60 + dt.minute
        bk_end = bk_start + b["total_duration_minutes"] + buffer
        occupied.append((bk_start, bk_end))

    # 6. Filter available slots
    available: list[str] = []
    for slot in all_slots:
        slot_min = slot.hour * 60 + slot.minute
        is_free = True
        for occ_start, occ_end in occupied:
            # Slot conflicts if it falls within an occupied range
            if occ_start <= slot_min < occ_end:
                is_free = False
                break
        if is_free:
            available.append(f"{slot.hour:02d}:{slot.minute:02d}")

    return available
