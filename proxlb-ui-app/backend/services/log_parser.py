"""
Log Parser Service
Parses ProxLB logs from Docker container and Proxmox tasks
"""

import subprocess
import re
from datetime import datetime
from typing import Dict, List, Optional


class LogParser:
    """Parses ProxLB Docker logs and extracts events"""
    
    def __init__(self, container_name: str = "proxlb"):
        self.container_name = container_name
        
        # Regex patterns for parsing ProxLB logs
        # Format: 2024-12-27 20:30:00,123 - ProxLB - INFO - Message
        self.log_pattern = re.compile(
            r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},?\d{0,3})\s*-?\s*(?:ProxLB\s*-\s*)?(\w+)\s*-?\s*(.+)',
            re.IGNORECASE
        )
        
        # Alternative simpler pattern
        self.simple_pattern = re.compile(
            r'(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}).*?(\bINFO\b|\bWARNING\b|\bERROR\b|\bDEBUG\b).*?[:-]\s*(.+)',
            re.IGNORECASE
        )
        
        # Migration patterns
        self.migration_patterns = [
            re.compile(r'Balancing: Starting to migrate (\w+) guest (.+) from (.+) to (.+)\.', re.IGNORECASE),
            re.compile(r'migrate.*?(\d+).*?from\s+(\S+)\s+to\s+(\S+)', re.IGNORECASE),
            re.compile(r'migration.*?(\S+).*?(started|completed|failed)', re.IGNORECASE),
            re.compile(r'moving\s+(\S+)\s+from\s+(\S+)\s+to\s+(\S+)', re.IGNORECASE),
        ]
        
        # Event patterns for categorization
        self.event_patterns = {
            'migration_start': re.compile(r'Starting to migrate|migration started|begin.*migrat', re.IGNORECASE),
            'migration_complete': re.compile(r'migration.*complete|successfully migrated|migration.*done', re.IGNORECASE),
            'migration_failed': re.compile(r'migration.*fail|failed to migrate|migration.*error', re.IGNORECASE),
            'rebalance_start': re.compile(r'Starting rebalance|begin.*balanc|starting.*balanc', re.IGNORECASE),
            'rebalance_complete': re.compile(r'Rebalance complete|balancing complete|finished.*balanc', re.IGNORECASE),
            'daemon_status': re.compile(r'Daemon mode|Next run|scheduled', re.IGNORECASE),
            'config_load': re.compile(r'config.*load|loading config|configuration', re.IGNORECASE),
            'node_status': re.compile(r'node.*online|node.*offline|maintenance', re.IGNORECASE),
            'error': re.compile(r'error|exception|failed|failure', re.IGNORECASE),
            'warning': re.compile(r'warning|warn', re.IGNORECASE),
        }
    
    def get_raw_logs(self, lines: int = 500) -> str:
        """Get raw logs from Docker container"""
        try:
            result = subprocess.run(
                ["docker", "logs", "--tail", str(lines), self.container_name],
                capture_output=True,
                text=True,
                timeout=10
            )
            # Docker logs go to stderr
            return result.stderr + result.stdout
        except subprocess.TimeoutExpired:
            return "Timeout getting logs"
        except Exception as e:
            return f"Error: {str(e)}"
    
    def get_logs(self, lines: int = 100, level: Optional[str] = None, 
                 event_type: Optional[str] = None) -> List[Dict]:
        """Get parsed log entries with enhanced filtering"""
        try:
            raw_output = self.get_raw_logs(lines * 2)  # Get more to account for filtering
            
            logs = []
            for line in raw_output.strip().split("\n"):
                if not line or len(line.strip()) < 5:
                    continue
                
                parsed = self._parse_log_line(line)
                if not parsed:
                    continue
                
                # Filter by level if specified
                if level and parsed.get("level", "").upper() != level.upper():
                    continue
                
                # Filter by event type if specified
                if event_type and parsed.get("event_type") != event_type:
                    continue
                
                logs.append(parsed)
                
                if len(logs) >= lines:
                    break
            
            return logs
        except Exception as e:
            return [{"level": "ERROR", "message": f"Failed to get logs: {str(e)}", "timestamp": datetime.now().isoformat()}]
    
    def _parse_log_line(self, line: str) -> Optional[Dict]:
        """Parse a single log line with enhanced detection"""
        line = line.strip()
        if not line:
            return None
        
        # Try standard pattern first
        match = self.log_pattern.match(line)
        if not match:
            # Try simple pattern
            match = self.simple_pattern.search(line)
        
        if match:
            timestamp_str = match.group(1)
            level = match.group(2).upper()
            message = match.group(3).strip()
        else:
            # Fall back to raw line
            timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            level = self._detect_level(line)
            message = line
        
        # Detect event type
        event_type = self._detect_event_type(message)
        
        # Check if it's a migration log
        migration_info = self._extract_migration_info(message)
        
        result = {
            "timestamp": timestamp_str,
            "level": level,
            "message": message,
            "event_type": event_type,
            "is_migration": migration_info is not None
        }
        
        if migration_info:
            result["migration"] = migration_info
        
        return result
    
    def _detect_level(self, line: str) -> str:
        """Detect log level from line content"""
        line_upper = line.upper()
        if 'ERROR' in line_upper or 'EXCEPTION' in line_upper or 'FAILED' in line_upper:
            return 'ERROR'
        elif 'WARNING' in line_upper or 'WARN' in line_upper:
            return 'WARNING'
        elif 'DEBUG' in line_upper:
            return 'DEBUG'
        else:
            return 'INFO'
    
    def _detect_event_type(self, message: str) -> str:
        """Detect event type from message content"""
        for event_type, pattern in self.event_patterns.items():
            if pattern.search(message):
                return event_type
        return 'general'
    
    def _extract_migration_info(self, message: str) -> Optional[Dict]:
        """Extract migration details from log message"""
        for pattern in self.migration_patterns:
            match = pattern.search(message)
            if match:
                groups = match.groups()
                if len(groups) >= 3:
                    return {
                        "guest": groups[0],
                        "from_node": groups[1] if len(groups) > 1 else "unknown",
                        "to_node": groups[2] if len(groups) > 2 else "unknown",
                        "status": groups[3] if len(groups) > 3 else "started"
                    }
                elif len(groups) >= 2:
                    return {
                        "guest": groups[0],
                        "status": groups[1]
                    }
        return None
    
    def get_migrations(self, limit: int = 50) -> List[Dict]:
        """Get migration events from logs"""
        logs = self.get_logs(lines=500)
        
        migrations = []
        for log in logs:
            if log.get("is_migration") and "migration" in log:
                mig = log["migration"]
                migrations.append({
                    "timestamp": log.get("timestamp", ""),
                    "guest_name": mig.get("guest", mig.get("name", "Unknown")),
                    "from_node": mig.get("from_node", ""),
                    "to_node": mig.get("to_node", ""),
                    "status": mig.get("status", "started"),
                    "type": mig.get("type", "VM")
                })
        
        return migrations[:limit]
    
    def get_events_summary(self) -> Dict:
        """Get summary of events from logs"""
        logs = self.get_logs(lines=500)
        
        summary = {
            "total": len(logs),
            "by_level": {"INFO": 0, "WARNING": 0, "ERROR": 0, "DEBUG": 0},
            "by_type": {},
            "migrations": {"total": 0, "successful": 0, "failed": 0},
            "last_run": None,
            "errors_recent": []
        }
        
        for log in logs:
            level = log.get("level", "INFO")
            if level in summary["by_level"]:
                summary["by_level"][level] += 1
            
            event_type = log.get("event_type", "general")
            summary["by_type"][event_type] = summary["by_type"].get(event_type, 0) + 1
            
            if log.get("is_migration"):
                summary["migrations"]["total"] += 1
                if log.get("event_type") == "migration_complete":
                    summary["migrations"]["successful"] += 1
                elif log.get("event_type") == "migration_failed":
                    summary["migrations"]["failed"] += 1
            
            if level == "ERROR":
                summary["errors_recent"].append({
                    "timestamp": log.get("timestamp"),
                    "message": log.get("message", "")[:100]
                })
        
        summary["errors_recent"] = summary["errors_recent"][-5:]  # Keep last 5
        
        return summary
    
    def get_last_run_info(self) -> Dict:
        """Get information about the last ProxLB run"""
        logs = self.get_logs(lines=200)
        
        return {
            "last_activity": logs[0].get("timestamp") if logs else None,
            "total_logs": len(logs),
            "summary": self.get_events_summary()
        }

