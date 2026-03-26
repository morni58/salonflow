"""CRM: сводка и выгрузки таблиц в CSV (UTF-8 с BOM для Excel)."""
from __future__ import annotations

import csv
import io
import logging
from datetime import datetime, timedelta

from aiogram import Router, F
from aiogram.types import BufferedInputFile, CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup

from app.bot.async_db import run_sync
from app.core.database import get_supabase

logger = logging.getLogger(__name__)
router = Router()

MAX_ROWS_BOOKINGS = 8000
MAX_ROWS_ANALYTICS = 20000


def _get_user_tenant_role_sync(tg_id: int) -> tuple[str | None, str | None]:
    sb = get_supabase()
    r = sb.table("users").select("tenant_id, role").eq("telegram_user_id", tg_id).limit(1).execute()
    if r.data:
        return r.data[0]["tenant_id"], r.data[0]["role"]
    return None, None


def _crm_summary_sync(tenant_id: str) -> str:
    sb = get_supabase()
    clients = sb.table("clients").select("id").eq("tenant_id", tenant_id).execute()
    bookings = sb.table("bookings").select("status").eq("tenant_id", tenant_id).execute()
    c_total = len(clients.data or [])
    bd = bookings.data or []
    b_total = len(bd)
    p_total = sum(1 for b in bd if b.get("status") == "pending")
    f_total = sum(1 for b in bd if b.get("status") == "confirmed")
    return (
        f"📊 <b>CRM — кратко</b>\n\n"
        f"👥 Клиентов в базе: <b>{c_total}</b>\n"
        f"📋 Заявок всего: <b>{b_total}</b>\n"
        f"   🟡 Ожидают: {p_total} | ✅ Подтверждено: {f_total}\n\n"
        f"Ниже — выгрузки для Excel (.csv), разделитель «;», UTF-8."
    )


def _bookings_csv_sync(tenant_id: str) -> bytes:
    sb = get_supabase()
    rows = (
        sb.table("bookings")
        .select(
            "id, created_at, preferred_datetime, status, payment_status, source, "
            "total_price, total_duration_minutes, client_id, service_ids"
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


def _crm_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📋 Заявки (.csv)", callback_data="crm:csv:bookings")],
        [InlineKeyboardButton(text="👥 Клиенты (.csv)", callback_data="crm:csv:clients")],
        [InlineKeyboardButton(text="💇 Услуги (.csv)", callback_data="crm:csv:services")],
        [InlineKeyboardButton(text="📈 События сайта 90д (.csv)", callback_data="crm:csv:analytics")],
        [InlineKeyboardButton(text="◀️ В меню", callback_data="menu:main")],
    ])


@router.callback_query(F.data == "menu:crm")
async def crm_menu(callback: CallbackQuery):
    tid, role = await run_sync(_get_user_tenant_role_sync, callback.from_user.id)
    if not tid or role not in ("owner", "admin"):
        await callback.answer("Нет доступа", show_alert=True)
        return
    await callback.answer()
    text = await run_sync(_crm_summary_sync, tid)
    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=_crm_keyboard())


@router.callback_query(F.data.startswith("crm:csv:"))
async def crm_send_csv(callback: CallbackQuery):
    kind = callback.data.split(":")[2]
    tid, role = await run_sync(_get_user_tenant_role_sync, callback.from_user.id)
    if not tid or role not in ("owner", "admin"):
        await callback.answer("Нет доступа", show_alert=True)
        return
    await callback.answer("Формирую файл…")

    builders = {
        "bookings": (_bookings_csv_sync, f"bookings_{tid[:8]}.csv"),
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
