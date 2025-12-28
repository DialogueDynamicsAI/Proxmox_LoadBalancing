/**
 * Authentication module for Proxmox LoadBalancer
 * Powered by Dialogue Dynamics
 */

// Auth state
let currentUser = null;
let authToken = null;

/**
 * Initialize authentication state
 */
function initAuth() {
    authToken = localStorage.getItem('access_token');
    const userStr = localStorage.getItem('user');
    if (userStr) {
        try {
            currentUser = JSON.parse(userStr);
        } catch (e) {
            currentUser = null;
        }
    }
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
    return !!authToken && !!currentUser;
}

/**
 * Get current user
 */
function getCurrentUser() {
    return currentUser;
}

/**
 * Get current user's role
 */
function getUserRole() {
    return currentUser?.role || null;
}

/**
 * Check if current user has required role
 */
function hasRole(requiredRoles) {
    if (!currentUser) return false;
    if (typeof requiredRoles === 'string') {
        requiredRoles = [requiredRoles];
    }
    return requiredRoles.includes(currentUser.role);
}

/**
 * Check if user is admin
 */
function isAdmin() {
    return hasRole(['admin']);
}

/**
 * Check if user is tech or admin
 */
function isTech() {
    return hasRole(['admin', 'tech']);
}

/**
 * Logout user
 */
async function logout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            headers: getAuthHeaders()
        });
    } catch (e) {
        // Ignore errors, just clear local state
    }
    
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    currentUser = null;
    authToken = null;
    
    window.location.href = '/login';
}

/**
 * Get auth headers for API requests
 */
function getAuthHeaders() {
    const headers = {
        'Content-Type': 'application/json'
    };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    return headers;
}

/**
 * Verify auth and redirect to login if not authenticated
 */
async function requireAuth() {
    initAuth();
    
    if (!isAuthenticated()) {
        window.location.href = '/login';
        return false;
    }
    
    // Verify token is still valid
    try {
        const response = await fetch('/api/auth/check', {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Token invalid');
        }
        
        const data = await response.json();
        if (!data.authenticated) {
            throw new Error('Not authenticated');
        }
        
        // Update user info
        currentUser = data.user;
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Check if user needs to setup 2FA
        if (needsToSetup2FA()) {
            showMandatory2FASetup();
            return false; // Prevent normal page load
        }
        
        return true;
    } catch (e) {
        // Token invalid, redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return false;
    }
}

/**
 * Apply role-based visibility to UI elements
 */
function applyRoleBasedUI() {
    const role = getUserRole();
    
    // Update profile display
    if (typeof updateUserProfileDisplay === 'function') {
        updateUserProfileDisplay();
    }
    
    // Elements only visible to admin
    document.querySelectorAll('[data-role="admin"]').forEach(el => {
        el.style.display = isAdmin() ? '' : 'none';
    });
    
    // Elements visible to admin and tech
    document.querySelectorAll('[data-role="tech"]').forEach(el => {
        el.style.display = isTech() ? '' : 'none';
    });
    
    // Elements visible to all authenticated users
    document.querySelectorAll('[data-role="any"]').forEach(el => {
        el.style.display = isAuthenticated() ? '' : 'none';
    });
    
    // Hide nav items based on role
    const configNav = document.querySelector('a[href="#"][onclick*="showSection(\'config\')"]:not([data-role])');
    if (configNav) {
        configNav.closest('li, a')?.setAttribute('data-role', 'admin');
        if (!isAdmin()) {
            configNav.style.display = 'none';
        }
    }
    
    // Update user display in sidebar
    updateUserDisplay();
}

/**
 * Update user display in the UI
 */
function updateUserDisplay() {
    const userInfoEl = document.getElementById('user-info');
    if (userInfoEl && currentUser) {
        userInfoEl.innerHTML = `
            <div class="user-info">
                <span class="user-name">${currentUser.full_name || currentUser.username}</span>
                <span class="user-role">${currentUser.role}</span>
            </div>
        `;
    }
}



/**
 * Check if user needs to setup 2FA
 */
function needsToSetup2FA() {
    return currentUser && currentUser.require_2fa_setup && !currentUser.totp_enabled;
}

/**
 * Show mandatory 2FA setup modal
 */
async function showMandatory2FASetup() {
    // This modal cannot be dismissed without completing setup
    const overlay = document.createElement('div');
    overlay.id = 'mandatory-2fa-overlay';
    overlay.className = 'mandatory-2fa-overlay';
    overlay.innerHTML = `
        <div class="mandatory-2fa-modal">
            <div class="mandatory-2fa-header">
                <h2>🔐 Two-Factor Authentication Required</h2>
                <p>Your administrator requires you to set up 2FA before accessing the system.</p>
            </div>
            <div class="mandatory-2fa-content" id="mandatory-2fa-content">
                <div class="loading-2fa">
                    <div class="spinner"></div>
                    <p>Setting up 2FA...</p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    // Start 2FA setup
    try {
        const response = await fetch('/api/auth/2fa/setup', {
            method: 'POST',
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to initialize 2FA setup');
        }
        
        const data = await response.json();
        
        // Show QR code and verification form
        document.getElementById('mandatory-2fa-content').innerHTML = `
            <div class="setup-2fa-flow">
                <div class="step-indicator">
                    <span class="step active">1. Scan QR Code</span>
                    <span class="step">2. Verify</span>
                    <span class="step">3. Save Backup Codes</span>
                </div>
                
                <div class="qr-section">
                    <p>Scan this QR code with your authenticator app:</p>
                    <div class="qr-container">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.qr_uri)}" alt="2FA QR Code">
                    </div>
                    <p class="manual-entry">Or enter manually: <code>${data.secret}</code></p>
                </div>
                
                <form id="verify-mandatory-2fa" onsubmit="verifyMandatory2FA(event)">
                    <div class="form-group">
                        <label>Enter the 6-digit code from your app:</label>
                        <input type="text" id="mandatory-2fa-code" class="form-input otp-input" 
                               pattern="[0-9]{6}" maxlength="6" placeholder="000000" 
                               autocomplete="one-time-code" required>
                    </div>
                    <button type="submit" class="btn btn-primary btn-lg">Verify & Enable 2FA</button>
                </form>
            </div>
        `;
        
        // Focus the input
        document.getElementById('mandatory-2fa-code').focus();
        
    } catch (error) {
        document.getElementById('mandatory-2fa-content').innerHTML = `
            <div class="error-state">
                <p class="error-text">❌ ${error.message}</p>
                <button class="btn btn-primary" onclick="showMandatory2FASetup()">Try Again</button>
                <button class="btn btn-secondary" onclick="logout()">Logout</button>
            </div>
        `;
    }
}

/**
 * Verify mandatory 2FA setup
 */
async function verifyMandatory2FA(event) {
    event.preventDefault();
    const code = document.getElementById('mandatory-2fa-code').value;
    
    try {
        const response = await fetch('/api/auth/2fa/enable', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ token: code })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Invalid code');
        }
        
        const data = await response.json();
        
        // Show backup codes
        document.getElementById('mandatory-2fa-content').innerHTML = `
            <div class="backup-codes-section">
                <div class="success-message">
                    <span class="success-icon">✅</span>
                    <h3>2FA Enabled Successfully!</h3>
                </div>
                
                <div class="backup-codes-warning">
                    <p>⚠️ <strong>Save these backup codes now!</strong></p>
                    <p>You'll need them if you lose access to your authenticator app.</p>
                </div>
                
                <div class="backup-codes-grid">
                    ${data.backup_codes.map(code => `<code>${code}</code>`).join('')}
                </div>
                
                <button class="btn btn-secondary" onclick="copyBackupCodesToClipboard([${data.backup_codes.map(c => "'" + c + "'").join(',')}])">
                    📋 Copy All Codes
                </button>
                
                <div class="confirm-saved">
                    <label>
                        <input type="checkbox" id="confirm-codes-saved" onchange="toggleContinueButton()">
                        I have saved my backup codes securely
                    </label>
                </div>
                
                <button id="continue-btn" class="btn btn-primary btn-lg" onclick="complete2FASetup()" disabled>
                    Continue to Dashboard
                </button>
            </div>
        `;
        
    } catch (error) {
        alert('Invalid code. Please try again.');
        document.getElementById('mandatory-2fa-code').value = '';
        document.getElementById('mandatory-2fa-code').focus();
    }
}

function copyBackupCodesToClipboard(codes) {
    navigator.clipboard.writeText(codes.join('\n')).then(() => {
        alert('Backup codes copied to clipboard!');
    });
}

function toggleContinueButton() {
    const checkbox = document.getElementById('confirm-codes-saved');
    const button = document.getElementById('continue-btn');
    button.disabled = !checkbox.checked;
}

function complete2FASetup() {
    // Remove the overlay and reload the page
    const overlay = document.getElementById('mandatory-2fa-overlay');
    if (overlay) {
        overlay.remove();
    }
    // Reload to get fresh user data
    window.location.reload();
}

/**
 * Modified requireAuth to check for 2FA setup requirement
 */

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
});
