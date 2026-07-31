"""Vercel Python serverless entrypoint.

Vercel discovers the ASGI application exported from this module and routes every
`/api/py/*` request to it (see the rewrite in `next.config.ts` and the function
config in `vercel.json`).

The repository root is added to `sys.path` so the `backend` package resolves the
same way it does under uvicorn locally.
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.main import app  # noqa: E402

__all__ = ["app"]
