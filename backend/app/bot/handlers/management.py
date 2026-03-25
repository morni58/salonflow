import asyncio
import io
import logging
import uuid
from datetime import datetime, date

from aiogram import Router, F
from aiogram.types import CallbackQuery, Message
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from app.bot.async_db import run_sync
from app.core.database import get_supabase

logger = logging.getLogger(__name__)
router = Router()


def _get_user_tenant_sync(tg_id: int) -> str | None:
    sb = get_supabase()
    r = sb.table("users").select("tenant_id").eq("telegram_user_id", tg_id).limit(1).execute()
    return r.data[0]["tenant_id"] if r.data else None


def _apply_close_day_sync(tenant_id: str, d: date) -> None:
    sb = get_supabase()
    existing = (
        sb.table("schedule_exceptions")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("date", d.isoformat())
        .limit(1)
        .execute()
    )
    if existing.data:
        sb.table("schedule_exceptions").update({
            "is_closed": True,
        }).eq("id", existing.data[0]["id"]).execute()
    else:
        sb.table("schedule_exceptions").insert({
            "tenant_id": tenant_id,
            "date": d.isoformat(),
            "is_closed": True,
        }).execute()


# ═══════════════════════════════════════════════════
# SCHEDULE
# ═══════════════════════════════════════════════════

class ScheduleStates(StatesGroup):
    waiting_close_date = State()
    waiting_open_date = State()


@router.callback_query(F.data == "menu:schedule")
async def schedule_menu(callback: CallbackQuery):
    await callback.answer()
    buttons = [
        [InlineKeyboardButton(text="🔒 Закрыть день", callback_data="sched:close")],
        [InlineKeyboardButton(text="🔓 Открыть день", callback_data="sched:open")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="menu:main")],
    ]
    await callback.message.edit_text(
        "🗓 <b>Расписание</b>\nВыберите действие:",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )


@router.callback_query(F.data == "sched:close")
async def start_close_day(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.set_state(ScheduleStates.waiting_close_date)
    await callback.message.reply("🔒 Введите дату для закрытия (ДД.ММ.ГГГГ):")


@router.message(ScheduleStates.waiting_close_date)
async def process_close_day(message: Message, state: FSMContext):
    tenant_id = await run_sync(_get_user_tenant_sync, message.from_user.id)
    try:
        d = datetime.strptime(message.text.strip(), "%d.%m.%Y").date()
    except ValueError:
        await message.reply("❌ Неверный формат. Используйте ДД.ММ.ГГГГ:")
        return

    await run_sync(_apply_close_day_sync, tenant_id, d)

    await state.clear()
    await message.reply(f"🔒 День {d.strftime('%d.%m.%Y')} закрыт для записи.")


def _closed_days_kb_sync(tenant_id: str) -> tuple[bool, list]:
    sb = get_supabase()
    closed = (
        sb.table("schedule_exceptions")
        .select("id, date")
        .eq("tenant_id", tenant_id)
        .eq("is_closed", True)
        .gte("date", date.today().isoformat())
        .order("date")
        .execute()
    )
    if not closed.data:
        return False, []
    buttons = []
    for c in closed.data:
        d = datetime.strptime(c["date"], "%Y-%m-%d").strftime("%d.%m.%Y")
        buttons.append([InlineKeyboardButton(text=f"🔓 {d}", callback_data=f"sched:reopen:{c['id']}")])
    buttons.append([InlineKeyboardButton(text="◀️ Назад", callback_data="menu:schedule")])
    return True, buttons


@router.callback_query(F.data == "sched:open")
async def start_open_day(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    tenant_id = await run_sync(_get_user_tenant_sync, callback.from_user.id)
    if not tenant_id:
        await callback.message.edit_text("⛔ Нет доступа.")
        return
    ok, rows = await run_sync(_closed_days_kb_sync, tenant_id)
    if not ok:
        await callback.message.reply("Нет закрытых дней.")
        return
    await callback.message.edit_text(
        "Выберите день для открытия:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
    )


def _reopen_exc_sync(exc_id: str) -> None:
    sb = get_supabase()
    sb.table("schedule_exceptions").update({"is_closed": False}).eq("id", exc_id).execute()


@router.callback_query(F.data.startswith("sched:reopen:"))
async def reopen_day(callback: CallbackQuery):
    await callback.answer()
    exc_id = callback.data.split(":")[2]
    await run_sync(_reopen_exc_sync, exc_id)
    await callback.message.reply("🔓 День открыт для записи.")


# ═══════════════════════════════════════════════════
# PORTFOLIO
# ═══════════════════════════════════════════════════

class PortfolioStates(StatesGroup):
    waiting_photo = State()
    waiting_category_choice = State()


@router.callback_query(F.data == "menu:portfolio")
async def portfolio_menu(callback: CallbackQuery):
    await callback.answer()
    buttons = [
        [InlineKeyboardButton(text="📤 Загрузить фото", callback_data="port:upload")],
        [InlineKeyboardButton(text="🗑 Удалить фото", callback_data="port:delete")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="menu:main")],
    ]
    await callback.message.edit_text(
        "📸 <b>Портфолио</b>",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )


@router.callback_query(F.data == "port:upload")
async def start_upload_photo(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.set_state(PortfolioStates.waiting_photo)
    await callback.message.reply("📸 Отправьте фотографию работы:")


@router.message(PortfolioStates.waiting_photo, F.photo)
async def receive_photo(message: Message, state: FSMContext):
    """Receive photo and ask for category."""
    # Get highest resolution photo
    photo = message.photo[-1]
    file = await message.bot.get_file(photo.file_id)

    await state.update_data(file_id=photo.file_id, file_path=file.file_path)

    tenant_id = await run_sync(_get_user_tenant_sync, message.from_user.id)
    if not tenant_id:
        await state.clear()
        await message.reply("❌ Нет доступа.")
        return

    def _cats_sync(tid: str):
        sb = get_supabase()
        return (
            sb.table("categories")
            .select("id, name")
            .eq("tenant_id", tid)
            .eq("is_active", True)
            .filter("deleted_at", "is", "null")
            .execute()
        )

    cats = await run_sync(_cats_sync, tenant_id)

    if not cats.data:
        await state.clear()
        await message.reply(
            "❌ Нет активных категорий в каталоге. Добавьте категории в Supabase (таблица categories) или восстановите seed."
        )
        return

    buttons = []
    for c in cats.data:
        buttons.append([InlineKeyboardButton(
            text=c["name"],
            callback_data=f"port:cat:{c['id']}",
        )])

    await state.set_state(PortfolioStates.waiting_category_choice)
    await message.reply(
        "Выберите категорию для этого фото:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )


def _portfolio_upload_sync(
    tenant_id: str,
    cat_id: str,
    file_id: str,
    raw_bytes: bytes,
) -> None:
    """Тяжёлая sync-работа в thread pool (PIL + Supabase), чтобы не блокировать event loop."""
    from PIL import Image

    sb = get_supabase()
    bio = io.BytesIO(raw_bytes)
    bio.seek(0)
    img = Image.open(bio)
    max_dim = 1200
    if max(img.size) > max_dim:
        ratio = max_dim / max(img.size)
        img = img.resize((int(img.size[0] * ratio), int(img.size[1] * ratio)), Image.LANCZOS)

    output = io.BytesIO()
    img.save(output, format="WEBP", quality=85)
    output.seek(0)
    body = output.getvalue()

    filename = f"{tenant_id}/{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:10]}.webp"

    sb.storage.from_("portfolio").upload(
        path=filename,
        file=body,
        file_options={"content-type": "image/webp"},
    )

    public_url = sb.storage.from_("portfolio").get_public_url(filename)
    if isinstance(public_url, dict):
        public_url = public_url.get("publicUrl") or str(public_url)

    sb.table("portfolio").insert({
        "tenant_id": tenant_id,
        "category_id": cat_id,
        "image_url": public_url,
    }).execute()


def _list_portfolio_for_delete_sync(tenant_id: str | None):
    if not tenant_id:
        return None
    sb = get_supabase()
    return (
        sb.table("portfolio")
        .select("id, image_url, category_id, created_at")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )


def _delete_portfolio_photo_sync(photo_id: str) -> str | None:
    """None = ok, 'not_found' = нет записи."""
    sb = get_supabase()
    photo = sb.table("portfolio").select("image_url").eq("id", photo_id).limit(1).execute()
    if not photo.data:
        return "not_found"
    url = photo.data[0]["image_url"]
    try:
        path = url.split("/portfolio/")[1]
        sb.storage.from_("portfolio").remove([path])
    except Exception:
        pass
    sb.table("portfolio").delete().eq("id", photo_id).execute()
    return None


@router.callback_query(PortfolioStates.waiting_category_choice, F.data.startswith("port:cat:"))
async def assign_photo_category(callback: CallbackQuery, state: FSMContext):
    """Download photo, upload to Supabase, save to DB."""
    await callback.answer("Загружаю…")

    cat_id = callback.data.split(":")[2]
    data = await state.get_data()
    tenant_id = await run_sync(_get_user_tenant_sync, callback.from_user.id)

    if not data.get("file_id") or not tenant_id:
        await state.clear()
        await callback.message.reply(
            "❌ Сессия загрузки сброшена (часто после перезапуска сервера без Redis). "
            "Нажми «Загрузить фото» ещё раз. Для Cloud Run настрой REDIS_URL."
        )
        return

    file = await callback.bot.get_file(data["file_id"])
    bio = io.BytesIO()
    await callback.bot.download_file(file.file_path, bio)
    raw = bio.getvalue()

    try:
        await asyncio.to_thread(_portfolio_upload_sync, tenant_id, cat_id, data["file_id"], raw)
    except Exception as e:
        logger.exception("portfolio upload failed")
        await state.clear()
        await callback.message.reply(
            f"❌ Не удалось загрузить в портфолио: {e}\n"
            "Проверь бакет «portfolio» в Supabase Storage и права (service_role)."
        )
        return

    await state.clear()
    await callback.message.reply("✅ Фото загружено в портфолио!")


@router.callback_query(F.data == "port:delete")
async def start_delete_photo(callback: CallbackQuery):
    """Show recent portfolio photos for deletion."""
    await callback.answer()
    tenant_id = await run_sync(_get_user_tenant_sync, callback.from_user.id)
    photos = await run_sync(_list_portfolio_for_delete_sync, tenant_id)

    if not tenant_id or photos is None:
        await callback.message.reply("⛔ Нет доступа.")
        return

    if not photos.data:
        await callback.message.reply("📸 Портфолио пусто.")
        return

    buttons = []
    for i, p in enumerate(photos.data, 1):
        label = f"🗑 Фото #{i} ({p['created_at'][:10]})"
        buttons.append([InlineKeyboardButton(text=label, callback_data=f"port:rm:{p['id']}")])
    buttons.append([InlineKeyboardButton(text="◀️ Назад", callback_data="menu:portfolio")])

    await callback.message.edit_text(
        "🗑 Выберите фото для удаления (последние 10):",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )


@router.callback_query(F.data.startswith("port:rm:"))
async def confirm_delete_photo(callback: CallbackQuery):
    """Delete a portfolio photo from storage and DB."""
    await callback.answer()
    photo_id = callback.data.split(":")[2]
    err = await run_sync(_delete_portfolio_photo_sync, photo_id)
    if err:
        await callback.message.reply("Фото не найдено.")
        return
    await callback.message.reply("🗑 Фото удалено из портфолио.")


# ═══════════════════════════════════════════════════
# REVIEWS
# ═══════════════════════════════════════════════════

class ReviewStates(StatesGroup):
    waiting_screenshot = State()


@router.callback_query(F.data == "menu:reviews")
async def reviews_menu(callback: CallbackQuery):
    await callback.answer()
    buttons = [
        [InlineKeyboardButton(text="📤 Загрузить отзыв", callback_data="rev:upload")],
        [InlineKeyboardButton(text="🗑 Удалить отзыв", callback_data="rev:delete")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="menu:main")],
    ]
    await callback.message.edit_text(
        "⭐ <b>Отзывы</b>",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )


@router.callback_query(F.data == "rev:upload")
async def start_review_upload(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.set_state(ReviewStates.waiting_screenshot)
    await callback.message.reply("📸 Отправьте скриншот отзыва:")


def _review_upload_sync(tenant_id: str, raw: bytes) -> None:
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
    img.save(output, format="WEBP", quality=85)
    output.seek(0)

    filename = f"{tenant_id}/{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}_review.webp"
    sb.storage.from_("reviews").upload(
        path=filename,
        file=output.getvalue(),
        file_options={"content-type": "image/webp"},
    )
    public_url = sb.storage.from_("reviews").get_public_url(filename)
    if isinstance(public_url, dict):
        public_url = public_url.get("publicUrl") or str(public_url)

    sb.table("reviews").insert({
        "tenant_id": tenant_id,
        "image_url": public_url,
    }).execute()


@router.message(ReviewStates.waiting_screenshot, F.photo)
async def receive_review(message: Message, state: FSMContext):
    """Upload review screenshot to storage."""
    tenant_id = await run_sync(_get_user_tenant_sync, message.from_user.id)
    if not tenant_id:
        await state.clear()
        await message.reply("❌ Нет доступа.")
        return

    photo = message.photo[-1]
    file = await message.bot.get_file(photo.file_id)
    bio = io.BytesIO()
    await message.bot.download_file(file.file_path, bio)
    raw = bio.getvalue()

    try:
        await asyncio.to_thread(_review_upload_sync, tenant_id, raw)
    except Exception as e:
        logger.exception("review upload failed")
        await state.clear()
        await message.reply(
            f"❌ Не удалось загрузить отзыв: {e}\n"
            "Проверь бакет «reviews» в Supabase Storage."
        )
        return

    await state.clear()
    await message.reply("✅ Отзыв опубликован на сайте!")


def _list_reviews_for_delete_sync(tenant_id: str | None):
    if not tenant_id:
        return None
    sb = get_supabase()
    return (
        sb.table("reviews")
        .select("id, image_url, created_at")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )


def _delete_review_sync(review_id: str) -> str | None:
    """None = ok, 'not_found' = нет записи."""
    sb = get_supabase()
    review = sb.table("reviews").select("image_url").eq("id", review_id).limit(1).execute()
    if not review.data:
        return "not_found"
    url = review.data[0]["image_url"]
    try:
        path = url.split("/reviews/")[1]
        sb.storage.from_("reviews").remove([path])
    except Exception:
        pass
    sb.table("reviews").delete().eq("id", review_id).execute()
    return None


@router.callback_query(F.data == "rev:delete")
async def start_delete_review(callback: CallbackQuery):
    """Show recent reviews for deletion."""
    await callback.answer()
    tenant_id = await run_sync(_get_user_tenant_sync, callback.from_user.id)
    reviews = await run_sync(_list_reviews_for_delete_sync, tenant_id)

    if not tenant_id or reviews is None:
        await callback.message.reply("⛔ Нет доступа.")
        return

    if not reviews.data:
        await callback.message.reply("⭐ Отзывов пока нет.")
        return

    buttons = []
    for i, r in enumerate(reviews.data, 1):
        label = f"🗑 Отзыв #{i} ({r['created_at'][:10]})"
        buttons.append([InlineKeyboardButton(text=label, callback_data=f"rev:rm:{r['id']}")])
    buttons.append([InlineKeyboardButton(text="◀️ Назад", callback_data="menu:reviews")])

    await callback.message.edit_text(
        "🗑 Выберите отзыв для удаления (последние 10):",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )


@router.callback_query(F.data.startswith("rev:rm:"))
async def confirm_delete_review(callback: CallbackQuery):
    """Delete a review from storage and DB."""
    await callback.answer()
    review_id = callback.data.split(":")[2]
    err = await run_sync(_delete_review_sync, review_id)
    if err:
        await callback.message.reply("Отзыв не найден.")
        return
    await callback.message.reply("🗑 Отзыв удалён с сайта.")


# ═══════════════════════════════════════════════════
# OFFLINE BOOKING
# ═══════════════════════════════════════════════════

class OfflineStates(StatesGroup):
    waiting_client_name = State()
    waiting_service_choice = State()
    waiting_datetime = State()


@router.callback_query(F.data == "menu:offline")
async def start_offline(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.set_state(OfflineStates.waiting_client_name)
    await callback.message.reply("📝 Введите имя клиента:")


def _offline_services_list_sync(tenant_id: str | None):
    if not tenant_id:
        return None
    sb = get_supabase()
    return (
        sb.table("services")
        .select("id, name, price")
        .eq("tenant_id", tenant_id)
        .eq("is_active", True)
        .filter("deleted_at", "is", "null")
        .execute()
    )


def _offline_create_booking_sync(
    tenant_id: str | None,
    client_name: str,
    service_id: str,
    dt: datetime,
) -> dict | None:
    if not tenant_id:
        return None
    sb = get_supabase()
    svc = sb.table("services").select("name, price, duration_minutes").eq("id", service_id).limit(1).execute()
    if not svc.data:
        return None
    s = svc.data[0]
    existing_client = (
        sb.table("clients")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("name", client_name)
        .limit(1)
        .execute()
    )
    if existing_client.data:
        client_id = existing_client.data[0]["id"]
    else:
        new_client = (
            sb.table("clients")
            .insert({
                "tenant_id": tenant_id,
                "name": client_name,
                "contact_type": "phone",
                "contact_value": f"offline-{client_name}",
                "first_visit": datetime.utcnow().isoformat(),
            })
            .execute()
        )
        client_id = new_client.data[0]["id"]

    sb.table("bookings").insert({
        "tenant_id": tenant_id,
        "client_id": client_id,
        "service_ids": [service_id],
        "total_price": s["price"],
        "total_duration_minutes": s["duration_minutes"],
        "preferred_datetime": dt.isoformat(),
        "status": "confirmed",
        "payment_status": "paid",
        "source": "offline",
    }).execute()

    return {"name": s["name"], "price": s["price"], "client_name": client_name, "dt": dt}


@router.message(OfflineStates.waiting_client_name)
async def offline_client_name(message: Message, state: FSMContext):
    await state.update_data(client_name=message.text.strip())
    tenant_id = await run_sync(_get_user_tenant_sync, message.from_user.id)
    if not tenant_id:
        await state.clear()
        await message.reply("❌ Нет доступа.")
        return

    services = await run_sync(_offline_services_list_sync, tenant_id)
    if not services or not services.data:
        await state.clear()
        await message.reply("❌ Нет активных услуг в каталоге.")
        return

    buttons = []
    for s in services.data:
        price = s["price"] // 100
        buttons.append([InlineKeyboardButton(
            text=f"{s['name']} — {price:,}₸",
            callback_data=f"off:svc:{s['id']}",
        )])

    await state.set_state(OfflineStates.waiting_service_choice)
    await message.reply(
        "Выберите услугу:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )


@router.callback_query(OfflineStates.waiting_service_choice, F.data.startswith("off:svc:"))
async def offline_service(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    svc_id = callback.data.split(":")[2]
    await state.update_data(service_id=svc_id)
    await state.set_state(OfflineStates.waiting_datetime)
    await callback.message.reply("📅 Введите дату и время (ДД.ММ.ГГГГ ЧЧ:ММ):")


@router.message(OfflineStates.waiting_datetime)
async def offline_datetime(message: Message, state: FSMContext):
    try:
        dt = datetime.strptime(message.text.strip(), "%d.%m.%Y %H:%M")
    except ValueError:
        await message.reply("❌ Формат: ДД.ММ.ГГГГ ЧЧ:ММ. Попробуйте снова:")
        return

    data = await state.get_data()
    tenant_id = await run_sync(_get_user_tenant_sync, message.from_user.id)
    result = await run_sync(
        _offline_create_booking_sync,
        tenant_id,
        data["client_name"],
        data["service_id"],
        dt,
    )

    if not result:
        await state.clear()
        await message.reply("❌ Не удалось создать запись (нет доступа или услуга не найдена).")
        return

    price = result["price"] // 100
    s_name = result["name"]
    cname = result["client_name"]
    dt_out = result["dt"]
    await state.clear()
    await message.reply(
        f"✅ <b>Оффлайн-запись создана</b>\n\n"
        f"👤 {cname}\n"
        f"💇 {s_name} — {price:,}₸\n"
        f"📅 {dt_out.strftime('%d.%m.%Y %H:%M')}",
        parse_mode="HTML",
    )
