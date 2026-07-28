"""Hosting (Website) management API endpoints.

Handles website lifecycle: create, manage, backup, restore, and monitor.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator

from hosting_control.main_controller.api.auth import get_current_user
from hosting_control.main_controller.domain.entities import (
    Backup,
    BackupStatus,
    BackupType,
    OrderStatus,
    SSLStatus,
    User,
    UserRole,
    Website,
    WebsiteStatus,
)
from hosting_control.main_controller.infrastructure.database import get_db_session
from hosting_control.main_controller.infrastructure.repositories import (
    UnitOfWorkImpl,
)
from hosting_control.main_controller.core.celery_app import celery_app

router = APIRouter()


# ---- Request/Response Models ----

class CreateWebsiteRequest(BaseModel):
    """Request to create a new website."""

    plan_id: str
    domain: str
    wp_admin_email: str
    wp_admin_user: Optional[str] = None
    php_version: Optional[str] = "8.2"
    install_woocommerce: bool = False
    install_plugins: list[str] = []
    install_theme: Optional[str] = None


class WebsiteResponse(BaseModel):
    """Public website response."""

    id: str
    user_id: str
    plan_id: str
    node_id: Optional[str] = None
    domain: str
    directory: str
    status: str
    php_version: str
    ssl_status: str
    disk_usage_mb: int
    ram_usage_mb: int
    cpu_usage: float
    bandwidth_usage_mb: int
    disk_quota_mb: int
    woocommerce_enabled: bool
    redis_enabled: bool
    auto_backup_enabled: bool
    installed_plugins: list[str]
    installed_theme: Optional[str] = None
    last_backup_at: Optional[datetime] = None
    created_at: datetime

    @classmethod
    def from_entity(cls, website: Website) -> "WebsiteResponse":
        return cls(
            id=website.id,
            user_id=website.user_id,
            plan_id=website.plan_id,
            node_id=website.node_id,
            domain=website.domain,
            directory=website.directory,
            status=website.status.value,
            php_version=website.php_version,
            ssl_status=website.ssl_status.value,
            disk_usage_mb=website.disk_usage_mb,
            ram_usage_mb=website.ram_usage_mb,
            cpu_usage=website.cpu_usage,
            bandwidth_usage_mb=website.bandwidth_usage_mb,
            disk_quota_mb=website.disk_quota_mb,
            woocommerce_enabled=website.woocommerce_enabled,
            redis_enabled=website.redis_enabled,
            auto_backup_enabled=website.auto_backup_enabled,
            installed_plugins=website.installed_plugins or [],
            installed_theme=website.installed_theme,
            last_backup_at=website.last_backup_at,
            created_at=website.created_at,
        )


class WebsiteDetailResponse(WebsiteResponse):
    """Detailed website response with connection info."""

    mysql_database: str
    mysql_user: str
    mysql_host: str
    mysql_port: int
    redis_host: Optional[str] = None
    redis_port: Optional[int] = None
    wp_admin_user: str
    docker_container_id: Optional[str] = None
    docker_image: Optional[str] = None
    traefik_router_name: Optional[str] = None


class BackupResponse(BaseModel):
    """Backup information response."""

    id: str
    website_id: str
    name: str
    type: str
    size_mb: int
    status: str
    is_automated: bool
    retention_until: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    @classmethod
    def from_entity(cls, backup: Backup) -> "BackupResponse":
        return cls(
            id=backup.id,
            website_id=backup.website_id,
            name=backup.name,
            type=backup.type.value,
            size_mb=backup.size_mb,
            status=backup.status.value,
            is_automated=backup.is_automated,
            retention_until=backup.retention_until,
            completed_at=backup.completed_at,
            created_at=backup.created_at,
        )


class CronJobRequest(BaseModel):
    """Cron job creation request."""

    command: str = Field(..., min_length=1, max_length=1000)
    schedule: str = Field(..., description="Cron schedule expression")
    enabled: bool = True


class CronJobResponse(BaseModel):
    """Cron job information."""

    id: str
    website_id: str
    command: str
    schedule: str
    enabled: bool
    last_run: Optional[datetime] = None
    last_output: Optional[str] = None
    created_at: datetime


class SSLInfoResponse(BaseModel):
    """SSL certificate information."""

    domain: str
    status: str
    certificate_expiry: Optional[datetime] = None
    issuer: Optional[str] = None
    auto_renew: bool = True


class PHPConfigResponse(BaseModel):
    """PHP configuration."""

    version: str
    memory_limit: str
    max_execution_time: int
    max_input_time: int
    max_input_vars: int
    post_max_size: str
    upload_max_filesize: str
    opcache_enabled: bool
    error_reporting: str


class ResourceUsage(BaseModel):
    """Current resource usage."""

    disk_usage_mb: int
    disk_quota_mb: int
    disk_usage_percent: float
    ram_usage_mb: int
    cpu_usage_percent: float
    bandwidth_usage_mb: int
    bandwidth_limit_mb: Optional[int] = None


# ---- Endpoints ----

@router.get("/websites", response_model=list[WebsiteResponse])
async def list_websites(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db_session),
) -> list[WebsiteResponse]:
    """List websites for the current user."""
    uow = UnitOfWorkImpl(db)

    filters: dict[str, Any] = {}
    if current_user.role != UserRole.ADMIN:
        filters["user_id"] = current_user.id
    if status:
        filters["status"] = status

    websites, _ = await uow.websites.list(skip=skip, limit=limit, **filters)
    return [WebsiteResponse.from_entity(w) for w in websites]


@router.post("/websites", response_model=WebsiteResponse, status_code=201)
async def create_website(
    request: CreateWebsiteRequest,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db_session),
) -> WebsiteResponse:
    """Create a new website (dispatches async provisioning)."""
    uow = UnitOfWorkImpl(db)

    # Verify plan exists and is active
    plan = await uow.plans.get_by_id(request.plan_id)
    if not plan or not plan.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found or inactive",
        )

    # Check domain availability
    existing = await uow.websites.get_by_domain(request.domain)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Domain already in use",
        )

    # Find best node
    node = await uow.nodes.find_best_node(required_disk_mb=plan.disk_space_mb)
    if not node:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No available nodes with sufficient resources",
        )

    # Generate unique IDs
    website_id = str(uuid.uuid4())
    directory = f"/hosting/website-{website_id[:8]}"
    docker_network = f"net-{website_id[:8]}"

    # Create website entity
    website = Website(
        id=website_id,
        user_id=current_user.id,
        plan_id=plan.id,
        node_id=node.id,
        domain=request.domain,
        directory=directory,
        docker_network=docker_network,
        php_version=request.php_version or plan.php_version,
        ssl_status=SSLStatus.PENDING if plan.ssl_enabled else SSLStatus.DISABLED,
        status=WebsiteStatus.CREATING,
        disk_quota_mb=plan.disk_space_mb,
        woocommerce_enabled=request.install_woocommerce or plan.woocommerce_enabled,
        redis_enabled=plan.redis_enabled,
        wp_admin_user=request.wp_admin_user or "admin",
        wp_admin_email=request.wp_admin_email,
        installed_plugins=request.install_plugins,
        installed_theme=request.install_theme,
    )

    await uow.websites.save(website)

    # Create order
    from hosting_control.main_controller.domain.entities import Order, OrderStatus, BillingCycle

    order = Order(
        user_id=current_user.id,
        plan_id=plan.id,
        website_id=website_id,
        status=OrderStatus.PENDING,
        total_amount=plan.price + plan.setup_fee,
        billing_cycle=BillingCycle.MONTHLY,
    )
    await uow.orders.save(order)

    await uow.commit()

    # Dispatch async provisioning task
    celery_app.send_task(
        "provision_website",
        args=[website_id, order.id],
        queue="provisioning",
    )

    return WebsiteResponse.from_entity(website)


@router.get("/websites/{website_id}", response_model=WebsiteDetailResponse)
async def get_website(
    website_id: str,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db_session),
) -> WebsiteDetailResponse:
    """Get detailed website information."""
    uow = UnitOfWorkImpl(db)
    website = await uow.websites.get_by_id(website_id)

    if not website:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Website not found",
        )

    if current_user.role != UserRole.ADMIN and website.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    return WebsiteDetailResponse(
        id=website.id,
        user_id=website.user_id,
        plan_id=website.plan_id,
        node_id=website.node_id,
        domain=website.domain,
        directory=website.directory,
        status=website.status.value,
        php_version=website.php_version,
        ssl_status=website.ssl_status.value,
        disk_usage_mb=website.disk_usage_mb,
        ram_usage_mb=website.ram_usage_mb,
        cpu_usage=website.cpu_usage,
        bandwidth_usage_mb=website.bandwidth_usage_mb,
        disk_quota_mb=website.disk_quota_mb,
        woocommerce_enabled=website.woocommerce_enabled,
        redis_enabled=website.redis_enabled,
        auto_backup_enabled=website.auto_backup_enabled,
        installed_plugins=website.installed_plugins or [],
        installed_theme=website.installed_theme,
        last_backup_at=website.last_backup_at,
        created_at=website.created_at,
        mysql_database=website.mysql_database,
        mysql_user=website.mysql_user,
        mysql_host=website.mysql_host or "localhost",
        mysql_port=website.mysql_port or 3306,
        redis_host=website.redis_host,
        redis_port=website.redis_port,
        wp_admin_user=website.wp_admin_user,
        docker_container_id=website.docker_container_id,
        docker_image=website.docker_image,
        traefik_router_name=website.traefik_router_name,
    )


@router.post("/websites/{website_id}/restart")
async def restart_website(
    website_id: str,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db_session),
) -> dict[str, str]:
    """Restart a website's containers."""
    uow = UnitOfWorkImpl(db)
    website = await _get_website_for_user(uow, website_id, current_user)

    if website.status == WebsiteStatus.CREATING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot restart website during creation",
        )

    celery_app.send_task(
        "restart_website_containers",
        args=[website_id],
        queue="provisioning",
    )

    return {"message": "Website restart initiated"}


@router.post("/websites/{website_id}/start")
async def start_website(
    website_id: str,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db_session),
) -> dict[str, str]:
    """Start a website's containers."""
    uow = UnitOfWorkImpl(db)
    website = await _get_website_for_user(uow, website_id, current_user)

    celery_app.send_task(
        "start_website_containers",
        args=[website_id],
        queue="provisioning",
    )

    return {"message": "Website start initiated"}


@router.post("/websites/{website_id}/stop")
async def stop_website(
    website_id: str,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db_session),
) -> dict[str, str]:
    """Stop a website's containers."""
    uow = UnitOfWorkImpl(db)
    website = await _get_website_for_user(uow, website_id, current_user)

    celery_app.send_task(
        "stop_website_containers",
        args=[website_id],
        queue="provisioning",
    )

    return {"message": "Website stop initiated"}


@router.delete("/websites/{website_id}")
async def delete_website(
    website_id: str,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db_session),
) -> dict[str, str]:
    """Delete a website and all its resources."""
    uow = UnitOfWorkImpl(db)
    website = await _get_website_for_user(uow, website_id, current_user)

    website.status = WebsiteStatus.DELETING
    await uow.websites.save(website)
    await uow.commit()

    celery_app.send_task(
        "delete_website",
        args=[website_id],
        queue="provisioning",
    )

    return {"message": "Website deletion initiated"}


# ---- Backup Endpoints ----

@router.get("/websites/{website_id}/backups", response_model=list[BackupResponse])
async def list_backups(
    website_id: str,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db_session),
) -> list[BackupResponse]:
    """List backups for a website."""
    uow = UnitOfWorkImpl(db)
    await _get_website_for_user(uow, website_id, current_user)

    backups, _ = await uow.backups.list(website_id=website_id)
    return [BackupResponse.from_entity(b) for b in backups]


@router.post("/websites/{website_id}/backups", status_code=201)
async def create_backup(
    website_id: str,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db_session),
) -> dict[str, str]:
    """Create a manual backup of a website."""
    uow = UnitOfWorkImpl(db)
    await _get_website_for_user(uow, website_id, current_user)

    backup = Backup(
        website_id=website_id,
        name=f"manual-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}",
        type=BackupType.MANUAL,
        status=BackupStatus.CREATING,
    )

    await uow.backups.save(backup)
    await uow.commit()

    celery_app.send_task(
        "create_website_backup",
        args=[backup.id],
        queue="backup",
    )

    return {"message": "Backup initiated", "backup_id": backup.id}


@router.post("/backups/{backup_id}/restore")
async def restore_backup(
    backup_id: str,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db_session),
) -> dict[str, str]:
    """Restore a website from a backup."""
    uow = UnitOfWorkImpl(db)
    backup = await uow.backups.get_by_id(backup_id)

    if not backup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup not found",
        )

    # Verify user owns the website
    await _get_website_for_user(uow, backup.website_id, current_user)

    backup.status = BackupStatus.RESTORING
    await uow.backups.save(backup)
    await uow.commit()

    celery_app.send_task(
        "restore_website_backup",
        args=[backup_id],
        queue="backup",
    )

    return {"message": "Restore initiated"}


# ---- Resource Usage ----

@router.get("/websites/{website_id}/resources", response_model=ResourceUsage)
async def get_resource_usage(
    website_id: str,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db_session),
) -> ResourceUsage:
    """Get current resource usage for a website."""
    uow = UnitOfWorkImpl(db)
    website = await _get_website_for_user(uow, website_id, current_user)

    disk_percent = 0
    if website.disk_quota_mb > 0:
        disk_percent = round(
            (website.disk_usage_mb / website.disk_quota_mb) * 100, 2
        )

    return ResourceUsage(
        disk_usage_mb=website.disk_usage_mb,
        disk_quota_mb=website.disk_quota_mb,
        disk_usage_percent=disk_percent,
        ram_usage_mb=website.ram_usage_mb,
        cpu_usage_percent=website.cpu_usage,
        bandwidth_usage_mb=website.bandwidth_usage_mb,
    )


# ---- Helper Functions ----

async def _get_website_for_user(
    uow: UnitOfWorkImpl,
    website_id: str,
    user: User,
) -> Website:
    """Get a website and verify user has access."""
    website = await uow.websites.get_by_id(website_id)

    if not website:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Website not found",
        )

    if user.role != UserRole.ADMIN and website.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    return website