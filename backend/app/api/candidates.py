from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Candidate
from app.services.anomaly_detection import run_anomaly_detection

router = APIRouter(prefix="/candidates", tags=["candidates"])


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
    return [
        {
            "candidate_id": c.id,
            "light_curve_id": c.light_curve_id,
            "anomaly_score": c.anomaly_score,
            "status": c.status,
            "created_at": c.created_at,
        }
        for c in candidates
    ]


@router.get("/{candidate_id}")
def get_candidate(candidate_id: str, db: Session = Depends(get_db)):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return {
        "candidate_id": candidate.id,
        "light_curve_id": candidate.light_curve_id,
        "anomaly_score": candidate.anomaly_score,
        "status": candidate.status,
        "features": candidate.features,
        "created_at": candidate.created_at,
    }