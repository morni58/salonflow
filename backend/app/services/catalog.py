from app.core.async_utils import run_sync
from app.core.database import get_supabase
from app.models.schemas import CategoryOut, ServiceOut, CatalogResponse


def _get_catalog_sync(tenant_id: str) -> CatalogResponse:
    sb = get_supabase()

    # Fetch active categories
    cats = (
        sb.table("categories")
        .select("id, name, sort_order")
        .eq("tenant_id", tenant_id)
        .eq("is_active", True)
        .filter("deleted_at", "is", "null")
        .order("sort_order")
        .execute()
    )

    # Fetch active services
    svcs = (
        sb.table("services")
        .select("id, category_id, name, price, duration_minutes, photo_url")
        .eq("tenant_id", tenant_id)
        .eq("is_active", True)
        .filter("deleted_at", "is", "null")
        .execute()
    )

    # Group services by category
    svc_by_cat: dict[str, list[ServiceOut]] = {}
    for s in svcs.data:
        cat_id = s["category_id"]
        if cat_id not in svc_by_cat:
            svc_by_cat[cat_id] = []
        svc_by_cat[cat_id].append(ServiceOut(
            id=s["id"],
            name=s["name"],
            price=s["price"],
            duration_minutes=s["duration_minutes"],
            photo_url=s.get("photo_url"),
        ))

    categories = []
    for c in cats.data:
        categories.append(CategoryOut(
            id=c["id"],
            name=c["name"],
            services=svc_by_cat.get(c["id"], []),
        ))

    return CatalogResponse(categories=categories)


async def get_catalog(tenant_id: str) -> CatalogResponse:
    """Get full catalog (categories + services) for a tenant."""
    return await run_sync(_get_catalog_sync, tenant_id)
