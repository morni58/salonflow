import logging
from datetime import date, datetime, timedelta

from aiogram import Bot
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

from app.core.async_utils import run_sync
from app.core.database import get_supabase

logger = logging.getLogger(__name__)

# Cache of active Bot instances per tenant
_bots: dict[str, Bot] = {}


def _fetch_bot_token_sync(tenant_id: str) -> str | None:
    sb = get_supabase()
    tenant = (
        sb.table("tenants")
        .select("bot_token_encrypted")
        .eq("id", tenant_id)
        .limit(1)
        .execute()
    )
    if not tenant.data or not tenant.data[0].get("bot_token_encrypted"):
        return None
    token = tenant.data[0]["bot_token_encrypted"]
    try:
        from app.core.encryption import decrypt
        token = decrypt(token)
    except Exception:
        pass
    return token


async def _get_bot(tenant_id: str) -> Bot | None:
    """Получить Bot: кэш в основном потоке, токен из БД — в thread pool."""
    if tenant_id in _bots:
        return _bots[tenant_id]
    token = await run_sync(_fetch_bot_token_sync, tenant_id)
    if not token:
        return None
    bot = Bot(token=token)
    _bots[tenant_id] = bot
    return bot


def _fetch_admin_ids_sync(tenant_id: str) -> list[int]:
    sb = get_supabase()
    users = (
        sb.table("users")
        .select("telegram_user_id")
        .eq("tenant_id", tenant_id)
        .in_("role", ["owner", "admin"])
        .execute()
    )
    return [u["telegram_user_id"] for u in users.data]


async def _get_admin_ids(tenant_id: str) -> list[int]:
    return await run_sync(_fetch_admin_ids_sync, tenant_id)


def _format_contact_link(contact_type: str, contact_value: str) -> str:
    """Format contact as clickable link."""
    if contact_type == "telegram":
        handle = contact_value.lstrip("@")
        return f'<a href="https://t.me/{handle}">@{handle}</a>'
    elif contact_type == "whatsapp":
        phone = contact_value.replace("+", "").replace(" ", "")
        return f'<a href="https://wa.me/{phone}">{contact_value}</a>'
    elif contact_type == "instagram":
        handle = contact_value.lstrip("@")
        return f'<a href="https://instagram.com/{handle}">@{handle}</a>'
    else:
        return contact_value


def _format_price(price_tiyn: int) -> str:
    """Format price from tiyn to tenge with separator."""
    tenge = price_tiyn // 100
    return f"{tenge:,}₸".replace(",", " ")


async def send_booking_notification(
    tenant_id: str,
    booking_id: str,
    client_name: str,
    contact_type: str,
    contact_value: str,
    service_names: list[str],
    total_price: int,
    total_duration: int,
    preferred_datetime: datetime,
    client_info: dict | None = None,
    ai_summary: str | None = None,
) -> None:
    """Send new booking notification to tenant admins."""
    bot = await _get_bot(tenant_id)
    if not bot:
        logger.warning(f"No bot configured for tenant {tenant_id}")
        return

    admin_ids = await _get_admin_ids(tenant_id)
    if not admin_ids:
        logger.warning(f"No admins for tenant {tenant_id}")
        return

    contact_link = _format_contact_link(contact_type, contact_value)
    services_text = "\n".join(f"  • {name}" for name in service_names)
    dt_str = preferred_datetime.strftime("%d.%m.%Y, %H:%M")
    hours = total_duration // 60
    mins = total_duration % 60
    duration_str = f"{hours}ч {mins}мин" if hours else f"{mins}мин"

    text = (
        f"📋 <b>Новая заявка</b>\n\n"
        f"👤 {client_name}\n"
        f"📱 {contact_type.capitalize()}: {contact_link}\n"
        f"💇 Услуги:\n{services_text}\n"
        f"💰 Итого: <b>{_format_price(total_price)}</b>\n"
        f"🕐 {dt_str}\n"
        f"⏱ {duration_str}\n"
    )

    if client_info and client_info.get("visit_count", 0) > 0:
        avg = client_info["total_spent"] // client_info["visit_count"] if client_info["visit_count"] > 0 else 0
        text += (
            f"\n⚡ <b>Постоянный клиент!</b>\n"
            f"  Визитов: {client_info['visit_count']} | "
            f"Средний чек: {_format_price(avg)}\n"
        )
        if client_info.get("notes"):
            text += f"  📝 {client_info['notes']}\n"

    if ai_summary:
        text += f"\n💬 <b>AI-выжимка:</b>\n<i>{ai_summary}</i>\n"

    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Оплатил", callback_data=f"bk:confirm:{booking_id}"),
            InlineKeyboardButton(text="❌ Не оплатил", callback_data=f"bk:cancel:{booking_id}"),
        ],
        [
            InlineKeyboardButton(text="⏳ Ожидание", callback_data=f"bk:wait:{booking_id}"),
            InlineKeyboardButton(text="📅 Перенести", callback_data=f"bk:reschedule:{booking_id}"),
        ],
    ])

    for admin_id in admin_ids:
        try:
            await bot.send_message(
                chat_id=admin_id,
                text=text,
                parse_mode="HTML",
                reply_markup=keyboard,
            )
        except Exception as e:
            logger.error(f"Failed to send to admin {admin_id}: {e}")


async def send_alert_notification(
    tenant_id: str,
    session_id: str,
    trigger_message: str,
    context: str,
) -> None:
    """Send urgent alert when trigger words detected in chat."""
    bot = await _get_bot(tenant_id)
    if not bot:
        return

    admin_ids = await _get_admin_ids(tenant_id)

    text = (
        f"🚨 <b>СРОЧНО — Негатив в чате</b>\n\n"
        f"💬 Клиент написал:\n<i>«{trigger_message[:300]}»</i>\n\n"
        f"🤖 AI ответил:\n<i>«{context[:300]}»</i>\n\n"
        f"🔗 Session: <code>{session_id[:8]}</code>"
    )

    for admin_id in admin_ids:
        try:
            await bot.send_message(chat_id=admin_id, text=text, parse_mode="HTML")
        except Exception as e:
            logger.error(f"Failed to send alert to {admin_id}: {e}")


def _build_daily_brief_text_sync(tenant_id: str) -> str:
    sb = get_supabase()
    today = date.today()
    tomorrow = today + timedelta(days=1)

    bookings = (
        sb.table("bookings")
        .select("preferred_datetime, total_price, total_duration_minutes, client_id, status, service_ids")
        .eq("tenant_id", tenant_id)
        .in_("status", ["confirmed"])
        .gte("preferred_datetime", today.isoformat())
        .lt("preferred_datetime", tomorrow.isoformat())
        .order("preferred_datetime")
        .execute()
    )

    waiting = (
        sb.table("bookings")
        .select("id, waiting_expires_at, client_id")
        .eq("tenant_id", tenant_id)
        .eq("status", "waiting")
        .execute()
    )

    total_revenue = sum(b["total_price"] for b in bookings.data)

    text = f"☀️ <b>Доброе утро! План на {today.strftime('%d.%m.%Y')}</b>\n\n"
    text += f"📅 Записей: {len(bookings.data)}\n"
    text += f"💰 Ожидаемая выручка: {_format_price(total_revenue)}\n\n"

    if bookings.data:
        for b in bookings.data:
            dt = datetime.fromisoformat(b["preferred_datetime"].replace("Z", "+00:00"))
            time_str = dt.strftime("%H:%M")

            client_name = "—"
            if b.get("client_id"):
                cl = sb.table("clients").select("name, notes").eq("id", b["client_id"]).limit(1).execute()
                if cl.data:
                    client_name = cl.data[0]["name"]
                    if cl.data[0].get("notes"):
                        client_name += " ⚠️"

            text += f"  {time_str} — {client_name} — {_format_price(b['total_price'])}\n"

    if waiting.data:
        text += f"\n⏳ В ожидании оплаты: {len(waiting.data)} заявок\n"

    return text


async def send_daily_brief(tenant_id: str) -> None:
    """Send morning briefing to owner/admins."""
    bot = await _get_bot(tenant_id)
    if not bot:
        return

    text = await run_sync(_build_daily_brief_text_sync, tenant_id)
    admin_ids = await _get_admin_ids(tenant_id)
    for admin_id in admin_ids:
        try:
            await bot.send_message(chat_id=admin_id, text=text, parse_mode="HTML")
        except Exception as e:
            logger.error(f"Brief send error: {e}")


async def send_weekly_analytics(tenant_id: str) -> None:
    """Send weekly analytics report with AI advice."""
    from app.services.analytics import get_weekly_stats, generate_ai_advice

    bot = await _get_bot(tenant_id)
    if not bot:
        return

    stats = await get_weekly_stats(tenant_id)
    c = stats["current"]
    d = stats["deltas"]

    def delta_str(key: str) -> str:
        val = d.get(key, 0)
        if val > 0:
            return f"(+{val}%)"
        elif val < 0:
            return f"({val}%)"
        return ""

    conv_cart = round(c["cart_opens"] / c["visits"] * 100, 1) if c["visits"] > 0 else 0
    conv_checkout = round(c["checkouts"] / c["cart_opens"] * 100, 1) if c["cart_opens"] > 0 else 0
    conv_confirm = round(c["confirmed_count"] / c["checkouts"] * 100, 1) if c["checkouts"] > 0 else 0

    text = (
        f"📊 <b>Еженедельная сводка</b>\n\n"
        f"<b>Воронка:</b>\n"
        f"  Визиты: {c['visits']} {delta_str('visits')}\n"
        f"  Открыли корзину: {c['cart_opens']} ({conv_cart}%)\n"
        f"  Отправили заявку: {c['checkouts']} ({conv_checkout}%)\n"
        f"  Подтверждено: {c['confirmed_count']} ({conv_confirm}%)\n\n"
        f"💰 Выручка: {_format_price(c['total_revenue'])} {delta_str('total_revenue')}\n"
        f"📈 Средний чек: {_format_price(c['avg_check'])} {delta_str('avg_check')}\n"
    )

    if c.get("top_service_name"):
        text += f"🏆 Топ-услуга: {c['top_service_name']} ({c['top_service_count']} записей)\n"

    text += (
        f"👥 Клиентов: {c['unique_clients']} {delta_str('unique_clients')}\n"
        f"  🆕 Новых: {c.get('new_clients', 0)} | 🔄 Повторных: {c.get('returning_clients', 0)}\n"
    )

    try:
        advice = await generate_ai_advice(tenant_id, stats)
        if advice:
            text += f"\n💡 <b>Совет от AI:</b>\n<i>{advice}</i>\n"
    except Exception as e:
        logger.error(f"AI advice generation failed: {e}")

    admin_ids = await _get_admin_ids(tenant_id)
    for uid in admin_ids:
        try:
            await bot.send_message(chat_id=uid, text=text, parse_mode="HTML")
        except Exception as e:
            logger.error(f"Weekly send error: {e}")
