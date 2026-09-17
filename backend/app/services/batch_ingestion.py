from sqlalchemy.orm import Session
from app.services.ingestion import fetch_and_store_light_curve


def batch_ingest(db: Session, target_ids: list[str], mission: str = "Kepler"):
    results = []
    for target_id in target_ids:
        try:
            lc = fetch_and_store_light_curve(db, target_id, mission)
            results.append({
                "target_id": target_id,
                "status": "success",
                "id": lc.id,
                "n_points": lc.meta["n_points"],
            })
        except Exception as e:
            results.append({
                "target_id": target_id,
                "status": "failed",
                "error": str(e),
            })
    return results