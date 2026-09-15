import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class LightCurve(Base):
    __tablename__ = "light_curves"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    target_id = Column(String, nullable=False, index=True)
    mission = Column(String, nullable=False)
    time_data = Column(JSON, nullable=False)
    flux_data = Column(JSON, nullable=False)
    flux_err_data = Column(JSON, nullable=True)
    meta = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    candidates = relationship("Candidate", back_populates="light_curve")


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    light_curve_id = Column(UUID(as_uuid=False), ForeignKey("light_curves.id"), nullable=False)
    anomaly_score = Column(Float, nullable=False)
    features = Column(JSON, nullable=True)
    status = Column(String, default="pending")
    priority_score = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    light_curve = relationship("LightCurve", back_populates="candidates")
    investigation = relationship("Investigation", back_populates="candidate", uselist=False)


class Investigation(Base):
    __tablename__ = "investigations"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    candidate_id = Column(UUID(as_uuid=False), ForeignKey("candidates.id"), nullable=False)
    state = Column(String, default="initiated")
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    candidate = relationship("Candidate", back_populates="investigation")
    agent_runs = relationship("AgentRun", back_populates="investigation")
    hypotheses = relationship("Hypothesis", back_populates="investigation")
    evidence_items = relationship("Evidence", back_populates="investigation")


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    investigation_id = Column(UUID(as_uuid=False), ForeignKey("investigations.id"), nullable=False)
    agent_name = Column(String, nullable=False)
    input_data = Column(JSON, nullable=True)
    output_data = Column(JSON, nullable=True)
    status = Column(String, default="running")
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    investigation = relationship("Investigation", back_populates="agent_runs")


class Hypothesis(Base):
    __tablename__ = "hypotheses"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    investigation_id = Column(UUID(as_uuid=False), ForeignKey("investigations.id"), nullable=False)
    description = Column(Text, nullable=False)
    confidence = Column(Float, nullable=True)
    status = Column(String, default="proposed")
    created_at = Column(DateTime, default=datetime.utcnow)

    investigation = relationship("Investigation", back_populates="hypotheses")


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    investigation_id = Column(UUID(as_uuid=False), ForeignKey("investigations.id"), nullable=False)
    hypothesis_id = Column(UUID(as_uuid=False), ForeignKey("hypotheses.id"), nullable=True)
    source_agent = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    supports = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    investigation = relationship("Investigation", back_populates="evidence_items")