from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse
from app.services.chat import chat_stream, get_session_count, MAX_MESSAGES_PER_SESSION
from app.models.schemas import ChatRequest
from app.core.rate_limit import limiter

router = APIRouter()


@router.post("/chat")
@limiter.limit("30/minute")
async def chat(data: ChatRequest, request: Request):
    """Stream AI chat response via SSE."""

    async def event_generator():
        async for chunk in chat_stream(
            tenant_id=data.tenant_id,
            session_id=data.session_id,
            message=data.message,
            history=[h.model_dump() for h in data.history],
        ):
            if await request.is_disconnected():
                break
            yield {"data": chunk}
        yield {"data": "[DONE]"}

    remaining = MAX_MESSAGES_PER_SESSION - get_session_count(data.session_id)

    return EventSourceResponse(
        event_generator(),
        headers={
            "X-Messages-Remaining": str(max(0, remaining)),
            "X-Accel-Buffering": "no",  # Prevent proxy buffering (nginx/Netlify)
            "Cache-Control": "no-cache",
        },
    )


@router.post("/chat/sync")
@limiter.limit("30/minute")
async def chat_sync(data: ChatRequest, request: Request):
    """Non-streaming fallback for environments where SSE doesn't work."""
    full_response = ""
    async for chunk in chat_stream(
        tenant_id=data.tenant_id,
        session_id=data.session_id,
        message=data.message,
        history=[h.model_dump() for h in data.history],
    ):
        full_response += chunk

    remaining = MAX_MESSAGES_PER_SESSION - get_session_count(data.session_id)

    return JSONResponse({
        "content": full_response,
        "remaining": max(0, remaining),
    })
