from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm

from app.core.config import settings
from app.core.security import (
    ADMIN,
    DEMO_SUBJECT,
    VIEWER,
    Principal,
    create_access_token,
    credentials_are_valid,
    require_user,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends()):
    if not settings.AUTH_SECRET or not settings.ADMIN_EMAIL or not settings.ADMIN_PASSWORD:
        raise HTTPException(status_code=503, detail="Login is not configured on the server")

    if not credentials_are_valid(form.username, form.password):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "access_token": create_access_token(settings.ADMIN_EMAIL.strip().lower(), ADMIN),
        "token_type": "bearer",
        "role": ADMIN,
        "expires_in_hours": settings.TOKEN_HOURS,
    }


@router.post("/demo")
def demo_login():
    """Public on purpose: hands out a read-only viewer token for the live demo."""
    if not settings.AUTH_SECRET:
        raise HTTPException(status_code=503, detail="Login is not configured on the server")
    if not settings.DEMO_ENABLED:
        raise HTTPException(status_code=403, detail="Demo access is not enabled")

    return {
        "access_token": create_access_token(DEMO_SUBJECT, VIEWER),
        "token_type": "bearer",
        "role": VIEWER,
        "expires_in_hours": settings.TOKEN_HOURS,
    }


@router.get("/me")
def me(user: Principal = Depends(require_user)):
    return {"email": user.subject, "role": user.role}