from dataclasses import dataclass
from typing import Annotated, Any

import jwt
from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db import get_session
from backend.models import AuditLog, User
from backend.security import decode_token

ACCESS_COOKIE = "rc_access"
REFRESH_COOKIE = "rc_refresh"
# Readable by the browser on purpose; see _set_auth_cookies in routers/auth.py.
SESSION_HINT_COOKIE = "rc_session"

SessionDep = Annotated[AsyncSession, Depends(get_session)]


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    session: SessionDep,
    rc_access: Annotated[str | None, Cookie(alias=ACCESS_COOKIE)] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    """Resolve the caller from the access token.

    The httpOnly cookie is the primary channel (it is immune to XSS token
    theft); the Authorization header is accepted as well so the API stays
    usable from curl and the test suite.
    """
    token = rc_access
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise _unauthorized("Not authenticated.")

    try:
        payload = decode_token(token, expected_type="access")
    except jwt.ExpiredSignatureError:
        raise _unauthorized("Session expired.")
    except jwt.InvalidTokenError:
        raise _unauthorized("Invalid credentials.")

    user = await session.get(User, int(payload["sub"]))
    if user is None or not user.is_active:
        raise _unauthorized("Account is inactive or no longer exists.")

    # Revocation check. token_version is bumped on logout, password reset, and
    # any admin change to role/department/activation, which immediately
    # invalidates access tokens already in circulation.
    if int(payload.get("tv", -1)) != user.token_version:
        raise _unauthorized("Session was revoked. Please sign in again.")

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*allowed: str):
    """Dependency factory gating an endpoint on the caller's role."""

    async def _guard(user: CurrentUser) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"This action requires one of: {', '.join(allowed)}. "
                    f"Your role is '{user.role}'."
                ),
            )
        return user

    return _guard


RequireAdmin = Annotated[User, Depends(require_roles("admin"))]
RequireAnalyst = Annotated[User, Depends(require_roles("admin", "manager", "viewer"))]
RequireWriter = Annotated[User, Depends(require_roles("admin", "manager"))]


@dataclass(frozen=True)
class DataScope:
    """The slice of employee data the caller is allowed to see.

    This is the single place RBAC row-filtering is decided. Every analytics
    query funnels through `department`, so a manager physically cannot read
    another department's rows even by crafting query parameters — the filter is
    derived from their JWT, never from the request.
    """

    user: User
    department: str | None

    @property
    def is_scoped(self) -> bool:
        return self.department is not None

    @property
    def note(self) -> str | None:
        if self.department:
            return f"Scoped to the {self.department} department for your manager role."
        return None


async def get_data_scope(user: CurrentUser) -> DataScope:
    if user.role == "manager":
        if not user.department:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Your manager account has no department assigned. "
                    "Ask an administrator to set one before viewing analytics."
                ),
            )
        return DataScope(user=user, department=user.department)
    # Admins and viewers both see company-wide figures; viewers are additionally
    # blocked from every mutating route by require_roles.
    return DataScope(user=user, department=None)


ScopeDep = Annotated[DataScope, Depends(get_data_scope)]


async def record_audit(
    session: AsyncSession,
    *,
    request: Request | None,
    user: User | None,
    action: str,
    resource: str,
    detail: dict[str, Any] | None = None,
) -> None:
    """Append an audit row. Never raises — auditing must not break a request."""
    try:
        session.add(
            AuditLog(
                user_id=user.id if user else None,
                actor_email=user.email if user else None,
                action=action,
                resource=resource,
                detail=detail,
                ip_address=_client_ip(request),
                user_agent=(
                    request.headers.get("user-agent") if request is not None else None
                ),
            )
        )
        await session.flush()
    except Exception:  # pragma: no cover - defensive
        pass


def _client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    # Vercel terminates TLS upstream, so the socket peer is always the proxy.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    result = await session.execute(
        select(User).where(User.email == email.strip().lower())
    )
    return result.scalar_one_or_none()
