import hmac
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer

from app.core.config import settings

ALGORITHM = "HS256"

# auto_error=False lets the stream route fall back to a URL parameter when there is no header.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def _unauthorized(detail: str = "Not signed in") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _admin_email() -> str:
    return settings.ADMIN_EMAIL.strip().lower()


def credentials_are_valid(email: str, password: str) -> bool:
    if not settings.ADMIN_EMAIL or not settings.ADMIN_PASSWORD:
        return False
    # Constant-time comparisons, both always evaluated.
    email_ok = hmac.compare_digest(email.strip().lower().encode(), _admin_email().encode())
    password_ok = hmac.compare_digest(password.encode(), settings.ADMIN_PASSWORD.encode())
    return email_ok and password_ok


def create_access_token(email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": email,
        "iat": now,
        "exp": now + timedelta(hours=settings.TOKEN_HOURS),
    }
    return jwt.encode(payload, settings.AUTH_SECRET, algorithm=ALGORITHM)


def _email_from_token(token: str) -> str:
    # Fail closed: with no secret configured, no token is ever accepted.
    if not settings.AUTH_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Login is not configured on the server",
        )
    try:
        payload = jwt.decode(token, settings.AUTH_SECRET, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise _unauthorized("Session expired")
    except jwt.InvalidTokenError:
        raise _unauthorized("Invalid token")

    email = payload.get("sub")
    if not email or email != _admin_email():
        raise _unauthorized("Invalid token")
    return email


def require_user(token: str | None = Depends(oauth2_scheme)) -> str:
    if not token:
        raise _unauthorized()
    return _email_from_token(token)


def require_user_stream(
    token: str | None = Depends(oauth2_scheme),
    access_token: str | None = Query(default=None),
) -> str:
    """The browser's EventSource cannot send headers, so the live stream also accepts ?access_token=."""
    raw = token or access_token
    if not raw:
        raise _unauthorized()
    return _email_from_token(raw)