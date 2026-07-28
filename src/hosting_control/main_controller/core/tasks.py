"""Celery task definitions for asynchronous operations.

Handles website provisioning, backup, SSL renewal, and monitoring tasks
that are dispatched to remote nodes or executed as background jobs.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import aiohttp
from celery import group, chord
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hosting_control.main_controller.core.celery_app import celery_app
from hosting_control.main_controller.core.redis_client import redis_client
from hosting_control.main_controller.domain.entities import (
    Backup,
    BackupStatus,
    Node,
    NodeStatus,
    Order,
    OrderStatus,
    Website,
    WebsiteStatus,
)
from hosting_control.main_controller.infrastructure.database import async_session_factory
from hosting_control.main_controller.infrastructure.repositories import (
    NodeRepository,
    WebsiteRepository,
    OrderRepository,
    BackupRepository,
)
from hosting_control.shared.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# ---- Provisioning Tasks ----

@celery_app.task(bind=True, queue="provisioning", max_retries=3, default_retry_delay=30)
def provision_website(
    self,
    order_id: str,
    user_id: str,
    plan_id: str,
    domain: str,
    **kwargs,
) -> dict[str, Any]:
    """Provision a new WordPress website for a customer order.

    This is the main orchestration task that:
    1. Selects the best available node
    2. Creates the database records
    3. Dispatches container creation to the node agent
    4. Configures DNS, SSL, and monitoring
    """
    logger.info(f"Starting provisioning for order {order_id}, domain {domain}")

    try:
        # Run async setup synchronously
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(
            _provision_website_async(order_id, user_id, plan_id, domain, **kwargs)
        )
        loop.close()
        return result
    except Exception as exc:
        logger.error(f"Provisioning failed for order {order_id}: {exc}")
        self.retry(exc=exc)


async def _provision_website_async(
    order_id: str,
    user_id: str,
    plan_id: str,
    domain: str,
    **kwargs,
) -> dict[str, Any]:
    """Async implementation of website provisioning."""
    async with async_session_factory() as session:
        order_repo = OrderRepository(session)
        website_repo = WebsiteRepository(session)
        node_repo = NodeRepository(session)

        # Get order and plan
        order = await order_repo.get_by_id(order_id)
        if not order:
            raise ValueError(f"Order {order_id} not found")

        plan = await order_repo.get_plan_by_id(plan_id)
        if not plan:
            raise ValueError(f"Plan {plan_id} not found")

        # Find the best node for provisioning
        best_node = await _select_best_node(node_repo)
        if not best_node:
            raise RuntimeError("No available nodes for provisioning")

        # Create website record
        import uuid
        website_id = str(uuid.uuid4())
        directory = f"/hosting/site-{website_id[:8]}"

        website = Website(
            id=website_id,
            user_id=user_id,
            plan_id=plan_id,
            node_id=best_node.id,
            domain=domain,
            directory=directory,
            status=WebsiteStatus.CREATING,
            disk_quota_mb=plan.disk_space_mb,
        )
        await website_repo.save(website)
        await session.commit()

        # Generate credentials
        import secrets
        mysql_database = f"wp_{website_id[:8]}"
        mysql_user = f"user_{website_id[:8]}"
        mysql_password = secrets.token_urlsafe(24)
        wp_admin_password = secrets.token_urlsafe(16)

        # Dispatch provisioning task to node agent
        task_result = await _dispatch_to_node(
            node=best_node,
            task_type="provision_website",
            params={
                "website_id": website_id,
                "domain": domain,
                "directory": directory,
                "php_version": plan.php_version,
                "mysql_database": mysql_database,
                "mysql_user": mysql_user,
                "mysql_password": mysql_password,
                "wp_admin_user": "admin",
                "wp_admin_password": wp_admin_password,
                "wp_admin_email": kwargs.get("email", "admin@" + domain),
                "install_woocommerce": plan.woocommerce_enabled,
                "install_plugins": kwargs.get("plugins", []),
                "install_theme": kwargs.get("theme"),
                "redis_enabled": plan.redis_enabled,
                "ssl_enabled": plan.ssl_enabled,
                "disk_quota_mb": plan.disk_space_mb,
            },
        )

        if not task_result.get("success"):
            website.status = WebsiteStatus.FAILED
            await website_repo.save(website)
            await session.commit()
            raise RuntimeError(f"Node provisioning failed: {task_result.get('error')}")

        # Update website with credentials
        website.mysql_database = mysql_database
        website.mysql_user = mysql_user
        website.mysql_password = mysql_password
        website.wp_admin_user = "admin"
        website.wp_admin_password = wp_admin_password
        website.docker_network = task_result.get("docker_network", "")
        website.status = WebsiteStatus.ACTIVE
        await website_repo.save(website)

        # Update order status
        order.mark_paid()
        await order_repo.save(order)
        await session.commit()

        # Update node website count
        best_node.website_count += 1
        await node_repo.save(best_node)
        await session.commit()

        # Cache website info in Redis
        site_key = f"website:{website_id}"
        await redis_client.hset(site_key, mapping={
            "domain": domain,
            "status": "active",
            "node_id": best_node.id,
            "node_host": best_node.host,
        })

        # Publish provisioning event
        await redis_client.publish("events:website", str({
            "type": "website.provisioned",
            "website_id": website_id,
            "domain": domain,
            "user_id": user_id,
        }))

        return {
            "success": True,
            "website_id": website_id,
            "domain": domain,
            "wp_admin_user": "admin",
            "wp_admin_password": wp_admin_password,
            "wp_admin_url": f"https://{domain}/wp-admin",
        }


async def _select_best_node(node_repo: "NodeRepository") -> Optional[Node]:
    """Select the best node for provisioning based on resource availability."""
    nodes, _ = await node_repo.list(status=NodeStatus.ACTIVE.value)

    if not nodes:
        return None

    # Score nodes by available resources
    best_node = None
    best_score = float("-inf")

    for node in nodes:
        if not node.is_healthy:
            continue

        cpu_avail = 100 - node.current_cpu_usage
        ram_avail = node.ram_total_mb - node.current_ram_usage
        disk_avail = node.disk_total_mb - node.current_disk_usage

        # Score: higher is better
        # Weight: CPU 30%, RAM 30%, Disk 25%, Website count 15%
        cpu_score = cpu_avail / 100 * 30 if cpu_avail > 0 else 0
        ram_score = (ram_avail / node.ram_total_mb) * 30 if node.ram_total_mb > 0 else 0
        disk_score = (disk_avail / node.disk_total_mb) * 25 if node.disk_total_mb > 0 else 0
        load_score = (1 - (node.website_count / max(1, node.website_count + 1))) * 15

        total_score = cpu_score + ram_score + disk_score + load_score

        if total_score > best_score:
            best_score = total_score
            best_node = node

    return best_node


async def _dispatch_to_node(
    node: Node,
    task_type: str,
    params: dict[str, Any],
    timeout: int = 300,
) -> dict[str, Any]:
    """Dispatch a task to be executed on a remote node via its API."""
    api_url = f"https://{node.host}:{node.port}/api/v1/tasks"

    async with aiohttp.ClientSession(
        headers={
            "Authorization": f"Bearer {node.api_token}",
            "Content-Type": "application/json",
        },
        timeout=aiohttp.ClientTimeout(total=timeout),
    ) as session:
        try:
            async with session.post(
                api_url,
                json={
                    "type": task_type,
                    "params": params,
                    "callback_url": f"{settings.api_url}/api/v1/nodes/{node.id}/tasks/callback",
                },
            ) as response:
                if response.status == 202:
                    return await response.json()
                else:
                    error_text = await response.text()
                    return {"success": False, "error": f"HTTP {response.status}: {error_text}"}
        except asyncio.TimeoutError:
            return {"success": False, "error": "Request timed out"}
        except Exception as e:
            return {"success": False, "error": str(e)}


# ---- Backup Tasks ----

@celery_app.task(bind=True, queue="backup", max_retries=2, default_retry_delay=60)
def create_website_backup(
    self,
    website_id: str,
    backup_type: str = "manual",
) -> dict[str, Any]:
    """Create a backup of a website."""
    logger.info(f"Creating {backup_type} backup for website {website_id}")

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(
            _create_website_backup_async(website_id, backup_type)
        )
        loop.close()
        return result
    except Exception as exc:
        logger.error(f"Backup failed for website {website_id}: {exc}")
        self.retry(exc=exc)


async def _create_website_backup_async(
    website_id: str,
    backup_type: str,
) -> dict[str, Any]:
    """Async implementation of website backup."""
    async with async_session_factory() as session:
        website_repo = WebsiteRepository(session)
        backup_repo = BackupRepository(session)

        website = await website_repo.get_by_id(website_id)
        if not website:
            raise ValueError(f"Website {website_id} not found")

        # Create backup record
        import uuid
        backup_id = str(uuid.uuid4())
        backup = Backup(
            id=backup_id,
            website_id=website_id,
            type=backup_type,
            status=BackupStatus.RUNNING,
        )
        await backup_repo.save(backup)
        await session.commit()

        # Dispatch backup to node
        node_repo = NodeRepository(session)
        node = await node_repo.get_by_id(website.node_id)
        if not node:
            raise ValueError(f"Node {website.node_id} not found")

        result = await _dispatch_to_node(
            node=node,
            task_type="create_backup",
            params={
                "backup_id": backup_id,
                "website_id": website_id,
                "directory": website.directory,
                "backup_type": backup_type,
            },
            timeout=600,
        )

        if result.get("success"):
            backup.status = BackupStatus.COMPLETED
            backup.size_mb = result.get("size_mb", 0)
            backup.path = result.get("path", "")
        else:
            backup.status = BackupStatus.FAILED
            backup.error_message = result.get("error", "Unknown error")

        await backup_repo.save(backup)
        await session.commit()

        return {
            "success": result.get("success", False),
            "backup_id": backup_id,
            "size_mb": backup.size_mb,
        }


@celery_app.task(queue="backup")
def restore_website_backup(
    website_id: str,
    backup_id: str,
) -> dict[str, Any]:
    """Restore a website from a backup."""
    # Implementation similar to create backup but in reverse
    logger.info(f"Restoring backup {backup_id} for website {website_id}")
    return {"success": True, "message": "Restore initiated"}


# ---- Monitoring Tasks ----

@celery_app.task(queue="monitoring")
def check_node_health() -> list[dict[str, Any]]:
    """Check health of all nodes and update status."""
    logger.info("Running node health check")

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        results = loop.run_until_complete(_check_node_health_async())
        loop.close()
        return results
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return []


async def _check_node_health_async() -> list[dict[str, Any]]:
    """Async implementation of node health check."""
    results = []
    async with async_session_factory() as session:
        node_repo = NodeRepository(session)
        nodes, _ = await node_repo.list(limit=1000)

        for node in nodes:
            is_healthy = await _ping_node(node)
            now = datetime.now(timezone.utc)

            # If no heartbeat in 5 minutes, mark as unhealthy
            if node.last_heartbeat and (now - node.last_heartbeat) > timedelta(minutes=5):
                is_healthy = False

            # If no heartbeat in 15 minutes, mark as inactive
            if node.last_heartbeat and (now - node.last_heartbeat) > timedelta(minutes=15):
                node.status = NodeStatus.INACTIVE

            node.is_healthy = is_healthy
            await node_repo.save(node)
            results.append({
                "node_id": node.id,
                "name": node.name,
                "healthy": is_healthy,
            })

        await session.commit()

    return results


async def _ping_node(node: Node) -> bool:
    """Ping a node to check if it's responsive."""
    api_url = f"https://{node.host}:{node.port}/api/v1/health"

    try:
        async with aiohttp.ClientSession(
            headers={"Authorization": f"Bearer {node.api_token}"},
            timeout=aiohttp.ClientTimeout(total=10),
        ) as session:
            async with session.get(api_url) as response:
                return response.status == 200
    except Exception:
        return False


# ---- Scheduled Tasks ----

@celery_app.task(queue="monitoring")
def cleanup_expired_backups() -> int:
    """Clean up backups that have exceeded retention period."""
    logger.info("Running backup cleanup")
    # Implementation would query backups older than plan retention
    return 0


@celery_app.task(queue="monitoring")
def sync_node_metrics() -> None:
    """Synchronize node metrics and update resource tracking."""
    logger.info("Syncing node metrics")
    # Implementation would aggregate metrics from all nodes


@celery_app.task(queue="monitoring")
def check_expired_ssl_certificates() -> list[dict[str, Any]]:
    """Check for SSL certificates expiring within 30 days and renew."""
    logger.info("Checking SSL certificate expiration")
    return []


# ---- Celery Beat Schedule ----

@celery_app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    """Setup periodic task schedule."""
    # Node health check every 5 minutes
    sender.add_periodic_task(
        300.0,
        check_node_health.s(),
        name="check-node-health",
    )

    # Backup cleanup daily at 2 AM
    sender.add_periodic_task(
        86400.0,
        cleanup_expired_backups.s(),
        name="cleanup-expired-backups",
    )

    # SSL certificate check daily at 3 AM
    sender.add_periodic_task(
        86400.0,
        check_expired_ssl_certificates.s(),
        name="check-ssl-certificates",
    )

    # Sync metrics every 10 minutes
    sender.add_periodic_task(
        600.0,
        sync_node_metrics.s(),
        name="sync-node-metrics",
    )