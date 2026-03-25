import logging
from aiogram import Router, F
from aiogram.types import CallbackQuery, Message
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from app.core.database import get_supabase

logger = logging.getLogger(__name__)
router = Router()


class CatalogStates(StatesGroup):
    waiting_new_category = State()
    waiting_new_service_name = State()
    waiting_new_service_price = State()
    waiting_new_service_duration = State()
    waiting_edit_price = State()


def _get_user_tenant(telegram_user_id: int) -> str | None:
    sb = get_supabase()
    result = (
        sb.table("users")
        .select("tenant_id")
        .eq("telegram_user_id", telegram_user_id)
        .limit(1)
        .execute()
    )
    return result.data[0]["tenant_id"] if result.data else None


# ── Category list ──────────────────────────────

@router.callback_query(F.data == "menu:catalog")
async def show_categories(callback: CallbackQuery):
    tenant_id = _get_user_tenant(callback.from_user.id)
    if not tenant_id:
        await callback.answer("Нет доступа")
        return

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
        buttons.append([InlineKeyboardButton(
            text=f"📂 {c['name']}",
            callback_data=f"cat:view:{c['id']}",
        )])
    buttons.append([InlineKeyboardButton(text="➕ Новая категория", callback_data="cat:add")])
    buttons.append([InlineKeyboardButton(text="◀️ Назад", callback_data="menu:main")])

    await callback.message.edit_text(
        "📂 <b>Каталог</b>\nВыберите категорию:",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )
    await callback.answer()


# ── Services in category ──────────────────────

@router.callback_query(F.data.startswith("cat:view:"))
async def show_services(callback: CallbackQuery):
    cat_id = callback.data.split(":")[2]
    tenant_id = _get_user_tenant(callback.from_user.id)

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
        buttons.append([InlineKeyboardButton(
            text=f"✏️ {s['name']}",
            callback_data=f"svc:edit:{s['id']}",
        )])

    buttons.append([InlineKeyboardButton(text="➕ Новая услуга", callback_data=f"svc:add:{cat_id}")])
    buttons.append([InlineKeyboardButton(text="◀️ Каталог", callback_data="menu:catalog")])

    await callback.message.edit_text(
        text, parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )
    await callback.answer()


# ── Edit service ──────────────────────────────

@router.callback_query(F.data.startswith("svc:edit:"))
async def edit_service_menu(callback: CallbackQuery):
    svc_id = callback.data.split(":")[2]

    sb = get_supabase()
    svc = sb.table("services").select("name, price, is_active, category_id").eq("id", svc_id).limit(1).execute()
    if not svc.data:
        await callback.answer("Услуга не найдена")
        return

    s = svc.data[0]
    price = s["price"] // 100
    active_text = "Активна" if s["is_active"] else "Скрыта"

    buttons = [
        [InlineKeyboardButton(text="💰 Изменить цену", callback_data=f"svc:price:{svc_id}")],
        [InlineKeyboardButton(
            text="🚫 Скрыть" if s["is_active"] else "✅ Показать",
            callback_data=f"svc:toggle:{svc_id}",
        )],
        [InlineKeyboardButton(text="🗑 Удалить", callback_data=f"svc:delete:{svc_id}")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data=f"cat:view:{s['category_id']}")],
    ]

    await callback.message.edit_text(
        f"✏️ <b>{s['name']}</b>\n"
        f"Цена: {price:,}₸ | Статус: {active_text}\n\n"
        f"Что изменить?",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("svc:price:"))
async def start_edit_price(callback: CallbackQuery, state: FSMContext):
    svc_id = callback.data.split(":")[2]
    await state.set_state(CatalogStates.waiting_edit_price)
    await state.update_data(service_id=svc_id)
    await callback.message.reply("💰 Введите новую цену в тенге (число):")
    await callback.answer()


@router.message(CatalogStates.waiting_edit_price)
async def process_edit_price(message: Message, state: FSMContext):
    try:
        new_price = int(message.text.strip().replace(" ", "").replace("₸", ""))
    except ValueError:
        await message.reply("❌ Введите число. Попробуйте снова:")
        return

    data = await state.get_data()
    svc_id = data["service_id"]

    sb = get_supabase()
    sb.table("services").update({"price": new_price * 100}).eq("id", svc_id).execute()

    svc = sb.table("services").select("name").eq("id", svc_id).limit(1).execute()
    name = svc.data[0]["name"] if svc.data else "Услуга"

    await state.clear()
    await message.reply(f"✅ Цена «{name}» обновлена: {new_price:,}₸")


@router.callback_query(F.data.startswith("svc:toggle:"))
async def toggle_service(callback: CallbackQuery):
    svc_id = callback.data.split(":")[2]
    sb = get_supabase()
    svc = sb.table("services").select("is_active, name").eq("id", svc_id).limit(1).execute()
    if svc.data:
        new_state = not svc.data[0]["is_active"]
        sb.table("services").update({"is_active": new_state}).eq("id", svc_id).execute()
        status = "показана" if new_state else "скрыта"
        await callback.answer(f"Услуга {status}")
        await callback.message.reply(f"{'✅' if new_state else '🚫'} «{svc.data[0]['name']}» {status} на сайте.")


@router.callback_query(F.data.startswith("svc:delete:"))
async def delete_service(callback: CallbackQuery):
    svc_id = callback.data.split(":")[2]
    sb = get_supabase()
    from datetime import datetime
    sb.table("services").update({"deleted_at": datetime.utcnow().isoformat()}).eq("id", svc_id).execute()
    await callback.answer("Услуга удалена")
    await callback.message.reply("🗑 Услуга удалена (soft delete).")


# ── Add new category ────────────────────────

@router.callback_query(F.data == "cat:add")
async def start_add_category(callback: CallbackQuery, state: FSMContext):
    await state.set_state(CatalogStates.waiting_new_category)
    await callback.message.reply("📂 Введите название новой категории:")
    await callback.answer()


@router.message(CatalogStates.waiting_new_category)
async def process_add_category(message: Message, state: FSMContext):
    tenant_id = _get_user_tenant(message.from_user.id)
    if not tenant_id:
        await state.clear()
        return

    sb = get_supabase()
    sb.table("categories").insert({
        "tenant_id": tenant_id,
        "name": message.text.strip(),
        "sort_order": 99,
    }).execute()

    await state.clear()
    await message.reply(f"✅ Категория «{message.text.strip()}» создана!")


# ── Add new service ─────────────────────────

@router.callback_query(F.data.startswith("svc:add:"))
async def start_add_service(callback: CallbackQuery, state: FSMContext):
    cat_id = callback.data.split(":")[2]
    await state.set_state(CatalogStates.waiting_new_service_name)
    await state.update_data(category_id=cat_id)
    await callback.message.reply("✏️ Введите название новой услуги:")
    await callback.answer()


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
    tenant_id = _get_user_tenant(message.from_user.id)

    sb = get_supabase()
    sb.table("services").insert({
        "tenant_id": tenant_id,
        "category_id": data["category_id"],
        "name": data["service_name"],
        "price": data["service_price"] * 100,
        "duration_minutes": duration,
    }).execute()

    await state.clear()
    await message.reply(
        f"✅ Услуга создана!\n"
        f"📌 {data['service_name']}\n"
        f"💰 {data['service_price']:,}₸\n"
        f"⏱ {duration} мин"
    )
