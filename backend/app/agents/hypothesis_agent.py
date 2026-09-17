from sqlalchemy.orm import Session

from app.agents.base import BaseAgent
from app.models.models import Hypothesis


class HypothesisAgent(BaseAgent):
    name = "hypothesis_agent"
    system_prompt = (
        "You are the Hypothesis Agent in an astronomical anomaly investigation system. "
        "Given data analysis, astronomical interpretation, and research context, you propose "
        "a single clear, specific, testable hypothesis explaining the observed anomaly. "
        "State it precisely enough that it could be confirmed or refuted by further analysis. "
        "Assign a realistic confidence score reflecting genuine scientific uncertainty."
    )

    def run(self, db: Session, investigation_id: str, input_data: dict) -> dict:
        data_summary = input_data.get("data_summary")
        interpretation = input_data.get("interpretation")
        possible_causes = input_data.get("possible_causes")
        background_context = input_data.get("background_context")

        hypothesis_prompt = (
            f"Data summary: {data_summary}\n"
            f"Astronomy Analyst interpretation: {interpretation}\n"
            f"Possible causes: {possible_causes}\n"
            f"Research background: {background_context}\n\n"
            "As the Hypothesis Agent, respond with a JSON object with these keys:\n"
            '- "hypothesis": one clear, specific, testable sentence stating your proposed explanation\n'
            '- "confidence": a number between 0.0 and 1.0 reflecting genuine scientific confidence\n'
            '- "reasoning": 2-3 sentences explaining why this hypothesis was chosen over the alternatives\n'
            '- "how_to_test": one concrete suggestion for how this hypothesis could be confirmed or refuted'
        )

        result = self.call_llm_json(hypothesis_prompt)

        hypothesis_record = Hypothesis(
            investigation_id=investigation_id,
            description=result.get("hypothesis", ""),
            confidence=result.get("confidence"),
            status="proposed",
        )
        db.add(hypothesis_record)
        db.commit()
        db.refresh(hypothesis_record)

        result["hypothesis_id"] = hypothesis_record.id
        return result