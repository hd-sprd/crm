from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from app.config import settings


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    poolclass=NullPool,
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
        "server_settings": {
            "statement_timeout": "10000", # Optional: Verhindert hängende Queries (10s)
        }
    }
)

@event.listens_for(engine.sync_engine, "connect")
def on_connect(dbapi_connection, connection_record):
    # Sicherstellen, dass es wirklich eine asyncpg-Connection ist (wegen dbapi)
    if hasattr(dbapi_connection, '_connection'):
        # Zugriff auf das eigentliche asyncpg Connection-Objekt
        asyncpg_conn = dbapi_connection._connection
        # Überschreibe die Cache-Größen hart
        asyncpg_conn._statement_cache_size = 0
        asyncpg_conn._prepared_statement_cache_size = 0

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
