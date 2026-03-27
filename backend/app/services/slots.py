import logging
from datetime import date, datetime, time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.async_utils import run_sync
from app.core.database import get_supabase
from app.core.tenant_fields import (
    normalize_every_n_days,
    normalize_every_n_days_anchor,
    normalize_schedule_mode,
    normalize_working_days,
)
from app.services.masters_query import tenant_has_bookable_masters_sync


def _get_tz(tz_str: str | None) -> ZoneInfo:
    """Безопасно получить ZoneInfo по строке, fallback — UTC."""
    if not tz_str:
        return ZoneInfo("UTC")
    try:
        return ZoneInfo(tz_str)
    except (ZoneInfoNotFoundError, Exception):
        return ZoneInfo("UTC")

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


def _resolve_master_slot_window(tenant: dict, master: dict) -> tuple[int, int, int, int]:
    """Пересечение часов салона и мастера; если пусто — окно салона (настройки «Общий график» в боте)."""
    mhs, mm = _parse_hh_mm(master.get("working_hours_start"))
    mhe, mme = _parse_hh_mm(master.get("working_hours_end"))
    ms0 = mhs * 60 + mm
    me0 = mhe * 60 + mme

    if not tenant:
        return (mhs, mm, mhe, mme)

    ths, tm = _parse_hh_mm(tenant.get("working_hours_start"))
    the, tme = _parse_hh_mm(tenant.get("working_hours_end"))
    ts0 = ths * 60 + tm
    te0 = the * 60 + tme
    if te0 <= ts0:
        return (mhs, mm, mhe, mme)

    if me0 > ms0:
        sm = max(ts0, ms0)
        em = min(te0, me0)
        if em > sm:
            return (sm // 60, sm % 60, em // 60, em % 60)
    return (ths, tm, the, tme)


def _master_weekday_open(m: dict, target_date: date) -> bool:
    """Мастер на сайте: только дни недели из «Мой график». Режим «каждые N дней» задаёт владелец у салона — строку мастера не используем, чтобы не дублировать и не блокировать зря."""
    return target_date.weekday() in normalize_working_days(m.get("working_days"))


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
            # До даты якоря не блокируем салон полностью — используем дни недели,
            # иначе при якоре «в будущем» запись на ближайшие месяцы невозможна.
            days = normalize_working_days(t.get("working_days"))
            return target_date.weekday() in days
        return delta % n == 0
    days = normalize_working_days(t.get("working_days"))
    return target_date.weekday() in days


def _slot_strings_fit_duration(
    slot_strings: list[str],
    occupied: list[tuple[int, int]],
    end_limit_min: int,
    duration_minutes: int | None,
) -> list[str]:
    """Если задана длительность — оставляем только старт, при котором визит [start, start+dur) укладывается в день и не пересекается с занятыми интервалами."""
    if not duration_minutes or duration_minutes <= 0:
        return slot_strings
    out: list[str] = []
    for s in slot_strings:
        try:
            h, m = s.split(":")
            slot_min = int(h) * 60 + int(m)
        except (ValueError, IndexError):
            continue
        if slot_min + duration_minutes > end_limit_min:
            continue
        ok = True
        for occ_start, occ_end in occupied:
            if slot_min < occ_end and occ_start < slot_min + duration_minutes:
                ok = False
                break
        if ok:
            out.append(s)
    return out


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


def _get_available_slots_sync(
    tenant_id: str,
    target_date: date,
    duration_minutes: int | None = None,
) -> list[str]:
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
        tz = _get_tz(t.get("timezone"))
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
            dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00")).astimezone(tz)
            bk_start = dt.hour * 60 + dt.minute
            dur = int(b.get("total_duration_minutes") or 0)
            bk_end = bk_start + dur + buffer
            occupied.append((bk_start, bk_end))

        end_limit_min = end_h * 60 + end_m
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

        return _slot_strings_fit_duration(available, occupied, end_limit_min, duration_minutes)
    except Exception:
        logger.exception("get_available_slots failed tenant_id=%s date=%s", tenant_id, target_date)
        return []


def _get_available_slots_master_sync(
    tenant_id: str,
    master_id: str,
    target_date: date,
    duration_minutes: int | None = None,
) -> list[str]:
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
            .select(
                "working_hours_start, working_hours_end, slot_interval_minutes, buffer_minutes, "
                "working_days, schedule_mode, every_n_days, every_n_days_anchor, timezone"
            )
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        )
        t0 = tenant.data[0] if tenant.data else {}

        m = mrow.data[0]
        tz = _get_tz(t0.get("timezone"))
        start_h, start_m, end_h, end_m = _resolve_master_slot_window(t0, m)
        ti = t0.get("slot_interval_minutes")
        mi = m.get("slot_interval_minutes")
        interval = int((ti if ti is not None else None) or mi or 60)
        tb = t0.get("buffer_minutes")
        mb = m.get("buffer_minutes")
        buffer = int((tb if tb is not None else None) or mb or 15)
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

        # Салон — общий график (в т.ч. «каждые N дней»); мастер — только вкл. дни недели
        if not _date_open_for_schedule(t0, target_date):
            return []
        if not _master_weekday_open(m, target_date):
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
            dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00")).astimezone(tz)
            bk_start = dt.hour * 60 + dt.minute
            dur = int(b.get("total_duration_minutes") or 0)
            bk_end = bk_start + dur + buffer
            occupied.append((bk_start, bk_end))

        end_limit_min = end_h * 60 + end_m
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

        return _slot_strings_fit_duration(available, occupied, end_limit_min, duration_minutes)
    except Exception:
        logger.exception(
            "get_available_slots_master failed tenant_id=%s master_id=%s date=%s",
            tenant_id,
            master_id,
            target_date,
        )
        return []


def _route_slots_sync(
    tenant_id: str,
    target_date: date,
    master_id: str | None,
    duration_minutes: int | None = None,
) -> list[str]:
    needs = tenant_has_bookable_masters_sync(tenant_id)
    if needs:
        if not master_id:
            return []
        return _get_available_slots_master_sync(tenant_id, master_id, target_date, duration_minutes)
    return _get_available_slots_sync(tenant_id, target_date, duration_minutes)


async def get_available_slots(
    tenant_id: str,
    target_date: date,
    master_id: str | None = None,
    duration_minutes: int | None = None,
) -> list[str]:
    """Слоты: при наличии записываемых мастеров нужен master_id; иначе — общий график салона."""
    return await run_sync(_route_slots_sync, tenant_id, target_date, master_id, duration_minutes)


def _find_alternate_master_with_slots_sync(
    tenant_id: str,
    target_date: date,
    exclude_master_id: str,
    duration_minutes: int | None = None,
) -> tuple[str | None, str | None]:
    """Если у выбранного мастера нет слотов — первый другой мастер с хотя бы одним слотом."""
    if not tenant_has_bookable_masters_sync(tenant_id):
        return None, None
    sb = get_supabase()
    rows = (
        sb.table("masters")
        .select("id, display_name")
        .eq("tenant_id", tenant_id)
        .eq("is_active", True)
        .eq("is_bookable", True)
        .order("sort_order")
        .execute()
    )
    for row in rows.data or []:
        mid = str(row["id"])
        if mid == exclude_master_id:
            continue
        slots = _get_available_slots_master_sync(tenant_id, mid, target_date, duration_minutes)
        if slots:
            return mid, row.get("display_name") or "Мастер"
    return None, None


async def suggest_alternate_master(
    tenant_id: str,
    target_date: date,
    exclude_master_id: str,
    duration_minutes: int | None = None,
) -> tuple[str | None, str | None]:
    return await run_sync(
        _find_alternate_master_with_slots_sync,
        tenant_id,
        target_date,
        exclude_master_id,
        duration_minutes,
    )
