#!/bin/bash
#
# ProxLB UI Installation Script
# Powered by Dialogue Dynamics AI
#
# Usage: sudo ./install.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Installation directory
INSTALL_DIR="/opt/proxlb-ui"
CONFIG_DIR="/etc/proxlb"
CONFIG_FILE="${CONFIG_DIR}/proxlb.yaml"

# Print banner
print_banner() {
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                                                            ║"
    echo "║   ██████╗ ██████╗  ██████╗ ██╗  ██╗██╗     ██████╗        ║"
    echo "║   ██╔══██╗██╔══██╗██╔═══██╗╚██╗██╔╝██║     ██╔══██╗       ║"
    echo "║   ██████╔╝██████╔╝██║   ██║ ╚███╔╝ ██║     ██████╔╝       ║"
    echo "║   ██╔═══╝ ██╔══██╗██║   ██║ ██╔██╗ ██║     ██╔══██╗       ║"
    echo "║   ██║     ██║  ██║╚██████╔╝██╔╝ ██╗███████╗██████╔╝       ║"
    echo "║   ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═════╝        ║"
    echo "║                                                            ║"
    echo "║           Proxmox LoadBalancer Web Interface               ║"
    echo "║              Powered by Dialogue Dynamics AI               ║"
    echo "║                                                            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Print step
print_step() {
    echo -e "\n${BLUE}[STEP]${NC} $1"
}

# Print success
print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

# Print warning
print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Print error
print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Check dependencies
check_dependencies() {
    print_step "Checking dependencies..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_warning "Docker not found. Installing..."
        curl -fsSL https://get.docker.com | sh
        systemctl enable docker
        systemctl start docker
        print_success "Docker installed"
    else
        print_success "Docker is installed"
    fi
    
    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        print_warning "Docker Compose plugin not found. Installing..."
        apt-get update && apt-get install -y docker-compose-plugin
        print_success "Docker Compose installed"
    else
        print_success "Docker Compose is installed"
    fi
    
    # Check git
    if ! command -v git &> /dev/null; then
        print_warning "Git not found. Installing..."
        apt-get update && apt-get install -y git
        print_success "Git installed"
    else
        print_success "Git is installed"
    fi
}

# Collect Proxmox configuration
collect_config() {
    print_step "Proxmox Cluster Configuration"
    echo ""
    echo -e "${CYAN}Enter your Proxmox node IP addresses (comma-separated):${NC}"
    echo -e "${YELLOW}Example: 10.0.0.1,10.0.0.2,10.0.0.3${NC}"
    read -p "> " PROXMOX_HOSTS
    
    # Convert comma-separated to array
    IFS=',' read -ra HOST_ARRAY <<< "$PROXMOX_HOSTS"
    
    echo ""
    echo -e "${CYAN}Enter the API username:${NC}"
    echo -e "${YELLOW}Format: username@realm (e.g., proxlb@pve)${NC}"
    read -p "> " PROXMOX_USER
    
    # Validate username format
    if [[ ! "$PROXMOX_USER" =~ @ ]]; then
        print_warning "Username should include realm (e.g., @pve). Appending @pve..."
        PROXMOX_USER="${PROXMOX_USER}@pve"
    fi
    
    echo ""
    echo -e "${CYAN}Enter the API password:${NC}"
    read -s -p "> " PROXMOX_PASS
    echo ""
    
    echo ""
    echo -e "${CYAN}Use SSL for API connection? [Y/n]:${NC}"
    read -p "> " USE_SSL
    USE_SSL=${USE_SSL:-Y}
    if [[ "$USE_SSL" =~ ^[Yy] ]]; then
        SSL_ENABLED="true"
    else
        SSL_ENABLED="false"
    fi
    
    echo ""
    echo -e "${CYAN}Verify SSL certificate? [y/N]:${NC}"
    echo -e "${YELLOW}(Use 'n' for self-signed certificates)${NC}"
    read -p "> " VERIFY_SSL
    VERIFY_SSL=${VERIFY_SSL:-N}
    if [[ "$VERIFY_SSL" =~ ^[Yy] ]]; then
        VERIFY_ENABLED="true"
    else
        VERIFY_ENABLED="false"
    fi
    
    # Test connection to first host
    echo ""
    print_step "Testing connection to Proxmox..."
    FIRST_HOST="${HOST_ARRAY[0]}"
    FIRST_HOST=$(echo "$FIRST_HOST" | xargs)  # Trim whitespace
    
    if curl -s -k --connect-timeout 5 "https://${FIRST_HOST}:8006/api2/json" > /dev/null 2>&1; then
        print_success "Successfully connected to ${FIRST_HOST}"
    else
        print_warning "Could not connect to ${FIRST_HOST}:8006. Continuing anyway..."
    fi
}

# Configure balancing options
collect_balancing_config() {
    print_step "Balancing Configuration"
    echo ""
    echo -e "${CYAN}Enable automatic load balancing? [Y/n]:${NC}"
    read -p "> " ENABLE_BALANCING
    ENABLE_BALANCING=${ENABLE_BALANCING:-Y}
    if [[ "$ENABLE_BALANCING" =~ ^[Yy] ]]; then
        BALANCING_ENABLED="true"
    else
        BALANCING_ENABLED="false"
    fi
    
    echo ""
    echo -e "${CYAN}Select balancing method:${NC}"
    echo "  1) memory (default) - Balance based on memory usage"
    echo "  2) cpu              - Balance based on CPU usage"
    echo "  3) disk             - Balance based on disk usage"
    read -p "> " BALANCE_METHOD
    case $BALANCE_METHOD in
        2) BALANCE_METHOD="cpu" ;;
        3) BALANCE_METHOD="disk" ;;
        *) BALANCE_METHOD="memory" ;;
    esac
    
    echo ""
    echo -e "${CYAN}Run as daemon (automatic rebalancing)? [Y/n]:${NC}"
    read -p "> " DAEMON_MODE
    DAEMON_MODE=${DAEMON_MODE:-Y}
    if [[ "$DAEMON_MODE" =~ ^[Yy] ]]; then
        DAEMON_ENABLED="true"
        
        echo ""
        echo -e "${CYAN}Rebalance interval in hours [1]:${NC}"
        read -p "> " INTERVAL
        INTERVAL=${INTERVAL:-1}
    else
        DAEMON_ENABLED="false"
        INTERVAL="1"
    fi
}

# Create configuration file
create_config() {
    print_step "Creating configuration..."
    
    mkdir -p "$CONFIG_DIR"
    
    # Build hosts YAML array
    HOSTS_YAML=""
    for host in "${HOST_ARRAY[@]}"; do
        host=$(echo "$host" | xargs)  # Trim whitespace
        HOSTS_YAML="${HOSTS_YAML}    - \"${host}\"\n"
    done
    
    cat > "$CONFIG_FILE" << CONFIGEOF
# ProxLB Configuration
# Generated by install.sh on $(date)

proxmox_api:
  hosts:
$(echo -e "$HOSTS_YAML")  user: "${PROXMOX_USER}"
  pass: "${PROXMOX_PASS}"
  ssl: ${SSL_ENABLED}
  verify: ${VERIFY_ENABLED}

proxmox_cluster:
  ignore_nodes: []
  maintenance_nodes: []

service:
  daemon: ${DAEMON_ENABLED}
  schedule:
    interval: ${INTERVAL}
    format: hours
  log_level: INFO

balancing:
  enable: ${BALANCING_ENABLED}
  method: ${BALANCE_METHOD}
  mode: used
  balanciness: 5
  memory_threshold: 75

migration:
  type: live
  wait: 120
  pool_enabled: false
CONFIGEOF

    chmod 600 "$CONFIG_FILE"
    print_success "Configuration created at ${CONFIG_FILE}"
}

# Clone or update repository
setup_repository() {
    print_step "Setting up ProxLB UI..."
    
    if [ -d "${INSTALL_DIR}/proxlb-ui-app" ]; then
        print_warning "Existing installation found. Updating..."
        cd "${INSTALL_DIR}/proxlb-ui-app"
        git pull origin main 2>/dev/null || true
    else
        mkdir -p "$INSTALL_DIR"
        git clone https://github.com/DialogueDynamicsAI/Proxmox_LoadBalancing.git "${INSTALL_DIR}/proxlb-ui-app"
    fi
    
    print_success "Repository setup complete"
}

# Start services
start_services() {
    print_step "Starting services..."
    
    cd "${INSTALL_DIR}/proxlb-ui-app"
    
    # Build and start containers
    docker compose up -d --build
    
    # Wait for services to start
    echo -n "Waiting for services to start"
    for i in {1..10}; do
        echo -n "."
        sleep 2
    done
    echo ""
    
    # Check if services are running
    if docker ps | grep -q "proxlb-ui"; then
        print_success "ProxLB UI is running"
    else
        print_error "Failed to start ProxLB UI"
        echo "Check logs with: docker logs proxlb-ui"
    fi
    
    if docker ps | grep -q "proxlb"; then
        print_success "ProxLB service is running"
    else
        print_warning "ProxLB service may not be running"
        echo "Check logs with: docker logs proxlb"
    fi
}

# Print completion message
print_completion() {
    # Get server IP
    SERVER_IP=$(hostname -I | awk '{print $1}')
    
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}║              Installation Complete!                        ║${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "Access the web interface at:"
    echo -e "  ${CYAN}http://${SERVER_IP}:8080${NC}"
    echo ""
    echo -e "Configuration file:"
    echo -e "  ${YELLOW}${CONFIG_FILE}${NC}"
    echo ""
    echo -e "Useful commands:"
    echo -e "  View logs:    ${YELLOW}docker logs proxlb-ui${NC}"
    echo -e "  Restart:      ${YELLOW}cd ${INSTALL_DIR}/proxlb-ui-app && docker compose restart${NC}"
    echo -e "  Stop:         ${YELLOW}cd ${INSTALL_DIR}/proxlb-ui-app && docker compose down${NC}"
    echo ""
    echo -e "${CYAN}Thank you for using ProxLB UI by Dialogue Dynamics AI!${NC}"
    echo ""
}

# Main installation flow
main() {
    print_banner
    check_root
    check_dependencies
    collect_config
    collect_balancing_config
    create_config
    setup_repository
    start_services
    print_completion
}

# Run main function
main "$@"
