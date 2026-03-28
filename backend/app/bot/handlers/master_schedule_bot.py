"""График конкретного мастера в боте (дни, часы, закрыть день)."""
from __future__ import annotations

import logging
from datetime import date, datetime

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from app.bot.async_db import run_sync
from app.bot.handlers.staff_masters import _get_master_for_user_sync, _user_row_sync
from app.core.database import get_supabase
from app.core.tenant_fields import normalize_working_days

logger = logging.getLogger(__name__)
router = Router()

WD_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]


class MasterSchedStates(StatesGroup):
    waiting_hours = State()
    waiting_close_date = State()


def _master_row_sync(master_id: str) -> dict | None:
    sb = get_supabase()
    r = sb.table("masters").select("*").eq("id", master_id).limit(1).execute()
    return r.data[0] if r.data else None


def _working_days_kb(master_id: str) -> InlineKeyboardMarkup:
    row = _master_row_sync(master_id) or {}
    days = normalize_working_days(row.get("working_days"))
    buttons = []
    for i in range(7):
        mark = "✅" if i in days else "⬜"
        buttons.append(
            [InlineKeyboardButton(text=f"{mark} {WD_LABELS[i]}", callback_data=f"msched:wd:{master_id}:{i}")],
        )
    buttons.append([InlineKeyboardButton(text="◀️ Назад", callback_data=f"msched:back:{master_id}")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def _toggle_wd_sync(master_id: str, weekday: int) -> None:
    sb = get_supabase()
    row = _master_row_sync(master_id)
    if not row:
        return
    days = normalize_working_days(row.get("working_days"))
    if weekday in days:
        days = [d for d in days if d != weekday]
    else:
        days = sorted(set(days + [weekday]))
    if not days:
        days = [weekday]
    sb.table("masters").update({"working_days": days, "schedule_mode": "weekdays"}).eq("id", master_id).execute()


def _apply_close_day_sync(master_id: str, d: date) -> None:
    sb = get_supabase()
    existing = (
        sb.table("master_schedule_exceptions")
        .select("id")
        .eq("master_id", master_id)
        .eq("date", d.isoformat())
        .limit(1)
        .execute()
    )
    if existing.data:
        sb.table("master_schedule_exceptions").update({"is_closed": True}).eq("id", existing.data[0]["id"]).execute()
    else:
        sb.table("master_schedule_exceptions").insert({
            "master_id": master_id,
            "date": d.isoformat(),
            "is_closed": True,
        }).execute()


def _master_main_kb(mid: str, back_cb: str | None = None) -> InlineKeyboardMarkup:
    rows = [
        [
            InlineKeyboardButton(text="▫️ 1×1", callback_data=f"msched:preset:{mid}:1x1"),
            InlineKeyboardButton(text="▪️ 2×2", callback_data=f"msched:preset:{mid}:2x2"),
            InlineKeyboardButton(text="15м", callback_data=f"msched:preset:{mid}:dense"),
        ],
        [InlineKeyboardButton(text="📅 Дни недели", callback_data=f"msched:weekdays:{mid}")],
        [InlineKeyboardButton(text="🕐 Часы работы", callback_data=f"msched:hours:{mid}")],
        [InlineKeyboardButton(text="🔒 Закрыть день", callback_data=f"msched:close:{mid}")],
    ]
    if back_cb:
        rows.append([InlineKeyboardButton(text="◀️ К мастеру", callback_data=back_cb)])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _apply_master_preset_sync(master_id: str, preset: str) -> None:
    presets = {"1x1": (60, 15), "2x2": (30, 10), "dense": (15, 5)}
    interval, buf = presets.get(preset, (60, 15))
    sb = get_supabase()
    sb.table("masters").update({
        "slot_interval_minutes": interval,
        "buffer_minutes": buf,
    }).eq("id", master_id).execute()


@router.callback_query(F.data == "menu:myschedule")
async def menu_my_schedule(callback: CallbackQuery):
    await callback.answer()
    actor = await run_sync(_user_row_sync, callback.from_user.id)
    if not actor or actor.get("role") != "master":
        await callback.message.edit_text("⛔ Только для мастеров.")
        return
    m = await run_sync(_get_master_for_user_sync, actor["id"], actor["tenant_id"])
    if not m:
        await callback.message.edit_text("❌ Нет профиля мастера.")
        return
    mid = str(m["id"])
    await callback.message.edit_text(
        "🗓 <b>Ваш график</b>\n"
        "Пресеты задают шаг слота и буфер. Режим «каждые N дней» настраивает владелец в расписании салона.\n"
        "Если у мастера нет слота — клиенту предложат другого мастера.",
        parse_mode="HTML",
        reply_markup=_master_main_kb(mid),
    )


@router.message(Command("my_schedule"))
async def cmd_my_schedule(message: Message) -> None:
    actor = await run_sync(_user_row_sync, message.from_user.id)
    if not actor or actor.get("role") != "master":
        await message.answer("⛔ Только для мастеров.")
        return
    m = await run_sync(_get_master_for_user_sync, actor["id"], actor["tenant_id"])
    if not m:
        await message.answer("❌ Нет профиля мастера.")
        return
    mid = str(m["id"])
    await message.answer(
        "🗓 <b>Ваш график</b> (на сайте слоты считаются по этим настройкам).\n"
        "Салон может иметь общие часы — здесь только ваши.",
        parse_mode="HTML",
        reply_markup=_master_main_kb(mid),
    )


@router.callback_query(F.data.startswith("msched:preset:"))
async def msched_preset(callback: CallbackQuery):
    await callback.answer()
    parts = callback.data.split(":")
    if len(parts) < 4:
        return
    mid, preset = parts[2], parts[3]
    if preset not in ("1x1", "2x2", "dense"):
        return
    actor = await run_sync(_user_row_sync, callback.from_user.id)
    if not actor:
        return
    role = actor.get("role", "")
    if role in ("owner", "admin"):
        # Admins can set presets for any master
        pass
    elif role == "master":
        m = await run_sync(_get_master_for_user_sync, actor["id"], actor["tenant_id"])
        if not m or str(m["id"]) != mid:
            return
    else:
        return
    await run_sync(_apply_master_preset_sync, mid, preset)
    await callback.message.reply("✅ Пресет сетки слотов применён.")


@router.callback_query(F.data.startswith("msched:weekdays:"))
async def msched_weekdays(callback: CallbackQuery):
    await callback.answer()
    mid = callback.data.split(":")[2]
    kb = _working_days_kb(mid)
    await callback.message.edit_text(
        "📅 Нажмите день — вкл/выкл.",
        reply_markup=kb,
    )


@router.callback_query(F.data.startswith("msched:wd:"))
async def msched_toggle_wd(callback: CallbackQuery):
    await callback.answer()
    parts = callback.data.split(":")
    mid, wd_s = parts[2], parts[3]
    try:
        wd = int(wd_s)
    except ValueError:
        return
    if wd < 0 or wd > 6:
        return
    await run_sync(_toggle_wd_sync, mid, wd)
    kb = _working_days_kb(mid)
    await callback.message.edit_reply_markup(reply_markup=kb)


@router.callback_query(F.data.startswith("msched:back:"))
async def msched_back(callback: CallbackQuery):
    await callback.answer()
    mid = callback.data.split(":")[2]
    await callback.message.edit_text("🗓 <b>Ваш график</b>", parse_mode="HTML", reply_markup=_master_main_kb(mid))


@router.callback_query(F.data.startswith("msched:hours:"))
async def msched_hours_start(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    mid = callback.data.split(":")[2]
    await state.set_state(MasterSchedStates.waiting_hours)
    await state.update_data(master_id=mid)
    await callback.message.reply(
        "🕐 Введите часы: <code>10:00 20:00</code> или <code>10:00-20:00</code>",
        parse_mode="HTML",
    )


@router.message(MasterSchedStates.waiting_hours)
async def msched_hours_save(message: Message, state: FSMContext):
    data = await state.get_data()
    mid = data.get("master_id")
    raw = (message.text or "").strip().replace("–", "-")
    parts = raw.replace("-", " ").split()
    if len(parts) < 2:
        await message.reply("Нужно два времени, например: 10:00 20:00")
        return

    def _parse_one(s: str) -> tuple[int, int] | None:
        s = s.strip()
        if len(s) < 4 or ":" not in s:
            return None
        h, m = s.split(":", 1)[:2]
        try:
            return int(h) % 24, int(m) % 60
        except ValueError:
            return None

    pa = _parse_one(parts[0])
    pb = _parse_one(parts[1])
    if not pa or not pb:
        await message.reply("❌ Неверный формат.")
        return

    def _u():
        sb = get_supabase()
        sb.table("masters").update({
            "working_hours_start": f"{pa[0]:02d}:{pa[1]:02d}:00",
            "working_hours_end": f"{pb[0]:02d}:{pb[1]:02d}:00",
        }).eq("id", mid).execute()

    await run_sync(_u)
    await state.clear()
    await message.reply(f"✅ Часы: {parts[0]} — {parts[1]}")


@router.callback_query(F.data.startswith("msched:close:"))
async def msched_close_start(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    mid = callback.data.split(":")[2]
    actor = await run_sync(_user_row_sync, callback.from_user.id)
    if not actor or actor.get("role") not in ("owner", "admin", "master"):
        return
    await state.set_state(MasterSchedStates.waiting_close_date)
    await state.update_data(master_id=mid)
    await callback.message.reply("🔒 Введите дату закрытия (ДД.ММ.ГГГГ):")


@router.message(MasterSchedStates.waiting_close_date)
async def msched_close_save(message: Message, state: FSMContext):
    data = await state.get_data()
    mid = data.get("master_id")
    try:
        d = datetime.strptime((message.text or "").strip(), "%d.%m.%Y").date()
    except ValueError:
        await message.reply("Формат: ДД.ММ.ГГГГ")
        return
    await run_sync(_apply_close_day_sync, mid, d)
    await state.clear()
    await message.reply(f"🔒 {d.strftime('%d.%m.%Y')} — вы не принимаете запись на сайте.")
