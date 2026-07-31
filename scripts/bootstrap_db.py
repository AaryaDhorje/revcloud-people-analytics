"""Create the schema, seed demo accounts, and load the starter dataset.

    python -m scripts.bootstrap_db              # create + seed + ingest CSV
    python -m scripts.bootstrap_db --reset      # drop everything first
    python -m scripts.bootstrap_db --no-ingest  # schema and users only

Safe to re-run: users are upserted by email and the ingest fully replaces the
employee table.
"""

from __future__ import annotations

import argparse
import asyncio
from pathlib import Path

from sqlalchemy import select

from backend.config import settings
from backend.db import SessionLocal, engine
from backend.etl.pipeline import run_ingest
from backend.models import Base, User
from backend.security import hash_password

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CSV = ROOT / "data" / "WA_Fn-UseC_-HR-Employee-Attrition.csv"

# Seeded so the three RBAC roles can be demonstrated immediately.
# The manager is deliberately scoped to R&D — logging in as them should show a
# visibly smaller dataset than the admin sees.
DEMO_USERS = [
    {
        "email": settings.seed_admin_email,
        "password": settings.seed_admin_password,
        "full_name": "Avery Chen",
        "role": "admin",
        "department": None,
    },
    {
        "email": "manager@revcloud.io",
        "password": "Manager123!",
        "full_name": "Priya Raman",
        "role": "manager",
        "department": "Research & Development",
    },
    {
        "email": "viewer@revcloud.io",
        "password": "Viewer123!",
        "full_name": "Sam Okafor",
        "role": "viewer",
        "department": None,
    },
]


async def create_schema(reset: bool) -> None:
    async with engine.begin() as conn:
        if reset:
            await conn.run_sync(Base.metadata.drop_all)
            print("Dropped existing tables.")
        await conn.run_sync(Base.metadata.create_all)
    print("Schema is up to date.")


async def seed_users() -> None:
    async with SessionLocal() as session:
        for spec in DEMO_USERS:
            existing = await session.scalar(
                select(User).where(User.email == spec["email"])
            )
            if existing:
                existing.full_name = spec["full_name"]
                existing.role = spec["role"]
                existing.department = spec["department"]
                existing.is_active = True
                existing.password_hash = hash_password(spec["password"])
                action = "updated"
            else:
                session.add(
                    User(
                        email=spec["email"],
                        password_hash=hash_password(spec["password"]),
                        full_name=spec["full_name"],
                        role=spec["role"],
                        department=spec["department"],
                    )
                )
                action = "created"
            scope = spec["department"] or "company-wide"
            print(f"  {action:8} {spec['email']:<24} {spec['role']:<8} ({scope})")
        await session.commit()


async def ingest_csv(csv_path: Path) -> None:
    if not csv_path.exists():
        print(f"! Dataset not found at {csv_path} — skipping ingest.")
        return

    payload = csv_path.read_bytes()
    async with SessionLocal() as session:
        admin = await session.scalar(
            select(User).where(User.email == settings.seed_admin_email)
        )
        run = await run_ingest(
            session,
            payload=payload,
            filename=csv_path.name,
            actor_user_id=admin.id if admin else None,
        )
        await session.commit()

        print(f"\nIngest #{run.id}: {run.status}")
        print(f"  rows received : {run.rows_received}")
        print(f"  rows loaded   : {run.rows_loaded}")
        print(f"  rows rejected : {run.rows_rejected}")
        if run.error:
            print(f"  ERROR         : {run.error}")
        for warning in run.warnings or []:
            print(f"  note          : {warning}")


async def main_async(args: argparse.Namespace) -> int:
    print(f"Database: {settings.normalized_database_url.split('@')[-1]}")
    await create_schema(reset=args.reset)
    print("\nSeeding accounts:")
    await seed_users()
    if not args.no_ingest:
        await ingest_csv(args.csv)
    await engine.dispose()
    print("\nDone.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true", help="drop all tables first")
    parser.add_argument("--no-ingest", action="store_true", help="skip loading the CSV")
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    args = parser.parse_args()
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    raise SystemExit(main())
