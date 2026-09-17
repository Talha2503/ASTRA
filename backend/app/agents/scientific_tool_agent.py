from sqlalchemy.orm import Session

from app.agents.base import BaseAgent
from app.models.models import Candidate, LightCurve
from app.services.preprocessing import preprocess_light_curve
from app.services.scientific_tools import run_transit_search, run_statistical_significance_test


class ScientificToolAgent(BaseAgent):
    name = "scientific_tool_agent"
    system_prompt = (
        "You are the Scientific Tool Agent in an astronomical anomaly investigation system. "
        "You are given the output of rigorous computational tools (Box Least Squares transit search, "
        "statistical significance tests) already run on real data. Your job is to interpret these "
        "numerical results accurately for other agents. Never alter or invent the numbers — only explain "
        "what they mean scientifically."
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

        try:
            transit_result = run_transit_search(processed["time"], processed["flux"])
        except Exception as e:
            transit_result = {"error": f"Transit search failed: {str(e)}"}

        stats_result = run_statistical_significance_test(processed["flux"])

        interpretation_prompt = (
            f"Box Least Squares transit search results: {transit_result}\n\n"
            f"Statistical significance test results: {stats_result}\n\n"
            "As the Scientific Tool Agent, respond with a JSON object with these keys:\n"
            '- "transit_interpretation": 2-3 sentences interpreting the BLS results — is this depth/SNR/period '
            'consistent with a real transit signal? Note the odd-even depth difference significance (a large '
            'difference suggests a false positive/eclipsing binary, not a genuine planet)\n'
            '- "statistical_interpretation": 1-2 sentences on whether the flux distribution is consistent with '
            'Gaussian noise or shows significant non-Gaussian structure (which could indicate a real signal)\n'
            '- "tool_based_confidence": one of "low", "medium", "high" based purely on these quantitative results'
        )

        llm_result = self.call_llm_json(interpretation_prompt)

        return {
            "transit_search": transit_result,
            "statistical_test": stats_result,
            "interpretation": llm_result,
        }