"""Initial database schema

Revision ID: 001
Revises: 
Create Date: 2026-07-28 23:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create UUID extension
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    
    # ---- Users table ----
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("username", sa.String(100), unique=True, nullable=False, index=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="customer"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("two_factor_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("two_factor_secret", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # ---- Hosting Plans table ----
    op.create_table(
        "hosting_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("disk_space_mb", sa.Integer(), nullable=False),
        sa.Column("cpu_limit", sa.Integer(), nullable=False),
        sa.Column("ram_limit_mb", sa.Integer(), nullable=False),
        sa.Column("swap_mb", sa.Integer(), nullable=False, server_default="512"),
        sa.Column("bandwidth_mb", sa.Integer(), nullable=False),
        sa.Column("php_version", sa.String(10), nullable=False, server_default="8.2"),
        sa.Column("redis_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("woocommerce_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("container_limits", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("cron_limits", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("file_limits", sa.Integer(), nullable=False, server_default="50000"),
        sa.Column("sftp_users", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("backup_retention_days", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("ssl_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # ---- Nodes table ----
    op.create_table(
        "nodes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("host", sa.String(255), nullable=False),
        sa.Column("port", sa.Integer(), nullable=False, server_default="22"),
        sa.Column("ssh_port", sa.Integer(), nullable=False, server_default="22"),
        sa.Column("docker_host", sa.String(255), nullable=True),
        sa.Column("api_token", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("cpu_cores", sa.Integer(), nullable=False, server_default="4"),
        sa.Column("ram_total_mb", sa.Integer(), nullable=False, server_default="8192"),
        sa.Column("disk_total_mb", sa.Integer(), nullable=False, server_default="102400"),
        sa.Column("bandwidth_total_mb", sa.Integer(), nullable=False, server_default="1048576"),
        sa.Column("current_cpu_usage", sa.Float(), nullable=False, server_default="0"),
        sa.Column("current_ram_usage", sa.Float(), nullable=False, server_default="0"),
        sa.Column("current_disk_usage", sa.Float(), nullable=False, server_default="0"),
        sa.Column("current_bandwidth_usage", sa.Float(), nullable=False, server_default="0"),
        sa.Column("last_heartbeat", sa.DateTime(timezone=True), nullable=True),
        sa.Column("container_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("website_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # ---- Websites table ----
    op.create_table(
        "websites",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("hosting_plans.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("node_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("nodes.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("domain", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("directory", sa.String(255), nullable=False),
        sa.Column("docker_network", sa.String(100), nullable=True),
        sa.Column("mysql_database", sa.String(100), nullable=False),
        sa.Column("mysql_user", sa.String(100), nullable=False),
        sa.Column("mysql_password", sa.Text(), nullable=False),
        sa.Column("wp_admin_user", sa.String(100), nullable=False),
        sa.Column("wp_admin_password", sa.Text(), nullable=False),
        sa.Column("wp_admin_email", sa.String(255), nullable=False),
        sa.Column("ssl_status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("status", sa.String(20), nullable=False, server_default="creating"),
        sa.Column("disk_usage_mb", sa.Float(), nullable=False, server_default="0"),
        sa.Column("ram_usage_mb", sa.Float(), nullable=False, server_default="0"),
        sa.Column("cpu_usage", sa.Float(), nullable=False, server_default="0"),
        sa.Column("bandwidth_usage_mb", sa.Float(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # ---- Orders table ----
    op.create_table(
        "orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("hosting_plans.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("website_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("websites.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("payment_method", sa.String(50), nullable=True),
        sa.Column("payment_status", sa.String(20), nullable=False, server_default="unpaid"),
        sa.Column("invoice_url", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # ---- Tickets table ----
    op.create_table(
        "tickets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("priority", sa.String(20), nullable=False, server_default="normal"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # ---- Ticket Replies table ----
    op.create_table(
        "ticket_replies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    
    # ---- Backups table ----
    op.create_table(
        "backups",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("website_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("websites.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("type", sa.String(20), nullable=False, server_default="full"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("size_mb", sa.Float(), nullable=True),
        sa.Column("path", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    
    # ---- API Keys table ----
    op.create_table(
        "api_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("key", sa.String(64), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("permissions", sa.Text(), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    
    # ---- Indexes ----
    op.create_index("ix_websites_user_node", "websites", ["user_id", "node_id"])
    op.create_index("ix_orders_user_status", "orders", ["user_id", "status"])
    op.create_index("ix_tickets_user_status", "tickets", ["user_id", "status"])


def downgrade() -> None:
    op.drop_table("api_keys")
    op.drop_table("backups")
    op.drop_table("ticket_replies")
    op.drop_table("tickets")
    op.drop_table("orders")
    op.drop_table("websites")
    op.drop_table("nodes")
    op.drop_table("hosting_plans")
    op.drop_table("users")