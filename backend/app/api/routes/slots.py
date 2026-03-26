from fastapi import APIRouter, Query
from datetime import date
from app.services.slots import get_available_slots, suggest_alternate_master
from app.models.schemas import SlotsResponse

router = APIRouter()


@router.get("/slots", response_model=SlotsResponse)
async def slots(
    tenant_id: str = Query(...),
    date_str: str = Query(..., alias="date"),
    master_id: str | None = Query(None),
):
    """Слоты на дату. Если в салоне есть записываемые мастера — передайте master_id."""
    target = date.fromisoformat(date_str)
    available = await get_available_slots(tenant_id, target, master_id=master_id)
    alt_id: str | None = None
    alt_name: str | None = None
    if master_id and not available:
        alt_id, alt_name = await suggest_alternate_master(tenant_id, target, master_id)
    return SlotsResponse(
        date=target,
        slots=available,
        alternate_master_id=alt_id,
        alternate_master_name=alt_name,
    )
