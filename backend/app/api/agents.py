from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AgentRun, Investigation

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("/stats")
def agent_stats(db: Session = Depends(get_db)):
    """Run history per agent, plus investigation totals. Read-only, makes no AI calls."""
    rows = db.query(
        AgentRun.investigation_id,
        AgentRun.agent_name,
        AgentRun.status,
        AgentRun.started_at,
        AgentRun.completed_at,
    ).all()

    by_agent: dict[str, dict] = {}
    investigations_with_failed_agent: set[str] = set()

    for investigation_id, name, status, started, completed in rows:
        entry = by_agent.setdefault(
            name,
            {
                "agent_name": name,
                "total_runs": 0,
                "completed": 0,
                "failed": 0,
                "running": 0,
                "last_run_at": None,
                "_seconds": [],
            },
        )
        entry["total_runs"] += 1

        if status == "completed":
            entry["completed"] += 1
            if started and completed:
                entry["_seconds"].append((completed - started).total_seconds())
        elif status == "failed":
            entry["failed"] += 1
            investigations_with_failed_agent.add(investigation_id)
        else:
            entry["running"] += 1

        if started and (entry["last_run_at"] is None or started > entry["last_run_at"]):
            entry["last_run_at"] = started

    agents = []
    for entry in by_agent.values():
        seconds = entry.pop("_seconds")
        entry["avg_seconds"] = sum(seconds) / len(seconds) if seconds else None
        entry["success_rate"] = (
            entry["completed"] / entry["total_runs"] if entry["total_runs"] else None
        )
        agents.append(entry)

    # "completed" means finished with no failed agent; runs that finished despite a failed
    # agent (from before the pipeline stopped on failure) are counted separately.
    completed_clean = 0
    completed_with_errors = 0
    failed = 0
    in_progress = 0
    states = db.query(Investigation.id, Investigation.state).all()
    for investigation_id, state in states:
        if state == "completed":
            if investigation_id in investigations_with_failed_agent:
                completed_with_errors += 1
            else:
                completed_clean += 1
        elif state == "failed":
            failed += 1
        else:
            in_progress += 1

    return {
        "agents": agents,
        "investigations": {
            "total": len(states),
            "completed": completed_clean,
            "completed_with_errors": completed_with_errors,
            "failed": failed,
            "in_progress": in_progress,
        },
    }