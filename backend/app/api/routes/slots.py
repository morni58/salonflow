import logging

from fastapi import APIRouter, HTTPException, Query
from datetime import date

from app.services.slots import get_available_slots, suggest_alternate_master
from app.models.schemas import SlotsResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/slots", response_model=SlotsResponse)
async def slots(
    tenant_id: str = Query(...),
    date_str: str = Query(..., alias="date"),
    master_id: str | None = Query(None),
    duration_minutes: int | None = Query(
        None,
        ge=1,
        le=1440,
        description="Суммарная длительность услуг в минутах — чтобы слоты помещали весь визит",
    ),
):
    """Слоты на дату. Если в салоне есть записываемые мастера — передайте master_id."""
    try:
        target = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Неверная дата")

    try:
        available = await get_available_slots(
            tenant_id, target, master_id=master_id, duration_minutes=duration_minutes
        )
        alt_id: str | None = None
        alt_name: str | None = None
        if master_id and not available:
            alt_id, alt_name = await suggest_alternate_master(
                tenant_id, target, master_id, duration_minutes=duration_minutes
            )
        return SlotsResponse(
            date=target,
            slots=available,
            alternate_master_id=alt_id,
            alternate_master_name=alt_name,
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("GET /slots failed tenant=%s date=%s", tenant_id, date_str)
        # Пустой ответ вместо 500 — на сайте покажется «нет слотов», а не Internal Server Error
        return SlotsResponse(
            date=target,
            slots=[],
            alternate_master_id=None,
            alternate_master_name=None,
        )
