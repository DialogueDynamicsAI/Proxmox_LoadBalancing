# Changelog

All notable changes to the ProxLB Web Interface project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2024-12-28

### Added

#### Backend (FastAPI)
- Initial FastAPI application structure
- Proxmox API integration service
  - Cluster status retrieval
  - Node resource monitoring
  - VM/CT listing with tags
- ProxLB service management
  - Container status checking
  - Start/stop/restart controls
  - Manual rebalance triggering
  - Dry-run simulation support
  - Best node calculation
- Log parsing service
  - Docker log retrieval
  - Migration event extraction
  - Log level filtering
- Configuration management
  - YAML config loading/saving
  - Password masking for security
  - Maintenance node management
- WebSocket support for live log streaming
- RESTful API endpoints for all features

#### Frontend
- Modern dashboard with dark theme
- Responsive layout with CSS Grid/Flexbox
- Interactive components:
  - Resource gauge charts (CPU/Memory/Disk)
  - Node cards with status indicators
  - Guest table with search/filter
  - Migration activity feed
  - Real-time log viewer
  - Configuration editor
- Navigation sidebar with icons
- Toast notifications for actions
- Loading states and error handling

#### Docker
- Multi-stage Dockerfile for optimized image
- Docker Compose configuration
- Volume mounts for config and logs
- Health check configuration

#### Documentation
- Project scope document
- Statement of Work (SOW)
- API documentation
- Deployment guide
- This changelog

### Technical Details

#### Dependencies
- Python 3.11+
- FastAPI 0.104+
- Uvicorn 0.24+
- proxmoxer 2.0+
- PyYAML 6.0+
- httpx 0.25+

#### Proxmox Compatibility
- Proxmox VE 7.x
- Proxmox VE 8.x
- Proxmox VE 9.x

#### ProxLB Compatibility
- ProxLB v1.0.0 - v1.1.10

---

## [Unreleased]

### Planned Features
- User authentication (login/logout)
- Role-based access control
- Multi-cluster support
- Historical metrics with charts
- Email notifications
- Webhook integrations
- Scheduled maintenance windows
- Configuration backup/restore
- Theme switching (dark/light)

### Known Issues
- None reported yet

---

## Version History

| Version | Date | Status |
|---------|------|--------|
| 1.0.0 | 2024-12-28 | Current Release |

---

## Contributors

- DialogueDynamics AI Team
- Community Contributors (Welcome!)

---

## License

This project is licensed under the GPL-3.0 License - consistent with ProxLB licensing.

