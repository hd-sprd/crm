from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from app.config import settings


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    # NullPool is required when using Supabase Supavisor (port 6543, transaction mode).
    # Supavisor is a PgBouncer-compatible proxy: it routes each *transaction* to a
    # potentially different backend PostgreSQL connection, so application-side connection
    # pooling causes DuplicatePreparedStatementError. Supavisor handles pooling on its
    # side — our job is just to open a fresh connection per request.
    poolclass=NullPool,
    connect_args={
        "statement_cache_size": 0,           # required for PgBouncer transaction mode
        "prepared_statement_cache_size": 0,  # required for PgBouncer transaction mode
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
