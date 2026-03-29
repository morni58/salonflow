"""Единое сообщение меню: правим текст/клавиатуру вместо лавины reply."""
from __future__ import annotations

from aiogram.exceptions import TelegramBadRequest
from aiogram.types import InlineKeyboardMarkup, Message


async def safe_edit_text(
    message: Message,
    text: str,
    *,
    parse_mode: str | None = None,
    reply_markup: InlineKeyboardMarkup | None = None,
) -> None:
    """
    Редактирует сообщение с инлайн-меню. Если править нельзя (фото и т.п.) — одно новое сообщение.
    """
    try:
        await message.edit_text(
            text,
            parse_mode=parse_mode,
            reply_markup=reply_markup,
            disable_web_page_preview=True,
        )
    except TelegramBadRequest as e:
        err = str(e).lower()
        if "message is not modified" in err:
            return
        if "message can't be edited" in err or "there is no text" in err:
            await message.answer(text, parse_mode=parse_mode, reply_markup=reply_markup)
            return
        raise
