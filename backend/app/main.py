import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from aiogram import Bot
from aiogram.types import Update

from app.core.config import get_settings
from app.core.scheduler import setup_scheduler
from app.core.rate_limit import setup_rate_limiting
from app.bot.setup import create_dispatcher
from app.api.routes import tenant, catalog, slots, booking, chat, analytics, content

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Bot dispatcher (shared across webhooks)
dp = create_dispatcher()

# Store active bot instances for webhook processing
_webhook_bots: dict[str, Bot] = {}


def _register_tenant_bots():
    """Load all tenant bots and register webhooks."""
    from app.core.database import get_supabase
    settings = get_settings()
    sb = get_supabase()

    tenants = (
        sb.table("tenants")
        .select("id, bot_token_encrypted, subdomain")
        .eq("is_active", True)
        .execute()
    )

    for t in tenants.data:
        token = t.get("bot_token_encrypted")
        if not token:
            continue

        # Decrypt token, fallback to plaintext for dev
        try:
            from app.core.encryption import decrypt
            token = decrypt(token)
        except Exception:
            pass

        bot = Bot(token=token)
        _webhook_bots[t["id"]] = bot
        logger.info(f"Registered bot for tenant {t['subdomain']}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown."""
    logger.info("Starting SalonFlow API...")

    # Register bots
    try:
        _register_tenant_bots()
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

    # Shutdown
    logger.info("Shutting down...")
    for bot in _webhook_bots.values():
        try:
            await bot.delete_webhook()
            await bot.session.close()
        except Exception:
            pass


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
app.include_router(slots.router, prefix="/api", tags=["Slots"])
app.include_router(booking.router, prefix="/api", tags=["Booking"])
app.include_router(chat.router, prefix="/api", tags=["Chat"])
app.include_router(analytics.router, prefix="/api", tags=["Analytics"])
app.include_router(content.router, prefix="/api", tags=["Content"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "salonflow-api"}


# ── Telegram Webhook ─────────────────────────────

@app.post("/api/webhook/tg/{tenant_id}")
async def telegram_webhook(tenant_id: str, request: Request):
    """Handle Telegram webhook updates for a specific tenant."""
    bot = _webhook_bots.get(tenant_id)
    if not bot:
        return {"error": "Bot not found"}

    data = await request.json()
    update = Update.model_validate(data, context={"bot": bot})
    await dp.feed_update(bot=bot, update=update)
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
