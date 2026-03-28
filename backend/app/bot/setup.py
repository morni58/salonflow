import logging
import os

from aiogram import Dispatcher, Router
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import Message

from app.bot.handlers.booking_actions import router as booking_router
from app.bot.handlers.catalog_mgmt import router as catalog_router
from app.bot.handlers.clients import router as clients_router
from app.bot.handlers.commands import router as commands_router
from app.bot.handlers.crm_export import router as crm_router
from app.bot.handlers.management import router as management_router
from app.bot.handlers.master_schedule_bot import router as master_schedule_router
from app.bot.handlers.staff_masters import router as staff_masters_router
from app.bot.handlers.site_settings import router as site_settings_router
from app.bot.handlers.masters_admin import router as masters_admin_router
from app.bot.handlers.slot_blocks import router as slot_blocks_router
from app.bot.handlers.start import router as start_router
from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _fsm_storage():
    url = (os.getenv("REDIS_URL") or getattr(get_settings(), "redis_url", None) or "").strip()
    if url:
        try:
            from aiogram.fsm.storage.redis import RedisStorage

            return RedisStorage.from_url(url)
        except Exception as e:
            logger.warning("REDIS_URL задан, но Redis FSM недоступен: %s — используем MemoryStorage", e)
    return MemoryStorage()


fallback_router = Router()


@fallback_router.message()
async def fallback_text(message: Message):
    """Свободный текст без ИИ: подсказка использовать меню."""
    if not message.text:
        return
    await message.reply(
        "Используйте кнопки меню (/start) или команды: /help — список.\n"
        "Примеры: /bookings, /catalog, /schedule, /site (для админа)."
    )


def create_dispatcher() -> Dispatcher:
    """Create and configure the aiogram dispatcher."""
    dp = Dispatcher(storage=_fsm_storage())

    dp.include_router(start_router)
    dp.include_router(commands_router)
    dp.include_router(staff_masters_router)
    dp.include_router(master_schedule_router)
    dp.include_router(booking_router)
    dp.include_router(catalog_router)
    dp.include_router(site_settings_router)
    dp.include_router(management_router)
    dp.include_router(clients_router)
    dp.include_router(crm_router)
    dp.include_router(masters_admin_router)
    dp.include_router(slot_blocks_router)
    dp.include_router(fallback_router)

    @dp.errors()
    async def _log_handler_errors(event: object) -> bool:
        exc = getattr(event, "exception", None)
        if isinstance(exc, BaseException):
            logger.error("aiogram handler error", exc_info=exc)
        else:
            logger.error("aiogram handler error: %s", event)
        return True

    return dp
