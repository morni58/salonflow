import logging
from aiogram import Router, F
from aiogram.exceptions import TelegramBadRequest
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton, Message
from datetime import datetime

from app.bot.async_db import run_sync
from app.core.database import get_supabase
from app.services.booking import confirm_booking, cancel_booking, set_booking_waiting, complete_booking

logger = logging.getLogger(__name__)
router = Router()


class RescheduleStates(StatesGroup):
    waiting_datetime = State()


def _reschedule_booking_sync(booking_id: str, new_dt: datetime) -> bool:
    sb = get_supabase()
    r = sb.table("bookings").select("id").eq("id", booking_id).limit(1).execute()
    if not r.data:
        return False
    sb.table("bookings").update({"preferred_datetime": new_dt.isoformat()}).eq("id", booking_id).execute()
    return True


async def _edit_status(
    callback: CallbackQuery,
    find: str,
    replace: str,
    keyboard: InlineKeyboardMarkup | None,
) -> None:
    """Edit the notification message in-place: swap status header + update buttons."""
    try:
        text = (callback.message.html_text or callback.message.text or "").strip()
        if find not in text:
            return  # this state transition doesn't apply to current message
        updated = text.replace(find, replace, 1)
        await callback.message.edit_text(updated, parse_mode="HTML", reply_markup=keyboard)
    except TelegramBadRequest as e:
        err = str(e).lower()
        if "message is not modified" in err:
            return
        # Fallback: just update the keyboard without touching text
        try:
            await callback.message.edit_reply_markup(reply_markup=keyboard)
        except TelegramBadRequest:
            pass


# Status headers as they appear in html_text
_H_PENDING = "<b>Новая заявка</b> <i>(ожидает решения)</i>"
_H_ACCEPTED = "<b>Заявка принята</b> ✅"
_H_WAITING = "<b>Заявка в очереди</b> ⏳"
_H_CANCELLED = "<b>Заявка отклонена</b> ❌"
_H_COMPLETED = "<b>Визит выполнен</b> ✔️"


@router.callback_query(F.data.startswith("bk:confirm:"))
async def on_confirm(callback: CallbackQuery):
    """✅ Принять заявку → запись в календаре."""
    await callback.answer("✅ Принято")
    booking_id = callback.data.split(":")[2]
    await confirm_booking(booking_id)

    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✔️ Визит выполнен", callback_data=f"bk:complete:{booking_id}")],
    ])
    # May come from pending or waiting state
    await _edit_status(callback, _H_PENDING, _H_ACCEPTED, keyboard)
    await _edit_status(callback, _H_WAITING, _H_ACCEPTED, keyboard)


@router.callback_query(F.data.startswith("bk:cancel:"))
async def on_cancel(callback: CallbackQuery):
    """❌ Отказ — в архив."""
    await callback.answer("❌ Отклонено")
    booking_id = callback.data.split(":")[2]
    await cancel_booking(booking_id)

    await _edit_status(callback, _H_PENDING, _H_CANCELLED, None)
    await _edit_status(callback, _H_WAITING, _H_CANCELLED, None)
    await _edit_status(callback, _H_ACCEPTED, _H_CANCELLED, None)


@router.callback_query(F.data.startswith("bk:wait:"))
async def on_wait(callback: CallbackQuery):
    """⏳ Очередь."""
    await callback.answer("⏳ В очереди")
    booking_id = callback.data.split(":")[2]
    await set_booking_waiting(booking_id)

    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Принять", callback_data=f"bk:confirm:{booking_id}"),
            InlineKeyboardButton(text="❌ Отказать", callback_data=f"bk:cancel:{booking_id}"),
        ],
    ])
    await _edit_status(callback, _H_PENDING, _H_WAITING, keyboard)


@router.callback_query(F.data.startswith("bk:complete:"))
async def on_complete(callback: CallbackQuery):
    """✔️ Визит завершён."""
    await callback.answer("✔️ Готово")
    booking_id = callback.data.split(":")[2]
    await complete_booking(booking_id)
    await _edit_status(callback, _H_ACCEPTED, _H_COMPLETED, None)


@router.callback_query(F.data.startswith("bk:reschedule:"))
async def on_reschedule(callback: CallbackQuery, state: FSMContext):
    """📅 Перенести — запрашивает новую дату."""
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
