import logging
import re
from datetime import datetime

from aiogram import Router, F
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton, Message

from app.bot.async_db import run_sync
from app.core.database import get_supabase
from app.services.booking import confirm_booking, cancel_booking, set_booking_waiting, complete_booking

logger = logging.getLogger(__name__)
router = Router()


class RescheduleStates(StatesGroup):
    waiting_datetime = State()


def _reschedule_booking_sync(booking_id: str, new_dt: datetime) -> bool:
    """Returns True if found and updated."""
    sb = get_supabase()
    r = sb.table("bookings").select("id").eq("id", booking_id).limit(1).execute()
    if not r.data:
        return False
    sb.table("bookings").update({
        "preferred_datetime": new_dt.isoformat(),
    }).eq("id", booking_id).execute()
    return True


@router.callback_query(F.data.startswith("bk:confirm:"))
async def on_confirm(callback: CallbackQuery):
    """✅ Принять заявку → запись в календаре."""
    await callback.answer()
    booking_id = callback.data.split(":")[2]
    await confirm_booking(booking_id)

    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✔️ Выполнено", callback_data=f"bk:complete:{booking_id}")],
    ])

    await callback.message.edit_reply_markup(reply_markup=None)
    await callback.message.reply(
        "✅ <b>Запись принята.</b> Клиент в календаре.\n\n"
        "После визита нажмите «Выполнено» — учтём в статистике.",
        parse_mode="HTML",
        reply_markup=keyboard,
    )


@router.callback_query(F.data.startswith("bk:cancel:"))
async def on_cancel(callback: CallbackQuery):
    """❌ Отказ — в архив (отмена)."""
    await callback.answer()
    booking_id = callback.data.split(":")[2]
    await cancel_booking(booking_id)

    await callback.message.edit_reply_markup(reply_markup=None)
    await callback.message.reply("❌ Заявка отклонена. Слот снова свободен.")


@router.callback_query(F.data.startswith("bk:wait:"))
async def on_wait(callback: CallbackQuery):
    """Handle ⏳ Ожидание button."""
    await callback.answer()
    booking_id = callback.data.split(":")[2]
    await set_booking_waiting(booking_id)

    await callback.message.edit_reply_markup(reply_markup=None)
    await callback.message.reply(
        "⏳ Заявка в очереди. Напомним по истечении срока ожидания, если не подтвердите."
    )


@router.callback_query(F.data.startswith("bk:complete:"))
async def on_complete(callback: CallbackQuery):
    """Handle ✔️ Визит завершён button."""
    await callback.answer()
    booking_id = callback.data.split(":")[2]
    await complete_booking(booking_id)

    await callback.message.edit_reply_markup(reply_markup=None)
    await callback.message.reply("✔️ Визит выполнен. Статистика клиента обновлена.")


@router.callback_query(F.data.startswith("bk:reschedule:"))
async def on_reschedule(callback: CallbackQuery, state: FSMContext):
    """Handle 📅 Перенести button — запрашивает новую дату через FSM."""
    await callback.answer()
    booking_id = callback.data.split(":")[2]
    await state.set_state(RescheduleStates.waiting_datetime)
    await state.update_data(booking_id=booking_id)

    await callback.message.reply(
        "📅 Введите новую дату и время (ДД.ММ.ГГГГ ЧЧ:ММ):\n"
        "Например: <code>25.03.2026 14:00</code>",
        parse_mode="HTML",
    )


@router.message(RescheduleStates.waiting_datetime)
async def handle_reschedule_datetime(message: Message, state: FSMContext):
    """Parse the new datetime and update the booking."""
    raw = message.text.strip() if message.text else ""
    try:
        new_dt = datetime.strptime(raw, "%d.%m.%Y %H:%M")
    except ValueError:
        await message.reply(
            "❌ Неверный формат. Введите дату и время так:\n"
            "<code>25.03.2026 14:00</code>",
            parse_mode="HTML",
        )
        return

    data = await state.get_data()
    booking_id = data.get("booking_id")
    if not booking_id:
        await state.clear()
        await message.reply("❌ Сессия истекла, попробуйте снова через кнопку «Перенести».")
        return

    ok = await run_sync(_reschedule_booking_sync, booking_id, new_dt)
    await state.clear()

    if not ok:
        await message.reply("❌ Запись не найдена.")
        return

    await message.reply(
        f"✅ Запись перенесена на <b>{new_dt.strftime('%d.%m.%Y %H:%M')}</b>.",
        parse_mode="HTML",
    )
