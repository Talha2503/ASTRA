from sqlalchemy.orm import Session

from app.agents.base import BaseAgent
from app.models.models import Evidence


class EvidenceAggregatorAgent(BaseAgent):
    name = "evidence_aggregator"
    system_prompt = (
        "You are the Evidence Aggregator in an astronomical anomaly investigation system. "
        "You review all evidence gathered by other agents (data analysis, astronomy interpretation, "
        "research context, scientific tool results, and critique) and produce a single, balanced synthesis. "
        "Weigh supporting and contradicting evidence honestly — do not simply average opinions, "
        "reason about which evidence is strongest and why."
    )

    def run(self, db: Session, investigation_id: str, input_data: dict) -> dict:
        evidence_items = db.query(Evidence).filter(Evidence.investigation_id == investigation_id).all()

        evidence_summary = "\n".join(
            f"- [{e.source_agent}] ({e.supports or 'neutral'}): {e.content}"
            for e in evidence_items
        )

        hypothesis_text = input_data.get("hypothesis")
        critic_verdict = input_data.get("critic_verdict")
        critic_confidence = input_data.get("critic_confidence")

        aggregation_prompt = (
            f"Hypothesis under review: {hypothesis_text}\n"
            f"Critic's verdict: {critic_verdict} (confidence: {critic_confidence})\n\n"
            f"All evidence gathered:\n{evidence_summary}\n\n"
            "As the Evidence Aggregator, respond with a JSON object with these keys:\n"
            '- "overall_assessment": 3-4 sentences synthesizing all the evidence into one coherent picture\n'
            '- "strongest_evidence": the single piece of evidence that most influences the conclusion, and why\n'
            '- "evidence_quality": one of "strong", "moderate", "weak" — overall quality/completeness of evidence gathered\n'
            '- "final_recommendation": one of "high_priority_followup", "moderate_priority_followup", "low_priority", "likely_false_positive"'
        )

        result = self.call_llm_json(aggregation_prompt)
        result["n_evidence_items"] = len(evidence_items)
        return result