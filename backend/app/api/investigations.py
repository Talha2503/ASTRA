from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Investigation, AgentRun, Hypothesis, Evidence
from app.agents.orchestrator import run_investigation

router = APIRouter(prefix="/investigations", tags=["investigations"])


@router.post("/start/{candidate_id}")
def start_investigation(candidate_id: str, db: Session = Depends(get_db)):
    try:
        result = run_investigation(db, candidate_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{investigation_id}")
def get_investigation(investigation_id: str, db: Session = Depends(get_db)):
    investigation = db.query(Investigation).filter(Investigation.id == investigation_id).first()
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")

    agent_runs = db.query(AgentRun).filter(AgentRun.investigation_id == investigation_id).all()
    hypotheses = db.query(Hypothesis).filter(Hypothesis.investigation_id == investigation_id).all()
    evidence_items = db.query(Evidence).filter(Evidence.investigation_id == investigation_id).all()

    return {
        "investigation_id": investigation.id,
        "candidate_id": investigation.candidate_id,
        "state": investigation.state,
        "started_at": investigation.started_at,
        "completed_at": investigation.completed_at,
        "agent_runs": [
            {
                "agent_name": r.agent_name,
                "status": r.status,
                "output_data": r.output_data,
            }
            for r in agent_runs
        ],
        "hypotheses": [
            {
                "id": h.id,
                "description": h.description,
                "confidence": h.confidence,
                "status": h.status,
            }
            for h in hypotheses
        ],
        "evidence": [
            {
                "id": e.id,
                "source_agent": e.source_agent,
                "content": e.content,
                "supports": e.supports,
                "hypothesis_id": e.hypothesis_id,
            }
            for e in evidence_items
        ],
    }