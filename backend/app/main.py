from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import ingestion, analysis

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingestion.router)
app.include_router(analysis.router)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": settings.PROJECT_NAME, "environment": settings.ENVIRONMENT}