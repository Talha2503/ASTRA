import numpy as np
from sklearn.ensemble import IsolationForest
from sqlalchemy.orm import Session

from app.models.models import LightCurve, Candidate
from app.services.preprocessing import preprocess_light_curve
from app.services.features import extract_all_features


FEATURE_KEYS = [
    "mean", "std", "median", "min", "max", "skewness", "kurtosis", "mad", "range",
    "dominant_period_days", "dominant_power", "mean_power", "max_power",
    "duration_days", "n_points", "median_cadence_days", "max_gap_days", "n_gaps_over_1day",
]


def features_to_vector(features: dict):
    return [features.get(k) if features.get(k) is not None else 0.0 for k in FEATURE_KEYS]


def run_anomaly_detection(db: Session, contamination: float = 0.2):
    light_curves = db.query(LightCurve).all()
    if len(light_curves) < 3:
        raise ValueError("Need at least 3 light curves to run anomaly detection")

    feature_rows = []
    valid_lightcurves = []

    for lc in light_curves:
        try:
            processed = preprocess_light_curve(lc.time_data, lc.flux_data, lc.flux_err_data)
            features = extract_all_features(processed["time"], processed["flux"])
            feature_rows.append(features_to_vector(features))
            valid_lightcurves.append((lc, features))
        except Exception:
            continue

    X = np.array(feature_rows)

    model = IsolationForest(contamination=contamination, random_state=42)
    model.fit(X)

    raw_scores = model.decision_function(X)
    predictions = model.predict(X)

    normalized_scores = (raw_scores.max() - raw_scores) / (raw_scores.max() - raw_scores.min() + 1e-9)

    candidates_created = []
    for (lc, features), score, pred in zip(valid_lightcurves, normalized_scores, predictions):
        candidate = Candidate(
            light_curve_id=lc.id,
            anomaly_score=float(score),
            features=features,
            status="anomalous" if pred == -1 else "normal",
        )
        db.add(candidate)
        candidates_created.append(candidate)

    db.commit()
    for c in candidates_created:
        db.refresh(c)

    return [
        {
            "candidate_id": c.id,
            "light_curve_id": c.light_curve_id,
            "anomaly_score": c.anomaly_score,
            "status": c.status,
        }
        for c in candidates_created
    ]