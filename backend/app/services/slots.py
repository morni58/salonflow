import logging
from datetime import date, datetime, time

from app.core.async_utils import run_sync
from app.core.database import get_supabase
from app.core.tenant_fields import (
    normalize_every_n_days,
    normalize_every_n_days_anchor,
    normalize_schedule_mode,
    normalize_working_days,
)
from app.services.masters_query import tenant_has_bookable_masters_sync

logger = logging.getLogger(__name__)


def _parse_hh_mm(val) -> tuple[int, int]:
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


def _date_open_for_schedule(t: dict, target_date: date) -> bool:
    mode = normalize_schedule_mode(t.get("schedule_mode"))
    if mode == "every_n_days":
        anchor_s = normalize_every_n_days_anchor(t.get("every_n_days_anchor"))
        n = normalize_every_n_days(t.get("every_n_days"))
        if not anchor_s:
            days = normalize_working_days(t.get("working_days"))
            return target_date.weekday() in days
        anchor = date.fromisoformat(anchor_s)
        delta = (target_date - anchor).days
        if delta < 0:
            return False
        return delta % n == 0
    days = normalize_working_days(t.get("working_days"))
    return target_date.weekday() in days


def _build_slot_times(start_h: int, start_m: int, end_h: int, end_m: int, interval: int) -> list[time]:
    all_slots: list[time] = []
    current = time(start_h, start_m)
    end = time(end_h, end_m)
    start_min = start_h * 60 + start_m
    end_min = end_h * 60 + end_m
    if end_min <= start_min:
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
    return all_slots


def _get_available_slots_sync(tenant_id: str, target_date: date) -> list[str]:
    try:
        sb = get_supabase()

        tenant = (
            sb.table("tenants")
            .select(
                "working_hours_start, working_hours_end, slot_interval_minutes, buffer_minutes, timezone, "
                "working_days, schedule_mode, every_n_days, every_n_days_anchor"
            )
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
        has_exc = bool(exception.data)
        exc = exception.data[0] if has_exc else None

        if has_exc and exc and exc.get("is_closed"):
            return []

        if not has_exc and not _date_open_for_schedule(t, target_date):
            return []

        if has_exc and exc:
            if exc.get("custom_start"):
                start_h, start_m = _parse_hh_mm(exc["custom_start"])
            if exc.get("custom_end"):
                end_h, end_m = _parse_hh_mm(exc["custom_end"])

        all_slots = _build_slot_times(start_h, start_m, end_h, end_m, interval)
        if not all_slots:
            logger.warning("tenant %s: invalid hours end<=start", tenant_id)
            return []

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


def _get_available_slots_master_sync(tenant_id: str, master_id: str, target_date: date) -> list[str]:
    """Слоты по графику мастера; занятость — записи к этому мастеру + «общие» (master_id NULL)."""
    try:
        sb = get_supabase()

        mrow = (
            sb.table("masters")
            .select(
                "working_hours_start, working_hours_end, slot_interval_minutes, buffer_minutes, "
                "working_days, schedule_mode, every_n_days, every_n_days_anchor, tenant_id"
            )
            .eq("id", master_id)
            .eq("tenant_id", tenant_id)
            .eq("is_active", True)
            .eq("is_bookable", True)
            .limit(1)
            .execute()
        )
        if not mrow.data:
            return []

        tenant = (
            sb.table("tenants")
            .select("slot_interval_minutes, buffer_minutes")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        )
        t0 = tenant.data[0] if tenant.data else {}

        m = mrow.data[0]
        start_h, start_m = _parse_hh_mm(m.get("working_hours_start"))
        end_h, end_m = _parse_hh_mm(m.get("working_hours_end"))
        interval = int(m.get("slot_interval_minutes") or t0.get("slot_interval_minutes") or 60)
        buffer = int(m.get("buffer_minutes") or t0.get("buffer_minutes") or 15)
        if interval <= 0:
            interval = 60
        if buffer < 0:
            buffer = 0

        exception = (
            sb.table("master_schedule_exceptions")
            .select("is_closed, custom_start, custom_end")
            .eq("master_id", master_id)
            .eq("date", target_date.isoformat())
            .limit(1)
            .execute()
        )
        has_exc = bool(exception.data)
        exc = exception.data[0] if has_exc else None

        if has_exc and exc and exc.get("is_closed"):
            return []

        if not has_exc and not _date_open_for_schedule(m, target_date):
            return []

        if has_exc and exc:
            if exc.get("custom_start"):
                start_h, start_m = _parse_hh_mm(exc["custom_start"])
            if exc.get("custom_end"):
                end_h, end_m = _parse_hh_mm(exc["custom_end"])

        all_slots = _build_slot_times(start_h, start_m, end_h, end_m, interval)
        if not all_slots:
            return []

        day_start = datetime.combine(target_date, time(0, 0))
        day_end = datetime.combine(target_date, time(23, 59, 59))

        bookings = (
            sb.table("bookings")
            .select("preferred_datetime, total_duration_minutes, master_id")
            .eq("tenant_id", tenant_id)
            .in_("status", ["pending", "waiting", "confirmed"])
            .gte("preferred_datetime", day_start.isoformat())
            .lte("preferred_datetime", day_end.isoformat())
            .execute()
        )

        occupied: list[tuple[int, int]] = []
        for b in bookings.data or []:
            bid = b.get("master_id")
            if bid is not None and str(bid) != str(master_id):
                continue
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
        logger.exception(
            "get_available_slots_master failed tenant_id=%s master_id=%s date=%s",
            tenant_id,
            master_id,
            target_date,
        )
        return []


def _route_slots_sync(tenant_id: str, target_date: date, master_id: str | None) -> list[str]:
    needs = tenant_has_bookable_masters_sync(tenant_id)
    if needs:
        if not master_id:
            return []
        return _get_available_slots_master_sync(tenant_id, master_id, target_date)
    return _get_available_slots_sync(tenant_id, target_date)


async def get_available_slots(
    tenant_id: str,
    target_date: date,
    master_id: str | None = None,
) -> list[str]:
    """Слоты: при наличии записываемых мастеров нужен master_id; иначе — общий график салона."""
    return await run_sync(_route_slots_sync, tenant_id, target_date, master_id)
