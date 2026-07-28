"""SQLAlchemy ORM models for the main controller database.

These models represent the persistence layer and map directly to database tables.
Domain entities and ORM models are separated to maintain clean architecture boundaries.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from hosting_control.main_controller.infrastructure.database import Base


class UserModel(Base):
    """User account model."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="customer",
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    two_factor_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    two_factor_secret: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    api_key: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    api_key_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    websites = relationship("WebsiteModel", back_populates="user", lazy="selectin")
    orders = relationship("OrderModel", back_populates="user", lazy="selectin")


class HostingPlanModel(Base):
    """Hosting plan definition model."""

    __tablename__ = "hosting_plans"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    disk_space_mb: Mapped[int] = mapped_column(Integer, nullable=False, default=10240)
    cpu_limit: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    ram_limit_mb: Mapped[int] = mapped_column(Integer, nullable=False, default=1024)
    swap_mb: Mapped[int] = mapped_column(Integer, nullable=False, default=512)
    bandwidth_mb: Mapped[int] = mapped_column(Integer, nullable=False, default=102400)
    php_version: Mapped[str] = mapped_column(String(10), nullable=False, default="8.3")
    redis_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    woocommerce_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    container_limits: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    cron_job_limits: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    file_limits: Mapped[int] = mapped_column(Integer, nullable=False, default=50000)
    sftp_users: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    backup_retention_days: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
    ssl_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    price: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    setup_fee: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    billing_cycle: Mapped[str] = mapped_column(String(20), nullable=False, default="monthly")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    websites = relationship("WebsiteModel", back_populates="plan", lazy="selectin")


class NodeModel(Base):
    """Remote node/server model."""

    __tablename__ = "nodes"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    host: Mapped[str] = mapped_column(String(255), nullable=False)
    port: Mapped[int] = mapped_column(Integer, nullable=False, default=8080)
    ssh_port: Mapped[int] = mapped_column(Integer, nullable=False, default=22)
    docker_host: Mapped[str] = mapped_column(String(255), nullable=False)
    api_token: Mapped[str] = mapped_column(String(512), nullable=False)
    api_token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="active",
        index=True,
    )
    cpu_cores: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    cpu_frequency_ghz: Mapped[float] = mapped_column(Float, nullable=False, default=2.5)
    ram_total_mb: Mapped[int] = mapped_column(Integer, nullable=False, default=16384)
    disk_total_mb: Mapped[int] = mapped_column(Integer, nullable=False, default=512000)
    bandwidth_total_mb: Mapped[int] = mapped_column(Integer, nullable=False, default=1048576)
    current_cpu_usage: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    current_ram_usage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    current_disk_usage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    current_bandwidth_usage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    load_average_1m: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    load_average_5m: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    load_average_15m: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    container_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    website_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_healthy: Mapped[bool] = mapped_column(Boolean, default=True)
    last_heartbeat: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    region: Mapped[str] = mapped_column(String(50), nullable=False, default="default")
    labels: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string of labels
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    websites = relationship("WebsiteModel", back_populates="node", lazy="selectin")


class WebsiteModel(Base):
    """Website instance model."""

    __tablename__ = "websites"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    plan_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("hosting_plans.id", ondelete="RESTRICT"),
        nullable=False,
    )
    node_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("nodes.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    domain: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    directory: Mapped[str] = mapped_column(String(255), nullable=False)
    docker_network: Mapped[str] = mapped_column(String(100), nullable=False)
    docker_compose_path: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    mysql_database: Mapped[str] = mapped_column(String(100), nullable=False)
    mysql_user: Mapped[str] = mapped_column(String(100), nullable=False)
    mysql_password_encrypted: Mapped[str] = mapped_column(String(512), nullable=False)
    mysql_host: Mapped[str] = mapped_column(String(100), nullable=False)
    mysql_port: Mapped[int] = mapped_column(Integer, nullable=False, default=3306)
    redis_host: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    redis_port: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    redis_password_encrypted: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    wp_admin_user: Mapped[str] = mapped_column(String(100), nullable=False)
    wp_admin_password_encrypted: Mapped[str] = mapped_column(String(512), nullable=False)
    wp_admin_email: Mapped[str] = mapped_column(String(255), nullable=False)
    wp_secret_keys_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    php_version: Mapped[str] = mapped_column(String(10), nullable=False, default="8.3")
    ssl_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="none",
    )
    ssl_certificate_expiry: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="creating",
        index=True,
    )
    disk_usage_mb: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ram_usage_mb: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cpu_usage: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    bandwidth_usage_mb: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    disk_quota_mb: Mapped[int] = mapped_column(Integer, nullable=False, default=10240)
    docker_container_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    docker_image: Mapped[str] = mapped_column(String(255), nullable=False)
    traefik_router_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    order_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("orders.id", ondelete="SET NULL"),
        nullable=True,
    )
    installed_plugins: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    installed_theme: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    woocommerce_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    redis_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_backup_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_backup_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    suspended_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    suspended_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    user = relationship("UserModel", back_populates="websites")
    plan = relationship("HostingPlanModel", back_populates="websites")
    node = relationship("NodeModel", back_populates="websites")
    order = relationship("OrderModel", back_populates="website", uselist=False)
    backups = relationship("BackupModel", back_populates="website", lazy="selectin")


class OrderModel(Base):
    """Order/purchase model."""

    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    plan_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("hosting_plans.id", ondelete="RESTRICT"),
        nullable=True,
    )
    website_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("websites.id", ondelete="SET NULL"),
        nullable=True,
    )
    order_number: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
        index=True,
    )
    total_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    discount_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    coupon_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    billing_cycle: Mapped[str] = mapped_column(String(20), nullable=False, default="monthly")
    next_billing_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    user = relationship("UserModel", back_populates="orders")
    website = relationship("WebsiteModel", back_populates="order", uselist=False)


class BackupModel(Base):
    """Website backup model."""

    __tablename__ = "backups"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    website_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("websites.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="full",
    )  # full, database, files
    size_mb: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    path: Mapped[str] = mapped_column(String(512), nullable=False)
    storage_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="local",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
    )
    checksum: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_automated: Mapped[bool] = mapped_column(Boolean, default=False)
    retention_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    # Relationships
    website = relationship("WebsiteModel", back_populates="backups")


class AuditLogModel(Base):
    """Audit log for tracking all administrative actions."""

    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="success")
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )