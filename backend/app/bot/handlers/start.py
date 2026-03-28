import logging
from html import escape

from aiogram import Router, F
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import CommandStart
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message

from app.bot.async_db import run_sync
from app.bot.cache import get_user_sync as _cached_get_user
from app.core.database import get_supabase

logger = logging.getLogger(__name__)
router = Router()


def _get_user_sync(telegram_user_id: int) -> dict | None:
    return _cached_get_user(telegram_user_id)


def _tenant_name_sync(tenant_id: str) -> str:
    """Cache tenant names to avoid repeated lookups."""
    from app.bot.cache import _USER_CACHE  # reuse module for import, but cache separately
    import time
    _tc = getattr(_tenant_name_sync, "_cache", None)
    if _tc is None:
        _tenant_name_sync._cache = {}
    entry = _tenant_name_sync._cache.get(tenant_id)
    if entry and time.monotonic() - entry[1] < 600:  # 10 min TTL
        return entry[0]
    sb = get_supabase()
    tenant = (
        sb.table("tenants")
        .select("name")
        .eq("id", tenant_id)
        .limit(1)
        .execute()
    )
    name = tenant.data[0]["name"] if tenant.data else "Салон"
    _tenant_name_sync._cache[tenant_id] = (name, time.monotonic())
    return name


def _main_menu(role: str) -> InlineKeyboardMarkup:
    """Главное меню: CRM у владельца, админа и менеджера; мастер — свои записи и график."""
    buttons: list[list[InlineKeyboardButton]] = []
    if role in ("owner", "admin", "manager"):
        buttons.append(
            [
                InlineKeyboardButton(text="📊 CRM", callback_data="menu:crm"),
                InlineKeyboardButton(text="📋 Сегодня", callback_data="menu:bookings"),
            ]
        )
    else:
        buttons.append([InlineKeyboardButton(text="📋 Сегодня", callback_data="menu:bookings")])
    buttons.append(
        [
            InlineKeyboardButton(text="📂 Каталог", callback_data="menu:catalog"),
            InlineKeyboardButton(text="👥 Клиенты", callback_data="menu:clients"),
        ]
    )
    buttons.append([InlineKeyboardButton(text="🗓 Расписание салона", callback_data="menu:schedule")])
    if role == "master":
        buttons.append([InlineKeyboardButton(text="✂️ Мой график", callback_data="menu:myschedule")])
    buttons.extend(
        [
            [InlineKeyboardButton(text="📸 Портфолио", callback_data="menu:portfolio")],
            [InlineKeyboardButton(text="⭐ Отзывы", callback_data="menu:reviews")],
            [InlineKeyboardButton(text="📝 Оффлайн-запись", callback_data="menu:offline")],
        ]
    )
    if role in ("owner", "admin"):
        buttons.append([InlineKeyboardButton(text="🎨 Сайт и контакты", callback_data="menu:site")])
    if role in ("owner", "admin"):
        buttons.append([InlineKeyboardButton(text="🔒 Слоты", callback_data="menu:slot_blocks")])
    if role in ("owner", "admin"):
        buttons.append([InlineKeyboardButton(text="🧑‍💼 Мастера", callback_data="menu:masters_admin")])
    if role in ("owner", "admin"):
        buttons.append([InlineKeyboardButton(text="👥 Персонал", callback_data="menu:staff")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def _master_id_for_user_sync(tenant_id: str, user_internal_id: str) -> str | None:
    sb = get_supabase()
    r = (
        sb.table("masters")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("user_id", user_internal_id)
        .limit(1)
        .execute()
    )
    return r.data[0]["id"] if r.data else None


def _bookings_text_and_keyboard_sync(
    tenant_id: str,
    user_internal_id: str | None = None,
    role: str | None = None,
) -> tuple[str, InlineKeyboardMarkup]:
    from datetime import date, datetime, timedelta
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

    sb = get_supabase()

    # Fetch tenant timezone for correct local time display
    t_row = sb.table("tenants").select("timezone").eq("id", tenant_id).limit(1).execute()
    tz_str = t_row.data[0].get("timezone") if t_row.data else None
    try:
        tz = ZoneInfo(tz_str) if tz_str else ZoneInfo("UTC")
    except (ZoneInfoNotFoundError, Exception):
        tz = ZoneInfo("UTC")

    today = date.today()
    tomorrow = today + timedelta(days=1)

    base = (
        sb.table("bookings")
        .select("id, preferred_datetime, total_price, status, client_id, service_ids, master_id")
        .eq("tenant_id", tenant_id)
        .gte("preferred_datetime", today.isoformat())
        .lt("preferred_datetime", tomorrow.isoformat())
    )
    if role == "master" and user_internal_id:
        mid = _master_id_for_user_sync(tenant_id, user_internal_id)
        if not mid:
            bd: list = []
        else:
            bd = base.eq("master_id", mid).order("preferred_datetime").execute().data or []
    else:
        bd = base.order("preferred_datetime").execute().data or []

    if not bd:
        suffix = " (только к вам)" if role == "master" else ""
        text = f"📋 На сегодня записей нет{suffix}."
    else:
        # Batch fetch clients and services
        client_ids = [b["client_id"] for b in bd if b.get("client_id")]
        all_svc_ids = list({sid for b in bd for sid in (b.get("service_ids") or [])})

        clients_map: dict = {}
        if client_ids:
            cl_res = sb.table("clients").select("id, name, contact_type, contact_value").in_("id", client_ids).execute()
            clients_map = {c["id"]: c for c in (cl_res.data or [])}

        services_map: dict = {}
        if all_svc_ids:
            svc_res = sb.table("services").select("id, name").in_("id", all_svc_ids).execute()
            services_map = {s["id"]: s["name"] for s in (svc_res.data or [])}

        text = f"📋 <b>Записи на {today.strftime('%d.%m.%Y')}</b>\n\n"
        status_emoji = {
            "pending": "🟡",
            "waiting": "⏳",
            "confirmed": "✅",
            "completed": "✔️",
            "cancelled": "❌",
        }
        for b in bd:
            dt = datetime.fromisoformat(b["preferred_datetime"].replace("Z", "+00:00")).astimezone(tz)
            emoji = status_emoji.get(b["status"], "❓")
            price = b["total_price"] // 100

            cl = clients_map.get(b.get("client_id", ""), {})
            client_name = escape(cl.get("name") or "—")
            contact_type = cl.get("contact_type", "")
            contact_value = escape(cl.get("contact_value") or "")

            svc_ids = b.get("service_ids") or []
            svc_names = ", ".join(filter(None, [services_map.get(sid) for sid in svc_ids])) or "—"

            text += (
                f"{emoji} <b>{dt.strftime('%H:%M')}</b> — {client_name}\n"
                f"  📱 {contact_type}: {contact_value}\n"
                f"  💇 {svc_names}\n"
                f"  💰 {price:,}₸\n\n"
            )

    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="◀️ Назад", callback_data="menu:main")]]
    )
    return text, keyboard


async def _edit_callback_safe(callback: CallbackQuery, text: str, **kwargs: object) -> None:
    try:
        await callback.message.edit_text(text, **kwargs)
    except TelegramBadRequest as e:
        if "message is not modified" in str(e).lower():
            return
        raise


@router.message(CommandStart())
async def cmd_start(message: Message):
    user = await run_sync(_get_user_sync, message.from_user.id)
    if not user:
        await message.answer(
            "⛔ У вас нет доступа к этому боту.\n"
            "Обратитесь к владельцу для получения доступа."
        )
        return

    tenant_name = await run_sync(_tenant_name_sync, user["tenant_id"])
    role_label = {
        "owner": "👑 Владелец",
        "admin": "🔧 Администратор",
        "manager": "📋 Менеджер",
        "master": "✂️ Мастер",
    }

    await message.answer(
        f"Добро пожаловать в <b>{tenant_name}</b>!\n\n"
        f"Ваша роль: {role_label.get(user['role'], user['role'])}\n"
        f"Выберите действие или введите <code>/help</code> — список команд.",
        parse_mode="HTML",
        reply_markup=_main_menu(user["role"]),
    )


@router.callback_query(F.data == "menu:main")
async def back_to_menu(callback: CallbackQuery):
    await callback.answer()
    user = await run_sync(_get_user_sync, callback.from_user.id)
    if not user:
        await callback.message.edit_text("⛔ Нет доступа.")
        return
    await _edit_callback_safe(
        callback,
        "Главное меню. Выберите действие или /help — команды.",
        reply_markup=_main_menu(user["role"]),
    )


@router.callback_query(F.data == "menu:bookings")
async def menu_bookings(callback: CallbackQuery):
    await callback.answer()
    user = await run_sync(_get_user_sync, callback.from_user.id)
    if not user:
        await callback.message.edit_text("⛔ Нет доступа.")
        return
    text, keyboard = await run_sync(
        _bookings_text_and_keyboard_sync,
        user["tenant_id"],
        user["id"],
        user["role"],
    )
    await _edit_callback_safe(callback, text, parse_mode="HTML", reply_markup=keyboard)
