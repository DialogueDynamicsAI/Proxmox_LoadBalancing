# Statement of Work (SOW)
## ProxLB Web Interface Development

---

## Document Information

| Field | Value |
|-------|-------|
| Project Name | ProxLB Web Interface |
| Document Version | 1.0 |
| Created Date | December 28, 2024 |
| Last Updated | December 28, 2024 |
| Client | Internal / Open Source |

---

## 1. Project Overview

### 1.1 Background
ProxLB is an open-source advanced resource scheduler and load balancer for Proxmox clusters, developed by Florian Paul Azim Hoberg (@gyptazy). While ProxLB provides excellent functionality via CLI and daemon mode, it lacks a modern web-based graphical interface since the official Proxmox UI integration package was discontinued.

### 1.2 Objective
Develop a standalone, containerized web interface that provides comprehensive management and monitoring capabilities for ProxLB installations.

### 1.3 Deliverables
1. Fully functional web application
2. Docker container image
3. Docker Compose deployment configuration
4. Complete documentation
5. Source code repository

---

## 2. Scope of Work

### 2.1 In Scope

#### 2.1.1 Dashboard Development
- Real-time cluster overview display
- Node resource visualization (CPU, Memory, Disk)
- VM/CT statistics and counts
- ProxLB service status indicator
- Recent migration activity feed
- Next scheduled run countdown timer

#### 2.1.2 Node Management Interface
- Display all cluster nodes with status
- Show resource utilization per node
- Maintenance mode toggle functionality
- Node ignore functionality
- Visual indicators for node states

#### 2.1.3 Guest (VM/CT) Management Interface
- List all virtual machines and containers
- Display current node location
- Show resource usage per guest
- Display ProxLB tags (affinity, ignore, pin)
- Search and filter functionality
- Status indicators (running, stopped, etc.)

#### 2.1.4 Balancing Control Panel
- Enable/disable balancing toggle
- Balancing method selector (memory/cpu/disk)
- Balancing mode selector (used/assigned/psi)
- Balanciness threshold configuration
- Memory threshold configuration
- Manual rebalance trigger button
- Dry-run simulation capability
- Best node recommendation API

#### 2.1.5 Rules & Policies Display
- Affinity groups visualization
- Anti-affinity groups visualization
- Pinned VMs listing
- Ignored VMs listing
- Pool-based rules display

#### 2.1.6 Configuration Management
- View current configuration
- Edit configuration via web interface
- Save configuration changes
- Restart service after changes
- Password masking for security

#### 2.1.7 Log Viewer
- Real-time log streaming via WebSocket
- Historical log viewing
- Log level filtering (INFO, WARNING, ERROR, DEBUG)
- Migration history extraction and display
- Search functionality within logs

#### 2.1.8 Service Control
- Start ProxLB service
- Stop ProxLB service
- Restart ProxLB service
- Service status monitoring
- Version display

#### 2.1.9 Containerization
- Dockerfile for application
- Docker Compose configuration
- Volume mapping for configuration
- Docker socket access for container management

### 2.2 Out of Scope

The following items are explicitly excluded from this project:

1. **Proxmox Management Features**
   - User/permission management
   - VM/CT creation or deletion
   - Storage management
   - Network configuration
   - Backup/snapshot management

2. **Authentication System**
   - User login/logout (Phase 2)
   - Role-based access control (Phase 2)
   - SSO integration (Phase 2)

3. **Multi-Cluster Support**
   - Managing multiple Proxmox clusters (Phase 2)
   - Cluster switching interface (Phase 2)

4. **Historical Analytics**
   - Long-term metrics storage (Phase 2)
   - Historical graphs and charts (Phase 2)
   - Trend analysis (Phase 2)

5. **Alerting & Notifications**
   - Email notifications (Phase 2)
   - Webhook integrations (Phase 2)
   - SMS alerts (Phase 2)

---

## 3. Technical Requirements

### 3.1 Backend Requirements
| Requirement | Specification |
|-------------|---------------|
| Language | Python 3.11+ |
| Framework | FastAPI |
| ASGI Server | Uvicorn |
| API Style | RESTful + WebSocket |
| Config Format | YAML |

### 3.2 Frontend Requirements
| Requirement | Specification |
|-------------|---------------|
| Technology | HTML5, CSS3, JavaScript |
| Framework | Vanilla JS (no framework) |
| Styling | Custom CSS with variables |
| Compatibility | Modern browsers (Chrome, Firefox, Safari, Edge) |

### 3.3 Deployment Requirements
| Requirement | Specification |
|-------------|---------------|
| Container Runtime | Docker 20.10+ |
| Orchestration | Docker Compose v2+ |
| Port | 8080 (configurable) |
| Volumes | Config file, Docker socket |

### 3.4 Integration Requirements
| System | Integration Method |
|--------|-------------------|
| Proxmox VE | REST API (proxmoxer library) |
| ProxLB | Docker container management, log parsing |
| Configuration | YAML file (/etc/proxlb/proxlb.yaml) |

---

## 4. Acceptance Criteria

### 4.1 Functional Criteria

| ID | Criteria | Status |
|----|----------|--------|
| AC-01 | Dashboard loads within 3 seconds | Pending |
| AC-02 | All nodes display with accurate resource data | Pending |
| AC-03 | All VMs/CTs are listed with correct information | Pending |
| AC-04 | Configuration changes persist after save | Pending |
| AC-05 | Manual rebalance triggers successfully | Pending |
| AC-06 | Logs stream in real-time via WebSocket | Pending |
| AC-07 | Service start/stop/restart functions work | Pending |
| AC-08 | Maintenance mode can be toggled | Pending |
| AC-09 | Affinity/anti-affinity rules display correctly | Pending |
| AC-10 | Application runs in Docker container | Pending |

### 4.2 Non-Functional Criteria

| ID | Criteria | Status |
|----|----------|--------|
| NF-01 | UI is responsive on desktop screens | Pending |
| NF-02 | API responses under 500ms | Pending |
| NF-03 | Container image under 200MB | Pending |
| NF-04 | No external CDN dependencies | Pending |
| NF-05 | Passwords masked in UI | Pending |

---

## 5. Timeline

| Phase | Task | Duration | Status |
|-------|------|----------|--------|
| 1 | Project Setup & Planning | 1 hour | Complete |
| 2 | Backend Development | 2 hours | In Progress |
| 3 | Frontend Development | 2 hours | Pending |
| 4 | Integration & Testing | 1 hour | Pending |
| 5 | Containerization | 30 min | Pending |
| 6 | Documentation | 30 min | In Progress |
| 7 | Deployment | 30 min | Pending |

**Total Estimated Time:** ~7.5 hours

---

## 6. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Proxmox API changes | Low | High | Use proxmoxer library with version pinning |
| ProxLB config format changes | Low | Medium | Abstract config handling into service layer |
| Docker socket access issues | Medium | High | Document required permissions clearly |
| Browser compatibility | Low | Low | Use standard web APIs only |

---

## 7. Assumptions

1. ProxLB is already installed and running in a Docker container
2. Proxmox cluster is accessible via API
3. Valid API credentials are available
4. Docker and Docker Compose are installed on the host
5. User has appropriate permissions for Docker operations

---

## 8. Dependencies

### External Dependencies
| Dependency | Version | Purpose |
|------------|---------|---------|
| ProxLB | >= 1.0.0 | Load balancing engine |
| Proxmox VE | >= 7.0 | Virtualization platform |
| Docker | >= 20.10 | Container runtime |
| Python | >= 3.11 | Backend runtime |

### Python Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| fastapi | >= 0.104 | Web framework |
| uvicorn | >= 0.24 | ASGI server |
| proxmoxer | >= 2.0 | Proxmox API client |
| pyyaml | >= 6.0 | Config parsing |
| httpx | >= 0.25 | Async HTTP client |
| jinja2 | >= 3.1 | Template engine |
| websockets | >= 12.0 | WebSocket support |

---

## 9. Sign-Off

This Statement of Work defines the complete scope for the ProxLB Web Interface project. Any changes to this scope must be documented and approved.

| Role | Name | Date |
|------|------|------|
| Project Lead | DialogueDynamics AI | 2024-12-28 |
| Developer | DialogueDynamics AI | 2024-12-28 |

---

## Appendix A: File Structure

```
/opt/proxlb-ui/
├── backend/
│   ├── main.py                 # FastAPI application
│   └── services/
│       ├── __init__.py
│       ├── proxmox_api.py      # Proxmox API client
│       ├── proxlb_service.py   # ProxLB management
│       └── log_parser.py       # Log parsing utilities
├── frontend/
│   └── static/
│       ├── css/
│       │   └── style.css       # Main stylesheet
│       └── js/
│           └── app.js          # Frontend JavaScript
├── templates/
│   └── index.html              # Main HTML template
├── Dockerfile                  # Container build file
├── docker-compose.yml          # Compose configuration
├── requirements.txt            # Python dependencies
└── README.md                   # Project documentation
```

## Appendix B: Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PROXLB_CONFIG | /etc/proxlb/proxlb.yaml | Path to ProxLB config |
| PROXLB_CONTAINER | proxlb | Docker container name |
| HOST | 0.0.0.0 | Bind address |
| PORT | 8080 | Listen port |

