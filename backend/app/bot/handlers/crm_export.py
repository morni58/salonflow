"""CRM в Telegram: воронка, отчёты 1/3/7 дней, выгрузки CSV."""
from __future__ import annotations

import csv
import io
import logging
from datetime import datetime, timedelta, timezone
from html import escape

from aiogram import Router, F
from aiogram.types import BufferedInputFile, CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup

from app.bot.async_db import run_sync
from app.bot.cache import get_user_sync as _cached_get_user
from app.bot.permissions import can_crm
from app.core.database import get_supabase

logger = logging.getLogger(__name__)
router = Router()

MAX_ROWS_BOOKINGS = 8000
MAX_ROWS_ANALYTICS = 20000
LIST_PAGE = 7


def _get_user_tenant_role_sync(tg_id: int) -> tuple[str | None, str | None]:
    u = _cached_get_user(tg_id)
    if not u:
        return None, None
    return u["tenant_id"], u.get("role")


def _format_price(tiyn: int) -> str:
    return f"{(tiyn or 0) // 100:,}".replace(",", " ") + "₸"


def _parse_dt(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None


def _crm_summary_sync(tenant_id: str) -> str:
    sb = get_supabase()
    clients = sb.table("clients").select("id").eq("tenant_id", tenant_id).execute()
    bookings = sb.table("bookings").select("status").eq("tenant_id", tenant_id).execute()
    retained = (
        sb.table("tenants")
        .select("crm_completed_revenue_retained")
        .eq("id", tenant_id)
        .limit(1)
        .execute()
    )
    ret_tg = 0
    if retained.data:
        ret_tg = (retained.data[0].get("crm_completed_revenue_retained") or 0) // 100

    c_total = len(clients.data or [])
    bd = bookings.data or []
    b_total = len(bd)
    p_lead = sum(1 for b in bd if b.get("status") == "pending")
    p_wait = sum(1 for b in bd if b.get("status") == "waiting")
    f_conf = sum(1 for b in bd if b.get("status") == "confirmed")
    f_done = sum(1 for b in bd if b.get("status") == "completed")
    f_can = sum(1 for b in bd if b.get("status") == "cancelled")

    return (
        f"📊 <b>CRM</b>\n\n"
        f"👥 Клиентов в базе: <b>{c_total}</b>\n"
        f"📋 Заявок всего: <b>{b_total}</b>\n"
        f"   🟡 Лиды (ожидание): {p_lead} | ⏳ В очереди: {p_wait}\n"
        f"   ✅ Записи подтверждены: {f_conf} | ✔️ Выполнено: {f_done}\n"
        f"   ❌ Отказы/архив: {f_can}\n\n"
        f"💰 Накоплено после очистки (7+ дн.): <b>{ret_tg:,}₸</b>\n"
        f"<i>Выполненные старше 7 дней удаляются из списков; сумма накапливается в этом поле.</i>"
    )


def _crm_hub_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="🟡 Лиды (ожидание)", callback_data="crm:leads"),
                InlineKeyboardButton(text="✅ Записи", callback_data="crm:records"),
            ],
            [
                InlineKeyboardButton(text="✔️ Выполненные", callback_data="crm:done"),
                InlineKeyboardButton(text="📦 Архив", callback_data="crm:arch"),
            ],
            [
                InlineKeyboardButton(text="📈 1 день", callback_data="crm:rep:1"),
                InlineKeyboardButton(text="📈 3 дня", callback_data="crm:rep:3"),
                InlineKeyboardButton(text="📈 7 дней", callback_data="crm:rep:7"),
            ],
            [
                InlineKeyboardButton(text="📋 Заявки (.csv)", callback_data="crm:csv:bookings"),
                InlineKeyboardButton(text="✔️ Выполн. (.csv)", callback_data="crm:csv:completed"),
            ],
            [
                InlineKeyboardButton(text="👥 Клиенты (.csv)", callback_data="crm:csv:clients"),
                InlineKeyboardButton(text="💇 Услуги (.csv)", callback_data="crm:csv:services"),
            ],
            [InlineKeyboardButton(text="📈 События 90д (.csv)", callback_data="crm:csv:analytics")],
            [InlineKeyboardButton(text="◀️ В меню", callback_data="menu:main")],
        ]
    )


# Legacy export for commands.py
def _crm_keyboard() -> InlineKeyboardMarkup:
    return _crm_hub_keyboard()


def _service_names_sync(sb, service_ids: list) -> str:
    if not service_ids:
        return "—"
    parts: list[str] = []
    for sid in service_ids:
        sid = str(sid)
        r = sb.table("services").select("name").eq("id", sid).limit(1).execute()
        parts.append(r.data[0]["name"] if r.data else sid)
    return " | ".join(parts)


def _booking_card_sync(tenant_id: str, bid: str) -> tuple[str, InlineKeyboardMarkup | None]:
    sb = get_supabase()
    r = (
        sb.table("bookings")
        .select(
            "id, status, preferred_datetime, total_price, total_duration_minutes, "
            "client_id, service_ids, master_id, created_at, payment_status, source",
        )
        .eq("tenant_id", tenant_id)
        .eq("id", bid)
        .limit(1)
        .execute()
    )
    if not r.data:
        return "❌ Заявка не найдена.", None
    b = r.data[0]
    st = b.get("status", "")
    dt = _parse_dt(b.get("preferred_datetime"))
    dt_s = dt.strftime("%d.%m.%Y %H:%M") if dt else "—"
    client_name = "—"
    contact = "—"
    if b.get("client_id"):
        cl = sb.table("clients").select("name, contact_type, contact_value").eq("id", b["client_id"]).limit(1).execute()
        if cl.data:
            c = cl.data[0]
            client_name = escape(c.get("name") or "")
            contact = f"{c.get('contact_type')}: {escape(str(c.get('contact_value') or ''))}"
    master_line = ""
    if b.get("master_id"):
        m = sb.table("masters").select("display_name").eq("id", b["master_id"]).limit(1).execute()
        if m.data:
            master_line = f"💇 Мастер: <b>{escape(m.data[0].get('display_name') or '')}</b>\n"
    svc = _service_names_sync(sb, list(b.get("service_ids") or []))
    status_ru = {
        "pending": "🟡 Ожидание (лид)",
        "waiting": "⏳ В очереди",
        "confirmed": "✅ Запись подтверждена",
        "completed": "✔️ Выполнено",
        "cancelled": "❌ Отказ / архив",
    }.get(st, st)
    text = (
        f"<b>{status_ru}</b>\n\n"
        f"{master_line}"
        f"👤 {client_name}\n"
        f"📱 {contact}\n"
        f"💇 {escape(svc)}\n"
        f"💰 {_format_price(b.get('total_price') or 0)}\n"
        f"🕐 {dt_s}\n"
        f"⏱ {b.get('total_duration_minutes') or 0} мин\n"
        f"📥 Источник: {b.get('source', '')}\n"
    )
    kb: list[list[InlineKeyboardButton]] = []
    if st == "pending" or st == "waiting":
        kb.append(
            [
                InlineKeyboardButton(text="✅ Принять", callback_data=f"bk:confirm:{bid}"),
                InlineKeyboardButton(text="❌ Отказать", callback_data=f"bk:cancel:{bid}"),
            ]
        )
        kb.append(
            [
                InlineKeyboardButton(text="⏳ В очередь", callback_data=f"bk:wait:{bid}"),
                InlineKeyboardButton(text="📅 Перенести", callback_data=f"bk:reschedule:{bid}"),
            ]
        )
    elif st == "confirmed":
        kb.append([InlineKeyboardButton(text="✔️ Выполнено", callback_data=f"bk:complete:{bid}")])
    kb.append([InlineKeyboardButton(text="◀️ В CRM", callback_data="crm:hub")])
    return text, InlineKeyboardMarkup(inline_keyboard=kb) if kb else InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="◀️ В CRM", callback_data="crm:hub")]]
    )


def _list_bookings_sync(
    tenant_id: str,
    statuses: list[str],
    limit: int = LIST_PAGE,
    order_field: str = "preferred_datetime",
    desc: bool = True,
) -> list[dict]:
    sb = get_supabase()
    q = (
        sb.table("bookings")
        .select("id, preferred_datetime, total_price, status, client_id, master_id, created_at, completed_at")
        .eq("tenant_id", tenant_id)
        .in_("status", statuses)
        .order(order_field, desc=desc)
        .limit(limit)
        .execute()
    )
    return list(q.data or [])


@router.callback_query(F.data == "crm:hub")
async def crm_hub(callback: CallbackQuery):
    tid, role = await run_sync(_get_user_tenant_role_sync, callback.from_user.id)
    if not tid or not can_crm(role):
        await callback.answer("Нет доступа", show_alert=True)
        return
    await callback.answer()
    text = await run_sync(_crm_summary_sync, tid)
    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=_crm_hub_keyboard())


@router.callback_query(F.data == "menu:crm")
async def crm_menu(callback: CallbackQuery):
    tid, role = await run_sync(_get_user_tenant_role_sync, callback.from_user.id)
    if not tid or not can_crm(role):
        await callback.answer("Нет доступа", show_alert=True)
        return
    await callback.answer()
    text = await run_sync(_crm_summary_sync, tid)
    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=_crm_hub_keyboard())


@router.callback_query(F.data == "crm:leads")
async def crm_leads(callback: CallbackQuery):
    tid, role = await run_sync(_get_user_tenant_role_sync, callback.from_user.id)
    if not tid or not can_crm(role):
        await callback.answer("Нет доступа", show_alert=True)
        return
    await callback.answer()
    rows = await run_sync(_list_bookings_sync, tid, ["pending", "waiting"], LIST_PAGE, "created_at", True)
    if not rows:
        await callback.message.edit_text(
            "🟡 <b>Лиды</b>\n\nПока нет заявок в ожидании.",
            parse_mode="HTML",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[[InlineKeyboardButton(text="◀️ Назад", callback_data="crm:hub")]]
            ),
        )
        return
    sb = get_supabase()
    lines = ["🟡 <b>Лиды (ожидание)</b>\n"]
    buttons: list[list[InlineKeyboardButton]] = []
    for b in rows:
        dt = _parse_dt(b.get("preferred_datetime"))
        t_s = dt.strftime("%d.%m %H:%M") if dt else "—"
        name = "—"
        if b.get("client_id"):
            cl = sb.table("clients").select("name").eq("id", b["client_id"]).limit(1).execute()
            if cl.data:
                name = cl.data[0].get("name") or "—"
        em = "🟡" if b.get("status") == "pending" else "⏳"
        lines.append(f"{em} {t_s} — {escape(name)} — {_format_price(b.get('total_price') or 0)}")
        buttons.append(
            [InlineKeyboardButton(text=f"{em} {t_s} {name[:20]}", callback_data=f"crm:bd:{b['id']}")]
        )
    buttons.append([InlineKeyboardButton(text="◀️ Назад", callback_data="crm:hub")])
    await callback.message.edit_text(
        "\n".join(lines),
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )


@router.callback_query(F.data == "crm:records")
async def crm_records(callback: CallbackQuery):
    tid, role = await run_sync(_get_user_tenant_role_sync, callback.from_user.id)
    if not tid or not can_crm(role):
        await callback.answer("Нет доступа", show_alert=True)
        return
    await callback.answer()
    rows = await run_sync(_list_bookings_sync, tid, ["confirmed"], LIST_PAGE, "preferred_datetime", False)
    if not rows:
        await callback.message.edit_text(
            "✅ <b>Активные записи</b>\n\nНет подтверждённых записей.",
            parse_mode="HTML",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[[InlineKeyboardButton(text="◀️ Назад", callback_data="crm:hub")]]
            ),
        )
        return
    sb = get_supabase()
    lines = ["✅ <b>Записи (подтверждены)</b>\n"]
    buttons: list[list[InlineKeyboardButton]] = []
    for b in rows:
        dt = _parse_dt(b.get("preferred_datetime"))
        t_s = dt.strftime("%d.%m %H:%M") if dt else "—"
        name = "—"
        if b.get("client_id"):
            cl = sb.table("clients").select("name").eq("id", b["client_id"]).limit(1).execute()
            if cl.data:
                name = cl.data[0].get("name") or "—"
        lines.append(f"✅ {t_s} — {escape(name)} — {_format_price(b.get('total_price') or 0)}")
        buttons.append(
            [InlineKeyboardButton(text=f"✅ {t_s} {name[:18]}", callback_data=f"crm:bd:{b['id']}")]
        )
    buttons.append([InlineKeyboardButton(text="◀️ Назад", callback_data="crm:hub")])
    await callback.message.edit_text(
        "\n".join(lines),
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )


@router.callback_query(F.data == "crm:done")
async def crm_done(callback: CallbackQuery):
    tid, role = await run_sync(_get_user_tenant_role_sync, callback.from_user.id)
    if not tid or not can_crm(role):
        await callback.answer("Нет доступа", show_alert=True)
        return
    await callback.answer()
    rows = await run_sync(_list_bookings_sync, tid, ["completed"], LIST_PAGE, "completed_at", True)
    if not rows:
        await callback.message.edit_text(
            "✔️ <b>Выполненные</b>\n\nПока нет.",
            parse_mode="HTML",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[[InlineKeyboardButton(text="◀️ Назад", callback_data="crm:hub")]]
            ),
        )
        return
    sb = get_supabase()
    lines = ["✔️ <b>Последние выполненные</b>\n"]
    buttons: list[list[InlineKeyboardButton]] = []
    for b in rows:
        dt = _parse_dt(b.get("preferred_datetime"))
        t_s = dt.strftime("%d.%m %H:%M") if dt else "—"
        name = "—"
        if b.get("client_id"):
            cl = sb.table("clients").select("name").eq("id", b["client_id"]).limit(1).execute()
            if cl.data:
                name = cl.data[0].get("name") or "—"
        lines.append(f"✔️ {t_s} — {escape(name)} — {_format_price(b.get('total_price') or 0)}")
        buttons.append(
            [InlineKeyboardButton(text=f"✔️ {name[:24]}", callback_data=f"crm:bd:{b['id']}")]
        )
    buttons.append([InlineKeyboardButton(text="◀️ Назад", callback_data="crm:hub")])
    await callback.message.edit_text(
        "\n".join(lines)[:3900],
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )


@router.callback_query(F.data == "crm:arch")
async def crm_arch(callback: CallbackQuery):
    tid, role = await run_sync(_get_user_tenant_role_sync, callback.from_user.id)
    if not tid or not can_crm(role):
        await callback.answer("Нет доступа", show_alert=True)
        return
    await callback.answer()
    rows = await run_sync(_list_bookings_sync, tid, ["cancelled"], LIST_PAGE, "preferred_datetime", True)
    if not rows:
        await callback.message.edit_text(
            "📦 <b>Архив (отказы)</b>\n\nПусто.",
            parse_mode="HTML",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[[InlineKeyboardButton(text="◀️ Назад", callback_data="crm:hub")]]
            ),
        )
        return
    sb = get_supabase()
    lines = ["📦 <b>Архив (отказы)</b>\n"]
    buttons: list[list[InlineKeyboardButton]] = []
    for b in rows:
        dt = _parse_dt(b.get("preferred_datetime"))
        t_s = dt.strftime("%d.%m %H:%M") if dt else "—"
        name = "—"
        if b.get("client_id"):
            cl = sb.table("clients").select("name").eq("id", b["client_id"]).limit(1).execute()
            if cl.data:
                name = cl.data[0].get("name") or "—"
        lines.append(f"❌ {t_s} — {escape(name)}")
        buttons.append(
            [InlineKeyboardButton(text=f"❌ {t_s} {name[:16]}", callback_data=f"crm:bd:{b['id']}")]
        )
    buttons.append([InlineKeyboardButton(text="◀️ Назад", callback_data="crm:hub")])
    await callback.message.edit_text(
        "\n".join(lines)[:3900],
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )


def _report_completed_sync(tenant_id: str, days: int) -> tuple[str, InlineKeyboardMarkup]:
    sb = get_supabase()
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    q = (
        sb.table("bookings")
        .select("id, client_id, total_price, completed_at, preferred_datetime, service_ids")
        .eq("tenant_id", tenant_id)
        .eq("status", "completed")
        .gte("completed_at", since.isoformat())
        .order("completed_at", desc=True)
        .execute()
    )
    rows = q.data or []
    total = sum(int(b.get("total_price") or 0) for b in rows)
    by_client: dict[str, list[dict]] = {}
    for b in rows:
        cid = b.get("client_id") or "none"
        by_client.setdefault(cid, []).append(b)

    lines = [
        f"📈 <b>Выполнено за {days} дн.</b>\n",
        f"Визитов: <b>{len(rows)}</b> | Сумма: <b>{_format_price(total)}</b>\n",
        f"Уникальных клиентов: <b>{len(by_client)}</b>\n",
    ]
    buttons: list[list[InlineKeyboardButton]] = []
    seen_btn = 0
    for cid, blist in list(by_client.items())[:12]:
        if cid == "none":
            continue
        cl = sb.table("clients").select("name, contact_type, contact_value, visit_count, total_spent").eq("id", cid).limit(1).execute()
        name = cl.data[0].get("name") if cl.data else "—"
        subtotal = sum(int(x.get("total_price") or 0) for x in blist)
        lines.append(f"• {escape(name)} — {len(blist)} виз. — {_format_price(subtotal)}")
        if seen_btn < 8:
            buttons.append(
                [
                    InlineKeyboardButton(
                        text=f"👤 {name[:28]}",
                        callback_data=f"crm:cl:{cid}:{days}",
                    )
                ]
            )
            seen_btn += 1
    buttons.append([InlineKeyboardButton(text="◀️ В CRM", callback_data="crm:hub")])
    text = "\n".join(lines)
    if len(text) > 3900:
        text = text[:3850] + "…"
    return text, InlineKeyboardMarkup(inline_keyboard=buttons)


@router.callback_query(F.data.startswith("crm:rep:"))
async def crm_report(callback: CallbackQuery):
    tid, role = await run_sync(_get_user_tenant_role_sync, callback.from_user.id)
    if not tid or not can_crm(role):
        await callback.answer("Нет доступа", show_alert=True)
        return
    tail = callback.data.removeprefix("crm:rep:")
    if tail not in ("1", "3", "7"):
        return
    await callback.answer()
    days = int(tail)
    text, kb = await run_sync(_report_completed_sync, tid, days)
    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=kb)


@router.callback_query(F.data.startswith("crm:cl:"))
async def crm_client_drill(callback: CallbackQuery):
    tid, role = await run_sync(_get_user_tenant_role_sync, callback.from_user.id)
    if not tid or not can_crm(role):
        await callback.answer("Нет доступа", show_alert=True)
        return
    await callback.answer()
    try:
        _, _, cid, d_s = callback.data.split(":", 3)
        days = int(d_s)
    except (ValueError, IndexError):
        return
    sb = get_supabase()
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    cl = (
        sb.table("clients")
        .select("name, contact_type, contact_value, visit_count, total_spent, notes, first_visit, last_visit")
        .eq("id", cid)
        .eq("tenant_id", tid)
        .limit(1)
        .execute()
    )
    if not cl.data:
        await callback.message.edit_text("Клиент не найден.")
        return
    c = cl.data[0]
    bq = (
        sb.table("bookings")
        .select("id, preferred_datetime, total_price, service_ids, completed_at")
        .eq("tenant_id", tid)
        .eq("client_id", cid)
        .eq("status", "completed")
        .gte("completed_at", since.isoformat())
        .order("completed_at", desc=True)
        .execute()
    )
    visits = bq.data or []
    total = sum(int(b.get("total_price") or 0) for b in visits)
    lines = [
        f"👤 <b>{escape(c.get('name') or '')}</b>\n",
        f"📱 {c.get('contact_type')}: {escape(str(c.get('contact_value') or ''))}\n",
        f"📊 В базе: визитов {c.get('visit_count', 0)}, всего {_format_price(c.get('total_spent') or 0)}\n",
    ]
    if c.get("notes"):
        lines.append(f"📝 {escape(c.get('notes')[:500])}\n")
    lines.append(f"\n<b>Выполнено за {days} дн.</b> ({len(visits)})\n")
    for b in visits[:15]:
        dt = _parse_dt(b.get("preferred_datetime"))
        t_s = dt.strftime("%d.%m.%Y %H:%M") if dt else "—"
        sv = _service_names_sync(sb, list(b.get("service_ids") or []))
        lines.append(f"• {t_s} — {_format_price(b.get('total_price') or 0)} — {escape(sv[:80])}")
    lines.append(f"\n<b>Итого за период:</b> {_format_price(total)}")
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="◀️ К отчёту", callback_data=f"crm:rep:{days}")],
            [InlineKeyboardButton(text="◀️ В CRM", callback_data="crm:hub")],
        ]
    )
    text = "\n".join(lines)
    if len(text) > 3900:
        text = text[:3850] + "…"
    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=kb)


@router.callback_query(F.data.startswith("crm:bd:"))
async def crm_booking_detail(callback: CallbackQuery):
    tid, role = await run_sync(_get_user_tenant_role_sync, callback.from_user.id)
    if not tid or not can_crm(role):
        await callback.answer("Нет доступа", show_alert=True)
        return
    await callback.answer()
    try:
        bid = callback.data.split(":", 2)[2]
    except IndexError:
        return
    text, kb = await run_sync(_booking_card_sync, tid, bid)
    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=kb)


# ── CSV exports ───────────────────────────────────────────────

# Статусы на понятном русском
_STATUS_RU = {
    "pending":   "Ожидание (лид)",
    "waiting":   "В очереди",
    "confirmed": "Подтверждено",
    "completed": "Выполнено",
    "cancelled": "Отказ / архив",
}
_PAYMENT_RU = {
    "pending":  "Не оплачено",
    "paid":     "Оплачено",
    "overpaid": "Переплата",
    "refunded": "Возврат",
}
_SOURCE_RU = {
    "web": "Сайт",
    "bot": "Бот",
    "manual": "Вручную",
}
_EVENT_RU = {
    "visit":        "Просмотр сайта",
    "catalog_view": "Просмотр каталога",
    "cart_open":    "Открыл корзину",
    "checkout":     "Оформил заявку",
}


def _fmt_dt(raw: str | None) -> str:
    """ISO-строка → ДД.ММ.ГГГГ ЧЧ:ММ (UTC). Пусто если None."""
    if not raw:
        return ""
    try:
        dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        return dt.strftime("%d.%m.%Y %H:%M")
    except ValueError:
        return str(raw)


def _fmt_price(tiyn: int | None) -> str:
    """Тиыны → «1 500 ₸»."""
    tenge = (tiyn or 0) // 100
    return f"{tenge:,}".replace(",", " ") + " ₸"


def _fmt_dur(minutes: int | None) -> str:
    """Минуты → «1ч 30мин» или «45 мин»."""
    m = minutes or 0
    if m <= 0:
        return ""
    if m < 60:
        return f"{m} мин"
    h, rem = divmod(m, 60)
    return f"{h}ч {rem}мин" if rem else f"{h}ч"


def _fmt_contact(contact_type: str, contact_value: str) -> str:
    """Telegram + @user → «@user (Telegram)»."""
    label = {"telegram": "Telegram", "whatsapp": "WhatsApp",
             "instagram": "Instagram", "phone": "Телефон"}.get(contact_type, contact_type)
    val = contact_value or ""
    return f"{val} ({label})" if val else ""


def _master_name_sync(sb, master_id: str | None) -> str:
    if not master_id:
        return "—"
    r = sb.table("masters").select("display_name").eq("id", master_id).limit(1).execute()
    return r.data[0].get("display_name") or "—" if r.data else "—"


def _today_str() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d")


def _bookings_csv_sync(tenant_id: str) -> bytes:
    sb = get_supabase()
    rows = (
        sb.table("bookings")
        .select(
            "created_at, preferred_datetime, status, payment_status, source, "
            "total_price, total_duration_minutes, client_id, service_ids, "
            "completed_at, accepted_at, master_id",
        )
        .eq("tenant_id", tenant_id)
        .order("preferred_datetime", desc=True)
        .limit(MAX_ROWS_BOOKINGS)
        .execute()
    )
    svc_cache: dict[str, str] = {}
    master_cache: dict[str, str] = {}

    def svc_names(ids: list) -> str:
        if not ids:
            return ""
        parts = []
        for sid in ids:
            sid = str(sid)
            if sid not in svc_cache:
                r = sb.table("services").select("name").eq("id", sid).limit(1).execute()
                svc_cache[sid] = r.data[0]["name"] if r.data else "?"
            parts.append(svc_cache[sid])
        return ", ".join(parts)

    def master_name(mid: str | None) -> str:
        if not mid:
            return ""
        if mid not in master_cache:
            r = sb.table("masters").select("display_name").eq("id", mid).limit(1).execute()
            master_cache[mid] = r.data[0].get("display_name") or "" if r.data else ""
        return master_cache[mid]

    out = io.StringIO()
    w = csv.writer(out, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    w.writerow([
        "№",
        "Дата визита",
        "Создана",
        "Статус",
        "Клиент",
        "Контакт",
        "Услуги",
        "Длительность",
        "Сумма",
        "Мастер",
        "Оплата",
        "Источник",
        "Принята",
        "Выполнена",
    ])
    for n, b in enumerate(rows.data or [], start=1):
        client_name = ""
        contact = ""
        if b.get("client_id"):
            cl = sb.table("clients").select("name, contact_type, contact_value").eq("id", b["client_id"]).limit(1).execute()
            if cl.data:
                c = cl.data[0]
                client_name = c.get("name") or ""
                contact = _fmt_contact(c.get("contact_type", ""), c.get("contact_value", ""))
        w.writerow([
            n,
            _fmt_dt(b.get("preferred_datetime")),
            _fmt_dt(b.get("created_at")),
            _STATUS_RU.get(b.get("status", ""), b.get("status", "")),
            client_name,
            contact,
            svc_names(list(b.get("service_ids") or [])),
            _fmt_dur(b.get("total_duration_minutes")),
            _fmt_price(b.get("total_price")),
            master_name(b.get("master_id")),
            _PAYMENT_RU.get(b.get("payment_status", ""), b.get("payment_status", "") or ""),
            _SOURCE_RU.get(b.get("source", ""), b.get("source", "") or ""),
            _fmt_dt(b.get("accepted_at")),
            _fmt_dt(b.get("completed_at")),
        ])
    return out.getvalue().encode("utf-8-sig")


def _completed_bookings_csv_sync(tenant_id: str) -> bytes:
    """Только выполненные — для бухгалтерии и отчётности."""
    sb = get_supabase()
    rows = (
        sb.table("bookings")
        .select(
            "preferred_datetime, total_price, total_duration_minutes, "
            "client_id, service_ids, completed_at, master_id",
        )
        .eq("tenant_id", tenant_id)
        .eq("status", "completed")
        .order("completed_at", desc=True)
        .limit(MAX_ROWS_BOOKINGS)
        .execute()
    )
    master_cache: dict[str, str] = {}

    def master_name(mid: str | None) -> str:
        if not mid:
            return ""
        if mid not in master_cache:
            r = sb.table("masters").select("display_name").eq("id", mid).limit(1).execute()
            master_cache[mid] = r.data[0].get("display_name") or "" if r.data else ""
        return master_cache[mid]

    out = io.StringIO()
    w = csv.writer(out, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    w.writerow([
        "№",
        "Дата визита",
        "Выполнено",
        "Клиент",
        "Контакт",
        "Услуги",
        "Длительность",
        "Мастер",
        "Сумма",
    ])
    for n, b in enumerate(rows.data or [], start=1):
        client_name = ""
        contact = ""
        if b.get("client_id"):
            cl = sb.table("clients").select("name, contact_type, contact_value").eq("id", b["client_id"]).limit(1).execute()
            if cl.data:
                c = cl.data[0]
                client_name = c.get("name") or ""
                contact = _fmt_contact(c.get("contact_type", ""), c.get("contact_value", ""))
        svc = _service_names_sync(sb, list(b.get("service_ids") or []))
        w.writerow([
            n,
            _fmt_dt(b.get("preferred_datetime")),
            _fmt_dt(b.get("completed_at")),
            client_name,
            contact,
            svc,
            _fmt_dur(b.get("total_duration_minutes")),
            master_name(b.get("master_id")),
            _fmt_price(b.get("total_price")),
        ])
    return out.getvalue().encode("utf-8-sig")


def _clients_csv_sync(tenant_id: str) -> bytes:
    sb = get_supabase()
    rows = (
        sb.table("clients")
        .select("name, contact_type, contact_value, visit_count, total_spent, notes, first_visit, last_visit, created_at")
        .eq("tenant_id", tenant_id)
        .order("total_spent", desc=True)
        .execute()
    )
    out = io.StringIO()
    w = csv.writer(out, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    w.writerow([
        "№",
        "Имя клиента",
        "Контакт",
        "Количество визитов",
        "Общая сумма",
        "Первый визит",
        "Последний визит",
        "Заметки",
    ])
    for n, c in enumerate(rows.data or [], start=1):
        w.writerow([
            n,
            c.get("name", ""),
            _fmt_contact(c.get("contact_type", ""), c.get("contact_value", "")),
            c.get("visit_count", 0),
            _fmt_price(c.get("total_spent")),
            _fmt_dt(c.get("first_visit")),
            _fmt_dt(c.get("last_visit")),
            (c.get("notes") or "").replace("\n", " "),
        ])
    return out.getvalue().encode("utf-8-sig")


def _services_csv_sync(tenant_id: str) -> bytes:
    sb = get_supabase()
    rows = (
        sb.table("services")
        .select("category_id, name, price, duration_minutes, is_active")
        .eq("tenant_id", tenant_id)
        .is_("deleted_at", "null")  # только не удалённые
        .order("category_id")
        .execute()
    )
    cat_cache: dict[str, str] = {}

    def cat_name(cid: str | None) -> str:
        if not cid:
            return ""
        if cid not in cat_cache:
            r = sb.table("categories").select("name").eq("id", cid).limit(1).execute()
            cat_cache[cid] = r.data[0]["name"] if r.data else ""
        return cat_cache[cid]

    out = io.StringIO()
    w = csv.writer(out, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    w.writerow([
        "№",
        "Категория",
        "Услуга",
        "Цена",
        "Длительность",
        "Активна",
    ])
    for n, s in enumerate(rows.data or [], start=1):
        w.writerow([
            n,
            cat_name(s.get("category_id")),
            s.get("name", ""),
            _fmt_price(s.get("price")),
            _fmt_dur(s.get("duration_minutes")),
            "Да" if s.get("is_active") else "Нет",
        ])
    return out.getvalue().encode("utf-8-sig")


def _analytics_csv_sync(tenant_id: str) -> bytes:
    """Статистика сайта за 90 дней — сколько раз что делали посетители."""
    sb = get_supabase()
    since = (datetime.utcnow() - timedelta(days=90)).isoformat()
    rows = (
        sb.table("analytics")
        .select("event_type, created_at")
        .eq("tenant_id", tenant_id)
        .gte("created_at", since)
        .order("created_at", desc=True)
        .limit(MAX_ROWS_ANALYTICS)
        .execute()
    )
    out = io.StringIO()
    w = csv.writer(out, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    w.writerow(["№", "Дата и время", "Действие посетителя"])
    for n, e in enumerate(rows.data or [], start=1):
        w.writerow([
            n,
            _fmt_dt(e.get("created_at")),
            _EVENT_RU.get(e.get("event_type", ""), e.get("event_type", "")),
        ])
    return out.getvalue().encode("utf-8-sig")


@router.callback_query(F.data.startswith("crm:csv:"))
async def crm_send_csv(callback: CallbackQuery):
    kind = callback.data.split(":")[2]
    tid, role = await run_sync(_get_user_tenant_role_sync, callback.from_user.id)
    if not tid or not can_crm(role):
        await callback.answer("Нет доступа", show_alert=True)
        return
    await callback.answer("Формирую файл…")

    today = _today_str()
    labels = {
        "bookings":  ("Все заявки",              f"заявки_{today}.csv"),
        "completed": ("Выполненные визиты",       f"выполненные_{today}.csv"),
        "clients":   ("База клиентов",            f"клиенты_{today}.csv"),
        "services":  ("Каталог услуг",            f"услуги_{today}.csv"),
        "analytics": ("Статистика сайта (90 дн)", f"статистика_{today}.csv"),
    }
    builders = {
        "bookings":  _bookings_csv_sync,
        "completed": _completed_bookings_csv_sync,
        "clients":   _clients_csv_sync,
        "services":  _services_csv_sync,
        "analytics": _analytics_csv_sync,
    }
    if kind not in builders:
        await callback.message.reply("Неизвестный тип выгрузки.")
        return

    label, filename = labels[kind]
    try:
        data = await run_sync(builders[kind], tid)
    except Exception:
        logger.exception("crm csv export failed kind=%s", kind)
        await callback.message.reply("❌ Ошибка при выгрузке. Попробуйте позже.")
        return

    if len(data) < 80:
        await callback.message.reply("Нет данных для выгрузки.")
        return

    await callback.message.answer_document(
        BufferedInputFile(data, filename=filename),
        caption=f"📊 {label} · {today}",
    )
