from sqlalchemy.orm import Session

from app.agents.base import BaseAgent
from app.models.models import Hypothesis


class CriticAgent(BaseAgent):
    name = "critic_agent"
    system_prompt = (
        "You are the Critic Agent in an astronomical anomaly investigation system. "
        "Your job is to rigorously challenge the proposed hypothesis using the available quantitative evidence. "
        "Actively look for reasons the hypothesis could be WRONG — false positives, alternative explanations, "
        "insufficient evidence, or statistical weaknesses. Do not be agreeable by default. "
        "If the hypothesis is genuinely well-supported, say so, but only after real scrutiny."
    )

    def run(self, db: Session, investigation_id: str, input_data: dict) -> dict:
        hypothesis_id = input_data.get("hypothesis_id")
        hypothesis_text = input_data.get("hypothesis")
        hypothesis_confidence = input_data.get("confidence")
        tool_evidence = input_data.get("tool_evidence")

        critique_prompt = (
            f"Proposed hypothesis: {hypothesis_text}\n"
            f"Hypothesis Agent's stated confidence: {hypothesis_confidence}\n\n"
            f"Scientific Tool Agent's quantitative evidence: {tool_evidence}\n\n"
            "As the Critic Agent, respond with a JSON object with these keys:\n"
            '- "critique": 3-4 sentences critically evaluating the hypothesis against the evidence. '
            "Explicitly check: does the odd-even depth test support or undermine this? "
            "Is the transit SNR strong enough? Are there simpler alternative explanations?\n"
            '- "weaknesses_identified": a list of specific weaknesses or gaps in the hypothesis/evidence '
            "(empty list if none found)\n"
            '- "verdict": one of "supported", "weakly_supported", "not_supported" — your overall judgment\n'
            '- "revised_confidence": a number 0.0-1.0 — your own confidence estimate after critique, '
            "which may differ from the Hypothesis Agent's original confidence"
        )

        result = self.call_llm_json(critique_prompt)

        hypothesis = db.query(Hypothesis).filter(Hypothesis.id == hypothesis_id).first()
        if hypothesis:
            if result.get("verdict") == "not_supported":
                hypothesis.status = "rejected"
            elif result.get("verdict") == "supported":
                hypothesis.status = "supported"
            else:
                hypothesis.status = "weakly_supported"
            hypothesis.confidence = result.get("revised_confidence", hypothesis.confidence)
            db.commit()

        return result