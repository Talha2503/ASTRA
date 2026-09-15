from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.ingestion import fetch_and_store_light_curve

router = APIRouter(prefix="/ingestion", tags=["ingestion"])


@router.post("/fetch")
def ingest_light_curve(target_id: str, mission: str = "TESS", db: Session = Depends(get_db)):
    try:
        lc = fetch_and_store_light_curve(db, target_id, mission)
        return {"id": lc.id, "target_id": lc.target_id, "mission": lc.mission, "n_points": lc.meta["n_points"]}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))