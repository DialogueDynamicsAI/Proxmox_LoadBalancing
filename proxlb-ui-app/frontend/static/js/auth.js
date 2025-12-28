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

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
});
