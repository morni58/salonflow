import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.core.async_utils import run_sync
from app.core.database import get_supabase
from app.core.rate_limit import limiter

logger = logging.getLogger(__name__)
router = APIRouter()


class BookingLookupRequest(BaseModel):
    tenant_id: str
    contact_type: str
    contact_value: str


class BookingCancelRequest(BaseModel):
    tenant_id: str
    booking_id: str
    contact_type: str
    contact_value: str


def _lookup_bookings_sync(tenant_id: str, contact_type: str, contact_value: str) -> list[dict]:
    sb = get_supabase()

    # Find matching clients
    clients = (
        sb.table("clients")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("contact_type", contact_type)
        .ilike("contact_value", contact_value.strip())
        .limit(5)
        .execute()
    )
    if not clients.data:
        return []

    client_ids = [c["id"] for c in clients.data]

    bookings = (
        sb.table("bookings")
        .select(
            "id, status, preferred_datetime, total_price, "
            "total_duration_minutes, service_ids, master_id, "
            "booking_code, created_at"
        )
        .eq("tenant_id", tenant_id)
        .in_("client_id", client_ids)
        .order("preferred_datetime", desc=True)
        .limit(30)
        .execute()
    )
    if not bookings.data:
        return []

    # Tenant timezone
    tz_row = sb.table("tenants").select("timezone").eq("id", tenant_id).limit(1).execute()
    tz_str = (tz_row.data[0].get("timezone") or "UTC") if tz_row.data else "UTC"
    try:
        tz = ZoneInfo(tz_str)
    except Exception:
        tz = ZoneInfo("UTC")

    # Batch-fetch services
    all_svc_ids = list({sid for b in bookings.data for sid in (b.get("service_ids") or [])})
    services_map: dict[str, str] = {}
    if all_svc_ids:
        svcs = sb.table("services").select("id, name").in_("id", all_svc_ids).execute()
        services_map = {s["id"]: s["name"] for s in (svcs.data or [])}

    # Batch-fetch masters
    master_ids = list({b["master_id"] for b in bookings.data if b.get("master_id")})
    masters_map: dict[str, str] = {}
    if master_ids:
        ms = sb.table("masters").select("id, display_name").in_("id", master_ids).execute()
        masters_map = {m["id"]: m["display_name"] for m in (ms.data or [])}

    result = []
    for b in bookings.data:
        dt_utc = datetime.fromisoformat(b["preferred_datetime"].replace("Z", "+00:00"))
        dt_local = dt_utc.astimezone(tz)
        svc_names = [services_map.get(sid, "Услуга") for sid in (b.get("service_ids") or [])]
        result.append({
            "id": b["id"],
            "booking_code": b.get("booking_code") or "",
            "status": b["status"],
            "datetime_iso": dt_local.strftime("%Y-%m-%dT%H:%M:%S"),
            "datetime_display": dt_local.strftime("%d.%m.%Y, %H:%M"),
            "total_price": b["total_price"],
            "total_duration_minutes": b.get("total_duration_minutes") or 0,
            "service_names": svc_names,
            "master_name": masters_map.get(b.get("master_id") or "", None),
            "created_at": b["created_at"],
        })
    return result


def _cancel_booking_sync(
    tenant_id: str, booking_id: str, contact_type: str, contact_value: str
) -> dict:
    sb = get_supabase()

    row = (
        sb.table("bookings")
        .select(
            "id, status, client_id, preferred_datetime, service_ids, "
            "master_id, total_price, booking_code"
        )
        .eq("id", booking_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    )
    if not row.data:
        return {"error": "not_found"}

    b = row.data[0]
    if b["status"] in ("completed", "cancelled"):
        return {"error": "already_final", "status": b["status"]}

    # Verify ownership via client contact
    if b.get("client_id"):
        cl = (
            sb.table("clients")
            .select("contact_type, contact_value")
            .eq("id", b["client_id"])
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if cl.data:
            c = cl.data[0]
            if c["contact_type"] != contact_type or c["contact_value"].strip().lower() != contact_value.strip().lower():
                return {"error": "not_owner"}

    sb.table("bookings").update({"status": "cancelled"}).eq("id", booking_id).execute()
    return {"ok": True, "booking": b}


@router.post("/my-bookings/lookup")
@limiter.limit("30/minute")
async def lookup_my_bookings(data: BookingLookupRequest, request: Request):
    if not data.contact_value.strip():
        raise HTTPException(400, "Укажите контакт")
    bookings = await run_sync(
        _lookup_bookings_sync, data.tenant_id, data.contact_type, data.contact_value
    )
    return {"bookings": bookings}


@router.post("/my-bookings/cancel")
@limiter.limit("10/minute")
async def cancel_my_booking(data: BookingCancelRequest, request: Request):
    result = await run_sync(
        _cancel_booking_sync,
        data.tenant_id, data.booking_id, data.contact_type, data.contact_value,
    )

    if result.get("error") == "not_found":
        raise HTTPException(404, "Запись не найдена")
    if result.get("error") == "not_owner":
        raise HTTPException(403, "Контакт не совпадает с записью")
    if result.get("error") == "already_final":
        raise HTTPException(400, f"Нельзя отменить — запись уже {result.get('status')}")

    # Notify admins via Telegram (best-effort)
    try:
        from app.bot.notifications import _get_bot, _fetch_crm_notify_ids_sync
        bk = result["booking"]
        bot = await _get_bot(data.tenant_id)
        if bot:
            notify_ids = await run_sync(_fetch_crm_notify_ids_sync, data.tenant_id, bk.get("master_id"))
            code = bk.get("booking_code") or ""
            code_line = f"🔖 <code>{code}</code>\n" if code else ""
            text = (
                f"❌ <b>Клиент отменил запись</b>\n"
                f"{code_line}"
                f"📋 ID: <code>{bk['id'][:8]}</code>"
            )
            for admin_id in notify_ids:
                try:
                    await bot.send_message(chat_id=admin_id, text=text, parse_mode="HTML")
                except Exception:
                    pass
    except Exception as e:
        logger.warning("Admin cancel notify failed: %s", e)

    return {"ok": True}
