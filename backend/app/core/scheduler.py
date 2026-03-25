import logging
from datetime import datetime, timedelta, date
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.core.database import get_supabase

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def _get_all_active_tenants() -> list[str]:
    """Get IDs of all active tenants."""
    sb = get_supabase()
    result = sb.table("tenants").select("id").eq("is_active", True).execute()
    return [t["id"] for t in result.data]


async def job_daily_brief():
    """Send morning brief to all tenants (09:00)."""
    from app.bot.notifications import send_daily_brief
    logger.info("Running daily brief job")

    for tenant_id in _get_all_active_tenants():
        try:
            await send_daily_brief(tenant_id)
        except Exception as e:
            logger.error(f"Daily brief error for {tenant_id}: {e}")


async def job_weekly_analytics():
    """Send weekly analytics to all tenants (Sunday 20:00)."""
    from app.bot.notifications import send_weekly_analytics
    logger.info("Running weekly analytics job")

    for tenant_id in _get_all_active_tenants():
        try:
            await send_weekly_analytics(tenant_id)
        except Exception as e:
            logger.error(f"Weekly analytics error for {tenant_id}: {e}")


async def job_cleanup_expired_waiting():
    """Cancel bookings stuck in 'waiting' past 48h expiry."""
    logger.info("Running expired waiting cleanup")
    sb = get_supabase()

    expired = (
        sb.table("bookings")
        .select("id, tenant_id, client_id")
        .eq("status", "waiting")
        .lt("waiting_expires_at", datetime.utcnow().isoformat())
        .execute()
    )

    for b in expired.data:
        sb.table("bookings").update({"status": "cancelled"}).eq("id", b["id"]).execute()

        # Notify admin
        from app.bot.notifications import _get_bot, _get_admin_ids
        bot = _get_bot(b["tenant_id"])
        if bot:
            admin_ids = _get_admin_ids(b["tenant_id"])
            client_name = "—"
            if b.get("client_id"):
                cl = sb.table("clients").select("name").eq("id", b["client_id"]).limit(1).execute()
                if cl.data:
                    client_name = cl.data[0]["name"]

            for uid in admin_ids:
                try:
                    await bot.send_message(
                        chat_id=uid,
                        text=f"⏰ Заявка ({client_name}) истекла — не оплачена за 48ч. Слот освобождён.",
                    )
                except Exception as e:
                    logger.error(f"Cleanup notify error: {e}")

    if expired.data:
        logger.info(f"Cancelled {len(expired.data)} expired waiting bookings")


async def job_send_reminders():
    """Check and send reminders for upcoming bookings."""
    logger.info("Running reminders check")
    sb = get_supabase()
    now = datetime.utcnow()

    # 24h reminders
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

    # Group by tenant
    by_tenant_24: dict[str, list] = {}
    for b in upcoming_24h.data:
        tid = b["tenant_id"]
        if tid not in by_tenant_24:
            by_tenant_24[tid] = []
        by_tenant_24[tid].append(b)

    for tenant_id, bookings in by_tenant_24.items():
        from app.bot.notifications import _get_bot, _get_admin_ids, _format_price
        bot = _get_bot(tenant_id)
        if not bot:
            continue

        text = f"🔔 <b>Записи на завтра</b>\n\n"
        for b in bookings:
            dt = datetime.fromisoformat(b["preferred_datetime"].replace("Z", "+00:00"))
            client_name = "—"
            if b.get("client_id"):
                cl = sb.table("clients").select("name, contact_type, contact_value").eq("id", b["client_id"]).limit(1).execute()
                if cl.data:
                    c = cl.data[0]
                    client_name = f"{c['name']} ({c['contact_type']}: {c['contact_value']})"

            text += f"  {dt.strftime('%H:%M')} — {client_name} — {_format_price(b['total_price'])}\n"

            # Mark as sent
            sb.table("bookings").update({"reminder_24h_sent": True}).eq("id", b["id"]).execute()

        total = sum(b["total_price"] for b in bookings)
        text += f"\nИтого: {len(bookings)} записей, {_format_price(total)}"

        admin_ids = _get_admin_ids(tenant_id)
        for uid in admin_ids:
            try:
                await bot.send_message(chat_id=uid, text=text, parse_mode="HTML")
            except Exception as e:
                logger.error(f"Reminder 24h error: {e}")

    # 2h reminders (similar logic)
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

    for b in upcoming_2h.data:
        from app.bot.notifications import _get_bot, _get_admin_ids, _format_price
        bot = _get_bot(b["tenant_id"])
        if not bot:
            continue

        dt = datetime.fromisoformat(b["preferred_datetime"].replace("Z", "+00:00"))
        client_name = "—"
        if b.get("client_id"):
            cl = sb.table("clients").select("name").eq("id", b["client_id"]).limit(1).execute()
            if cl.data:
                client_name = cl.data[0]["name"]

        admin_ids = _get_admin_ids(b["tenant_id"])
        for uid in admin_ids:
            try:
                await bot.send_message(
                    chat_id=uid,
                    text=f"⏰ Через 2 часа: {dt.strftime('%H:%M')} — {client_name} — {_format_price(b['total_price'])}",
                )
            except Exception as e:
                logger.error(f"Reminder 2h error: {e}")

        sb.table("bookings").update({"reminder_2h_sent": True}).eq("id", b["id"]).execute()


def setup_scheduler():
    """Configure and start the scheduler."""
    # Daily brief at 09:00 (Almaty = UTC+5, so 04:00 UTC)
    scheduler.add_job(job_daily_brief, "cron", hour=4, minute=0, id="daily_brief")

    # Weekly analytics Sunday 20:00 Almaty = 15:00 UTC
    scheduler.add_job(job_weekly_analytics, "cron", day_of_week="sun", hour=15, minute=0, id="weekly_analytics")

    # Cleanup expired waiting every 6 hours
    scheduler.add_job(job_cleanup_expired_waiting, "interval", hours=6, id="cleanup_waiting")

    # Reminders check every hour
    scheduler.add_job(job_send_reminders, "interval", hours=1, id="reminders")

    scheduler.start()
    logger.info("Scheduler started with 4 jobs")
