from app.core.database import get_supabase
from functools import lru_cache
from typing import Any


async def get_tenant_by_subdomain(subdomain: str) -> dict[str, Any] | None:
    """Resolve tenant by subdomain. Returns tenant dict or None."""
    sb = get_supabase()
    result = (
        sb.table("tenants")
        .select("*")
        .eq("subdomain", subdomain)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]
    return None


async def get_tenant_by_id(tenant_id: str) -> dict[str, Any] | None:
    """Resolve tenant by UUID."""
    sb = get_supabase()
    result = (
        sb.table("tenants")
        .select("*")
        .eq("id", tenant_id)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]
    return None


async def get_tenant_by_hostname(hostname: str) -> dict[str, Any] | None:
    """Resolve tenant by full hostname (subdomain or custom domain)."""
    # Try custom domain first
    sb = get_supabase()
    result = (
        sb.table("tenants")
        .select("*")
        .eq("custom_domain", hostname)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]

    # Extract subdomain from hostname (e.g., "studio-anna.salonflow.kz" → "studio-anna")
    parts = hostname.split(".")
    if len(parts) >= 3:
        subdomain = parts[0]
        return await get_tenant_by_subdomain(subdomain)

    return None
