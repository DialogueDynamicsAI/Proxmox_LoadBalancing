# Proxmox LoadBalancer UI

A standalone web interface for [ProxLB](https://github.com/gyptazy/ProxLB) - the Proxmox Virtual Environment load balancer.

**Powered by Dialogue Dynamics AI**

![Dashboard](docs/dashboard.png)

## Features

- **Dashboard** - Real-time cluster overview with resource usage
- **Nodes Management** - View and manage Proxmox nodes, maintenance mode
- **Guest Management** - View all VMs and containers with filtering
- **Load Balancing** - Trigger rebalance, dry run, get optimal node
- **Rules & Policies** - Affinity/anti-affinity groups, pinned/ignored VMs
- **Logs** - View ProxLB logs and migration history
- **Configuration** - Web-based configuration management

## Requirements

- Docker and Docker Compose
- Proxmox VE 7.x or 8.x cluster
- A Proxmox API user with appropriate permissions

---

## Quick Installation

### 1. Download and Run the Installer

```bash
# Download the installer
curl -fsSL https://raw.githubusercontent.com/DialogueDynamicsAI/Proxmox_LoadBalancing/main/install.sh -o install.sh

# Make it executable
chmod +x install.sh

# Run the installer (as root or with sudo)
sudo ./install.sh
```

The installer will prompt you for:
- Proxmox node IP addresses
- API username and password
- Basic configuration options

### 2. Access the Web Interface

After installation, access the web interface at:

```
http://<your-server-ip>:8080
```

---

## Manual Installation

If you prefer manual installation:

### 1. Clone the Repository

```bash
git clone https://github.com/DialogueDynamicsAI/Proxmox_LoadBalancing.git /opt/proxlb-ui
cd /opt/proxlb-ui/proxlb-ui-app
```

### 2. Create Configuration

```bash
mkdir -p /etc/proxlb
cp config/proxlb.yaml.example /etc/proxlb/proxlb.yaml
# Edit the configuration with your Proxmox details
nano /etc/proxlb/proxlb.yaml
```

### 3. Start the Services

```bash
docker compose up -d
```

---

## Proxmox API User Setup

ProxLB requires a Proxmox API user with specific permissions. Follow these steps to create one:

### Option 1: Using the Proxmox Web UI

1. Log in to your Proxmox web interface
2. Navigate to **Datacenter** → **Permissions** → **Users**
3. Click **Add** and create a new user:
   - **User name**: `proxlb`
   - **Realm**: `pve` (Proxmox VE authentication)
   - **Password**: Choose a strong password
4. Navigate to **Datacenter** → **Permissions** → **Roles**
5. Click **Create** and add a new role called `ProxLB` with these privileges:
   - `VM.Migrate`
   - `VM.Monitor`
   - `VM.Audit`
   - `Datastore.Audit`
   - `Sys.Audit`
   - `Pool.Audit`
6. Navigate to **Datacenter** → **Permissions**
7. Click **Add** → **User Permission**:
   - **Path**: `/`
   - **User**: `proxlb@pve`
   - **Role**: `ProxLB`
   - **Propagate**: ✓ (checked)

### Option 2: Using the Command Line

Run these commands on any Proxmox node:

```bash
# Create the user
pveum user add proxlb@pve -comment "ProxLB Load Balancer"

# Set the password (you'll be prompted)
pveum passwd proxlb@pve

# Create a custom role with required permissions
pveum role add ProxLB -privs "VM.Migrate,VM.Monitor,VM.Audit,Datastore.Audit,Sys.Audit,Pool.Audit"

# Assign the role to the user at the datacenter level
pveum acl modify / -user proxlb@pve -role ProxLB
```

### Required Permissions Explained

| Permission | Purpose |
|------------|---------|
| `VM.Migrate` | Required to migrate VMs between nodes |
| `VM.Monitor` | Required to monitor VM status |
| `VM.Audit` | Required to view VM configuration |
| `Datastore.Audit` | Required to check storage availability |
| `Sys.Audit` | Required to view node status and resources |
| `Pool.Audit` | Required to view resource pool information |

### Verify the User

Test the API access:

```bash
curl -k -d "username=proxlb@pve&password=YOUR_PASSWORD" \
  https://YOUR_PROXMOX_IP:8006/api2/json/access/ticket
```

You should receive a JSON response with a ticket if successful.

---

## Configuration

The main configuration file is located at `/etc/proxlb/proxlb.yaml`.

### Example Configuration

```yaml
proxmox_api:
  hosts:
    - "10.0.0.1"      # First Proxmox node
    - "10.0.0.2"      # Second Proxmox node (optional)
    - "10.0.0.3"      # Third Proxmox node (optional)
  user: "proxlb@pve"
  pass: "your-password"
  ssl: true
  verify: false

proxmox_cluster:
  ignore_nodes: []
  maintenance_nodes: []

service:
  daemon: true
  schedule:
    interval: 1
    format: hours
  log_level: INFO

balancing:
  enable: true
  method: memory      # memory, cpu, or disk
  mode: used          # used, assigned, or psi
  balanciness: 5
  memory_threshold: 75

migration:
  type: live          # live or offline
  wait: 120
  pool_enabled: false
```

---

## Updating

To update to the latest version:

```bash
cd /opt/proxlb-ui/proxlb-ui-app
git pull origin main
docker compose up -d --build
```

---

## Troubleshooting

### Check Container Status

```bash
docker ps | grep proxlb
```

### View Logs

```bash
# ProxLB UI logs
docker logs proxlb-ui

# ProxLB service logs
docker logs proxlb
```

### Restart Services

```bash
cd /opt/proxlb-ui/proxlb-ui-app
docker compose restart
```

### Common Issues

1. **Cannot connect to Proxmox API**
   - Verify the IP addresses are correct
   - Check firewall rules (port 8006 must be accessible)
   - Verify username format includes realm (e.g., `proxlb@pve`)

2. **Permission denied errors**
   - Ensure the API user has all required permissions
   - Check that permissions are propagated to all paths

3. **Migrations failing**
   - Verify shared storage is available
   - Check that all nodes can communicate
   - Ensure VMs are not locked

---

## Support

- **GitHub Issues**: [Report a bug](https://github.com/DialogueDynamicsAI/Proxmox_LoadBalancing/issues)
- **Documentation**: [Wiki](https://github.com/DialogueDynamicsAI/Proxmox_LoadBalancing/wiki)

---

## License

MIT License - See [LICENSE](LICENSE) for details.

## Credits

- [ProxLB](https://github.com/gyptazy/ProxLB) - The underlying load balancer
- [Dialogue Dynamics AI](https://dialoguedynamics.ai) - Web interface development
