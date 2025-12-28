"""
ProxLB Service Management
Handles ProxLB container operations and configuration
"""

import subprocess
import json
from typing import Dict, Optional, List


class ProxLBService:
    """Manages ProxLB Docker container"""
    
    def __init__(self, config_path: str, container_name: str = "proxlb"):
        self.config_path = config_path
        self.container_name = container_name
        self.image = "cr.gyptazy.com/proxlb/proxlb:latest"
    
    def _run_docker_cmd(self, args: List[str], capture_output: bool = True) -> subprocess.CompletedProcess:
        """Run a docker command"""
        cmd = ["docker"] + args
        return subprocess.run(cmd, capture_output=capture_output, text=True)
    
    def get_status(self) -> Dict:
        """Get ProxLB container status"""
        try:
            result = self._run_docker_cmd([
                "inspect", 
                "--format", 
                '{"running": {{.State.Running}}, "status": "{{.State.Status}}", "started": "{{.State.StartedAt}}", "health": "{{.State.Health.Status}}"}',
                self.container_name
            ])
            
            if result.returncode == 0:
                # Parse the JSON output
                status_str = result.stdout.strip()
                # Handle cases where health might be empty
                status_str = status_str.replace('"health": ""', '"health": "none"')
                status = json.loads(status_str)
                status["exists"] = True
                return status
            else:
                return {
                    "exists": False,
                    "running": False,
                    "status": "not found",
                    "error": result.stderr
                }
        except Exception as e:
            return {
                "exists": False,
                "running": False,
                "status": "error",
                "error": str(e)
            }
    
    def start(self) -> Dict:
        """Start the ProxLB container"""
        status = self.get_status()
        
        if not status.get("exists"):
            # Container doesn't exist, create it
            result = self._run_docker_cmd([
                "run", "-d",
                "--name", self.container_name,
                "--restart", "unless-stopped",
                "-v", f"{self.config_path}:/etc/proxlb/proxlb.yaml:ro",
                self.image
            ])
        elif not status.get("running"):
            # Container exists but not running
            result = self._run_docker_cmd(["start", self.container_name])
        else:
            return {"success": True, "message": "Already running"}
        
        if result.returncode == 0:
            return {"success": True, "message": "Started successfully"}
        else:
            return {"success": False, "error": result.stderr}
    
    def stop(self) -> Dict:
        """Stop the ProxLB container"""
        result = self._run_docker_cmd(["stop", self.container_name])
        
        if result.returncode == 0:
            return {"success": True, "message": "Stopped successfully"}
        else:
            return {"success": False, "error": result.stderr}
    
    def restart(self) -> Dict:
        """Restart the ProxLB container"""
        result = self._run_docker_cmd(["restart", self.container_name])
        
        if result.returncode == 0:
            return {"success": True, "message": "Restarted successfully"}
        else:
            return {"success": False, "error": result.stderr}
    
    def run_once(self, dry_run: bool = False) -> Dict:
        """Run ProxLB once (not as daemon)"""
        args = [
            "run", "--rm",
            "-v", f"{self.config_path}:/etc/proxlb/proxlb.yaml:ro",
            self.image
        ]
        
        if dry_run:
            args.extend(["--dry-run", "--json"])
        else:
            args.append("--json")
        
        result = self._run_docker_cmd(args)
        
        if result.returncode == 0:
            try:
                # Try to parse JSON output
                output = json.loads(result.stdout)
                return {"success": True, "result": output, "dry_run": dry_run}
            except json.JSONDecodeError:
                return {"success": True, "output": result.stdout, "dry_run": dry_run}
        else:
            return {"success": False, "error": result.stderr, "output": result.stdout}
    
    def get_best_node(self) -> Dict:
        """Get the best node for VM placement"""
        result = self._run_docker_cmd([
            "run", "--rm",
            "-v", f"{self.config_path}:/etc/proxlb/proxlb.yaml:ro",
            self.image,
            "--best-node"
        ])
        
        if result.returncode == 0:
            return {"success": True, "best_node": result.stdout.strip()}
        else:
            return {"success": False, "error": result.stderr}
    
    def get_version(self) -> str:
        """Get ProxLB version"""
        result = self._run_docker_cmd([
            "run", "--rm",
            self.image,
            "--version"
        ])
        
        if result.returncode == 0:
            return result.stdout.strip()
        return "unknown"

