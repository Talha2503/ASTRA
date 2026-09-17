from sqlalchemy.orm import Session
from app.models.models import Evidence


def create_evidence(db: Session, investigation_id: str, source_agent: str, content: str,
                     hypothesis_id: str = None, supports: str = None):
    """supports: 'supports', 'contradicts', or 'neutral' relative to the hypothesis"""
    evidence = Evidence(
        investigation_id=investigation_id,
        hypothesis_id=hypothesis_id,
        source_agent=source_agent,
        content=content,
        supports=supports,
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)
    return evidence