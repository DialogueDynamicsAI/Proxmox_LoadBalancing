# ProxLB Web Interface

A modern, standalone web interface for **ProxLB** - the advanced resource scheduler and load balancer for Proxmox clusters.

![ProxLB UI](https://img.shields.io/badge/ProxLB-Web%20Interface-06b6d4?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688?style=flat-square&logo=fastapi)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker)

## 🌟 Features

### Dashboard
- Real-time cluster status overview
- Resource gauges (CPU, Memory, Disk)
- Node and guest counts
- Recent migration activity feed
- Next rebalance countdown

### Node Management
- View all cluster nodes with detailed metrics
- **Maintenance mode toggle** - Safely evacuate nodes before maintenance
- Resource usage visualization (CPU, Memory, Disk)
- VM/CT counts per node

### Guest Management
- Complete VM and container listing
- Resource usage per guest
- Status indicators (running/stopped)
- ProxLB tag display (affinity, anti-affinity, ignore, pin)
- Search and filter functionality

### Balancing Control
- Enable/disable balancing
- Configure balancing method (memory, CPU, disk)
- Set balancing mode (used, assigned, PSI)
- Adjust thresholds
- **Trigger manual rebalance**
- **Dry-run simulation**
- **Get best node for new VM**

### Rules & Policies
- View affinity groups
- View anti-affinity groups
- View pinned VMs
- View ignored VMs
- Pool-based rules display

### Logs
- Real-time log viewing
- Log level filtering
- Migration history extraction
- Auto-scroll functionality

### Configuration
- View and edit ProxLB configuration
- Save and restart service

### Service Control
- Start/Stop/Restart ProxLB
- Service status monitoring

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
- ProxLB configured and running (or will be deployed alongside)
- Access to Proxmox cluster API

### Installation

1. **Clone the repository**
   ```bash
   git clone git@github.com:DialogueDynamicsAI/Proxmox_LoadBalancing.git
   cd Proxmox_LoadBalancing
   ```

2. **Configure ProxLB** (if not already done)
   ```bash
   # Create config directory
   sudo mkdir -p /etc/proxlb
   
   # Create configuration file
   sudo nano /etc/proxlb/proxlb.yaml
   ```

   Example configuration:
   ```yaml
   proxmox_api:
     hosts: ['10.80.11.11', '10.80.11.12', '10.80.11.13']
     user: proxlb@pve
     pass: your-password
     ssl_verification: False
     timeout: 10

   proxmox_cluster:
     maintenance_nodes: []
     ignore_nodes: []
     overprovisioning: True

   balancing:
     enable: True
     method: memory
     mode: used
     balanciness: 5
     memory_threshold: 75
     balance_types: ['vm', 'ct']

   service:
     daemon: True
     schedule:
       interval: 1
       format: hours
     log_level: INFO
   ```

3. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

4. **Access the UI**
   
   Open your browser and navigate to: `http://your-server-ip:8080`

### Standalone Deployment (without Docker Compose)

```bash
# Build the image
docker build -t proxlb-ui .

# Run the container
docker run -d \
  --name proxlb-ui \
  --restart unless-stopped \
  -p 8080:8080 \
  -v /etc/proxlb/proxlb.yaml:/etc/proxlb/proxlb.yaml:ro \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  proxlb-ui
```

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PROXLB_CONFIG` | `/etc/proxlb/proxlb.yaml` | Path to ProxLB config |
| `PROXLB_CONTAINER` | `proxlb` | Docker container name |

### Ports

| Port | Description |
|------|-------------|
| 8080 | Web interface |

### Volumes

| Path | Description |
|------|-------------|
| `/etc/proxlb/proxlb.yaml` | ProxLB configuration file |
| `/var/run/docker.sock` | Docker socket for container management |

## 🔒 Security Notes

- The UI does not currently include authentication (Phase 2 feature)
- Ensure the UI is only accessible from trusted networks
- API passwords are masked in the UI
- Docker socket access is required for container management

## 🛠️ Development

### Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run the development server
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

### Project Structure

```
proxlb-ui/
├── backend/
│   ├── main.py              # FastAPI application
│   └── services/
│       ├── proxmox_api.py   # Proxmox API client
│       ├── proxlb_service.py # ProxLB management
│       └── log_parser.py    # Log parsing
├── frontend/
│   └── static/
│       ├── css/style.css    # Stylesheet
│       └── js/app.js        # JavaScript
├── templates/
│   └── index.html           # HTML template
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── README.md
```

## 📋 API Endpoints

### Status
- `GET /api/status` - Service status
- `GET /api/cluster` - Cluster overview

### Nodes
- `GET /api/nodes` - List all nodes
- `POST /api/maintenance` - Toggle maintenance mode

### Guests
- `GET /api/guests` - List all VMs/CTs

### Balancing
- `POST /api/balancing/settings` - Update settings
- `POST /api/balancing/trigger` - Trigger rebalance
- `GET /api/balancing/best-node` - Get best node

### Configuration
- `GET /api/config` - Get configuration
- `POST /api/config` - Update configuration

### Logs
- `GET /api/logs` - Get log entries
- `GET /api/migrations` - Get migration history

### Service
- `POST /api/service/start` - Start service
- `POST /api/service/stop` - Stop service
- `POST /api/service/restart` - Restart service

## 🗺️ Roadmap

### Phase 1 (Current) ✅
- Basic dashboard and monitoring
- Node and guest management
- Maintenance mode
- Manual rebalancing
- Log viewer
- Configuration editor

### Phase 2 (Planned)
- User authentication
- Role-based access control
- Django + React migration
- PostgreSQL database
- Historical metrics
- Notifications

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## 📄 License

GPL-3.0 License - Consistent with ProxLB licensing.

## 🙏 Acknowledgments

- [ProxLB](https://github.com/gyptazy/ProxLB) by Florian Paul Azim Hoberg (@gyptazy)
- [Proxmox VE](https://www.proxmox.com/)

