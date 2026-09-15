from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "ASTRA"
    DATABASE_URL: str = "postgresql://astra_user:astra_pass@localhost:5432/astra_db"
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"

settings = Settings()