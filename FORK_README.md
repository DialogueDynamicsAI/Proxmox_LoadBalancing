# ProxLB Fork - With Web Interface

[![ProxLB](https://img.shields.io/badge/ProxLB-Fork-06b6d4?style=for-the-badge)](https://github.com/gyptazy/ProxLB)
[![Web UI](https://img.shields.io/badge/Web%20UI-Included-8b5cf6?style=for-the-badge)](./proxlb-ui-app)

## 🔱 Fork Information

This repository is a **fork** of the original [ProxLB](https://github.com/gyptazy/ProxLB) project by [@gyptazy](https://github.com/gyptazy), with the following additions:

### What's Added

| Component | Description |
|-----------|-------------|
| **Web Interface** | Modern standalone web UI for managing ProxLB |
| **Dashboard** | Real-time cluster monitoring |
| **Maintenance Mode UI** | Toggle node maintenance from browser |
| **Configuration Editor** | Edit ProxLB config via web UI |

---

## 📁 Repository Structure

```
Proxmox_LoadBalancing/
├── proxlb/                    # Original ProxLB core (Python)
├── proxlb-ui-app/             # NEW: Web Interface
│   ├── backend/               # FastAPI backend
│   ├── frontend/              # HTML/CSS/JS frontend
│   ├── templates/             # Jinja2 templates
│   ├── Dockerfile
│   └── docker-compose.yml
├── config/                    # ProxLB configuration examples
├── docs/                      # ProxLB documentation
├── debian/                    # Debian packaging
├── helm/                      # Kubernetes Helm charts
├── service/                   # Systemd service files
├── Dockerfile                 # ProxLB container build
├── README.md                  # Original ProxLB README
└── FORK_README.md             # This file
```

---

## 🚀 Quick Start

### Option 1: Run ProxLB with Web UI (Recommended)

```bash
cd proxlb-ui-app
docker-compose up -d
```

Access the web interface at: `http://your-server:8080`

### Option 2: Run ProxLB Only (Original)

```bash
docker pull cr.gyptazy.com/proxlb/proxlb:latest
docker run -d --name proxlb \
  -v /etc/proxlb/proxlb.yaml:/etc/proxlb/proxlb.yaml \
  cr.gyptazy.com/proxlb/proxlb:latest
```

---

## 🌟 Web Interface Features

### Dashboard
- Real-time cluster status
- Resource gauges (CPU, Memory, Disk)
- Migration activity feed
- Next rebalance countdown

### Node Management
- View all nodes with metrics
- **Maintenance mode toggle** - Evacuate VMs before maintenance
- Resource usage visualization

### Balancing Control
- Trigger manual rebalance
- Dry-run simulation
- Adjust thresholds via UI

### Logs & Configuration
- Real-time log viewer
- Configuration editor
- Service control

---

## 📋 Roadmap

### Phase 1 (Current) ✅
- FastAPI + Vanilla JS prototype
- All core features implemented
- Docker deployment

### Phase 2 (Planned)
- Django + React migration
- PostgreSQL database
- User authentication
- Role-based access control
- Historical metrics

See [proxlb-ui-app/docs/ARCHITECTURE_PLAN.md](./proxlb-ui-app/docs/ARCHITECTURE_PLAN.md) for details.

---

## 🙏 Credits

- **Original ProxLB**: [gyptazy/ProxLB](https://github.com/gyptazy/ProxLB) by Florian Paul Azim Hoberg
- **Web Interface**: DialogueDynamics AI

---

## 📄 License

GPL-3.0 License (same as original ProxLB)

