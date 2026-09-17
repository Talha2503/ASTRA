import json
from datetime import datetime
from groq import Groq
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import AgentRun

client = Groq(api_key=settings.GROQ_API_KEY)


class BaseAgent:
    name = "base_agent"
    system_prompt = "You are a helpful assistant."

    def call_llm(self, user_message: str, temperature: float = 0.3) -> str:
        response = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=temperature,
        )
        return response.choices[0].message.content

    def call_llm_json(self, user_message: str, temperature: float = 0.3) -> dict:
        """Call the LLM and force a JSON object response."""
        response = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {"role": "system", "content": self.system_prompt + "\n\nAlways respond with valid JSON only, no other text."},
                {"role": "user", "content": user_message},
            ],
            temperature=temperature,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        return json.loads(content)

    def run(self, db: Session, investigation_id: str, input_data: dict) -> dict:
        """Override this in each agent subclass."""
        raise NotImplementedError

    def run_and_log(self, db: Session, investigation_id: str, input_data: dict) -> dict:
        agent_run = AgentRun(
            investigation_id=investigation_id,
            agent_name=self.name,
            input_data=input_data,
            status="running",
            started_at=datetime.utcnow(),
        )
        db.add(agent_run)
        db.commit()
        db.refresh(agent_run)

        try:
            output = self.run(db, investigation_id, input_data)
            agent_run.output_data = output
            agent_run.status = "completed"
        except Exception as e:
            agent_run.output_data = {"error": str(e)}
            agent_run.status = "failed"
        finally:
            agent_run.completed_at = datetime.utcnow()
            db.commit()
            db.refresh(agent_run)

        return {
            "agent_run_id": agent_run.id,
            "agent_name": self.name,
            "status": agent_run.status,
            "output": agent_run.output_data,
        }