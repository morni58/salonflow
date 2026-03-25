from fastapi import APIRouter
from app.services.analytics import track_event
from app.models.schemas import AnalyticsTrack

router = APIRouter()


@router.post("/analytics", status_code=204)
async def track(data: AnalyticsTrack):
    """Track a frontend analytics event."""
    await track_event(data.tenant_id, data.event_type, data.session_id)
    return None
