"""Настройка сайта из Telegram: цвета, тексты, контакты, лого."""
from __future__ import annotations

import json
import logging
import re

from aiogram import F, Router
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from app.bot.async_db import run_sync
from app.core.database import get_supabase
from app.core.tenant_fields import normalize_contact_json, normalize_site_content

logger = logging.getLogger(__name__)
router = Router()


class SiteStates(StatesGroup):
    waiting_value = State()


def _get_user_tenant_sync(telegram_user_id: int) -> tuple[str | None, str | None]:
    sb = get_supabase()
    result = (
        sb.table("users")
        .select("tenant_id, role")
        .eq("telegram_user_id", telegram_user_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        return None, None
    return result.data[0]["tenant_id"], result.data[0].get("role")


def _can_site(role: str | None) -> bool:
    return role in ("owner", "admin")


def site_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🎨 Цвета (hex / rgb)", callback_data="site:colors")],
            [InlineKeyboardButton(text="📝 Тексты главной", callback_data="site:texts")],
            [InlineKeyboardButton(text="📞 Контакты (футер)", callback_data="site:contacts")],
            [InlineKeyboardButton(text="🖼 Лого (ссылка)", callback_data="site:logo")],
            [InlineKeyboardButton(text="◀️ Назад", callback_data="menu:main")],
        ]
    )


def _patch_site_content_sync(tenant_id: str, patch: dict) -> None:
    sb = get_supabase()
    row = sb.table("tenants").select("site_content").eq("id", tenant_id).limit(1).execute()
    cur = normalize_site_content(row.data[0].get("site_content") if row.data else {})
    cur.update({k: v for k, v in patch.items() if v is not None})
    sb.table("tenants").update({"site_content": cur}).eq("id", tenant_id).execute()


def _patch_contact_sync(tenant_id: str, data: dict) -> None:
    sb = get_supabase()
    row = sb.table("tenants").select("contact_json").eq("id", tenant_id).limit(1).execute()
    cur = normalize_contact_json(row.data[0].get("contact_json") if row.data else {})
    cur.update(data)
    sb.table("tenants").update({"contact_json": cur}).eq("id", tenant_id).execute()


_COLOR_RE = re.compile(
    r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$|^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*[\d.]+\s*)?\)$",
)


def _validate_color(s: str) -> bool:
    t = s.strip()
    if not t:
        return False
    if _COLOR_RE.match(t):
        return True
    # rgb с пробелами: rgb(195 144 119)
    if t.startswith("rgb") and ")" in t:
        return True
    return False


@router.callback_query(F.data == "menu:site")
async def site_menu(callback: CallbackQuery):
    await callback.answer()
    tid, role = await run_sync(_get_user_tenant_sync, callback.from_user.id)
    if not tid or not _can_site(role):
        await callback.message.edit_text("⛔ Доступно только владельцу и администратору.")
        return
    await callback.message.edit_text(
        "🎨 <b>Сайт и оформление</b>\n"
        "Цвета можно задавать как <code>#c39077</code>, <code>rgb(195, 144, 119)</code> или "
        "<code>rgba(195,144,119,0.9)</code>.",
        parse_mode="HTML",
        reply_markup=site_menu_keyboard(),
    )


@router.callback_query(F.data == "site:colors")
async def site_colors(callback: CallbackQuery):
    await callback.answer()
    tid, role = await run_sync(_get_user_tenant_sync, callback.from_user.id)
    if not tid or not _can_site(role):
        return
    sb = get_supabase()
    r = (
        sb.table("tenants")
        .select("color_primary, color_accent, color_bg, color_text")
        .eq("id", tid)
        .limit(1)
        .execute()
    )
    row = r.data[0] if r.data else {}
    text = (
        "🎨 <b>Цвета темы</b>\n\n"
        f"primary: <code>{row.get('color_primary', '')}</code>\n"
        f"accent: <code>{row.get('color_accent', '')}</code>\n"
        f"фон: <code>{row.get('color_bg', '')}</code>\n"
        f"текст: <code>{row.get('color_text', '')}</code>\n\n"
        "Выберите, что изменить, и отправьте новое значение сообщением."
    )
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Primary", callback_data="site:col:primary")],
            [InlineKeyboardButton(text="Accent", callback_data="site:col:accent")],
            [InlineKeyboardButton(text="Фон", callback_data="site:col:bg")],
            [InlineKeyboardButton(text="Текст", callback_data="site:col:text")],
            [InlineKeyboardButton(text="◀️ Назад", callback_data="menu:site")],
        ]
    )
    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=kb)


@router.callback_query(F.data.startswith("site:col:"))
async def site_color_pick(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    key = callback.data.split(":")[2]
    field = {
        "primary": "color_primary",
        "accent": "color_accent",
        "bg": "color_bg",
        "text": "color_text",
    }.get(key)
    if not field:
        return
    await state.set_state(SiteStates.waiting_value)
    await state.update_data(site_field=field, site_kind="color")
    await callback.message.reply(f"Отправьте цвет для <b>{field}</b> (hex или rgb):", parse_mode="HTML")


@router.callback_query(F.data == "site:texts")
async def site_texts_menu(callback: CallbackQuery):
    await callback.answer()
    tid, role = await run_sync(_get_user_tenant_sync, callback.from_user.id)
    if not tid or not _can_site(role):
        return
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Бейдж (над заголовком)", callback_data="site:tx:hero_badge")],
            [InlineKeyboardButton(text="Заголовок — строка 1", callback_data="site:tx:hero_title_line1")],
            [InlineKeyboardButton(text="Заголовок — акцент", callback_data="site:tx:hero_title_accent")],
            [InlineKeyboardButton(text="Подзаголовок", callback_data="site:tx:hero_subtitle")],
            [InlineKeyboardButton(text="URL картинки hero", callback_data="site:tx:hero_image_url")],
            [InlineKeyboardButton(text="Кнопка «Услуги»", callback_data="site:tx:hero_cta_primary")],
            [InlineKeyboardButton(text="Кнопка «Портфолио»", callback_data="site:tx:hero_cta_secondary")],
            [
                InlineKeyboardButton(
                    text="Преимущества (JSON-массив)",
                    callback_data="site:tx:advantages",
                )
            ],
            [InlineKeyboardButton(text="➕ Ещё: заголовки секций и меню", callback_data="site:texts_more")],
            [InlineKeyboardButton(text="◀️ Назад", callback_data="menu:site")],
        ]
    )
    await callback.message.edit_text(
        "📝 Выберите поле и отправьте новый текст следующим сообщением.",
        reply_markup=kb,
    )


@router.callback_query(F.data == "site:texts_more")
async def site_texts_more(callback: CallbackQuery):
    await callback.answer()
    tid, role = await run_sync(_get_user_tenant_sync, callback.from_user.id)
    if not tid or not _can_site(role):
        return
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Секция «Услуги»", callback_data="site:tx:section_catalog")],
            [InlineKeyboardButton(text="Подзаголовок каталога", callback_data="site:tx:section_catalog_subtitle")],
            [InlineKeyboardButton(text="Секция «Портфолио»", callback_data="site:tx:section_portfolio")],
            [InlineKeyboardButton(text="Подзаголовок портфолио", callback_data="site:tx:portfolio_subtitle")],
            [InlineKeyboardButton(text="Секция «Отзывы»", callback_data="site:tx:section_reviews")],
            [InlineKeyboardButton(text="Меню: Услуги", callback_data="site:tx:nav_catalog")],
            [InlineKeyboardButton(text="Меню: О нас", callback_data="site:tx:nav_advantages")],
            [InlineKeyboardButton(text="Меню: Портфолио", callback_data="site:tx:nav_portfolio")],
            [InlineKeyboardButton(text="Меню: Отзывы", callback_data="site:tx:nav_reviews")],
            [InlineKeyboardButton(text="Рейтинг в hero (цифры)", callback_data="site:tx:hero_rating_text")],
            [InlineKeyboardButton(text="Подпись под рейтингом", callback_data="site:tx:hero_rating_sub")],
            [InlineKeyboardButton(text="Meta description (SEO)", callback_data="site:tx:meta_description")],
            [InlineKeyboardButton(text="◀️ К текстам главной", callback_data="site:texts")],
        ]
    )
    await callback.message.edit_text("📝 Дополнительные тексты:", reply_markup=kb)


@router.callback_query(F.data.startswith("site:tx:"))
async def site_text_pick(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    field = callback.data.split(":")[2]
    await state.set_state(SiteStates.waiting_value)
    await state.update_data(site_field=field, site_kind="site_content")
    await callback.message.reply(f"Отправьте текст для поля <code>{field}</code>:", parse_mode="HTML")


@router.callback_query(F.data == "site:contacts")
async def site_contacts(callback: CallbackQuery):
    await callback.answer()
    tid, role = await run_sync(_get_user_tenant_sync, callback.from_user.id)
    if not tid or not _can_site(role):
        return
    sb = get_supabase()
    r = sb.table("tenants").select("contact_json").eq("id", tid).limit(1).execute()
    raw = r.data[0].get("contact_json") if r.data else {}
    pretty = json.dumps(raw, ensure_ascii=False, indent=2) if raw else "{}"
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="✏️ Отправить новый JSON", callback_data="site:contact:paste")],
            [InlineKeyboardButton(text="◀️ Назад", callback_data="menu:site")],
        ]
    )
    await callback.message.edit_text(
        "📞 <b>Контакты для футера</b>\n\n"
        "Формат JSON (пример):\n"
        "<pre>"
        '{"phones":[{"label":"+7 …","href":"tel:+7…"}],'
        '"telegram":"https://t.me/…",'
        '"whatsapp":"https://wa.me/…",'
        '"instagram":"https://instagram.com/…",'
        '"address":"Алматы, …"}'
        "</pre>\n\n"
        f"<b>Сейчас:</b>\n<pre>{pretty[:3500]}</pre>",
        parse_mode="HTML",
        reply_markup=kb,
    )


@router.callback_query(F.data == "site:contact:paste")
async def site_contact_paste(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.set_state(SiteStates.waiting_value)
    await state.update_data(site_kind="contact_json")
    await callback.message.reply(
        "Отправьте один JSON-объект целиком. Он заменит текущие контакты в футере.",
    )


@router.callback_query(F.data == "site:logo")
async def site_logo(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.set_state(SiteStates.waiting_value)
    await state.update_data(site_kind="logo_url")
    await callback.message.reply("Отправьте <b>прямую ссылку</b> на лого (https://…):", parse_mode="HTML")


@router.message(SiteStates.waiting_value)
async def site_process_value(message: Message, state: FSMContext):
    data = await state.get_data()
    kind = data.get("site_kind")
    tenant_id, role = await run_sync(_get_user_tenant_sync, message.from_user.id)
    if not tenant_id or not _can_site(role):
        await state.clear()
        await message.reply("⛔ Нет доступа.")
        return

    text = (message.text or "").strip()

    if kind == "color":
        field = data.get("site_field")
        if not field or not _validate_color(text):
            await message.reply("❌ Нужен цвет: #RRGGBB, #RGB или rgb(...)/rgba(...)")
            return

        def _u():
            sb = get_supabase()
            sb.table("tenants").update({field: text}).eq("id", tenant_id).execute()

        await run_sync(_u)
        await state.clear()
        await message.reply(f"✅ {field} = {text}")
        return

    if kind == "site_content":
        field = data.get("site_field")
        if not field:
            await state.clear()
            return
        if field == "advantages":
            try:
                arr = json.loads(text)
            except json.JSONDecodeError:
                await message.reply("❌ Нужен JSON-массив, например [{\"icon\":\"sparkle\",\"title\":\"...\",\"text\":\"...\"}]")
                return
            if not isinstance(arr, list):
                await message.reply("❌ Нужен массив [...]")
                return
            await run_sync(_patch_site_content_sync, tenant_id, {"advantages": arr})
        else:
            await run_sync(_patch_site_content_sync, tenant_id, {field: text})
        await state.clear()
        await message.reply("✅ Текст на сайте обновлён.")
        return

    if kind == "contact_json":
        try:
            obj = json.loads(text)
        except json.JSONDecodeError:
            await message.reply("❌ Невалидный JSON. Попробуйте снова.")
            return
        if not isinstance(obj, dict):
            await message.reply("❌ Нужен JSON-объект {...}")
            return

        def _u():
            sb = get_supabase()
            sb.table("tenants").update({"contact_json": obj}).eq("id", tenant_id).execute()

        await run_sync(_u)
        await state.clear()
        await message.reply("✅ Контакты обновлены.")
        return

    if kind == "logo_url":
        if not text.startswith("http://") and not text.startswith("https://"):
            await message.reply("❌ Нужна ссылка https://…")
            return

        def _u():
            sb = get_supabase()
            sb.table("tenants").update({"logo_url": text}).eq("id", tenant_id).execute()

        await run_sync(_u)
        await state.clear()
        await message.reply("✅ Лого обновлено.")
        return

    await state.clear()
