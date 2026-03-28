import logging
from datetime import date, timedelta

from aiogram import Router, F
from aiogram.exceptions import TelegramBadRequest
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup

from app.bot.async_db import run_sync
from app.bot.cache import get_user_sync as _get_user_sync
from app.core.database import get_supabase

logger = logging.getLogger(__name__)
router = Router()

MONTH_RU = ["", "янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"]



def _build_date_picker_kb() -> InlineKeyboardMarkup:
    today = date.today()
    buttons = []
    row = []
    for i in range(14):
        d = today + timedelta(days=i)
        label = f"{d.day} {MONTH_RU[d.month]}"
        row.append(InlineKeyboardButton(text=label, callback_data=f"slotb:d:{d.isoformat()}"))
        if len(row) == 4:
            buttons.append(row)
            row = []
    if row:
        buttons.append(row)
    buttons.append([InlineKeyboardButton(text="◀️ Назад", callback_data="menu:main")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def _all_slots_for_date_sync(tenant_id: str) -> list[str]:
    """Все возможные слоты на основе графика салона."""
    from app.services.slots import _parse_hh_mm, _build_slot_times
    sb = get_supabase()
    t = sb.table("tenants").select(
        "working_hours_start, working_hours_end, slot_interval_minutes"
    ).eq("id", tenant_id).limit(1).execute()
    if not t.data:
        return []
    row = t.data[0]
    start_h, start_m = _parse_hh_mm(row.get("working_hours_start"))
    end_h, end_m = _parse_hh_mm(row.get("working_hours_end"))
    interval = int(row.get("slot_interval_minutes") or 60)
    if interval <= 0:
        interval = 60
    slots = _build_slot_times(start_h, start_m, end_h, end_m, interval)
    return [f"{s.hour:02d}:{s.minute:02d}" for s in slots]


def _get_blocked_times_sync(tenant_id: str, target_date_iso: str) -> set[str]:
    sb = get_supabase()
    r = (
        sb.table("slot_overrides")
        .select("slot_time")
        .eq("tenant_id", tenant_id)
        .eq("slot_date", target_date_iso)
        .is_("master_id", "null")
        .eq("is_blocked", True)
        .execute()
    )
    out = set()
    for row in r.data or []:
        t = str(row["slot_time"])[:5]  # "HH:MM:SS" -> "HH:MM"
        out.add(t)
    return out


def _toggle_slot_sync(tenant_id: str, target_date_iso: str, slot_time: str) -> bool:
    """Тоггл блок. True = теперь заблокирован, False = открыт."""
    sb = get_supabase()
    existing = (
        sb.table("slot_overrides")
        .select("id, is_blocked")
        .eq("tenant_id", tenant_id)
        .eq("slot_date", target_date_iso)
        .eq("slot_time", slot_time)
        .is_("master_id", "null")
        .limit(1)
        .execute()
    )
    if existing.data:
        row = existing.data[0]
        new_val = not row["is_blocked"]
        sb.table("slot_overrides").update({"is_blocked": new_val}).eq("id", row["id"]).execute()
        return new_val
    else:
        sb.table("slot_overrides").insert({
            "tenant_id": tenant_id,
            "slot_date": target_date_iso,
            "slot_time": slot_time,
            "is_blocked": True,
            "master_id": None,
        }).execute()
        return True


def _build_slot_grid_kb(all_slots: list[str], blocked: set[str], date_iso: str) -> InlineKeyboardMarkup:
    buttons = []
    row = []
    for slot in all_slots:
        emoji = "🔴" if slot in blocked else "✅"
        label = f"{emoji} {slot}"
        row.append(InlineKeyboardButton(text=label, callback_data=f"slotb:t:{date_iso}:{slot}"))
        if len(row) == 3:
            buttons.append(row)
            row = []
    if row:
        buttons.append(row)
    buttons.append([InlineKeyboardButton(text="◀️ Назад", callback_data="menu:slot_blocks")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


@router.callback_query(F.data == "menu:slot_blocks")
async def menu_slot_blocks(callback: CallbackQuery):
    await callback.answer()
    user = await run_sync(_get_user_sync, callback.from_user.id)
    if not user or user["role"] not in ("owner", "admin"):
        await callback.answer("⛔ Нет доступа", show_alert=True)
        return
    try:
        await callback.message.edit_text(
            "🔒 <b>Управление слотами</b>\n\n"
            "Выберите дату для просмотра и блокировки/разблокировки слотов:",
            parse_mode="HTML",
            reply_markup=_build_date_picker_kb(),
        )
    except TelegramBadRequest:
        pass


@router.callback_query(F.data.startswith("slotb:d:"))
async def slot_date_selected(callback: CallbackQuery):
    await callback.answer()
    user = await run_sync(_get_user_sync, callback.from_user.id)
    if not user or user["role"] not in ("owner", "admin"):
        await callback.answer("⛔ Нет доступа", show_alert=True)
        return

    date_iso = callback.data[len("slotb:d:"):]
    tenant_id = user["tenant_id"]

    all_slots = await run_sync(_all_slots_for_date_sync, tenant_id)
    if not all_slots:
        await callback.answer("Нет слотов — проверьте график салона", show_alert=True)
        return

    blocked = await run_sync(_get_blocked_times_sync, tenant_id, date_iso)
    d = date.fromisoformat(date_iso)
    blocked_count = len(blocked)
    text = (
        f"🗓 <b>{d.day} {MONTH_RU[d.month]} {d.year}</b>\n"
        f"Слотов: {len(all_slots)} | Заблокировано: {blocked_count}\n\n"
        f"✅ — открыт  🔴 — заблокирован\nНажмите для переключения:"
    )
    kb = _build_slot_grid_kb(all_slots, blocked, date_iso)
    try:
        await callback.message.edit_text(text, parse_mode="HTML", reply_markup=kb)
    except TelegramBadRequest:
        pass


@router.callback_query(F.data.startswith("slotb:t:"))
async def slot_toggle(callback: CallbackQuery):
    user = await run_sync(_get_user_sync, callback.from_user.id)
    if not user or user["role"] not in ("owner", "admin"):
        await callback.answer("⛔ Нет доступа", show_alert=True)
        return

    # "slotb:t:YYYY-MM-DD:HH:MM" -> raw = "YYYY-MM-DD:HH:MM"
    raw = callback.data[len("slotb:t:"):]
    date_iso = raw[:10]
    slot_time = raw[11:]

    tenant_id = user["tenant_id"]
    now_blocked = await run_sync(_toggle_slot_sync, tenant_id, date_iso, slot_time)

    status_text = "🔴 Заблокирован" if now_blocked else "✅ Открыт"
    await callback.answer(f"{status_text}: {slot_time}")

    all_slots = await run_sync(_all_slots_for_date_sync, tenant_id)
    blocked = await run_sync(_get_blocked_times_sync, tenant_id, date_iso)
    d = date.fromisoformat(date_iso)
    blocked_count = len(blocked)
    text = (
        f"🗓 <b>{d.day} {MONTH_RU[d.month]} {d.year}</b>\n"
        f"Слотов: {len(all_slots)} | Заблокировано: {blocked_count}\n\n"
        f"✅ — открыт  🔴 — заблокирован\nНажмите для переключения:"
    )
    kb = _build_slot_grid_kb(all_slots, blocked, date_iso)
    try:
        await callback.message.edit_text(text, parse_mode="HTML", reply_markup=kb)
    except TelegramBadRequest:
        pass
