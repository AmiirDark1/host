"""Application configuration management using Pydantic Settings.

All configuration is managed through environment variables and .env files,
following the 12-factor app methodology.
"""

from __future__ import annotations

from enum import Enum
from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(str, Enum):
    """Deployment environment."""

    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class LogLevel(str, Enum):
    """Logging level."""

    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class StorageProvider(str, Enum):
    """Storage provider type."""

    LOCAL = "local"
    MINIO = "minio"
    S3 = "s3"


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    All sensitive values should be set via environment variables or .env file.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "Hosting Control Panel"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: Environment = Environment.DEVELOPMENT
    DEBUG: bool = False
    LOG_LEVEL: LogLevel = LogLevel.INFO
    API_PREFIX: str = "/api/v1"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 4
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # Database - PostgreSQL
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/hosting_control"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 40
    DATABASE_ECHO: bool = False

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_PASSWORD: Optional[str] = None

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    CELERY_TASK_TRACK_STARTED: bool = True
    CELERY_TASK_SERIALIZER: str = "json"
    CELERY_RESULT_SERIALIZER: str = "json"
    CELERY_ACCEPT_CONTENT: list[str] = ["json"]

    # JWT
    JWT_SECRET_KEY: str = "change-me-in-production-use-a-strong-random-key"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Encryption
    ENCRYPTION_KEY: str = "change-me-in-production-use-a-strong-encryption-key-32bytes"

    # Security
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW_SECONDS: int = 60
    MAX_LOGIN_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 15
    TWO_FACTOR_REQUIRED: bool = False

    # Storage
    STORAGE_PROVIDER: StorageProvider = StorageProvider.LOCAL
    STORAGE_LOCAL_PATH: str = "/data/storage"
    STORAGE_S3_BUCKET: Optional[str] = None
    STORAGE_S3_REGION: Optional[str] = None
    STORAGE_S3_ACCESS_KEY: Optional[str] = None
    STORAGE_S3_SECRET_KEY: Optional[str] = None
    STORAGE_MINIO_ENDPOINT: Optional[str] = None
    STORAGE_MINIO_ACCESS_KEY: Optional[str] = None
    STORAGE_MINIO_SECRET_KEY: Optional[str] = None

    # Backup
    BACKUP_LOCAL_PATH: str = "/data/backups"
    BACKUP_RETENTION_DAYS: int = 30
    BACKUP_SCHEDULE: str = "0 3 * * *"  # Daily at 3 AM

    # Monitoring
    MONITORING_ENABLED: bool = True
    MONITORING_INTERVAL_SECONDS: int = 30
    MONITORING_ALERT_CPU_THRESHOLD: float = 90.0
    MONITORING_ALERT_RAM_THRESHOLD: float = 90.0
    MONITORING_ALERT_DISK_THRESHOLD: float = 85.0
    MONITORING_ALERT_EMAIL: Optional[str] = None

    # Node Agent
    NODE_HEARTBEAT_INTERVAL: int = 30
    NODE_HEARTBEAT_TIMEOUT: int = 120
    NODE_SSH_TIMEOUT: int = 30
    NODE_DOCKER_TIMEOUT: int = 60

    # Hosting
    HOSTING_BASE_PATH: str = "/hosting"
    HOSTING_DEFAULT_PHP_VERSION: str = "8.3"
    HOSTING_DEFAULT_MYSQL_VERSION: str = "8.0"
    HOSTING_DEFAULT_REDIS_VERSION: str = "7.2"
    HOSTING_DOCKER_NETWORK_DRIVER: str = "bridge"

    # SSL
    SSL_EMAIL: str = "admin@example.com"
    SSL_RENEW_BEFORE_DAYS: int = 30

    # Sentry
    SENTRY_DSN: Optional[str] = None
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1

    # OpenTelemetry
    OTLP_ENDPOINT: Optional[str] = None
    OTLP_SERVICE_NAME: str = "hosting-control-panel"


@lru_cache()
def get_settings() -> Settings:
    """Get cached application settings.

    Uses LRU cache to avoid re-reading .env file on every call.
    """
    return Settings()