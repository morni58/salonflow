import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.async_utils import run_sync
from app.core.database import get_supabase

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def _get_all_active_tenants_sync() -> list[str]:
    sb = get_supabase()
    result = sb.table("tenants").select("id").eq("is_active", True).execute()
    return [t["id"] for t in result.data]


async def job_daily_brief():
    """Send morning brief to all tenants (09:00)."""
    from app.bot.notifications import send_daily_brief

    logger.info("Running daily brief job")
    tenant_ids = await run_sync(_get_all_active_tenants_sync)
    for tenant_id in tenant_ids:
        try:
            await send_daily_brief(tenant_id)
        except Exception as e:
            logger.error(f"Daily brief error for {tenant_id}: {e}")


async def job_weekly_analytics():
    """Send weekly analytics to all tenants (Sunday 20:00)."""
    from app.bot.notifications import send_weekly_analytics

    logger.info("Running weekly analytics job")
    tenant_ids = await run_sync(_get_all_active_tenants_sync)
    for tenant_id in tenant_ids:
        try:
            await send_weekly_analytics(tenant_id)
        except Exception as e:
            logger.error(f"Weekly analytics error for {tenant_id}: {e}")


def _cleanup_expired_waiting_sync() -> list[dict]:
    sb = get_supabase()
    expired = (
        sb.table("bookings")
        .select("id, tenant_id, client_id")
        .eq("status", "waiting")
        .lt("waiting_expires_at", datetime.utcnow().isoformat())
        .execute()
    )
    rows = []
    for b in expired.data or []:
        sb.table("bookings").update({"status": "cancelled"}).eq("id", b["id"]).execute()
        client_name = "—"
        if b.get("client_id"):
            cl = sb.table("clients").select("name").eq("id", b["client_id"]).limit(1).execute()
            if cl.data:
                client_name = cl.data[0]["name"]
        rows.append({"tenant_id": b["tenant_id"], "client_name": client_name})
    return rows


async def job_cleanup_expired_waiting():
    """Cancel bookings stuck in 'waiting' past 48h expiry."""
    from app.bot.notifications import _get_bot, _get_admin_ids

    logger.info("Running expired waiting cleanup")
    items = await run_sync(_cleanup_expired_waiting_sync)
    for item in items:
        bot = await _get_bot(item["tenant_id"])
        if not bot:
            continue
        admin_ids = await _get_admin_ids(item["tenant_id"])
        for uid in admin_ids:
            try:
                await bot.send_message(
                    chat_id=uid,
                    text=(
                        f"⏰ Заявка ({item['client_name']}) истекла — не оплачена за 48ч. "
                        "Слот освобождён."
                    ),
                )
            except Exception as e:
                logger.error(f"Cleanup notify error: {e}")

    if items:
        logger.info(f"Cancelled {len(items)} expired waiting bookings")


def _reminders_fetch_and_update_sync(now: datetime) -> tuple[list[dict], list[dict]]:
    """Возвращает (список {tenant_id, text} для 24h, список {tenant_id, text} для 2h)."""
    from app.bot.notifications import _format_price

    sb = get_supabase()
    out_24: list[dict] = []
    out_2h: list[dict] = []

    tomorrow_start = now + timedelta(hours=23)
    tomorrow_end = now + timedelta(hours=25)

    upcoming_24h = (
        sb.table("bookings")
        .select("id, tenant_id, preferred_datetime, total_price, client_id, service_ids")
        .eq("status", "confirmed")
        .eq("reminder_24h_sent", False)
        .gte("preferred_datetime", tomorrow_start.isoformat())
        .lte("preferred_datetime", tomorrow_end.isoformat())
        .execute()
    )

    by_tenant_24: dict[str, list] = {}
    for b in upcoming_24h.data or []:
        tid = b["tenant_id"]
        if tid not in by_tenant_24:
            by_tenant_24[tid] = []
        by_tenant_24[tid].append(b)

    for tenant_id, bookings in by_tenant_24.items():
        text = "🔔 <b>Записи на завтра</b>\n\n"
        for b in bookings:
            dt = datetime.fromisoformat(b["preferred_datetime"].replace("Z", "+00:00"))
            client_name = "—"
            if b.get("client_id"):
                cl = sb.table("clients").select("name, contact_type, contact_value").eq("id", b["client_id"]).limit(1).execute()
                if cl.data:
                    c = cl.data[0]
                    client_name = f"{c['name']} ({c['contact_type']}: {c['contact_value']})"

            text += f"  {dt.strftime('%H:%M')} — {client_name} — {_format_price(b['total_price'])}\n"
            sb.table("bookings").update({"reminder_24h_sent": True}).eq("id", b["id"]).execute()

        total = sum(b["total_price"] for b in bookings)
        text += f"\nИтого: {len(bookings)} записей, {_format_price(total)}"
        out_24.append({"tenant_id": tenant_id, "text": text})

    soon_start = now + timedelta(hours=1, minutes=50)
    soon_end = now + timedelta(hours=2, minutes=10)

    upcoming_2h = (
        sb.table("bookings")
        .select("id, tenant_id, preferred_datetime, total_price, client_id")
        .eq("status", "confirmed")
        .eq("reminder_2h_sent", False)
        .gte("preferred_datetime", soon_start.isoformat())
        .lte("preferred_datetime", soon_end.isoformat())
        .execute()
    )

    for b in upcoming_2h.data or []:
        dt = datetime.fromisoformat(b["preferred_datetime"].replace("Z", "+00:00"))
        client_name = "—"
        if b.get("client_id"):
            cl = sb.table("clients").select("name").eq("id", b["client_id"]).limit(1).execute()
            if cl.data:
                client_name = cl.data[0]["name"]

        msg = (
            f"⏰ Через 2 часа: {dt.strftime('%H:%M')} — {client_name} — "
            f"{_format_price(b['total_price'])}"
        )
        sb.table("bookings").update({"reminder_2h_sent": True}).eq("id", b["id"]).execute()
        out_2h.append({"tenant_id": b["tenant_id"], "text": msg})

    return out_24, out_2h


async def job_send_reminders():
    """Check and send reminders for upcoming bookings."""
    from app.bot.notifications import _get_bot, _get_admin_ids

    logger.info("Running reminders check")
    now = datetime.utcnow()
    batch_24, batch_2h = await run_sync(_reminders_fetch_and_update_sync, now)

    for item in batch_24:
        bot = await _get_bot(item["tenant_id"])
        if not bot:
            continue
        admin_ids = await _get_admin_ids(item["tenant_id"])
        for uid in admin_ids:
            try:
                await bot.send_message(chat_id=uid, text=item["text"], parse_mode="HTML")
            except Exception as e:
                logger.error(f"Reminder 24h error: {e}")

    for item in batch_2h:
        bot = await _get_bot(item["tenant_id"])
        if not bot:
            continue
        admin_ids = await _get_admin_ids(item["tenant_id"])
        for uid in admin_ids:
            try:
                await bot.send_message(chat_id=uid, text=item["text"])
            except Exception as e:
                logger.error(f"Reminder 2h error: {e}")


def setup_scheduler():
    """Configure and start the scheduler."""
    scheduler.add_job(job_daily_brief, "cron", hour=4, minute=0, id="daily_brief")
    scheduler.add_job(job_weekly_analytics, "cron", day_of_week="sun", hour=15, minute=0, id="weekly_analytics")
    scheduler.add_job(job_cleanup_expired_waiting, "interval", hours=6, id="cleanup_waiting")
    scheduler.add_job(job_send_reminders, "interval", hours=1, id="reminders")

    scheduler.start()
    logger.info("Scheduler started with 4 jobs")
