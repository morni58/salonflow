from fastapi import APIRouter, HTTPException, Query

from app.core.async_utils import run_sync
from app.core.database import get_supabase
from app.models.schemas import MasterPublic, MastersResponse
from app.services.masters_query import tenant_has_bookable_masters_sync

router = APIRouter()


def _list_masters_sync(tenant_id: str) -> tuple[list[dict], bool]:
    sb = get_supabase()
    needs = tenant_has_bookable_masters_sync(tenant_id)
    rows = (
        sb.table("masters")
        .select("id, display_name, title, bio, photo_url, sort_order")
        .eq("tenant_id", tenant_id)
        .eq("is_active", True)
        .eq("is_bookable", True)
        .order("sort_order")
        .execute()
    )
    return rows.data or [], needs


@router.get("/masters", response_model=MastersResponse)
async def list_masters(tenant_id: str = Query(...)):
    """Публичный список мастеров для сайта."""
    try:
        raw, requires = await run_sync(_list_masters_sync, tenant_id)
    except Exception:
        raise HTTPException(status_code=500, detail="Не удалось загрузить мастеров")
    masters = [
        MasterPublic(
            id=str(r["id"]),
            display_name=r["display_name"],
            title=r.get("title"),
            bio=r.get("bio"),
            photo_url=r.get("photo_url"),
            sort_order=int(r.get("sort_order") or 0),
        )
        for r in raw
    ]
    return MastersResponse(masters=masters, requires_master=requires)
