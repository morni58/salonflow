"""Async helpers: run sync I/O without blocking the event loop."""
from __future__ import annotations

import asyncio
import concurrent.futures
from collections.abc import Callable
from typing import TypeVar

T = TypeVar("T")

# Dedicated thread pool for Supabase (sync HTTP) calls.
# Larger pool = more parallel DB requests possible without queuing.
_db_executor = concurrent.futures.ThreadPoolExecutor(
    max_workers=20,
    thread_name_prefix="supabase",
)


async def run_sync(fn: Callable[..., T], *args, **kwargs) -> T:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_db_executor, lambda: fn(*args, **kwargs))
