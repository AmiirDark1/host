# Distributed WordPress Hosting Control Panel - Architecture

## Overview
A production-ready distributed WordPress hosting control panel built entirely with Python backend and React frontend, following Clean Architecture and Domain-Driven Design principles.

## System Architecture

### Core Components

```
┌─────────────────────────────────────────────────────┐
│                  Main Controller                     │
│  (FastAPI + Celery + PostgreSQL + Redis)            │
│  - Authentication & Authorization                   │
│  - Plan Management                                  │
│  - Order Processing                                 │
│  - Monitoring & Analytics                           │
│  - API Gateway                                      │
└──────────────┬──────────────────────────────────────┘
               │ HTTPS API / JWT / WebSocket
               ▼
┌─────────────────────────────────────────────────────┐
│                  Remote Nodes                        │
│  (Docker + Traefik + WordPress + MySQL + Redis)      │
│  - Container Management                              │
│  - File System Management                            │
│  - SSL Certificate Management                        │
│  - Resource Monitoring                               │
└─────────────────────────────────────────────────────┘
```

## Design Decisions

### Why Clean Architecture?
- **Separation of Concerns**: Each layer (domain, application, infrastructure) has clear responsibilities
- **Testability**: Domain logic is isolated and testable without infrastructure dependencies
- **Maintainability**: Changes in one layer don't affect others
- **Scalability**: Each module can be independently scaled

### Why DDD (Domain-Driven Design)?
- **Ubiquitous Language**: Technical and business teams share common terminology
- **Bounded Contexts**: Each domain (Hosting, Billing, Monitoring) is isolated
- **Rich Domain Model**: Business logic lives in the domain, not scattered across services

### Why FastAPI?
- **Async Native**: Full async support for non-blocking operations
- **Auto-generated OpenAPI**: Built-in API documentation
- **Performance**: Comparable to Go and Node.js
- **Type Safety**: Full Pydantic integration

### Why Celery + Redis?
- **Distributed Task Queue**: Handle long-running operations (provisioning, backups)
- **Task Scheduling**: Cron jobs, periodic health checks
- **Result Backend**: Track task status and results

### Why Docker + Traefik?
- **Container Isolation**: Each website runs in its own container
- **Auto-reverse Proxy**: Traefik automatically routes domains
- **SSL Automation**: Let's Encrypt integration
- **Zero Downtime**: Rolling updates and health checks

## Module Structure

```
src/
├── main_controller/
│   ├── api/                    # FastAPI routes
│   │   ├── auth/              # Authentication endpoints
│   │   ├── hosting/           # Hosting management
│   │   ├── billing/           # Billing & payments
│   │   ├── monitoring/        # Monitoring & analytics
│   │   └── admin/             # Admin panel endpoints
│   ├── domain/
│   │   ├── entities/          # Domain entities
│   │   ├── value_objects/     # Value objects
│   │   ├── aggregates/        # Aggregates
│   │   └── events/            # Domain events
│   ├── application/
│   │   ├── services/          # Application services
│   │   ├── commands/          # Command handlers
│   │   ├── queries/           # Query handlers
│   │   └── dto/               # Data transfer objects
│   ├── infrastructure/
│   │   ├── persistence/       # Database repositories
│   │   ├── messaging/         # Message brokers
│   │   ├── cache/             # Caching layer
│   │   ├── storage/           # File storage
│   │   └── external/          # External services
│   └── core/
│       ├── config/            # Configuration
│       ├── exceptions/        # Custom exceptions
│       ├── middleware/        # Middleware
│       └── utils/             # Utilities
├── remote_node/
│   ├── agent/                 # Node agent service
│   ├── docker_manager/        # Docker operations
│   ├── file_manager/          # File system operations
│   ├── ssl_manager/           # SSL certificate management
│   ├── monitor/               # Resource monitoring
│   └── sftp_manager/          # SFTP user management
├── shared/
│   ├── ddd/                   # DDD base classes
│   ├── messaging/             # Shared messaging
│   └── security/              # Shared security
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

## Data Flow

### Website Provisioning Flow
1. User purchases plan → Order created
2. Main Controller validates payment & plan
3. Best node selected based on resource availability
4. Celery task dispatched to selected node
5. Node agent:
   a. Creates directory with quota
   b. Creates Docker network
   c. Deploys MySQL container with database
   d. Deploys WordPress container with mounted volume
   e. Deploys Redis container if enabled
   f. Configures Traefik routing
   g. Obtains SSL certificate
   h. Installs WordPress + plugins + theme
   i. Returns site credentials
6. Main Controller updates order status
7. User receives login information

## Security Architecture

- **JWT Authentication**: Short-lived access tokens + refresh tokens
- **RBAC**: Role-based access control (Admin, Customer, Node)
- **2FA**: Time-based One-Time Password (TOTP)
- **Rate Limiting**: Token bucket algorithm per user/IP
- **CSRF Protection**: Double submit cookie pattern
- **Encrypted Secrets**: AES-256-GCM for sensitive data
- **Audit Logging**: All administrative actions logged
- **Network Isolation**: Each node isolated in its own network
- **Filesystem Quotas**: Linux quota system for disk limits

## Database Schema (Core Tables)

```
users
├── id (UUID PK)
├── email (unique)
├── password_hash
├── role (admin/customer/node)
├── is_active
├── is_verified
├── two_factor_enabled
├── two_factor_secret
├── created_at
└── updated_at

hosting_plans
├── id (UUID PK)
├── name
├── disk_space_mb
├── cpu_limit
├── ram_limit_mb
├── swap_mb
├── bandwidth_mb
├── php_version
├── redis_enabled
├── woocommerce_enabled
├── container_limits
├── cron_limits
├── file_limits
├── sftp_users
├── backup_retention_days
├── ssl_enabled
├── price
├── is_active
└── created_at

nodes
├── id (UUID PK)
├── name
├── host
├── port
├── ssh_port
├── docker_host
├── api_token
├── status (active/inactive/drain/maintenance)
├── cpu_cores
├── ram_total_mb
├── disk_total_mb
├── bandwidth_total_mb
├── current_cpu_usage
├── current_ram_usage
├── current_disk_usage
├── current_bandwidth_usage
├── last_heartbeat
├── container_count
├── website_count
└── created_at

websites
├── id (UUID PK)
├── user_id (FK)
├── plan_id (FK)
├── node_id (FK)
├── domain
├── directory
├── docker_network
├── mysql_database
├── mysql_user
├── mysql_password
├── wp_admin_user
├── wp_admin_password
├── wp_admin_email
├── ssl_status
├── status (active/suspended/creating/deleting)
├── disk_usage_mb
├── ram_usage_mb
├── cpu_usage
├── bandwidth_usage_mb
├── created_at
└── updated_at
```

## API Design

All APIs follow RESTful conventions:
- `GET /api/v1/resources` - List resources
- `POST /api/v1/resources` - Create resource
- `GET /api/v1/resources/{id}` - Get resource
- `PUT /api/v1/resources/{id}` - Update resource
- `DELETE /api/v1/resources/{id}` - Delete resource

WebSocket events for real-time updates:
- `website.status` - Website status changes
- `node.health` - Node health updates
- `container.logs` - Live container logs
- `task.progress` - Long-running task progress

## Deployment

### Main Controller
- Docker Compose with PostgreSQL, Redis, Celery workers
- Kubernetes manifests for production
- Traefik reverse proxy with SSL

### Remote Nodes
- Docker Engine with Traefik
- WordPress, MySQL, Redis containers
- Monitoring agent
- File system quotas enabled