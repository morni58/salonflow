from fastapi import APIRouter, Query
from datetime import date
from app.services.slots import get_available_slots
from app.models.schemas import SlotsResponse

router = APIRouter()


@router.get("/slots", response_model=SlotsResponse)
async def slots(
    tenant_id: str = Query(...),
    date_str: str = Query(..., alias="date"),
):
    """Get available time slots for a date."""
    target = date.fromisoformat(date_str)
    available = await get_available_slots(tenant_id, target)
    return SlotsResponse(date=target, slots=available)
