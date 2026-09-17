from sqlalchemy.orm import Session

from app.agents.base import BaseAgent


class AstronomyAnalystAgent(BaseAgent):
    name = "astronomy_analyst"
    system_prompt = (
        "You are the Astronomy Analyst in an astronomical anomaly investigation system. "
        "You have deep knowledge of stellar photometry, exoplanet transits, stellar variability, "
        "and common instrumental artifacts in Kepler/TESS data. "
        "Given factual light curve data and features, provide a domain-level scientific interpretation. "
        "Be specific about what patterns are consistent with, and note your confidence level. "
        "Do not overstate certainty — this is a preliminary read, not a final conclusion."
    )

    def run(self, db: Session, investigation_id: str, input_data: dict) -> dict:
        data_summary = input_data.get("data_summary")
        features = input_data.get("features")

        analysis_prompt = (
            f"Data Agent summary: {data_summary}\n\n"
            f"Raw features: {features}\n\n"
            "As the Astronomy Analyst, respond with a JSON object with these keys:\n"
            '- "interpretation": a 2-3 sentence scientific interpretation of what this pattern could indicate\n'
            '- "possible_causes": a list of 2-4 possible astrophysical or instrumental explanations, ordered by likelihood\n'
            '- "confidence": one of "low", "medium", "high" — your confidence in this being a genuine astrophysical signal vs noise/artifact\n'
            '- "recommended_next_step": what a scientist should check next to confirm or rule out the top explanation'
        )

        result = self.call_llm_json(analysis_prompt)
        return result