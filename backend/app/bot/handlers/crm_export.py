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
from app.bot.permissions import can_crm
from app.core.database import get_supabase

logger = logging.getLogger(__name__)
router = Router()

MAX_ROWS_BOOKINGS = 8000
MAX_ROWS_ANALYTICS = 20000
LIST_PAGE = 7


def _get_user_tenant_role_sync(tg_id: int) -> tuple[str | None, str | None]:
    sb = get_supabase()
    r = sb.table("users").select("tenant_id, role").eq("telegram_user_id", tg_id).limit(1).execute()
    if r.data:
        return r.data[0]["tenant_id"], r.data[0]["role"]
    return None, None


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


# ── CSV exports (existing + completed) ───────────────────────


def _bookings_csv_sync(tenant_id: str) -> bytes:
    sb = get_supabase()
    rows = (
        sb.table("bookings")
        .select(
            "id, created_at, preferred_datetime, status, payment_status, source, "
            "total_price, total_duration_minutes, client_id, service_ids, completed_at, accepted_at",
        )
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .limit(MAX_ROWS_BOOKINGS)
        .execute()
    )
    svc_cache: dict[str, str] = {}

    def svc_names(ids: list) -> str:
        if not ids:
            return ""
        parts = []
        for sid in ids:
            sid = str(sid)
            if sid not in svc_cache:
                r = sb.table("services").select("name").eq("id", sid).limit(1).execute()
                svc_cache[sid] = r.data[0]["name"] if r.data else sid
            parts.append(svc_cache[sid])
        return " | ".join(parts)

    out = io.StringIO()
    w = csv.writer(out, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    w.writerow([
        "id",
        "создана_utc",
        "дата_время_визита",
        "статус",
        "оплата",
        "источник",
        "сумма_тг",
        "длительность_мин",
        "клиент_id",
        "клиент",
        "контакт",
        "услуги",
        "принята_utc",
        "выполнена_utc",
    ])
    for b in rows.data or []:
        client_name = ""
        contact = ""
        if b.get("client_id"):
            cl = sb.table("clients").select("name, contact_type, contact_value").eq("id", b["client_id"]).limit(1).execute()
            if cl.data:
                c = cl.data[0]
                client_name = c.get("name") or ""
                contact = f"{c.get('contact_type', '')}:{c.get('contact_value', '')}"
        price_tg = (b.get("total_price") or 0) // 100
        w.writerow([
            b["id"],
            b.get("created_at", ""),
            b.get("preferred_datetime", ""),
            b.get("status", ""),
            b.get("payment_status", ""),
            b.get("source", ""),
            price_tg,
            b.get("total_duration_minutes", ""),
            b.get("client_id") or "",
            client_name,
            contact,
            svc_names(list(b.get("service_ids") or [])),
            b.get("accepted_at") or "",
            b.get("completed_at") or "",
        ])
    return out.getvalue().encode("utf-8-sig")


def _completed_bookings_csv_sync(tenant_id: str) -> bytes:
    """Только выполненные (для отчётности)."""
    sb = get_supabase()
    rows = (
        sb.table("bookings")
        .select(
            "id, preferred_datetime, total_price, client_id, service_ids, completed_at, master_id",
        )
        .eq("tenant_id", tenant_id)
        .eq("status", "completed")
        .order("completed_at", desc=True)
        .limit(MAX_ROWS_BOOKINGS)
        .execute()
    )
    out = io.StringIO()
    w = csv.writer(out, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    w.writerow(["id", "визит", "выполнено_utc", "сумма_тг", "клиент", "контакт", "услуги", "мастер_id"])
    for b in rows.data or []:
        client_name = ""
        contact = ""
        if b.get("client_id"):
            cl = sb.table("clients").select("name, contact_type, contact_value").eq("id", b["client_id"]).limit(1).execute()
            if cl.data:
                c = cl.data[0]
                client_name = c.get("name") or ""
                contact = f"{c.get('contact_type', '')}:{c.get('contact_value', '')}"
        svc = _service_names_sync(sb, list(b.get("service_ids") or []))
        w.writerow([
            b["id"],
            b.get("preferred_datetime", ""),
            b.get("completed_at", ""),
            (b.get("total_price") or 0) // 100,
            client_name,
            contact,
            svc,
            b.get("master_id") or "",
        ])
    return out.getvalue().encode("utf-8-sig")


def _clients_csv_sync(tenant_id: str) -> bytes:
    sb = get_supabase()
    rows = (
        sb.table("clients")
        .select("id, name, contact_type, contact_value, visit_count, total_spent, notes, first_visit, last_visit, created_at")
        .eq("tenant_id", tenant_id)
        .order("total_spent", desc=True)
        .execute()
    )
    out = io.StringIO()
    w = csv.writer(out, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    w.writerow([
        "id",
        "имя",
        "тип_контакта",
        "контакт",
        "визитов",
        "всего_потрачено_тг",
        "заметки",
        "первый_визит",
        "последний_визит",
        "создан_в_базе",
    ])
    for c in rows.data or []:
        w.writerow([
            c["id"],
            c.get("name", ""),
            c.get("contact_type", ""),
            c.get("contact_value", ""),
            c.get("visit_count", 0),
            (c.get("total_spent") or 0) // 100,
            (c.get("notes") or "").replace("\n", " "),
            c.get("first_visit") or "",
            c.get("last_visit") or "",
            c.get("created_at", ""),
        ])
    return out.getvalue().encode("utf-8-sig")


def _services_csv_sync(tenant_id: str) -> bytes:
    sb = get_supabase()
    rows = (
        sb.table("services")
        .select("id, category_id, name, price, duration_minutes, is_active, deleted_at")
        .eq("tenant_id", tenant_id)
        .execute()
    )
    cat_cache: dict[str, str] = {}

    def cat_name(cid: str | None) -> str:
        if not cid:
            return ""
        if cid not in cat_cache:
            r = sb.table("categories").select("name").eq("id", cid).limit(1).execute()
            cat_cache[cid] = r.data[0]["name"] if r.data else cid
        return cat_cache[cid]

    out = io.StringIO()
    w = csv.writer(out, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    w.writerow([
        "id",
        "категория",
        "название",
        "цена_тг",
        "длительность_мин",
        "активна",
        "удалена_at",
    ])
    for s in rows.data or []:
        w.writerow([
            s["id"],
            cat_name(s.get("category_id")),
            s.get("name", ""),
            (s.get("price") or 0) // 100,
            s.get("duration_minutes", ""),
            "да" if s.get("is_active") else "нет",
            s.get("deleted_at") or "",
        ])
    return out.getvalue().encode("utf-8-sig")


def _analytics_csv_sync(tenant_id: str) -> bytes:
    sb = get_supabase()
    since = (datetime.utcnow() - timedelta(days=90)).isoformat()
    rows = (
        sb.table("analytics")
        .select("id, event_type, session_id, created_at")
        .eq("tenant_id", tenant_id)
        .gte("created_at", since)
        .order("created_at", desc=True)
        .limit(MAX_ROWS_ANALYTICS)
        .execute()
    )
    out = io.StringIO()
    w = csv.writer(out, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    w.writerow(["id", "событие", "session_id", "время_utc"])
    for e in rows.data or []:
        w.writerow([e["id"], e.get("event_type", ""), e.get("session_id", ""), e.get("created_at", "")])
    return out.getvalue().encode("utf-8-sig")


@router.callback_query(F.data.startswith("crm:csv:"))
async def crm_send_csv(callback: CallbackQuery):
    kind = callback.data.split(":")[2]
    tid, role = await run_sync(_get_user_tenant_role_sync, callback.from_user.id)
    if not tid or not can_crm(role):
        await callback.answer("Нет доступа", show_alert=True)
        return
    await callback.answer("Формирую файл…")

    builders = {
        "bookings": (_bookings_csv_sync, f"bookings_{tid[:8]}.csv"),
        "completed": (_completed_bookings_csv_sync, f"completed_{tid[:8]}.csv"),
        "clients": (_clients_csv_sync, f"clients_{tid[:8]}.csv"),
        "services": (_services_csv_sync, f"services_{tid[:8]}.csv"),
        "analytics": (_analytics_csv_sync, f"site_events_90d_{tid[:8]}.csv"),
    }
    if kind not in builders:
        await callback.message.reply("Неизвестный тип выгрузки.")
        return

    fn, name = builders[kind]
    try:
        data = await run_sync(fn, tid)
    except Exception:
        logger.exception("crm csv export failed kind=%s", kind)
        await callback.message.reply("❌ Ошибка при выгрузке. Попробуйте позже.")
        return

    if len(data) < 80:
        await callback.message.reply("Нет данных для выгрузки.")
        return

    await callback.message.answer_document(
        BufferedInputFile(data, filename=name),
        caption=f"Выгрузка: {name}",
    )
