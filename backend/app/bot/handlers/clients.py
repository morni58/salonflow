import logging
from aiogram import Router, F
from aiogram.types import CallbackQuery, Message
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from app.core.database import get_supabase
from app.bot.notifications import _format_price

logger = logging.getLogger(__name__)
router = Router()


def _get_user_tenant(tg_id: int) -> str | None:
    sb = get_supabase()
    r = sb.table("users").select("tenant_id").eq("telegram_user_id", tg_id).limit(1).execute()
    return r.data[0]["tenant_id"] if r.data else None


class ClientStates(StatesGroup):
    searching = State()
    adding_note = State()


@router.callback_query(F.data == "menu:clients")
async def clients_menu(callback: CallbackQuery, state: FSMContext):
    buttons = [
        [InlineKeyboardButton(text="🔍 Найти клиента", callback_data="cl:search")],
        [InlineKeyboardButton(text="📊 Топ клиенты", callback_data="cl:top")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="menu:main")],
    ]
    await callback.message.edit_text(
        "👥 <b>Клиенты</b>",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )
    await callback.answer()


@router.callback_query(F.data == "cl:search")
async def start_search(callback: CallbackQuery, state: FSMContext):
    await state.set_state(ClientStates.searching)
    await callback.message.reply("🔍 Введите имя или контакт клиента:")
    await callback.answer()


@router.message(ClientStates.searching)
async def process_search(message: Message, state: FSMContext):
    tenant_id = _get_user_tenant(message.from_user.id)
    if not tenant_id:
        await state.clear()
        return

    query = message.text.strip().lower()
    sb = get_supabase()

    # Search by name or contact
    clients = (
        sb.table("clients")
        .select("id, name, contact_type, contact_value, visit_count, total_spent, notes, last_visit")
        .eq("tenant_id", tenant_id)
        .execute()
    )

    # Filter locally (Supabase doesn't support ilike on multiple columns easily)
    matches = [
        c for c in clients.data
        if query in c["name"].lower() or query in c.get("contact_value", "").lower()
    ]

    await state.clear()

    if not matches:
        await message.reply("❌ Клиент не найден.")
        return

    for c in matches[:5]:  # Max 5 results
        avg = c["total_spent"] // c["visit_count"] if c["visit_count"] > 0 else 0
        last = c.get("last_visit", "—")
        if last and last != "—":
            from datetime import datetime
            try:
                last = datetime.fromisoformat(last.replace("Z", "+00:00")).strftime("%d.%m.%Y")
            except (ValueError, TypeError):
                last = "—"

        text = (
            f"👤 <b>{c['name']}</b>\n"
            f"📱 {c['contact_type']}: {c['contact_value']}\n"
            f"📊 Визитов: {c['visit_count']} | "
            f"Всего: {_format_price(c['total_spent'])} | "
            f"Средний: {_format_price(avg)}\n"
            f"📅 Последний визит: {last}\n"
        )
        if c.get("notes"):
            text += f"📝 {c['notes']}\n"

        buttons = [
            [InlineKeyboardButton(text="📝 Заметка", callback_data=f"cl:note:{c['id']}")],
        ]

        await message.reply(
            text,
            parse_mode="HTML",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
        )


@router.callback_query(F.data == "cl:top")
async def top_clients(callback: CallbackQuery):
    tenant_id = _get_user_tenant(callback.from_user.id)
    if not tenant_id:
        await callback.answer("Нет доступа")
        return

    sb = get_supabase()
    clients = (
        sb.table("clients")
        .select("name, visit_count, total_spent")
        .eq("tenant_id", tenant_id)
        .order("total_spent", desc=True)
        .limit(10)
        .execute()
    )

    if not clients.data:
        await callback.message.reply("Клиентов пока нет.")
        await callback.answer()
        return

    text = "🏆 <b>Топ-10 клиентов по сумме</b>\n\n"
    for i, c in enumerate(clients.data, 1):
        text += f"{i}. {c['name']} — {_format_price(c['total_spent'])} ({c['visit_count']} визитов)\n"

    await callback.message.reply(text, parse_mode="HTML")
    await callback.answer()


@router.callback_query(F.data.startswith("cl:note:"))
async def start_note(callback: CallbackQuery, state: FSMContext):
    client_id = callback.data.split(":")[2]
    await state.set_state(ClientStates.adding_note)
    await state.update_data(client_id=client_id)
    await callback.message.reply("📝 Введите заметку для клиента:")
    await callback.answer()


@router.message(ClientStates.adding_note)
async def save_note(message: Message, state: FSMContext):
    data = await state.get_data()
    sb = get_supabase()

    # Get existing notes
    client = sb.table("clients").select("notes, name").eq("id", data["client_id"]).limit(1).execute()
    if not client.data:
        await state.clear()
        return

    existing = client.data[0].get("notes") or ""
    new_note = message.text.strip()
    combined = f"{existing}\n{new_note}".strip() if existing else new_note

    sb.table("clients").update({"notes": combined}).eq("id", data["client_id"]).execute()

    await state.clear()
    await message.reply(f"✅ Заметка сохранена для {client.data[0]['name']}")
