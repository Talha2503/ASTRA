import lightkurve as lk
from sqlalchemy.orm import Session
from app.models.models import LightCurve


def fetch_and_store_light_curve(db: Session, target_id: str, mission: str = "TESS"):
    search_result = lk.search_lightcurve(target_id, mission=mission, cadence="long")
    if len(search_result) == 0:
        raise ValueError(f"No light curve found for target {target_id} on mission {mission}")

    lc = search_result[0].download()
    lc = lc.remove_nans()

    time_data = lc.time.value.tolist()
    flux_data = lc.flux.value.tolist()
    flux_err_data = lc.flux_err.value.tolist() if lc.flux_err is not None else None

    db_lc = LightCurve(
        target_id=target_id,
        mission=mission,
        time_data=time_data,
        flux_data=flux_data,
        flux_err_data=flux_err_data,
        meta={"n_points": len(time_data)},
    )
    db.add(db_lc)
    db.commit()
    db.refresh(db_lc)
    return db_lc