import json
import os

import asyncpg

_pool: asyncpg.Pool | None = None


async def init():
    global _pool
    _pool = await asyncpg.create_pool(
        dsn=os.environ["DATABASE_URL"],
        min_size=2,
        max_size=10,
    )
    async with _pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                session_id  TEXT PRIMARY KEY,
                state       JSONB NOT NULL DEFAULT '{}',
                pdf_bytes   BYTEA,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)


async def close():
    if _pool:
        await _pool.close()


async def load_session(session_id: str) -> dict | None:
    async with _pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT state FROM sessions WHERE session_id = $1", session_id
        )
    if row is None:
        return None
    return json.loads(row["state"])


async def save_session(session_id: str, state: dict) -> None:
    async with _pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO sessions (session_id, state)
            VALUES ($1, $2::jsonb)
            ON CONFLICT (session_id) DO UPDATE
                SET state = EXCLUDED.state,
                    updated_at = NOW()
            """,
            session_id,
            json.dumps(state, default=str),
        )


async def save_pdf(session_id: str, pdf_bytes: bytes) -> None:
    async with _pool.acquire() as conn:
        await conn.execute(
            "UPDATE sessions SET pdf_bytes = $1, updated_at = NOW() WHERE session_id = $2",
            pdf_bytes,
            session_id,
        )


async def load_pdf(session_id: str) -> bytes | None:
    async with _pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT pdf_bytes FROM sessions WHERE session_id = $1", session_id
        )
    if row is None:
        return None
    return row["pdf_bytes"]
