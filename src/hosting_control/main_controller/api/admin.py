"""Admin panel API endpoints for managing the hosting platform.

Covers: users, plans, nodes, orders, system settings, and monitoring.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field, field_validator

from hosting_control.main_controller.api.auth import get_current_admin
from hosting_control.main_controller.domain.entities import (
    BillingCycle,
    HostingPlan,
    Node,
    NodeStatus,
    User,
    UserRole,
)
from hosting_control.main_controller.infrastructure.database import get_db_session
from hosting_control.main_controller.infrastructure.repositories import (
    UnitOfWorkImpl,
)

router = APIRouter()


# ---- Plan Management ----

class PlanCreateRequest(BaseModel):
    """Request to create a hosting plan."""

    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    disk_space_mb: int = Field(..., ge=100, le=10_000_000)
    cpu_limit: float = Field(..., ge=0.1, le=100.0)
    ram_limit_mb: int = Field(..., ge=128, le=1_000_000)
    swap_mb: int = Field(default=0, ge=0, le=1_000_000)
    bandwidth_mb: int = Field(..., ge=100, le=1_000_000_000)
    php_version: str = Field(default="8.2")
    redis_enabled: bool = False
    woocommerce_enabled: bool = False
    container_limits: int = Field(default=5, ge=1, le=100)
    cron_job_limits: int = Field(default=10, ge=0, le=1000)
    file_limits: int = Field(default=50000, ge=100, le=10_000_000)
    sftp_users: int = Field(default=1, ge=0, le=100)
    backup_retention_days: int = Field(default=7, ge=0, le=365)
    ssl_enabled: bool = True
    price: float = Field(default=0, ge=0)
    setup_fee: float = Field(default=0, ge=0)
    billing_cycle: str = Field(default="monthly")


class PlanUpdateRequest(BaseModel):
    """Request to update a hosting plan."""

    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    disk_space_mb: Optional[int] = Field(None, ge=100, le=10_000_000)
    cpu_limit: Optional[float] = Field(None, ge=0.1, le=100.0)
    ram_limit_mb: Optional[int] = Field(None, ge=128, le=1_000_000)
    swap_mb: Optional[int] = Field(None, ge=0, le=1_000_000)
    bandwidth_mb: Optional[int] = Field(None, ge=100, le=1_000_000_000)
    php_version: Optional[str] = None
    redis_enabled: Optional[bool] = None
    woocommerce_enabled: Optional[bool] = None
    container_limits: Optional[int] = Field(None, ge=1, le=100)
    cron_job_limits: Optional[int] = Field(None, ge=0, le=1000)
    file_limits: Optional[int] = Field(None, ge=100, le=10_000_000)
    sftp_users: Optional[int] = Field(None, ge=0, le=100)
    backup_retention_days: Optional[int] = Field(None, ge=0, le=365)
    ssl_enabled: Optional[bool] = None
    price: Optional[float] = Field(None, ge=0)
    setup_fee: Optional[float] = Field(None, ge=0)
    billing_cycle: Optional[str] = None
    is_active: Optional[bool] = None


class PlanResponse(BaseModel):
    """Hosting plan response."""

    id: str
    name: str
    description: Optional[str] = None
    disk_space_mb: int
    cpu_limit: float
    ram_limit_mb: int
    swap_mb: int
    bandwidth_mb: int
    php_version: str
    redis_enabled: bool
    woocommerce_enabled: bool
    container_limits: int
    cron_job_limits: int
    file_limits: int
    sftp_users: int
    backup_retention_days: int
    ssl_enabled: bool
    price: float
    setup_fee: float
    billing_cycle: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_entity(cls, plan: HostingPlan) -> "PlanResponse":
        return cls(
            id=plan.id,
            name=plan.name,
            description=plan.description,
            disk_space_mb=plan.disk_space_mb,
            cpu_limit=plan.cpu_limit,
            ram_limit_mb=plan.ram_limit_mb,
            swap_mb=plan.swap_mb,
            bandwidth_mb=plan.bandwidth_mb,
            php_version=plan.php_version,
            redis_enabled=plan.redis_enabled,
            woocommerce_enabled=plan.woocommerce_enabled,
            container_limits=plan.container_limits,
            cron_job_limits=plan.cron_job_limits,
            file_limits=plan.file_limits,
            sftp_users=plan.sftp_users,
            backup_retention_days=plan.backup_retention_days,
            ssl_enabled=plan.ssl_enabled,
            price=plan.price,
            setup_fee=plan.setup_fee,
            billing_cycle=plan.billing_cycle.value,
            is_active=plan.is_active,
            created_at=plan.created_at,
            updated_at=plan.updated_at,
        )


# ---- Node Management ----

class NodeCreateRequest(BaseModel):
    """Request to add a new node."""

    name: str = Field(..., min_length=2, max_length=100)
    host: str = Field(..., max_length=255)
    port: int = Field(default=443, ge=1, le=65535)
    ssh_port: int = Field(default=22, ge=1, le=65535)
    docker_host: str = Field(default="unix:///var/run/docker.sock")
    api_token: str = Field(..., min_length=32)
    region: Optional[str] = None
    labels: dict[str, str] = {}


class NodeResponse(BaseModel):
    """Node information response."""

    id: str
    name: str
    host: str
    port: int
    ssh_port: int
    status: str
    cpu_cores: int
    ram_total_mb: int
    disk_total_mb: int
    current_cpu_usage: float
    current_ram_usage: int
    current_disk_usage: int
    container_count: int
    website_count: int
    is_healthy: bool
    last_heartbeat: Optional[datetime] = None
    region: Optional[str] = None
    labels: dict[str, str] = {}
    created_at: datetime

    @classmethod
    def from_entity(cls, node: Node) -> "NodeResponse":
        return cls(
            id=node.id,
            name=node.name,
            host=node.host,
            port=node.port,
            ssh_port=node.ssh_port,
            status=node.status.value,
            cpu_cores=node.cpu_cores,
            ram_total_mb=node.ram_total_mb,
            disk_total_mb=node.disk_total_mb,
            current_cpu_usage=node.current_cpu_usage,
            current_ram_usage=node.current_ram_usage,
            current_disk_usage=node.current_disk_usage,
            container_count=node.container_count,
            website_count=node.website_count,
            is_healthy=node.is_healthy,
            last_heartbeat=node.last_heartbeat,
            region=node.region,
            labels=node.labels,
            created_at=node.created_at,
        )


class NodeStatusUpdateRequest(BaseModel):
    """Request to update node status."""

    status: str = Field(..., pattern="^(active|inactive|drain|maintenance)$")


# ---- User Management ----

class AdminUserCreateRequest(BaseModel):
    """Request for admin to create a user."""

    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=128)
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str = Field(default="customer", pattern="^(admin|customer)$")
    is_verified: bool = True


class AdminUserResponse(BaseModel):
    """User response for admin panel."""

    id: str
    email: str
    username: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str
    is_active: bool
    is_verified: bool
    two_factor_enabled: bool
    last_login_at: Optional[datetime] = None
    website_count: int = 0
    order_count: int = 0
    created_at: datetime

    @classmethod
    def from_entity(cls, user: User, website_count: int = 0, order_count: int = 0) -> "AdminUserResponse":
        return cls(
            id=user.id,
            email=user.email,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            role=user.role.value,
            is_active=user.is_active,
            is_verified=user.is_verified,
            two_factor_enabled=user.two_factor_enabled,
            last_login_at=user.last_login_at,
            website_count=website_count,
            order_count=order_count,
            created_at=user.created_at,
        )


# ---- Endpoints: Plan Management ----

@router.get("/plans", response_model=list[PlanResponse])
async def list_plans(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    include_inactive: bool = False,
    admin: User = Depends(get_current_admin),
    db = Depends(get_db_session),
) -> list[PlanResponse]:
    """List all hosting plans."""
    uow = UnitOfWorkImpl(db)
    filters: dict[str, Any] = {}
    if not include_inactive:
        filters["is_active"] = True

    plans, _ = await uow.plans.list(skip=skip, limit=limit, **filters)
    return [PlanResponse.from_entity(p) for p in plans]


@router.post("/plans", response_model=PlanResponse, status_code=201)
async def create_plan(
    request: PlanCreateRequest,
    admin: User = Depends(get_current_admin),
    db = Depends(get_db_session),
) -> PlanResponse:
    """Create a new hosting plan."""
    uow = UnitOfWorkImpl(db)

    existing = await uow.plans.get_by_name(request.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Plan name already exists",
        )

    plan = HostingPlan(
        name=request.name,
        description=request.description,
        disk_space_mb=request.disk_space_mb,
        cpu_limit=request.cpu_limit,
        ram_limit_mb=request.ram_limit_mb,
        swap_mb=request.swap_mb,
        bandwidth_mb=request.bandwidth_mb,
        php_version=request.php_version,
        redis_enabled=request.redis_enabled,
        woocommerce_enabled=request.woocommerce_enabled,
        container_limits=request.container_limits,
        cron_job_limits=request.cron_job_limits,
        file_limits=request.file_limits,
        sftp_users=request.sftp_users,
        backup_retention_days=request.backup_retention_days,
        ssl_enabled=request.ssl_enabled,
        price=request.price,
        setup_fee=request.setup_fee,
        billing_cycle=BillingCycle(request.billing_cycle),
    )

    await uow.plans.save(plan)
    await uow.commit()

    return PlanResponse.from_entity(plan)


@router.get("/plans/{plan_id}", response_model=PlanResponse)
async def get_plan(
    plan_id: str,
    admin: User = Depends(get_current_admin),
    db = Depends(get_db_session),
) -> PlanResponse:
    """Get plan details."""
    uow = UnitOfWorkImpl(db)
    plan = await uow.plans.get_by_id(plan_id)

    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found",
        )

    return PlanResponse.from_entity(plan)


@router.put("/plans/{plan_id}", response_model=PlanResponse)
async def update_plan(
    plan_id: str,
    request: PlanUpdateRequest,
    admin: User = Depends(get_current_admin),
    db = Depends(get_db_session),
) -> PlanResponse:
    """Update a hosting plan."""
    uow = UnitOfWorkImpl(db)
    plan = await uow.plans.get_by_id(plan_id)

    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found",
        )

    # Update only provided fields
    update_data = request.model_dump(exclude_unset=True)
    for field_name, value in update_data.items():
        if field_name == "billing_cycle":
            setattr(plan, field_name, BillingCycle(value))
        else:
            setattr(plan, field_name, value)

    plan.mark_updated()
    await uow.plans.save(plan)
    await uow.commit()

    return PlanResponse.from_entity(plan)


@router.delete("/plans/{plan_id}")
async def delete_plan(
    plan_id: str,
    admin: User = Depends(get_current_admin),
    db = Depends(get_db_session),
) -> dict[str, str]:
    """Delete a hosting plan."""
    uow = UnitOfWorkImpl(db)
    plan = await uow.plans.get_by_id(plan_id)

    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found",
        )

    await uow.plans.delete(plan)
    await uow.commit()

    return {"message": "Plan deleted successfully"}


# ---- Endpoints: Node Management ----

@router.get("/nodes", response_model=list[NodeResponse])
async def list_nodes(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    admin: User = Depends(get_current_admin),
    db = Depends(get_db_session),
) -> list[NodeResponse]:
    """List all nodes."""
    uow = UnitOfWorkImpl(db)
    filters: dict[str, Any] = {}
    if status:
        filters["status"] = status

    nodes, _ = await uow.nodes.list(skip=skip, limit=limit, **filters)
    return [NodeResponse.from_entity(n) for n in nodes]


@router.post("/nodes", response_model=NodeResponse, status_code=201)
async def add_node(
    request: NodeCreateRequest,
    admin: User = Depends(get_current_admin),
    db = Depends(get_db_session),
) -> NodeResponse:
    """Register a new remote node."""
    uow = UnitOfWorkImpl(db)

    # Validate API token format
    if len(request.api_token) < 32:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API token must be at least 32 characters",
        )

    node = Node(
        name=request.name,
        host=request.host,
        port=request.port,
        ssh_port=request.ssh_port,
        docker_host=request.docker_host,
        api_token=request.api_token,
        status=NodeStatus.INACTIVE,
        region=request.region,
        labels=request.labels,
    )

    await uow.nodes.save(node)
    await uow.commit()

    return NodeResponse.from_entity(node)


@router.get("/nodes/{node_id}", response_model=NodeResponse)
async def get_node(
    node_id: str,
    admin: User = Depends(get_current_admin),
    db = Depends(get_db_session),
) -> NodeResponse:
    """Get node details."""
    uow = UnitOfWorkImpl(db)
    node = await uow.nodes.get_by_id(node_id)

    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Node not found",
        )

    return NodeResponse.from_entity(node)


@router.put("/nodes/{node_id}/status", response_model=NodeResponse)
async def update_node_status(
    node_id: str,
    request: NodeStatusUpdateRequest,
    admin: User = Depends(get_current_admin),
    db = Depends(get_db_session),
) -> NodeResponse:
    """Update node status (active/drain/maintenance/inactive)."""
    uow = UnitOfWorkImpl(db)
    node = await uow.nodes.get_by_id(node_id)

    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Node not found",
        )

    node.change_status(NodeStatus(request.status))
    await uow.nodes.save(node)
    await uow.commit()

    return NodeResponse.from_entity(node)


@router.delete("/nodes/{node_id}")
async def remove_node(
    node_id: str,
    admin: User = Depends(get_current_admin),
    db = Depends(get_db_session),
) -> dict[str, str]:
    """Remove a node from the cluster."""
    uow = UnitOfWorkImpl(db)
    node = await uow.nodes.get_by_id(node_id)

    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Node not found",
        )

    # Check if node has websites
    websites, count = await uow.websites.list(node_id=node_id)
    if count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot remove node with {count} active websites. Migrate websites first.",
        )

    await uow.nodes.delete(node)
    await uow.commit()

    return {"message": "Node removed successfully"}


# ---- Endpoints: User Management ----

@router.get("/users", response_model=list[AdminUserResponse])
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    role: Optional[str] = None,
    search: Optional[str] = None,
    admin: User = Depends(get_current_admin),
    db = Depends(get_db_session),
) -> list[AdminUserResponse]:
    """List all users."""
    uow = UnitOfWorkImpl(db)
    filters: dict[str, Any] = {}
    if role:
        filters["role"] = role
    if search:
        filters["search"] = search

    users, _ = await uow.users.list(skip=skip, limit=limit, **filters)

    result = []
    for user in users:
        websites, wc = await uow.websites.list(user_id=user.id)
        orders, oc = await uow.orders.list(user_id=user.id)
        result.append(AdminUserResponse.from_entity(user, website_count=wc, order_count=oc))

    return result


@router.post("/users", response_model=AdminUserResponse, status_code=201)
async def admin_create_user(
    request: AdminUserCreateRequest,
    admin: User = Depends(get_current_admin),
    db = Depends(get_db_session),
) -> AdminUserResponse:
    """Admin creates a new user."""
    uow = UnitOfWorkImpl(db)

    existing = await uow.users.get_by_email(request.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    from hosting_control.shared.security.hashing import hash_password

    user = User(
        email=request.email,
        username=request.username,
        password_hash=hash_password(request.password),
        first_name=request.first_name,
        last_name=request.last_name,
        role=UserRole(request.role),
        is_verified=request.is_verified,
    )

    await uow.users.save(user)
    await uow.commit()

    return AdminUserResponse.from_entity(user)


@router.put("/users/{user_id}/status")
async def toggle_user_status(
    user_id: str,
    admin: User = Depends(get_current_admin),
    db = Depends(get_db_session),
) -> dict[str, str]:
    """Toggle user active status."""
    uow = UnitOfWorkImpl(db)
    user = await uow.users.get_by_id(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.is_active = not user.is_active
    await uow.users.save(user)
    await uow.commit()

    status_text = "activated" if user.is_active else "suspended"
    return {"message": f"User {status_text} successfully"}


# ---- Endpoints: System Stats ----

@router.get("/dashboard/stats")
async def get_dashboard_stats(
    admin: User = Depends(get_current_admin),
    db = Depends(get_db_session),
) -> dict[str, Any]:
    """Get admin dashboard statistics."""
    uow = UnitOfWorkImpl(db)

    # Get all users
    users, user_count = await uow.users.list(limit=1)  # just get count
    # Need to count properly - for now query all
    users, user_count = await uow.users.list(skip=0, limit=10000)

    plans, plan_count = await uow.plans.list(limit=10000)
    nodes, node_count = await uow.nodes.list(limit=10000)
    websites, website_count = await uow.websites.list(limit=10000)
    orders, order_count = await uow.orders.list(limit=10000)

    # Count active websites
    active_websites = sum(1 for w in websites if w.status.value == "active")

    # Count active nodes
    active_nodes = sum(1 for n in nodes if n.status.value == "active")

    # Total revenue from completed orders
    from hosting_control.main_controller.domain.entities import OrderStatus
    total_revenue = sum(
        o.total_amount for o in orders if o.status == OrderStatus.PAID
    )

    # Total resources
    total_disk = sum(n.disk_total_mb for n in nodes)
    total_ram = sum(n.ram_total_mb for n in nodes)
    used_disk = sum(n.current_disk_usage for n in nodes)
    used_ram = sum(n.current_ram_usage for n in nodes)

    return {
        "users": {
            "total": user_count,
            "active": sum(1 for u in users if u.is_active),
        },
        "plans": {"total": plan_count, "active": sum(1 for p in plans if p.is_active)},
        "nodes": {
            "total": node_count,
            "active": active_nodes,
            "healthy": sum(1 for n in nodes if n.is_healthy),
            "total_cpu_cores": sum(n.cpu_cores for n in nodes),
            "total_ram_mb": total_ram,
            "used_ram_mb": used_ram,
            "ram_usage_percent": round((used_ram / total_ram * 100), 2) if total_ram > 0 else 0,
            "total_disk_mb": total_disk,
            "used_disk_mb": used_disk,
            "disk_usage_percent": round((used_disk / total_disk * 100), 2) if total_disk > 0 else 0,
        },
        "websites": {
            "total": website_count,
            "active": active_websites,
        },
        "orders": {
            "total": order_count,
            "pending": sum(1 for o in orders if o.status.value == "pending"),
            "completed": sum(1 for o in orders if o.status.value == "paid"),
        },
        "revenue": {"total": total_revenue},
    }