import logging
from datetime import datetime
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
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

logger = logging.getLogger(__name__)


def _ensure_ok(result: dict) -> dict:
    """A failed agent stops the investigation instead of feeding empty inputs to the next one."""
    if result.get("status") != "completed":
        error = (result.get("output") or {}).get("error", "unknown error")
        raise RuntimeError(f"{result.get('agent_name')} failed: {error}")
    return result


def create_investigation(db: Session, candidate_id: str) -> Investigation:
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
    return investigation


def execute_investigation(db: Session, investigation_id: str) -> dict:
    investigation = db.query(Investigation).filter(Investigation.id == investigation_id).first()
    if not investigation:
        raise ValueError(f"Investigation {investigation_id} not found")

    candidate = db.query(Candidate).filter(Candidate.id == investigation.candidate_id).first()
    if not candidate:
        raise ValueError(f"Candidate {investigation.candidate_id} not found")

    candidate_id = candidate.id
    agent_outputs = {}

    def set_state(state: str):
        investigation.state = state
        db.commit()
        publish(investigation_id, {"investigation_id": investigation_id, "state": state})

    def agent_done(name: str):
        publish(investigation_id, {"investigation_id": investigation_id, "agent_completed": name})

    try:
        set_state("data_analysis")
        data_result = _ensure_ok(
            DataAgent().run_and_log(db, investigation_id, {"candidate_id": candidate_id})
        )
        agent_outputs["data_agent"] = data_result
        create_evidence(db, investigation_id, "data_agent", data_result["output"].get("summary", ""), supports="neutral")
        agent_done("data_agent")

        set_state("astronomy_analysis")
        analyst_result = _ensure_ok(
            AstronomyAnalystAgent().run_and_log(
                db,
                investigation_id,
                {
                    "data_summary": data_result["output"].get("summary"),
                    "features": data_result["output"].get("features"),
                },
            )
        )
        agent_outputs["astronomy_analyst"] = analyst_result
        create_evidence(db, investigation_id, "astronomy_analyst", analyst_result["output"].get("interpretation", ""), supports="neutral")
        agent_done("astronomy_analyst")

        set_state("research")
        research_result = _ensure_ok(
            ResearchAgent().run_and_log(
                db,
                investigation_id,
                {
                    "interpretation": analyst_result["output"].get("interpretation"),
                    "possible_causes": analyst_result["output"].get("possible_causes"),
                },
            )
        )
        agent_outputs["research_agent"] = research_result
        create_evidence(db, investigation_id, "research_agent", research_result["output"].get("background_context", ""), supports="neutral")
        agent_done("research_agent")

        set_state("scientific_tools")
        tool_result = _ensure_ok(
            ScientificToolAgent().run_and_log(db, investigation_id, {"candidate_id": candidate_id})
        )
        agent_outputs["scientific_tool_agent"] = tool_result
        create_evidence(
            db, investigation_id, "scientific_tool_agent",
            str(tool_result["output"].get("interpretation", "")),
            supports="neutral",
        )
        agent_done("scientific_tool_agent")

        set_state("hypothesis")
        hypothesis_result = _ensure_ok(
            HypothesisAgent().run_and_log(
                db,
                investigation_id,
                {
                    "data_summary": data_result["output"].get("summary"),
                    "interpretation": analyst_result["output"].get("interpretation"),
                    "possible_causes": analyst_result["output"].get("possible_causes"),
                    "background_context": research_result["output"].get("background_context"),
                },
            )
        )
        agent_outputs["hypothesis_agent"] = hypothesis_result
        hypothesis_id = hypothesis_result["output"].get("hypothesis_id")
        agent_done("hypothesis_agent")

        set_state("critique")
        critic_result = _ensure_ok(
            CriticAgent().run_and_log(
                db,
                investigation_id,
                {
                    "hypothesis_id": hypothesis_id,
                    "hypothesis": hypothesis_result["output"].get("hypothesis"),
                    "confidence": hypothesis_result["output"].get("confidence"),
                    "tool_evidence": tool_result["output"].get("interpretation"),
                },
            )
        )
        agent_outputs["critic_agent"] = critic_result
        create_evidence(
            db, investigation_id, "critic_agent",
            critic_result["output"].get("critique", ""),
            hypothesis_id=hypothesis_id,
            supports="contradicts" if critic_result["output"].get("verdict") == "not_supported" else "supports",
        )
        agent_done("critic_agent")

        set_state("evidence_aggregation")
        aggregator_result = _ensure_ok(
            EvidenceAggregatorAgent().run_and_log(
                db,
                investigation_id,
                {
                    "hypothesis": hypothesis_result["output"].get("hypothesis"),
                    "critic_verdict": critic_result["output"].get("verdict"),
                    "critic_confidence": critic_result["output"].get("revised_confidence"),
                },
            )
        )
        agent_outputs["evidence_aggregator"] = aggregator_result
        agent_done("evidence_aggregator")

        set_state("ranking")
        ranker_result = _ensure_ok(
            DiscoveryRankerAgent().run_and_log(
                db,
                investigation_id,
                {
                    "candidate_id": candidate_id,
                    "anomaly_score": candidate.anomaly_score,
                    "critic_confidence": critic_result["output"].get("revised_confidence", 0.0),
                    "evidence_quality": aggregator_result["output"].get("evidence_quality", "weak"),
                    "final_recommendation": aggregator_result["output"].get("final_recommendation", "low_priority"),
                    "overall_assessment": aggregator_result["output"].get("overall_assessment", ""),
                },
            )
        )
        agent_outputs["discovery_ranker"] = ranker_result
        agent_done("discovery_ranker")

        investigation.completed_at = datetime.utcnow()
        set_state("completed")
        publish(investigation_id, {"investigation_id": investigation_id, "state": "completed", "done": True})

    except Exception as e:
        db.rollback()
        investigation.state = "failed"
        db.commit()
        agent_outputs["error"] = str(e)
        publish(
            investigation_id,
            {"investigation_id": investigation_id, "state": "failed", "error": str(e), "done": True},
        )

    return {
        "investigation_id": investigation_id,
        "candidate_id": candidate_id,
        "final_state": investigation.state,
        "agent_outputs": agent_outputs,
    }


def run_investigation(db: Session, candidate_id: str) -> dict:
    """Create and run an investigation, blocking until it finishes."""
    investigation = create_investigation(db, candidate_id)
    return execute_investigation(db, investigation.id)


def run_in_background(investigation_id: str) -> None:
    """Run an already-created investigation with its own database session."""
    db = SessionLocal()
    try:
        execute_investigation(db, investigation_id)
    except Exception:
        logger.exception("Investigation %s crashed", investigation_id)
    finally:
        db.close()