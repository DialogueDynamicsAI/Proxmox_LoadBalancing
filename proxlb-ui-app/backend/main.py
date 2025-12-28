"""
ProxLB Web Interface - Main Application
A standalone web interface for ProxLB load balancer
"""

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import subprocess
import yaml
import json
import os
import re
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from contextlib import asynccontextmanager

# Import services
from services.proxmox_api import ProxmoxAPI
from services.proxlb_service import ProxLBService
from services.log_parser import LogParser

# Configuration
CONFIG_PATH = os.getenv("PROXLB_CONFIG", "/etc/proxlb/proxlb.yaml")
DOCKER_CONTAINER_NAME = os.getenv("PROXLB_CONTAINER", "proxlb")

# Global services
proxmox_api: Optional[ProxmoxAPI] = None
proxlb_service: Optional[ProxLBService] = None
log_parser: Optional[LogParser] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    global proxmox_api, proxlb_service, log_parser
    
    # Initialize services
    try:
        config = load_config()
        if config:
            proxmox_api = ProxmoxAPI(config)
            proxlb_service = ProxLBService(CONFIG_PATH, DOCKER_CONTAINER_NAME)
            log_parser = LogParser(DOCKER_CONTAINER_NAME)
            print("✓ Services initialized successfully")
    except Exception as e:
        print(f"⚠ Warning: Could not initialize services: {e}")
    
    yield
    
    # Cleanup
    if proxmox_api:
        proxmox_api.close()


app = FastAPI(
    title="ProxLB Web Interface",
    description="A standalone web interface for ProxLB - Proxmox Load Balancer",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files and templates
# Use absolute paths since app runs from /app/backend
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "frontend", "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
templates = Jinja2Templates(directory=TEMPLATES_DIR)


def load_config() -> Optional[Dict]:
    """Load ProxLB configuration file"""
    try:
        if os.path.exists(CONFIG_PATH):
            with open(CONFIG_PATH, 'r') as f:
                return yaml.safe_load(f)
    except Exception as e:
        print(f"Error loading config: {e}")
    return None


def save_config(config: Dict) -> bool:
    """Save ProxLB configuration file"""
    try:
        with open(CONFIG_PATH, 'w') as f:
            yaml.dump(config, f, default_flow_style=False, sort_keys=False)
        return True
    except Exception as e:
        print(f"Error saving config: {e}")
        return False


# ============== Pydantic Models ==============

class ConfigUpdate(BaseModel):
    config: Dict[str, Any]


class MaintenanceNode(BaseModel):
    node: str
    action: str  # "add" or "remove"


class BalancingSettings(BaseModel):
    enable: Optional[bool] = None
    method: Optional[str] = None
    mode: Optional[str] = None
    balanciness: Optional[int] = None
    memory_threshold: Optional[int] = None


# ============== Web Routes ==============

@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    """Main dashboard page"""
    return templates.TemplateResponse("index.html", {"request": request})


# ============== API Routes ==============

@app.get("/api/status")
async def get_status():
    """Get ProxLB service status"""
    try:
        status = proxlb_service.get_status() if proxlb_service else {"running": False}
        config = load_config()
        
        # Check if balancing is enabled in config
        balancing_enabled = True  # Default to enabled
        if config and "balancing" in config:
            balancing_enabled = config["balancing"].get("enable", True)
        
        return {
            "proxlb": status,
            "config_loaded": config is not None,
            "balancing_enabled": balancing_enabled,
            "version": "1.1.10",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {"error": str(e), "running": False, "balancing_enabled": True}


@app.get("/api/cluster")
async def get_cluster():
    """Get cluster overview"""
    if not proxmox_api:
        raise HTTPException(status_code=503, detail="Proxmox API not initialized")
    
    try:
        return await proxmox_api.get_cluster_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/nodes")
async def get_nodes():
    """Get all nodes with their resources"""
    if not proxmox_api:
        raise HTTPException(status_code=503, detail="Proxmox API not initialized")
    
    try:
        config = load_config()
        maintenance_nodes = config.get("proxmox_cluster", {}).get("maintenance_nodes", []) if config else []
        ignore_nodes = config.get("proxmox_cluster", {}).get("ignore_nodes", []) if config else []
        
        nodes = await proxmox_api.get_nodes()
        
        # Add maintenance/ignore status
        for node in nodes:
            node["maintenance"] = node["node"] in maintenance_nodes
            node["ignored"] = node["node"] in ignore_nodes
        
        return {"nodes": nodes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/guests")
async def get_guests():
    """Get all VMs and containers"""
    if not proxmox_api:
        raise HTTPException(status_code=503, detail="Proxmox API not initialized")
    
    try:
        guests = await proxmox_api.get_all_guests()
        return {"guests": guests}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/guests/{node}")
async def get_node_guests(node: str):
    """Get VMs and containers for a specific node"""
    if not proxmox_api:
        raise HTTPException(status_code=503, detail="Proxmox API not initialized")
    
    try:
        guests = await proxmox_api.get_node_guests(node)
        return {"node": node, "guests": guests}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/config")
async def get_config():
    """Get current ProxLB configuration"""
    config = load_config()
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    # Mask password for security
    safe_config = config.copy()
    if "proxmox_api" in safe_config and "pass" in safe_config["proxmox_api"]:
        safe_config["proxmox_api"]["pass"] = "********"
    
    return {"config": safe_config}


@app.post("/api/config")
async def update_config(config_update: ConfigUpdate):
    """Update ProxLB configuration"""
    try:
        # Load current config to preserve password if not changed
        current_config = load_config()
        new_config = config_update.config
        
        # Preserve password if masked
        if (current_config and 
            "proxmox_api" in new_config and 
            new_config["proxmox_api"].get("pass") == "********"):
            new_config["proxmox_api"]["pass"] = current_config["proxmox_api"]["pass"]
        
        if save_config(new_config):
            return {"success": True, "message": "Configuration updated"}
        else:
            raise HTTPException(status_code=500, detail="Failed to save configuration")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/maintenance")
async def update_maintenance(data: MaintenanceNode):
    """Add or remove a node from maintenance mode"""
    config = load_config()
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    if "proxmox_cluster" not in config:
        config["proxmox_cluster"] = {}
    
    maintenance_nodes = config["proxmox_cluster"].get("maintenance_nodes", [])
    
    if data.action == "add" and data.node not in maintenance_nodes:
        maintenance_nodes.append(data.node)
    elif data.action == "remove" and data.node in maintenance_nodes:
        maintenance_nodes.remove(data.node)
    
    config["proxmox_cluster"]["maintenance_nodes"] = maintenance_nodes
    
    if save_config(config):
        # Restart ProxLB to apply changes
        if proxlb_service:
            proxlb_service.restart()
        return {"success": True, "maintenance_nodes": maintenance_nodes}
    else:
        raise HTTPException(status_code=500, detail="Failed to update configuration")


@app.post("/api/balancing/settings")
async def update_balancing_settings(settings: BalancingSettings):
    """Update balancing settings"""
    config = load_config()
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    if "balancing" not in config:
        config["balancing"] = {}
    
    # Update only provided settings
    if settings.enable is not None:
        config["balancing"]["enable"] = settings.enable
    if settings.method is not None:
        config["balancing"]["method"] = settings.method
    if settings.mode is not None:
        config["balancing"]["mode"] = settings.mode
    if settings.balanciness is not None:
        config["balancing"]["balanciness"] = settings.balanciness
    if settings.memory_threshold is not None:
        config["balancing"]["memory_threshold"] = settings.memory_threshold
    
    if save_config(config):
        return {"success": True, "balancing": config["balancing"]}
    else:
        raise HTTPException(status_code=500, detail="Failed to update configuration")


@app.post("/api/balancing/trigger")
async def trigger_rebalance(dry_run: bool = False):
    """Trigger a manual rebalance"""
    if not proxlb_service:
        raise HTTPException(status_code=503, detail="ProxLB service not available")
    
    try:
        result = proxlb_service.run_once(dry_run=dry_run)
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/balancing/best-node")
async def get_best_node():
    """Get the best node for new VM placement"""
    if not proxlb_service:
        raise HTTPException(status_code=503, detail="ProxLB service not available")
    
    try:
        result = proxlb_service.get_best_node()
        # Return the result directly - it already has success, best_node, and output fields
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/logs")
async def get_logs(lines: int = 100, level: Optional[str] = None, event_type: Optional[str] = None):
    """Get ProxLB logs with enhanced filtering"""
    if not log_parser:
        raise HTTPException(status_code=503, detail="Log parser not available")
    
    try:
        logs = log_parser.get_logs(lines=lines, level=level, event_type=event_type)
        summary = log_parser.get_events_summary()
        return {"logs": logs, "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/logs/raw")
async def get_raw_logs(lines: int = 200):
    """Get raw ProxLB container logs"""
    if not log_parser:
        raise HTTPException(status_code=503, detail="Log parser not available")
    
    try:
        raw = log_parser.get_raw_logs(lines=lines)
        return {"logs": raw, "lines": lines}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/migrations")
async def get_migrations(limit: int = 50):
    """Get recent migration history from logs"""
    if not log_parser:
        raise HTTPException(status_code=503, detail="Log parser not available")
    
    try:
        migrations = log_parser.get_migrations(limit=limit)
        return {"migrations": migrations}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tasks")
async def get_tasks(limit: int = 50, status: Optional[str] = None):
    """Get Proxmox cluster tasks (migrations, etc.)"""
    if not proxmox_api:
        raise HTTPException(status_code=503, detail="Proxmox API not initialized")
    
    try:
        tasks = await proxmox_api.get_cluster_tasks(limit=limit, status=status)
        return {"tasks": tasks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/rules")
async def get_rules():
    """Get affinity/anti-affinity rules from guests"""
    if not proxmox_api:
        raise HTTPException(status_code=503, detail="Proxmox API not initialized")
    
    try:
        guests = await proxmox_api.get_all_guests()
        config = load_config()
        
        rules = {
            "affinity": {},
            "anti_affinity": {},
            "ignored": [],
            "pinned": {},
            "pools": config.get("balancing", {}).get("pools", {}) if config else {}
        }
        
        for guest in guests:
            tags = guest.get("tags", "").split(";") if guest.get("tags") else []
            
            for tag in tags:
                tag = tag.strip()
                if tag.startswith("plb_affinity_"):
                    group = tag.replace("plb_affinity_", "")
                    if group not in rules["affinity"]:
                        rules["affinity"][group] = []
                    rules["affinity"][group].append({
                        "vmid": guest["vmid"],
                        "name": guest.get("name", f"VM {guest['vmid']}"),
                        "node": guest["node"]
                    })
                elif tag.startswith("plb_anti_affinity_"):
                    group = tag.replace("plb_anti_affinity_", "")
                    if group not in rules["anti_affinity"]:
                        rules["anti_affinity"][group] = []
                    rules["anti_affinity"][group].append({
                        "vmid": guest["vmid"],
                        "name": guest.get("name", f"VM {guest['vmid']}"),
                        "node": guest["node"]
                    })
                elif tag.startswith("plb_ignore_"):
                    rules["ignored"].append({
                        "vmid": guest["vmid"],
                        "name": guest.get("name", f"VM {guest['vmid']}"),
                        "node": guest["node"],
                        "tag": tag
                    })
                elif tag.startswith("plb_pin_"):
                    pin_node = tag.replace("plb_pin_", "")
                    if pin_node not in rules["pinned"]:
                        rules["pinned"][pin_node] = []
                    rules["pinned"][pin_node].append({
                        "vmid": guest["vmid"],
                        "name": guest.get("name", f"VM {guest['vmid']}"),
                        "current_node": guest["node"]
                    })
        
        return rules
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/service/restart")
async def restart_service():
    """Restart ProxLB service"""
    if not proxlb_service:
        raise HTTPException(status_code=503, detail="ProxLB service not available")
    
    try:
        result = proxlb_service.restart()
        return {"success": True, "message": "ProxLB service restarted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/service/stop")
async def stop_service():
    """Stop ProxLB service"""
    if not proxlb_service:
        raise HTTPException(status_code=503, detail="ProxLB service not available")
    
    try:
        result = proxlb_service.stop()
        return {"success": True, "message": "ProxLB service stopped"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/service/start")
async def start_service():
    """Start ProxLB service"""
    if not proxlb_service:
        raise HTTPException(status_code=503, detail="ProxLB service not available")
    
    try:
        result = proxlb_service.start()
        return {"success": True, "message": "ProxLB service started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== WebSocket for Live Logs ==============

@app.websocket("/ws/logs")
async def websocket_logs(websocket: WebSocket):
    """WebSocket endpoint for live log streaming"""
    await websocket.accept()
    
    try:
        process = subprocess.Popen(
            ["docker", "logs", "-f", "--tail", "50", DOCKER_CONTAINER_NAME],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )
        
        while True:
            line = process.stdout.readline()
            if line:
                await websocket.send_text(line.strip())
            else:
                await asyncio.sleep(0.1)
                
    except WebSocketDisconnect:
        process.terminate()
    except Exception as e:
        await websocket.close(code=1000)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)



# ============== Proxmox HA Maintenance Mode ==============

class ProxmoxMaintenanceRequest(BaseModel):
    node: str
    enable: bool


@app.get("/api/ha/status")
async def get_ha_status():
    """Get HA cluster status"""
    if not proxmox_api:
        raise HTTPException(status_code=503, detail="Proxmox API not initialized")
    
    try:
        status = await proxmox_api.get_ha_status()
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ha/node/{node}")
async def get_node_ha_state(node: str):
    """Get HA state for a specific node"""
    if not proxmox_api:
        raise HTTPException(status_code=503, detail="Proxmox API not initialized")
    
    try:
        state = await proxmox_api.get_node_ha_state(node)
        return state
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ha/maintenance")
async def set_proxmox_ha_maintenance(data: ProxmoxMaintenanceRequest):
    """Set or unset Proxmox HA maintenance mode for a node.
    
    This is REAL Proxmox maintenance mode that:
    - Migrates all HA-managed VMs/CTs to other nodes
    - Prevents new workloads from being placed on the node
    - Is managed at the cluster level
    
    Different from ProxLB maintenance which only affects balancing decisions.
    """
    if not proxmox_api:
        raise HTTPException(status_code=503, detail="Proxmox API not initialized")
    
    try:
        # Try the main method
        try:
            result = await proxmox_api.set_node_ha_maintenance(data.node, data.enable)
            return result
        except Exception as e1:
            # Try the SSH fallback method
            try:
                result = await proxmox_api.set_node_ha_maintenance_via_ssh(data.node, data.enable)
                return result
            except Exception as e2:
                # If API methods fail, provide instructions for manual execution
                raise HTTPException(
                    status_code=500, 
                    detail={
                        "error": f"Could not set HA maintenance via API: {str(e1)}",
                        "manual_command": f"Run on any Proxmox node: pvesh set /cluster/ha/status/manager_status --node {data.node} --state {'maintenance' if data.enable else 'online'}",
                        "alternative": f"Or use Proxmox GUI: Datacenter → HA → Status → Manager Status → Right-click node → Set maintenance/online"
                    }
                )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/nodes/maintenance-status")
async def get_all_nodes_maintenance_status():
    """Get maintenance status for all nodes (both ProxLB and Proxmox HA)"""
    if not proxmox_api:
        raise HTTPException(status_code=503, detail="Proxmox API not initialized")
    
    try:
        # Get ProxLB maintenance nodes from config
        config = load_config()
        proxlb_maintenance_nodes = config.get("proxmox_cluster", {}).get("maintenance_nodes", []) if config else []
        
        # Get Proxmox HA status
        ha_status = await proxmox_api.get_ha_status()
        
        # Get all nodes
        nodes = await proxmox_api.get_nodes()
        
        # Build combined status
        result = []
        for node in nodes:
            node_name = node.get("node")
            
            # Check HA maintenance status
            ha_in_maintenance = False
            for item in ha_status.get("status", []):
                if item.get("type") == "node" and item.get("node") == node_name:
                    ha_in_maintenance = item.get("status") == "maintenance"
                    break
            
            result.append({
                "node": node_name,
                "status": node.get("status"),
                "proxlb_maintenance": node_name in proxlb_maintenance_nodes,
                "proxmox_ha_maintenance": ha_in_maintenance,
                "any_maintenance": node_name in proxlb_maintenance_nodes or ha_in_maintenance
            })
        
        return {"nodes": result, "proxlb_maintenance_nodes": proxlb_maintenance_nodes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
