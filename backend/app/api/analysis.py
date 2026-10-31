import io
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import LightCurve
from app.services.preprocessing import preprocess_light_curve
from app.services.features import extract_all_features

router = APIRouter(prefix="/analysis", tags=["analysis"])


def _get_light_curve(db: Session, light_curve_id: str) -> LightCurve:
    lc = db.query(LightCurve).filter(LightCurve.id == light_curve_id).first()
    if not lc:
        raise HTTPException(status_code=404, detail="Light curve not found")
    return lc


@router.post("/process/{light_curve_id}")
def process_light_curve(light_curve_id: str, db: Session = Depends(get_db)):
    lc = _get_light_curve(db, light_curve_id)

    processed = preprocess_light_curve(lc.time_data, lc.flux_data, lc.flux_err_data)
    features = extract_all_features(processed["time"], processed["flux"])

    return {
        "light_curve_id": light_curve_id,
        "target_id": lc.target_id,
        "preprocessing": {
            "n_points_original": processed["n_points_original"],
            "n_points_after_cleaning": processed["n_points_after_cleaning"],
        },
        "features": features,
    }


@router.get("/curve/{light_curve_id}")
def get_curve_data(light_curve_id: str, db: Session = Depends(get_db)):
    """Cleaned, normalized light curve as JSON so the dashboard can draw its own chart."""
    lc = _get_light_curve(db, light_curve_id)
    processed = preprocess_light_curve(lc.time_data, lc.flux_data, lc.flux_err_data)

    return {
        "light_curve_id": light_curve_id,
        "target_id": lc.target_id,
        "mission": lc.mission,
        "n_points": len(processed["time"]),
        "time": processed["time"],
        "flux": processed["flux"],
    }


@router.get("/plot/{light_curve_id}")
def plot_light_curve(light_curve_id: str, db: Session = Depends(get_db)):
    lc = _get_light_curve(db, light_curve_id)

    processed = preprocess_light_curve(lc.time_data, lc.flux_data, lc.flux_err_data)

    fig, ax = plt.subplots(figsize=(10, 4))
    ax.scatter(processed["time"], processed["flux"], s=2, color="steelblue")
    ax.set_xlabel("Time (days)")
    ax.set_ylabel("Normalized Flux")
    ax.set_title(f"Light Curve: {lc.target_id}")
    ax.grid(alpha=0.3)

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=100, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)

    return StreamingResponse(buf, media_type="image/png")