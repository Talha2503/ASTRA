import json
import queue as pyqueue

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.core.database import SessionLocal
from app.models.models import AgentRun, Investigation
from app.services.event_bus import subscribe, unsubscribe

router = APIRouter(prefix="/events", tags=["events"])

FINISHED_STATES = ("completed", "failed")


def _snapshot(investigation_id: str):
    """Current state straight from the database, or None if the investigation doesn't exist."""
    db = SessionLocal()
    try:
        inv = db.query(Investigation).filter(Investigation.id == investigation_id).first()
        if not inv:
            return None
        runs = (
            db.query(AgentRun)
            .filter(
                AgentRun.investigation_id == investigation_id,
                AgentRun.status == "completed",
            )
            .order_by(AgentRun.started_at)
            .all()
        )
        return {
            "investigation_id": investigation_id,
            "state": inv.state,
            "agents_completed": [r.agent_name for r in runs],
            "snapshot": True,
            "done": inv.state in FINISHED_STATES,
        }
    finally:
        db.close()


@router.get("/investigations/{investigation_id}/stream")
def stream_investigation_events(investigation_id: str):
    if _snapshot(investigation_id) is None:
        raise HTTPException(status_code=404, detail="Investigation not found")

    def event_generator():
        # Subscribe first, then read the database, so no event can slip through the gap.
        q = subscribe(investigation_id)
        try:
            first = _snapshot(investigation_id)
            yield f"data: {json.dumps(first)}\n\n"
            if first and first["done"]:
                return

            while True:
                try:
                    event = q.get(timeout=15)
                    yield f"data: {json.dumps(event)}\n\n"
                    if event.get("done"):
                        break
                except pyqueue.Empty:
                    yield ": keep-alive\n\n"
        finally:
            unsubscribe(investigation_id, q)

    return StreamingResponse(event_generator(), media_type="text/event-stream")