"""Rate limiting for FastAPI endpoints using slowapi."""

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request


def get_tenant_key(request: Request) -> str:
    """Rate limit key: tenant_id from query params or body, fallback to IP."""
    # Try query param
    tenant_id = request.query_params.get("tenant_id")
    if tenant_id:
        return f"tenant:{tenant_id}"
    # Fallback to IP
    return get_remote_address(request)


# Global limiter instance
limiter = Limiter(key_func=get_tenant_key)


def setup_rate_limiting(app):
    """Attach rate limiter to FastAPI app."""
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
