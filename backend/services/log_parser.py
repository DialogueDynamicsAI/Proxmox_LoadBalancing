"""
Log Parser Service
Parses ProxLB logs from Docker container
"""

import subprocess
import re
from datetime import datetime
from typing import Dict, List, Optional


class LogParser:
    """Parses ProxLB Docker logs"""
    
    def __init__(self, container_name: str = "proxlb"):
        self.container_name = container_name
        
        # Regex patterns for parsing logs
        self.log_pattern = re.compile(
            r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}) - ProxLB - (\w+) - (.+)'
        )
        self.migration_pattern = re.compile(
            r'Balancing: Starting to migrate (\w+) guest (.+) from (.+) to (.+)\.'
        )
        self.daemon_pattern = re.compile(
            r'Daemon mode active: Next run in: (\d+) (\w+)\.'
        )
    
    def get_logs(self, lines: int = 100, level: Optional[str] = None) -> List[Dict]:
        """Get parsed log entries"""
        try:
            result = subprocess.run(
                ["docker", "logs", "--tail", str(lines), self.container_name],
                capture_output=True,
                text=True
            )
            
            # Combine stdout and stderr (docker logs outputs to stderr)
            output = result.stdout + result.stderr
            
            logs = []
            for line in output.strip().split("\n"):
                if not line:
                    continue
                
                parsed = self._parse_log_line(line)
                if parsed:
                    # Filter by level if specified
                    if level and parsed["level"] != level.upper():
                        continue
                    logs.append(parsed)
            
            return logs
        except Exception as e:
            return [{"error": str(e)}]
    
    def _parse_log_line(self, line: str) -> Optional[Dict]:
        """Parse a single log line"""
        match = self.log_pattern.match(line)
        if match:
            timestamp_str, level, message = match.groups()
            
            # Check if it's a migration log
            migration_match = self.migration_pattern.search(message)
            is_migration = migration_match is not None
            
            # Check if it's a daemon status log
            daemon_match = self.daemon_pattern.search(message)
            
            result = {
                "timestamp": timestamp_str,
                "level": level,
                "message": message,
                "is_migration": is_migration
            }
            
            if is_migration:
                result["migration"] = {
                    "type": migration_match.group(1),  # VM or CT
                    "name": migration_match.group(2),
                    "from_node": migration_match.group(3),
                    "to_node": migration_match.group(4)
                }
            
            if daemon_match:
                result["next_run"] = {
                    "value": int(daemon_match.group(1)),
                    "unit": daemon_match.group(2)
                }
            
            return result
        
        # Return unparsed line
        return {
            "timestamp": None,
            "level": "RAW",
            "message": line,
            "is_migration": False
        }
    
    def get_migrations(self, limit: int = 50) -> List[Dict]:
        """Get migration events from logs"""
        logs = self.get_logs(lines=500)  # Get more logs to find migrations
        
        migrations = []
        for log in logs:
            if log.get("is_migration") and "migration" in log:
                migrations.append({
                    "timestamp": log["timestamp"],
                    "type": log["migration"]["type"],
                    "guest_name": log["migration"]["name"],
                    "from_node": log["migration"]["from_node"],
                    "to_node": log["migration"]["to_node"]
                })
        
        # Return most recent first, limited
        return migrations[:limit]
    
    def get_last_run_info(self) -> Dict:
        """Get information about the last ProxLB run"""
        logs = self.get_logs(lines=200)
        
        last_run = None
        next_run = None
        migrations_count = 0
        
        for log in reversed(logs):
            if log.get("is_migration"):
                migrations_count += 1
            
            if "next_run" in log:
                next_run = log["next_run"]
                last_run = log["timestamp"]
                break
        
        return {
            "last_run": last_run,
            "next_run": next_run,
            "migrations_in_last_run": migrations_count
        }
    
    def stream_logs(self):
        """Generator for streaming logs (for WebSocket)"""
        process = subprocess.Popen(
            ["docker", "logs", "-f", "--tail", "0", self.container_name],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )
        
        try:
            for line in process.stdout:
                parsed = self._parse_log_line(line.strip())
                if parsed:
                    yield parsed
        finally:
            process.terminate()

