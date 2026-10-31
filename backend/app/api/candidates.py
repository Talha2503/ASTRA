from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Candidate, LightCurve, Investigation, AgentRun
from app.services.anomaly_detection import run_anomaly_detection

router = APIRouter(prefix="/candidates", tags=["candidates"])


def serialize_candidate(db: Session, c: Candidate) -> dict:
    lc = db.query(LightCurve).filter(LightCurve.id == c.light_curve_id).first()

    investigations = (
        db.query(Investigation)
        .filter(Investigation.candidate_id == c.id)
        .order_by(Investigation.started_at.desc())
        .all()
    )
    latest = investigations[0] if investigations else None

    # Most recent completed Discovery Ranker output across all of this candidate's investigations
    ranker_run = (
        db.query(AgentRun)
        .join(Investigation, AgentRun.investigation_id == Investigation.id)
        .filter(
            Investigation.candidate_id == c.id,
            AgentRun.agent_name == "discovery_ranker",
            AgentRun.status == "completed",
        )
        .order_by(AgentRun.started_at.desc())
        .first()
    )
    priority_tier = None
    if ranker_run and ranker_run.output_data:
        priority_tier = ranker_run.output_data.get("priority_tier")

    return {
        "candidate_id": c.id,
        "light_curve_id": c.light_curve_id,
        "target_id": lc.target_id if lc else None,
        "mission": lc.mission if lc else None,
        "anomaly_score": c.anomaly_score,
        "priority_score": c.priority_score,
        "priority_tier": priority_tier,
        "status": c.status,
        "n_investigations": len(investigations),
        "latest_investigation_id": latest.id if latest else None,
        "latest_investigation_state": latest.state if latest else None,
        "created_at": c.created_at,
    }


@router.post("/detect")
def detect_anomalies(contamination: float = 0.2, db: Session = Depends(get_db)):
    try:
        results = run_anomaly_detection(db, contamination=contamination)
        return {"n_candidates": len(results), "candidates": results}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/")
def list_candidates(db: Session = Depends(get_db)):
    candidates = db.query(Candidate).order_by(Candidate.anomaly_score.desc()).all()
    return [serialize_candidate(db, c) for c in candidates]


@router.get("/{candidate_id}")
def get_candidate(candidate_id: str, db: Session = Depends(get_db)):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    data = serialize_candidate(db, candidate)
    data["features"] = candidate.features
    return data