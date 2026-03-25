"""supabase-py синхронный — не блокируем asyncio event loop."""
from app.core.async_utils import run_sync

__all__ = ["run_sync"]
