from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, read from the environment.

    Locally these come from `.env.local`; on Vercel they come from the project's
    Environment Variables. Field names map to upper-case env vars automatically
    (`database_url` <- `DATABASE_URL`).
    """

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = (
        "postgresql+asyncpg://revcloud:revcloud@localhost:5434/revcloud"
    )

    jwt_secret: str = "dev-only-insecure-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 7
    idle_timeout_minutes: int = 30

    seed_admin_email: str = "admin@revcloud.io"
    seed_admin_password: str = "Admin123!"

    password_reset_delivery: str = "console"
    password_reset_ttl_minutes: int = 30
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str = "no-reply@revcloud.io"

    app_base_url: str = "http://localhost:3000"
    environment: str = "development"

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def normalized_database_url(self) -> str:
        """Force the asyncpg driver.

        Managed providers hand out `postgres://` or `postgresql://` URLs, which
        SQLAlchemy would route to psycopg. We only ship asyncpg, so rewrite the
        scheme rather than making the operator remember to.
        """
        url = self.database_url
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://") :]
        if url.startswith("postgresql://"):
            url = "postgresql+asyncpg://" + url[len("postgresql://") :]
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
