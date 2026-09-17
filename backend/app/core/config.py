from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "ASTRA"
    DATABASE_URL: str = "postgresql://astra_user:astra_pass@localhost:5433/astra_db"
    ENVIRONMENT: str = "development"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-120b"

    class Config:
        env_file = ".env"

settings = Settings()