import httpx
import json
import logging
from typing import AsyncGenerator
from app.core.database import get_supabase
from app.services.catalog import get_catalog

logger = logging.getLogger(__name__)

# Track usage per tenant for key rotation
_key_index: dict[str, int] = {}
_session_counts: dict[str, int] = {}

MAX_MESSAGES_PER_SESSION = 15

# Trigger words for smart alerts
ALERT_TRIGGERS = [
    "жалоба", "переделайте", "переделать", "рекламация", "вернуть деньги",
    "возврат", "острая боль", "плохо", "ужасно", "обман", "жалуюсь",
    "некачественно", "испортили", "complaint", "refund",
]


async def check_alert_triggers(message: str) -> bool:
    """Check if message contains alert trigger words."""
    lower = message.lower()
    return any(trigger in lower for trigger in ALERT_TRIGGERS)


def _get_groq_key(tenant_id: str, keys: list[str]) -> str:
    """Rotate through Groq API keys for a tenant."""
    if not keys:
        raise ValueError("No Groq API keys configured for tenant")
    idx = _key_index.get(tenant_id, 0)
    key = keys[idx % len(keys)]
    return key


def _rotate_key(tenant_id: str, keys: list[str]) -> None:
    """Move to next key after rate limit."""
    current = _key_index.get(tenant_id, 0)
    _key_index[tenant_id] = (current + 1) % len(keys)


def get_session_count(session_id: str) -> int:
    """Get message count for a session."""
    return _session_counts.get(session_id, 0)


def increment_session(session_id: str) -> int:
    """Increment and return session message count."""
    count = _session_counts.get(session_id, 0) + 1
    _session_counts[session_id] = count
    return count


async def get_faq_answer(tenant_id: str, message: str) -> str:
    """Fallback: find best matching FAQ answer."""
    sb = get_supabase()
    faqs = (
        sb.table("faq")
        .select("question, answer")
        .eq("tenant_id", tenant_id)
        .execute()
    )
    if not faqs.data:
        return "К сожалению, сейчас я не могу ответить. Пожалуйста, оставьте заявку, и администратор свяжется с вами."

    # Simple keyword matching
    lower = message.lower()
    best_match = None
    best_score = 0
    for faq in faqs.data:
        words = faq["question"].lower().split()
        score = sum(1 for w in words if w in lower)
        if score > best_score:
            best_score = score
            best_match = faq["answer"]

    return best_match or faqs.data[0]["answer"]


async def build_system_prompt(tenant_id: str) -> str:
    """Build system prompt with tenant context (catalog, prices, FAQ)."""
    sb = get_supabase()

    # Tenant info
    tenant = (
        sb.table("tenants")
        .select("name")
        .eq("id", tenant_id)
        .limit(1)
        .execute()
    )
    tenant_name = tenant.data[0]["name"] if tenant.data else "Салон"

    # Catalog
    catalog = await get_catalog(tenant_id)
    catalog_text = ""
    for cat in catalog.categories:
        catalog_text += f"\n📂 {cat.name}:\n"
        for svc in cat.services:
            price_tg = svc.price // 100  # тиыны → тенге
            catalog_text += f"  • {svc.name} — {price_tg:,}₸, {svc.duration_minutes} мин\n"

    # FAQ
    faqs = (
        sb.table("faq")
        .select("question, answer")
        .eq("tenant_id", tenant_id)
        .execute()
    )
    faq_text = ""
    for f in faqs.data:
        faq_text += f"\nВ: {f['question']}\nО: {f['answer']}\n"

    return f"""Ты — AI-консультант салона «{tenant_name}». Твоя задача — помочь клиенту выбрать услуги, ответить на вопросы и мотивировать оставить заявку.

Правила:
- Отвечай дружелюбно, коротко и по делу (2-3 предложения)
- Если клиент спрашивает о ценах — давай точные цифры из каталога
- Если клиент сомневается — мягко подтолкни к записи
- Если вопрос вне твоей компетенции — предложи связаться с администратором
- Отвечай на языке клиента (русский/казахский)
- НЕ выдумывай услуги, которых нет в каталоге

Каталог услуг:
{catalog_text}

Частые вопросы:
{faq_text}"""


async def chat_stream(
    tenant_id: str,
    session_id: str,
    message: str,
    history: list[dict],
) -> AsyncGenerator[str, None]:
    """Stream chat response from Groq API."""
    sb = get_supabase()

    # Check session limit
    count = increment_session(session_id)
    if count > MAX_MESSAGES_PER_SESSION:
        fallback = await get_faq_answer(tenant_id, message)
        yield fallback
        return

    # Get Groq keys
    tenant = (
        sb.table("tenants")
        .select("groq_api_keys")
        .eq("id", tenant_id)
        .limit(1)
        .execute()
    )
    keys = tenant.data[0].get("groq_api_keys", []) if tenant.data else []
    if not keys:
        fallback = await get_faq_answer(tenant_id, message)
        yield fallback
        return

    # Build messages
    system_prompt = await build_system_prompt(tenant_id)
    messages = [{"role": "system", "content": system_prompt}]
    for h in history[-10:]:  # Last 10 messages for context
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": message})

    # Try Groq API with key rotation
    max_retries = len(keys)
    for attempt in range(max_retries):
        api_key = _get_groq_key(tenant_id, keys)
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "llama-3.3-70b-versatile",
                        "messages": messages,
                        "max_tokens": 500,
                        "temperature": 0.7,
                        "stream": True,
                    },
                )

                if response.status_code == 429:
                    _rotate_key(tenant_id, keys)
                    continue

                response.raise_for_status()

                full_response = ""
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            delta = chunk["choices"][0]["delta"].get("content", "")
                            if delta:
                                full_response += delta
                                yield delta
                        except (json.JSONDecodeError, KeyError, IndexError):
                            continue

                # Save to chat_logs
                has_alert = await check_alert_triggers(message)
                updated_history = history + [
                    {"role": "user", "content": message},
                    {"role": "assistant", "content": full_response},
                ]

                import json as json_mod
                existing_log = (
                    sb.table("chat_logs")
                    .select("id")
                    .eq("session_id", session_id)
                    .limit(1)
                    .execute()
                )
                if existing_log.data:
                    sb.table("chat_logs").update({
                        "messages": json_mod.loads(json_mod.dumps(updated_history)),
                        "has_alert": has_alert,
                    }).eq("id", existing_log.data[0]["id"]).execute()
                else:
                    sb.table("chat_logs").insert({
                        "tenant_id": tenant_id,
                        "session_id": session_id,
                        "messages": json_mod.loads(json_mod.dumps(updated_history)),
                        "has_alert": has_alert,
                    }).execute()

                # Alert notification
                if has_alert:
                    from app.bot.notifications import send_alert_notification
                    try:
                        await send_alert_notification(
                            tenant_id=tenant_id,
                            session_id=session_id,
                            trigger_message=message,
                            context=full_response,
                        )
                    except Exception as e:
                        logger.error(f"Failed to send alert: {e}")

                return

        except httpx.HTTPStatusError:
            _rotate_key(tenant_id, keys)
            continue
        except Exception as e:
            logger.error(f"Groq API error: {e}")
            break

    # All retries failed — fallback
    fallback = await get_faq_answer(tenant_id, message)
    yield fallback
