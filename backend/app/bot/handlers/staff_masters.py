"""Мастера: приглашение по Telegram ID, профиль мастера (о себе), фото."""
from __future__ import annotations

import asyncio
import io
import logging
import re
import uuid
from datetime import datetime

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from app.bot.async_db import run_sync
from app.bot.permissions import can_add_admin, can_invite_staff
from app.core.database import get_supabase

logger = logging.getLogger(__name__)
router = Router()


class StaffStates(StatesGroup):
    waiting_bio = State()
    waiting_title = State()
    waiting_photo = State()


def _user_row_sync(tg_id: int) -> dict | None:
    sb = get_supabase()
    r = sb.table("users").select("id, tenant_id, role, name").eq("telegram_user_id", tg_id).limit(1).execute()
    return r.data[0] if r.data else None


def _add_user_and_master_sync(
    tenant_id: str,
    telegram_user_id: int,
    display_name: str,
    as_admin: bool,
) -> tuple[str, str]:
    """Создаёт users + masters (для мастера). Возвращает (user_id, master_id)."""
    sb = get_supabase()
    role = "admin" if as_admin else "master"
    u = (
        sb.table("users")
        .insert({
            "tenant_id": tenant_id,
            "telegram_user_id": telegram_user_id,
            "role": role,
            "name": display_name,
        })
        .execute()
    )
    uid = u.data[0]["id"]
    if as_admin:
        return str(uid), ""
    m = (
        sb.table("masters")
        .insert({
            "tenant_id": tenant_id,
            "user_id": uid,
            "display_name": display_name,
            "title": "Мастер",
            "sort_order": 99,
        })
        .execute()
    )
    return str(uid), str(m.data[0]["id"])


def _add_manager_user_sync(tenant_id: str, telegram_user_id: int, display_name: str) -> None:
    sb = get_supabase()
    sb.table("users").insert({
        "tenant_id": tenant_id,
        "telegram_user_id": telegram_user_id,
        "role": "manager",
        "name": display_name,
    }).execute()


@router.callback_query(F.data == "menu:staff")
async def menu_staff(callback: CallbackQuery) -> None:
    """Персонал: команды добавления по Telegram ID (миграция 005 — роль manager)."""
    await callback.answer()
    actor = await run_sync(_user_row_sync, callback.from_user.id)
    if not actor or not can_invite_staff(actor.get("role", "")):
        await callback.message.edit_text("⛔ Доступно владельцу и администратору.")
        return
    role = actor.get("role", "")
    lines = [
        "👥 <b>Персонал</b>\n",
        "Добавление по числовому Telegram ID (узнать: @userinfobot или из пересланного сообщения).\n",
        "<code>/add_staff ID Имя</code> — мастер (сайт + бот + свой график)\n",
        "<code>/add_manager ID Имя</code> — менеджер (CRM, без настройки сайта)\n",
    ]
    if can_add_admin(role):
        lines.append("<code>/add_admin ID Имя</code> — администратор\n")
    lines.append("<code>/staff_list</code> — кто в боте\n")
    kb = InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="◀️ В меню", callback_data="menu:main")]]
    )
    await callback.message.edit_text("".join(lines), parse_mode="HTML", reply_markup=kb)


def _get_master_for_user_sync(user_internal_id: str, tenant_id: str) -> dict | None:
    sb = get_supabase()
    r = (
        sb.table("masters")
        .select("id, display_name, title, bio, photo_url")
        .eq("user_id", user_internal_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    )
    return r.data[0] if r.data else None


def _master_photo_upload_sync(tenant_id: str, master_id: str, raw: bytes) -> str:
    from PIL import Image

    sb = get_supabase()
    bio = io.BytesIO(raw)
    bio.seek(0)
    img = Image.open(bio)
    max_dim = 1200
    if max(img.size) > max_dim:
        ratio = max_dim / max(img.size)
        img = img.resize((int(img.size[0] * ratio), int(img.size[1] * ratio)), Image.LANCZOS)
    output = io.BytesIO()
    img.save(output, format="WEBP", quality=88)
    output.seek(0)
    body = output.getvalue()
    filename = f"{tenant_id}/{master_id}_{uuid.uuid4().hex[:8]}.webp"
    sb.storage.from_("master-photos").upload(
        path=filename,
        file=body,
        file_options={"content-type": "image/webp"},
    )
    public_url = sb.storage.from_("master-photos").get_public_url(filename)
    if isinstance(public_url, dict):
        public_url = public_url.get("publicUrl") or str(public_url)
    sb.table("masters").update({"photo_url": public_url}).eq("id", master_id).execute()
    return public_url


@router.message(Command("add_staff"))
async def cmd_add_staff(message: Message) -> None:
    """/add_staff <telegram_id> <имя> — мастер с профилем и доступом в бот."""
    actor = await run_sync(_user_row_sync, message.from_user.id)
    if not actor or not can_invite_staff(actor.get("role", "")):
        await message.answer("⛔ Команда доступна владельцу и администратору.")
        return
    parts = (message.text or "").split(maxsplit=2)
    if len(parts) < 3:
        await message.answer(
            "Использование: <code>/add_staff &lt;telegram_id&gt; Имя Фамилия</code>\n\n"
            "Узнать ID можно через @userinfobot или из пересланного сообщения.",
            parse_mode="HTML",
        )
        return
    try:
        tg_target = int(parts[1].strip())
    except ValueError:
        await message.answer("❌ telegram_id должен быть числом.")
        return
    name = parts[2].strip()
    if len(name) < 2:
        await message.answer("❌ Укажите имя (от 2 символов).")
        return

    def _run():
        return _add_user_and_master_sync(actor["tenant_id"], tg_target, name, as_admin=False)

    try:
        await run_sync(_run)
    except Exception as e:
        logger.exception("add_staff failed")
        await message.answer(f"❌ Не удалось: {e}")
        return

    await message.answer(
        f"✅ Мастер <b>{name}</b> добавлен.\n"
        f"ID в боте: <code>{tg_target}</code>\n"
        f"Пусть напишет /start боту салона.\n"
        f"Профиль: /my_profile",
        parse_mode="HTML",
    )


@router.message(Command("add_admin"))
async def cmd_add_admin(message: Message) -> None:
    """/add_admin <telegram_id> <имя> — только владелец."""
    actor = await run_sync(_user_row_sync, message.from_user.id)
    if not actor or not can_add_admin(actor.get("role", "")):
        await message.answer("⛔ Только владелец может назначать администраторов.")
        return
    parts = (message.text or "").split(maxsplit=2)
    if len(parts) < 3:
        await message.answer(
            "Использование: <code>/add_admin &lt;telegram_id&gt; Имя</code>",
            parse_mode="HTML",
        )
        return
    try:
        tg_target = int(parts[1].strip())
    except ValueError:
        await message.answer("❌ telegram_id должен быть числом.")
        return
    name = parts[2].strip()

    def _run():
        return _add_user_and_master_sync(actor["tenant_id"], tg_target, name, as_admin=True)

    try:
        await run_sync(_run)
    except Exception as e:
        logger.exception("add_admin failed")
        await message.answer(f"❌ Не удалось: {e}")
        return

    await message.answer(
        f"✅ Администратор <b>{name}</b> добавлен (telegram_id={tg_target}).\n/start в боте.",
        parse_mode="HTML",
    )


@router.message(Command("add_manager"))
async def cmd_add_manager(message: Message) -> None:
    """/add_manager <telegram_id> <имя> — менеджер (CRM), без прав на сайт."""
    actor = await run_sync(_user_row_sync, message.from_user.id)
    if not actor or not can_invite_staff(actor.get("role", "")):
        await message.answer("⛔ Команда доступна владельцу и администратору.")
        return
    parts = (message.text or "").split(maxsplit=2)
    if len(parts) < 3:
        await message.answer(
            "Использование: <code>/add_manager &lt;telegram_id&gt; Имя Фамилия</code>",
            parse_mode="HTML",
        )
        return
    try:
        tg_target = int(parts[1].strip())
    except ValueError:
        await message.answer("❌ telegram_id должен быть числом.")
        return
    name = parts[2].strip()
    if len(name) < 2:
        await message.answer("❌ Укажите имя (от 2 символов).")
        return

    try:
        await run_sync(_add_manager_user_sync, actor["tenant_id"], tg_target, name)
    except Exception as e:
        logger.exception("add_manager failed")
        await message.answer(f"❌ Не удалось: {e}")
        return

    await message.answer(
        f"✅ Менеджер <b>{name}</b> добавлен.\n"
        f"ID: <code>{tg_target}</code> — пусть откроет бота и нажмёт /start.",
        parse_mode="HTML",
    )


@router.message(Command("staff_list"))
async def cmd_staff_list(message: Message) -> None:
    """Список пользователей салона в боте."""
    actor = await run_sync(_user_row_sync, message.from_user.id)
    if not actor or actor.get("role") not in ("owner", "admin", "manager"):
        await message.answer("⛔ Нет доступа.")
        return

    def _list():
        sb = get_supabase()
        r = (
            sb.table("users")
            .select("telegram_user_id, role, name")
            .eq("tenant_id", actor["tenant_id"])
            .order("role")
            .execute()
        )
        return r.data or []

    rows = await run_sync(_list)
    role_ru = {
        "owner": "👑 владелец",
        "admin": "🔧 админ",
        "manager": "📋 менеджер",
        "master": "✂️ мастер",
    }
    lines = ["👥 <b>Пользователи бота</b>\n"]
    for u in rows:
        rl = role_ru.get(u["role"], u["role"])
        lines.append(f"• {u['name']} — {rl} — <code>{u['telegram_user_id']}</code>")
    await message.answer("\n".join(lines), parse_mode="HTML")


@router.message(Command("my_profile"))
async def cmd_my_profile(message: Message, state: FSMContext) -> None:
    """Редактирование карточки мастера на сайте (роль master)."""
    actor = await run_sync(_user_row_sync, message.from_user.id)
    if not actor or actor.get("role") != "master":
        await message.answer("⛔ Профиль мастера доступен только мастерам. Админы: раздел «Сайт».")
        return
    m = await run_sync(_get_master_for_user_sync, actor["id"], actor["tenant_id"])
    if not m:
        await message.answer("❌ Нет привязанного профиля мастера. Обратитесь к администратору.")
        return

    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="✏️ Должность (подпись)", callback_data="mp:title")],
            [InlineKeyboardButton(text="📝 О себе (текст)", callback_data="mp:bio")],
            [InlineKeyboardButton(text="📷 Фото", callback_data="mp:photo")],
        ]
    )
    bio = (m.get("bio") or "—")[:400]
    await message.answer(
        f"💇 <b>Ваш профиль на сайте</b>\n\n"
        f"Имя: {m.get('display_name')}\n"
        f"Должность: {m.get('title') or '—'}\n"
        f"О себе:\n{bio}\n\n"
        f"Выберите, что изменить:",
        parse_mode="HTML",
        reply_markup=kb,
    )


@router.callback_query(F.data == "mp:title")
async def mp_title_start(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.set_state(StaffStates.waiting_title)
    await state.update_data(master_edit="title")
    await callback.message.reply("Введите должность одной строкой (например: «Стилист», «Топ-мастер»):")


@router.callback_query(F.data == "mp:bio")
async def mp_bio_start(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.set_state(StaffStates.waiting_bio)
    await state.update_data(master_edit="bio")
    await callback.message.reply("Введите текст «О себе» (до 1500 символов):")


@router.callback_query(F.data == "mp:photo")
async def mp_photo_start(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.set_state(StaffStates.waiting_photo)
    await callback.message.reply("Отправьте фото (как картинку) для карточки на сайте.")


@router.message(StaffStates.waiting_title)
async def mp_title_save(message: Message, state: FSMContext):
    text = (message.text or "").strip()[:200]
    if len(text) < 2:
        await message.reply("❌ Слишком коротко.")
        return
    actor = await run_sync(_user_row_sync, message.from_user.id)
    if not actor:
        await state.clear()
        return
    m = await run_sync(_get_master_for_user_sync, actor["id"], actor["tenant_id"])
    if not m:
        await state.clear()
        return

    def _u():
        sb = get_supabase()
        sb.table("masters").update({"title": text}).eq("id", m["id"]).execute()

    await run_sync(_u)
    await state.clear()
    await message.reply("✅ Должность обновлена на сайте.")


@router.message(StaffStates.waiting_bio)
async def mp_bio_save(message: Message, state: FSMContext):
    text = (message.text or "").strip()[:1500]
    if len(text) < 5:
        await message.reply("❌ Минимум 5 символов.")
        return
    actor = await run_sync(_user_row_sync, message.from_user.id)
    if not actor:
        await state.clear()
        return
    m = await run_sync(_get_master_for_user_sync, actor["id"], actor["tenant_id"])
    if not m:
        await state.clear()
        return

    def _u():
        sb = get_supabase()
        sb.table("masters").update({"bio": text}).eq("id", m["id"]).execute()

    await run_sync(_u)
    await state.clear()
    await message.reply("✅ Текст «О себе» обновлён на сайте.")


@router.message(StaffStates.waiting_photo, F.photo)
async def mp_photo_save(message: Message, state: FSMContext):
    actor = await run_sync(_user_row_sync, message.from_user.id)
    if not actor:
        await state.clear()
        return
    m = await run_sync(_get_master_for_user_sync, actor["id"], actor["tenant_id"])
    if not m:
        await state.clear()
        return

    photo = message.photo[-1]
    file = await message.bot.get_file(photo.file_id)
    bio = io.BytesIO()
    await message.bot.download_file(file.file_path, bio)
    raw = bio.getvalue()

    try:
        await asyncio.to_thread(
            _master_photo_upload_sync,
            actor["tenant_id"],
            str(m["id"]),
            raw,
        )
    except Exception as e:
        logger.exception("master photo upload failed")
        await state.clear()
        await message.reply(
            f"❌ Ошибка загрузки: {e}\n"
            "Создайте публичный бакет «master-photos» в Supabase Storage."
        )
        return

    await state.clear()
    await message.reply("✅ Фото обновлено на сайте.")


@router.message(StaffStates.waiting_photo)
async def mp_photo_not_image(message: Message):
    await message.reply("Нужно отправить изображение (фото).")
