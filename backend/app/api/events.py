import json
import time
import queue as pyqueue
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.services.event_bus import subscribe, unsubscribe

router = APIRouter(prefix="/events", tags=["events"])


@router.get("/investigations/{investigation_id}/stream")
def stream_investigation_events(investigation_id: str):
    def event_generator():
        q = subscribe(investigation_id)
        try:
            while True:
                try:
                    event = q.get(timeout=30)
                    yield f"data: {json.dumps(event)}\n\n"
                    if event.get("done"):
                        break
                except pyqueue.Empty:
                    yield ": keep-alive\n\n"
        finally:
            unsubscribe(investigation_id, q)

    return StreamingResponse(event_generator(), media_type="text/event-stream")