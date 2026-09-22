from sqlalchemy.orm import Session

from app.agents.base import BaseAgent
from app.models.models import Candidate


RECOMMENDATION_WEIGHTS = {
    "high_priority_followup": 1.0,
    "moderate_priority_followup": 0.6,
    "low_priority": 0.3,
    "likely_false_positive": 0.05,
}


class DiscoveryRankerAgent(BaseAgent):
    name = "discovery_ranker"
    system_prompt = (
        "You are the Discovery Ranker in an astronomical anomaly investigation system. "
        "You assign a final priority score reflecting how worthy this candidate is of further "
        "scientific follow-up, based on the full investigation. Be conservative — a high score "
        "should only go to genuinely well-supported, high-confidence findings."
    )

    def run(self, db: Session, investigation_id: str, input_data: dict) -> dict:
        candidate_id = input_data.get("candidate_id")
        anomaly_score = input_data.get("anomaly_score", 0.0)
        critic_confidence = input_data.get("critic_confidence", 0.0)
        evidence_quality = input_data.get("evidence_quality", "weak")
        final_recommendation = input_data.get("final_recommendation", "low_priority")
        overall_assessment = input_data.get("overall_assessment", "")

        quality_weight = {"strong": 1.0, "moderate": 0.6, "weak": 0.3}.get(evidence_quality, 0.3)
        recommendation_weight = RECOMMENDATION_WEIGHTS.get(final_recommendation, 0.3)

        # Weighted combination: anomaly detection (ML), critic-revised confidence (agent reasoning),
        # evidence quality, and the aggregator's final recommendation all contribute
        priority_score = (
            0.25 * anomaly_score +
            0.30 * critic_confidence +
            0.15 * quality_weight +
            0.30 * recommendation_weight
        )
        priority_score = round(min(max(priority_score, 0.0), 1.0), 4)

        ranking_prompt = (
            f"Anomaly score: {anomaly_score}\n"
            f"Critic-revised confidence: {critic_confidence}\n"
            f"Evidence quality: {evidence_quality}\n"
            f"Aggregator recommendation: {final_recommendation}\n"
            f"Overall assessment: {overall_assessment}\n"
            f"Computed priority score: {priority_score}\n\n"
            "As the Discovery Ranker, respond with a JSON object with these keys:\n"
            '- "priority_tier": one of "tier_1_urgent", "tier_2_promising", "tier_3_marginal", "tier_4_likely_noise"\n'
            '- "ranking_justification": 2-3 sentences justifying this tier given the computed score and evidence'
        )

        llm_result = self.call_llm_json(ranking_prompt)

        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if candidate:
            candidate.priority_score = priority_score
            db.commit()

        return {
            "priority_score": priority_score,
            "priority_tier": llm_result.get("priority_tier"),
            "ranking_justification": llm_result.get("ranking_justification"),
        }