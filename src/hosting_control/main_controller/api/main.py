"""Main FastAPI application entry point for the Hosting Control Panel."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from hosting_control.main_controller.api.auth import router as auth_router
from hosting_control.main_controller.api.hosting import router as hosting_router
from hosting_control.main_controller.api.admin import router as admin_router
from hosting_control.main_controller.api.monitoring import router as monitoring_router
from hosting_control.main_controller.api.terminal import router as terminal_router
from hosting_control.main_controller.api.terminal import terminal_manager
from hosting_control.main_controller.core.redis_client import RedisClient
from hosting_control.main_controller.infrastructure.database import (
    close_database,
    init_database,
)
from hosting_control.shared.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    await init_database()
    
    redis_client = RedisClient()
    await redis_client.initialize()
    app.state.redis = redis_client
    
    # Start terminal cleanup task
    await terminal_manager.start_cleanup_task()
    
    yield
    
    # Shutdown
    await close_database()
    await redis_client.close()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Distributed WordPress Hosting Control Panel API",
    docs_url=f"{settings.API_PREFIX}/docs",
    redoc_url=f"{settings.API_PREFIX}/redoc",
    openapi_url=f"{settings.API_PREFIX}/openapi.json",
    lifespan=lifespan,
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"],
)

# Include routers
app.include_router(auth_router, prefix=f"{settings.API_PREFIX}/auth", tags=["Authentication"])
app.include_router(hosting_router, prefix=f"{settings.API_PREFIX}/hosting", tags=["Hosting"])
app.include_router(admin_router, prefix=f"{settings.API_PREFIX}/admin", tags=["Admin"])
app.include_router(monitoring_router, prefix=f"{settings.API_PREFIX}/monitoring", tags=["Monitoring"])
app.include_router(terminal_router, prefix=f"{settings.API_PREFIX}/terminal", tags=["Terminal"])


@app.get(f"{settings.API_PREFIX}/health")
async def health_check() -> dict[str, object]:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "hosting_control.main_controller.api.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.ENVIRONMENT == "development",
        workers=settings.WORKERS,
    )