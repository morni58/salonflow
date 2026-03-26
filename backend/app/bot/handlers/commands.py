"""Slash-команды: быстрый доступ к разделам без кнопок меню."""
from __future__ import annotations

import logging

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message

from app.bot.async_db import run_sync
from app.bot.command_list import HELP_TEXT, HELP_TEXT_NO_ACCESS
from app.bot.handlers.catalog_mgmt import _catalog_categories_kb_sync
from app.bot.handlers.crm_export import _crm_keyboard, _crm_summary_sync, _get_user_tenant_role_sync
from app.bot.handlers.management import _schedule_menu_kb
from app.bot.permissions import can_crm, can_site
from app.bot.handlers.site_settings import site_menu_keyboard
from app.bot.handlers.start import (
    _bookings_text_and_keyboard_sync,
    _get_user_sync,
    _main_menu,
    _tenant_name_sync,
)

logger = logging.getLogger(__name__)
router = Router()


def _clients_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🔍 Найти клиента", callback_data="cl:search")],
            [InlineKeyboardButton(text="📊 Топ клиенты", callback_data="cl:top")],
            [InlineKeyboardButton(text="◀️ Назад", callback_data="menu:main")],
        ]
    )


def _portfolio_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📤 Загрузить фото", callback_data="port:upload")],
            [InlineKeyboardButton(text="🗑 Удалить фото", callback_data="port:delete")],
            [InlineKeyboardButton(text="◀️ Назад", callback_data="menu:main")],
        ]
    )


def _reviews_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📤 Загрузить отзыв", callback_data="rev:upload")],
            [InlineKeyboardButton(text="🗑 Удалить отзыв", callback_data="rev:delete")],
            [InlineKeyboardButton(text="◀️ Назад", callback_data="menu:main")],
        ]
    )


def _offline_hint_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📝 Начать оффлайн-запись", callback_data="menu:offline")],
            [InlineKeyboardButton(text="◀️ В меню", callback_data="menu:main")],
        ]
    )


@router.message(Command("help"))
async def cmd_help(message: Message) -> None:
    user = await run_sync(_get_user_sync, message.from_user.id)
    text = HELP_TEXT if user else HELP_TEXT_NO_ACCESS
    await message.answer(text, parse_mode="HTML")


@router.message(Command("menu"))
async def cmd_menu(message: Message) -> None:
    user = await run_sync(_get_user_sync, message.from_user.id)
    if not user:
        await message.answer(HELP_TEXT_NO_ACCESS, parse_mode="HTML")
        return
    tenant_name = await run_sync(_tenant_name_sync, user["tenant_id"])
    await message.answer(
        f"<b>{tenant_name}</b>\nВыберите раздел:",
        parse_mode="HTML",
        reply_markup=_main_menu(user["role"]),
    )


@router.message(Command(commands=["bookings", "today"]))
async def cmd_bookings(message: Message) -> None:
    user = await run_sync(_get_user_sync, message.from_user.id)
    if not user:
        await message.answer(HELP_TEXT_NO_ACCESS, parse_mode="HTML")
        return
    text, kb = await run_sync(
        _bookings_text_and_keyboard_sync,
        user["tenant_id"],
        user["id"],
        user["role"],
    )
    await message.answer(text, parse_mode="HTML", reply_markup=kb)


@router.message(Command("catalog"))
async def cmd_catalog(message: Message) -> None:
    user = await run_sync(_get_user_sync, message.from_user.id)
    if not user:
        await message.answer(HELP_TEXT_NO_ACCESS, parse_mode="HTML")
        return
    kb = await run_sync(_catalog_categories_kb_sync, user["tenant_id"])
    await message.answer(
        "📂 <b>Каталог</b>\nВыберите категорию:",
        parse_mode="HTML",
        reply_markup=kb,
    )


@router.message(Command("schedule"))
async def cmd_schedule(message: Message) -> None:
    user = await run_sync(_get_user_sync, message.from_user.id)
    if not user:
        await message.answer(HELP_TEXT_NO_ACCESS, parse_mode="HTML")
        return
    await message.answer(
        "🗓 <b>Расписание</b>\nВыберите действие:",
        parse_mode="HTML",
        reply_markup=_schedule_menu_kb(),
    )


@router.message(Command("portfolio"))
async def cmd_portfolio(message: Message) -> None:
    user = await run_sync(_get_user_sync, message.from_user.id)
    if not user:
        await message.answer(HELP_TEXT_NO_ACCESS, parse_mode="HTML")
        return
    await message.answer(
        "📸 <b>Портфолио</b>",
        parse_mode="HTML",
        reply_markup=_portfolio_menu_kb(),
    )


@router.message(Command("reviews"))
async def cmd_reviews(message: Message) -> None:
    user = await run_sync(_get_user_sync, message.from_user.id)
    if not user:
        await message.answer(HELP_TEXT_NO_ACCESS, parse_mode="HTML")
        return
    await message.answer(
        "⭐ <b>Отзывы</b>",
        parse_mode="HTML",
        reply_markup=_reviews_menu_kb(),
    )


@router.message(Command("offline"))
async def cmd_offline(message: Message) -> None:
    user = await run_sync(_get_user_sync, message.from_user.id)
    if not user:
        await message.answer(HELP_TEXT_NO_ACCESS, parse_mode="HTML")
        return
    await message.answer(
        "📝 <b>Оффлайн-запись</b>\n"
        "Запись клиента без сайта: имя → услуга → дата и время.\n"
        "Нажмите кнопку ниже или введите данные по шагам из меню.",
        parse_mode="HTML",
        reply_markup=_offline_hint_kb(),
    )


@router.message(Command("clients"))
async def cmd_clients(message: Message) -> None:
    user = await run_sync(_get_user_sync, message.from_user.id)
    if not user:
        await message.answer(HELP_TEXT_NO_ACCESS, parse_mode="HTML")
        return
    await message.answer(
        "👥 <b>Клиенты</b>",
        parse_mode="HTML",
        reply_markup=_clients_menu_kb(),
    )


@router.message(Command("site"))
async def cmd_site(message: Message) -> None:
    tid, role = await run_sync(_get_user_tenant_role_sync, message.from_user.id)
    if not tid or not can_site(role):
        await message.answer(
            "⛔ Раздел «Сайт» доступен только владельцу и администратору.\n/help — справка.",
            parse_mode="HTML",
        )
        return
    await message.answer(
        "🎨 <b>Сайт и оформление</b>\n"
        "Цвета: <code>#hex</code>, <code>rgb()</code>, <code>rgba()</code>.",
        parse_mode="HTML",
        reply_markup=site_menu_keyboard(),
    )


@router.message(Command("crm"))
async def cmd_crm(message: Message) -> None:
    tid, role = await run_sync(_get_user_tenant_role_sync, message.from_user.id)
    if not tid or not can_crm(role):
        await message.answer(
            "⛔ CRM доступен владельцу, администратору и менеджеру.\n/help — справка.",
            parse_mode="HTML",
        )
        return
    text = await run_sync(_crm_summary_sync, tid)
    await message.answer(text, parse_mode="HTML", reply_markup=_crm_keyboard())
