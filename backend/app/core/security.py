import hmac
from datetime import datetime, timedelta, timezone
from typing import NamedTuple

import jwt
from fastapi import Depends, HTTPException, Query, Request, status
from fastapi.security import OAuth2PasswordBearer

from app.core.config import settings

ALGORITHM = "HS256"
ADMIN = "admin"
VIEWER = "viewer"
DEMO_SUBJECT = "demo"

# A viewer (the public demo account) may only make requests that read.
READ_ONLY_METHODS = {"GET", "HEAD", "OPTIONS"}

# auto_error=False lets the stream route fall back to a URL parameter when there is no header.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


class Principal(NamedTuple):
    subject: str
    role: str


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


def create_access_token(subject: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "role": role,
        "iat": now,
        "exp": now + timedelta(hours=settings.TOKEN_HOURS),
    }
    return jwt.encode(payload, settings.AUTH_SECRET, algorithm=ALGORITHM)


def _principal_from_token(token: str) -> Principal:
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

    subject = payload.get("sub")
    role = payload.get("role")

    if role == ADMIN and subject and subject == _admin_email():
        return Principal(subject, ADMIN)

    # Viewer tokens stop working the moment DEMO_ENABLED is switched off.
    if role == VIEWER and subject == DEMO_SUBJECT and settings.DEMO_ENABLED:
        return Principal(subject, VIEWER)

    # Includes older tokens that have no role: they must sign in again.
    raise _unauthorized("Invalid token")


def _enforce_read_only(request: Request, principal: Principal) -> None:
    if principal.role == VIEWER and request.method not in READ_ONLY_METHODS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The demo account is read-only",
        )


def require_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
) -> Principal:
    if not token:
        raise _unauthorized()
    principal = _principal_from_token(token)
    _enforce_read_only(request, principal)
    return principal


def require_user_stream(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    access_token: str | None = Query(default=None),
) -> Principal:
    """The browser's EventSource cannot send headers, so the live stream also accepts ?access_token=."""
    raw = token or access_token
    if not raw:
        raise _unauthorized()
    principal = _principal_from_token(raw)
    _enforce_read_only(request, principal)
    return principal