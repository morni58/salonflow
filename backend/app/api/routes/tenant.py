from fastapi import APIRouter, HTTPException, Query
from app.core.tenant import get_tenant_by_subdomain, get_tenant_by_hostname
from app.core.tenant_fields import (
    normalize_contact_json,
    normalize_every_n_days,
    normalize_every_n_days_anchor,
    normalize_schedule_mode,
    normalize_site_content,
    normalize_working_days,
)
from app.models.schemas import TenantPublic

router = APIRouter()


def _fmt_hhmm(val) -> str:
    if val is None:
        return "10:00"
    s = str(val).strip()
    return s[:5] if len(s) >= 5 else s


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
        working_hours_start=_fmt_hhmm(tenant.get("working_hours_start")),
        working_hours_end=_fmt_hhmm(tenant.get("working_hours_end") or "20:00"),
        slot_interval_minutes=int(tenant.get("slot_interval_minutes") or 60),
        buffer_minutes=int(tenant.get("buffer_minutes") or 15),
        working_days=normalize_working_days(tenant.get("working_days")),
        schedule_mode=normalize_schedule_mode(tenant.get("schedule_mode")),
        every_n_days=normalize_every_n_days(tenant.get("every_n_days")),
        every_n_days_anchor=normalize_every_n_days_anchor(tenant.get("every_n_days_anchor")),
        site_content=normalize_site_content(tenant.get("site_content")),
        contact_json=normalize_contact_json(tenant.get("contact_json")),
    )
