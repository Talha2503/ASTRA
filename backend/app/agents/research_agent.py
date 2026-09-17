from sqlalchemy.orm import Session

from app.agents.base import BaseAgent


class ResearchAgent(BaseAgent):
    name = "research_agent"
    system_prompt = (
        "You are the Research Agent in an astronomical anomaly investigation system. "
        "You provide relevant scientific/astronomical background knowledge based on general "
        "domain knowledge of exoplanet detection, stellar variability, and photometric surveys. "
        "You do NOT have access to live literature search — clearly state this limitation and "
        "frame your output as general background knowledge, not specific citations. "
        "Never invent specific paper titles, authors, or citations."
    )

    def run(self, db: Session, investigation_id: str, input_data: dict) -> dict:
        interpretation = input_data.get("interpretation")
        possible_causes = input_data.get("possible_causes")

        research_prompt = (
            f"Astronomy Analyst's interpretation: {interpretation}\n"
            f"Possible causes considered: {possible_causes}\n\n"
            "As the Research Agent, respond with a JSON object with these keys:\n"
            '- "background_context": 2-3 sentences of general scientific background relevant to these possible causes '
            '(e.g. typical characteristics of this phenomenon, known detection challenges) based on general knowledge only\n'
            '- "similar_known_cases": a list of 1-3 well-known real examples (e.g. specific named exoplanets or stars) '
            "that are genuinely well-documented and relevant, only if you are confident they are real and accurate — "
            'otherwise return an empty list\n'
            '- "limitations_note": a short note that this is general background knowledge, not a live literature search'
        )

        result = self.call_llm_json(research_prompt)
        return result