import asyncio
import io
import logging
import uuid
from datetime import datetime

from aiogram import Router, F
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from app.bot.async_db import run_sync
from app.bot.cache import get_user_sync as _cached_get_user
from app.core.database import get_supabase

logger = logging.getLogger(__name__)
router = Router()


class CatalogStates(StatesGroup):
    waiting_new_category = State()
    waiting_new_service_name = State()
    waiting_new_service_price = State()
    waiting_new_service_duration = State()
    waiting_edit_price = State()
    waiting_edit_name = State()
    waiting_edit_duration = State()
    waiting_edit_description = State()
    waiting_service_photo = State()


def _get_user_tenant_sync(telegram_user_id: int) -> str | None:
    u = _cached_get_user(telegram_user_id)
    return u["tenant_id"] if u else None


def _catalog_categories_kb_sync(tenant_id: str) -> InlineKeyboardMarkup:
    sb = get_supabase()
    cats = (
        sb.table("categories")
        .select("id, name")
        .eq("tenant_id", tenant_id)
        .eq("is_active", True)
        .filter("deleted_at", "is", "null")
        .order("sort_order")
        .execute()
    )
    buttons = []
    for c in cats.data:
        buttons.append([InlineKeyboardButton(text=f"📂 {c['name']}", callback_data=f"cat:view:{c['id']}")])
    buttons.append([InlineKeyboardButton(text="➕ Новая категория", callback_data="cat:add")])
    buttons.append([InlineKeyboardButton(text="◀️ Назад", callback_data="menu:main")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


# ── Category list ──────────────────────────────

@router.callback_query(F.data == "menu:catalog")
async def show_categories(callback: CallbackQuery):
    await callback.answer()
    tenant_id = await run_sync(_get_user_tenant_sync, callback.from_user.id)
    if not tenant_id:
        await callback.message.edit_text("⛔ Нет доступа.")
        return
    kb = await run_sync(_catalog_categories_kb_sync, tenant_id)
    await callback.message.edit_text(
        "📂 <b>Каталог</b>\nВыберите категорию:",
        parse_mode="HTML",
        reply_markup=kb,
    )


# ── Services in category ──────────────────────

def _category_services_view_sync(cat_id: str, tenant_id: str) -> tuple[str, InlineKeyboardMarkup]:
    sb = get_supabase()
    cat = sb.table("categories").select("name").eq("id", cat_id).limit(1).execute()
    cat_name = cat.data[0]["name"] if cat.data else "—"
    services = (
        sb.table("services")
        .select("id, name, price, duration_minutes, is_active")
        .eq("category_id", cat_id)
        .filter("deleted_at", "is", "null")
        .execute()
    )
    text = f"📂 <b>{cat_name}</b>\n\n"
    buttons = []
    for s in services.data:
        price = s["price"] // 100
        status = "✅" if s["is_active"] else "🚫"
        text += f"{status} {s['name']} — {price:,}₸ ({s['duration_minutes']} мин)\n"
        buttons.append([InlineKeyboardButton(text=f"✏️ {s['name']}", callback_data=f"svc:edit:{s['id']}")])
    buttons.append([InlineKeyboardButton(text="➕ Новая услуга", callback_data=f"svc:add:{cat_id}")])
    buttons.append([InlineKeyboardButton(text="◀️ Каталог", callback_data="menu:catalog")])
    return text, InlineKeyboardMarkup(inline_keyboard=buttons)


@router.callback_query(F.data.startswith("cat:view:"))
async def show_services(callback: CallbackQuery):
    await callback.answer()
    cat_id = callback.data.split(":")[2]
    tenant_id = await run_sync(_get_user_tenant_sync, callback.from_user.id)
    if not tenant_id:
        await callback.message.edit_text("⛔ Нет доступа.")
        return
    text, kb = await run_sync(_category_services_view_sync, cat_id, tenant_id)
    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=kb)


def _fetch_service_sync(svc_id: str):
    sb = get_supabase()
    return (
        sb.table("services")
        .select("name, price, duration_minutes, is_active, category_id, photo_url, description")
        .eq("id", svc_id)
        .limit(1)
        .execute()
    )


def _service_photo_upload_sync(tenant_id: str, svc_id: str, raw: bytes) -> str:
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
    body = output.getvalue()

    filename = f"{tenant_id}/{svc_id}_{uuid.uuid4().hex[:10]}.webp"
    sb.storage.from_("service-photos").upload(
        path=filename,
        file=body,
        file_options={"content-type": "image/webp"},
    )
    public_url = sb.storage.from_("service-photos").get_public_url(filename)
    if isinstance(public_url, dict):
        public_url = public_url.get("publicUrl") or str(public_url)
    sb.table("services").update({"photo_url": public_url}).eq("id", svc_id).execute()
    return public_url


# ── Edit service ──────────────────────────────

@router.callback_query(F.data.startswith("svc:edit:"))
async def edit_service_menu(callback: CallbackQuery):
    await callback.answer()
    svc_id = callback.data.split(":")[2]
    svc = await run_sync(_fetch_service_sync, svc_id)
    if not svc.data:
        await callback.message.edit_text("Услуга не найдена.")
        return

    s = svc.data[0]
    price = s["price"] // 100
    duration = s.get("duration_minutes", 0)
    active_text = "✅ Активна" if s["is_active"] else "🚫 Скрыта"
    photo_text = "✅ есть" if s.get("photo_url") else "нет"
    desc = s.get("description") or ""
    desc_preview = (desc[:60] + "…") if len(desc) > 60 else (desc or "—")

    buttons = [
        [InlineKeyboardButton(text="✏️ Переименовать", callback_data=f"svc:rename:{svc_id}")],
        [InlineKeyboardButton(text="💰 Изменить цену", callback_data=f"svc:price:{svc_id}")],
        [InlineKeyboardButton(text="⏱ Длительность", callback_data=f"svc:dur:{svc_id}")],
        [InlineKeyboardButton(text="📄 Описание", callback_data=f"svc:desc:{svc_id}")],
        [InlineKeyboardButton(text="📷 Загрузить фото", callback_data=f"svc:photo:{svc_id}")],
        [InlineKeyboardButton(
            text="🚫 Скрыть" if s["is_active"] else "✅ Показать",
            callback_data=f"svc:toggle:{svc_id}",
        )],
        [InlineKeyboardButton(text="🗑 Удалить", callback_data=f"svc:delete:{svc_id}")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data=f"cat:view:{s['category_id']}")],
    ]

    await callback.message.edit_text(
        f"✏️ <b>{s['name']}</b>\n"
        f"💰 {price:,}₸ | ⏱ {duration} мин | {active_text}\n"
        f"📷 Фото: {photo_text}\n"
        f"📄 Описание: {desc_preview}\n\n"
        f"Что изменить?",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )


@router.callback_query(F.data.startswith("svc:photo:"))
async def start_service_photo(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    svc_id = callback.data.split(":")[2]
    await state.set_state(CatalogStates.waiting_service_photo)
    await state.update_data(service_id=svc_id)
    await callback.message.reply(
        "📷 Отправьте фото услуги (как картинку, не файлом).\n"
        "Изображение будет сжато в WebP и загружено в Storage (бакет service-photos).",
    )


@router.message(CatalogStates.waiting_service_photo, F.photo)
async def receive_service_photo(message: Message, state: FSMContext):
    data = await state.get_data()
    svc_id = data.get("service_id")
    tenant_id = await run_sync(_get_user_tenant_sync, message.from_user.id)
    if not svc_id or not tenant_id:
        await state.clear()
        await message.reply("❌ Сессия сброшена. Откройте услугу снова.")
        return

    photo = message.photo[-1]
    file = await message.bot.get_file(photo.file_id)
    bio = io.BytesIO()
    await message.bot.download_file(file.file_path, bio)
    raw = bio.getvalue()

    try:
        await asyncio.to_thread(_service_photo_upload_sync, tenant_id, svc_id, raw)
    except Exception as e:
        logger.exception("service photo upload failed")
        await state.clear()
        await message.reply(
            f"❌ Не удалось загрузить: {e}\n"
            "Создайте публичный бакет «service-photos» в Supabase Storage.",
        )
        return

    await state.clear()
    await message.reply("✅ Фото услуги обновлено на сайте.")


@router.message(CatalogStates.waiting_service_photo)
async def service_photo_not_image(message: Message):
    await message.reply("❌ Нужно отправить изображение (фото), не текст.")


@router.callback_query(F.data.startswith("svc:price:"))
async def start_edit_price(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    svc_id = callback.data.split(":")[2]
    await state.set_state(CatalogStates.waiting_edit_price)
    await state.update_data(service_id=svc_id)
    await callback.message.reply("💰 Введите новую цену в тенге (число):")


@router.message(CatalogStates.waiting_edit_price)
async def process_edit_price(message: Message, state: FSMContext):
    try:
        new_price = int(message.text.strip().replace(" ", "").replace("₸", ""))
    except ValueError:
        await message.reply("❌ Введите число. Попробуйте снова:")
        return

    data = await state.get_data()
    svc_id = data["service_id"]

    def _apply_price():
        sb = get_supabase()
        sb.table("services").update({"price": new_price * 100}).eq("id", svc_id).execute()
        return sb.table("services").select("name").eq("id", svc_id).limit(1).execute()

    svc = await run_sync(_apply_price)
    name = svc.data[0]["name"] if svc.data else "Услуга"

    await state.clear()
    await message.reply(f"✅ Цена «{name}» обновлена: {new_price:,}₸")


# ── Rename service ──────────────────────────

@router.callback_query(F.data.startswith("svc:rename:"))
async def start_edit_name(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    svc_id = callback.data.split(":")[2]
    await state.set_state(CatalogStates.waiting_edit_name)
    await state.update_data(service_id=svc_id)
    await callback.message.reply("✏️ Введите новое название услуги:")


@router.message(CatalogStates.waiting_edit_name)
async def process_edit_name(message: Message, state: FSMContext):
    new_name = message.text.strip()
    if not new_name:
        await message.reply("❌ Название не может быть пустым.")
        return
    data = await state.get_data()
    svc_id = data["service_id"]

    def _apply():
        sb = get_supabase()
        sb.table("services").update({"name": new_name}).eq("id", svc_id).execute()

    await run_sync(_apply)
    await state.clear()
    await message.reply(f"✅ Услуга переименована: «{new_name}»")


# ── Edit duration ───────────────────────────

@router.callback_query(F.data.startswith("svc:dur:"))
async def start_edit_duration(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    svc_id = callback.data.split(":")[2]
    await state.set_state(CatalogStates.waiting_edit_duration)
    await state.update_data(service_id=svc_id)
    await callback.message.reply("⏱ Введите новую длительность в минутах (число):")


@router.message(CatalogStates.waiting_edit_duration)
async def process_edit_duration(message: Message, state: FSMContext):
    try:
        new_dur = int(message.text.strip())
    except ValueError:
        await message.reply("❌ Введите число. Попробуйте снова:")
        return
    data = await state.get_data()
    svc_id = data["service_id"]

    def _apply():
        sb = get_supabase()
        sb.table("services").update({"duration_minutes": new_dur}).eq("id", svc_id).execute()
        return sb.table("services").select("name").eq("id", svc_id).limit(1).execute()

    svc = await run_sync(_apply)
    name = svc.data[0]["name"] if svc.data else "Услуга"
    await state.clear()
    await message.reply(f"✅ Длительность «{name}» обновлена: {new_dur} мин")


# ── Edit description ────────────────────────

@router.callback_query(F.data.startswith("svc:desc:"))
async def start_edit_description(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    svc_id = callback.data.split(":")[2]
    await state.set_state(CatalogStates.waiting_edit_description)
    await state.update_data(service_id=svc_id)
    await callback.message.reply(
        "📄 Введите описание услуги (будет показано на сайте в карточке услуги).\n"
        "Можно писать обычным текстом — несколько абзацев, до 1000 символов.\n\n"
        "Чтобы удалить описание — отправьте <code>-</code>",
        parse_mode="HTML",
    )


@router.message(CatalogStates.waiting_edit_description)
async def process_edit_description(message: Message, state: FSMContext):
    text = message.text.strip()
    new_desc = None if text == "-" else text
    data = await state.get_data()
    svc_id = data["service_id"]

    def _apply():
        sb = get_supabase()
        sb.table("services").update({"description": new_desc}).eq("id", svc_id).execute()
        return sb.table("services").select("name").eq("id", svc_id).limit(1).execute()

    svc = await run_sync(_apply)
    name = svc.data[0]["name"] if svc.data else "Услуга"
    await state.clear()
    if new_desc:
        await message.reply(f"✅ Описание «{name}» сохранено ({len(new_desc)} симв.)")
    else:
        await message.reply(f"✅ Описание «{name}» удалено.")


def _toggle_service_sync(svc_id: str) -> tuple[str, bool] | None:
    sb = get_supabase()
    svc = sb.table("services").select("is_active, name").eq("id", svc_id).limit(1).execute()
    if not svc.data:
        return None
    new_state = not svc.data[0]["is_active"]
    sb.table("services").update({"is_active": new_state}).eq("id", svc_id).execute()
    return svc.data[0]["name"], new_state


@router.callback_query(F.data.startswith("svc:toggle:"))
async def toggle_service(callback: CallbackQuery):
    await callback.answer()
    svc_id = callback.data.split(":")[2]
    result = await run_sync(_toggle_service_sync, svc_id)
    if not result:
        await callback.message.reply("Услуга не найдена.")
        return
    name, new_state = result
    status = "показана" if new_state else "скрыта"
    await callback.message.reply(f"{'✅' if new_state else '🚫'} «{name}» {status} на сайте.")


def _soft_delete_service_sync(svc_id: str) -> None:
    sb = get_supabase()
    sb.table("services").update({"deleted_at": datetime.utcnow().isoformat()}).eq("id", svc_id).execute()


@router.callback_query(F.data.startswith("svc:delete:"))
async def confirm_delete_service(callback: CallbackQuery):
    await callback.answer()
    svc_id = callback.data.split(":")[2]
    svc = await run_sync(_fetch_service_sync, svc_id)
    name = svc.data[0]["name"] if svc.data else "услугу"
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Да, удалить", callback_data=f"svc:delconfirm:{svc_id}"),
            InlineKeyboardButton(text="◀️ Отмена", callback_data=f"svc:edit:{svc_id}"),
        ]
    ])
    await callback.message.reply(
        f"⚠️ Удалить «{name}»?\nУслуга будет скрыта с сайта. Отменить нельзя.",
        reply_markup=kb,
    )


@router.callback_query(F.data.startswith("svc:delconfirm:"))
async def delete_service(callback: CallbackQuery):
    await callback.answer()
    svc_id = callback.data.split(":")[2]
    await run_sync(_soft_delete_service_sync, svc_id)
    await callback.message.edit_text("🗑 Услуга удалена.")


# ── Add new category ────────────────────────

@router.callback_query(F.data == "cat:add")
async def start_add_category(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.set_state(CatalogStates.waiting_new_category)
    await callback.message.reply("📂 Введите название новой категории:")


@router.message(CatalogStates.waiting_new_category)
async def process_add_category(message: Message, state: FSMContext):
    tenant_id = await run_sync(_get_user_tenant_sync, message.from_user.id)
    if not tenant_id:
        await state.clear()
        return

    name = message.text.strip()

    def _ins():
        sb = get_supabase()
        sb.table("categories").insert({
            "tenant_id": tenant_id,
            "name": name,
            "sort_order": 99,
        }).execute()

    await run_sync(_ins)
    await state.clear()
    await message.reply(f"✅ Категория «{name}» создана!")


# ── Add new service ─────────────────────────

@router.callback_query(F.data.startswith("svc:add:"))
async def start_add_service(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    cat_id = callback.data.split(":")[2]
    await state.set_state(CatalogStates.waiting_new_service_name)
    await state.update_data(category_id=cat_id)
    await callback.message.reply("✏️ Введите название новой услуги:")


@router.message(CatalogStates.waiting_new_service_name)
async def process_service_name(message: Message, state: FSMContext):
    await state.update_data(service_name=message.text.strip())
    await state.set_state(CatalogStates.waiting_new_service_price)
    await message.reply("💰 Введите цену в тенге:")


@router.message(CatalogStates.waiting_new_service_price)
async def process_service_price(message: Message, state: FSMContext):
    try:
        price = int(message.text.strip().replace(" ", "").replace("₸", ""))
    except ValueError:
        await message.reply("❌ Введите число:")
        return

    await state.update_data(service_price=price)
    await state.set_state(CatalogStates.waiting_new_service_duration)
    await message.reply("⏱ Введите длительность в минутах:")


@router.message(CatalogStates.waiting_new_service_duration)
async def process_service_duration(message: Message, state: FSMContext):
    try:
        duration = int(message.text.strip())
    except ValueError:
        await message.reply("❌ Введите число:")
        return

    data = await state.get_data()
    tenant_id = await run_sync(_get_user_tenant_sync, message.from_user.id)
    if not tenant_id:
        await state.clear()
        await message.reply("❌ Нет доступа.")
        return

    def _ins_svc():
        sb = get_supabase()
        sb.table("services").insert({
            "tenant_id": tenant_id,
            "category_id": data["category_id"],
            "name": data["service_name"],
            "price": data["service_price"] * 100,
            "duration_minutes": duration,
        }).execute()

    await run_sync(_ins_svc)

    await state.clear()
    await message.reply(
        f"✅ Услуга создана!\n"
        f"📌 {data['service_name']}\n"
        f"💰 {data['service_price']:,}₸\n"
        f"⏱ {duration} мин"
    )
