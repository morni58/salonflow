from datetime import datetime, timedelta

from app.core.async_utils import run_sync
from app.core.database import get_supabase
from app.models.schemas import BookingCreate, BookingOut
import logging

logger = logging.getLogger(__name__)


def _create_booking_sync(data: BookingCreate) -> dict:
    """Вся работа с Supabase в одном sync-вызове (не блокируем event loop)."""
    sb = get_supabase()

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
        .eq("contact_type", data.contact_type)
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
                "contact_type": data.contact_type,
                "contact_value": data.contact_value,
                "first_visit": datetime.utcnow().isoformat(),
            })
            .execute()
        )
        client_id = new_client.data[0]["id"]

    booking = (
        sb.table("bookings")
        .insert({
            "tenant_id": data.tenant_id,
            "client_id": client_id,
            "service_ids": data.service_ids,
            "total_price": total_price,
            "total_duration_minutes": total_duration,
            "preferred_datetime": data.preferred_datetime.isoformat(),
            "status": "pending",
            "payment_status": "unpaid",
            "source": "online",
        })
        .execute()
    )

    booking_data = booking.data[0]
    return {
        "id": booking_data["id"],
        "status": booking_data["status"],
        "created_at": booking_data["created_at"],
        "client_id": client_id,
        "service_names": service_names,
        "total_price": total_price,
        "total_duration": total_duration,
    }


async def create_booking(data: BookingCreate) -> BookingOut:
    """Create a new booking and notify admin via bot webhook."""
    r = await run_sync(_create_booking_sync, data)

    try:
        await _notify_bot(
            tenant_id=data.tenant_id,
            booking_id=r["id"],
            client_name=data.name,
            contact_type=data.contact_type,
            contact_value=data.contact_value,
            service_names=r["service_names"],
            total_price=r["total_price"],
            total_duration=r["total_duration"],
            preferred_datetime=data.preferred_datetime,
            client_id=r["client_id"],
        )
    except Exception as e:
        logger.error(f"Failed to notify bot: {e}")

    return BookingOut(
        id=r["id"],
        status=r["status"],
        created_at=r["created_at"],
    )


async def _notify_bot(
    tenant_id: str,
    booking_id: str,
    client_name: str,
    contact_type: str,
    contact_value: str,
    service_names: list[str],
    total_price: int,
    total_duration: int,
    preferred_datetime: datetime,
    client_id: str,
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
        client_name=client_name,
        contact_type=contact_type,
        contact_value=contact_value,
        service_names=service_names,
        total_price=total_price,
        total_duration=total_duration,
        preferred_datetime=preferred_datetime,
        client_info=client_info,
    )


def _confirm_booking_sync(booking_id: str) -> None:
    sb = get_supabase()
    sb.table("bookings").update({
        "status": "confirmed",
        "payment_status": "paid",
    }).eq("id", booking_id).execute()


async def confirm_booking(booking_id: str) -> None:
    """Confirm a booking (payment received). CRM stats update on completion."""
    await run_sync(_confirm_booking_sync, booking_id)


def _complete_booking_sync(booking_id: str) -> None:
    sb = get_supabase()
    sb.table("bookings").update({
        "status": "completed",
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
