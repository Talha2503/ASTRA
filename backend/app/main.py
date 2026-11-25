from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import agents, analysis, auth, candidates, events, ingestion, investigations
from app.core.config import settings
from app.core.security import require_user, require_user_stream

app = FastAPI(title=settings.PROJECT_NAME)

allowed_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ModuleNotFoundError)
async def missing_library_handler(request: Request, exc: ModuleNotFoundError):
    """On the slim server, actions that need the science libraries answer 503 instead of crashing."""
    return JSONResponse(
        status_code=503,
        content={
            "detail": "This action needs analysis libraries that are not installed on this server."
        },
    )


# Public: the login itself and the health check.
app.include_router(auth.router)

# Everything else needs a valid token.
app.include_router(ingestion.router, dependencies=[Depends(require_user)])
app.include_router(analysis.router, dependencies=[Depends(require_user)])
app.include_router(candidates.router, dependencies=[Depends(require_user)])
app.include_router(investigations.router, dependencies=[Depends(require_user)])
app.include_router(agents.router, dependencies=[Depends(require_user)])
app.include_router(events.router, dependencies=[Depends(require_user_stream)])


@app.get("/health")
def health_check():
    return {"status": "ok", "service": settings.PROJECT_NAME, "environment": settings.ENVIRONMENT}