import json
import logging
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from app.core.async_utils import run_sync
from app.core.database import get_supabase
import httpx

logger = logging.getLogger(__name__)
router = Router()

# Pending NLP actions per user
_pending_actions: dict[int, dict] = {}

NLP_SYSTEM_PROMPT = """Ты — AI-помощник для управления салоном красоты через Telegram-бот.

Пользователь (владелец/админ) пишет команду на естественном языке. Ты должен разобрать её и вернуть JSON-массив действий.

Доступные действия:
1. update_price — изменить цену услуги. ВСЕГДА указывай цену в ТЕНГЕ.
   Если абсолютная цена: {"action": "update_price", "service_name": "...", "new_price": 5000, "is_delta": false}
   Если дельта (прибавить/вычесть): {"action": "update_price", "service_name": "...", "new_price": 2000, "is_delta": true}

2. close_day — закрыть день для записи
   {"action": "close_day", "date": "2026-03-25"}

3. close_morning — закрыть утро (до 12:00)
   {"action": "close_morning", "date": "2026-03-25"}

4. open_day — открыть день для записи
   {"action": "open_day", "date": "2026-03-25"}

5. toggle_service — скрыть/показать услугу
   {"action": "toggle_service", "service_name": "...", "active": false}

Правила:
- Если сказано "все стрижки" — найди все услуги со словом "стрижка" в названии и создай отдельное действие для каждой
- "подними на 2000" или "прибавь 2000" = дельта (is_delta: true)
- "поставь 5000" или "сделай 5000" = абсолютная цена (is_delta: false)
- "Завтра" = следующий день от текущей даты
- ВСЕГДА возвращай ТОЛЬКО JSON-массив, без текста и объяснений

Текущие услуги (для мэтчинга по имени):
{services}

Сегодняшняя дата: {today}
"""


def _get_user_tenant_role_sync(tg_id: int) -> tuple[str | None, str | None]:
    sb = get_supabase()
    r = sb.table("users").select("tenant_id, role").eq("telegram_user_id", tg_id).limit(1).execute()
    if r.data:
        return r.data[0]["tenant_id"], r.data[0]["role"]
    return None, None


def _nlp_services_and_keys_sync(tenant_id: str) -> tuple[list, list] | None:
    sb = get_supabase()
    services = (
        sb.table("services")
        .select("id, name, price")
        .eq("tenant_id", tenant_id)
        .eq("is_active", True)
        .filter("deleted_at", "is", "null")
        .execute()
    )
    tenant = sb.table("tenants").select("groq_api_keys").eq("id", tenant_id).limit(1).execute()
    keys = tenant.data[0].get("groq_api_keys", []) if tenant.data else []
    if not keys:
        return None
    return (services.data or [], keys)


async def handle_nlp_command(message: Message) -> bool:
    """Try to process free-text as NLP command. Returns True if handled."""
    tenant_id, role = await run_sync(_get_user_tenant_role_sync, message.from_user.id)
    if not tenant_id or role not in ("owner", "admin"):
        return False

    text = message.text.strip()
    # Skip short messages or obvious non-commands
    if len(text) < 10:
        return False

    loaded = await run_sync(_nlp_services_and_keys_sync, tenant_id)
    if not loaded:
        return False
    services_data, keys = loaded

    services_text = "\n".join(
        f"- {s['name']} (ID: {s['id']}, текущая цена: {s['price'] // 100}₸)"
        for s in services_data
    )

    from datetime import date
    system_prompt = NLP_SYSTEM_PROMPT.format(
        services=services_text,
        today=date.today().isoformat(),
    )

    # Call Groq
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {keys[0]}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": text},
                    ],
                    "max_tokens": 1000,
                    "temperature": 0.1,
                },
            )
            response.raise_for_status()
            data = response.json()

        content = data["choices"][0]["message"]["content"]

        # Parse JSON from response
        # Strip markdown code fences if present
        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

        actions = json.loads(content)
        if not isinstance(actions, list):
            actions = [actions]

    except (json.JSONDecodeError, KeyError, httpx.HTTPError) as e:
        logger.error(f"NLP parse error: {e}")
        return False

    if not actions:
        return False

    # Build preview
    preview_lines = []
    resolved_actions = []

    for i, action in enumerate(actions, 1):
        act_type = action.get("action", "unknown")

        if act_type == "update_price":
            svc_name = action.get("service_name", "")
            new_price = action.get("new_price", 0)
            is_delta = action.get("is_delta", False)

            # Find matching services
            matched = [s for s in services_data if svc_name.lower() in s["name"].lower()]
            for m in matched:
                old_price = m["price"] // 100  # tiyn → tenge
                if is_delta:
                    final = old_price + new_price
                else:
                    final = new_price
                preview_lines.append(f"{i}. {m['name']}: {old_price:,}₸ → {final:,}₸")
                resolved_actions.append({"type": "update_price", "id": m["id"], "new_price": final * 100})

        elif act_type == "close_day":
            d = action.get("date", "")
            preview_lines.append(f"{i}. Закрыть день {d}")
            resolved_actions.append({"type": "close_day", "date": d})

        elif act_type == "close_morning":
            d = action.get("date", "")
            preview_lines.append(f"{i}. Закрыть утро {d} (до 12:00)")
            resolved_actions.append({"type": "close_morning", "date": d})

        elif act_type == "toggle_service":
            svc_name = action.get("service_name", "")
            active = action.get("active", False)
            status = "показать" if active else "скрыть"
            preview_lines.append(f"{i}. {status.capitalize()} «{svc_name}»")
            matched = [s for s in services_data if svc_name.lower() in s["name"].lower()]
            for m in matched:
                resolved_actions.append({"type": "toggle_service", "id": m["id"], "active": active})

    if not preview_lines:
        return False

    # Store pending actions
    _pending_actions[message.from_user.id] = {
        "tenant_id": tenant_id,
        "actions": resolved_actions,
        "raw_text": text,
    }

    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Подтвердить", callback_data="nlp:confirm"),
            InlineKeyboardButton(text="❌ Отменить", callback_data="nlp:cancel"),
        ],
    ])

    preview = "\n".join(preview_lines)
    await message.reply(
        f"🤖 <b>Я собираюсь сделать:</b>\n\n{preview}\n\nПодтвердить?",
        parse_mode="HTML",
        reply_markup=keyboard,
    )
    return True


def _execute_nlp_pending_sync(pending: dict) -> list[str]:
    sb = get_supabase()
    results: list[str] = []

    for action in pending["actions"]:
        try:
            if action["type"] == "update_price":
                old = sb.table("services").select("name, price").eq("id", action["id"]).limit(1).execute()
                sb.table("services").update({"price": action["new_price"]}).eq("id", action["id"]).execute()

                sb.table("audit_log").insert({
                    "tenant_id": pending["tenant_id"],
                    "action_type": "update_price",
                    "diff_before": {"price": old.data[0]["price"]} if old.data else None,
                    "diff_after": {"price": action["new_price"]},
                }).execute()
                results.append("✅ Цена обновлена")

            elif action["type"] == "close_day":
                existing_exc = (
                    sb.table("schedule_exceptions")
                    .select("id")
                    .eq("tenant_id", pending["tenant_id"])
                    .eq("date", action["date"])
                    .limit(1)
                    .execute()
                )
                if existing_exc.data:
                    sb.table("schedule_exceptions").update({
                        "is_closed": True,
                    }).eq("id", existing_exc.data[0]["id"]).execute()
                else:
                    sb.table("schedule_exceptions").insert({
                        "tenant_id": pending["tenant_id"],
                        "date": action["date"],
                        "is_closed": True,
                    }).execute()
                results.append("✅ День закрыт")

            elif action["type"] == "toggle_service":
                sb.table("services").update({"is_active": action["active"]}).eq("id", action["id"]).execute()
                results.append("✅ Статус услуги изменён")

        except Exception as e:
            results.append(f"❌ Ошибка: {e}")

    return results


@router.callback_query(F.data == "nlp:confirm")
async def nlp_confirm(callback: CallbackQuery):
    """Execute confirmed NLP actions."""
    pending = _pending_actions.pop(callback.from_user.id, None)
    if not pending:
        await callback.answer("Нет ожидающих действий")
        return

    await callback.answer()
    results = await run_sync(_execute_nlp_pending_sync, pending)

    await callback.message.edit_reply_markup(reply_markup=None)
    await callback.message.reply("📋 <b>Результат:</b>\n" + "\n".join(results), parse_mode="HTML")


@router.callback_query(F.data == "nlp:cancel")
async def nlp_cancel(callback: CallbackQuery):
    await callback.answer()
    _pending_actions.pop(callback.from_user.id, None)
    await callback.message.edit_reply_markup(reply_markup=None)
    await callback.message.reply("❌ Отменено.")
