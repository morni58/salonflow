"""Управление мастерами: создание, редактирование, удаление, фото."""
from __future__ import annotations

import asyncio
import io
import logging
import uuid

from aiogram import F, Router
from aiogram.exceptions import TelegramBadRequest
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from app.bot.async_db import run_sync
from app.bot.cache import get_user_sync as _get_user_sync
from app.core.database import get_supabase

logger = logging.getLogger(__name__)
router = Router()


class MasterAdminStates(StatesGroup):
    waiting_new_name = State()
    waiting_name = State()
    waiting_title = State()
    waiting_bio = State()
    waiting_exp = State()
    waiting_photo = State()


# ── Helpers ──────────────────────────────────────────────────────────────────


def _list_masters_sync(tenant_id: str) -> list[dict]:
    sb = get_supabase()
    r = (
        sb.table("masters")
        .select("id, display_name, title, is_bookable, sort_order")
        .eq("tenant_id", tenant_id)
        .order("sort_order")
        .execute()
    )
    return r.data or []


def _get_master_sync(master_id: str, tenant_id: str) -> dict | None:
    sb = get_supabase()
    r = (
        sb.table("masters")
        .select("id, display_name, title, bio, experience, photo_url, is_bookable, sort_order, working_hours_start, working_hours_end, working_days")
        .eq("id", master_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    )
    return r.data[0] if r.data else None


def _create_master_sync(tenant_id: str, display_name: str) -> str:
    """Создаёт мастера без привязки к Telegram-аккаунту. Возвращает master_id."""
    sb = get_supabase()
    # Get max sort_order
    existing = sb.table("masters").select("sort_order").eq("tenant_id", tenant_id).order("sort_order", desc=True).limit(1).execute()
    next_sort = ((existing.data[0]["sort_order"] or 0) + 1) if existing.data else 1
    r = sb.table("masters").insert({
        "tenant_id": tenant_id,
        "display_name": display_name,
        "title": "Мастер",
        "sort_order": next_sort,
        "is_active": True,
        "is_bookable": True,
    }).execute()
    return str(r.data[0]["id"])


def _update_master_field_sync(master_id: str, field: str, value) -> None:
    sb = get_supabase()
    sb.table("masters").update({field: value}).eq("id", master_id).execute()


def _delete_master_sync(master_id: str, tenant_id: str) -> None:
    sb = get_supabase()
    sb.table("masters").delete().eq("id", master_id).eq("tenant_id", tenant_id).execute()


def _photo_upload_sync(tenant_id: str, master_id: str, raw: bytes) -> str:
    from PIL import Image
    sb = get_supabase()
    buf = io.BytesIO(raw)
    img = Image.open(buf)
    max_dim = 1200
    if max(img.size) > max_dim:
        ratio = max_dim / max(img.size)
        img = img.resize((int(img.size[0] * ratio), int(img.size[1] * ratio)), Image.LANCZOS)
    out = io.BytesIO()
    img.save(out, format="WEBP", quality=88)
    body = out.getvalue()
    filename = f"{tenant_id}/{master_id}_{uuid.uuid4().hex[:8]}.webp"
    sb.storage.from_("master-photos").upload(
        path=filename, file=body, file_options={"content-type": "image/webp"}
    )
    url = sb.storage.from_("master-photos").get_public_url(filename)
    if isinstance(url, dict):
        url = url.get("publicUrl") or str(url)
    sb.table("masters").update({"photo_url": url}).eq("id", master_id).execute()
    return url


# ── Build UIs ────────────────────────────────────────────────────────────────

def _build_list_text_kb(masters: list[dict]) -> tuple[str, InlineKeyboardMarkup]:
    if not masters:
        text = "\U0001f465 <b>\u041c\u0430\u0441\u0442\u0435\u0440\u0430</b>\n\n\u041d\u0435\u0442 \u043c\u0430\u0441\u0442\u0435\u0440\u043e\u0432. \u0414\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u043f\u0435\u0440\u0432\u043e\u0433\u043e!"
    else:
        lines = ["\U0001f465 <b>\u041c\u0430\u0441\u0442\u0435\u0440\u0430</b>\n"]
        for m in masters:
            vis = "\u2705" if m.get("is_bookable") else "\u274c"
            title = f" — {m['title']}" if m.get("title") else ""
            lines.append(f"{vis} {m['display_name']}{title}")
        text = "\n".join(lines)

    buttons = []
    for m in masters:
        vis_icon = "\u2705" if m.get("is_bookable") else "\u274c"
        buttons.append([InlineKeyboardButton(text=f"{vis_icon} {m['display_name']}", callback_data=f"ma:v:{m['id']}")])

    buttons.append([InlineKeyboardButton(text="\u2795 \u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043c\u0430\u0441\u0442\u0435\u0440\u0430", callback_data="ma:new")])
    buttons.append([InlineKeyboardButton(text="\u25c0\ufe0f \u041d\u0430\u0437\u0430\u0434", callback_data="menu:main")])
    return text, InlineKeyboardMarkup(inline_keyboard=buttons)


def _build_master_text_kb(m: dict) -> tuple[str, InlineKeyboardMarkup]:
    vis = "\u2705 \u0410\u043a\u0442\u0438\u0432\u0435\u043d" if m.get("is_bookable") else "\u274c \u0421\u043a\u0440\u044b\u0442"
    photo = "\U0001f4f7 \u0435\u0441\u0442\u044c" if m.get("photo_url") else "\u2014 \u043d\u0435\u0442"
    bio_short = (m.get("bio") or "")[:200]
    exp = m.get("experience") or ""
    whs = m.get("working_hours_start") or "?"
    whe = m.get("working_hours_end") or "?"
    wdays_list = m.get("working_days") or []
    wd_labels = ["\u041f\u043d", "\u0412\u0442", "\u0421\u0440", "\u0427\u0442", "\u041f\u0442", "\u0421\u0431", "\u0412\u0441"]
    wd_str = ", ".join(wd_labels[d] for d in sorted(wdays_list)) if wdays_list else "\u043d\u0435 \u0437\u0430\u0434\u0430\u043d\u044b"

    text = (
        f"\U0001f464 <b>{m['display_name']}</b>\n"
        f"\U0001f3af {m.get('title') or '—'}\n"
        + (f"\u23f1 \u041e\u043f\u044b\u0442: {exp}\n" if exp else "")
        + f"\U0001f5bc \u0424\u043e\u0442\u043e: {photo}\n"
        + f"\U0001f4c5 \u0413\u0440\u0430\u0444\u0438\u043a: {wd_str}, {whs[:5]}–{whe[:5]}\n"
        + f"\U0001f440 \u0421\u0442\u0430\u0442\u0443\u0441: {vis}\n"
        + (f"\n\U0001f4dd <i>{bio_short}</i>" if bio_short else "")
    )

    mid = str(m["id"])
    toggle_label = "\U0001f648 \u0421\u043a\u0440\u044b\u0442\u044c \u0441 \u0441\u0430\u0439\u0442\u0430" if m.get("is_bookable") else "\U0001f435 \u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u043d\u0430 \u0441\u0430\u0439\u0442\u0435"

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="\u270f\ufe0f \u0418\u043c\u044f", callback_data=f"ma:nm:{mid}"),
            InlineKeyboardButton(text="\U0001f3af \u0414\u043e\u043b\u0436\u043d\u043e\u0441\u0442\u044c", callback_data=f"ma:ti:{mid}"),
        ],
        [
            InlineKeyboardButton(text="\U0001f4dd \u041e \u0441\u0435\u0431\u0435", callback_data=f"ma:bi:{mid}"),
            InlineKeyboardButton(text="\u23f1 \u041e\u043f\u044b\u0442", callback_data=f"ma:xp:{mid}"),
        ],
        [
            InlineKeyboardButton(text="\U0001f4f7 \u0424\u043e\u0442\u043e", callback_data=f"ma:ph:{mid}"),
            InlineKeyboardButton(text="\U0001f4c5 \u0413\u0440\u0430\u0444\u0438\u043a", callback_data=f"ma:sc:{mid}"),
        ],
        [InlineKeyboardButton(text=toggle_label, callback_data=f"ma:bk:{mid}")],
        [InlineKeyboardButton(text="\U0001f5d1 \u0423\u0434\u0430\u043b\u0438\u0442\u044c", callback_data=f"ma:dl:{mid}")],
        [InlineKeyboardButton(text="\u25c0\ufe0f \u041d\u0430\u0437\u0430\u0434 \u043a \u0441\u043f\u0438\u0441\u043a\u0443", callback_data="menu:masters_admin")],
    ])
    return text, kb


async def _edit_safe(callback: CallbackQuery, text: str, **kw) -> None:
    try:
        await callback.message.edit_text(text, **kw)
    except TelegramBadRequest as e:
        if "not modified" not in str(e).lower():
            raise


# ── Handlers ─────────────────────────────────────────────────────────────────

@router.callback_query(F.data == "menu:masters_admin")
async def menu_masters_admin(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.clear()
    user = await run_sync(_get_user_sync, callback.from_user.id)
    if not user or user["role"] not in ("owner", "admin"):
        await callback.answer("\u26d4 \u041d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u0430", show_alert=True)
        return
    masters = await run_sync(_list_masters_sync, user["tenant_id"])
    text, kb = _build_list_text_kb(masters)
    await _edit_safe(callback, text, parse_mode="HTML", reply_markup=kb)


@router.callback_query(F.data.startswith("ma:v:"))
async def master_view(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.clear()
    user = await run_sync(_get_user_sync, callback.from_user.id)
    if not user or user["role"] not in ("owner", "admin"):
        return
    mid = callback.data[5:]
    m = await run_sync(_get_master_sync, mid, user["tenant_id"])
    if not m:
        await callback.answer("\u041c\u0430\u0441\u0442\u0435\u0440 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d", show_alert=True)
        return
    text, kb = _build_master_text_kb(m)
    await _edit_safe(callback, text, parse_mode="HTML", reply_markup=kb)


# ── Create new master ─────────────────────────────────────────────────────────

@router.callback_query(F.data == "ma:new")
async def master_new_start(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    user = await run_sync(_get_user_sync, callback.from_user.id)
    if not user or user["role"] not in ("owner", "admin"):
        return
    await state.set_state(MasterAdminStates.waiting_new_name)
    await state.update_data(tenant_id=user["tenant_id"])
    await callback.message.reply("\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u043c\u044f \u043d\u043e\u0432\u043e\u0433\u043e \u043c\u0430\u0441\u0442\u0435\u0440\u0430:")


@router.message(MasterAdminStates.waiting_new_name)
async def master_new_save(message: Message, state: FSMContext):
    name = (message.text or "").strip()
    if len(name) < 2:
        await message.reply("\u0418\u043c\u044f \u0434\u043e\u043b\u0436\u043d\u043e \u0431\u044b\u0442\u044c \u043e\u0442 2 \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432.")
        return
    data = await state.get_data()
    tenant_id = data["tenant_id"]
    try:
        mid = await run_sync(_create_master_sync, tenant_id, name)
    except Exception as e:
        logger.exception("create master failed")
        await state.clear()
        await message.reply(f"\u274c \u041e\u0448\u0438\u0431\u043a\u0430: {e}")
        return
    await state.clear()
    await message.reply(
        f"\u2705 \u041c\u0430\u0441\u0442\u0435\u0440 <b>{name}</b> \u0441\u043e\u0437\u0434\u0430\u043d!\n"
        "\u0422\u0435\u043f\u0435\u0440\u044c \u0434\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u0444\u043e\u0442\u043e, \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u0438 \u0433\u0440\u0430\u0444\u0438\u043a \u0447\u0435\u0440\u0435\u0437 \u043a\u043d\u043e\u043f\u043a\u0438 \u043d\u0438\u0436\u0435.",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c", callback_data=f"ma:v:{mid}")],
            [InlineKeyboardButton(text="\u041a \u0441\u043f\u0438\u0441\u043a\u0443", callback_data="menu:masters_admin")],
        ]),
    )


# ── Edit field starters ───────────────────────────────────────────────────────

@router.callback_query(F.data.startswith("ma:nm:"))
async def master_edit_name(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    mid = callback.data[6:]
    await state.set_state(MasterAdminStates.waiting_name)
    await state.update_data(master_id=mid)
    await callback.message.reply("\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043d\u043e\u0432\u043e\u0435 \u0438\u043c\u044f \u043c\u0430\u0441\u0442\u0435\u0440\u0430:")


@router.callback_query(F.data.startswith("ma:ti:"))
async def master_edit_title(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    mid = callback.data[6:]
    await state.set_state(MasterAdminStates.waiting_title)
    await state.update_data(master_id=mid)
    await callback.message.reply("\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0434\u043e\u043b\u0436\u043d\u043e\u0441\u0442\u044c (\u043d\u0430\u043f\u0440\u0438\u043c\u0435\u0440: \u00ab\u0421\u0442\u0438\u043b\u0438\u0441\u0442\u00bb, \u00ab\u041c\u0430\u0441\u0442\u0435\u0440 \u043c\u0430\u043d\u0438\u043a\u044e\u0440\u0430\u00bb):")


@router.callback_query(F.data.startswith("ma:bi:"))
async def master_edit_bio(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    mid = callback.data[6:]
    await state.set_state(MasterAdminStates.waiting_bio)
    await state.update_data(master_id=mid)
    await callback.message.reply("\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0442\u0435\u043a\u0441\u0442 \u00ab\u041e \u0441\u0435\u0431\u0435\u00bb (\u0434\u043e 1500 \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432):")


@router.callback_query(F.data.startswith("ma:xp:"))
async def master_edit_exp(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    mid = callback.data[6:]
    await state.set_state(MasterAdminStates.waiting_exp)
    await state.update_data(master_id=mid)
    await callback.message.reply(
        "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043e\u043f\u044b\u0442 \u0440\u0430\u0431\u043e\u0442\u044b (\u043d\u0430\u043f\u0440\u0438\u043c\u0435\u0440: <code>5 \u043b\u0435\u0442</code> \u0438\u043b\u0438 <code>3 \u0433\u043e\u0434\u0430 \u043e\u043f\u044b\u0442\u0430</code>):",
        parse_mode="HTML",
    )


@router.callback_query(F.data.startswith("ma:ph:"))
async def master_edit_photo(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    mid = callback.data[6:]
    await state.set_state(MasterAdminStates.waiting_photo)
    await state.update_data(master_id=mid)
    await callback.message.reply("\u041e\u0442\u043f\u0440\u0430\u0432\u044c\u0442\u0435 \u0444\u043e\u0442\u043e \u043c\u0430\u0441\u0442\u0435\u0440\u0430 (\u043a\u0430\u043a \u043a\u0430\u0440\u0442\u0438\u043d\u043a\u0443):")


# ── Edit field savers ─────────────────────────────────────────────────────────

async def _save_field_and_show(message: Message, state: FSMContext, field: str, value, user_sync_fn):
    data = await state.get_data()
    mid = data.get("master_id")
    user = await run_sync(user_sync_fn, message.from_user.id)
    if not user or not mid:
        await state.clear()
        return
    await run_sync(_update_master_field_sync, mid, field, value)
    await state.clear()
    m = await run_sync(_get_master_sync, mid, user["tenant_id"])
    if not m:
        await message.reply("\u2705 \u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e.")
        return
    text, kb = _build_master_text_kb(m)
    await message.reply(text, parse_mode="HTML", reply_markup=kb)


@router.message(MasterAdminStates.waiting_name)
async def save_name(message: Message, state: FSMContext):
    v = (message.text or "").strip()[:200]
    if len(v) < 2:
        await message.reply("\u041c\u0438\u043d\u0438\u043c\u0443\u043c 2 \u0441\u0438\u043c\u0432\u043e\u043b\u0430.")
        return
    await _save_field_and_show(message, state, "display_name", v, _get_user_sync)


@router.message(MasterAdminStates.waiting_title)
async def save_title(message: Message, state: FSMContext):
    v = (message.text or "").strip()[:200]
    if len(v) < 1:
        await message.reply("\u041d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u043f\u0443\u0441\u0442\u044b\u043c.")
        return
    await _save_field_and_show(message, state, "title", v, _get_user_sync)


@router.message(MasterAdminStates.waiting_bio)
async def save_bio(message: Message, state: FSMContext):
    v = (message.text or "").strip()[:1500]
    if len(v) < 3:
        await message.reply("\u041c\u0438\u043d\u0438\u043c\u0443\u043c 3 \u0441\u0438\u043c\u0432\u043e\u043b\u0430.")
        return
    await _save_field_and_show(message, state, "bio", v, _get_user_sync)


@router.message(MasterAdminStates.waiting_exp)
async def save_exp(message: Message, state: FSMContext):
    v = (message.text or "").strip()[:100]
    if len(v) < 1:
        await message.reply("\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435.")
        return
    await _save_field_and_show(message, state, "experience", v, _get_user_sync)


@router.message(MasterAdminStates.waiting_photo, F.photo)
async def save_photo(message: Message, state: FSMContext):
    data = await state.get_data()
    mid = data.get("master_id")
    user = await run_sync(_get_user_sync, message.from_user.id)
    if not user or not mid:
        await state.clear()
        return
    photo = message.photo[-1]
    file = await message.bot.get_file(photo.file_id)
    buf = io.BytesIO()
    await message.bot.download_file(file.file_path, buf)
    try:
        await asyncio.to_thread(_photo_upload_sync, user["tenant_id"], mid, buf.getvalue())
    except Exception as e:
        logger.exception("photo upload failed")
        await state.clear()
        await message.reply(f"\u274c \u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438: {e}")
        return
    await state.clear()
    m = await run_sync(_get_master_sync, mid, user["tenant_id"])
    if m:
        text, kb = _build_master_text_kb(m)
        await message.reply(text, parse_mode="HTML", reply_markup=kb)
    else:
        await message.reply("\u2705 \u0424\u043e\u0442\u043e \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e.")


@router.message(MasterAdminStates.waiting_photo)
async def photo_not_image(message: Message):
    await message.reply("\u041d\u0443\u0436\u043d\u043e \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0444\u043e\u0442\u043e.")


# ── Toggle bookable ───────────────────────────────────────────────────────────

@router.callback_query(F.data.startswith("ma:bk:"))
async def master_toggle_bookable(callback: CallbackQuery):
    await callback.answer()
    user = await run_sync(_get_user_sync, callback.from_user.id)
    if not user or user["role"] not in ("owner", "admin"):
        return
    mid = callback.data[6:]
    m = await run_sync(_get_master_sync, mid, user["tenant_id"])
    if not m:
        return
    new_val = not m.get("is_bookable", True)
    await run_sync(_update_master_field_sync, mid, "is_bookable", new_val)
    # Refresh view
    m2 = await run_sync(_get_master_sync, mid, user["tenant_id"])
    if m2:
        text, kb = _build_master_text_kb(m2)
        try:
            await callback.message.edit_text(text, parse_mode="HTML", reply_markup=kb)
        except TelegramBadRequest:
            pass


# ── Delete ────────────────────────────────────────────────────────────────────

@router.callback_query(F.data.startswith("ma:dl:"))
async def master_delete_confirm(callback: CallbackQuery):
    await callback.answer()
    user = await run_sync(_get_user_sync, callback.from_user.id)
    if not user or user["role"] not in ("owner", "admin"):
        return
    mid = callback.data[6:]
    m = await run_sync(_get_master_sync, mid, user["tenant_id"])
    if not m:
        return
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="\u2705 \u0414\u0430, \u0443\u0434\u0430\u043b\u0438\u0442\u044c", callback_data=f"ma:dy:{mid}"),
            InlineKeyboardButton(text="\u274c \u041e\u0442\u043c\u0435\u043d\u0430", callback_data=f"ma:v:{mid}"),
        ]
    ])
    try:
        await callback.message.edit_text(
            f"\U0001f5d1 \u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043c\u0430\u0441\u0442\u0435\u0440\u0430 <b>{m['display_name']}</b>?\n"
            "\u042d\u0442\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435\u043b\u044c\u0437\u044f \u043e\u0442\u043c\u0435\u043d\u0438\u0442\u044c.",
            parse_mode="HTML",
            reply_markup=kb,
        )
    except TelegramBadRequest:
        pass


@router.callback_query(F.data.startswith("ma:dy:"))
async def master_delete_do(callback: CallbackQuery):
    await callback.answer()
    user = await run_sync(_get_user_sync, callback.from_user.id)
    if not user or user["role"] not in ("owner", "admin"):
        return
    mid = callback.data[6:]
    await run_sync(_delete_master_sync, mid, user["tenant_id"])
    masters = await run_sync(_list_masters_sync, user["tenant_id"])
    text, kb = _build_list_text_kb(masters)
    try:
        await callback.message.edit_text(
            "\u2705 \u041c\u0430\u0441\u0442\u0435\u0440 \u0443\u0434\u0430\u043b\u0451\u043d.\n\n" + text,
            parse_mode="HTML",
            reply_markup=kb,
        )
    except TelegramBadRequest:
        pass


# ── Schedule link ─────────────────────────────────────────────────────────────

@router.callback_query(F.data.startswith("ma:sc:"))
async def master_schedule_link(callback: CallbackQuery):
    """Открывает интерфейс графика мастера для владельца/администратора."""
    await callback.answer()
    user = await run_sync(_get_user_sync, callback.from_user.id)
    if not user or user["role"] not in ("owner", "admin"):
        return
    mid = callback.data[6:]
    from app.bot.handlers.master_schedule_bot import _master_main_kb
    try:
        await callback.message.edit_text(
            "\U0001f5d3 <b>\u0413\u0440\u0430\u0444\u0438\u043a \u043c\u0430\u0441\u0442\u0435\u0440\u0430</b>\n"
            "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u0442\u0435 \u0440\u0430\u0431\u043e\u0447\u0438\u0435 \u0434\u043d\u0438, \u0447\u0430\u0441\u044b \u0438 \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b \u0441\u043b\u043e\u0442\u043e\u0432.",
            parse_mode="HTML",
            reply_markup=_master_main_kb(mid),
        )
    except TelegramBadRequest:
        pass
