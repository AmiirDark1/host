"""Database engine, session factory, and base model configuration."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator, AsyncIterator

from sqlalchemy import NullPool
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import Pool

from hosting_control.shared.config import get_settings


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""

    pass


def create_engine() -> object:
    """Create the SQLAlchemy async engine."""
    settings = get_settings()

    engine_kwargs = {
        "pool_size": settings.DATABASE_POOL_SIZE,
        "max_overflow": settings.DATABASE_MAX_OVERFLOW,
        "pool_pre_ping": True,
        "echo": settings.DATABASE_ECHO,
    }

    # Use NullPool for serverless/connection-less environments
    if settings.ENVIRONMENT == "development":
        engine_kwargs["poolclass"] = None  # Default pool

    engine = create_async_engine(
        settings.DATABASE_URL,
        **engine_kwargs,
    )
    return engine


def create_session_factory(engine) -> async_sessionmaker[AsyncSession]:
    """Create an async session factory."""
    return async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


# Global engine and session factory
engine = create_engine()
SessionFactory = create_session_factory(engine)


@asynccontextmanager
async def get_session() -> AsyncIterator[AsyncSession]:
    """Get a database session as an async context manager."""
    async with SessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that provides a database session."""
    async with SessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_database() -> None:
    """Initialize the database by creating all tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_database() -> None:
    """Close the database engine."""
    await engine.dispose()