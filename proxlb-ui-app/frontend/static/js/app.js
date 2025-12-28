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
    
    const guestFilter = document.getElementById('guest-filter');
    if (guestFilter) {
        guestFilter.addEventListener('change', filterGuests);
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

async function loadClusterStatus() {
    try {
        const data = await apiGet('/cluster');
        
        // Update cluster name
        document.getElementById('cluster-name').textContent = data.cluster_name || 'Cluster';
        
        // Update counts
        document.getElementById('node-count').textContent = data.nodes?.total || 0;
        document.getElementById('vm-count').textContent = data.guests?.vms?.total || 0;
        document.getElementById('ct-count').textContent = data.guests?.containers?.total || 0;
        
        // Update gauges
        updateGauge('cpu', data.resources?.cpu?.percent || 0);
        updateGauge('mem', data.resources?.memory?.percent || 0);
        updateGauge('disk', data.resources?.disk?.percent || 0);
        
    } catch (error) {
        showToast('Failed to load cluster status', 'error');
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
        const data = await apiGet('/migrations?limit=10');
        const container = document.getElementById('migration-list');
        
        if (!container) return;
        
        if (!data.migrations || data.migrations.length === 0) {
            container.innerHTML = '<p class="empty-state">No recent migrations</p>';
            return;
        }
        
        container.innerHTML = data.migrations.map(m => `
            <div class="migration-item">
                <span class="migration-guest">${m.guest_name}</span>
                <span class="migration-path">
                    ${m.from_node}<span class="arrow">→</span>${m.to_node}
                </span>
                <span class="migration-time">${m.timestamp || ''}</span>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Failed to load migrations:', error);
    }
}

async function loadServiceStatus() {
    try {
        const data = await apiGet('/status');
        
        updateServiceStatusDisplay(data.proxlb?.running || false);
        
        // Update balance method/mode display
        const config = await apiGet('/config');
        if (config.config?.balancing) {
            document.getElementById('balance-method').textContent = config.config.balancing.method || 'memory';
            document.getElementById('balance-mode').textContent = config.config.balancing.mode || 'used';
        }
        
        // Update next run timer
        if (config.config?.service?.schedule) {
            const interval = config.config.service.schedule.interval || 1;
            const format = config.config.service.schedule.format || 'hours';
            document.getElementById('next-run-timer').textContent = `${interval} ${format}`;
        }
        
    } catch (error) {
        console.error('Failed to load service status:', error);
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

async function loadNodes() {
    try {
        const data = await apiGet('/nodes');
        const container = document.getElementById('nodes-container');
        
        if (!container) return;
        
        container.innerHTML = data.nodes.map(node => `
            <div class="node-card-large ${node.maintenance ? 'maintenance' : ''}" data-node="${node.node}">
                <div class="node-card-header">
                    <div class="node-card-title">
                        <span class="node-icon">🖥️</span>
                        <h3>${node.node}</h3>
                    </div>
                    <span class="node-status ${node.maintenance ? 'maintenance' : node.status}">
                        ${node.maintenance ? '🔧 Maintenance' : node.status === 'online' ? '✓ Online' : '✗ Offline'}
                    </span>
                </div>
                <div class="node-card-body">
                    <div class="resource-bars">
                        <div class="resource-bar">
                            <div class="resource-bar-header">
                                <span class="resource-bar-label">CPU</span>
                                <span class="resource-bar-value">${node.cpu.toFixed(1)}% (${node.maxcpu} cores)</span>
                            </div>
                            <div class="bar-container">
                                <div class="bar-fill cpu ${getBarClass(node.cpu)}" style="width: ${node.cpu}%"></div>
                            </div>
                        </div>
                        <div class="resource-bar">
                            <div class="resource-bar-header">
                                <span class="resource-bar-label">Memory</span>
                                <span class="resource-bar-value">${node.mem_percent.toFixed(1)}% (${formatBytes(node.mem)} / ${formatBytes(node.maxmem)})</span>
                            </div>
                            <div class="bar-container">
                                <div class="bar-fill mem ${getBarClass(node.mem_percent)}" style="width: ${node.mem_percent}%"></div>
                            </div>
                        </div>
                        <div class="resource-bar">
                            <div class="resource-bar-header">
                                <span class="resource-bar-label">Disk</span>
                                <span class="resource-bar-value">${node.disk_percent.toFixed(1)}% (${formatBytes(node.disk)} / ${formatBytes(node.maxdisk)})</span>
                            </div>
                            <div class="bar-container">
                                <div class="bar-fill disk ${getBarClass(node.disk_percent)}" style="width: ${node.disk_percent}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="node-card-footer">
                    <div class="guest-counts">
                        <span class="guest-count">💻 ${node.vm_count} VMs</span>
                        <span class="guest-count">📦 ${node.ct_count} CTs</span>
                    </div>
                    <div class="node-actions">
                        <button class="btn btn-sm ${node.maintenance ? 'btn-success' : 'btn-warning'}" 
                                onclick="toggleMaintenance('${node.node}', ${!node.maintenance})">
                            ${node.maintenance ? 'Exit Maintenance' : 'Enter Maintenance'}
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        showToast('Failed to load nodes', 'error');
    }
}

function refreshNodes() {
    loadNodes();
    showToast('Nodes refreshed', 'info');
}

async function toggleMaintenance(nodeName, enable) {
    const action = enable ? 'add' : 'remove';
    const message = enable 
        ? `Put "${nodeName}" in maintenance mode? All VMs will be migrated to other nodes.`
        : `Remove "${nodeName}" from maintenance mode?`;
    
    showConfirmModal(
        enable ? 'Enter Maintenance Mode' : 'Exit Maintenance Mode',
        message,
        async () => {
            try {
                await apiPost('/maintenance', { node: nodeName, action });
                showToast(`Node ${nodeName} ${enable ? 'entered' : 'exited'} maintenance mode`, 'success');
                loadNodes();
                loadDashboard();
            } catch (error) {
                showToast('Failed to update maintenance mode', 'error');
            }
        }
    );
}

// ============== Guests Page ==============

let allGuests = [];

async function loadGuests() {
    try {
        const data = await apiGet('/guests');
        allGuests = data.guests || [];
        renderGuests(allGuests);
    } catch (error) {
        showToast('Failed to load guests', 'error');
    }
}

function renderGuests(guests) {
    const tbody = document.getElementById('guests-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = guests.map(guest => {
        const tags = parseTags(guest.tags);
        return `
            <tr>
                <td>${guest.vmid}</td>
                <td>${guest.name || '-'}</td>
                <td>${guest.type === 'qemu' ? '💻 VM' : '📦 CT'}</td>
                <td>${guest.node}</td>
                <td>
                    <span class="status-badge ${guest.status}">
                        ${guest.status === 'running' ? '● Running' : '○ Stopped'}
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

function filterGuests() {
    const search = document.getElementById('guest-search')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('guest-filter')?.value || 'all';
    
    const filtered = allGuests.filter(guest => {
        const matchesSearch = !search || 
            guest.name?.toLowerCase().includes(search) ||
            guest.vmid.toString().includes(search) ||
            guest.node.toLowerCase().includes(search);
        
        const matchesType = typeFilter === 'all' || guest.type === typeFilter;
        
        return matchesSearch && matchesType;
    });
    
    renderGuests(filtered);
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
    showConfirmModal(
        'Trigger Rebalance',
        'This will immediately rebalance VMs across the cluster. Continue?',
        async () => {
            try {
                showToast('Rebalancing started...', 'info');
                const result = await apiPost('/balancing/trigger');
                showToast('Rebalance completed', 'success');
                loadDashboard();
            } catch (error) {
                showToast('Rebalance failed', 'error');
            }
        }
    );
}

async function triggerDryRun() {
    try {
        showToast('Running simulation...', 'info');
        const result = await apiPost('/balancing/trigger?dry_run=true');
        
        if (result.result) {
            showToast('Dry run complete - check logs for details', 'success');
        } else {
            showToast('Dry run complete', 'info');
        }
    } catch (error) {
        showToast('Dry run failed', 'error');
    }
}

async function getBestNode() {
    try {
        const result = await apiGet('/balancing/best-node');
        showToast(`Best node for new VM: ${result.best_node}`, 'success');
    } catch (error) {
        showToast('Failed to get best node', 'error');
    }
}

// ============== Service Control ==============

async function startService() {
    try {
        await apiPost('/service/start');
        showToast('ProxLB service started', 'success');
        updateServiceStatusDisplay(true);
    } catch (error) {
        showToast('Failed to start service', 'error');
    }
}

async function stopService() {
    showConfirmModal(
        'Stop ProxLB',
        'Stop the ProxLB service? Automatic balancing will be disabled.',
        async () => {
            try {
                await apiPost('/service/stop');
                showToast('ProxLB service stopped', 'success');
                updateServiceStatusDisplay(false);
            } catch (error) {
                showToast('Failed to stop service', 'error');
            }
        }
    );
}

async function restartService() {
    try {
        await apiPost('/service/restart');
        showToast('ProxLB service restarted', 'success');
        updateServiceStatusDisplay(true);
    } catch (error) {
        showToast('Failed to restart service', 'error');
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

async function loadLogs() {
    try {
        const level = document.getElementById('log-level-filter')?.value || '';
        const url = level ? `/logs?lines=200&level=${level}` : '/logs?lines=200';
        
        const data = await apiGet(url);
        const viewer = document.getElementById('log-viewer');
        
        if (!viewer) return;
        
        if (!data.logs || data.logs.length === 0) {
            viewer.textContent = 'No logs available';
            return;
        }
        
        viewer.innerHTML = data.logs.map(log => {
            const level = log.level?.toLowerCase() || 'info';
            return `<div class="log-line ${level}">${log.timestamp || ''} [${log.level}] ${log.message}</div>`;
        }).join('');
        
        // Auto-scroll if enabled
        if (document.getElementById('auto-scroll')?.checked) {
            viewer.scrollTop = viewer.scrollHeight;
        }
        
    } catch (error) {
        document.getElementById('log-viewer').textContent = 'Failed to load logs';
    }
}

function refreshLogs() {
    loadLogs();
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
    showConfirmModal(
        'Save Configuration',
        'Save configuration and restart ProxLB service?',
        async () => {
            try {
                const config = buildConfigFromForm();
                
                await apiPost('/config', { config });
                await apiPost('/service/restart');
                
                showToast('Configuration saved and service restarted', 'success');
                currentConfig = config;  // Update cached config
            } catch (error) {
                showToast('Failed to save configuration: ' + error.message, 'error');
            }
        }
    );
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
    // Refresh dashboard every 30 seconds
    refreshIntervals.dashboard = setInterval(() => {
        if (currentPage === 'dashboard') {
            loadDashboard();
        }
    }, 30000);
    
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

