import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import text

from backend.config import settings
from backend.db import engine
from backend.ml.score import model_is_available, model_metadata
from backend.routers import admin, analytics, auth, employees, events, exports, public

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger("revcloud")


def create_app() -> FastAPI:
    app = FastAPI(
        title="RevCloud People Analytics API",
        version="1.0.0",
        description=(
            "Backend for the RevCloud People Analytics & Strategy Platform. "
            "All routes are served under /api/py so they can coexist with "
            "Next.js route handlers on a single Vercel deployment."
        ),
        docs_url="/api/py/docs",
        openapi_url="/api/py/openapi.json",
        redoc_url=None,
    )

    for router in (
        auth.router,
        public.router,
        analytics.router,
        employees.router,
        exports.router,
        events.router,
        admin.router,
    ):
        app.include_router(router)

    @app.exception_handler(RequestValidationError)
    async def validation_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """Flatten pydantic errors into one readable sentence.

        The default payload is a nested list that is awkward to render in a
        form; the UI just wants a message it can show next to the field.
        """
        problems = []
        for error in exc.errors():
            location = ".".join(str(p) for p in error["loc"] if p not in ("body", "query"))
            message = error.get("msg", "is invalid")
            message = message.removeprefix("Value error, ")
            problems.append(f"{location}: {message}" if location else message)
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": " | ".join(problems) or "Request validation failed."},
        )

    @app.get("/api/py/health", tags=["meta"])
    async def health() -> dict:
        """Liveness plus a quick read of the two things that usually break."""
        database_ok = True
        database_error: str | None = None
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
        except Exception as exc:  # noqa: BLE001
            database_ok = False
            database_error = f"{type(exc).__name__}: {exc}"
            logger.exception("Health check could not reach the database")

        return {
            "status": "ok" if database_ok else "degraded",
            "environment": settings.environment,
            "database": {"connected": database_ok, "error": database_error},
            "model": model_metadata() if model_is_available() else None,
        }

    return app


app = create_app()
