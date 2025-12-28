# ProxLB Web Interface - Project Scope Document

## Project Overview

**Project Name:** ProxLB Web Interface  
**Version:** 1.0.0  
**Created:** December 28, 2024  
**Repository:** git@github.com:DialogueDynamicsAI/Proxmox_LoadBalancing.git

---

## Executive Summary

ProxLB Web Interface is a standalone web-based dashboard for managing and monitoring ProxLB, an advanced resource scheduler and load balancer for Proxmox clusters. This project fills the gap left by the discontinued `pve-proxmoxlb-service-ui` package by providing a modern, feature-rich web interface.

---

## Problem Statement

ProxLB currently lacks a graphical user interface:
- The official Proxmox UI integration (`pve-proxmoxlb-service-ui`) is discontinued
- Users must rely on command-line operations and log file analysis
- No visual representation of cluster balance state
- Configuration changes require manual YAML editing
- No real-time monitoring of migrations

---

## Solution

A standalone web application that provides:
- Real-time cluster visualization
- Interactive node and VM management
- Live log streaming
- Configuration editor with validation
- Migration history tracking
- Rule management (affinity/anti-affinity)

---

## Target Users

1. **Proxmox Administrators** - Managing virtualization clusters
2. **DevOps Engineers** - Automating infrastructure
3. **IT Operations** - Monitoring cluster health
4. **MSPs** - Managing multiple client environments

---

## Technical Stack

| Component | Technology |
|-----------|------------|
| Backend | Python 3.11+ / FastAPI |
| Frontend | HTML5, CSS3, JavaScript (Vanilla) |
| Styling | Custom CSS with CSS Variables |
| API | RESTful + WebSocket |
| Deployment | Docker / Docker Compose |
| Data Source | Proxmox API + ProxLB Logs |

---

## Feature Scope

### Phase 1 - Core Features (MVP)

#### 1. Dashboard
- [x] Cluster health overview
- [x] Node resource gauges (CPU/Memory/Disk)
- [x] VM/CT count statistics
- [x] Recent migration activity feed
- [x] ProxLB service status
- [x] Next scheduled run countdown

#### 2. Nodes View
- [x] Node list with status indicators
- [x] Resource usage per node
- [x] Maintenance mode toggle
- [x] Ignore node toggle
- [x] VM/CT count per node

#### 3. Guests View
- [x] Full VM/CT listing
- [x] Resource usage per guest
- [x] Current node location
- [x] Status indicators (running/stopped)
- [x] Tag display (ProxLB tags)
- [x] Search and filter

#### 4. Balancing Control
- [x] Enable/disable balancing
- [x] Method selector (memory/cpu/disk)
- [x] Mode selector (used/assigned/psi)
- [x] Balanciness threshold
- [x] Memory threshold
- [x] Trigger manual rebalance
- [x] Dry-run simulation
- [x] Get best node API

#### 5. Rules & Policies
- [x] Affinity groups display
- [x] Anti-affinity groups display
- [x] Pinned VMs list
- [x] Ignored VMs list
- [x] Pool-based rules

#### 6. Configuration
- [x] YAML config viewer
- [x] Config editor
- [x] Save and restart

#### 7. Logs
- [x] Real-time log streaming (WebSocket)
- [x] Log level filtering
- [x] Migration history extraction
- [x] Search functionality

#### 8. Service Control
- [x] Start/Stop/Restart ProxLB
- [x] Service status display
- [x] Version information

### Phase 2 - Enhanced Features (Future)

- [ ] User authentication
- [ ] Multi-cluster support
- [ ] Historical metrics graphs
- [ ] Email/webhook notifications
- [ ] Scheduled maintenance windows
- [ ] Backup/restore configuration
- [ ] API token management
- [ ] Dark/light theme toggle

---

## API Endpoints

### Status & Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | ProxLB service status |
| GET | `/api/cluster` | Cluster overview |

### Nodes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/nodes` | List all nodes |
| POST | `/api/maintenance` | Toggle maintenance mode |

### Guests
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/guests` | List all VMs/CTs |
| GET | `/api/guests/{node}` | List guests on node |

### Configuration
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config` | Get configuration |
| POST | `/api/config` | Update configuration |

### Balancing
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/balancing/settings` | Update balancing settings |
| POST | `/api/balancing/trigger` | Trigger rebalance |
| GET | `/api/balancing/best-node` | Get best node |

### Rules
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rules` | Get all rules |

### Logs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/logs` | Get log entries |
| GET | `/api/migrations` | Get migration history |
| WS | `/ws/logs` | Live log stream |

### Service Control
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/service/start` | Start ProxLB |
| POST | `/api/service/stop` | Stop ProxLB |
| POST | `/api/service/restart` | Restart ProxLB |

---

## Deployment Architecture

```
+----------------------------------------------------------+
|                    Docker Host                            |
|  +------------------+  +------------------------------+   |
|  |   ProxLB UI      |  |       ProxLB Container       |   |
|  |   Container      |  |                              |   |
|  |   Port: 8080     |--|  /etc/proxlb/proxlb.yaml    |   |
|  |                  |  |                              |   |
|  +---------+--------+  +---------------+--------------+   |
|            |                           |                  |
|            |      Docker Socket        |                  |
|            +---------------------------+                  |
|                        |                                  |
+------------------------|---------------------------------+
                         |
                         v
           +-----------------------------+
           |      Proxmox Cluster        |
           |  +-------+ +-------+ +-------+
           |  |Node 1 | |Node 2 | |Node 3 |
           |  |       | |       | |       |
           |  +-------+ +-------+ +-------+
           +-----------------------------+
```

---

## Security Considerations

1. **API Credentials** - Stored in proxlb.yaml, password masked in UI
2. **Docker Socket** - Required for container management
3. **Network Access** - Requires access to Proxmox API
4. **No Authentication** - Phase 1 does not include auth (add in Phase 2)

---

## Success Criteria

1. Dashboard displays real-time cluster status
2. Users can view and manage nodes
3. Users can view all VMs/CTs with their locations
4. Configuration can be edited via UI
5. Manual rebalancing can be triggered
6. Logs are viewable in real-time
7. Service can be controlled (start/stop/restart)

---

## Out of Scope

- Proxmox user management
- VM/CT creation or deletion
- Storage management
- Network configuration
- Backup management
- Direct SSH access to nodes

