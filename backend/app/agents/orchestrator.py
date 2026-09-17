from datetime import datetime
from sqlalchemy.orm import Session

from app.models.models import Investigation, Candidate
from app.agents.data_agent import DataAgent
from app.agents.astronomy_analyst import AstronomyAnalystAgent
from app.agents.research_agent import ResearchAgent
from app.agents.hypothesis_agent import HypothesisAgent
from app.agents.scientific_tool_agent import ScientificToolAgent
from app.agents.critic_agent import CriticAgent
from app.services.evidence import create_evidence


def run_investigation(db: Session, candidate_id: str) -> dict:
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise ValueError(f"Candidate {candidate_id} not found")

    investigation = Investigation(
        candidate_id=candidate_id,
        state="initiated",
        started_at=datetime.utcnow(),
    )
    db.add(investigation)
    db.commit()
    db.refresh(investigation)

    investigation_id = investigation.id
    agent_outputs = {}

    try:
        investigation.state = "data_analysis"
        db.commit()
        data_agent = DataAgent()
        data_result = data_agent.run_and_log(db, investigation_id, {"candidate_id": candidate_id})
        agent_outputs["data_agent"] = data_result
        create_evidence(db, investigation_id, "data_agent", data_result["output"].get("summary", ""), supports="neutral")

        investigation.state = "astronomy_analysis"
        db.commit()
        analyst_agent = AstronomyAnalystAgent()
        analyst_input = {
            "data_summary": data_result["output"].get("summary"),
            "features": data_result["output"].get("features"),
        }
        analyst_result = analyst_agent.run_and_log(db, investigation_id, analyst_input)
        agent_outputs["astronomy_analyst"] = analyst_result
        create_evidence(db, investigation_id, "astronomy_analyst", analyst_result["output"].get("interpretation", ""), supports="neutral")

        investigation.state = "research"
        db.commit()
        research_agent = ResearchAgent()
        research_input = {
            "interpretation": analyst_result["output"].get("interpretation"),
            "possible_causes": analyst_result["output"].get("possible_causes"),
        }
        research_result = research_agent.run_and_log(db, investigation_id, research_input)
        agent_outputs["research_agent"] = research_result
        create_evidence(db, investigation_id, "research_agent", research_result["output"].get("background_context", ""), supports="neutral")

        investigation.state = "scientific_tools"
        db.commit()
        tool_agent = ScientificToolAgent()
        tool_result = tool_agent.run_and_log(db, investigation_id, {"candidate_id": candidate_id})
        agent_outputs["scientific_tool_agent"] = tool_result
        create_evidence(
            db, investigation_id, "scientific_tool_agent",
            str(tool_result["output"].get("interpretation", "")),
            supports="neutral",
        )

        investigation.state = "hypothesis"
        db.commit()
        hypothesis_agent = HypothesisAgent()
        hypothesis_input = {
            "data_summary": data_result["output"].get("summary"),
            "interpretation": analyst_result["output"].get("interpretation"),
            "possible_causes": analyst_result["output"].get("possible_causes"),
            "background_context": research_result["output"].get("background_context"),
        }
        hypothesis_result = hypothesis_agent.run_and_log(db, investigation_id, hypothesis_input)
        agent_outputs["hypothesis_agent"] = hypothesis_result
        hypothesis_id = hypothesis_result["output"].get("hypothesis_id")

        investigation.state = "critique"
        db.commit()
        critic_agent = CriticAgent()
        critic_input = {
            "hypothesis_id": hypothesis_id,
            "hypothesis": hypothesis_result["output"].get("hypothesis"),
            "confidence": hypothesis_result["output"].get("confidence"),
            "tool_evidence": tool_result["output"].get("interpretation"),
        }
        critic_result = critic_agent.run_and_log(db, investigation_id, critic_input)
        agent_outputs["critic_agent"] = critic_result
        create_evidence(
            db, investigation_id, "critic_agent",
            critic_result["output"].get("critique", ""),
            hypothesis_id=hypothesis_id,
            supports="contradicts" if critic_result["output"].get("verdict") == "not_supported" else "supports",
        )

        investigation.state = "completed"
        investigation.completed_at = datetime.utcnow()
        db.commit()

    except Exception as e:
        investigation.state = "failed"
        db.commit()
        agent_outputs["error"] = str(e)

    return {
        "investigation_id": investigation_id,
        "candidate_id": candidate_id,
        "final_state": investigation.state,
        "agent_outputs": agent_outputs,
    }