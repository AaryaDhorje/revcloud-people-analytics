import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import bcrypt
import jwt

from backend.config import settings

TokenType = Literal["access", "refresh"]

# bcrypt silently ignores everything past the 72nd byte of input. Truncating
# explicitly (rather than letting the library do it) keeps hashing and
# verification agreeing on exactly which bytes matter.
_BCRYPT_MAX_BYTES = 72


def _prepare(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_prepare(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(_prepare(password), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        # Malformed hash in the database — treat as a failed login rather than
        # a 500, so a corrupt row cannot take the login endpoint down.
        return False


def _create_token(
    *, subject: str, token_type: TokenType, expires_delta: timedelta, **claims: Any
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        **claims,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(
    *, user_id: int, email: str, role: str, department: str | None, token_version: int
) -> str:
    # `tv` is carried on the access token as well as the refresh token so that
    # logout, a role change, or a password reset takes effect on the very next
    # request instead of lingering until the access token expires.
    return _create_token(
        subject=str(user_id),
        token_type="access",
        expires_delta=timedelta(minutes=settings.access_token_ttl_minutes),
        email=email,
        role=role,
        department=department,
        tv=token_version,
    )


def create_refresh_token(*, user_id: int, token_version: int) -> str:
    return _create_token(
        subject=str(user_id),
        token_type="refresh",
        expires_delta=timedelta(days=settings.refresh_token_ttl_days),
        tv=token_version,
    )


def decode_token(token: str, *, expected_type: TokenType) -> dict[str, Any]:
    """Decode and validate a JWT.

    Raises `jwt.InvalidTokenError` (or a subclass such as `ExpiredSignatureError`)
    if the token is unusable. Callers translate that into a 401.
    """
    payload = jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
        options={"require": ["exp", "iat", "sub", "type"]},
    )
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError(
            f"expected a {expected_type} token, got {payload.get('type')!r}"
        )
    return payload


def generate_reset_token() -> tuple[str, str]:
    """Return `(plaintext, sha256_hash)` for a password reset link.

    Only the hash is persisted. The plaintext exists just long enough to be put
    in the reset URL, so a database compromise cannot be replayed.
    """
    raw = secrets.token_urlsafe(48)
    return raw, hash_reset_token(raw)


def hash_reset_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
