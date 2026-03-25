import logging

from aiogram import Dispatcher, Router
from aiogram.types import Message
from aiogram.fsm.storage.memory import MemoryStorage

logger = logging.getLogger(__name__)
from app.bot.handlers.start import router as start_router
from app.bot.handlers.booking_actions import router as booking_router
from app.bot.handlers.catalog_mgmt import router as catalog_router
from app.bot.handlers.management import router as management_router
from app.bot.handlers.nlp_commands import router as nlp_router, handle_nlp_command
from app.bot.handlers.clients import router as clients_router


# Catch-all router for free text → NLP
fallback_router = Router()


@fallback_router.message()
async def fallback_nlp(message: Message):
    """Route unhandled text messages to NLP engine."""
    if not message.text:
        return
    handled = await handle_nlp_command(message)
    if not handled:
        await message.reply(
            "Не понял команду. Используйте /start для меню "
            "или напишите запрос подробнее (например: «подними цены на стрижки на 2000»)."
        )


def create_dispatcher() -> Dispatcher:
    """Create and configure the aiogram dispatcher."""
    dp = Dispatcher(storage=MemoryStorage())

    # Register routers (order matters — specific handlers first)
    dp.include_router(start_router)
    dp.include_router(booking_router)
    dp.include_router(catalog_router)
    dp.include_router(management_router)
    dp.include_router(clients_router)
    dp.include_router(nlp_router)
    dp.include_router(fallback_router)  # Must be LAST

    @dp.errors()
    async def _log_handler_errors(event: object) -> bool:
        exc = getattr(event, "exception", None)
        if isinstance(exc, BaseException):
            logger.error("aiogram handler error", exc_info=exc)
        else:
            logger.error("aiogram handler error: %s", event)
        return True

    return dp
