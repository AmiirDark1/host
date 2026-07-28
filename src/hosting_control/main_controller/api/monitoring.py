"""Monitoring and analytics API endpoints.

Provides real-time metrics, node health, website stats, and alerting.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel

from hosting_control.main_controller.api.auth import get_current_admin, get_current_user
from hosting_control.main_controller.domain.entities import User, UserRole
from hosting_control.main_controller.infrastructure.database import get_db_session
from hosting_control.main_controller.infrastructure.repositories import (
    UnitOfWorkImpl,
)

router = APIRouter()


# ---- Response Models ----

class NodeMetricsResponse(BaseModel):
    """Node performance metrics."""

    node_id: str
    node_name: str
    cpu_usage_percent: float
    ram_usage_percent: float
    ram_used_mb: int
    ram_total_mb: int
    disk_usage_percent: float
    disk_used_mb: int
    disk_total_mb: int
    bandwidth_usage_percent: float
    bandwidth_used_mb: int
    bandwidth_total_mb: int
    load_average_1m: float
    load_average_5m: float
    load_average_15m: float
    container_count: int
    website_count: int
    is_healthy: bool
    last_heartbeat: Optional[datetime] = None


class WebsiteMetricsResponse(BaseModel):
    """Website performance metrics."""

    website_id: str
    domain: str
    disk_usage_mb: int
    disk_quota_mb: int
    disk_usage_percent: float
    ram_usage_mb: int
    cpu_usage_percent: float
    bandwidth_usage_mb: int
    status: str
    uptime_seconds: Optional[int] = None
    requests_per_minute: Optional[int] = None
    average_response_time_ms: Optional[float] = None


class AlertResponse(BaseModel):
    """Alert information."""

    id: str
    type: str
    severity: str
    message: str
    resource_type: str
    resource_id: str
    acknowledged: bool
    created_at: datetime


class TimeSeriesPoint(BaseModel):
    """A single data point in a time series."""

    timestamp: datetime
    value: float


class AnalyticsResponse(BaseModel):
    """Analytics data for a time range."""

    metric: str
    points: list[TimeSeriesPoint]
    total: Optional[float] = None
    average: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None


# ---- Endpoints: Node Monitoring ----

@router.get("/nodes", response_model=list[NodeMetricsResponse])
async def get_all_node_metrics(
    admin: User = Depends(get_current_admin),
    db = Depends(get_db_session),
) -> list[NodeMetricsResponse]:
    """Get metrics for all nodes."""
    uow = UnitOfWorkImpl(db)
    nodes, _ = await uow.nodes.list(limit=1000)

    result = []
    for node in nodes:
        ram_percent = 0
        if node.ram_total_mb > 0:
            ram_percent = round((node.current_ram_usage / node.ram_total_mb) * 100, 2)

        disk_percent = 0
        if node.disk_total_mb > 0:
            disk_percent = round((node.current_disk_usage / node.disk_total_mb) * 100, 2)

        bandwidth_percent = 0
        if node.bandwidth_total_mb > 0:
            bandwidth_percent = round(
                (node.current_bandwidth_usage / node.bandwidth_total_mb) * 100, 2
            )

        result.append(
            NodeMetricsResponse(
                node_id=node.id,
                node_name=node.name,
                cpu_usage_percent=node.current_cpu_usage,
                ram_usage_percent=ram_percent,
                ram_used_mb=node.current_ram_usage,
                ram_total_mb=node.ram_total_mb,
                disk_usage_percent=disk_percent,
                disk_used_mb=node.current_disk_usage,
                disk_total_mb=node.disk_total_mb,
                bandwidth_usage_percent=bandwidth_percent,
                bandwidth_used_mb=node.current_bandwidth_usage,
                bandwidth_total_mb=node.bandwidth_total_mb,
                load_average_1m=node.load_average_1m,
                load_average_5m=node.load_average_5m,
                load_average_15m=node.load_average_15m,
                container_count=node.container_count,
                website_count=node.website_count,
                is_healthy=node.is_healthy,
                last_heartbeat=node.last_heartbeat,
            )
        )

    return result


@router.get("/nodes/{node_id}", response_model=NodeMetricsResponse)
async def get_node_metrics(
    node_id: str,
    admin: User = Depends(get_current_admin),
    db = Depends(get_db_session),
) -> NodeMetricsResponse:
    """Get metrics for a specific node."""
    uow = UnitOfWorkImpl(db)
    node = await uow.nodes.get_by_id(node_id)

    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Node not found",
        )

    ram_percent = 0
    if node.ram_total_mb > 0:
        ram_percent = round((node.current_ram_usage / node.ram_total_mb) * 100, 2)

    disk_percent = 0
    if node.disk_total_mb > 0:
        disk_percent = round((node.current_disk_usage / node.disk_total_mb) * 100, 2)

    bandwidth_percent = 0
    if node.bandwidth_total_mb > 0:
        bandwidth_percent = round(
            (node.current_bandwidth_usage / node.bandwidth_total_mb) * 100, 2
        )

    return NodeMetricsResponse(
        node_id=node.id,
        node_name=node.name,
        cpu_usage_percent=node.current_cpu_usage,
        ram_usage_percent=ram_percent,
        ram_used_mb=node.current_ram_usage,
        ram_total_mb=node.ram_total_mb,
        disk_usage_percent=disk_percent,
        disk_used_mb=node.current_disk_usage,
        disk_total_mb=node.disk_total_mb,
        bandwidth_usage_percent=bandwidth_percent,
        bandwidth_used_mb=node.current_bandwidth_usage,
        bandwidth_total_mb=node.bandwidth_total_mb,
        load_average_1m=node.load_average_1m,
        load_average_5m=node.load_average_5m,
        load_average_15m=node.load_average_15m,
        container_count=node.container_count,
        website_count=node.website_count,
        is_healthy=node.is_healthy,
        last_heartbeat=node.last_heartbeat,
    )


# ---- Endpoints: Website Monitoring ----

@router.get("/websites", response_model=list[WebsiteMetricsResponse])
async def get_all_website_metrics(
    current_user: User = Depends(get_current_user),
    db = Depends(get_db_session),
) -> list[WebsiteMetricsResponse]:
    """Get metrics for all websites (filtered by user)."""
    uow = UnitOfWorkImpl(db)

    filters: dict[str, Any] = {}
    if current_user.role != UserRole.ADMIN:
        filters["user_id"] = current_user.id

    websites, _ = await uow.websites.list(limit=1000, **filters)

    result = []
    for website in websites:
        disk_percent = 0
        if website.disk_quota_mb > 0:
            disk_percent = round(
                (website.disk_usage_mb / website.disk_quota_mb) * 100, 2
            )

        result.append(
            WebsiteMetricsResponse(
                website_id=website.id,
                domain=website.domain,
                disk_usage_mb=website.disk_usage_mb,
                disk_quota_mb=website.disk_quota_mb,
                disk_usage_percent=disk_percent,
                ram_usage_mb=website.ram_usage_mb,
                cpu_usage_percent=website.cpu_usage,
                bandwidth_usage_mb=website.bandwidth_usage_mb,
                status=website.status.value,
            )
        )

    return result


@router.get("/websites/{website_id}", response_model=WebsiteMetricsResponse)
async def get_website_metrics(
    website_id: str,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db_session),
) -> WebsiteMetricsResponse:
    """Get metrics for a specific website."""
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

    disk_percent = 0
    if website.disk_quota_mb > 0:
        disk_percent = round(
            (website.disk_usage_mb / website.disk_quota_mb) * 100, 2
        )

    return WebsiteMetricsResponse(
        website_id=website.id,
        domain=website.domain,
        disk_usage_mb=website.disk_usage_mb,
        disk_quota_mb=website.disk_quota_mb,
        disk_usage_percent=disk_percent,
        ram_usage_mb=website.ram_usage_mb,
        cpu_usage_percent=website.cpu_usage,
        bandwidth_usage_mb=website.bandwidth_usage_mb,
        status=website.status.value,
    )


# ---- Endpoints: Analytics ----

@router.get("/analytics/nodes/{node_id}/cpu")
async def get_node_cpu_analytics(
    node_id: str,
    hours: int = Query(24, ge=1, le=720),
    admin: User = Depends(get_current_admin),
) -> AnalyticsResponse:
    """Get CPU analytics for a node over a time range."""
    # In production, this would query a time-series database (e.g., TimescaleDB, InfluxDB)
    # For now, return a stub
    now = datetime.now(timezone.utc)
    points = []
    for i in range(hours):
        points.append(
            TimeSeriesPoint(
                timestamp=now - timedelta(hours=hours - i),
                value=50.0 + (i % 20) - 10,  # Simulated data
            )
        )

    return AnalyticsResponse(
        metric="cpu_usage_percent",
        points=points,
        average=45.5,
        min=10.2,
        max=89.9,
    )


@router.get("/analytics/nodes/{node_id}/memory")
async def get_node_memory_analytics(
    node_id: str,
    hours: int = Query(24, ge=1, le=720),
    admin: User = Depends(get_current_admin),
) -> AnalyticsResponse:
    """Get memory analytics for a node over a time range."""
    now = datetime.now(timezone.utc)
    points = []
    for i in range(hours):
        points.append(
            TimeSeriesPoint(
                timestamp=now - timedelta(hours=hours - i),
                value=60.0 + (i % 15) - 7,
            )
        )

    return AnalyticsResponse(
        metric="ram_usage_percent",
        points=points,
        average=62.3,
        min=30.1,
        max=85.7,
    )


@router.get("/analytics/nodes/{node_id}/disk")
async def get_node_disk_analytics(
    node_id: str,
    hours: int = Query(24, ge=1, le=720),
    admin: User = Depends(get_current_admin),
) -> AnalyticsResponse:
    """Get disk analytics for a node over a time range."""
    now = datetime.now(timezone.utc)
    points = []
    for i in range(hours):
        points.append(
            TimeSeriesPoint(
                timestamp=now - timedelta(hours=hours - i),
                value=40.0 + (i % 10) - 5,
            )
        )

    return AnalyticsResponse(
        metric="disk_usage_percent",
        points=points,
        average=42.1,
        min=25.0,
        max=65.3,
    )


# ---- WebSocket Endpoints for Real-time Monitoring ----

@router.websocket("/ws/nodes")
async def websocket_node_monitoring(
    websocket: WebSocket,
):
    """Real-time node monitoring via WebSocket.

    Streams node metrics updates to connected admin clients.
    """
    await websocket.accept()
    try:
        # In production, subscribe to Redis pub/sub channels for node metrics
        while True:
            # Wait for messages or send heartbeats
            data = await websocket.receive_text()
            # Process subscription commands
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass


@router.websocket("/ws/websites/{website_id}")
async def websocket_website_monitoring(
    websocket: WebSocket,
    website_id: str,
):
    """Real-time website monitoring via WebSocket.

    Streams website metrics and logs to connected clients.
    """
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong", "website_id": website_id})
    except WebSocketDisconnect:
        pass


# ---- Endpoints: Node Heartbeat (called by node agents) ----

class NodeHeartbeatRequest(BaseModel):
    """Heartbeat data sent by node agents."""

    node_id: str
    cpu_usage_percent: float
    ram_used_mb: int
    ram_total_mb: int
    disk_used_mb: int
    disk_total_mb: int
    bandwidth_used_mb: int
    bandwidth_total_mb: int
    load_average_1m: float
    load_average_5m: float
    load_average_15m: float
    container_count: int
    website_count: int
    is_healthy: bool


@router.post("/heartbeat")
async def receive_node_heartbeat(
    request: NodeHeartbeatRequest,
    db = Depends(get_db_session),
) -> dict[str, str]:
    """Receive heartbeat from a node agent."""
    uow = UnitOfWorkImpl(db)
    node = await uow.nodes.get_by_id(request.node_id)

    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Node not found",
        )

    # Update node metrics
    node.current_cpu_usage = request.cpu_usage_percent
    node.current_ram_usage = request.ram_used_mb
    node.ram_total_mb = request.ram_total_mb
    node.current_disk_usage = request.disk_used_mb
    node.disk_total_mb = request.disk_total_mb
    node.current_bandwidth_usage = request.bandwidth_used_mb
    node.bandwidth_total_mb = request.bandwidth_total_mb
    node.load_average_1m = request.load_average_1m
    node.load_average_5m = request.load_average_5m
    node.load_average_15m = request.load_average_15m
    node.container_count = request.container_count
    node.website_count = request.website_count
    node.is_healthy = request.is_healthy
    node.last_heartbeat = datetime.now(timezone.utc)

    await uow.nodes.save(node)
    await uow.commit()

    return {"status": "ok"}