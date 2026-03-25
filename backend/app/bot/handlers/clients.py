import logging
from aiogram import Router, F
from aiogram.types import CallbackQuery, Message
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from app.bot.async_db import run_sync
from app.bot.notifications import _format_price
from app.core.database import get_supabase

logger = logging.getLogger(__name__)
router = Router()


def _get_user_tenant_sync(tg_id: int) -> str | None:
    sb = get_supabase()
    r = sb.table("users").select("tenant_id").eq("telegram_user_id", tg_id).limit(1).execute()
    return r.data[0]["tenant_id"] if r.data else None


def _fetch_clients_for_tenant_sync(tenant_id: str) -> list[dict]:
    sb = get_supabase()
    clients = (
        sb.table("clients")
        .select("id, name, contact_type, contact_value, visit_count, total_spent, notes, last_visit")
        .eq("tenant_id", tenant_id)
        .execute()
    )
    return clients.data or []


def _top_clients_sync(tenant_id: str) -> list[dict]:
    sb = get_supabase()
    clients = (
        sb.table("clients")
        .select("name, visit_count, total_spent")
        .eq("tenant_id", tenant_id)
        .order("total_spent", desc=True)
        .limit(10)
        .execute()
    )
    return clients.data or []


def _get_client_notes_sync(client_id: str) -> tuple[str | None, str | None]:
    """Returns (name, existing_notes) or (None, None)."""
    sb = get_supabase()
    client = sb.table("clients").select("notes, name").eq("id", client_id).limit(1).execute()
    if not client.data:
        return None, None
    return client.data[0]["name"], client.data[0].get("notes") or ""


def _save_client_note_sync(client_id: str, combined_notes: str) -> str | None:
    sb = get_supabase()
    client = sb.table("clients").select("name").eq("id", client_id).limit(1).execute()
    if not client.data:
        return None
    sb.table("clients").update({"notes": combined_notes}).eq("id", client_id).execute()
    return client.data[0]["name"]


class ClientStates(StatesGroup):
    searching = State()
    adding_note = State()


@router.callback_query(F.data == "menu:clients")
async def clients_menu(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
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


@router.callback_query(F.data == "cl:search")
async def start_search(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.set_state(ClientStates.searching)
    await callback.message.reply("🔍 Введите имя или контакт клиента:")


@router.message(ClientStates.searching)
async def process_search(message: Message, state: FSMContext):
    tenant_id = await run_sync(_get_user_tenant_sync, message.from_user.id)
    if not tenant_id:
        await state.clear()
        return

    query = message.text.strip().lower()
    all_clients = await run_sync(_fetch_clients_for_tenant_sync, tenant_id)

    matches = [
        c for c in all_clients
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
    await callback.answer()
    tenant_id = await run_sync(_get_user_tenant_sync, callback.from_user.id)
    if not tenant_id:
        await callback.message.reply("⛔ Нет доступа.")
        return

    rows = await run_sync(_top_clients_sync, tenant_id)

    if not rows:
        await callback.message.reply("Клиентов пока нет.")
        return

    text = "🏆 <b>Топ-10 клиентов по сумме</b>\n\n"
    for i, c in enumerate(rows, 1):
        text += f"{i}. {c['name']} — {_format_price(c['total_spent'])} ({c['visit_count']} визитов)\n"

    await callback.message.reply(text, parse_mode="HTML")


@router.callback_query(F.data.startswith("cl:note:"))
async def start_note(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    client_id = callback.data.split(":")[2]
    await state.set_state(ClientStates.adding_note)
    await state.update_data(client_id=client_id)
    await callback.message.reply("📝 Введите заметку для клиента:")


@router.message(ClientStates.adding_note)
async def save_note(message: Message, state: FSMContext):
    data = await state.get_data()
    name, existing = await run_sync(_get_client_notes_sync, data["client_id"])
    if not name:
        await state.clear()
        return

    new_note = message.text.strip()
    combined = f"{existing}\n{new_note}".strip() if existing else new_note

    saved = await run_sync(_save_client_note_sync, data["client_id"], combined)
    await state.clear()
    if saved:
        await message.reply(f"✅ Заметка сохранена для {saved}")
