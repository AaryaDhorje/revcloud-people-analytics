from collections.abc import AsyncIterator
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from backend.config import settings


def _split_ssl_option(url: str) -> tuple[str, dict]:
    """Move libpq-style SSL params out of the URL and into asyncpg connect args.

    Managed Postgres providers hand out URLs ending in `?sslmode=require`, but
    asyncpg does not understand `sslmode` — it wants an `ssl` connect argument.
    Leaving it in the URL raises `invalid connection option "sslmode"` at
    connect time, so strip it here and translate.
    """
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    connect_args: dict = {}

    ssl_value = query.pop("sslmode", None) or query.pop("ssl", None)
    if ssl_value is not None:
        # asyncpg accepts True/False or an SSLContext; the libpq words map onto
        # "do we require TLS at all".
        connect_args["ssl"] = ssl_value.lower() not in {"disable", "false", "0"}

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
