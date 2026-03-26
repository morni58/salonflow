from fastapi import APIRouter, Query
from datetime import date
from app.services.slots import get_available_slots
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
    return SlotsResponse(date=target, slots=available)
