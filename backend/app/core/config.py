from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "ASTRA"
    DATABASE_URL: str = "postgresql://astra_user:astra_pass@localhost:5433/astra_db"
    ENVIRONMENT: str = "development"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""
    AUTH_SECRET: str = ""
    TOKEN_HOURS: int = 12
    DEMO_ENABLED: bool = False
    # Websites allowed to call this backend, separated by commas.
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    class Config:
        env_file = ".env"

settings = Settings()