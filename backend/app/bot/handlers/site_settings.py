"""Настройка сайта из Telegram: цвета, тексты, контакты, лого."""
from __future__ import annotations

import json
import logging
import re

from aiogram import F, Router
from aiogram.filters import StateFilter
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from app.bot.async_db import run_sync
from app.bot.cache import get_user_sync as _cached_get_user
from app.bot.permissions import can_site
from app.bot.undo import push_undo, pop_undo, has_undo, undo_count
from app.core.database import get_supabase
from app.core.tenant_fields import normalize_contact_json, normalize_site_content

logger = logging.getLogger(__name__)
router = Router()


class SiteStates(StatesGroup):
    waiting_value = State()
    # Step-by-step advantages builder
    waiting_adv_title = State()
    waiting_adv_text = State()
    waiting_adv_icon = State()
    waiting_adv_image = State()


def _get_user_tenant_sync(telegram_user_id: int) -> tuple[str | None, str | None]:
    u = _cached_get_user(telegram_user_id)
    if not u:
        return None, None
    return u["tenant_id"], u.get("role")


def site_menu_keyboard(tenant_id: str | None = None) -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(text="🎨 Цвета (hex / rgb)", callback_data="site:colors")],
        [InlineKeyboardButton(text="📝 Тексты главной", callback_data="site:texts")],
        [InlineKeyboardButton(text="📞 Контакты и адрес", callback_data="site:contacts_quick")],
        [InlineKeyboardButton(text="🖼 Лого (ссылка)", callback_data="site:logo")],
    ]
    if tenant_id and has_undo(tenant_id):
        n = undo_count(tenant_id)
        rows.append([InlineKeyboardButton(text=f"↩️ Отменить ({n})", callback_data="site:undo")])
    rows.append([InlineKeyboardButton(text="◀️ Назад", callback_data="menu:main")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


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


def _normalize_contact_value(key: str, value: str) -> str:
    """Normalize contact value to proper URL format."""
    import re as _re
    v = value.strip()
    if key == "telegram":
        # @username or username → https://t.me/username
        # already a URL → keep
        if v.startswith("https://t.me/") or v.startswith("http://t.me/"):
            return v
        handle = v.lstrip("@").strip()
        if handle:
            return f"https://t.me/{handle}"
        return v
    elif key == "whatsapp":
        # +7 707 123 4567 or just digits → https://wa.me/77071234567
        if v.startswith("https://wa.me/") or v.startswith("http://wa.me/"):
            return v
        digits = _re.sub(r"[^\d]", "", v)
        if digits:
            return f"https://wa.me/{digits}"
        return v
    elif key == "instagram":
        # @username or username → https://instagram.com/username
        if v.startswith("https://instagram.com/") or v.startswith("https://www.instagram.com/"):
            return v
        handle = v.lstrip("@").strip()
        if handle:
            return f"https://instagram.com/{handle}"
        return v
    return v


def _patch_contact_key_sync(tenant_id: str, key: str, value: str) -> None:
    import re

    sb = get_supabase()
    row = sb.table("tenants").select("contact_json").eq("id", tenant_id).limit(1).execute()
    cur = normalize_contact_json(row.data[0].get("contact_json") if row.data else {})
    if key == "phone_main":
        digits = re.sub(r"[^\d+]", "", value)
        href = f"tel:{digits}" if digits else value
        phones = list(cur.get("phones") or [])
        label = value.strip()[:80]
        entry = {"label": label, "href": href}
        if phones:
            phones[0] = entry
        else:
            phones = [entry]
        cur["phones"] = phones
    elif key in ("telegram", "whatsapp", "instagram"):
        cur[key] = _normalize_contact_value(key, value)
    else:
        cur[key] = value.strip()
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
    if not tid or not can_site(role):
        await callback.message.edit_text("⛔ Доступно только владельцу и администратору.")
        return
    await callback.message.edit_text(
        "🎨 <b>Сайт и оформление</b>\n"
        "Цвета можно задавать как <code>#c39077</code>, <code>rgb(195, 144, 119)</code> или "
        "<code>rgba(195,144,119,0.9)</code>.",
        parse_mode="HTML",
        reply_markup=site_menu_keyboard(tid),
    )


@router.callback_query(F.data == "site:colors")
async def site_colors(callback: CallbackQuery):
    await callback.answer()
    tid, role = await run_sync(_get_user_tenant_sync, callback.from_user.id)
    if not tid or not can_site(role):
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
    if not tid or not can_site(role):
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
            [InlineKeyboardButton(text="⭐ Преимущества", callback_data="site:adv_menu")],
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
    if not tid or not can_site(role):
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
            [InlineKeyboardButton(text="Бейдж блока «Почему нас»", callback_data="site:tx:advantages_badge")],
            [InlineKeyboardButton(text="Заголовок «Почему нас» (часть 1)", callback_data="site:tx:advantages_title_before")],
            [InlineKeyboardButton(text="Заголовок — акцент (часть 2)", callback_data="site:tx:advantages_title_accent")],
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
    if not tid or not can_site(role):
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


@router.callback_query(F.data == "site:contacts_quick")
async def site_contacts_quick(callback: CallbackQuery):
    await callback.answer()
    tid, role = await run_sync(_get_user_tenant_sync, callback.from_user.id)
    if not tid or not can_site(role):
        return
    tid2, _ = await run_sync(_get_user_tenant_sync, callback.from_user.id)
    sb2 = get_supabase()
    cr = sb2.table("tenants").select("contact_json").eq("id", tid2).limit(1).execute() if tid2 else None
    cj = normalize_contact_json(cr.data[0].get("contact_json") if cr and cr.data else {})
    tg_now = cj.get("telegram", "—")
    wa_now = cj.get("whatsapp", "—")
    ig_now = cj.get("instagram", "—")
    addr_now = cj.get("address", "—")
    phones = cj.get("phones") or []
    phone_now = phones[0].get("label", "—") if phones else "—"

    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=f"✈️ Telegram: {tg_now[:30]}", callback_data="site:cq:telegram")],
            [InlineKeyboardButton(text=f"💬 WhatsApp: {wa_now[:30]}", callback_data="site:cq:whatsapp")],
            [InlineKeyboardButton(text=f"📸 Instagram: {ig_now[:30]}", callback_data="site:cq:instagram")],
            [InlineKeyboardButton(text=f"📞 Телефон: {phone_now[:30]}", callback_data="site:cq:phone_main")],
            [InlineKeyboardButton(text=f"📍 Адрес: {addr_now[:30]}", callback_data="site:cq:address")],
            [InlineKeyboardButton(text="◀️ К настройкам сайта", callback_data="menu:site")],
        ]
    )
    await callback.message.edit_text(
        "📞 <b>Контакты и адрес</b>\n\n"
        "Нажмите на поле — пришлите новое значение.\n"
        "<i>Telegram/Instagram: можно прислать @username или просто ник.\n"
        "WhatsApp: пришлите номер телефона.</i>",
        parse_mode="HTML",
        reply_markup=kb,
    )


@router.callback_query(F.data.startswith("site:cq:"))
async def site_cq_pick(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    tid, role = await run_sync(_get_user_tenant_sync, callback.from_user.id)
    if not tid or not can_site(role):
        return
    key = callback.data.split(":")[2]
    labels = {
        "telegram": "Пришлите @username или просто username (например: <code>@mysalon</code>)\nМожно и полную ссылку https://t.me/…",
        "whatsapp": "Пришлите номер телефона (например: <code>+7 707 123 4567</code>)\nСсылка wa.me/… тоже подойдёт",
        "instagram": "Пришлите @username или просто username (например: <code>@mysalon</code>)\nМожно и полную ссылку https://instagram.com/…",
        "address": "Адрес одной строкой, как он будет показан на сайте",
        "phone_main": "Телефон для кнопки «позвонить» (например: <code>+7 707 123 4567</code>)",
    }
    await state.set_state(SiteStates.waiting_value)
    await state.update_data(site_kind="contact_key", contact_key=key)
    await callback.message.reply(f"Отправьте значение для <b>{key}</b>:\n<i>{labels.get(key, '')}</i>", parse_mode="HTML")


_ADV_ICONS = {
    "✨ Искра (sparkle)": "sparkle",
    "🕐 Часы (clock)": "clock",
    "😊 Улыбка (smile)": "smile",
}


def _adv_icon_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=label, callback_data=f"site:adv_icon:{val}")]
            for label, val in _ADV_ICONS.items()
        ]
    )


def _adv_more_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="➕ Добавить ещё", callback_data="site:adv_add")],
            [InlineKeyboardButton(text="✅ Готово — сохранить", callback_data="site:adv_save")],
        ]
    )


def _adv_skip_image_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="⏭ Без фото", callback_data="site:adv_skip_image")],
        ]
    )


def _is_http_image_url(s: str) -> bool:
    t = s.strip()
    return t.startswith("https://") or t.startswith("http://")


@router.callback_query(F.data == "site:adv_menu")
async def site_adv_menu(callback: CallbackQuery):
    await callback.answer()
    tid, role = await run_sync(_get_user_tenant_sync, callback.from_user.id)
    if not tid or not can_site(role):
        return
    sb = get_supabase()
    row = sb.table("tenants").select("site_content").eq("id", tid).limit(1).execute()
    sc = normalize_site_content(row.data[0].get("site_content") if row.data else {})
    adv = sc.get("advantages") or []
    lines = "\n".join(
        f"  {i+1}. {a.get('title','?')} — {a.get('text','')[:40]}…"
        if len(a.get("text","")) > 40 else f"  {i+1}. {a.get('title','?')} — {a.get('text','')}"
        for i, a in enumerate(adv)
    ) if adv else "  (нет — блок «Почему нас выбирают» на сайте скрыт)"
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="➕ Добавить / заменить список", callback_data="site:adv_start")],
        [InlineKeyboardButton(text="🗑 Очистить (скрыть блок)", callback_data="site:adv_reset")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="site:texts")],
    ])
    await callback.message.edit_text(
        f"⭐ <b>Преимущества («Почему нас выбирают»)</b>\n\nТекущие:\n{lines}\n\n"
        "Добавьте заголовок, текст и иконку к каждому пункту; по желанию — ссылку на фото. "
        "Список целиком заменяется при новом проходе. Очистка убирает секцию с сайта.",
        parse_mode="HTML",
        reply_markup=kb,
    )


@router.callback_query(F.data == "site:adv_start")
async def site_adv_start(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.set_state(SiteStates.waiting_adv_title)
    await state.update_data(adv_items=[], adv_current={})
    await callback.message.reply(
        "⭐ Создаём блок «Почему нас выбирают» для сайта.\n\n"
        "<b>Пункт 1</b> — введите заголовок (например: «Опытные мастера»):",
        parse_mode="HTML",
    )


@router.callback_query(F.data == "site:adv_reset")
async def site_adv_reset(callback: CallbackQuery):
    await callback.answer()
    tid, role = await run_sync(_get_user_tenant_sync, callback.from_user.id)
    if not tid or not can_site(role):
        return
    await run_sync(_patch_site_content_sync, tid, {"advantages": []})
    await callback.message.edit_text(
        "✅ Список очищен — секция «Почему нас выбирают» на сайте скрыта, пока снова не добавите пункты.",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="◀️ К текстам", callback_data="site:texts")]
        ]),
    )


@router.message(SiteStates.waiting_adv_title)
async def adv_got_title(message: Message, state: FSMContext):
    title = message.text.strip()
    if not title:
        await message.reply("❌ Заголовок не может быть пустым, попробуйте снова:")
        return
    await state.update_data(adv_current={"title": title})
    await state.set_state(SiteStates.waiting_adv_text)
    await message.reply(f"Отлично! Теперь введите описание для «{title}»:")


@router.message(SiteStates.waiting_adv_text)
async def adv_got_text(message: Message, state: FSMContext):
    text = message.text.strip()
    if not text:
        await message.reply("❌ Описание не может быть пустым, попробуйте снова:")
        return
    data = await state.get_data()
    cur = data.get("adv_current", {})
    cur["text"] = text
    await state.update_data(adv_current=cur)
    await state.set_state(SiteStates.waiting_adv_icon)
    await message.reply("Выберите иконку:", reply_markup=_adv_icon_kb())


@router.callback_query(SiteStates.waiting_adv_icon, F.data.startswith("site:adv_icon:"))
async def adv_got_icon(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    icon = callback.data.split(":", 3)[2]
    data = await state.get_data()
    cur = data.get("adv_current", {})
    cur["icon"] = icon
    await state.update_data(adv_current=cur)
    await state.set_state(SiteStates.waiting_adv_image)
    await callback.message.edit_text(
        "🖼 <b>Фото к этому пункту</b> (по желанию)\n\n"
        "Отправьте <b>прямую ссылку</b> на картинку (<code>https://…</code>), "
        "например изображение в облаке или публичная ссылка из хранилища.\n\n"
        "Или нажмите «Без фото» — на сайте будет только иконка.",
        parse_mode="HTML",
        reply_markup=_adv_skip_image_kb(),
    )


async def _adv_finish_item(message: Message, state: FSMContext, cur: dict) -> None:
    data = await state.get_data()
    items: list = list(data.get("adv_items", []))
    items.append(cur)
    await state.update_data(adv_items=items, adv_current={})
    await state.set_state(None)
    n = len(items)
    await message.reply(
        f"✅ Пункт {n} добавлен: «{cur.get('title')}»\n\n"
        "Добавить ещё или сохранить список на сайт?",
        reply_markup=_adv_more_kb(),
    )


@router.message(SiteStates.waiting_adv_image)
async def adv_got_image_url(message: Message, state: FSMContext):
    text = (message.text or "").strip()
    if not _is_http_image_url(text):
        await message.reply(
            "❌ Нужна ссылка, начинающаяся с <code>https://</code> или <code>http://</code>",
            parse_mode="HTML",
        )
        return
    data = await state.get_data()
    cur = data.get("adv_current", {})
    cur["image_url"] = text
    await _adv_finish_item(message, state, cur)


@router.callback_query(StateFilter(SiteStates.waiting_adv_image), F.data == "site:adv_skip_image")
async def adv_skip_image(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    data = await state.get_data()
    cur = data.get("adv_current", {})
    items: list = list(data.get("adv_items", []))
    items.append(cur)
    await state.update_data(adv_items=items, adv_current={})
    await state.set_state(None)
    n = len(items)
    await callback.message.edit_text(
        f"✅ Пункт {n} добавлен: «{cur.get('title')}»\n\n"
        "Добавить ещё или сохранить список на сайт?",
        reply_markup=_adv_more_kb(),
    )


@router.callback_query(F.data == "site:adv_add")
async def adv_add_more(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    data = await state.get_data()
    n = len(data.get("adv_items", [])) + 1
    await state.set_state(SiteStates.waiting_adv_title)
    await callback.message.reply(
        f"<b>Преимущество {n}</b>\nВведите заголовок:",
        parse_mode="HTML",
    )


@router.callback_query(F.data == "site:adv_save")
async def adv_save(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    tid, role = await run_sync(_get_user_tenant_sync, callback.from_user.id)
    if not tid or not can_site(role):
        await state.clear()
        return
    data = await state.get_data()
    items = data.get("adv_items", [])
    await run_sync(_patch_site_content_sync, tid, {"advantages": items})
    await state.clear()
    lines = "\n".join(f"  {i+1}. {a['title']}" for i, a in enumerate(items))
    await callback.message.edit_text(
        f"✅ {len(items)} преимуществ сохранено:\n{lines}\n\nОни уже отображаются на сайте.",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="◀️ К текстам", callback_data="site:texts")]
        ]),
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
    if not tenant_id or not can_site(role):
        await state.clear()
        await message.reply("⛔ Нет доступа.")
        return

    text = (message.text or "").strip()

    def _undo_kb() -> InlineKeyboardMarkup:
        return InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="↩️ Отменить", callback_data="site:undo")],
            [InlineKeyboardButton(text="◀️ К настройкам сайта", callback_data="menu:site")],
        ])

    if kind == "color":
        field = data.get("site_field")
        if not field or not _validate_color(text):
            await message.reply("❌ Нужен цвет: #RRGGBB, #RGB или rgb(...)/rgba(...)")
            return

        def _update_color():
            sb = get_supabase()
            old = sb.table("tenants").select(field).eq("id", tenant_id).limit(1).execute()
            old_val = old.data[0].get(field) if old.data else None
            push_undo(tenant_id, "tenants", tenant_id, field, old_val)
            sb.table("tenants").update({field: text}).eq("id", tenant_id).execute()

        await run_sync(_update_color)
        await state.clear()
        await message.reply(f"✅ {field} = {text}", reply_markup=_undo_kb())
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

            def _save_adv():
                sb = get_supabase()
                row = sb.table("tenants").select("site_content").eq("id", tenant_id).limit(1).execute()
                old_sc = normalize_site_content(row.data[0].get("site_content") if row.data else {})
                push_undo(tenant_id, "tenants", tenant_id, "site_content", dict(old_sc))
                old_sc["advantages"] = arr
                sb.table("tenants").update({"site_content": old_sc}).eq("id", tenant_id).execute()

            await run_sync(_save_adv)
        else:
            def _save_text():
                sb = get_supabase()
                row = sb.table("tenants").select("site_content").eq("id", tenant_id).limit(1).execute()
                old_sc = normalize_site_content(row.data[0].get("site_content") if row.data else {})
                push_undo(tenant_id, "tenants", tenant_id, "site_content", dict(old_sc))
                old_sc[field] = text
                sb.table("tenants").update({"site_content": old_sc}).eq("id", tenant_id).execute()

            await run_sync(_save_text)
        await state.clear()
        await message.reply("✅ Текст на сайте обновлён.", reply_markup=_undo_kb())
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

        def _save_contact():
            sb = get_supabase()
            old = sb.table("tenants").select("contact_json").eq("id", tenant_id).limit(1).execute()
            old_val = old.data[0].get("contact_json") if old.data else {}
            push_undo(tenant_id, "tenants", tenant_id, "contact_json", old_val)
            sb.table("tenants").update({"contact_json": obj}).eq("id", tenant_id).execute()

        await run_sync(_save_contact)
        await state.clear()
        await message.reply("✅ Контакты обновлены.", reply_markup=_undo_kb())
        return

    if kind == "logo_url":
        if not text.startswith("http://") and not text.startswith("https://"):
            await message.reply("❌ Нужна ссылка https://…")
            return

        def _save_logo():
            sb = get_supabase()
            old = sb.table("tenants").select("logo_url").eq("id", tenant_id).limit(1).execute()
            old_val = old.data[0].get("logo_url") if old.data else None
            push_undo(tenant_id, "tenants", tenant_id, "logo_url", old_val)
            sb.table("tenants").update({"logo_url": text}).eq("id", tenant_id).execute()

        await run_sync(_save_logo)
        await state.clear()
        await message.reply("✅ Лого обновлено.", reply_markup=_undo_kb())
        return

    if kind == "contact_key":
        ck = data.get("contact_key")
        if not ck or ck not in ("telegram", "whatsapp", "instagram", "address", "phone_main"):
            await state.clear()
            return
        # No strict validation — normalization handles formatting

        def _save_cq():
            sb = get_supabase()
            row = sb.table("tenants").select("contact_json").eq("id", tenant_id).limit(1).execute()
            old_cj = normalize_contact_json(row.data[0].get("contact_json") if row.data else {})
            push_undo(tenant_id, "tenants", tenant_id, "contact_json", dict(old_cj))

        await run_sync(_save_cq)
        await run_sync(_patch_contact_key_sync, tenant_id, ck, text)
        await state.clear()
        await message.reply("✅ Контакт обновлён в футере сайта.", reply_markup=_undo_kb())
        return

    await state.clear()


@router.callback_query(F.data == "site:undo")
async def site_undo(callback: CallbackQuery):
    await callback.answer()
    tid, role = await run_sync(_get_user_tenant_sync, callback.from_user.id)
    if not tid or not can_site(role):
        await callback.message.edit_text("⛔ Нет доступа.")
        return

    entry = pop_undo(tid)
    if not entry:
        await callback.message.edit_text(
            "⚠️ Нечего отменять.",
            reply_markup=site_menu_keyboard(tid),
        )
        return

    field = entry["field"]
    old_value = entry["old_value"]

    def _revert():
        sb = get_supabase()
        sb.table("tenants").update({field: old_value}).eq("id", tid).execute()

    await run_sync(_revert)

    remaining = undo_count(tid)
    txt = f"↩️ Отменено! Поле <b>{field}</b> возвращено к предыдущему значению."
    if remaining > 0:
        txt += f"\n\nЕщё можно отменить: {remaining} шаг(а)."
    await callback.message.edit_text(
        txt,
        parse_mode="HTML",
        reply_markup=site_menu_keyboard(tid),
    )
