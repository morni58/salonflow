import logging
from aiogram import Router, F
from aiogram.types import CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from app.services.booking import confirm_booking, cancel_booking, set_booking_waiting, complete_booking

logger = logging.getLogger(__name__)
router = Router()


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
async def on_reschedule(callback: CallbackQuery):
    """Handle 📅 Перенести button."""
    await callback.answer()
    booking_id = callback.data.split(":")[2]

    await callback.message.reply(
        "📅 Напишите новую дату и время в формате:\n"
        f"<code>перенести {booking_id[:8]} 25.03.2026 14:00</code>",
        parse_mode="HTML",
    )
