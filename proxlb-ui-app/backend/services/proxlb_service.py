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
    
    def _run_docker_cmd(self, args: List[str], capture_output: bool = True, timeout: int = 120) -> subprocess.CompletedProcess:
        """Run a docker command"""
        cmd = ["docker"] + args
        try:
            return subprocess.run(cmd, capture_output=capture_output, text=True, timeout=timeout)
        except subprocess.TimeoutExpired:
            return subprocess.CompletedProcess(cmd, 1, stdout="", stderr="Command timed out")
    
    def get_status(self) -> Dict:
        """Get ProxLB container status"""
        try:
            # First check if container exists
            result = self._run_docker_cmd([
                "inspect", 
                "--format", 
                '{"running": {{.State.Running}}, "status": "{{.State.Status}}", "started": "{{.State.StartedAt}}"}',
                self.container_name
            ], timeout=10)
            
            if result.returncode == 0:
                # Parse the JSON output
                status_str = result.stdout.strip()
                status = json.loads(status_str)
                status["exists"] = True
                status["container_name"] = self.container_name
                return status
            else:
                return {
                    "exists": False,
                    "running": False,
                    "status": "not found",
                    "container_name": self.container_name,
                    "message": "ProxLB container not found"
                }
        except json.JSONDecodeError as e:
            return {
                "exists": False,
                "running": False,
                "status": "error",
                "error": f"Failed to parse container status: {str(e)}"
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
            return {"success": True, "message": "Already running", "status": "running"}
        
        if result.returncode == 0:
            return {"success": True, "message": "Started successfully", "status": "running"}
        else:
            return {"success": False, "error": result.stderr, "status": "failed"}
    
    def stop(self) -> Dict:
        """Stop the ProxLB container"""
        result = self._run_docker_cmd(["stop", self.container_name])
        
        if result.returncode == 0:
            return {"success": True, "message": "Stopped successfully", "status": "stopped"}
        else:
            return {"success": False, "error": result.stderr, "status": "error"}
    
    def restart(self) -> Dict:
        """Restart the ProxLB container"""
        result = self._run_docker_cmd(["restart", self.container_name])
        
        if result.returncode == 0:
            return {"success": True, "message": "Restarted successfully", "status": "running"}
        else:
            return {"success": False, "error": result.stderr, "status": "error"}
    
    def run_once(self, dry_run: bool = False) -> Dict:
        """Run ProxLB once (not as daemon) and capture output"""
        # Build command - run a one-time balance check
        args = [
            "run", "--rm",
            "-v", f"{self.config_path}:/etc/proxlb/proxlb.yaml:ro",
            self.image,
            "-c", "/etc/proxlb/proxlb.yaml"
        ]
        
        if dry_run:
            args.append("-d")  # Use short flag for dry-run
        
        # Use longer timeout for actual balancing which may do migrations
        timeout = 120 if dry_run else 600
        result = self._run_docker_cmd(args, timeout=timeout)
        
        # Combine stdout and stderr for full output
        full_output = result.stdout + result.stderr
        
        # Parse log lines
        log_lines = []
        migrations = []
        for line in full_output.strip().split("\n"):
            if line.strip():
                log_lines.append(line)
                # Detect migration lines
                if "migrate" in line.lower() or "balancing:" in line.lower():
                    migrations.append(line)
        
        # Check for timeout
        if "timed out" in full_output.lower():
            return {
                "success": False,
                "error": "Operation timed out. Check logs for details.",
                "output": log_lines,
                "dry_run": dry_run
            }
        
        if result.returncode == 0 or "ProxLB" in full_output:
            return {
                "success": True, 
                "dry_run": dry_run,
                "output": log_lines,
                "migrations": migrations,
                "message": f"{'Dry run' if dry_run else 'Balancing'} completed successfully"
            }
        else:
            return {
                "success": False, 
                "error": result.stderr or "Unknown error",
                "output": log_lines,
                "dry_run": dry_run
            }
    
    def get_best_node(self) -> Dict:
        """Get the best node for VM placement"""
        args = [
            "run", "--rm",
            "-v", f"{self.config_path}:/etc/proxlb/proxlb.yaml:ro",
            self.image,
            "-c", "/etc/proxlb/proxlb.yaml",
            "-b"  # Use short flag
        ]
        
        result = self._run_docker_cmd(args, timeout=60)
        
        full_output = (result.stdout + result.stderr).strip()
        
        # The best node is typically the last line of output (after log messages)
        lines = [l.strip() for l in full_output.split("\n") if l.strip()]
        best_node = None
        
        # Find the node name - it's usually a short name without log prefixes
        for line in reversed(lines):
            # Skip log lines
            if " - ProxLB - " not in line and not line.startswith("2"):
                best_node = line
                break
        
        # If still not found, get the last non-empty line
        if not best_node and lines:
            best_node = lines[-1]
        
        if best_node and "error" not in best_node.lower():
            return {
                "success": True, 
                "best_node": best_node,
                "output": full_output
            }
        else:
            return {
                "success": False, 
                "error": result.stderr or full_output or "Failed to get best node",
                "output": full_output
            }
    
    def get_logs(self, lines: int = 100) -> str:
        """Get container logs"""
        result = self._run_docker_cmd(["logs", "--tail", str(lines), self.container_name])
        return result.stdout + result.stderr
    
    def get_version(self) -> str:
        """Get ProxLB version"""
        result = self._run_docker_cmd([
            "run", "--rm",
            self.image,
            "--version"
        ], timeout=30)
        
        if result.returncode == 0:
            return result.stdout.strip()
        return "unknown"
