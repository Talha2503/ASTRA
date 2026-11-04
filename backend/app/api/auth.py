from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm

from app.core.config import settings
from app.core.security import create_access_token, credentials_are_valid, require_user

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
        "access_token": create_access_token(settings.ADMIN_EMAIL.strip().lower()),
        "token_type": "bearer",
        "expires_in_hours": settings.TOKEN_HOURS,
    }


@router.get("/me")
def me(email: str = Depends(require_user)):
    return {"email": email}