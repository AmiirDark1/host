"""SQLAlchemy implementations of domain repositories.

These repositories translate between domain aggregates and ORM models,
following the Repository pattern from Clean Architecture.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select, func, and_, or_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from hosting_control.main_controller.domain.entities import (
    Backup,
    BackupStatus,
    BackupType,
    BillingCycle,
    HostingPlan,
    Node,
    NodeStatus,
    Order,
    OrderStatus,
    SSLStatus,
    User,
    UserRole,
    Website,
    WebsiteStatus,
)
from hosting_control.main_controller.infrastructure.models import (
    BackupModel,
    HostingPlanModel,
    NodeModel,
    OrderModel,
    UserModel,
    WebsiteModel,
)
from hosting_control.shared.ddd.base import Repository


class SQLAlchemyRepository(Repository):
    """Base repository with common SQLAlchemy operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session


class UserRepository(SQLAlchemyRepository):
    """Repository for User aggregates."""

    async def save(self, aggregate: User) -> User:
        model = UserModel(
            id=aggregate.id,
            email=aggregate.email,
            username=aggregate.username,
            password_hash=aggregate.password_hash,
            first_name=aggregate.first_name,
            last_name=aggregate.last_name,
            role=aggregate.role.value,
            is_active=aggregate.is_active,
            is_verified=aggregate.is_verified,
            two_factor_enabled=aggregate.two_factor_enabled,
            two_factor_secret=aggregate.two_factor_secret,
            api_key=aggregate.api_key,
            last_login_at=aggregate.last_login_at,
            last_login_ip=aggregate.last_login_ip,
        )
        self.session.add(model)
        await self.session.flush()
        return aggregate

    async def get_by_id(self, id: str) -> Optional[User]:
        result = await self.session.execute(
            select(UserModel).where(UserModel.id == id)
        )
        model = result.scalar_one_or_none()
        if not model:
            return None
        return self._model_to_entity(model)

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.session.execute(
            select(UserModel).where(UserModel.email == email)
        )
        model = result.scalar_one_or_none()
        if not model:
            return None
        return self._model_to_entity(model)

    async def get_by_username(self, username: str) -> Optional[User]:
        result = await self.session.execute(
            select(UserModel).where(UserModel.username == username)
        )
        model = result.scalar_one_or_none()
        if not model:
            return None
        return self._model_to_entity(model)

    async def delete(self, aggregate: User) -> None:
        await self.session.execute(
            delete(UserModel).where(UserModel.id == aggregate.id)
        )

    async def list(
        self,
        skip: int = 0,
        limit: int = 100,
        **filters: Any,
    ) -> tuple[list[User], int]:
        query = select(UserModel)
        count_query = select(func.count(UserModel.id))

        # Apply filters
        if "role" in filters:
            query = query.where(UserModel.role == filters["role"])
            count_query = count_query.where(UserModel.role == filters["role"])
        if "is_active" in filters:
            query = query.where(UserModel.is_active == filters["is_active"])
            count_query = count_query.where(UserModel.is_active == filters["is_active"])
        if "search" in filters:
            search = f"%{filters['search']}%"
            query = query.where(
                or_(
                    UserModel.email.ilike(search),
                    UserModel.username.ilike(search),
                    UserModel.first_name.ilike(search),
                    UserModel.last_name.ilike(search),
                )
            )
            count_query = count_query.where(
                or_(
                    UserModel.email.ilike(search),
                    UserModel.username.ilike(search),
                    UserModel.first_name.ilike(search),
                    UserModel.last_name.ilike(search),
                )
            )

        # Get total count
        count_result = await self.session.execute(count_query)
        total = count_result.scalar() or 0

        # Get paginated results
        query = query.offset(skip).limit(limit).order_by(UserModel.created_at.desc())
        result = await self.session.execute(query)
        models = result.scalars().all()

        return [self._model_to_entity(m) for m in models], total

    def _model_to_entity(self, model: UserModel) -> User:
        return User(
            id=model.id,
            email=model.email,
            username=model.username,
            password_hash=model.password_hash,
            first_name=model.first_name,
            last_name=model.last_name,
            role=UserRole(model.role),
            is_active=model.is_active,
            is_verified=model.is_verified,
            two_factor_enabled=model.two_factor_enabled,
            two_factor_secret=model.two_factor_secret,
            api_key=model.api_key,
            last_login_at=model.last_login_at,
            last_login_ip=model.last_login_ip,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )


class HostingPlanRepository(SQLAlchemyRepository):
    """Repository for HostingPlan aggregates."""

    async def save(self, aggregate: HostingPlan) -> HostingPlan:
        model = HostingPlanModel(
            id=aggregate.id,
            name=aggregate.name,
            description=aggregate.description,
            disk_space_mb=aggregate.disk_space_mb,
            cpu_limit=aggregate.cpu_limit,
            ram_limit_mb=aggregate.ram_limit_mb,
            swap_mb=aggregate.swap_mb,
            bandwidth_mb=aggregate.bandwidth_mb,
            php_version=aggregate.php_version,
            redis_enabled=aggregate.redis_enabled,
            woocommerce_enabled=aggregate.woocommerce_enabled,
            container_limits=aggregate.container_limits,
            cron_job_limits=aggregate.cron_job_limits,
            file_limits=aggregate.file_limits,
            sftp_users=aggregate.sftp_users,
            backup_retention_days=aggregate.backup_retention_days,
            ssl_enabled=aggregate.ssl_enabled,
            price=aggregate.price,
            setup_fee=aggregate.setup_fee,
            billing_cycle=aggregate.billing_cycle.value,
           is_active=aggregate.is_active,
        )
        self.session.add(model)
        await self.session.flush()
        return aggregate

    async def get_by_id(self, id: str) -> Optional[HostingPlan]:
        result = await self.session.execute(
            select(HostingPlanModel).where(HostingPlanModel.id == id)
        )
        model = result.scalar_one_or_none()
        if not model:
            return None
        return self._model_to_entity(model)

    async def get_by_name(self, name: str) -> Optional[HostingPlan]:
        result = await self.session.execute(
            select(HostingPlanModel).where(HostingPlanModel.name == name)
        )
        model = result.scalar_one_or_none()
        if not model:
            return None
        return self._model_to_entity(model)

    async def delete(self, aggregate: HostingPlan) -> None:
        await self.session.execute(
            delete(HostingPlanModel).where(HostingPlanModel.id == aggregate.id)
        )

    async def list(
        self,
        skip: int = 0,
        limit: int = 100,
        **filters: Any,
    ) -> tuple[list[HostingPlan], int]:
        query = select(HostingPlanModel)
        count_query = select(func.count(HostingPlanModel.id))

        if "is_active" in filters:
            query = query.where(HostingPlanModel.is_active == filters["is_active"])
            count_query = count_query.where(HostingPlanModel.is_active == filters["is_active"])

        count_result = await self.session.execute(count_query)
        total = count_result.scalar() or 0

        query = query.offset(skip).limit(limit).order_by(HostingPlanModel.created_at.desc())
        result = await self.session.execute(query)
        models = result.scalars().all()

        return [self._model_to_entity(m) for m in models], total

    def _model_to_entity(self, model: HostingPlanModel) -> HostingPlan:
        return HostingPlan(
            id=model.id,
            name=model.name,
            description=model.description,
            disk_space_mb=model.disk_space_mb,
            cpu_limit=model.cpu_limit,
            ram_limit_mb=model.ram_limit_mb,
            swap_mb=model.swap_mb,
            bandwidth_mb=model.bandwidth_mb,
            php_version=model.php_version,
            redis_enabled=model.redis_enabled,
            woocommerce_enabled=model.woocommerce_enabled,
            container_limits=model.container_limits,
            cron_job_limits=model.cron_job_limits,
            file_limits=model.file_limits,
            sftp_users=model.sftp_users,
            backup_retention_days=model.backup_retention_days,
            ssl_enabled=model.ssl_enabled,
            price=model.price,
            setup_fee=model.setup_fee,
            billing_cycle=BillingCycle(model.billing_cycle),
            is_active=model.is_active,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )


class NodeRepository(SQLAlchemyRepository):
    """Repository for Node aggregates."""

    async def save(self, aggregate: Node) -> Node:
        model = NodeModel(
            id=aggregate.id,
            name=aggregate.name,
            host=aggregate.host,
            port=aggregate.port,
            ssh_port=aggregate.ssh_port,
            docker_host=aggregate.docker_host,
            api_token=aggregate.api_token,
            api_token_hash=aggregate.api_token_hash,
            status=aggregate.status.value,
            cpu_cores=aggregate.cpu_cores,
            cpu_frequency_ghz=aggregate.cpu_frequency_ghz,
            ram_total_mb=aggregate.ram_total_mb,
            disk_total_mb=aggregate.disk_total_mb,
            bandwidth_total_mb=aggregate.bandwidth_total_mb,
            current_cpu_usage=aggregate.current_cpu_usage,
            current_ram_usage=aggregate.current_ram_usage,
            current_disk_usage=aggregate.current_disk_usage,
            current_bandwidth_usage=aggregate.current_bandwidth_usage,
            load_average_1m=aggregate.load_average_1m,
            load_average_5m=aggregate.load_average_5m,
            load_average_15m=aggregate.load_average_15m,
            container_count=aggregate.container_count,
            website_count=aggregate.website_count,
            is_healthy=aggregate.is_healthy,
            last_heartbeat=aggregate.last_heartbeat,
            region=aggregate.region,
            labels=json.dumps(aggregate.labels) if aggregate.labels else None,
        )
        self.session.add(model)
        await self.session.flush()
        return aggregate

    async def get_by_id(self, id: str) -> Optional[Node]:
        result = await self.session.execute(
            select(NodeModel).where(NodeModel.id == id)
        )
        model = result.scalar_one_or_none()
        if not model:
            return None
        return self._model_to_entity(model)

    async def delete(self, aggregate: Node) -> None:
        await self.session.execute(
            delete(NodeModel).where(NodeModel.id == aggregate.id)
        )

    async def list(
        self,
        skip: int = 0,
        limit: int = 100,
        **filters: Any,
    ) -> tuple[list[Node], int]:
        query = select(NodeModel)
        count_query = select(func.count(NodeModel.id))

        if "status" in filters:
            query = query.where(NodeModel.status == filters["status"])
            count_query = count_query.where(NodeModel.status == filters["status"])
        if "is_healthy" in filters:
            query = query.where(NodeModel.is_healthy == filters["is_healthy"])
            count_query = count_query.where(NodeModel.is_healthy == filters["is_healthy"])
        if "region" in filters:
            query = query.where(NodeModel.region == filters["region"])
            count_query = count_query.where(NodeModel.region == filters["region"])

        count_result = await self.session.execute(count_query)
        total = count_result.scalar() or 0

        query = query.offset(skip).limit(limit).order_by(NodeModel.created_at.desc())
        result = await self.session.execute(query)
        models = result.scalars().all()

        return [self._model_to_entity(m) for m in models], total

    async def find_best_node(self, required_disk_mb: int = 1024) -> Optional[Node]:
        """Find the node with the most available disk space."""
        query = (
            select(NodeModel)
            .where(
                and_(
                    NodeModel.status == "active",
                    NodeModel.is_healthy == True,
                    (NodeModel.disk_total_mb - NodeModel.current_disk_usage) > required_disk_mb,
                )
            )
            .order_by(
                (NodeModel.disk_total_mb - NodeModel.current_disk_usage).desc()
            )
            .limit(1)
        )
        result = await self.session.execute(query)
        model = result.scalar_one_or_none()
        if not model:
            return None
        return self._model_to_entity(model)

    def _model_to_entity(self, model: NodeModel) -> Node:
        labels = {}
        if model.labels:
            try:
                labels = json.loads(model.labels)
            except (json.JSONDecodeError, TypeError):
                labels = {}

        return Node(
            id=model.id,
            name=model.name,
            host=model.host,
            port=model.port,
            ssh_port=model.ssh_port,
            docker_host=model.docker_host,
            api_token=model.api_token,
            api_token_hash=model.api_token_hash,
            status=NodeStatus(model.status),
            cpu_cores=model.cpu_cores,
            cpu_frequency_ghz=model.cpu_frequency_ghz,
            ram_total_mb=model.ram_total_mb,
            disk_total_mb=model.disk_total_mb,
            bandwidth_total_mb=model.bandwidth_total_mb,
            current_cpu_usage=model.current_cpu_usage,
            current_ram_usage=model.current_ram_usage,
            current_disk_usage=model.current_disk_usage,
            current_bandwidth_usage=model.current_bandwidth_usage,
            load_average_1m=model.load_average_1m,
            load_average_5m=model.load_average_5m,
            load_average_15m=model.load_average_15m,
            container_count=model.container_count,
            website_count=model.website_count,
            is_healthy=model.is_healthy,
            last_heartbeat=model.last_heartbeat,
            region=model.region,
            labels=labels,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )


class WebsiteRepository(SQLAlchemyRepository):
    """Repository for Website aggregates."""

    async def save(self, aggregate: Website) -> Website:
        model = WebsiteModel(
            id=aggregate.id,
            user_id=aggregate.user_id,
            plan_id=aggregate.plan_id,
            node_id=aggregate.node_id,
            domain=aggregate.domain,
            directory=aggregate.directory,
            docker_network=aggregate.docker_network,
            docker_compose_path=aggregate.docker_compose_path,
            mysql_database=aggregate.mysql_database,
            mysql_user=aggregate.mysql_user,
            mysql_password_encrypted=aggregate.mysql_password_encrypted,
            mysql_host=aggregate.mysql_host,
            mysql_port=aggregate.mysql_port,
            redis_host=aggregate.redis_host,
            redis_port=aggregate.redis_port,
            redis_password_encrypted=aggregate.redis_password_encrypted,
            wp_admin_user=aggregate.wp_admin_user,
            wp_admin_password_encrypted=aggregate.wp_admin_password_encrypted,
            wp_admin_email=aggregate.wp_admin_email,
            wp_secret_keys_encrypted=aggregate.wp_secret_keys_encrypted,
            php_version=aggregate.php_version,
            ssl_status=aggregate.ssl_status.value,
            ssl_certificate_expiry=aggregate.ssl_certificate_expiry,
            status=aggregate.status.value,
            disk_usage_mb=aggregate.disk_usage_mb,
            ram_usage_mb=aggregate.ram_usage_mb,
            cpu_usage=aggregate.cpu_usage,
            bandwidth_usage_mb=aggregate.bandwidth_usage_mb,
            disk_quota_mb=aggregate.disk_quota_mb,
            docker_container_id=aggregate.docker_container_id,
            docker_image=aggregate.docker_image,
            traefik_router_name=aggregate.traefik_router_name,
            order_id=aggregate.order_id,
            installed_plugins=json.dumps(aggregate.installed_plugins) if aggregate.installed_plugins else None,
            installed_theme=aggregate.installed_theme,
            woocommerce_enabled=aggregate.woocommerce_enabled,
            redis_enabled=aggregate.redis_enabled,
            auto_backup_enabled=aggregate.auto_backup_enabled,
            last_backup_at=aggregate.last_backup_at,
            suspended_at=aggregate.suspended_at,
            suspended_reason=aggregate.suspended_reason,
        )
        self.session.add(model)
        await self.session.flush()
        return aggregate

    async def get_by_id(self, id: str) -> Optional[Website]:
        result = await self.session.execute(
            select(WebsiteModel)
            .options(selectinload(WebsiteModel.user), selectinload(WebsiteModel.plan), selectinload(WebsiteModel.node))
            .where(WebsiteModel.id == id)
        )
        model = result.scalar_one_or_none()
        if not model:
            return None
        return self._model_to_entity(model)

    async def get_by_domain(self, domain: str) -> Optional[Website]:
        result = await self.session.execute(
            select(WebsiteModel).where(WebsiteModel.domain == domain)
        )
        model = result.scalar_one_or_none()
        if not model:
            return None
        return self._model_to_entity(model)

    async def delete(self, aggregate: Website) -> None:
        await self.session.execute(
            delete(WebsiteModel).where(WebsiteModel.id == aggregate.id)
        )

    async def list(
        self,
        skip: int = 0,
        limit: int = 100,
        **filters: Any,
    ) -> tuple[list[Website], int]:
        query = select(WebsiteModel)
        count_query = select(func.count(WebsiteModel.id))

        if "user_id" in filters:
            query = query.where(WebsiteModel.user_id == filters["user_id"])
            count_query = count_query.where(WebsiteModel.user_id == filters["user_id"])
        if "node_id" in filters:
            query = query.where(WebsiteModel.node_id == filters["node_id"])
            count_query = count_query.where(WebsiteModel.node_id == filters["node_id"])
        if "status" in filters:
            query = query.where(WebsiteModel.status == filters["status"])
            count_query = count_query.where(WebsiteModel.status == filters["status"])
        if "domain" in filters:
            query = query.where(WebsiteModel.domain.ilike(f"%{filters['domain']}%"))
            count_query = count_query.where(WebsiteModel.domain.ilike(f"%{filters['domain']}%"))

        count_result = await self.session.execute(count_query)
        total = count_result.scalar() or 0

        query = query.offset(skip).limit(limit).order_by(WebsiteModel.created_at.desc())
        result = await self.session.execute(query)
        models = result.scalars().all()

        return [self._model_to_entity(m) for m in models], total

    def _model_to_entity(self, model: WebsiteModel) -> Website:
        plugins = []
        if model.installed_plugins:
            try:
                plugins = json.loads(model.installed_plugins)
            except (json.JSONDecodeError, TypeError):
                plugins = []

        return Website(
            id=model.id,
            user_id=model.user_id,
            plan_id=model.plan_id,
            node_id=model.node_id,
            domain=model.domain,
            directory=model.directory,
            docker_network=model.docker_network,
            docker_compose_path=model.docker_compose_path,
            mysql_database=model.mysql_database,
            mysql_user=model.mysql_user,
            mysql_password_encrypted=model.mysql_password_encrypted,
            mysql_host=model.mysql_host,
            mysql_port=model.mysql_port,
            redis_host=model.redis_host,
            redis_port=model.redis_port,
            redis_password_encrypted=model.redis_password_encrypted,
            wp_admin_user=model.wp_admin_user,
            wp_admin_password_encrypted=model.wp_admin_password_encrypted,
            wp_admin_email=model.wp_admin_email,
            wp_secret_keys_encrypted=model.wp_secret_keys_encrypted,
            php_version=model.php_version,
            ssl_status=SSLStatus(model.ssl_status),
            ssl_certificate_expiry=model.ssl_certificate_expiry,
            status=WebsiteStatus(model.status),
            disk_usage_mb=model.disk_usage_mb,
            ram_usage_mb=model.ram_usage_mb,
            cpu_usage=model.cpu_usage,
            bandwidth_usage_mb=model.bandwidth_usage_mb,
            disk_quota_mb=model.disk_quota_mb,
            docker_container_id=model.docker_container_id,
            docker_image=model.docker_image,
            traefik_router_name=model.traefik_router_name,
            order_id=model.order_id,
            installed_plugins=plugins,
            installed_theme=model.installed_theme,
            woocommerce_enabled=model.woocommerce_enabled,
            redis_enabled=model.redis_enabled,
            auto_backup_enabled=model.auto_backup_enabled,
            last_backup_at=model.last_backup_at,
            suspended_at=model.suspended_at,
            suspended_reason=model.suspended_reason,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )


class OrderRepository(SQLAlchemyRepository):
    """Repository for Order aggregates."""

    async def save(self, aggregate: Order) -> Order:
        model = OrderModel(
            id=aggregate.id,
            user_id=aggregate.user_id,
            plan_id=aggregate.plan_id,
            website_id=aggregate.website_id,
            order_number=aggregate.order_number,
            status=aggregate.status.value,
            total_amount=aggregate.total_amount,
            tax_amount=aggregate.tax_amount,
            discount_amount=aggregate.discount_amount,
            coupon_code=aggregate.coupon_code,
            billing_cycle=aggregate.billing_cycle.value,
            next_billing_date=aggregate.next_billing_date,
            paid_at=aggregate.paid_at,
            cancelled_at=aggregate.cancelled_at,
            notes=aggregate.notes,
        )
        self.session.add(model)
        await self.session.flush()
        return aggregate

    async def get_by_id(self, id: str) -> Optional[Order]:
        result = await self.session.execute(
            select(OrderModel).where(OrderModel.id == id)
        )
        model = result.scalar_one_or_none()
        if not model:
            return None
        return self._model_to_entity(model)

    async def get_by_order_number(self, order_number: str) -> Optional[Order]:
        result = await self.session.execute(
            select(OrderModel).where(OrderModel.order_number == order_number)
        )
        model = result.scalar_one_or_none()
        if not model:
            return None
        return self._model_to_entity(model)

    async def delete(self, aggregate: Order) -> None:
        await self.session.execute(
            delete(OrderModel).where(OrderModel.id == aggregate.id)
        )

    async def list(
        self,
        skip: int = 0,
        limit: int = 100,
        **filters: Any,
    ) -> tuple[list[Order], int]:
        query = select(OrderModel)
        count_query = select(func.count(OrderModel.id))

        if "user_id" in filters:
            query = query.where(OrderModel.user_id == filters["user_id"])
            count_query = count_query.where(OrderModel.user_id == filters["user_id"])
        if "status" in filters:
            query = query.where(OrderModel.status == filters["status"])
            count_query = count_query.where(OrderModel.status == filters["status"])

        count_result = await self.session.execute(count_query)
        total = count_result.scalar() or 0

        query = query.offset(skip).limit(limit).order_by(OrderModel.created_at.desc())
        result = await self.session.execute(query)
        models = result.scalars().all()

        return [self._model_to_entity(m) for m in models], total

    def _model_to_entity(self, model: OrderModel) -> Order:
        return Order(
            id=model.id,
            user_id=model.user_id,
            plan_id=model.plan_id,
            website_id=model.website_id,
            order_number=model.order_number,
            status=OrderStatus(model.status),
            total_amount=model.total_amount,
            tax_amount=model.tax_amount,
            discount_amount=model.discount_amount,
            coupon_code=model.coupon_code,
            billing_cycle=BillingCycle(model.billing_cycle),
            next_billing_date=model.next_billing_date,
           paid_at=model.paid_at,
            cancelled_at=model.cancelled_at,
            notes=model.notes,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )


class BackupRepository(SQLAlchemyRepository):
    """Repository for Backup aggregates."""

    async def save(self, aggregate: Backup) -> Backup:
        model = BackupModel(
            id=aggregate.id,
            website_id=aggregate.website_id,
            name=aggregate.name,
            type=aggregate.type.value,
            size_mb=aggregate.size_mb,
            path=aggregate.path,
            storage_type=aggregate.storage_type,
            status=aggregate.status.value,
            checksum=aggregate.checksum,
            is_automated=aggregate.is_automated,
            retention_until=aggregate.retention_until,
            completed_at=aggregate.completed_at,
        )
        self.session.add(model)
        await self.session.flush()
        return aggregate

    async def get_by_id(self, id: str) -> Optional[Backup]:
        result = await self.session.execute(
            select(BackupModel).where(BackupModel.id == id)
        )
        model = result.scalar_one_or_none()
        if not model:
            return None
        return self._model_to_entity(model)

    async def delete(self, aggregate: Backup) -> None:
        await self.session.execute(
            delete(BackupModel).where(BackupModel.id == aggregate.id)
        )

    async def list(
        self,
        skip: int = 0,
        limit: int = 100,
        **filters: Any,
    ) -> tuple[list[Backup], int]:
        query = select(BackupModel)
        count_query = select(func.count(BackupModel.id))

        if "website_id" in filters:
            query = query.where(BackupModel.website_id == filters["website_id"])
            count_query = count_query.where(BackupModel.website_id == filters["website_id"])
        if "status" in filters:
            query = query.where(BackupModel.status == filters["status"])
            count_query = count_query.where(BackupModel.status == filters["status"])

        count_result = await self.session.execute(count_query)
        total = count_result.scalar() or 0

        query = query.offset(skip).limit(limit).order_by(BackupModel.created_at.desc())
        result = await self.session.execute(query)
        models = result.scalars().all()

        return [self._model_to_entity(m) for m in models], total

    def _model_to_entity(self, model: BackupModel) -> Backup:
        return Backup(
            id=model.id,
            website_id=model.website_id,
            name=model.name,
            type=BackupType(model.type),
            size_mb=model.size_mb,
            path=model.path,
            storage_type=model.storage_type,
            status=BackupStatus(model.status),
            checksum=model.checksum,
            is_automated=model.is_automated,
            retention_until=model.retention_until,
            completed_at=model.completed_at,
            created_at=model.created_at,
        )


class UnitOfWorkImpl:
    """SQLAlchemy implementation of Unit of Work pattern."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.users: UserRepository = UserRepository(session)
        self.plans: HostingPlanRepository = HostingPlanRepository(session)
        self.nodes: NodeRepository = NodeRepository(session)
        self.websites: WebsiteRepository = WebsiteRepository(session)
        self.orders: OrderRepository = OrderRepository(session)
        self.backups: BackupRepository = BackupRepository(session)

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()

    async def close(self) -> None:
        await self.session.close()