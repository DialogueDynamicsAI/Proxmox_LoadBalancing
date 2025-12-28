# ProxLB Web Interface - Architecture Plan

## Project Phases Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DEVELOPMENT ROADMAP                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PHASE 1: PROTOTYPE          PHASE 2: PRODUCTION                   │
│  ─────────────────           ───────────────────                   │
│  FastAPI + Vanilla JS   ──►  Django + React + PostgreSQL           │
│  Single container            Multi-container (Docker Compose)       │
│  No auth                     Full auth with roles                   │
│  File-based config           Database-backed                        │
│  Simple deployment           Nginx + SSL + Production ready         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Prototype/Test Version

### Purpose
- Validate UI/UX design
- Test API integrations with Proxmox
- Prove concept before major investment
- Quick iteration and feedback

### Technology Stack

| Component | Technology | Reason |
|-----------|------------|--------|
| Backend | FastAPI (Python) | Fast development, async support |
| Frontend | Vanilla HTML/CSS/JS | No build step, quick prototyping |
| Deployment | Single Docker container | Simple, portable |
| Config | YAML file | Matches ProxLB config format |

### Features Included
- [x] Dashboard with cluster overview
- [x] Node management
- [x] Guest (VM/CT) listing
- [x] Balancing controls
- [x] Log viewer
- [x] Configuration editor
- [x] Service control
- [ ] Authentication (basic/optional)

### Deliverables
1. Working prototype application
2. Docker container
3. Documentation
4. GitHub repository

---

## Phase 2: Production Version

### Purpose
- Production-ready deployment
- Enterprise features (auth, audit, multi-user)
- Scalable architecture
- Professional frontend

### Technology Stack

| Component | Technology | Reason |
|-----------|------------|--------|
| Reverse Proxy | Nginx | SSL termination, static files, load balancing |
| Frontend | React + TypeScript | Component-based, type-safe, scalable |
| Backend | Django + DRF | Mature, batteries-included, ORM |
| Database | PostgreSQL | Reliable, feature-rich, ACID compliant |
| Cache | Redis | Session storage, caching, Celery broker |
| Task Queue | Celery | Background jobs, scheduled tasks |
| Deployment | Docker Compose | Multi-container orchestration |

### Architecture Diagram

```
                                    ┌─────────────────┐
                                    │   Browser/UI    │
                                    └────────┬────────┘
                                             │ HTTPS (443)
                                             ▼
┌────────────────────────────────────────────────────────────────────┐
│                           NGINX                                     │
│  ┌──────────────────┐  ┌───────────────────────────────────────┐   │
│  │  Static Files    │  │        Reverse Proxy                  │   │
│  │  /static/*       │  │   /api/* ──► Django (8000)           │   │
│  │  React Build     │  │   /ws/*  ──► Django Channels         │   │
│  └──────────────────┘  └───────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
                    ▼                        ▼                        ▼
         ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
         │   Django App     │    │     Celery       │    │     Redis        │
         │   + DRF API      │    │   Worker/Beat    │    │   Cache/Broker   │
         │   Port: 8000     │    │                  │    │   Port: 6379     │
         └────────┬─────────┘    └────────┬─────────┘    └──────────────────┘
                  │                       │
                  └───────────┬───────────┘
                              ▼
                   ┌──────────────────┐
                   │   PostgreSQL     │
                   │   Port: 5432     │
                   └──────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│ Proxmox API │      │   ProxLB    │      │ Config File │
│  10.80.11.x │      │  Container  │      │   (YAML)    │
└─────────────┘      └─────────────┘      └─────────────┘
```

---

## Authentication & Authorization

### User Roles

| Role | Level | Permissions |
|------|-------|-------------|
| **Viewer** | 1 | Read-only access to dashboard, nodes, guests |
| **Operator** | 2 | Viewer + trigger rebalance, view logs |
| **Admin** | 3 | Operator + edit config, manage maintenance |
| **Super Admin** | 4 | Admin + manage users, system settings |

### Permission Matrix

| Feature | Viewer | Operator | Admin | Super Admin |
|---------|--------|----------|-------|-------------|
| View Dashboard | ✓ | ✓ | ✓ | ✓ |
| View Nodes | ✓ | ✓ | ✓ | ✓ |
| View Guests | ✓ | ✓ | ✓ | ✓ |
| View Logs | ✓ | ✓ | ✓ | ✓ |
| View Config | ✓ | ✓ | ✓ | ✓ |
| Trigger Rebalance | ✗ | ✓ | ✓ | ✓ |
| Dry-Run Simulation | ✗ | ✓ | ✓ | ✓ |
| Edit Configuration | ✗ | ✗ | ✓ | ✓ |
| Maintenance Mode | ✗ | ✗ | ✓ | ✓ |
| Start/Stop Service | ✗ | ✗ | ✓ | ✓ |
| Manage Users | ✗ | ✗ | ✗ | ✓ |
| System Settings | ✗ | ✗ | ✗ | ✓ |
| Audit Logs | ✗ | ✗ | ✓ | ✓ |

### Authentication Methods

| Method | Phase 1 | Phase 2 |
|--------|---------|---------|
| Username/Password | Optional | ✓ |
| Session-based | - | ✓ |
| JWT Tokens | - | ✓ (API) |
| LDAP/Active Directory | - | Optional |
| OAuth2/OIDC | - | Optional |
| 2FA/MFA | - | Optional |

---

## Database Schema (Phase 2)

### Core Tables

```sql
-- Users and Authentication
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(150) UNIQUE NOT NULL,
    email VARCHAR(254) UNIQUE NOT NULL,
    password_hash VARCHAR(128) NOT NULL,
    first_name VARCHAR(150),
    last_name VARCHAR(150),
    role VARCHAR(20) DEFAULT 'viewer',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Configuration History
CREATE TABLE config_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    config_snapshot JSONB NOT NULL,
    change_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migration History (cached from logs)
CREATE TABLE migration_history (
    id SERIAL PRIMARY KEY,
    guest_name VARCHAR(255),
    guest_id INTEGER,
    guest_type VARCHAR(10),
    source_node VARCHAR(100),
    target_node VARCHAR(100),
    status VARCHAR(20),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_seconds INTEGER,
    triggered_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled Maintenance Windows
CREATE TABLE maintenance_windows (
    id SERIAL PRIMARY KEY,
    node_name VARCHAR(100) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Sessions
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    session_key VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System Settings
CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB,
    description TEXT,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes

```sql
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
CREATE INDEX idx_migration_history_guest ON migration_history(guest_name);
CREATE INDEX idx_migration_history_nodes ON migration_history(source_node, target_node);
CREATE INDEX idx_migration_history_date ON migration_history(started_at);
```

---

## API Design (Phase 2 - Django REST Framework)

### Authentication Endpoints

```
POST   /api/auth/login/          # Login with credentials
POST   /api/auth/logout/         # Logout current session
POST   /api/auth/refresh/        # Refresh JWT token
GET    /api/auth/me/             # Get current user info
PUT    /api/auth/password/       # Change password
```

### User Management (Super Admin only)

```
GET    /api/users/               # List all users
POST   /api/users/               # Create new user
GET    /api/users/{id}/          # Get user details
PUT    /api/users/{id}/          # Update user
DELETE /api/users/{id}/          # Delete user
PUT    /api/users/{id}/role/     # Change user role
```

### Cluster Endpoints

```
GET    /api/cluster/             # Cluster overview
GET    /api/cluster/status/      # Detailed status
GET    /api/nodes/               # List all nodes
GET    /api/nodes/{name}/        # Node details
POST   /api/nodes/{name}/maintenance/  # Toggle maintenance
GET    /api/guests/              # List all guests
GET    /api/guests/{id}/         # Guest details
GET    /api/guests/{id}/history/ # Guest migration history
```

### Balancing Endpoints

```
GET    /api/balancing/status/    # Current balancing status
POST   /api/balancing/trigger/   # Trigger rebalance
POST   /api/balancing/dry-run/   # Simulate rebalance
GET    /api/balancing/best-node/ # Get best node
PUT    /api/balancing/settings/  # Update settings
```

### Rules Endpoints

```
GET    /api/rules/               # All rules summary
GET    /api/rules/affinity/      # Affinity groups
GET    /api/rules/anti-affinity/ # Anti-affinity groups
GET    /api/rules/pinned/        # Pinned VMs
GET    /api/rules/ignored/       # Ignored VMs
GET    /api/rules/pools/         # Pool-based rules
```

### Configuration Endpoints

```
GET    /api/config/              # Current config
PUT    /api/config/              # Update config
GET    /api/config/history/      # Config change history
POST   /api/config/validate/     # Validate config
POST   /api/config/backup/       # Backup config
POST   /api/config/restore/      # Restore from backup
```

### Logs & Audit Endpoints

```
GET    /api/logs/                # ProxLB logs
GET    /api/logs/stream/         # WebSocket log stream
GET    /api/migrations/          # Migration history
GET    /api/audit/               # Audit log (Admin+)
```

### Service Control Endpoints

```
GET    /api/service/status/      # Service status
POST   /api/service/start/       # Start service
POST   /api/service/stop/        # Stop service
POST   /api/service/restart/     # Restart service
```

---

## React Frontend Structure (Phase 2)

```
frontend/
├── public/
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Gauge.tsx
│   │   │   └── Toast.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Footer.tsx
│   │   ├── dashboard/
│   │   │   ├── ClusterStatus.tsx
│   │   │   ├── NodeSummary.tsx
│   │   │   └── MigrationFeed.tsx
│   │   ├── nodes/
│   │   │   ├── NodeList.tsx
│   │   │   ├── NodeCard.tsx
│   │   │   └── NodeDetails.tsx
│   │   ├── guests/
│   │   │   ├── GuestTable.tsx
│   │   │   ├── GuestRow.tsx
│   │   │   └── GuestDetails.tsx
│   │   ├── balancing/
│   │   │   ├── BalancingPanel.tsx
│   │   │   └── SettingsForm.tsx
│   │   ├── rules/
│   │   │   ├── AffinityGroups.tsx
│   │   │   └── RulesList.tsx
│   │   ├── config/
│   │   │   ├── ConfigEditor.tsx
│   │   │   └── ConfigHistory.tsx
│   │   ├── logs/
│   │   │   ├── LogViewer.tsx
│   │   │   └── MigrationHistory.tsx
│   │   └── auth/
│   │       ├── LoginForm.tsx
│   │       ├── UserProfile.tsx
│   │       └── UserManagement.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Nodes.tsx
│   │   ├── Guests.tsx
│   │   ├── Balancing.tsx
│   │   ├── Rules.tsx
│   │   ├── Config.tsx
│   │   ├── Logs.tsx
│   │   ├── Settings.tsx
│   │   └── Login.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useApi.ts
│   │   ├── useWebSocket.ts
│   │   └── useCluster.ts
│   ├── services/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   └── websocket.ts
│   ├── store/
│   │   ├── index.ts
│   │   ├── authSlice.ts
│   │   ├── clusterSlice.ts
│   │   └── configSlice.ts
│   ├── types/
│   │   ├── api.ts
│   │   ├── cluster.ts
│   │   └── user.ts
│   ├── utils/
│   │   ├── formatters.ts
│   │   └── validators.ts
│   ├── styles/
│   │   ├── global.css
│   │   ├── variables.css
│   │   └── components/
│   ├── App.tsx
│   └── index.tsx
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Docker Compose (Phase 2)

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./frontend/build:/usr/share/nginx/html:ro
    depends_on:
      - django
    restart: unless-stopped

  django:
    build: ./backend
    expose:
      - "8000"
    environment:
      - DATABASE_URL=postgres://proxlb:${DB_PASSWORD}@postgres:5432/proxlb
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=${SECRET_KEY}
      - DEBUG=False
    volumes:
      - ./proxlb.yaml:/etc/proxlb/proxlb.yaml:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  celery:
    build: ./backend
    command: celery -A proxlb_ui worker -l info -B
    environment:
      - DATABASE_URL=postgres://proxlb:${DB_PASSWORD}@postgres:5432/proxlb
      - REDIS_URL=redis://redis:6379/0
    volumes:
      - ./proxlb.yaml:/etc/proxlb/proxlb.yaml:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=proxlb
      - POSTGRES_USER=proxlb
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

---

## Migration Plan: Phase 1 → Phase 2

### Step 1: Backend Migration
1. Create Django project structure
2. Define models matching PostgreSQL schema
3. Migrate FastAPI endpoints to DRF viewsets
4. Implement authentication (Django Rest Auth)
5. Add Celery for background tasks
6. Implement WebSocket with Django Channels

### Step 2: Frontend Migration
1. Set up React + TypeScript + Vite
2. Create component library matching Phase 1 UI
3. Implement Redux store for state management
4. Connect to Django API endpoints
5. Add authentication flow
6. Implement WebSocket for live updates

### Step 3: Infrastructure
1. Configure Nginx reverse proxy
2. Set up SSL certificates
3. Configure PostgreSQL with migrations
4. Set up Redis for caching/sessions
5. Create Docker Compose orchestration
6. Implement health checks

### Step 4: Testing & Deployment
1. Write unit tests (pytest/Jest)
2. Integration testing
3. Security audit
4. Performance testing
5. Documentation updates
6. Production deployment

---

## Timeline Estimate

| Phase | Duration | Milestone |
|-------|----------|-----------|
| Phase 1 Complete | 1 day | Working prototype |
| Phase 2 Backend | 3-5 days | Django API complete |
| Phase 2 Frontend | 3-5 days | React UI complete |
| Phase 2 Integration | 2-3 days | Full system working |
| Testing & Polish | 2-3 days | Production ready |

**Total Phase 2:** ~2-3 weeks

---

## Repository Structure

```
Proxmox_LoadBalancing/
├── phase1/                    # Prototype version
│   ├── backend/
│   ├── frontend/
│   ├── templates/
│   ├── Dockerfile
│   └── docker-compose.yml
├── phase2/                    # Production version
│   ├── backend/               # Django
│   ├── frontend/              # React
│   ├── nginx/
│   ├── docker-compose.yml
│   └── docker-compose.prod.yml
├── docs/                      # Documentation
│   ├── PROJECT_SCOPE.md
│   ├── SOW.md
│   ├── ARCHITECTURE_PLAN.md
│   ├── API.md
│   └── DEPLOYMENT.md
├── .github/
│   └── workflows/
├── README.md
├── LICENSE
└── CHANGELOG.md
```

---

## Next Steps

1. ✅ Complete Phase 1 prototype
2. ✅ Document architecture plan
3. ⬜ Test Phase 1 with live cluster
4. ⬜ Gather feedback and iterate
5. ⬜ Begin Phase 2 development
6. ⬜ Implement authentication
7. ⬜ Production deployment

