"""Domain entities for the hosting control panel.

These are pure Pydantic domain models, separate from ORM models,
following Clean Architecture principles.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from hosting_control.shared.ddd.base import Aggregate, Entity, ValueObject


class UserRole(str, Enum):
    """User roles for RBAC."""

    ADMIN = "admin"
    CUSTOMER = "customer"
    NODE = "node"
    SUPPORT = "support"


class WebsiteStatus(str, Enum):
    """Website lifecycle statuses."""

    CREATING = "creating"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DELETING = "deleting"
    DELETED = "deleted"
    MAINTENANCE = "maintenance"
    ERROR = "error"


class NodeStatus(str, Enum):
    """Node operation statuses."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    DRAIN = "drain"
    MAINTENANCE = "maintenance"
    OFFLINE = "offline"


class SSLStatus(str, Enum):
    """SSL certificate status."""

    NONE = "none"
    PENDING = "pending"
    ACTIVE = "active"
    EXPIRING = "expiring"
    EXPIRED = "expired"
    FAILED = "failed"


class OrderStatus(str, Enum):
    """Order processing status."""

    PENDING = "pending"
    PROCESSING = "processing"
    ACTIVE = "active"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    REFUNDED = "refunded"


class BillingCycle(str, Enum):
    """Billing cycle for plans."""

    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    SEMI_ANNUALLY = "semi_annually"
    ANNUALLY = "annually"


class BackupType(str, Enum):
    """Backup type."""

    FULL = "full"
    DATABASE = "database"
    FILES = "files"


class BackupStatus(str, Enum):
    """Backup processing status."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class User(Aggregate):
    """User aggregate representing a customer or admin."""

    email: str
    username: str
    password_hash: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: UserRole = UserRole.CUSTOMER
    is_active: bool = True
    is_verified: bool = False
    two_factor_enabled: bool = False
    two_factor_secret: Optional[str] = None
    api_key: Optional[str] = None
    last_login_at: Optional[datetime] = None
    last_login_ip: Optional[str] = None

    def verify_password(self, password: str) -> bool:
        """Verify user password."""
        from hosting_control.shared.security.hashing import verify_password

        return verify_password(password, self.password_hash)

    def enable_two_factor(self, secret: str) -> None:
        """Enable two-factor authentication."""
        self.two_factor_secret = secret
        self.two_factor_enabled = True
        self.mark_updated()

    def disable_two_factor(self) -> None:
        """Disable two-factor authentication."""
        self.two_factor_secret = None
        self.two_factor_enabled = False
        self.mark_updated()

    def record_login(self, ip_address: str) -> None:
        """Record a successful login."""
        self.last_login_at = datetime.now(timezone.utc)
        self.last_login_ip = ip_address
        self.mark_updated()

    def suspend(self) -> None:
        """Suspend user account."""
        self.is_active = False
        self.mark_updated()

    def activate(self) -> None:
        """Activate user account."""
        self.is_active = True
        self.mark_updated()


class HostingPlan(Aggregate):
    """Hosting plan aggregate defining resource limits and features."""

    name: str
    description: Optional[str] = None
    disk_space_mb: int = 10240
    cpu_limit: float = 1.0
    ram_limit_mb: int = 1024
    swap_mb: int = 512
    bandwidth_mb: int = 102400
    php_version: str = "8.3"
    redis_enabled: bool = False
    woocommerce_enabled: bool = False
    container_limits: int = 2
    cron_job_limits: int = 10
    file_limits: int = 50000
    sftp_users: int = 1
    backup_retention_days: int = 7
    ssl_enabled: bool = True
    price: float = 0.0
    setup_fee: float = 0.0
    billing_cycle: BillingCycle = BillingCycle.MONTHLY
    is_active: bool = True

    def can_upgrade_to(self, other: HostingPlan) -> bool:
        """Check if this plan can be upgraded to another plan."""
        return (
            other.disk_space_mb >= self.disk_space_mb
            and other.ram_limit_mb >= self.ram_limit_mb
            and other.bandwidth_mb >= self.bandwidth_mb
        )


class Node(Aggregate):
    """Remote node aggregate representing a hosting server."""

    name: str
    host: str
    port: int = 8080
    ssh_port: int = 22
    docker_host: str
    api_token: str
    api_token_hash: str
    status: NodeStatus = NodeStatus.ACTIVE
    cpu_cores: int = 4
    cpu_frequency_ghz: float = 2.5
    ram_total_mb: int = 16384
    disk_total_mb: int = 512000
    bandwidth_total_mb: int = 1048576
    current_cpu_usage: float = 0.0
    current_ram_usage: int = 0
    current_disk_usage: int = 0
    current_bandwidth_usage: int = 0
    load_average_1m: float = 0.0
    load_average_5m: float = 0.0
    load_average_15m: float = 0.0
    container_count: int = 0
    website_count: int = 0
    is_healthy: bool = True
    last_heartbeat: Optional[datetime] = None
    region: str = "default"
    labels: dict[str, str] = {}

    @property
    def cpu_usage_percent(self) -> float:
        """Calculate CPU usage percentage."""
        if self.cpu_cores > 0:
            return (self.current_cpu_usage / self.cpu_cores) * 100
        return 0.0

    @property
    def ram_usage_percent(self) -> float:
        """Calculate RAM usage percentage."""
        if self.ram_total_mb > 0:
            return (self.current_ram_usage / self.ram_total_mb) * 100
        return 0.0

    @property
    def disk_usage_percent(self) -> float:
        """Calculate disk usage percentage."""
        if self.disk_total_mb > 0:
            return (self.current_disk_usage / self.disk_total_mb) * 100
        return 0.0

    def is_available(self) -> bool:
        """Check if the node is available for hosting new websites."""
        if self.status != NodeStatus.ACTIVE:
            return False
        if not self.is_healthy:
            return False
        if self.disk_usage_percent >= 90:
            return False
        if self.ram_usage_percent >= 90:
            return False
        return True

    def drain(self) -> None:
        """Put node in drain mode (no new websites)."""
        self.status = NodeStatus.DRAIN
        self.mark_updated()

    def enable(self) -> None:
        """Enable the node."""
        self.status = NodeStatus.ACTIVE
        self.mark_updated()

    def disable(self) -> None:
        """Disable the node."""
        self.status = NodeStatus.INACTIVE
        self.mark_updated()

    def maintenance(self) -> None:
        """Put node in maintenance mode."""
        self.status = NodeStatus.MAINTENANCE
        self.mark_updated()

    def update_metrics(self, metrics: dict[str, Any]) -> None:
        """Update resource metrics."""
        self.current_cpu_usage = metrics.get("cpu_usage", self.current_cpu_usage)
        self.current_ram_usage = metrics.get("ram_usage", self.current_ram_usage)
        self.current_disk_usage = metrics.get("disk_usage", self.current_disk_usage)
        self.current_bandwidth_usage = metrics.get("bandwidth_usage", self.current_bandwidth_usage)
        self.load_average_1m = metrics.get("load_average_1m", self.load_average_1m)
        self.load_average_5m = metrics.get("load_average_5m", self.load_average_5m)
        self.load_average_15m = metrics.get("load_average_15m", self.load_average_15m)
        self.container_count = metrics.get("container_count", self.container_count)
        self.website_count = metrics.get("website_count", self.website_count)
        self.is_healthy = metrics.get("is_healthy", self.is_healthy)
        self.last_heartbeat = datetime.now(timezone.utc)
        self.mark_updated()


class Website(Aggregate):
    """Website aggregate representing a WordPress installation."""

    user_id: str
    plan_id: str
    node_id: str
    domain: str
    directory: str
    docker_network: str
    docker_compose_path: Optional[str] = None
    mysql_database: str
    mysql_user: str
    mysql_password_encrypted: str
    mysql_host: str
    mysql_port: int = 3306
    redis_host: Optional[str] = None
    redis_port: Optional[int] = None
    redis_password_encrypted: Optional[str] = None
    wp_admin_user: str
    wp_admin_password_encrypted: str
    wp_admin_email: str
    wp_secret_keys_encrypted: Optional[str] = None
    php_version: str = "8.3"
    ssl_status: SSLStatus = SSLStatus.NONE
    ssl_certificate_expiry: Optional[datetime] = None
    status: WebsiteStatus = WebsiteStatus.CREATING
    disk_usage_mb: int = 0
    ram_usage_mb: int = 0
    cpu_usage: float = 0.0
    bandwidth_usage_mb: int = 0
    disk_quota_mb: int = 10240
    docker_container_id: Optional[str] = None
    docker_image: str = ""
    traefik_router_name: Optional[str] = None
    order_id: Optional[str] = None
    installed_plugins: list[str] = []
    installed_theme: Optional[str] = None
    woocommerce_enabled: bool = False
    redis_enabled: bool = False
    auto_backup_enabled: bool = True
    last_backup_at: Optional[datetime] = None
    suspended_at: Optional[datetime] = None
    suspended_reason: Optional[str] = None

    @property
    def disk_usage_percent(self) -> float:
        """Calculate disk usage percentage against quota."""
        if self.disk_quota_mb > 0:
            return (self.disk_usage_mb / self.disk_quota_mb) * 100
        return 0.0

    def activate(self) -> None:
        """Activate the website."""
        self.status = WebsiteStatus.ACTIVE
        self.mark_updated()

    def suspend(self, reason: str = "") -> None:
        """Suspend the website."""
        self.status = WebsiteStatus.SUSPENDED
        self.suspended_at = datetime.now(timezone.utc)
        self.suspended_reason = reason
        self.mark_updated()

    def delete(self) -> None:
        """Mark website for deletion."""
        self.status = WebsiteStatus.DELETING
        self.mark_updated()

    def update_quota(self, new_quota_mb: int) -> None:
        """Update disk quota without recreating container."""
        self.disk_quota_mb = new_quota_mb
        self.mark_updated()

    def update_resource_usage(self, usage: dict[str, Any]) -> None:
        """Update resource usage metrics."""
        self.disk_usage_mb = usage.get("disk_mb", self.disk_usage_mb)
        self.ram_usage_mb = usage.get("ram_mb", self.ram_usage_mb)
        self.cpu_usage = usage.get("cpu", self.cpu_usage)
        self.bandwidth_usage_mb = usage.get("bandwidth_mb", self.bandwidth_usage_mb)
        self.mark_updated()


class Order(Aggregate):
    """Order aggregate representing a purchase."""

    user_id: str
    plan_id: Optional[str] = None
    website_id: Optional[str] = None
    order_number: str
    status: OrderStatus = OrderStatus.PENDING
    total_amount: float = 0.0
    tax_amount: float = 0.0
    discount_amount: float = 0.0
    coupon_code: Optional[str] = None
    billing_cycle: BillingCycle = BillingCycle.MONTHLY
    next_billing_date: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    notes: Optional[str] = None

    def mark_paid(self) -> None:
        """Mark order as paid."""
        self.status = OrderStatus.PROCESSING
        self.paid_at = datetime.now(timezone.utc)
        self.mark_updated()

    def mark_active(self) -> None:
        """Mark order as active (provisioning complete)."""
        self.status = OrderStatus.ACTIVE
        self.mark_updated()

    def cancel(self) -> None:
        """Cancel the order."""
        self.status = OrderStatus.CANCELLED
        self.cancelled_at = datetime.now(timezone.utc)
        self.mark_updated()


class Backup(Aggregate):
    """Backup aggregate representing a website backup."""

    website_id: str
    name: str
    type: BackupType = BackupType.FULL
    size_mb: float = 0.0
    path: str
    storage_type: str = "local"
    status: BackupStatus = BackupStatus.PENDING
    checksum: Optional[str] = None
    is_automated: bool = False
    retention_until: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    def complete(self, size_mb: float, checksum: str) -> None:
        """Mark backup as completed."""
        self.status = BackupStatus.COMPLETED
        self.size_mb = size_mb
        self.checksum = checksum
        self.completed_at = datetime.now(timezone.utc)
        self.mark_updated()

    def fail(self) -> None:
        """Mark backup as failed."""
        self.status = BackupStatus.FAILED
        self.mark_updated()