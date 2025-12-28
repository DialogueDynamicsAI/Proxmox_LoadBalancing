"""
Proxmox API Client Service
Handles all communication with the Proxmox VE API
"""

import asyncio
from typing import Dict, List, Optional, Any
from proxmoxer import ProxmoxAPI as ProxmoxerAPI
import urllib3

# Disable SSL warnings for self-signed certs
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class ProxmoxAPI:
    """Proxmox API client wrapper"""
    
    def __init__(self, config: Dict):
        """Initialize with ProxLB config"""
        self.config = config
        self.api_config = config.get("proxmox_api", {})
        self.hosts = self.api_config.get("hosts", [])
        self.user = self.api_config.get("user", "root@pam")
        self.password = self.api_config.get("pass", "")
        self.verify_ssl = self.api_config.get("ssl_verification", False)
        self.timeout = self.api_config.get("timeout", 10)
        
        self._client = None
        self._connected_host = None
    
    def _get_client(self) -> ProxmoxerAPI:
        """Get or create Proxmox API client"""
        if self._client is not None:
            return self._client
        
        # Try each host until one connects
        last_error = None
        for host in self.hosts:
            try:
                # Parse host and port
                if ":" in host and not host.startswith("["):
                    host_addr, port = host.rsplit(":", 1)
                    port = int(port)
                else:
                    host_addr = host
                    port = 8006
                
                self._client = ProxmoxerAPI(
                    host_addr,
                    user=self.user,
                    password=self.password,
                    verify_ssl=self.verify_ssl,
                    timeout=self.timeout,
                    port=port
                )
                self._connected_host = host
                print(f"Connected to Proxmox API at {host}")
                return self._client
            except Exception as e:
                last_error = e
                print(f"Failed to connect to {host}: {e}")
                continue
        
        raise ConnectionError(f"Could not connect to any Proxmox host: {last_error}")
    
    def close(self):
        """Close the API connection"""
        self._client = None
        self._connected_host = None
    
    async def get_cluster_status(self) -> Dict:
        """Get cluster status overview"""
        try:
            client = self._get_client()
            
            # Get cluster status
            cluster_status = client.cluster.status.get()
            
            # Get cluster resources summary
            resources = client.cluster.resources.get()
            
            # Calculate totals
            nodes = [r for r in resources if r.get("type") == "node"]
            vms = [r for r in resources if r.get("type") == "qemu"]
            cts = [r for r in resources if r.get("type") == "lxc"]
            
            total_cpu = sum(n.get("maxcpu", 0) for n in nodes)
            used_cpu = sum(n.get("cpu", 0) * n.get("maxcpu", 0) for n in nodes)
            
            total_mem = sum(n.get("maxmem", 0) for n in nodes)
            used_mem = sum(n.get("mem", 0) for n in nodes)
            
            total_disk = sum(n.get("maxdisk", 0) for n in nodes)
            used_disk = sum(n.get("disk", 0) for n in nodes)
            
            return {
                "cluster_name": next((s.get("name") for s in cluster_status if s.get("type") == "cluster"), "Unknown"),
                "quorate": next((s.get("quorate") for s in cluster_status if s.get("type") == "cluster"), 0),
                "nodes": {
                    "total": len(nodes),
                    "online": sum(1 for n in nodes if n.get("status") == "online"),
                    "offline": sum(1 for n in nodes if n.get("status") != "online")
                },
                "guests": {
                    "vms": {
                        "total": len(vms),
                        "running": sum(1 for v in vms if v.get("status") == "running"),
                        "stopped": sum(1 for v in vms if v.get("status") != "running")
                    },
                    "containers": {
                        "total": len(cts),
                        "running": sum(1 for c in cts if c.get("status") == "running"),
                        "stopped": sum(1 for c in cts if c.get("status") != "running")
                    }
                },
                "resources": {
                    "cpu": {
                        "total": total_cpu,
                        "used": round(used_cpu, 2),
                        "percent": round((used_cpu / total_cpu * 100) if total_cpu > 0 else 0, 1)
                    },
                    "memory": {
                        "total": total_mem,
                        "used": used_mem,
                        "percent": round((used_mem / total_mem * 100) if total_mem > 0 else 0, 1)
                    },
                    "disk": {
                        "total": total_disk,
                        "used": used_disk,
                        "percent": round((used_disk / total_disk * 100) if total_disk > 0 else 0, 1)
                    }
                },
                "connected_host": self._connected_host
            }
        except Exception as e:
            raise Exception(f"Failed to get cluster status: {e}")
    
    async def get_nodes(self) -> List[Dict]:
        """Get all nodes with their resources"""
        try:
            client = self._get_client()
            nodes = client.nodes.get()
            
            result = []
            for node in nodes:
                node_name = node.get("node")
                
                # Get detailed node status
                try:
                    status = client.nodes(node_name).status.get()
                except:
                    status = {}
                
                # Count VMs and CTs on this node
                try:
                    qemu = client.nodes(node_name).qemu.get()
                    lxc = client.nodes(node_name).lxc.get()
                except:
                    qemu = []
                    lxc = []
                
                result.append({
                    "node": node_name,
                    "status": node.get("status", "unknown"),
                    "cpu": round(node.get("cpu", 0) * 100, 1),
                    "maxcpu": node.get("maxcpu", 0),
                    "mem": node.get("mem", 0),
                    "maxmem": node.get("maxmem", 0),
                    "mem_percent": round((node.get("mem", 0) / node.get("maxmem", 1)) * 100, 1),
                    "disk": node.get("disk", 0),
                    "maxdisk": node.get("maxdisk", 0),
                    "disk_percent": round((node.get("disk", 0) / node.get("maxdisk", 1)) * 100, 1),
                    "uptime": node.get("uptime", 0),
                    "vm_count": len(qemu),
                    "ct_count": len(lxc),
                    "guest_count": len(qemu) + len(lxc)
                })
            
            return result
        except Exception as e:
            raise Exception(f"Failed to get nodes: {e}")
    
    async def get_node_guests(self, node: str) -> List[Dict]:
        """Get all guests on a specific node"""
        try:
            client = self._get_client()
            guests = []
            
            # Get VMs
            try:
                vms = client.nodes(node).qemu.get()
                for vm in vms:
                    vm["type"] = "qemu"
                    vm["node"] = node
                    guests.append(vm)
            except:
                pass
            
            # Get containers
            try:
                cts = client.nodes(node).lxc.get()
                for ct in cts:
                    ct["type"] = "lxc"
                    ct["node"] = node
                    guests.append(ct)
            except:
                pass
            
            return guests
        except Exception as e:
            raise Exception(f"Failed to get guests for node {node}: {e}")
    
    async def get_all_guests(self) -> List[Dict]:
        """Get all guests across all nodes"""
        try:
            client = self._get_client()
            resources = client.cluster.resources.get(type="vm")
            
            guests = []
            for resource in resources:
                guest = {
                    "vmid": resource.get("vmid"),
                    "name": resource.get("name", f"VM {resource.get('vmid')}"),
                    "type": resource.get("type"),
                    "node": resource.get("node"),
                    "status": resource.get("status"),
                    "cpu": round(resource.get("cpu", 0) * 100, 1),
                    "maxcpu": resource.get("maxcpu", 0),
                    "mem": resource.get("mem", 0),
                    "maxmem": resource.get("maxmem", 0),
                    "mem_percent": round((resource.get("mem", 0) / resource.get("maxmem", 1)) * 100, 1) if resource.get("maxmem", 0) > 0 else 0,
                    "disk": resource.get("disk", 0),
                    "maxdisk": resource.get("maxdisk", 0),
                    "uptime": resource.get("uptime", 0),
                    "tags": resource.get("tags", ""),
                    "template": resource.get("template", 0)
                }
                guests.append(guest)
            
            # Sort by node, then by vmid
            guests.sort(key=lambda x: (x["node"], x["vmid"]))
            
            return guests
        except Exception as e:
            raise Exception(f"Failed to get all guests: {e}")
    
    async def get_guest_details(self, node: str, vmid: int, guest_type: str = "qemu") -> Dict:
        """Get detailed information about a specific guest"""
        try:
            client = self._get_client()
            
            if guest_type == "qemu":
                config = client.nodes(node).qemu(vmid).config.get()
                status = client.nodes(node).qemu(vmid).status.current.get()
            else:
                config = client.nodes(node).lxc(vmid).config.get()
                status = client.nodes(node).lxc(vmid).status.current.get()
            
            return {
                "config": config,
                "status": status
            }
        except Exception as e:
            raise Exception(f"Failed to get guest details: {e}")

