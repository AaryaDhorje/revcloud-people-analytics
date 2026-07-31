from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from fastapi import APIRouter, Cookie, HTTPException, Request, Response, status
from sqlalchemy import select

from backend.config import settings
from backend.deps import (
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    SESSION_HINT_COOKIE,
    CurrentUser,
    SessionDep,
    get_user_by_email,
    record_audit,
)
from backend.mailer import send_password_reset
from backend.models import PasswordResetToken, User
from backend.schemas import (
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    SessionOut,
    UserOut,
)
from backend.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_reset_token,
    hash_password,
    hash_reset_token,
    verify_password,
)

router = APIRouter(prefix="/api/py/auth", tags=["auth"])

# A genuine bcrypt hash (cost 12) of a value nobody can supply. Used to keep
# failed logins for unknown emails as slow as failed logins for known ones.
_DUMMY_HASH = "$2b$12$5EZvn4MPCjhGl9ZRewQ.NOzaftg7LVW6opdhsC6GNIiMqfLZeMlHC"


def _set_auth_cookies(response: Response, *, access: str, refresh: str) -> None:
    """Store both tokens as httpOnly cookies.

    httpOnly keeps them unreadable from JavaScript, so an XSS bug cannot
    exfiltrate a session. SameSite=lax is enough here because the API and the
    UI are the same origin (Next rewrites `/api/py/*` onto the backend).
    """
    secure = settings.is_production
    response.set_cookie(
        ACCESS_COOKIE,
        access,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.access_token_ttl_minutes * 60,
        path="/",
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.refresh_token_ttl_days * 24 * 3600,
        # Scoped to the refresh endpoint so it is not sent with every request.
        path="/api/py/auth",
    )
    # A non-secret hint that a session exists, living as long as the refresh
    # token. The route guard reads this instead of the access cookie: the
    # access cookie expires every 15 minutes, which would otherwise bounce a
    # user to the login page while their refresh token was still perfectly
    # valid. Carries no credential — it is only ever a routing hint, and the
    # API remains the sole authority on whether a request is authorised.
    response.set_cookie(
        SESSION_HINT_COOKIE,
        "1",
        httponly=False,
        secure=secure,
        samesite="lax",
        max_age=settings.refresh_token_ttl_days * 24 * 3600,
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path="/api/py/auth")
    response.delete_cookie(SESSION_HINT_COOKIE, path="/")


def _issue_session(response: Response, user: User) -> SessionOut:
    _set_auth_cookies(
        response,
        access=create_access_token(
            user_id=user.id,
            email=user.email,
            role=user.role,
            department=user.department,
            token_version=user.token_version,
        ),
        refresh=create_refresh_token(user_id=user.id, token_version=user.token_version),
    )
    return SessionOut(
        user=UserOut.model_validate(user),
        access_token_expires_in=settings.access_token_ttl_minutes * 60,
        idle_timeout_minutes=settings.idle_timeout_minutes,
    )


@router.post("/register", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    session: SessionDep,
) -> SessionOut:
    email = payload.email.strip().lower()
    if await get_user_by_email(session, email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email already exists.",
        )

    # Self-registration always yields a viewer. Promotion to manager or admin
    # is an explicit admin action, so signing up can never grant data access
    # beyond read-only dashboards.
    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        role="viewer",
        department=payload.department,
        last_login_at=datetime.now(timezone.utc),
    )
    session.add(user)
    await session.flush()

    await record_audit(
        session,
        request=request,
        user=user,
        action="auth.register",
        resource=f"user:{user.id}",
    )
    return _issue_session(response, user)


@router.post("/login", response_model=SessionOut)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    session: SessionDep,
) -> SessionOut:
    user = await get_user_by_email(session, payload.email)

    # Verify against a real (but unmatchable) hash when the user is unknown, so
    # a full bcrypt round still runs and the response time does not reveal
    # whether an email is registered. A malformed placeholder would short
    # circuit and reintroduce the timing signal.
    reference_hash = user.password_hash if user else _DUMMY_HASH
    password_ok = verify_password(payload.password, reference_hash)

    if not user or not password_ok:
        await record_audit(
            session,
            request=request,
            user=None,
            action="auth.login_failed",
            resource=f"email:{payload.email}",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Contact an administrator.",
        )

    user.last_login_at = datetime.now(timezone.utc)
    await record_audit(
        session,
        request=request,
        user=user,
        action="auth.login",
        resource=f"user:{user.id}",
    )
    return _issue_session(response, user)


@router.post("/refresh", response_model=SessionOut)
async def refresh(
    response: Response,
    session: SessionDep,
    rc_refresh: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None,
) -> SessionOut:
    if not rc_refresh:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="No active session."
        )
    try:
        payload = decode_token(rc_refresh, expected_type="refresh")
    except jwt.InvalidTokenError:
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired."
        )

    user = await session.get(User, int(payload["sub"]))
    if not user or not user.is_active:
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is no longer valid."
        )

    # token_version is bumped by logout-everywhere and password resets, which
    # is what makes previously issued refresh tokens stop working.
    if int(payload.get("tv", -1)) != user.token_version:
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session was revoked. Please sign in again.",
        )

    return _issue_session(response, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    session: SessionDep,
    user: CurrentUser,
) -> Response:
    # Bumping the version revokes both the refresh token and any access token
    # already issued, so logout is immediate rather than cosmetic.
    user.token_version += 1
    await record_audit(
        session,
        request=request,
        user=user,
        action="auth.logout",
        resource=f"user:{user.id}",
    )

    # Clear the cookies on the response that is actually returned. Mutating an
    # injected Response and then returning a different one would silently drop
    # the Set-Cookie headers.
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_auth_cookies(response)
    return response


@router.get("/me", response_model=SessionOut)
async def me(user: CurrentUser) -> SessionOut:
    return SessionOut(
        user=UserOut.model_validate(user),
        access_token_expires_in=settings.access_token_ttl_minutes * 60,
        idle_timeout_minutes=settings.idle_timeout_minutes,
    )


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    session: SessionDep,
) -> dict[str, str]:
    user = await get_user_by_email(session, payload.email)

    # Always answer identically. Confirming which addresses have accounts would
    # turn this endpoint into an account-enumeration oracle.
    generic = {
        "message": "If that email is registered, a reset link is on its way."
    }
    if not user or not user.is_active:
        return generic

    raw, token_hash = generate_reset_token()
    session.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc)
            + timedelta(minutes=settings.password_reset_ttl_minutes),
        )
    )
    await session.flush()

    reset_url = f"{settings.app_base_url.rstrip('/')}/reset-password?token={raw}"
    await send_password_reset(to_email=user.email, reset_url=reset_url)

    await record_audit(
        session,
        request=request,
        user=user,
        action="auth.password_reset_requested",
        resource=f"user:{user.id}",
    )
    return generic


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    response: Response,
    session: SessionDep,
) -> dict[str, str]:
    token_hash = hash_reset_token(payload.token)
    record = await session.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    )

    now = datetime.now(timezone.utc)
    if (
        record is None
        or record.used_at is not None
        or record.expires_at.replace(tzinfo=timezone.utc) < now
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset link is invalid or has expired. Request a new one.",
        )

    user = await session.get(User, record.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Account no longer exists."
        )

    user.password_hash = hash_password(payload.password)
    # Invalidate every existing session — a password reset should log out any
    # attacker who already had one.
    user.token_version += 1
    record.used_at = now

    await record_audit(
        session,
        request=request,
        user=user,
        action="auth.password_reset_completed",
        resource=f"user:{user.id}",
    )
    _clear_auth_cookies(response)
    return {"message": "Password updated. You can now sign in."}
