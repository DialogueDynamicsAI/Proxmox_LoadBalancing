/**
 * ProxLB Web Interface - Main Application JavaScript
 */

// API Base URL
const API_BASE = '/api';

// State
let currentPage = 'dashboard';
let refreshIntervals = {};
let wsConnection = null;

// ============== Initialization ==============

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initForms();
    loadDashboard();
    startAutoRefresh();
});

// ============== Navigation ==============

function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateTo(page);
        });
    });
    
    // Card links
    document.querySelectorAll('.card-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            navigateTo(page);
        });
    });
}

function navigateTo(page) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    
    // Update pages
    document.querySelectorAll('.page').forEach(p => {
        p.classList.toggle('active', p.id === `page-${page}`);
    });
    
    currentPage = page;
    
    // Load page-specific data
    switch (page) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'nodes':
            loadNodes();
            break;
        case 'guests':
            loadGuests();
            break;
        case 'balancing':
            loadBalancingSettings();
            break;
        case 'rules':
            loadRules();
            break;
        case 'logs':
            loadLogs();
            break;
        case 'config':
            loadConfig();
            break;
    }
}

// ============== Forms ==============

function initForms() {
    // Balancing form
    const balancingForm = document.getElementById('balancing-form');
    if (balancingForm) {
        balancingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveBalancingSettings();
        });
    }
    
    // Range inputs
    const balancinessInput = document.getElementById('balanciness-input');
    if (balancinessInput) {
        balancinessInput.addEventListener('input', (e) => {
            document.getElementById('balanciness-value').textContent = `${e.target.value}%`;
        });
    }
    
    const memThresholdInput = document.getElementById('memory-threshold-input');
    if (memThresholdInput) {
        memThresholdInput.addEventListener('input', (e) => {
            document.getElementById('memory-threshold-value').textContent = `${e.target.value}%`;
        });
    }
    
    // Guest search
    const guestSearch = document.getElementById('guest-search');
    if (guestSearch) {
        guestSearch.addEventListener('input', filterGuests);
    }
    
    // Guest node filter
    const guestNodeFilter = document.getElementById('guest-node-filter');
    if (guestNodeFilter) {
        guestNodeFilter.addEventListener('change', filterGuests);
    }
    
    // Log level filter
    const logLevelFilter = document.getElementById('log-level-filter');
    if (logLevelFilter) {
        logLevelFilter.addEventListener('change', loadLogs);
    }
}

// ============== API Helpers ==============

async function apiGet(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`API GET ${endpoint} failed:`, error);
        throw error;
    }
}

async function apiPost(endpoint, data = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`API POST ${endpoint} failed:`, error);
        throw error;
    }
}

// ============== Dashboard ==============

async function loadDashboard() {
    await Promise.all([
        loadClusterStatus(),
        loadNodesOverview(),
        loadMigrations(),
        loadServiceStatus()
    ]);
}

async function refreshDashboard() {
    showToast('Refreshing...', 'info');
    await loadDashboard();
    showToast('Dashboard updated', 'success');
}

async function loadClusterStatus() {
    try {
        const data = await apiGet('/cluster');
        
        // Update cluster name
        document.getElementById('cluster-name').textContent = data.cluster_name || 'Cluster';
        
        // Update node counts
        const nodeCount = document.getElementById('node-count');
        if (nodeCount) {
            nodeCount.innerHTML = `${data.nodes?.online || 0}<span class="count-detail">/${data.nodes?.total || 0}</span>`;
        }
        
        // Update VM counts with online/offline breakdown
        const vmCount = document.getElementById('vm-count');
        if (vmCount) {
            const running = data.guests?.vms?.running || 0;
            const total = data.guests?.vms?.total || 0;
            vmCount.innerHTML = `${running}<span class="count-detail">/${total}</span>`;
        }
        
        // Update container counts with online/offline breakdown
        const ctCount = document.getElementById('ct-count');
        if (ctCount) {
            const running = data.guests?.containers?.running || 0;
            const total = data.guests?.containers?.total || 0;
            ctCount.innerHTML = `${running}<span class="count-detail">/${total}</span>`;
        }
        
        // Update gauges (only running VMs use resources)
        updateGauge('cpu', data.resources?.cpu?.percent || 0);
        updateGauge('mem', data.resources?.memory?.percent || 0);
        updateGauge('disk', data.resources?.disk?.percent || 0);
        
        // Update last refresh time
        updateLastRefreshTime();
        
    } catch (error) {
        showToast('Failed to load cluster status', 'error');
    }
}

function updateLastRefreshTime() {
    const el = document.getElementById('last-refresh');
    if (el) {
        el.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    }
}

function updateGauge(type, percent) {
    const fill = document.getElementById(`${type}-gauge-fill`);
    const value = document.getElementById(`${type}-value`);
    
    if (fill && value) {
        // Calculate stroke-dashoffset (126 is full arc, 0 is empty)
        const offset = 126 - (126 * percent / 100);
        fill.style.strokeDashoffset = offset;
        value.textContent = `${Math.round(percent)}%`;
        
        // Color based on percentage
        if (percent > 90) {
            fill.style.stroke = 'var(--accent-danger)';
        } else if (percent > 75) {
            fill.style.stroke = 'var(--accent-warning)';
        } else {
            fill.style.stroke = 'var(--accent-primary)';
        }
    }
}

async function loadNodesOverview() {
    try {
        const data = await apiGet('/nodes');
        const container = document.getElementById('nodes-grid');
        
        if (!container) return;
        
        container.innerHTML = data.nodes.map(node => `
            <div class="node-card ${node.maintenance ? 'maintenance' : ''}">
                <div class="node-header">
                    <span class="node-name">${node.node}</span>
                    <span class="node-status ${node.status}">
                        ${node.maintenance ? '🔧 Maintenance' : node.status === 'online' ? '✓ Online' : '✗ Offline'}
                    </span>
                </div>
                <div class="node-stats">
                    <div class="node-stat">
                        <span class="node-stat-label">CPU</span>
                        <span class="node-stat-value">${node.cpu.toFixed(1)}%</span>
                    </div>
                    <div class="node-stat">
                        <span class="node-stat-label">Memory</span>
                        <span class="node-stat-value">${node.mem_percent.toFixed(1)}%</span>
                    </div>
                </div>
                <div class="node-guests">
                    💻 ${node.vm_count} VMs · 📦 ${node.ct_count} CTs
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Failed to load nodes overview:', error);
    }
}

async function loadMigrations() {
    try {
        const container = document.getElementById('migration-list');
        if (!container) return;
        
        // Get migrations from both logs and tasks
        const [logsData, tasksData] = await Promise.all([
            apiGet('/migrations?limit=10'),
            apiGet('/tasks?limit=50')
        ]);
        
        let migrations = logsData.migrations || [];
        
        // Add migrations from tasks
        const taskMigrations = (tasksData.tasks || [])
            .filter(t => t.is_migration)
            .slice(0, 10)
            .map(t => ({
                guest_name: t.description || t.type,
                from_node: t.node,
                to_node: '-',
                timestamp: formatTimestamp(t.starttime),
                status: t.success ? 'completed' : 'failed'
            }));
        
        // Combine and sort by timestamp (most recent first)
        migrations = [...migrations, ...taskMigrations]
            .slice(0, 10);
        
        if (migrations.length === 0) {
            container.innerHTML = '<p class="empty-state">No recent migrations</p>';
            return;
        }
        
        container.innerHTML = migrations.map(m => `
            <div class="migration-item ${m.status === 'failed' ? 'failed' : ''}">
                <span class="migration-guest">${m.guest_name || 'Unknown'}</span>
                <span class="migration-path">
                    ${m.from_node || '-'}<span class="arrow">→</span>${m.to_node || '-'}
                </span>
                <span class="migration-time">${m.timestamp || ''}</span>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Failed to load migrations:', error);
    }
}

let nextRunTime = null;
let countdownInterval = null;

async function loadServiceStatus() {
    try {
        const data = await apiGet('/status');
        const config = await apiGet('/config');
        
        const isRunning = data.proxlb?.running || false;
        const isDaemonMode = config.config?.service?.daemon !== false;
        
        updateServiceStatusDisplay(isRunning);
        
        // Update balance method/mode display
        if (config.config?.balancing) {
            const methodEl = document.getElementById('balance-method');
            const modeEl = document.getElementById('balance-mode');
            if (methodEl) methodEl.textContent = (config.config.balancing.method || 'memory').charAt(0).toUpperCase() + (config.config.balancing.method || 'memory').slice(1);
            if (modeEl) modeEl.textContent = (config.config.balancing.mode || 'used').charAt(0).toUpperCase() + (config.config.balancing.mode || 'used').slice(1);
        }
        
        // Update mode display and countdown
        const timerContainer = document.getElementById('next-run-container');
        const timerEl = document.getElementById('next-run-timer');
        const timerLabelEl = document.getElementById('next-run-label');
        
        if (timerContainer && timerEl && timerLabelEl) {
            if (isDaemonMode && isRunning) {
                // Automatic mode - show countdown
                timerLabelEl.textContent = 'Next Rebalance';
                
                // Calculate next run based on started time and interval
                const interval = config.config?.service?.schedule?.interval || 1;
                const format = config.config?.service?.schedule?.format || 'hours';
                const startedAt = data.proxlb?.started ? new Date(data.proxlb.started) : new Date();
                
                // Calculate interval in seconds
                let intervalSec = interval;
                if (format === 'hours') intervalSec = interval * 3600;
                else if (format === 'minutes') intervalSec = interval * 60;
                
                // Find next run time
                const now = new Date();
                const elapsed = (now - startedAt) / 1000;
                const cyclesPassed = Math.floor(elapsed / intervalSec);
                nextRunTime = new Date(startedAt.getTime() + ((cyclesPassed + 1) * intervalSec * 1000));
                
                // Start countdown
                updateCountdown();
                if (!countdownInterval) {
                    countdownInterval = setInterval(updateCountdown, 1000);
                }
                
                timerContainer.classList.remove('manual-mode');
            } else if (!isDaemonMode) {
                // Manual mode
                timerLabelEl.textContent = 'Mode';
                timerEl.textContent = 'Manual';
                timerContainer.classList.add('manual-mode');
                if (countdownInterval) {
                    clearInterval(countdownInterval);
                    countdownInterval = null;
                }
            } else {
                // Daemon mode but not running
                timerLabelEl.textContent = 'Status';
                timerEl.textContent = 'Stopped';
                timerContainer.classList.remove('manual-mode');
                if (countdownInterval) {
                    clearInterval(countdownInterval);
                    countdownInterval = null;
                }
            }
        }
        
    } catch (error) {
        console.error('Failed to load service status:', error);
    }
}

function updateCountdown() {
    const timerEl = document.getElementById('next-run-timer');
    if (!timerEl || !nextRunTime) return;
    
    const now = new Date();
    const diff = nextRunTime - now;
    
    if (diff <= 0) {
        timerEl.textContent = 'Running...';
        // Reset for next cycle
        setTimeout(() => {
            loadServiceStatus();
        }, 5000);
        return;
    }
    
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (hours > 0) {
        timerEl.textContent = `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
        timerEl.textContent = `${minutes}m ${seconds}s`;
    } else {
        timerEl.textContent = `${seconds}s`;
    }
}

function updateServiceStatusDisplay(running) {
    const statusElements = document.querySelectorAll('.service-status, .service-status-large');
    
    statusElements.forEach(el => {
        const dot = el.querySelector('.status-dot');
        const text = el.querySelector('.status-text');
        
        if (dot) {
            dot.classList.toggle('running', running);
            dot.classList.toggle('stopped', !running);
        }
        if (text) {
            text.textContent = running ? 'Running' : 'Stopped';
        }
    });
}

// ============== Nodes Page ==============

let allNodesData = [];
let expandedNodes = {};

async function loadNodes() {
    try {
        const data = await apiGet('/nodes');
        allNodesData = data.nodes || [];
        
        const container = document.getElementById('nodes-container');
        const summaryContainer = document.getElementById('nodes-summary');
        
        if (!container) return;
        
        // Render summary
        if (summaryContainer) {
            const onlineCount = allNodesData.filter(n => n.status === 'online').length;
            const maintCount = allNodesData.filter(n => n.maintenance).length;
            const totalVMs = allNodesData.reduce((sum, n) => sum + (n.vm_count || 0), 0);
            const totalCTs = allNodesData.reduce((sum, n) => sum + (n.ct_count || 0), 0);
            
            summaryContainer.innerHTML = `
                <div class="summary-stats">
                    <div class="summary-stat">
                        <span class="summary-value">${allNodesData.length}</span>
                        <span class="summary-label">Total Nodes</span>
                    </div>
                    <div class="summary-stat online">
                        <span class="summary-value">${onlineCount}</span>
                        <span class="summary-label">Online</span>
                    </div>
                    <div class="summary-stat maintenance">
                        <span class="summary-value">${maintCount}</span>
                        <span class="summary-label">In Maintenance</span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-value">${totalVMs}</span>
                        <span class="summary-label">Total VMs</span>
                    </div>
                    <div class="summary-stat">
                        <span class="summary-value">${totalCTs}</span>
                        <span class="summary-label">Total Containers</span>
                    </div>
                </div>
            `;
        }
        
        // Render node cards
        container.innerHTML = allNodesData.map(node => {
            const isExpanded = expandedNodes[node.node] || false;
            return renderNodeCard(node, isExpanded);
        }).join('');
        
    } catch (error) {
        showToast('Failed to load nodes', 'error');
    }
}

function renderNodeCard(node, isExpanded) {
    const uptime = node.uptime ? formatUptime(node.uptime) : 'Unknown';
    
    return `
        <div class="node-card-large ${node.maintenance ? 'maintenance' : ''} ${isExpanded ? 'expanded' : ''}" 
             data-node="${node.node}">
            <div class="node-card-header" onclick="toggleNodeExpand('${node.node}')">
                <div class="node-card-title">
                    <span class="node-icon">🖥️</span>
                    <div class="node-title-info">
                        <h3>${node.node}</h3>
                        <span class="node-subtitle">💻 ${node.vm_count} VMs · 📦 ${node.ct_count} CTs</span>
                    </div>
                </div>
                <div class="node-header-right">
                    <span class="node-status ${node.maintenance ? 'maintenance' : node.status}">
                        ${node.maintenance ? '🔧 Maintenance' : node.status === 'online' ? '✓ Online' : '✗ Offline'}
                    </span>
                    <span class="expand-icon">${isExpanded ? '▼' : '▶'}</span>
                </div>
            </div>
            
            <div class="node-card-preview">
                <div class="preview-stats">
                    <div class="preview-stat">
                        <span class="preview-label">CPU</span>
                        <div class="mini-bar">
                            <div class="mini-bar-fill ${getBarClass(node.cpu)}" style="width: ${node.cpu}%"></div>
                        </div>
                        <span class="preview-value">${node.cpu.toFixed(1)}%</span>
                    </div>
                    <div class="preview-stat">
                        <span class="preview-label">MEM</span>
                        <div class="mini-bar">
                            <div class="mini-bar-fill ${getBarClass(node.mem_percent)}" style="width: ${node.mem_percent}%"></div>
                        </div>
                        <span class="preview-value">${node.mem_percent.toFixed(1)}%</span>
                    </div>
                    <div class="preview-stat">
                        <span class="preview-label">DISK</span>
                        <div class="mini-bar">
                            <div class="mini-bar-fill ${getBarClass(node.disk_percent)}" style="width: ${node.disk_percent}%"></div>
                        </div>
                        <span class="preview-value">${node.disk_percent.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
            
            <div class="node-card-details" style="display: ${isExpanded ? 'block' : 'none'};">
                <!-- System Info -->
                <div class="detail-section">
                    <h4>System Information</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Uptime</span>
                            <span class="detail-value">${uptime}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">CPU Cores</span>
                            <span class="detail-value">${node.maxcpu || '-'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Total Memory</span>
                            <span class="detail-value">${formatBytes(node.maxmem)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Total Disk</span>
                            <span class="detail-value">${formatBytes(node.maxdisk)}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Resource Details -->
                <div class="detail-section">
                    <h4>Resource Usage</h4>
                    <div class="resource-bars">
                        <div class="resource-bar">
                            <div class="resource-bar-header">
                                <span class="resource-bar-label">🔲 CPU</span>
                                <span class="resource-bar-value">${node.cpu.toFixed(1)}% (${node.maxcpu} cores)</span>
                            </div>
                            <div class="bar-container">
                                <div class="bar-fill cpu ${getBarClass(node.cpu)}" style="width: ${node.cpu}%"></div>
                            </div>
                        </div>
                        <div class="resource-bar">
                            <div class="resource-bar-header">
                                <span class="resource-bar-label">💾 Memory</span>
                                <span class="resource-bar-value">${node.mem_percent.toFixed(1)}% (${formatBytes(node.mem)} / ${formatBytes(node.maxmem)})</span>
                            </div>
                            <div class="bar-container">
                                <div class="bar-fill mem ${getBarClass(node.mem_percent)}" style="width: ${node.mem_percent}%"></div>
                            </div>
                        </div>
                        <div class="resource-bar">
                            <div class="resource-bar-header">
                                <span class="resource-bar-label">💽 Disk</span>
                                <span class="resource-bar-value">${node.disk_percent.toFixed(1)}% (${formatBytes(node.disk)} / ${formatBytes(node.maxdisk)})</span>
                            </div>
                            <div class="bar-container">
                                <div class="bar-fill disk ${getBarClass(node.disk_percent)}" style="width: ${node.disk_percent}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Guest Summary -->
                <div class="detail-section">
                    <h4>Guest Summary</h4>
                    <div class="guest-summary-grid">
                        <div class="guest-summary-item vms">
                            <span class="guest-summary-icon">💻</span>
                            <div class="guest-summary-info">
                                <span class="guest-summary-count">${node.vm_count || 0}</span>
                                <span class="guest-summary-label">Virtual Machines</span>
                            </div>
                            <button class="btn btn-sm btn-secondary" onclick="viewNodeGuests('${node.node}', 'qemu')">
                                View VMs
                            </button>
                        </div>
                        <div class="guest-summary-item containers">
                            <span class="guest-summary-icon">📦</span>
                            <div class="guest-summary-info">
                                <span class="guest-summary-count">${node.ct_count || 0}</span>
                                <span class="guest-summary-label">Containers</span>
                            </div>
                            <button class="btn btn-sm btn-secondary" onclick="viewNodeGuests('${node.node}', 'lxc')">
                                View CTs
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Actions -->
                <div class="detail-section">
                    <h4>Node Actions</h4>
                    <div class="node-action-buttons">
                        <button class="btn ${node.maintenance ? 'btn-success' : 'btn-warning'}" 
                                onclick="event.stopPropagation(); toggleMaintenance('${node.node}', ${!node.maintenance})">
                            ${node.maintenance ? '✓ Exit Maintenance Mode' : '🔧 Enter Maintenance Mode'}
                        </button>
                        <button class="btn btn-secondary" onclick="event.stopPropagation(); viewNodeGuests('${node.node}', 'all')">
                            👁️ View All Guests
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function toggleNodeExpand(nodeName) {
    expandedNodes[nodeName] = !expandedNodes[nodeName];
    
    // Re-render just that node card
    const card = document.querySelector(`.node-card-large[data-node="${nodeName}"]`);
    if (card) {
        const node = allNodesData.find(n => n.node === nodeName);
        if (node) {
            card.outerHTML = renderNodeCard(node, expandedNodes[nodeName]);
        }
    }
}

function viewNodeGuests(nodeName, type) {
    // Navigate to guests page with node filter
    navigateTo('guests');
    
    // Set node filter
    setTimeout(() => {
        const nodeFilter = document.getElementById('guest-node-filter');
        if (nodeFilter) {
            nodeFilter.value = nodeName;
        }
        
        // Set type filter if specified
        if (type !== 'all') {
            setTypeFilter(type);
        } else {
            setTypeFilter('all');
        }
        
        filterGuests();
    }, 100);
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
        return `${days}d ${hours}h ${mins}m`;
    } else if (hours > 0) {
        return `${hours}h ${mins}m`;
    } else {
        return `${mins}m`;
    }
}

function refreshNodes() {
    loadNodes();
    showToast('Nodes refreshed', 'info');
}

async function toggleMaintenance(nodeName, enable) {
    const action = enable ? 'add' : 'remove';
    const title = enable ? 'Enter Maintenance Mode' : 'Exit Maintenance Mode';
    
    showResultsModal(title, 'loading', `${enable ? 'Entering' : 'Exiting'} maintenance mode for ${nodeName}...`);
    
    try {
        const result = await apiPost('/maintenance', { node: nodeName, action });
        
        if (result.success) {
            const content = `
                <div class="log-line">Node: <strong>${nodeName}</strong></div>
                <div class="log-line">Action: ${enable ? 'Added to' : 'Removed from'} maintenance mode</div>
                <div class="log-line">Current maintenance nodes: ${(result.maintenance_nodes || []).join(', ') || 'None'}</div>
                ${enable ? '<div class="log-line warning">⚠️ VMs on this node will be migrated during next rebalance</div>' : ''}
            `;
            updateResultsModal('success', `Node ${nodeName} ${enable ? 'entered' : 'exited'} maintenance mode`, content);
            loadNodes();
            loadDashboard();
        } else {
            updateResultsModal('error', 'Failed to update maintenance mode', `<pre>${result.error || 'Unknown error'}</pre>`);
        }
    } catch (error) {
        updateResultsModal('error', 'Failed to update maintenance mode', `<pre>${error.message || 'Request failed'}</pre>`);
    }
}

// ============== Guests Page ==============

let allGuests = [];
let guestFilters = {
    search: '',
    status: 'all',
    type: 'all',
    node: 'all'
};

async function loadGuests() {
    try {
        const data = await apiGet('/guests');
        allGuests = data.guests || [];
        
        // Populate node filter dropdown
        populateNodeFilter();
        
        // Apply current filters and render
        filterGuests();
    } catch (error) {
        showToast('Failed to load guests', 'error');
    }
}

function refreshGuests() {
    loadGuests();
    showToast('Guests refreshed', 'info');
}

function populateNodeFilter() {
    const nodeSelect = document.getElementById('guest-node-filter');
    if (!nodeSelect) return;
    
    // Get unique nodes
    const nodes = [...new Set(allGuests.map(g => g.node))].sort();
    
    // Build options
    nodeSelect.innerHTML = '<option value="all">All Nodes</option>' + 
        nodes.map(node => `<option value="${node}">${node}</option>`).join('');
    
    // Restore previous selection if still valid
    if (guestFilters.node !== 'all' && nodes.includes(guestFilters.node)) {
        nodeSelect.value = guestFilters.node;
    }
}

function setStatusFilter(value) {
    guestFilters.status = value;
    
    // Update toggle button states
    document.querySelectorAll('.filter-toggle[data-filter="status"]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === value);
    });
    
    filterGuests();
}

function setTypeFilter(value) {
    guestFilters.type = value;
    
    // Update toggle button states
    document.querySelectorAll('.filter-toggle[data-filter="type"]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === value);
    });
    
    filterGuests();
}

function filterGuests() {
    // Get current filter values
    const search = document.getElementById('guest-search')?.value.toLowerCase() || '';
    const nodeFilter = document.getElementById('guest-node-filter')?.value || 'all';
    
    guestFilters.search = search;
    guestFilters.node = nodeFilter;
    
    const filtered = allGuests.filter(guest => {
        // Search filter (name or ID)
        const matchesSearch = !search || 
            guest.name?.toLowerCase().includes(search) ||
            guest.vmid.toString().includes(search);
        
        // Status filter
        const matchesStatus = guestFilters.status === 'all' || guest.status === guestFilters.status;
        
        // Type filter
        const matchesType = guestFilters.type === 'all' || guest.type === guestFilters.type;
        
        // Node filter
        const matchesNode = guestFilters.node === 'all' || guest.node === guestFilters.node;
        
        return matchesSearch && matchesStatus && matchesType && matchesNode;
    });
    
    // Update summary
    const filteredCount = document.getElementById('filtered-count');
    const totalCount = document.getElementById('total-count');
    if (filteredCount) filteredCount.textContent = filtered.length;
    if (totalCount) totalCount.textContent = allGuests.length;
    
    renderGuests(filtered);
}

function renderGuests(guests) {
    const tbody = document.getElementById('guests-tbody');
    if (!tbody) return;
    
    if (guests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-table">
                    <div class="empty-state">No guests match the current filters</div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = guests.map(guest => {
        const tags = parseTags(guest.tags);
        return `
            <tr class="${guest.status}">
                <td><span class="guest-id">${guest.vmid}</span></td>
                <td><span class="guest-name">${guest.name || '-'}</span></td>
                <td>${guest.type === 'qemu' ? '💻 VM' : '📦 CT'}</td>
                <td><span class="node-badge">${guest.node}</span></td>
                <td>
                    <span class="status-badge ${guest.status}">
                        ${guest.status === 'running' ? '● Online' : '○ Offline'}
                    </span>
                </td>
                <td>${guest.cpu.toFixed(1)}%</td>
                <td>${guest.mem_percent.toFixed(1)}%</td>
                <td>
                    <div class="tag-list">
                        ${tags.map(tag => `<span class="tag ${tag.type}">${tag.name}</span>`).join('')}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function parseTags(tagsStr) {
    if (!tagsStr) return [];
    
    return tagsStr.split(';').map(tag => {
        tag = tag.trim();
        let type = '';
        let name = tag;
        
        if (tag.startsWith('plb_affinity_')) {
            type = 'affinity';
            name = tag.replace('plb_affinity_', 'affinity: ');
        } else if (tag.startsWith('plb_anti_affinity_')) {
            type = 'anti-affinity';
            name = tag.replace('plb_anti_affinity_', 'anti: ');
        } else if (tag.startsWith('plb_ignore_')) {
            type = 'ignore';
            name = tag.replace('plb_ignore_', 'ignore: ');
        } else if (tag.startsWith('plb_pin_')) {
            type = 'pin';
            name = tag.replace('plb_pin_', 'pin: ');
        }
        
        return { type, name };
    }).filter(t => t.name);
}

// ============== Balancing Page ==============

async function loadBalancingSettings() {
    try {
        const data = await apiGet('/config');
        const balancing = data.config?.balancing || {};
        
        // Update form fields
        document.getElementById('balancing-enabled').checked = balancing.enable !== false;
        document.getElementById('balance-method-select').value = balancing.method || 'memory';
        document.getElementById('balance-mode-select').value = balancing.mode || 'used';
        
        const balanciness = balancing.balanciness || 5;
        document.getElementById('balanciness-input').value = balanciness;
        document.getElementById('balanciness-value').textContent = `${balanciness}%`;
        
        const memThreshold = balancing.memory_threshold || 75;
        document.getElementById('memory-threshold-input').value = memThreshold;
        document.getElementById('memory-threshold-value').textContent = `${memThreshold}%`;
        
        // Load service status
        await loadServiceStatus();
        
    } catch (error) {
        showToast('Failed to load balancing settings', 'error');
    }
}

async function saveBalancingSettings() {
    try {
        const settings = {
            enable: document.getElementById('balancing-enabled').checked,
            method: document.getElementById('balance-method-select').value,
            mode: document.getElementById('balance-mode-select').value,
            balanciness: parseInt(document.getElementById('balanciness-input').value),
            memory_threshold: parseInt(document.getElementById('memory-threshold-input').value)
        };
        
        await apiPost('/balancing/settings', settings);
        showToast('Balancing settings saved', 'success');
        
    } catch (error) {
        showToast('Failed to save settings', 'error');
    }
}

async function triggerRebalance() {
    showResultsModal('Trigger Rebalance', 'loading', 'Running rebalance operation...');
    
    try {
        const response = await apiPost('/balancing/trigger');
        const result = response.result || response;
        
        if (result.success) {
            const output = result.output || [];
            const migrations = result.migrations || [];
            
            let content = '';
            if (migrations.length > 0) {
                content += '<div class="results-section"><strong>Migrations:</strong></div>';
                migrations.forEach(line => {
                    content += `<div class="log-line migration">🔄 ${escapeHtml(line)}</div>`;
                });
            }
            if (output.length > 0) {
                content += '<div class="results-section"><strong>Output:</strong></div>';
                output.forEach(line => {
                    const lineClass = line.toLowerCase().includes('error') ? 'error' : 
                                      line.toLowerCase().includes('warning') ? 'warning' : '';
                    content += `<div class="log-line ${lineClass}">${escapeHtml(line)}</div>`;
                });
            }
            if (!content) {
                content = '<div class="log-line">Rebalance completed with no migrations needed.</div>';
            }
            
            updateResultsModal('success', result.message || 'Rebalance completed successfully', content);
        } else {
            updateResultsModal('error', 'Rebalance failed', `<pre>${escapeHtml(result.error || 'Unknown error')}</pre>`);
        }
        loadDashboard();
    } catch (error) {
        updateResultsModal('error', 'Rebalance failed', `<pre>${escapeHtml(error.message || 'Request failed')}</pre>`);
    }
}

async function triggerDryRun() {
    showResultsModal('Dry Run Simulation', 'loading', 'Running simulation (no actual migrations)...');
    
    try {
        const response = await apiPost('/balancing/trigger?dry_run=true');
        const result = response.result || response;
        
        if (result.success) {
            const output = result.output || [];
            
            // Parse the output to find guests and their migration plans
            let guests = {};
            let nodes = {};
            let plannedMigrations = [];
            
            // Try to parse JSON from output (ProxLB returns JSON with -j flag)
            const fullOutput = output.join('\n');
            const jsonMatch = fullOutput.match(/\{[\s\S]*"guests"[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    const data = JSON.parse(jsonMatch[0]);
                    guests = data.guests || {};
                    nodes = data.nodes || {};
                    
                    // Find VMs that would be migrated (node_current != node_target)
                    for (const [name, guest] of Object.entries(guests)) {
                        if (guest.node_current && guest.node_target && guest.node_current !== guest.node_target) {
                            plannedMigrations.push({
                                name: name,
                                type: guest.type === 'ct' ? 'Container' : 'VM',
                                from: guest.node_current,
                                to: guest.node_target,
                                memory: guest.memory_used ? formatBytes(guest.memory_used) : 'N/A',
                                cpu: guest.cpu_used ? (guest.cpu_used * 100).toFixed(1) + '%' : 'N/A'
                            });
                        }
                    }
                } catch (e) {
                    console.log('Could not parse JSON from output:', e);
                }
            }
            
            let content = '';
            
            // Summary section
            content += '<div class="dry-run-summary">';
            content += '<div class="summary-header">📊 Dry Run Analysis</div>';
            content += '<div class="summary-stats">';
            content += `<div class="stat-item"><span class="stat-value">${Object.keys(guests).length}</span><span class="stat-label">VMs Analyzed</span></div>`;
            content += `<div class="stat-item"><span class="stat-value">${plannedMigrations.length}</span><span class="stat-label">Migrations Needed</span></div>`;
            content += `<div class="stat-item"><span class="stat-value">${Object.keys(nodes).length || 3}</span><span class="stat-label">Nodes</span></div>`;
            content += '</div></div>';
            
            // Migration details
            if (plannedMigrations.length > 0) {
                content += '<div class="results-section"><strong>🔄 Planned Migrations:</strong></div>';
                content += '<div class="migration-table">';
                content += '<div class="migration-header"><span>Guest</span><span>Type</span><span>From</span><span>To</span></div>';
                plannedMigrations.forEach(m => {
                    content += `<div class="migration-row">
                        <span class="guest-name">${escapeHtml(m.name)}</span>
                        <span class="guest-type">${m.type}</span>
                        <span class="node-from">${escapeHtml(m.from)}</span>
                        <span class="node-to">${escapeHtml(m.to)}</span>
                    </div>`;
                });
                content += '</div>';
                content += `<div class="migration-note">💡 These migrations would optimize cluster balance based on memory usage.</div>`;
            } else {
                content += '<div class="balanced-message">';
                content += '<div class="balanced-icon">✅</div>';
                content += '<div class="balanced-text">Cluster is Balanced</div>';
                content += '<div class="balanced-subtext">No migrations needed. All nodes have similar resource usage.</div>';
                content += '</div>';
            }
            
            // Collapsible raw output
            content += '<details class="raw-output-details">';
            content += '<summary>📋 Show Raw Output</summary>';
            content += '<div class="raw-output">';
            output.slice(0, 20).forEach(line => {
                content += `<div class="log-line">${escapeHtml(line)}</div>`;
            });
            if (output.length > 20) {
                content += `<div class="log-line muted">... and ${output.length - 20} more lines</div>`;
            }
            content += '</div></details>';
            
            updateResultsModal('success', 'Dry run completed', content);
        } else {
            updateResultsModal('error', 'Dry run failed', `<pre>${escapeHtml(result.error || 'Unknown error')}</pre>`);
        }
    } catch (error) {
        updateResultsModal('error', 'Dry run failed', `<pre>${escapeHtml(error.message || 'Request failed')}</pre>`);
    }
}

async function getBestNode() {
    showResultsModal('Best Node for New VM', 'loading', 'Calculating optimal node...');
    
    try {
        const result = await apiGet('/balancing/best-node');
        
        if (result.success) {
            const content = `
                <div class="best-node">${escapeHtml(result.best_node)}</div>
                ${result.output ? `<div class="results-section" style="margin-top: 1rem;"><strong>Details:</strong></div><pre>${escapeHtml(result.output)}</pre>` : ''}
            `;
            updateResultsModal('success', 'Best node calculated', content);
        } else {
            updateResultsModal('error', 'Failed to get best node', `<pre>${escapeHtml(result.error || 'Unknown error')}</pre>`);
        }
    } catch (error) {
        updateResultsModal('error', 'Failed to get best node', `<pre>${escapeHtml(error.message || 'Request failed')}</pre>`);
    }
}

// Results Modal Functions
function showResultsModal(title, status, content) {
    const modal = document.getElementById('results-modal');
    const titleEl = document.getElementById('results-modal-title');
    const statusEl = document.getElementById('results-modal-status');
    const contentEl = document.getElementById('results-modal-content');
    
    if (!modal) return;
    
    titleEl.textContent = title;
    statusEl.className = `results-status ${status}`;
    
    if (status === 'loading') {
        statusEl.innerHTML = `<span class="spinner"></span> ${content}`;
        contentEl.innerHTML = '';
    } else {
        statusEl.textContent = content;
        contentEl.innerHTML = '';
    }
    
    modal.style.display = 'flex';
}

function updateResultsModal(status, message, content) {
    const statusEl = document.getElementById('results-modal-status');
    const contentEl = document.getElementById('results-modal-content');
    
    if (!statusEl || !contentEl) return;
    
    statusEl.className = `results-status ${status}`;
    const icon = status === 'success' ? '✓' : status === 'error' ? '✗' : 'ℹ';
    statusEl.innerHTML = `<span>${icon}</span> ${message}`;
    contentEl.innerHTML = content;
}

function closeResultsModal() {
    const modal = document.getElementById('results-modal');
    if (modal) modal.style.display = 'none';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============== Service Control ==============

async function startService() {
    showResultsModal('Start ProxLB Service', 'loading', 'Starting ProxLB service...');
    
    try {
        const result = await apiPost('/service/start');
        
        if (result.success) {
            updateResultsModal('success', result.message || 'Service started successfully', 
                '<div class="log-line">ProxLB daemon is now running and will automatically balance your cluster.</div>');
            updateServiceStatusDisplay(true);
            loadDashboard();
        } else {
            updateResultsModal('error', 'Failed to start service', `<pre>${result.error || 'Unknown error'}</pre>`);
        }
    } catch (error) {
        updateResultsModal('error', 'Failed to start service', `<pre>${error.message || 'Request failed'}</pre>`);
    }
}

async function stopService() {
    showResultsModal('Stop ProxLB Service', 'loading', 'Stopping ProxLB service...');
    
    try {
        const result = await apiPost('/service/stop');
        
        if (result.success) {
            updateResultsModal('success', result.message || 'Service stopped successfully', 
                '<div class="log-line">ProxLB daemon has been stopped. Automatic balancing is paused.</div>');
            updateServiceStatusDisplay(false);
        } else {
            updateResultsModal('error', 'Failed to stop service', `<pre>${result.error || 'Unknown error'}</pre>`);
        }
    } catch (error) {
        updateResultsModal('error', 'Failed to stop service', `<pre>${error.message || 'Request failed'}</pre>`);
    }
}

async function restartService() {
    showResultsModal('Restart ProxLB Service', 'loading', 'Restarting ProxLB service...');
    
    try {
        const result = await apiPost('/service/restart');
        
        if (result.success) {
            updateResultsModal('success', result.message || 'Service restarted successfully', 
                '<div class="log-line">ProxLB daemon has been restarted and is now running.</div>');
            updateServiceStatusDisplay(true);
            loadDashboard();
        } else {
            updateResultsModal('error', 'Failed to restart service', `<pre>${result.error || 'Unknown error'}</pre>`);
        }
    } catch (error) {
        updateResultsModal('error', 'Failed to restart service', `<pre>${error.message || 'Request failed'}</pre>`);
    }
}

// ============== Rules Page ==============

async function loadRules() {
    try {
        const data = await apiGet('/rules');
        
        // Affinity groups
        renderRuleGroups('affinity-list', 'affinity-count', data.affinity || {});
        
        // Anti-affinity groups
        renderRuleGroups('anti-affinity-list', 'anti-affinity-count', data.anti_affinity || {});
        
        // Pinned VMs
        renderPinnedVMs('pinned-list', 'pinned-count', data.pinned || {});
        
        // Ignored VMs
        renderIgnoredVMs('ignored-list', 'ignored-count', data.ignored || []);
        
    } catch (error) {
        showToast('Failed to load rules', 'error');
    }
}

function renderRuleGroups(listId, countId, groups) {
    const list = document.getElementById(listId);
    const count = document.getElementById(countId);
    
    if (!list) return;
    
    const groupNames = Object.keys(groups);
    count.textContent = groupNames.length;
    
    if (groupNames.length === 0) {
        list.innerHTML = '<p class="empty-state">No groups defined</p>';
        return;
    }
    
    list.innerHTML = groupNames.map(name => `
        <div class="rule-group">
            <div class="rule-group-name">🏷️ ${name}</div>
            <div class="rule-items">
                ${groups[name].map(vm => `
                    <div class="rule-item">${vm.name} (${vm.vmid}) on ${vm.node}</div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function renderPinnedVMs(listId, countId, pinned) {
    const list = document.getElementById(listId);
    const count = document.getElementById(countId);
    
    if (!list) return;
    
    const nodes = Object.keys(pinned);
    const totalCount = nodes.reduce((sum, n) => sum + pinned[n].length, 0);
    count.textContent = totalCount;
    
    if (nodes.length === 0) {
        list.innerHTML = '<p class="empty-state">No pinned VMs</p>';
        return;
    }
    
    list.innerHTML = nodes.map(node => `
        <div class="rule-group">
            <div class="rule-group-name">📌 Pinned to ${node}</div>
            <div class="rule-items">
                ${pinned[node].map(vm => `
                    <div class="rule-item">${vm.name} (${vm.vmid}) - currently on ${vm.current_node}</div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function renderIgnoredVMs(listId, countId, ignored) {
    const list = document.getElementById(listId);
    const count = document.getElementById(countId);
    
    if (!list) return;
    
    count.textContent = ignored.length;
    
    if (ignored.length === 0) {
        list.innerHTML = '<p class="empty-state">No ignored VMs</p>';
        return;
    }
    
    list.innerHTML = ignored.map(vm => `
        <div class="rule-item">🚫 ${vm.name} (${vm.vmid}) on ${vm.node}</div>
    `).join('');
}

// ============== Logs Page ==============

let currentLogTab = 'proxlb';
let logsData = { logs: [], summary: {} };
let tasksData = [];
let migrationsData = [];

async function loadLogs() {
    try {
        const level = document.getElementById('log-level-filter')?.value || '';
        const lines = document.getElementById('log-lines-filter')?.value || '100';
        
        let url = `/logs?lines=${lines}`;
        if (level) url += `&level=${level}`;
        
        const data = await apiGet(url);
        logsData = data;
        
        // Update summary
        updateLogSummary(data.summary);
        
        // Render logs
        renderLogs(data.logs || []);
        
    } catch (error) {
        document.getElementById('log-viewer').innerHTML = '<div class="log-line error">Failed to load logs</div>';
    }
}

async function loadTasks() {
    try {
        const status = document.getElementById('task-status-filter')?.value || '';
        let url = '/tasks?limit=100';
        if (status) url += `&status=${status}`;
        
        const data = await apiGet(url);
        tasksData = data.tasks || [];
        renderTasks(tasksData);
        
    } catch (error) {
        document.getElementById('tasks-tbody').innerHTML = '<tr><td colspan="6" class="empty-table">Failed to load tasks</td></tr>';
    }
}

async function loadMigrations() {
    try {
        const data = await apiGet('/migrations?limit=50');
        migrationsData = data.migrations || [];
        renderMigrations(migrationsData);
        
        // Also load tasks that are migrations
        const tasksData = await apiGet('/tasks?limit=100');
        const migrationTasks = (tasksData.tasks || []).filter(t => t.is_migration);
        
        // Combine and dedupe
        const allMigrations = [...migrationsData];
        for (const task of migrationTasks) {
            allMigrations.push({
                timestamp: formatTimestamp(task.starttime),
                guest_name: task.description,
                from_node: task.node,
                to_node: '',
                status: task.success ? 'completed' : 'failed',
                type: task.type
            });
        }
        
        renderMigrations(allMigrations);
        
    } catch (error) {
        document.getElementById('migrations-tbody').innerHTML = '<tr><td colspan="5" class="empty-table">Failed to load migrations</td></tr>';
    }
}

function updateLogSummary(summary) {
    const container = document.getElementById('log-summary');
    if (!container || !summary) return;
    
    const byLevel = summary.by_level || {};
    
    container.innerHTML = `
        <div class="log-stat">
            <span class="log-stat-value">${summary.total || 0}</span>
            <span class="log-stat-label">Total Entries</span>
        </div>
        <div class="log-stat">
            <span class="log-stat-value info">${byLevel.INFO || 0}</span>
            <span class="log-stat-label">Info</span>
        </div>
        <div class="log-stat">
            <span class="log-stat-value warning">${byLevel.WARNING || 0}</span>
            <span class="log-stat-label">Warnings</span>
        </div>
        <div class="log-stat">
            <span class="log-stat-value error">${byLevel.ERROR || 0}</span>
            <span class="log-stat-label">Errors</span>
        </div>
        <div class="log-stat">
            <span class="log-stat-value success">${summary.migrations?.total || 0}</span>
            <span class="log-stat-label">Migrations</span>
        </div>
    `;
}

function renderLogs(logs) {
    const viewer = document.getElementById('log-viewer');
    if (!viewer) return;
    
    if (!logs || logs.length === 0) {
        viewer.innerHTML = '<div class="log-line">No logs available</div>';
        return;
    }
    
    viewer.innerHTML = logs.map(log => {
        const level = (log.level || 'INFO').toLowerCase();
        const timestamp = log.timestamp || '';
        const message = log.message || '';
        const eventType = log.event_type || '';
        
        // Add icon based on event type
        let icon = '';
        if (log.is_migration) icon = '🔄 ';
        else if (eventType === 'error') icon = '❌ ';
        else if (eventType === 'warning') icon = '⚠️ ';
        else if (eventType === 'rebalance_start' || eventType === 'rebalance_complete') icon = '⚖️ ';
        
        return `<div class="log-line ${level}" data-event="${eventType}">
            <span class="log-timestamp">${timestamp}</span>
            <span class="log-level ${level}">[${log.level || 'INFO'}]</span>
            <span class="log-message">${icon}${message}</span>
        </div>`;
    }).join('');
    
    // Auto-scroll if enabled
    if (document.getElementById('auto-scroll')?.checked) {
        viewer.scrollTop = viewer.scrollHeight;
    }
}

function renderTasks(tasks) {
    const tbody = document.getElementById('tasks-tbody');
    if (!tbody) return;
    
    if (!tasks || tasks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-table">No tasks found</td></tr>';
        return;
    }
    
    tbody.innerHTML = tasks.map(task => {
        const startTime = formatTimestamp(task.starttime);
        const endTime = task.endtime ? formatTimestamp(task.endtime) : '-';
        const duration = task.endtime && task.starttime 
            ? formatDuration(task.endtime - task.starttime) 
            : (task.status === 'running' ? 'Running...' : '-');
        
        const statusClass = task.success ? 'success' : (task.status === 'running' ? 'running' : 'error');
        const statusIcon = task.success ? '✓' : (task.status === 'running' ? '⏳' : '✗');
        
        return `
            <tr class="${statusClass}">
                <td><span class="task-time">${startTime}</span></td>
                <td><span class="task-type ${task.is_migration ? 'migration' : ''}">${task.type}</span></td>
                <td>${task.description}</td>
                <td><span class="node-badge">${task.node}</span></td>
                <td><span class="status-badge ${statusClass}">${statusIcon} ${task.status || 'OK'}</span></td>
                <td>${duration}</td>
            </tr>
        `;
    }).join('');
}

function renderMigrations(migrations) {
    const tbody = document.getElementById('migrations-tbody');
    if (!tbody) return;
    
    if (!migrations || migrations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-table">No migrations found</td></tr>';
        return;
    }
    
    tbody.innerHTML = migrations.map(mig => {
        const statusClass = mig.status === 'completed' || mig.status === 'started' ? 'success' : 'error';
        const statusIcon = mig.status === 'completed' ? '✓' : (mig.status === 'started' ? '⏳' : '✗');
        
        return `
            <tr>
                <td><span class="task-time">${mig.timestamp || ''}</span></td>
                <td><span class="guest-name">${mig.guest_name || mig.guest || 'Unknown'}</span></td>
                <td><span class="node-badge">${mig.from_node || '-'}</span></td>
                <td><span class="node-badge">${mig.to_node || '-'}</span></td>
                <td><span class="status-badge ${statusClass}">${statusIcon} ${mig.status || 'started'}</span></td>
            </tr>
        `;
    }).join('');
}

function switchLogTab(tab) {
    currentLogTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.log-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    // Update tab content
    document.querySelectorAll('.log-tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tab}`);
    });
    
    // Show/hide task status filter
    const taskStatusGroup = document.getElementById('task-status-group');
    if (taskStatusGroup) {
        taskStatusGroup.style.display = tab === 'tasks' ? 'flex' : 'none';
    }
    
    // Load appropriate data
    switch (tab) {
        case 'proxlb':
            loadLogs();
            break;
        case 'tasks':
            loadTasks();
            break;
        case 'migrations':
            loadMigrations();
            break;
    }
}

function filterLogs() {
    loadLogs();
}

function filterTasks() {
    loadTasks();
}

function formatTimestamp(unixTime) {
    if (!unixTime) return '';
    const date = new Date(unixTime * 1000);
    return date.toLocaleString();
}

function formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function refreshLogs() {
    switch (currentLogTab) {
        case 'proxlb':
            loadLogs();
            break;
        case 'tasks':
            loadTasks();
            break;
        case 'migrations':
            loadMigrations();
            break;
    }
    showToast('Logs refreshed', 'info');
}

// ============== Config Page ==============

let currentConfig = null;

async function loadConfig() {
    try {
        const data = await apiGet('/config');
        currentConfig = data.config;
        
        if (!currentConfig) {
            showToast('No configuration found', 'error');
            return;
        }
        
        // Populate API settings
        const api = currentConfig.proxmox_api || {};
        document.getElementById('cfg-hosts').value = (api.hosts || []).join(', ');
        document.getElementById('cfg-user').value = api.user || '';
        document.getElementById('cfg-pass').value = '';  // Don't show password
        document.getElementById('cfg-timeout').value = api.timeout || 10;
        document.getElementById('cfg-ssl').checked = api.ssl_verification !== false;
        
        // Populate Cluster settings
        const cluster = currentConfig.proxmox_cluster || {};
        document.getElementById('cfg-maintenance-nodes').value = (cluster.maintenance_nodes || []).join(', ');
        document.getElementById('cfg-ignore-nodes').value = (cluster.ignore_nodes || []).join(', ');
        document.getElementById('cfg-overprovisioning').checked = cluster.overprovisioning !== false;
        
        // Populate Balancing settings
        const balancing = currentConfig.balancing || {};
        document.getElementById('cfg-balance-enable').checked = balancing.enable !== false;
        document.getElementById('cfg-live').checked = balancing.live !== false;
        document.getElementById('cfg-method').value = balancing.method || 'memory';
        document.getElementById('cfg-mode').value = balancing.mode || 'used';
        
        const balanciness = balancing.balanciness || 5;
        document.getElementById('cfg-balanciness').value = balanciness;
        document.getElementById('cfg-balanciness-value').textContent = `${balanciness}%`;
        
        const memThreshold = balancing.memory_threshold || 75;
        document.getElementById('cfg-memory-threshold').value = memThreshold;
        document.getElementById('cfg-memory-threshold-value').textContent = `${memThreshold}%`;
        
        // Balance types
        const balanceTypes = balancing.balance_types || ['vm', 'ct'];
        document.getElementById('cfg-balance-vm').checked = balanceTypes.includes('vm');
        document.getElementById('cfg-balance-ct').checked = balanceTypes.includes('ct');
        
        document.getElementById('cfg-enforce-affinity').checked = balancing.enforce_affinity === true;
        document.getElementById('cfg-local-disks').checked = balancing.with_local_disks !== false;
        document.getElementById('cfg-conntrack').checked = balancing.with_conntrack_state !== false;
        document.getElementById('cfg-larger-first').checked = balancing.balance_larger_guests_first === true;
        document.getElementById('cfg-parallel').checked = balancing.parallel === true;
        document.getElementById('cfg-parallel-jobs').value = balancing.parallel_jobs || 1;
        document.getElementById('cfg-max-validation').value = balancing.max_job_validation || 1800;
        
        // Populate Service settings
        const service = currentConfig.service || {};
        document.getElementById('cfg-daemon').checked = service.daemon !== false;
        
        const schedule = service.schedule || {};
        document.getElementById('cfg-schedule-interval').value = schedule.interval || 1;
        document.getElementById('cfg-schedule-format').value = schedule.format || 'hours';
        
        const delay = service.delay || {};
        document.getElementById('cfg-delay-enable').checked = delay.enable === true;
        document.getElementById('cfg-delay-time').value = delay.time || 1;
        document.getElementById('cfg-delay-format').value = delay.format || 'hours';
        
        // Show/hide delay settings
        toggleDelaySettings();
        
        document.getElementById('cfg-log-level').value = service.log_level || 'INFO';
        
        // Initialize range input listeners
        initConfigFormListeners();
        
    } catch (error) {
        showToast('Failed to load configuration', 'error');
        console.error('Config load error:', error);
    }
}

function initConfigFormListeners() {
    // Balanciness slider
    const balancinessSlider = document.getElementById('cfg-balanciness');
    if (balancinessSlider) {
        balancinessSlider.addEventListener('input', (e) => {
            document.getElementById('cfg-balanciness-value').textContent = `${e.target.value}%`;
        });
    }
    
    // Memory threshold slider
    const memThresholdSlider = document.getElementById('cfg-memory-threshold');
    if (memThresholdSlider) {
        memThresholdSlider.addEventListener('input', (e) => {
            document.getElementById('cfg-memory-threshold-value').textContent = `${e.target.value}%`;
        });
    }
    
    // Delay toggle
    const delayEnable = document.getElementById('cfg-delay-enable');
    if (delayEnable) {
        delayEnable.addEventListener('change', toggleDelaySettings);
    }
}

function toggleDelaySettings() {
    const delayEnabled = document.getElementById('cfg-delay-enable').checked;
    const delaySettings = document.getElementById('delay-settings');
    if (delaySettings) {
        delaySettings.style.display = delayEnabled ? 'grid' : 'none';
    }
}

function buildConfigFromForm() {
    // Parse hosts
    const hostsStr = document.getElementById('cfg-hosts').value;
    const hosts = hostsStr.split(',').map(h => h.trim()).filter(h => h);
    
    // Parse maintenance nodes
    const maintNodesStr = document.getElementById('cfg-maintenance-nodes').value;
    const maintenanceNodes = maintNodesStr.split(',').map(n => n.trim()).filter(n => n);
    
    // Parse ignore nodes
    const ignoreNodesStr = document.getElementById('cfg-ignore-nodes').value;
    const ignoreNodes = ignoreNodesStr.split(',').map(n => n.trim()).filter(n => n);
    
    // Build balance types array
    const balanceTypes = [];
    if (document.getElementById('cfg-balance-vm').checked) balanceTypes.push('vm');
    if (document.getElementById('cfg-balance-ct').checked) balanceTypes.push('ct');
    
    const config = {
        proxmox_api: {
            hosts: hosts,
            user: document.getElementById('cfg-user').value,
            pass: document.getElementById('cfg-pass').value || (currentConfig?.proxmox_api?.pass || ''),
            ssl_verification: document.getElementById('cfg-ssl').checked,
            timeout: parseInt(document.getElementById('cfg-timeout').value) || 10
        },
        proxmox_cluster: {
            maintenance_nodes: maintenanceNodes,
            ignore_nodes: ignoreNodes,
            overprovisioning: document.getElementById('cfg-overprovisioning').checked
        },
        balancing: {
            enable: document.getElementById('cfg-balance-enable').checked,
            enforce_affinity: document.getElementById('cfg-enforce-affinity').checked,
            parallel: document.getElementById('cfg-parallel').checked,
            parallel_jobs: parseInt(document.getElementById('cfg-parallel-jobs').value) || 1,
            live: document.getElementById('cfg-live').checked,
            with_local_disks: document.getElementById('cfg-local-disks').checked,
            with_conntrack_state: document.getElementById('cfg-conntrack').checked,
            balance_types: balanceTypes,
            max_job_validation: parseInt(document.getElementById('cfg-max-validation').value) || 1800,
            memory_threshold: parseInt(document.getElementById('cfg-memory-threshold').value) || 75,
            balanciness: parseInt(document.getElementById('cfg-balanciness').value) || 5,
            method: document.getElementById('cfg-method').value,
            mode: document.getElementById('cfg-mode').value,
            balance_larger_guests_first: document.getElementById('cfg-larger-first').checked
        },
        service: {
            daemon: document.getElementById('cfg-daemon').checked,
            schedule: {
                interval: parseInt(document.getElementById('cfg-schedule-interval').value) || 1,
                format: document.getElementById('cfg-schedule-format').value
            },
            delay: {
                enable: document.getElementById('cfg-delay-enable').checked,
                time: parseInt(document.getElementById('cfg-delay-time').value) || 1,
                format: document.getElementById('cfg-delay-format').value
            },
            log_level: document.getElementById('cfg-log-level').value
        }
    };
    
    // If password field is empty, keep existing password
    if (!document.getElementById('cfg-pass').value && currentConfig?.proxmox_api?.pass) {
        config.proxmox_api.pass = currentConfig.proxmox_api.pass;
    }
    
    return config;
}

async function saveConfig() {
    try {
        showToast('Saving configuration...', 'info');
        const config = buildConfigFromForm();
        
        await apiPost('/config', { config });
        await apiPost('/service/restart');
        
        showToast('Configuration saved and service restarted', 'success');
        currentConfig = config;  // Update cached config
    } catch (error) {
        showToast('Failed to save configuration: ' + error.message, 'error');
    }
}

// Simple YAML-like parser (basic implementation)
function jsyaml_dump(obj, indent = 0) {
    let result = '';
    const spaces = '  '.repeat(indent);
    
    for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined) {
            result += `${spaces}${key}: null\n`;
        } else if (typeof value === 'object' && !Array.isArray(value)) {
            result += `${spaces}${key}:\n${jsyaml_dump(value, indent + 1)}`;
        } else if (Array.isArray(value)) {
            result += `${spaces}${key}: [${value.map(v => typeof v === 'string' ? `'${v}'` : v).join(', ')}]\n`;
        } else if (typeof value === 'string') {
            result += `${spaces}${key}: ${value}\n`;
        } else {
            result += `${spaces}${key}: ${value}\n`;
        }
    }
    
    return result;
}

function jsyaml_parse(text) {
    // This is a simplified parser - in production, use a proper YAML library
    const lines = text.split('\n');
    const result = {};
    let currentSection = result;
    let sectionStack = [{ obj: result, indent: -1 }];
    
    for (const line of lines) {
        if (!line.trim() || line.trim().startsWith('#')) continue;
        
        const indent = line.search(/\S/);
        const match = line.match(/^(\s*)(\w+):\s*(.*)$/);
        
        if (!match) continue;
        
        const [, , key, value] = match;
        
        // Handle indentation
        while (sectionStack.length > 1 && indent <= sectionStack[sectionStack.length - 1].indent) {
            sectionStack.pop();
        }
        currentSection = sectionStack[sectionStack.length - 1].obj;
        
        if (value === '' || value === null) {
            // New section
            currentSection[key] = {};
            sectionStack.push({ obj: currentSection[key], indent });
        } else if (value.startsWith('[') && value.endsWith(']')) {
            // Array
            const arrayContent = value.slice(1, -1);
            currentSection[key] = arrayContent.split(',').map(v => {
                v = v.trim().replace(/^['"]|['"]$/g, '');
                if (v === 'true') return true;
                if (v === 'false') return false;
                if (!isNaN(v) && v !== '') return Number(v);
                return v;
            }).filter(v => v !== '');
        } else {
            // Value
            let parsedValue = value.trim();
            if (parsedValue === 'true') parsedValue = true;
            else if (parsedValue === 'false' || parsedValue === 'False') parsedValue = false;
            else if (parsedValue === 'True') parsedValue = true;
            else if (!isNaN(parsedValue) && parsedValue !== '') parsedValue = Number(parsedValue);
            currentSection[key] = parsedValue;
        }
    }
    
    return result;
}

// ============== Utilities ==============

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getBarClass(percent) {
    if (percent > 90) return 'danger';
    if (percent > 75) return 'warning';
    return '';
}

// ============== Toast Notifications ==============

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const icons = {
        success: '✓',
        error: '✗',
        warning: '⚠',
        info: 'ℹ'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// ============== Modal ==============

let modalCallback = null;

function showConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    
    modalCallback = onConfirm;
    
    document.getElementById('modal-confirm-btn').onclick = () => {
        closeModal();
        if (modalCallback) modalCallback();
    };
    
    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('confirm-modal').classList.remove('active');
    modalCallback = null;
}

// Close modal on outside click
document.getElementById('confirm-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'confirm-modal') {
        closeModal();
    }
});

// ============== Auto Refresh ==============

function startAutoRefresh() {
    // Refresh dashboard every 15 seconds
    refreshIntervals.dashboard = setInterval(() => {
        if (currentPage === 'dashboard') {
            loadDashboard();
        }
    }, 15000);
    
    // Refresh current page data every 20 seconds
    refreshIntervals.page = setInterval(() => {
        switch (currentPage) {
            case 'nodes':
                loadNodes();
                break;
            case 'guests':
                loadGuests();
                break;
        }
    }, 20000);
    
    // Refresh service status every 10 seconds
    refreshIntervals.status = setInterval(() => {
        loadServiceStatus();
    }, 10000);
}

function stopAutoRefresh() {
    Object.values(refreshIntervals).forEach(clearInterval);
    refreshIntervals = {};
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
    if (wsConnection) {
        wsConnection.close();
    }
});

