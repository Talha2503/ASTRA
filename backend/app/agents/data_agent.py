from sqlalchemy.orm import Session

from app.agents.base import BaseAgent
from app.models.models import Candidate, LightCurve
from app.services.preprocessing import preprocess_light_curve
from app.services.features import extract_all_features


class DataAgent(BaseAgent):
    name = "data_agent"
    system_prompt = (
        "You are the Data Agent in an astronomical anomaly investigation system. "
        "Your job is to summarize light curve data and features clearly and factually "
        "for other specialist agents to use. Do not speculate about causes — just report the data."
    )

    def run(self, db: Session, investigation_id: str, input_data: dict) -> dict:
        candidate_id = input_data.get("candidate_id")
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if not candidate:
            raise ValueError(f"Candidate {candidate_id} not found")

        lc = db.query(LightCurve).filter(LightCurve.id == candidate.light_curve_id).first()
        if not lc:
            raise ValueError(f"Light curve {candidate.light_curve_id} not found")

        processed = preprocess_light_curve(lc.time_data, lc.flux_data, lc.flux_err_data)
        features = extract_all_features(processed["time"], processed["flux"])

        summary_prompt = (
            f"Target: {lc.target_id} (mission: {lc.mission})\n"
            f"Anomaly score: {candidate.anomaly_score:.4f}\n"
            f"Data points after cleaning: {processed['n_points_after_cleaning']} "
            f"(original: {processed['n_points_original']})\n"
            f"Features: {features}\n\n"
            "Write a short, factual 3-4 sentence summary of this light curve data for a scientific investigation. "
            "Mention notable feature values (e.g. skewness, periodicity, gaps) without speculating on cause."
        )

        summary_text = self.call_llm(summary_prompt)

        return {
            "target_id": lc.target_id,
            "mission": lc.mission,
            "anomaly_score": candidate.anomaly_score,
            "features": features,
            "n_points": processed["n_points_after_cleaning"],
            "summary": summary_text,
        }