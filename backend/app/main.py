import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from aiogram import Bot
from aiogram.types import Update

from app.bot.command_list import BOT_COMMANDS

from app.core.async_utils import run_sync
from app.core.config import get_settings
from app.core.scheduler import setup_scheduler
from app.core.rate_limit import setup_rate_limiting
from app.bot.setup import create_dispatcher
from app.api.routes import tenant, catalog, slots, booking, analytics, content, masters, my_bookings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Bot dispatcher (shared across webhooks)
dp = create_dispatcher()

# Store active bot instances for webhook processing
_webhook_bots: dict[str, Bot] = {}


def _fetch_tenant_bot_rows_sync():
    from app.core.database import get_supabase
    sb = get_supabase()
    tenants = (
        sb.table("tenants")
        .select("id, bot_token_encrypted, subdomain")
        .eq("is_active", True)
        .execute()
    )
    return tenants.data or []


def _fetch_one_tenant_bot_sync(tenant_id: str) -> dict | None:
    """Один tenant для ленивой регистрации бота (другой инстанс Cloud Run без памяти)."""
    from app.core.database import get_supabase
    sb = get_supabase()
    r = (
        sb.table("tenants")
        .select("id, bot_token_encrypted, subdomain")
        .eq("id", tenant_id)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    return r.data[0] if r.data else None


def _decrypt_bot_token(raw: str) -> str:
    try:
        from app.core.encryption import decrypt

        return decrypt(raw)
    except Exception:
        return raw


async def _register_tenant_bots():
    """Load all tenant bots and register webhooks."""
    tenants_data = await run_sync(_fetch_tenant_bot_rows_sync)

    for t in tenants_data:
        token = t.get("bot_token_encrypted")
        if not token:
            continue

        token = _decrypt_bot_token(token)

        bot = Bot(token=token)
        try:
            await bot.set_my_commands(BOT_COMMANDS)
        except Exception as e:
            logger.warning("set_my_commands failed for %s: %s", t.get("subdomain"), e)
        _webhook_bots[t["id"]] = bot
        logger.info(f"Registered bot for tenant {t['subdomain']}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown."""
    logger.info("Starting SalonFlow API...")

    # Register bots
    try:
        await _register_tenant_bots()
    except Exception as e:
        logger.error(f"Bot registration error: {e}")

    # Set webhooks
    settings = get_settings()
    for tenant_id, bot in _webhook_bots.items():
        try:
            webhook_url = f"{settings.base_url}/api/webhook/tg/{tenant_id}"
            await bot.set_webhook(webhook_url)
            logger.info(f"Webhook set: {webhook_url}")
        except Exception as e:
            logger.error(f"Webhook setup error for {tenant_id}: {e}")

    # Start scheduler
    setup_scheduler()

    yield

    # Shutdown — НЕ вызывать delete_webhook(): на Cloud Run контейнеры постоянно
    # останавливаются (scale-to-zero). Снятие webhook ломает доставку апдейтов в Telegram
    # до следующего старта, из-за чего бот «молчит», хотя API в порядке.
    logger.info("Shutting down...")
    for bot in _webhook_bots.values():
        try:
            await bot.session.close()
        except Exception:
            pass


async def _ensure_webhook_bot(tenant_id: str) -> Bot | None:
    """Бот для webhook: кэш в памяти или подгрузка (второй инстанс / после cold start)."""
    if tenant_id in _webhook_bots:
        return _webhook_bots[tenant_id]

    row = await run_sync(_fetch_one_tenant_bot_sync, tenant_id)
    if not row:
        return None
    token = row.get("bot_token_encrypted")
    if not token:
        return None
    token = _decrypt_bot_token(token)
    bot = Bot(token=token)
    _webhook_bots[tenant_id] = bot
    logger.info("Lazy-registered bot for tenant_id=%s", tenant_id)
    return bot



# ── Sentry (опционально) ─────────────────────────────────────────────────────
try:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    import os as _os
    _sentry_dsn = _os.getenv("SENTRY_DSN")
    if _sentry_dsn:
        sentry_sdk.init(
            dsn=_sentry_dsn,
            environment=_os.getenv("APP_ENV", "production"),
            integrations=[FastApiIntegration()],
            traces_sample_rate=0.1,
        )
        logger.info("Sentry initialized")
except ImportError:
    pass  # sentry-sdk не установлен — работаем без него
# ─────────────────────────────────────────────────────────────────────────────

# ── FastAPI App ──────────────────────────────────

app = FastAPI(
    title="SalonFlow API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — прод-домены + Netlify / Cloudflare Pages превью
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://salonflow.kz",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"^https://([a-z0-9-]+\.)?salonflow\.kz$|^https://[a-z0-9-]+\.netlify\.app$|^https://[a-z0-9-]+\.pages\.dev$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting
setup_rate_limiting(app)

# ── API Routes ───────────────────────────────────

app.include_router(tenant.router, prefix="/api", tags=["Tenant"])
app.include_router(catalog.router, prefix="/api", tags=["Catalog"])
app.include_router(masters.router, prefix="/api", tags=["Masters"])
app.include_router(slots.router, prefix="/api", tags=["Slots"])
app.include_router(booking.router, prefix="/api", tags=["Booking"])
app.include_router(analytics.router, prefix="/api", tags=["Analytics"])
app.include_router(content.router, prefix="/api", tags=["Content"])
app.include_router(my_bookings.router, prefix="/api", tags=["MyBookings"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "salonflow-api"}


# ── Telegram Webhook ─────────────────────────────

async def _process_telegram_update(bot: Bot, update: Update) -> None:
    """Обработка апдейта вне HTTP-запроса — Telegram сразу получает 200, UI не «висит»."""
    try:
        await dp.feed_update(bot=bot, update=update)
    except Exception:
        logger.exception("feed_update failed")


@app.post("/api/webhook/tg/{tenant_id}")
async def telegram_webhook(tenant_id: str, request: Request):
    """Handle Telegram webhook updates for a specific tenant."""
    bot = await _ensure_webhook_bot(tenant_id)
    if not bot:
        return {"error": "Bot not found"}

    try:
        data = await request.json()
        update = Update.model_validate(data, context={"bot": bot})
    except Exception:
        logger.exception("telegram_webhook parse tenant_id=%s", tenant_id)
        return {"ok": True}

    asyncio.create_task(_process_telegram_update(bot, update))
    return {"ok": True}


# ── Run ──────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.app_env == "development",
    )
