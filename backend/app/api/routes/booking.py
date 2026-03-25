from fastapi import APIRouter, HTTPException, Request
from app.services.booking import create_booking
from app.models.schemas import BookingCreate, BookingOut
from app.core.rate_limit import limiter

router = APIRouter()


@router.post("/booking", response_model=BookingOut)
@limiter.limit("10/minute")
async def new_booking(data: BookingCreate, request: Request):
    """Create a new booking from website checkout."""
    try:
        result = await create_booking(data)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
