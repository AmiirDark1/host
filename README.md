# Distributed WordPress Hosting Control Panel

A production-ready, distributed WordPress hosting control panel built with Python (FastAPI) backend and React (TypeScript) frontend.

## Architecture Overview

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

## Features

### Core Features
- **One Main Controller** - Central management dashboard
- **Unlimited Remote Nodes** - Scale horizontally
- **Automatic Website Provisioning** - Deploy WordPress in minutes
- **Distributed Architecture** - SSH, Docker API, HTTPS API, JWT communication
- **Real-time Monitoring** - CPU, RAM, Disk, Bandwidth, Docker stats

### Hosting Plans
- Custom disk space, CPU, RAM limits
- PHP version selection
- Redis/WooCommerce enable/disable
- Container, cron, file limits
- Backup retention & SSL

### Customer Panel
- Registration, Login, 2FA
- Website management (Restart, Stop, Start, Rebuild, Clone)
- Backups & Restore
- File Manager
- SFTP Management
- Domains & SSL
- Database management
- Tickets & Notifications

### Admin Panel
- Dashboard with analytics
- User management
- Node management (Add, Remove, Enable, Disable, Drain)
- Plan management
- Order & Invoice management
- Wallet & Coupons
- System monitoring & alerts
- Audit logs

### Security
- JWT + Refresh Tokens
- RBAC (Role-Based Access Control)
- Two-Factor Authentication (TOTP)
- Rate Limiting
- CSRF Protection
- Audit Logging
- Encrypted Secrets Storage
- Docker Container Isolation
- Filesystem Quotas

## Technology Stack

### Backend
| Technology | Purpose |
|------------|---------|
| Python 3.13+ | Core language |
| FastAPI | REST API framework |
| SQLAlchemy 2.0 (async) | ORM |
| Alembic | Database migrations |
| Celery + Redis | Async task queue |
| Pydantic | Data validation |
| JWT (python-jose) | Authentication |
| Paramiko / AsyncSSH | SSH connections |
| Docker SDK | Container management |

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| TailwindCSS | Styling |
| Shadcn UI | Component library |
| React Query | Server state management |
| Zustand | Client state management |
| React Router | Routing |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| PostgreSQL 16 | Database |
| Redis 7 | Cache & message broker |
| Docker | Container engine |
| Traefik | Reverse proxy & SSL |
| Let's Encrypt | SSL certificates |
| Prometheus | Metrics collection |
| Grafana | Dashboards |
| MinIO / S3 | Object storage |

## Project Structure

```
├── src/
│   ├── hosting_control/
│   │   ├── shared/                    # Shared DDD, config, security
│   │   ├── main_controller/           # Main Controller API
│   │   │   ├── api/                   # FastAPI routes
│   │   │   ├── domain/               # Domain entities
│   │   │   ├── application/          # Application services
│   │   │   ├── infrastructure/       # Database, repositories
│   │   │   └── core/                 # Celery, Redis config
│   │   └── remote_node/              # Node agent
│   ├── alembic/                       # Database migrations
│   └── tests/                         # Test suite
├── frontend/                          # React frontend
├── docker/                            # Docker configurations
├── kubernetes/                        # Kubernetes manifests
├── docker-compose.yml                 # Main Controller stack
├── requirements.txt                   # Python dependencies
└── ARCHITECTURE.md                    # Detailed architecture
```

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Python 3.13+
- Node.js 20+

### Setup Environment
```bash
cp .env.example .env
# Edit .env with your secure passwords
```

### Start Main Controller
```bash
docker compose up -d
```

### Access Services
| Service | URL |
|---------|-----|
| API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| Grafana | http://localhost:3001 (admin/admin) |
| Prometheus | http://localhost:9090 |
| Flower (Celery) | http://localhost:5555 |

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

### Database Migrations
```bash
# Auto-applied on startup via Alembic
# Manual migration creation:
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/2fa/verify` - Verify 2FA
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/logout` - Logout

### Hosting
- `GET /api/v1/websites` - List websites
- `POST /api/v1/websites` - Create website
- `GET /api/v1/websites/{id}` - Get website details
- `POST /api/v1/websites/{id}/restart` - Restart website
- `POST /api/v1/websites/{id}/backup` - Create backup

### Admin
- `GET /api/v1/admin/users` - List users
- `GET /api/v1/admin/nodes` - List nodes
- `POST /api/v1/admin/nodes` - Add node
- `GET /api/v1/admin/plans` - List plans
- `POST /api/v1/admin/plans` - Create plan
- `GET /api/v1/admin/monitoring` - System monitoring

### Node Operations
- `POST /api/v1/admin/nodes/{id}/health-check` - Health check
- `POST /api/v1/admin/nodes/{id}/enable` - Enable node
- `POST /api/v1/admin/nodes/{id}/drain` - Drain mode
- `POST /api/v1/admin/nodes/{id}/maintenance` - Maintenance mode

## Architecture Details

See [ARCHITECTURE.md](ARCHITECTURE.md) for complete architecture documentation.

## Design Decisions

1. **Clean Architecture + DDD**: Separation of concerns, testable domain logic, scalable modules
2. **Async Everything**: Non-blocking operations for high throughput
3. **Filesystem Quotas**: WordPress files stored outside Docker for flexible scaling
4. **Task Queue (Celery)**: Long-running operations (provisioning, backups) handled asynchronously
5. **WebSocket**: Real-time monitoring and live container logs
6. **Modular Design**: Each feature is independent with its own REST API + WebSocket events

## Development

```bash
# Install Python dependencies
pip install -r requirements.txt

# Run tests
pytest

# Format code
ruff check .
ruff format .

# Type check
mypy src/
```

## Deployment Options

### Docker Compose (Development)
```bash
docker compose up -d
```

### Kubernetes (Production)
```bash
kubectl apply -f kubernetes/
```

## License

MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.