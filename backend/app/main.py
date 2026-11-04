from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import analysis, auth, candidates, events, ingestion, investigations
from app.core.config import settings
from app.core.security import require_user, require_user_stream

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public: the login itself and the health check.
app.include_router(auth.router)

# Everything else needs a valid token.
app.include_router(ingestion.router, dependencies=[Depends(require_user)])
app.include_router(analysis.router, dependencies=[Depends(require_user)])
app.include_router(candidates.router, dependencies=[Depends(require_user)])
app.include_router(investigations.router, dependencies=[Depends(require_user)])
app.include_router(events.router, dependencies=[Depends(require_user_stream)])


@app.get("/health")
def health_check():
    return {"status": "ok", "service": settings.PROJECT_NAME, "environment": settings.ENVIRONMENT}