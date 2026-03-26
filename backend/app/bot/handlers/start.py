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
    buttons = [
        [InlineKeyboardButton(text="📋 Заявки", callback_data="menu:bookings")],
        [InlineKeyboardButton(text="📂 Каталог", callback_data="menu:catalog")],
        [InlineKeyboardButton(text="🗓 Расписание", callback_data="menu:schedule")],
        [InlineKeyboardButton(text="📸 Портфолио", callback_data="menu:portfolio")],
        [InlineKeyboardButton(text="⭐ Отзывы", callback_data="menu:reviews")],
        [InlineKeyboardButton(text="📝 Оффлайн-запись", callback_data="menu:offline")],
        [InlineKeyboardButton(text="👥 Клиенты", callback_data="menu:clients")],
    ]
    if role in ("owner", "admin"):
        buttons.append([InlineKeyboardButton(text="📊 CRM и выгрузки", callback_data="menu:crm")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def _bookings_text_and_keyboard_sync(tenant_id: str) -> tuple[str, InlineKeyboardMarkup]:
    from datetime import date, datetime, timedelta

    sb = get_supabase()
    today = date.today()
    tomorrow = today + timedelta(days=1)

    bookings = (
        sb.table("bookings")
        .select("id, preferred_datetime, total_price, status, client_id, service_ids")
        .eq("tenant_id", tenant_id)
        .gte("preferred_datetime", today.isoformat())
        .lt("preferred_datetime", tomorrow.isoformat())
        .order("preferred_datetime")
        .execute()
    )

    if not bookings.data:
        text = "📋 На сегодня записей нет."
    else:
        text = f"📋 <b>Записи на {today.strftime('%d.%m.%Y')}</b>\n\n"
        for b in bookings.data:
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
    role_label = {"owner": "👑 Владелец", "admin": "🔧 Администратор", "master": "✂️ Мастер"}

    await message.answer(
        f"Добро пожаловать в <b>{tenant_name}</b>!\n\n"
        f"Ваша роль: {role_label.get(user['role'], user['role'])}\n"
        f"Выберите действие:",
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
        "Главное меню. Выберите действие:",
        reply_markup=_main_menu(user["role"]),
    )


@router.callback_query(F.data == "menu:bookings")
async def menu_bookings(callback: CallbackQuery):
    await callback.answer()
    user = await run_sync(_get_user_sync, callback.from_user.id)
    if not user:
        await callback.message.edit_text("⛔ Нет доступа.")
        return
    text, keyboard = await run_sync(_bookings_text_and_keyboard_sync, user["tenant_id"])
    await _edit_callback_safe(callback, text, parse_mode="HTML", reply_markup=keyboard)
