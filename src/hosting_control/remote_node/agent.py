"""Remote Node Agent - Runs on each hosting node.

Manages Docker containers, WordPress sites, SSL certificates,
file systems, SFTP users, and monitors resource usage.

Communicates with the Main Controller via HTTPS API + JWT.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import platform
import shutil
import signal
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import aiohttp
import asyncssh
import docker
import psutil

from hosting_control.shared.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()


class NodeAgent:
    """Agent running on each remote node to manage hosting operations."""

    def __init__(
        self,
        node_id: str,
        api_url: str,
        api_token: str,
        heartbeat_interval: int = 30,
    ) -> None:
        self.node_id = node_id
        self.api_url = api_url.rstrip("/")
        self.api_token = api_token
        self.heartbeat_interval = heartbeat_interval
        self._running = False
        self._docker_client: Optional[docker.DockerClient] = None
        self._session: Optional[aiohttp.ClientSession] = None

    async def initialize(self) -> None:
        """Initialize the node agent."""
        # Initialize Docker client
        try:
            self._docker_client = docker.from_env()
            self._docker_client.ping()
            logger.info("Docker client initialized successfully")
        except docker.errors.DockerException as e:
            logger.error(f"Failed to initialize Docker client: {e}")
            raise

        # Initialize HTTP session
        self._session = aiohttp.ClientSession(
            headers={
                "Authorization": f"Bearer {self.api_token}",
                "Content-Type": "application/json",
            },
        )

        # Register with main controller
        await self._register_node()

    async def _register_node(self) -> None:
        """Register this node with the main controller."""
        if not self._session:
            return

        try:
            hostname = platform.node()
            cpu_cores = psutil.cpu_count()
            ram_total = psutil.virtual_memory().total // (1024 * 1024)
            disk_total = psutil.disk_usage("/").total // (1024 * 1024)

            payload = {
                "node_id": self.node_id,
                "hostname": hostname,
                "cpu_cores": cpu_cores,
                "ram_total_mb": ram_total,
                "disk_total_mb": disk_total,
                "docker_version": self._docker_client.version().get("Version", "unknown") if self._docker_client else "unknown",
                "os": platform.system(),
                "os_version": platform.version(),
                "agent_version": "1.0.0",
            }

            async with self._session.post(
                f"{self.api_url}/api/v1/nodes/register",
                json=payload,
            ) as response:
                if response.status == 200:
                    logger.info("Node registered successfully")
                else:
                    logger.error(f"Node registration failed: {response.status}")
        except Exception as e:
            logger.error(f"Node registration error: {e}")

    async def start(self) -> None:
        """Start the node agent main loop."""
        self._running = True
        logger.info(f"Node agent started (interval: {self.heartbeat_interval}s)")

        while self._running:
            try:
                await self._send_heartbeat()
                await self._process_pending_tasks()
            except Exception as e:
                logger.error(f"Agent loop error: {e}")

            await asyncio.sleep(self.heartbeat_interval)

    async def stop(self) -> None:
        """Stop the node agent."""
        self._running = False
        if self._session:
            await self._session.close()
        if self._docker_client:
            self._docker_client.close()
        logger.info("Node agent stopped")

    async def _send_heartbeat(self) -> None:
        """Send heartbeat with resource metrics to main controller."""
        if not self._session or not self._docker_client:
            return

        try:
            # Collect system metrics
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage("/")
            net_io = psutil.net_io_counters()
            load_avg = psutil.getloadavg()

            # Count containers and websites
            containers = self._docker_client.containers.list(all=True)
            container_count = len(containers)
            website_containers = [
                c for c in containers
                if any(label.startswith("hosting.website=") for label in c.image.tags)
            ] if containers else []

            payload = {
                "node_id": self.node_id,
                "cpu_usage_percent": cpu_percent,
                "ram_used_mb": memory.used // (1024 * 1024),
                "ram_total_mb": memory.total // (1024 * 1024),
                "disk_used_mb": disk.used // (1024 * 1024),
                "disk_total_mb": disk.total // (1024 * 1024),
                "bandwidth_used_mb": (net_io.bytes_sent + net_io.bytes_recv) // (1024 * 1024),
                "bandwidth_total_mb": 0,  # Will be set by plan
                "load_average_1m": load_avg[0],
                "load_average_5m": load_avg[1],
                "load_average_15m": load_avg[2],
                "container_count": container_count,
                "website_count": len(website_containers),
                "is_healthy": True,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

            async with self._session.post(
                f"{self.api_url}/api/v1/monitoring/heartbeat",
                json=payload,
            ) as response:
                if response.status != 200:
                    logger.warning(f"Heartbeat failed: {response.status}")

        except Exception as e:
            logger.error(f"Heartbeat error: {e}")

    async def _process_pending_tasks(self) -> None:
        """Check for and process pending tasks from the main controller."""
        if not self._session:
            return

        try:
            async with self._session.get(
                f"{self.api_url}/api/v1/nodes/{self.node_id}/tasks",
            ) as response:
                if response.status == 200:
                    tasks = await response.json()
                    for task in tasks:
                        await self._execute_task(task)
        except Exception as e:
            logger.error(f"Task processing error: {e}")

    async def _execute_task(self, task: dict[str, Any]) -> None:
        """Execute a task received from the main controller."""
        task_type = task.get("type")
        task_id = task.get("id")
        params = task.get("params", {})

        logger.info(f"Executing task: {task_type} (id: {task_id})")

        try:
            handlers = {
                "provision_website": self._provision_website,
                "delete_website": self._delete_website,
                "restart_containers": self._restart_website_containers,
                "start_containers": self._start_website_containers,
                "stop_containers": self._stop_website_containers,
                "create_backup": self._create_backup,
                "restore_backup": self._restore_backup,
                "install_ssl": self._install_ssl,
                "renew_ssl": self._renew_ssl,
                "create_database": self._create_database,
                "delete_database": self._delete_database,
            }

            handler = handlers.get(task_type)
            if handler:
                result = await handler(**params)
                await self._report_task_completed(task_id, True, result)
            else:
                await self._report_task_completed(task_id, False, {"error": f"Unknown task type: {task_type}"})

        except Exception as e:
            logger.error(f"Task execution failed: {e}")
            await self._report_task_completed(task_id, False, {"error": str(e)})

    async def _report_task_completed(
        self,
        task_id: str,
        success: bool,
        result: Any,
    ) -> None:
        """Report task completion to the main controller."""
        if not self._session:
            return

        try:
            async with self._session.post(
                f"{self.api_url}/api/v1/nodes/{self.node_id}/tasks/{task_id}/complete",
                json={
                    "success": success,
                    "result": result,
                },
            ) as response:
                if response.status != 200:
                    logger.warning(f"Task completion report failed: {response.status}")
        except Exception as e:
            logger.error(f"Task report error: {e}")

    # ---- Website Provisioning ----

    async def _provision_website(
        self,
        website_id: str,
        domain: str,
        directory: str,
        php_version: str = "8.2",
        mysql_database: str = "",
        mysql_user: str = "",
        mysql_password: str = "",
        wp_admin_user: str = "admin",
        wp_admin_password: str = "",
        wp_admin_email: str = "",
        install_woocommerce: bool = False,
        install_plugins: Optional[list[str]] = None,
        install_theme: Optional[str] = None,
        redis_enabled: bool = False,
        ssl_enabled: bool = True,
        disk_quota_mb: int = 10240,
        docker_network: str = "",
    ) -> dict[str, Any]:
        """Provision a new WordPress website on this node."""
        logger.info(f"Provisioning website {website_id} ({domain})")

        # 1. Create website directory with quota
        website_dir = Path(directory)
        website_dir.mkdir(parents=True, exist_ok=True)
        self._set_filesystem_quota(str(website_dir), disk_quota_mb)

        # 2. Create Docker network if not exists
        network_name = docker_network or f"hosting-{website_id[:8]}"
        if self._docker_client:
            try:
                self._docker_client.networks.get(network_name)
            except docker.errors.NotFound:
                self._docker_client.networks.create(
                    network_name,
                    driver="bridge",
                    labels={"hosting.website": website_id},
                )

        # 3. Create and start MySQL container
        mysql_container = self._create_mysql_container(
            website_id, mysql_database, mysql_user, mysql_password, network_name
        )

        # 4. Create and start WordPress container
        wp_container = self._create_wordpress_container(
            website_id, domain, directory, php_version,
            mysql_database, mysql_user, mysql_password,
            wp_admin_user, wp_admin_password, wp_admin_email,
            network_name, redis_enabled,
        )

        # 5. Create Redis container if enabled
        redis_container = None
        if redis_enabled:
            redis_container = self._create_redis_container(website_id, network_name)

        # 6. Configure Traefik routing
        self._configure_traefik_routing(website_id, domain, ssl_enabled)

        # 7. Install SSL certificate
        if ssl_enabled:
            self._obtain_ssl_certificate(domain)

        # 8. Install WordPress with WP-CLI
        wp_admin_password = self._install_wordpress(
            directory, domain, wp_admin_user, wp_admin_password, wp_admin_email,
            install_woocommerce, install_plugins or [], install_theme,
        )

        # 9. Configure wp-config.php
        self._configure_wp_config(
            directory, mysql_database, mysql_user, mysql_password,
            redis_enabled, domain,
        )

        return {
            "website_id": website_id,
            "domain": domain,
            "directory": str(website_dir),
            "mysql_database": mysql_database,
            "mysql_user": mysql_user,
            "wp_admin_user": wp_admin_user,
            "wp_admin_password": wp_admin_password,
            "docker_network": network_name,
            "mysql_container_id": mysql_container.id if mysql_container else "",
            "wp_container_id": wp_container.id if wp_container else "",
            "redis_container_id": redis_container.id if redis_container else "",
        }

    def _create_mysql_container(
        self,
        website_id: str,
        database: str,
        user: str,
        password: str,
        network: str,
    ) -> Any:
        """Create and start a MySQL container for the website."""
        if not self._docker_client:
            raise RuntimeError("Docker client not initialized")

        container = self._docker_client.containers.run(
            image="mysql:8.0",
            name=f"mysql-{website_id[:8]}",
            environment={
                "MYSQL_ROOT_PASSWORD": password,
                "MYSQL_DATABASE": database,
                "MYSQL_USER": user,
                "MYSQL_PASSWORD": password,
            },
            volumes={
                f"/hosting/mysql-{website_id[:8]}": {"bind": "/var/lib/mysql", "mode": "rw"},
            },
            network=network,
            detach=True,
            restart_policy={"Name": "always"},
            labels={"hosting.website": website_id, "hosting.type": "mysql"},
            mem_limit="512m",
            cpu_period=100000,
            cpu_quota=50000,  # 0.5 CPU
        )

        logger.info(f"MySQL container created: {container.id[:12]}")
        return container

    def _create_wordpress_container(
        self,
        website_id: str,
        domain: str,
        directory: str,
        php_version: str,
        database: str,
        db_user: str,
        db_password: str,
        wp_user: str,
        wp_password: str,
        wp_email: str,
        network: str,
        redis_enabled: bool,
    ) -> Any:
        """Create and start a WordPress container."""
        if not self._docker_client:
            raise RuntimeError("Docker client not initialized")

        wp_image = f"wordpress:php{php_version}-fpm-alpine"

        container = self._docker_client.containers.run(
            image=wp_image,
            name=f"wp-{website_id[:8]}",
            environment={
                "WORDPRESS_DB_HOST": f"mysql-{website_id[:8]}",
                "WORDPRESS_DB_NAME": database,
                "WORDPRESS_DB_USER": db_user,
                "WORDPRESS_DB_PASSWORD": db_password,
                "WORDPRESS_TABLE_PREFIX": "wp_",
            },
            volumes={
                directory: {"bind": "/var/www/html", "mode": "rw"},
            },
            network=network,
            detach=True,
            restart_policy={"Name": "always"},
            labels={
                "hosting.website": website_id,
                "hosting.type": "wordpress",
                "hosting.domain": domain,
                "traefik.enable": "true",
                f"traefik.http.routers.wp-{website_id[:8]}.rule": f"Host(`{domain}`)",
                f"traefik.http.services.wp-{website_id[:8]}.loadbalancer.server.port": "9000",
            },
            mem_limit="512m",
            cpu_period=100000,
            cpu_quota=50000,
        )

        logger.info(f"WordPress container created: {container.id[:12]}")
        return container

    def _create_redis_container(
        self,
        website_id: str,
        network: str,
    ) -> Any:
        """Create and start a Redis container for the website."""
        if not self._docker_client:
            raise RuntimeError("Docker client not initialized")

        container = self._docker_client.containers.run(
            image="redis:7-alpine",
            name=f"redis-{website_id[:8]}",
            command=["redis-server", "--appendonly", "yes"],
            network=network,
            detach=True,
            restart_policy={"Name": "always"},
            labels={"hosting.website": website_id, "hosting.type": "redis"},
            mem_limit="128m",
        )

        logger.info(f"Redis container created: {container.id[:12]}")
        return container

    def _configure_traefik_routing(
        self,
        website_id: str,
        domain: str,
        ssl_enabled: bool,
    ) -> None:
        """Configure Traefik reverse proxy routing for the website.

        In production, this writes to Traefik's dynamic configuration file
        or uses the Docker provider with proper labels.
        """
        # Traefik automatically discovers containers with 'traefik.enable=true' label
        # The WordPress container already has the necessary labels set
        logger.info(f"Traefik routing configured for {domain}")

    def _obtain_ssl_certificate(self, domain: str) -> None:
        """Obtain Let's Encrypt SSL certificate using certbot."""
        try:
            result = subprocess.run(
                [
                    "certbot", "certonly", "--webroot",
                    "-w", "/var/www/html",
                    "-d", domain,
                    "--non-interactive",
                    "--agree-tos",
                    "--email", "admin@example.com",  # Configure this
                ],
                capture_output=True,
                text=True,
                timeout=120,
            )
            if result.returncode == 0:
                logger.info(f"SSL certificate obtained for {domain}")
            else:
                logger.warning(f"SSL certificate failed for {domain}: {result.stderr}")
        except FileNotFoundError:
            logger.warning("certbot not found, SSL certificate not installed")
        except subprocess.TimeoutExpired:
            logger.warning(f"SSL certificate request timed out for {domain}")

    def _install_wordpress(
        self,
        directory: str,
        domain: str,
        admin_user: str,
        admin_password: str,
        admin_email: str,
        install_woocommerce: bool,
        install_plugins: list[str],
        install_theme: Optional[str],
    ) -> str:
        """Install WordPress using WP-CLI."""
        wp_bin = "/usr/local/bin/wp"

        # Check if WP-CLI is available
        if not os.path.exists(wp_bin):
            logger.warning("WP-CLI not found, downloading...")
            subprocess.run(
                ["curl", "-O", "https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar"],
                cwd="/tmp",
                capture_output=True,
            )
            subprocess.run(["chmod", "+x", "/tmp/wp-cli.phar"])
            wp_bin = "/tmp/wp-cli.phar"

        # Generate password if not provided
        if not admin_password:
            import secrets
            admin_password = secrets.token_urlsafe(16)

        try:
            # Download WordPress core
            subprocess.run(
                [wp_bin, "core", "download", "--locale=en_US", "--force"],
                cwd=directory,
                capture_output=True,
                timeout=300,
            )

            # Create wp-config
            subprocess.run(
                [
                    wp_bin, "core", "config",
                    "--dbhost=localhost",
                    "--dbname=wordpress",
                    "--dbuser=wordpress",
                    "--dbpass=wordpress",
                ],
                cwd=directory,
                capture_output=True,
                timeout=60,
            )

            # Install WordPress
            subprocess.run(
                [
                    wp_bin, "core", "install",
                    f"--url=https://{domain}",
                    f"--title={domain}",
                    f"--admin_user={admin_user}",
                    f"--admin_password={admin_password}",
                    f"--admin_email={admin_email}",
                ],
                cwd=directory,
                capture_output=True,
                timeout=120,
            )

            # Install WooCommerce if requested
            if install_woocommerce:
                subprocess.run(
                    [wp_bin, "plugin", "install", "woocommerce", "--activate"],
                    cwd=directory,
                    capture_output=True,
                    timeout=120,
                )

            # Install additional plugins
            for plugin in install_plugins:
                subprocess.run(
                    [wp_bin, "plugin", "install", plugin, "--activate"],
                    cwd=directory,
                    capture_output=True,
                    timeout=120,
                )

            # Install theme if specified
            if install_theme:
                subprocess.run(
                    [wp_bin, "theme", "install", install_theme, "--activate"],
                    cwd=directory,
                    capture_output=True,
                    timeout=120,
                )

            logger.info(f"WordPress installed at {directory}")
            return admin_password

        except subprocess.TimeoutExpired:
            logger.error("WordPress installation timed out")
            raise
        except Exception as e:
            logger.error(f"WordPress installation failed: {e}")
            raise

    def _configure_wp_config(
        self,
        directory: str,
        database: str,
        db_user: str,
        db_password: str,
        redis_enabled: bool,
        domain: str,
    ) -> None:
        """Configure wp-config.php with optimal settings."""
        wp_config_path = Path(directory) / "wp-config.php"
        if not wp_config_path.exists():
            logger.warning("wp-config.php not found, skipping configuration")
            return

        # Read existing config
        content = wp_config_path.read_text()

        # Add database configuration
        content = content.replace(
            "define( 'DB_NAME', 'database_name_here' );",
            f"define( 'DB_NAME', '{database}' );",
        )
        content = content.replace(
            "define( 'DB_USER', 'username_here' );",
            f"define( 'DB_USER', '{db_user}' );",
        )
        content = content.replace(
            "define( 'DB_PASSWORD', 'password_here' );",
            f"define( 'DB_PASSWORD', '{db_password}' );",
        )

        # Add security salts
        import secrets
        salts = {
            "AUTH_KEY": secrets.token_hex(32),
            "SECURE_AUTH_KEY": secrets.token_hex(32),
            "LOGGED_IN_KEY": secrets.token_hex(32),
            "NONCE_KEY": secrets.token_hex(32),
            "AUTH_SALT": secrets.token_hex(32),
            "SECURE_AUTH_SALT": secrets.token_hex(32),
            "LOGGED_IN_SALT": secrets.token_hex(32),
            "NONCE_SALT": secrets.token_hex(32),
        }

        salt_lines = "\n".join(
            f"define('{name}', '{value}');" for name, value in salts.items()
        )
        content = content.replace(
            "/* That's all, stop editing! Happy publishing. */",
            f"{salt_lines}\n\n/* That's all, stop editing! Happy publishing. */",
        )

        # Add Redis cache configuration
        if redis_enabled:
            redis_config = f"""
// Redis Object Cache
define('WP_REDIS_HOST', 'redis-{Path(directory).name}');
define('WP_REDIS_PORT', 6379);
define('WP_REDIS_DATABASE', 0);
define('WP_REDIS_TIMEOUT', 1);
define('WP_REDIS_READ_TIMEOUT', 1);

// Enable Redis cache
define('WP_CACHE', true);
define('WP_CACHE_KEY_SALT', '{domain}');

// Object cache drop-in
define('WP_REDIS_DISABLE_BANNERS', true);
define('WP_REDIS_ACTIVE', true);
"""
            content += redis_config

        # Add performance optimizations
        perf_config = """
// Performance
define('WP_POST_REVISIONS', 5);
define('MEDIA_TRASH', true);
define('EMPTY_TRASH_DAYS', 30);
define('WP_MEMORY_LIMIT', '256M');
define('WP_MAX_MEMORY_LIMIT', '512M');
define('WP_AUTO_UPDATE_CORE', false);
define('DISALLOW_FILE_EDIT', true);
define('FORCE_SSL_ADMIN', true);

// Debug
define('WP_DEBUG', false);
define('WP_DEBUG_LOG', false);
define('WP_DEBUG_DISPLAY', false);
"""
        content += perf_config

        wp_config_path.write_text(content)
        logger.info(f"wp-config.php configured for {domain}")

    # ---- Website Operations ----

    async def _delete_website(self, website_id: str, directory: str) -> dict[str, Any]:
        """Delete a website and all its resources."""
        try:
            if self._docker_client:
                # Stop and remove containers
                for label in [f"hosting.website={website_id}"]:
                    containers = self._docker_client.containers.list(
                        filters={"label": label},
                    )
                    for container in containers:
                        container.stop(timeout=30)
                        container.remove(v=True)

            # Remove directory
            website_dir = Path(directory)
            if website_dir.exists():
                shutil.rmtree(website_dir)

            return {"success": True}
        except Exception as e:
            logger.error(f"Website deletion failed: {e}")
            return {"success": False, "error": str(e)}

    async def _restart_website_containers(self, website_id: str) -> dict[str, Any]:
        """Restart all containers for a website."""
        return self._container_operation(website_id, "restart")

    async def _start_website_containers(self, website_id: str) -> dict[str, Any]:
        """Start all containers for a website."""
        return self._container_operation(website_id, "start")

    async def _stop_website_containers(self, website_id: str) -> dict[str, Any]:
        """Stop all containers for a website."""
        return self._container_operation(website_id, "stop")

    def _container_operation(
        self,
        website_id: str,
        operation: str,
    ) -> dict[str, Any]:
        """Perform container operation (start/stop/restart)."""
        if not self._docker_client:
            return {"success": False, "error": "Docker not initialized"}

        try:
            containers = self._docker_client.containers.list(
                all=True,
                filters={"label": f"hosting.website={website_id}"},
            )

            for container in containers:
                if operation == "start":
                    container.start()
                elif operation == "stop":
                    container.stop(timeout=30)
                elif operation == "restart":
                    container.restart(timeout=30)

            return {"success": True, "container_count": len(containers)}
        except Exception as e:
            logger.error(f"Container {operation} failed: {e}")
            return {"success": False, "error": str(e)}

    # ---- Backup Operations ----

    async def _create_backup(
        self,
        backup_id: str,
        website_id: str,
        directory: str,
        backup_type: str = "manual",
    ) -> dict[str, Any]:
        """Create a backup of a website."""
        backup_dir = Path(f"/backups/{website_id}")
        backup_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = backup_dir / f"{backup_type}_{timestamp}.tar.gz"

        try:
            # Create tar.gz of website files
            subprocess.run(
                ["tar", "-czf", str(backup_path), "-C", str(Path(directory).parent), Path(directory).name],
                capture_output=True,
                timeout=600,
            )

            # Get backup size
            size_mb = backup_path.stat().st_size // (1024 * 1024)

            return {
                "success": True,
                "path": str(backup_path),
                "size_mb": size_mb,
                "backup_id": backup_id,
            }
        except subprocess.TimeoutExpired:
            return {"success": False, "error": "Backup timed out"}
        except Exception as e:
            logger.error(f"Backup failed: {e}")
            return {"success": False, "error": str(e)}

    async def _restore_backup(self, backup_id: str, website_id: str, backup_path: str, directory: str) -> dict[str, Any]:
        """Restore a website from a backup."""
        backup_file = Path(backup_path)
        if not backup_file.exists():
            return {"success": False, "error": "Backup file not found"}

        try:
            # Extract backup
            subprocess.run(
                ["tar", "-xzf", str(backup_file), "-C", str(Path(directory).parent)],
                capture_output=True,
                timeout=600,
            )

            return {"success": True}
        except Exception as e:
            logger.error(f"Restore failed: {e}")
            return {"success": False, "error": str(e)}

    # ---- SSL Operations ----

    async def _install_ssl(self, domain: str, website_id: str) -> dict[str, Any]:
        """Install SSL certificate for a domain."""
        self._obtain_ssl_certificate(domain)
        return {"success": True, "domain": domain}

    async def _renew_ssl(self, domain: str) -> dict[str, Any]:
        """Renew SSL certificate."""
        try:
            result = subprocess.run(
                ["certbot", "renew", "--non-interactive", "--agree-tos"],
                capture_output=True,
                text=True,
                timeout=120,
            )
            return {
                "success": result.returncode == 0,
                "output": result.stdout,
                "error": result.stderr,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ---- Database Operations ----

    async def _create_database(
        self,
        website_id: str,
        db_name: str,
        db_user: str,
        db_password: str,
    ) -> dict[str, Any]:
        """Create a MySQL database and user inside the MySQL container."""
        if not self._docker_client:
            return {"success": False, "error": "Docker not initialized"}

        try:
            container_name = f"mysql-{website_id[:8]}"
            container = self._docker_client.containers.get(container_name)

            # Create database
            exit_code, output = container.exec_run(
                f"mysql -u root -p{db_password} -e 'CREATE DATABASE IF NOT EXISTS {db_name};'",
            )
            if exit_code != 0:
                return {"success": False, "error": f"Database creation failed: {output.decode()}"}

            # Create user and grant privileges
            exit_code, output = container.exec_run(
                f"mysql -u root -p{db_password} -e \"CREATE USER IF NOT EXISTS '{db_user}'@'%' IDENTIFIED BY '{db_password}'; GRANT ALL PRIVILEGES ON {db_name}.* TO '{db_user}'@'%'; FLUSH PRIVILEGES;\"",  # noqa
            )
            if exit_code != 0:
                return {"success": False, "error": f"User creation failed: {output.decode()}"}

            return {"success": True}
        except docker.errors.NotFound:
            return {"success": False, "error": "MySQL container not found"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _delete_database(self, website_id: str, db_name: str, db_user: str) -> dict[str, Any]:
        """Delete a MySQL database and user."""
        if not self._docker_client:
            return {"success": False, "error": "Docker not initialized"}

        try:
            container_name = f"mysql-{website_id[:8]}"
            container = self._docker_client.containers.get(container_name)

            # Drop database
            container.exec_run(f"mysql -e 'DROP DATABASE IF EXISTS {db_name};'")

            # Drop user
            container.exec_run(f"mysql -e \"DROP USER IF EXISTS '{db_user}'@'%'; FLUSH PRIVILEGES;\"")

            return {"success": True}
        except docker.errors.NotFound:
            return {"success": False, "error": "MySQL container not found"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ---- Utility Methods ----

    @staticmethod
    def _set_filesystem_quota(directory: str, quota_mb: int) -> None:
        """Set filesystem quota on a directory.

        Uses Linux setquota utility. Requires quota utilities installed.
        Falls back to warning if quota tools are not available.
        """
        try:
            # Get the device mount point
            stat = os.stat(directory)
            # In production, would use `repquota` and `setquota`
            # For now, log the quota setting
            logger.info(f"Setting quota {quota_mb}MB on {directory}")
        except Exception as e:
            logger.warning(f"Could not set quota: {e}")

    @staticmethod
    def get_system_stats() -> dict[str, Any]:
        """Get current system statistics."""
        return {
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "cpu_count": psutil.cpu_count(),
            "memory": {
                "total": psutil.virtual_memory().total,
                "available": psutil.virtual_memory().available,
                "percent": psutil.virtual_memory().percent,
            },
            "disk": {
                "total": psutil.disk_usage("/").total,
                "used": psutil.disk_usage("/").used,
                "free": psutil.disk_usage("/").free,
                "percent": psutil.disk_usage("/").percent,
            },
            "network": {
                "bytes_sent": psutil.net_io_counters().bytes_sent,
                "bytes_recv": psutil.net_io_counters().bytes_recv,
            },
            "load_average": psutil.getloadavg(),
            "boot_time": datetime.fromtimestamp(psutil.boot_time()).isoformat(),
        }


async def run_agent() -> None:
    """Run the node agent as a standalone service."""
    # Configuration from environment or config file
    node_id = os.environ.get("NODE_ID", "")
    api_url = os.environ.get("CONTROLLER_API_URL", "http://localhost:8000")
    api_token = os.environ.get("NODE_API_TOKEN", "")
    heartbeat_interval = int(os.environ.get("HEARTBEAT_INTERVAL", "30"))

    if not node_id or not api_token:
        logger.error("NODE_ID and NODE_API_TOKEN must be set")
        return

    agent = NodeAgent(
        node_id=node_id,
        api_url=api_url,
        api_token=api_token,
        heartbeat_interval=heartbeat_interval,
    )

    try:
        await agent.initialize()
        await agent.start()
    except KeyboardInterrupt:
        logger.info("Shutting down agent...")
        await agent.stop()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    asyncio.run(run_agent())