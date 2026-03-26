import logging
from html import escape

from aiogram import Router, F
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import CommandStart
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message

from app.bot.async_db import run_sync
from app.core.database import get_supabase

logger = logging.getLogger(__name__)
router = Router()


def _get_user_sync(telegram_user_id: int) -> dict | None:
    sb = get_supabase()
    result = (
        sb.table("users")
        .select("id, tenant_id, role, name")
        .eq("telegram_user_id", telegram_user_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def _tenant_name_sync(tenant_id: str) -> str:
    sb = get_supabase()
    tenant = (
        sb.table("tenants")
        .select("name")
        .eq("id", tenant_id)
        .limit(1)
        .execute()
    )
    return tenant.data[0]["name"] if tenant.data else "Салон"


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

    sb = get_supabase()
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
        text = f"📋 <b>Записи на {today.strftime('%d.%m.%Y')}</b>\n\n"
        for b in bd:
            dt = datetime.fromisoformat(b["preferred_datetime"].replace("Z", "+00:00"))
            status_emoji = {
                "pending": "🟡",
                "waiting": "⏳",
                "confirmed": "✅",
                "completed": "✔️",
                "cancelled": "❌",
            }
            emoji = status_emoji.get(b["status"], "❓")
            price = b["total_price"] // 100
            client_name = "—"
            if b.get("client_id"):
                cl = sb.table("clients").select("name").eq("id", b["client_id"]).limit(1).execute()
                if cl.data:
                    client_name = escape(cl.data[0]["name"])
            text += f"{emoji} {dt.strftime('%H:%M')} — {client_name} — {price:,}₸\n"

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
