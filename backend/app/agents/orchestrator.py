from datetime import datetime
from sqlalchemy.orm import Session

from app.models.models import Investigation, Candidate
from app.agents.data_agent import DataAgent
from app.agents.astronomy_analyst import AstronomyAnalystAgent
from app.agents.research_agent import ResearchAgent
from app.agents.hypothesis_agent import HypothesisAgent
from app.agents.scientific_tool_agent import ScientificToolAgent
from app.agents.critic_agent import CriticAgent
from app.agents.evidence_aggregator import EvidenceAggregatorAgent
from app.agents.discovery_ranker import DiscoveryRankerAgent
from app.services.evidence import create_evidence
from app.services.event_bus import publish


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

    def set_state(state: str):
        investigation.state = state
        db.commit()
        publish(investigation_id, {"investigation_id": investigation_id, "state": state})

    try:
        set_state("data_analysis")
        data_agent = DataAgent()
        data_result = data_agent.run_and_log(db, investigation_id, {"candidate_id": candidate_id})
        agent_outputs["data_agent"] = data_result
        create_evidence(db, investigation_id, "data_agent", data_result["output"].get("summary", ""), supports="neutral")
        publish(investigation_id, {"investigation_id": investigation_id, "agent_completed": "data_agent"})

        set_state("astronomy_analysis")
        analyst_agent = AstronomyAnalystAgent()
        analyst_input = {
            "data_summary": data_result["output"].get("summary"),
            "features": data_result["output"].get("features"),
        }
        analyst_result = analyst_agent.run_and_log(db, investigation_id, analyst_input)
        agent_outputs["astronomy_analyst"] = analyst_result
        create_evidence(db, investigation_id, "astronomy_analyst", analyst_result["output"].get("interpretation", ""), supports="neutral")
        publish(investigation_id, {"investigation_id": investigation_id, "agent_completed": "astronomy_analyst"})

        set_state("research")
        research_agent = ResearchAgent()
        research_input = {
            "interpretation": analyst_result["output"].get("interpretation"),
            "possible_causes": analyst_result["output"].get("possible_causes"),
        }
        research_result = research_agent.run_and_log(db, investigation_id, research_input)
        agent_outputs["research_agent"] = research_result
        create_evidence(db, investigation_id, "research_agent", research_result["output"].get("background_context", ""), supports="neutral")
        publish(investigation_id, {"investigation_id": investigation_id, "agent_completed": "research_agent"})

        set_state("scientific_tools")
        tool_agent = ScientificToolAgent()
        tool_result = tool_agent.run_and_log(db, investigation_id, {"candidate_id": candidate_id})
        agent_outputs["scientific_tool_agent"] = tool_result
        create_evidence(
            db, investigation_id, "scientific_tool_agent",
            str(tool_result["output"].get("interpretation", "")),
            supports="neutral",
        )
        publish(investigation_id, {"investigation_id": investigation_id, "agent_completed": "scientific_tool_agent"})

        set_state("hypothesis")
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
        publish(investigation_id, {"investigation_id": investigation_id, "agent_completed": "hypothesis_agent"})

        set_state("critique")
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
        publish(investigation_id, {"investigation_id": investigation_id, "agent_completed": "critic_agent"})

        set_state("evidence_aggregation")
        aggregator_agent = EvidenceAggregatorAgent()
        aggregator_input = {
            "hypothesis": hypothesis_result["output"].get("hypothesis"),
            "critic_verdict": critic_result["output"].get("verdict"),
            "critic_confidence": critic_result["output"].get("revised_confidence"),
        }
        aggregator_result = aggregator_agent.run_and_log(db, investigation_id, aggregator_input)
        agent_outputs["evidence_aggregator"] = aggregator_result
        publish(investigation_id, {"investigation_id": investigation_id, "agent_completed": "evidence_aggregator"})

        set_state("ranking")
        ranker_agent = DiscoveryRankerAgent()
        ranker_input = {
            "candidate_id": candidate_id,
            "anomaly_score": candidate.anomaly_score,
            "critic_confidence": critic_result["output"].get("revised_confidence", 0.0),
            "evidence_quality": aggregator_result["output"].get("evidence_quality", "weak"),
            "final_recommendation": aggregator_result["output"].get("final_recommendation", "low_priority"),
            "overall_assessment": aggregator_result["output"].get("overall_assessment", ""),
        }
        ranker_result = ranker_agent.run_and_log(db, investigation_id, ranker_input)
        agent_outputs["discovery_ranker"] = ranker_result
        publish(investigation_id, {"investigation_id": investigation_id, "agent_completed": "discovery_ranker"})

        set_state("completed")
        investigation.completed_at = datetime.utcnow()
        db.commit()
        publish(investigation_id, {"investigation_id": investigation_id, "state": "completed", "done": True})

    except Exception as e:
        investigation.state = "failed"
        db.commit()
        agent_outputs["error"] = str(e)
        publish(investigation_id, {"investigation_id": investigation_id, "state": "failed", "error": str(e), "done": True})

    return {
        "investigation_id": investigation_id,
        "candidate_id": candidate_id,
        "final_state": investigation.state,
        "agent_outputs": agent_outputs,
    }