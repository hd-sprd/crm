from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import settings


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    # Small pool — Vercel function instances are persistent within their lifetime,
    # so reusing connections saves 100–400 ms per request.
    # Supabase Supavisor (port 6543) pools on its side; we pool on ours too.
    pool_size=3,
    max_overflow=5,
    pool_recycle=300,       # recycle connections every 5 min to avoid stale TCP
    pool_pre_ping=True,     # check connection health before use
    pool_timeout=10,        # fail fast if no connection available within 10 s
    connect_args={
        # Required for Supabase Supavisor in transaction mode (PgBouncer-compatible)
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
        "command_timeout": 30,
    }
)


AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
