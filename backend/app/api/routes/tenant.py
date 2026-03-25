from fastapi import APIRouter, HTTPException, Query
from app.core.tenant import get_tenant_by_subdomain, get_tenant_by_hostname
from app.models.schemas import TenantPublic

router = APIRouter()


@router.get("/tenant", response_model=TenantPublic)
async def resolve_tenant(
    subdomain: str | None = Query(None),
    hostname: str | None = Query(None),
):
    """Resolve tenant by subdomain or full hostname."""
    tenant = None

    if subdomain:
        tenant = await get_tenant_by_subdomain(subdomain)
    elif hostname:
        tenant = await get_tenant_by_hostname(hostname)

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return TenantPublic(
        id=tenant["id"],
        name=tenant["name"],
        subdomain=tenant["subdomain"],
        logo_url=tenant.get("logo_url"),
        color_primary=tenant["color_primary"],
        color_accent=tenant["color_accent"],
        color_bg=tenant["color_bg"],
        color_text=tenant["color_text"],
        timezone=tenant["timezone"],
        working_hours_start=tenant["working_hours_start"],
        working_hours_end=tenant["working_hours_end"],
        slot_interval_minutes=tenant["slot_interval_minutes"],
        buffer_minutes=tenant["buffer_minutes"],
    )
