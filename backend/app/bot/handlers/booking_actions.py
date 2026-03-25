import logging
from aiogram import Router, F
from aiogram.types import CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from app.services.booking import confirm_booking, cancel_booking, set_booking_waiting, complete_booking

logger = logging.getLogger(__name__)
router = Router()


@router.callback_query(F.data.startswith("bk:confirm:"))
async def on_confirm(callback: CallbackQuery):
    """Handle ✅ Оплатил button."""
    await callback.answer()
    booking_id = callback.data.split(":")[2]
    await confirm_booking(booking_id)

    # Show "complete" button for after the visit
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✔️ Визит завершён", callback_data=f"bk:complete:{booking_id}")],
    ])

    await callback.message.edit_reply_markup(reply_markup=None)
    await callback.message.reply(
        "✅ Запись подтверждена. Оплата получена.\n\n"
        "После визита клиента нажмите кнопку ниже:",
        reply_markup=keyboard,
    )


@router.callback_query(F.data.startswith("bk:cancel:"))
async def on_cancel(callback: CallbackQuery):
    """Handle ❌ Не оплатил button."""
    await callback.answer()
    booking_id = callback.data.split(":")[2]
    await cancel_booking(booking_id)

    await callback.message.edit_reply_markup(reply_markup=None)
    await callback.message.reply("❌ Заявка отклонена. Слот освобождён.")


@router.callback_query(F.data.startswith("bk:wait:"))
async def on_wait(callback: CallbackQuery):
    """Handle ⏳ Ожидание button."""
    await callback.answer()
    booking_id = callback.data.split(":")[2]
    await set_booking_waiting(booking_id)

    await callback.message.edit_reply_markup(reply_markup=None)
    await callback.message.reply("⏳ Заявка в ожидании. Автоудаление через 48 часов если не подтверждена.")


@router.callback_query(F.data.startswith("bk:complete:"))
async def on_complete(callback: CallbackQuery):
    """Handle ✔️ Визит завершён button."""
    await callback.answer()
    booking_id = callback.data.split(":")[2]
    await complete_booking(booking_id)

    await callback.message.edit_reply_markup(reply_markup=None)
    await callback.message.reply("✔️ Визит завершён. Статистика клиента обновлена.")


@router.callback_query(F.data.startswith("bk:reschedule:"))
async def on_reschedule(callback: CallbackQuery):
    """Handle 📅 Перенести button."""
    await callback.answer()
    booking_id = callback.data.split(":")[2]

    await callback.message.reply(
        "📅 Напишите новую дату и время в формате:\n"
        f"<code>перенести {booking_id[:8]} 25.03.2026 14:00</code>",
        parse_mode="HTML",
    )
