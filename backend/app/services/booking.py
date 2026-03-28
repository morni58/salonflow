from datetime import datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.async_utils import run_sync
from app.core.database import get_supabase
from app.models.schemas import BookingCreate, BookingOut, ContactType
from app.services.masters_query import (
    master_belongs_to_tenant_sync,
    services_allowed_for_master_sync,
    tenant_has_bookable_masters_sync,
)
import logging

logger = logging.getLogger(__name__)


def _contact_type_value(ct: ContactType | str) -> str:
    """Supabase ENUM ждёт 'telegram', а не строку вида 'ContactType.telegram'."""
    if isinstance(ct, ContactType):
        return ct.value
    return str(ct)



def _calc_pending_expires_at_sync(tenant_id: str) -> str:
    """Умная дата истечения pending: 08:00-21:00 +2ч; ночь 21:00-08:00 → 10:00 следующего утра (по tz салона)."""
    sb = get_supabase()
    t = sb.table("tenants").select("timezone").eq("id", tenant_id).limit(1).execute()
    tz_str = (t.data[0].get("timezone") or "") if t.data else ""
    try:
        tz = ZoneInfo(tz_str) if tz_str else ZoneInfo("UTC")
    except (ZoneInfoNotFoundError, Exception):
        tz = ZoneInfo("UTC")

    now_local = datetime.now(tz)
    h = now_local.hour
    if h >= 21 or h < 8:
        # Ночь — до 10:00 следующего утра (или сегодня если ещё до 8)
        if h < 8:
            target_date = now_local.date()
        else:
            target_date = now_local.date() + timedelta(days=1)
        expires_local = datetime(
            target_date.year, target_date.month, target_date.day,
            10, 0, 0, tzinfo=tz
        )
        return expires_local.astimezone(ZoneInfo("UTC")).replace(tzinfo=None).isoformat()
    else:
        # День — через 2 часа
        return (datetime.utcnow() + timedelta(hours=2)).isoformat()

def _create_booking_sync(data: BookingCreate) -> dict:
    """Вся работа с Supabase в одном sync-вызове (не блокируем event loop)."""
    sb = get_supabase()
    contact_type_str = _contact_type_value(data.contact_type)

    needs_master = tenant_has_bookable_masters_sync(data.tenant_id)
    master_id: str | None = data.master_id
    if needs_master:
        if not master_id:
            raise ValueError("Выберите мастера для записи")
        if not master_belongs_to_tenant_sync(master_id, data.tenant_id):
            raise ValueError("Выбранный мастер недоступен")
        ok, err = services_allowed_for_master_sync(data.tenant_id, master_id, data.service_ids)
        if not ok:
            raise ValueError(err or "Этот мастер не выполняет выбранные услуги")
    else:
        master_id = None

    services = (
        sb.table("services")
        .select("id, name, price, duration_minutes")
        .in_("id", data.service_ids)
        .execute()
    )
    total_price = sum(s["price"] for s in services.data)
    total_duration = sum(s["duration_minutes"] for s in services.data)
    service_names = [s["name"] for s in services.data]

    existing = (
        sb.table("clients")
        .select("id, visit_count, total_spent")
        .eq("tenant_id", data.tenant_id)
        .eq("contact_type", contact_type_str)
        .eq("contact_value", data.contact_value)
        .limit(1)
        .execute()
    )

    if existing.data:
        client_id = existing.data[0]["id"]
    else:
        new_client = (
            sb.table("clients")
            .insert({
                "tenant_id": data.tenant_id,
                "name": data.name,
                "contact_type": contact_type_str,
                "contact_value": data.contact_value,
                "first_visit": datetime.utcnow().isoformat(),
            })
            .execute()
        )
        client_id = new_client.data[0]["id"]

    insert_row = {
        "tenant_id": data.tenant_id,
        "client_id": client_id,
        "service_ids": data.service_ids,
        "total_price": total_price,
        "total_duration_minutes": total_duration,
        "preferred_datetime": data.preferred_datetime.isoformat(),
        "status": "pending",
        "payment_status": "unpaid",
        "source": "online",
        # Умный таймер: днём +2ч, ночью — до 10:00 следующего утра
        "pending_expires_at": _calc_pending_expires_at_sync(data.tenant_id),
    }
    if master_id:
        insert_row["master_id"] = master_id

    booking = sb.table("bookings").insert(insert_row).execute()

    booking_data = booking.data[0]
    bid = booking_data["id"]
    booking_code = "SF-" + bid.replace("-", "")[:6].upper()
    return {
        "id": bid,
        "status": booking_data["status"],
        "created_at": booking_data["created_at"],
        "client_id": client_id,
        "service_names": service_names,
        "total_price": total_price,
        "total_duration": total_duration,
        "master_id": master_id,
        "booking_code": booking_code,
    }


async def create_booking(data: BookingCreate) -> BookingOut:
    """Create a new booking and notify admin via bot webhook."""
    r = await run_sync(_create_booking_sync, data)

    try:
        await _notify_bot(
            tenant_id=data.tenant_id,
            booking_id=r["id"],
            booking_code=r.get("booking_code", ""),
            client_name=data.name,
            contact_type=_contact_type_value(data.contact_type),
            contact_value=data.contact_value,
            service_names=r["service_names"],
            total_price=r["total_price"],
            total_duration=r["total_duration"],
            preferred_datetime=data.preferred_datetime,
            client_id=r["client_id"],
            master_id=r.get("master_id"),
        )
    except Exception as e:
        logger.error(f"Failed to notify bot: {e}")

    return BookingOut(
        id=r["id"],
        status=r["status"],
        created_at=r["created_at"],
        booking_code=r.get("booking_code", ""),
    )


async def _notify_bot(
    tenant_id: str,
    booking_id: str,
    booking_code: str = "",
    client_name: str = "",
    contact_type: str = "",
    contact_value: str = "",
    service_names: list[str] = (),
    total_price: int = 0,
    total_duration: int = 0,
    preferred_datetime: datetime = None,
    client_id: str = "",
    master_id: str | None = None,
):
    """Send booking notification to the bot's internal webhook handler."""
    from app.bot.notifications import send_booking_notification

    def _client_info_sync(cid: str) -> dict | None:
        sb = get_supabase()
        client = (
            sb.table("clients")
            .select("visit_count, total_spent, notes, last_visit")
            .eq("id", cid)
            .limit(1)
            .execute()
        )
        return client.data[0] if client.data else None

    client_info = await run_sync(_client_info_sync, client_id)

    await send_booking_notification(
        tenant_id=tenant_id,
        booking_id=booking_id,
        booking_code=booking_code,
        client_name=client_name,
        contact_type=contact_type,
        contact_value=contact_value,
        service_names=service_names,
        total_price=total_price,
        total_duration=total_duration,
        preferred_datetime=preferred_datetime,
        client_info=client_info,
        master_id=master_id,
    )


def _accept_booking_sync(booking_id: str) -> None:
    """Принять заявку: запись подтверждена, оплата на усмотрение салона (часто позже)."""
    sb = get_supabase()
    now = datetime.utcnow().isoformat()
    sb.table("bookings").update({
        "status": "confirmed",
        "payment_status": "unpaid",
        "accepted_at": now,
        "updated_at": now,
    }).eq("id", booking_id).execute()


async def accept_booking(booking_id: str) -> None:
    """CRM: лид → запись (подтверждено)."""
    await run_sync(_accept_booking_sync, booking_id)


def _confirm_booking_sync(booking_id: str) -> None:
    """Совместимость: то же, что accept (раньше означало «оплатил»)."""
    _accept_booking_sync(booking_id)


async def confirm_booking(booking_id: str) -> None:
    """Подтвердить заявку (принять запись)."""
    await run_sync(_confirm_booking_sync, booking_id)


def _complete_booking_sync(booking_id: str) -> None:
    sb = get_supabase()
    now = datetime.utcnow().isoformat()
    sb.table("bookings").update({
        "status": "completed",
        "completed_at": now,
        "updated_at": now,
    }).eq("id", booking_id).execute()

    booking = (
        sb.table("bookings")
        .select("client_id, total_price, tenant_id")
        .eq("id", booking_id)
        .limit(1)
        .execute()
    )
    if booking.data and booking.data[0].get("client_id"):
        b = booking.data[0]
        client = (
            sb.table("clients")
            .select("visit_count, total_spent")
            .eq("id", b["client_id"])
            .limit(1)
            .execute()
        )
        if client.data:
            c = client.data[0]
            sb.table("clients").update({
                "visit_count": c["visit_count"] + 1,
                "total_spent": c["total_spent"] + b["total_price"],
                "last_visit": datetime.utcnow().isoformat(),
            }).eq("id", b["client_id"]).execute()


async def complete_booking(booking_id: str) -> None:
    """Mark booking as completed after client visit. Updates CRM stats."""
    await run_sync(_complete_booking_sync, booking_id)


def _cancel_booking_sync(booking_id: str) -> None:
    sb = get_supabase()
    sb.table("bookings").update({
        "status": "cancelled",
    }).eq("id", booking_id).execute()


async def cancel_booking(booking_id: str) -> None:
    """Cancel a booking."""
    await run_sync(_cancel_booking_sync, booking_id)


def _set_booking_waiting_sync(booking_id: str) -> None:
    sb = get_supabase()
    expires = datetime.utcnow() + timedelta(hours=48)
    sb.table("bookings").update({
        "status": "waiting",
        "waiting_expires_at": expires.isoformat(),
    }).eq("id", booking_id).execute()


async def set_booking_waiting(booking_id: str) -> None:
    """Set booking to waiting status with 48h expiry."""
    await run_sync(_set_booking_waiting_sync, booking_id)
