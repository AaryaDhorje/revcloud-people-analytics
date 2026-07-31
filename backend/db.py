from collections.abc import AsyncIterator
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from backend.config import settings


# libpq query parameters that asyncpg does not accept. SQLAlchemy forwards
# leftover query params to the driver as keyword arguments, so anything left
# here becomes a TypeError at connect time. Neon, for instance, hands out
# `?sslmode=require&channel_binding=require`.
_LIBPQ_ONLY_PARAMS = frozenset(
    {
        "channel_binding",
        "connect_timeout",
        "gssencmode",
        "options",
        "sslcert",
        "sslkey",
        "sslrootcert",
        "target_session_attrs",
    }
)


def _split_ssl_option(url: str) -> tuple[str, dict]:
    """Translate a libpq-style URL into something asyncpg accepts.

    Managed providers hand out URLs like
    `postgresql://…/db?sslmode=require&channel_binding=require`. asyncpg wants
    an `ssl` connect argument and rejects the rest outright, so translate
    `sslmode` and drop the parameters that only libpq understands.
    """
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    connect_args: dict = {}

    ssl_value = query.pop("sslmode", None) or query.pop("ssl", None)
    if ssl_value is not None:
        # asyncpg accepts True/False or an SSLContext; the libpq words map onto
        # "do we require TLS at all".
        connect_args["ssl"] = ssl_value.lower() not in {"disable", "false", "0"}

    for param in _LIBPQ_ONLY_PARAMS:
        query.pop(param, None)

    cleaned = urlunsplit(
        (parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment)
    )
    return cleaned, connect_args


_url, _ssl_args = _split_ssl_option(settings.normalized_database_url)

# NullPool: on serverless there is no stable process to pool against, and any
# managed pooler (PgBouncer, Neon proxy, Supabase pooler) is doing that job on
# the other side. statement_cache_size=0 is required for transaction-mode
# poolers, which do not keep prepared statements across statements.
engine = create_async_engine(
    _url,
    poolclass=NullPool,
    connect_args={"statement_cache_size": 0, **_ssl_args},
    future=True,
)

SessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency yielding a request-scoped session."""
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
