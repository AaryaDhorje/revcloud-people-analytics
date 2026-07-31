"""Server-Sent Events stream for live dashboard updates.

Why SSE rather than Socket.io: the traffic is strictly one-directional (server
pushes "the data changed"), SSE is plain HTTP so it needs no separate socket
server or sticky sessions on Vercel, and `EventSource` reconnects on its own.

Why polling a counter rather than Postgres LISTEN/NOTIFY: NOTIFY needs a
connection held open for the listener's lifetime, which neither a serverless
function nor a transaction-mode pooler will give us. Watching an integer costs
one indexed read every couple of seconds and behaves the same everywhere.

The stream deliberately ends itself before the platform's function timeout so
the client sees a clean close and reconnects, rather than a truncated response.
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from backend.db import SessionLocal
from backend.deps import CurrentUser
from backend.models import RealtimeState

router = APIRouter(prefix="/api/py/events", tags=["events"])

POLL_SECONDS = 2.0
# Vercel's function ceiling is 60s (see vercel.json); leave headroom so we
# always close on our own terms.
STREAM_LIFETIME_SECONDS = 50.0
# Below the lifetime, so the browser reconnects promptly after each cycle.
CLIENT_RETRY_MS = 3000


async def _current_version() -> tuple[int, str | None]:
    # A short-lived session per tick: holding one open for the whole stream
    # would pin a pooled connection for a minute at a time.
    async with SessionLocal() as session:
        row = (
            await session.execute(
                select(RealtimeState.version, RealtimeState.last_event).where(
                    RealtimeState.id == 1
                )
            )
        ).one_or_none()
    if row is None:
        return 0, None
    return int(row[0]), row[1]


def _format(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.get("/stream")
async def stream(request: Request, user: CurrentUser) -> StreamingResponse:
    async def generator():
        yield f"retry: {CLIENT_RETRY_MS}\n\n"

        version, last_event = await _current_version()
        yield _format(
            "connected",
            {
                "version": version,
                "last_event": last_event,
                "at": datetime.now(timezone.utc).isoformat(),
            },
        )

        loop = asyncio.get_event_loop()
        deadline = loop.time() + STREAM_LIFETIME_SECONDS

        while loop.time() < deadline:
            if await request.is_disconnected():
                return

            await asyncio.sleep(POLL_SECONDS)

            try:
                current, event_name = await _current_version()
            except Exception:
                # A transient database blip should not kill the stream; the
                # next tick will retry.
                continue

            if current != version:
                version = current
                yield _format(
                    "data-changed",
                    {
                        "version": version,
                        "last_event": event_name,
                        "at": datetime.now(timezone.utc).isoformat(),
                    },
                )
            else:
                # Comment frames keep proxies from closing an idle connection.
                yield ": keep-alive\n\n"

        yield _format("cycle-end", {"reason": "stream lifetime reached"})

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            # Disable proxy buffering, which would otherwise hold events back.
            "X-Accel-Buffering": "no",
        },
    )
