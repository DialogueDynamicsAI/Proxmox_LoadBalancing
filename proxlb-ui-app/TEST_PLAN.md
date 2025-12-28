# Proxmox LoadBalancer - Comprehensive Test Plan
## Powered by Dialogue Dynamics

**Version:** 1.0.0  
**Date:** December 28, 2025  
**Test Environment:** http://10.80.11.115:8080

---

## Table of Contents
1. [Test Environment Setup](#1-test-environment-setup)
2. [Authentication Tests](#2-authentication-tests)
3. [Authorization/RBAC Tests](#3-authorizationrbac-tests)
4. [Dashboard Tests](#4-dashboard-tests)
5. [Nodes Tests](#5-nodes-tests)
6. [Guests Tests](#6-guests-tests)
7. [Balancing Tests](#7-balancing-tests)
8. [Maintenance Mode Tests](#8-maintenance-mode-tests)
9. [Logs Tests](#9-logs-tests)
10. [Configuration Tests](#10-configuration-tests)
11. [User Management Tests](#11-user-management-tests)
12. [SMTP/Email Tests](#12-smtpemail-tests)
13. [2FA Tests](#13-2fa-tests)
14. [Password Management Tests](#14-password-management-tests)
15. [Manual Migration Tests](#15-manual-migration-tests)

---

## 1. Test Environment Setup

### Prerequisites
- [ ] Proxmox cluster with at least 2 nodes
- [ ] ProxLB container running
- [ ] ProxLB UI container running
- [ ] SMTP relay configured
- [ ] Test email address available

### Test Accounts
| Username | Password | Role | Purpose |
|----------|----------|------|---------|
| admin | (generated) | Admin | Full access testing |
| techuser | (generated) | Tech | Balance operations testing |
| level1user | (generated) | Level1 | Read-only testing |

---

## 2. Authentication Tests

### 2.1 Login Tests
| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| AUTH-001 | Valid admin login | 1. Navigate to /login<br>2. Enter admin credentials<br>3. Click Login | Redirect to dashboard, user menu shows "admin" | ☐ |
| AUTH-002 | Valid tech login | 1. Login as techuser | Redirect to dashboard, limited menu options | ☐ |
| AUTH-003 | Valid level1 login | 1. Login as level1user | Redirect to dashboard, read-only view | ☐ |
| AUTH-004 | Invalid password | 1. Enter wrong password<br>2. Click Login | Error: "Invalid username or password" | ☐ |
| AUTH-005 | Invalid username | 1. Enter non-existent username | Error: "Invalid username or password" | ☐ |
| AUTH-006 | Disabled user login | 1. Disable a user<br>2. Try to login | Error: "Account is disabled" | ☐ |
| AUTH-007 | Empty fields | 1. Submit empty form | Validation error | ☐ |

### 2.2 Logout Tests
| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| AUTH-008 | Logout | 1. Click user menu<br>2. Click Logout | Redirect to login page, session cleared | ☐ |
| AUTH-009 | Access after logout | 1. Logout<br>2. Navigate to dashboard | Redirect to login | ☐ |

### 2.3 Session Tests
| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| AUTH-010 | Session persistence | 1. Login<br>2. Close browser<br>3. Reopen | Session maintained (24hr token) | ☐ |
| AUTH-011 | Token expiry | 1. Wait for token expiry | Redirect to login on next request | ☐ |

---

## 3. Authorization/RBAC Tests

### 3.1 Admin Role Tests
| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| RBAC-001 | Admin sees all menu items | 1. Login as admin | Dashboard, Nodes, Guests, Balancing, Rules, Logs, Config, Users, Settings visible | ☐ |
| RBAC-002 | Admin can access Users page | 1. Navigate to Users | User list displayed | ☐ |
| RBAC-003 | Admin can access Settings | 1. Navigate to Settings | SMTP config displayed | ☐ |
| RBAC-004 | Admin can change config | 1. Update balancing config<br>2. Save | Config saved successfully | ☐ |
| RBAC-005 | Admin can manage users | 1. Create/Edit/Delete users | Operations succeed | ☐ |

### 3.2 Tech Role Tests
| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| RBAC-006 | Tech menu items | 1. Login as tech | No Users or Settings menu | ☐ |
| RBAC-007 | Tech cannot access Users API | 1. Call /api/users | 403 Forbidden | ☐ |
| RBAC-008 | Tech can trigger balance | 1. Click Trigger Rebalance | Operation succeeds | ☐ |
| RBAC-009 | Tech can use maintenance mode | 1. Add node to maintenance | Operation succeeds | ☐ |
| RBAC-010 | Tech cannot change config | 1. Try to update config | 403 Forbidden | ☐ |

### 3.3 Level1 Role Tests
| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| RBAC-011 | Level1 menu items | 1. Login as level1 | No Users, Settings, Config menu | ☐ |
| RBAC-012 | Level1 can view dashboard | 1. View dashboard | Data displayed (read-only) | ☐ |
| RBAC-013 | Level1 cannot trigger balance | 1. Try to trigger balance | 403 Forbidden or button hidden | ☐ |
| RBAC-014 | Level1 cannot change maintenance | 1. Try maintenance mode | 403 Forbidden or button hidden | ☐ |
| RBAC-015 | Level1 can view logs | 1. Navigate to Logs | Logs displayed | ☐ |

---

## 4. Dashboard Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| DASH-001 | Dashboard loads | 1. Navigate to dashboard | All widgets load | ☐ |
| DASH-002 | Cluster name displays | 1. View dashboard | Correct cluster name shown | ☐ |
| DASH-003 | Node count accurate | 1. Compare with Proxmox | Online/Total nodes match | ☐ |
| DASH-004 | VM count accurate | 1. Compare with Proxmox | Running/Total VMs match | ☐ |
| DASH-005 | Container count accurate | 1. Compare with Proxmox | Running/Total CTs match | ☐ |
| DASH-006 | Service status shows | 1. View ProxLB status | Running/Stopped indicated | ☐ |
| DASH-007 | Next rebalance countdown | 1. Enable auto-balance<br>2. View dashboard | Countdown timer shown | ☐ |
| DASH-008 | Manual mode display | 1. Disable auto-balance<br>2. View dashboard | Shows "Manual" instead of countdown | ☐ |
| DASH-009 | Auto-refresh works | 1. Wait 15 seconds | Dashboard updates automatically | ☐ |
| DASH-010 | Manual refresh button | 1. Click refresh | Dashboard refreshes with toast | ☐ |

---

## 5. Nodes Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| NODE-001 | Nodes list loads | 1. Navigate to Nodes | All nodes displayed | ☐ |
| NODE-002 | Node details expand | 1. Click on node card | Details expand with CPU/RAM/Disk | ☐ |
| NODE-003 | Node status accurate | 1. Compare with Proxmox | Online/Offline status matches | ☐ |
| NODE-004 | Memory usage accurate | 1. Compare with Proxmox | Used/Total memory matches | ☐ |
| NODE-005 | CPU usage accurate | 1. Compare with Proxmox | CPU percentage reasonable | ☐ |
| NODE-006 | Disk usage accurate | 1. Compare with Proxmox | Storage usage matches | ☐ |
| NODE-007 | VM count per node | 1. Compare with Proxmox | Guest count matches | ☐ |
| NODE-008 | Maintenance badge shows | 1. Add node to maintenance<br>2. View nodes | Maintenance badge visible | ☐ |

---

## 6. Guests Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| GUEST-001 | Guests list loads | 1. Navigate to Guests | All VMs/CTs displayed | ☐ |
| GUEST-002 | Search by name | 1. Type VM name in search | Filtered results shown | ☐ |
| GUEST-003 | Filter by node | 1. Select node from dropdown | Only guests on that node shown | ☐ |
| GUEST-004 | Filter by status | 1. Select Online/Offline | Filtered results shown | ☐ |
| GUEST-005 | Filter by type | 1. Select VM/CT | Filtered results shown | ☐ |
| GUEST-006 | Guest details display | 1. View guest in list | Name, ID, Node, Status, Resources shown | ☐ |
| GUEST-007 | Running guest indicator | 1. View running VM | Green status indicator | ☐ |
| GUEST-008 | Stopped guest indicator | 1. View stopped VM | Gray status indicator | ☐ |

---

## 7. Balancing Tests

### 7.1 Auto-Balance Mode Tests
| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| BAL-001 | Enable auto-balance | 1. Go to Config<br>2. Enable auto-balance<br>3. Save | ProxLB runs in daemon mode | ☐ |
| BAL-002 | Auto-balance interval | 1. Set interval to 5 min<br>2. Wait | Balance runs automatically | ☐ |
| BAL-003 | Dashboard shows countdown | 1. View dashboard | Next rebalance countdown visible | ☐ |

### 7.2 Manual Balance Tests
| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| BAL-004 | Disable auto-balance | 1. Go to Config<br>2. Disable auto-balance<br>3. Save | Auto-balance stopped | ☐ |
| BAL-005 | Dashboard shows Manual | 1. View dashboard | "Manual" displayed instead of countdown | ☐ |
| BAL-006 | Manual dry run | 1. Go to Balancing<br>2. Click Dry Run | Results modal shows proposed migrations | ☐ |
| BAL-007 | Manual trigger balance | 1. Click Trigger Rebalance | Migrations executed and logged | ☐ |
| BAL-008 | Get best node | 1. Click Get Best Node | Best node for new VM shown | ☐ |

### 7.3 Balance Settings Tests
| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| BAL-009 | Change balance method | 1. Select memory/cpu/disk<br>2. Save | Method updated | ☐ |
| BAL-010 | Adjust balanciness | 1. Move slider<br>2. Save | Sensitivity updated | ☐ |
| BAL-011 | Set memory threshold | 1. Adjust threshold<br>2. Save | Threshold updated | ☐ |

---

## 8. Maintenance Mode Tests

### 8.1 ProxLB Maintenance Mode
| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| MAINT-001 | Enter ProxLB maintenance | 1. Click node maintenance<br>2. Select ProxLB<br>3. Confirm | Node added to maintenance list | ☐ |
| MAINT-002 | Node excluded from balance | 1. Put node in maintenance<br>2. Run dry run | Node excluded from targets | ☐ |
| MAINT-003 | Exit ProxLB maintenance | 1. Click exit maintenance | Node removed from list | ☐ |
| MAINT-004 | VMs migrated before maintenance | 1. Enter maintenance | VMs migrate to other nodes | ☐ |

### 8.2 Proxmox HA Maintenance Mode
| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| MAINT-005 | HA maintenance instructions | 1. Click Proxmox HA option | Shell commands displayed | ☐ |
| MAINT-006 | Enter HA maintenance (CLI) | 1. Run CLI command on Proxmox | Node enters HA maintenance | ☐ |
| MAINT-007 | HA VMs migrate | 1. Enter HA maintenance | HA-managed VMs migrate | ☐ |
| MAINT-008 | Exit HA maintenance (CLI) | 1. Run CLI command | Node exits HA maintenance | ☐ |

---

## 9. Logs Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| LOG-001 | Logs page loads | 1. Navigate to Logs | ProxLB logs displayed | ☐ |
| LOG-002 | Filter by log level | 1. Select INFO/WARNING/ERROR | Filtered logs shown | ☐ |
| LOG-003 | Migration logs visible | 1. After balance, check logs | Migration entries shown | ☐ |
| LOG-004 | Log timestamps accurate | 1. Compare with recent action | Timestamp correct | ☐ |
| LOG-005 | Raw logs available | 1. Click Show Raw | Full container logs shown | ☐ |
| LOG-006 | Log refresh | 1. Click Refresh | Logs updated | ☐ |

---

## 10. Configuration Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| CFG-001 | Config page loads | 1. Navigate to Config | Current config displayed | ☐ |
| CFG-002 | Password masked | 1. View API password | Shows ******** | ☐ |
| CFG-003 | Save config changes | 1. Modify setting<br>2. Save | Config updated | ☐ |
| CFG-004 | Config persists restart | 1. Save config<br>2. Restart container | Config preserved | ☐ |
| CFG-005 | Invalid config rejected | 1. Enter invalid value<br>2. Save | Error shown | ☐ |

---

## 11. User Management Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| USER-001 | Users page loads | 1. Navigate to Users | User list displayed | ☐ |
| USER-002 | Create user | 1. Click Add User<br>2. Fill form<br>3. Submit | User created | ☐ |
| USER-003 | Edit user | 1. Click Edit<br>2. Modify fields<br>3. Save | User updated | ☐ |
| USER-004 | Delete user | 1. Click Delete<br>2. Confirm | User removed | ☐ |
| USER-005 | Cannot delete self | 1. Try to delete own account | Error: Cannot delete self | ☐ |
| USER-006 | Change user role | 1. Edit user<br>2. Change role<br>3. Save | Role updated | ☐ |
| USER-007 | Disable user | 1. Edit user<br>2. Set inactive<br>3. Save | User disabled | ☐ |
| USER-008 | User card shows 2FA status | 1. View user card | 2FA Enabled/Disabled shown | ☐ |

---

## 12. SMTP/Email Tests

| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| SMTP-001 | Settings page loads | 1. Navigate to Settings | SMTP form displayed | ☐ |
| SMTP-002 | Save SMTP config | 1. Enter SMTP details<br>2. Save | Config saved | ☐ |
| SMTP-003 | Test connection | 1. Click Test Connection | Success/failure message | ☐ |
| SMTP-004 | Send test email | 1. Enter email<br>2. Click Send Test | Email received | ☐ |
| SMTP-005 | Email logs display | 1. View Email Logs section | Sent emails listed | ☐ |
| SMTP-006 | Email stats accurate | 1. View stats | Total/Success/Failed counts | ☐ |
| SMTP-007 | Filter logs by status | 1. Select Success/Failed | Filtered logs shown | ☐ |
| SMTP-008 | Filter logs by type | 1. Select Test/Password Reset | Filtered logs shown | ☐ |
| SMTP-009 | Clear email logs | 1. Click Clear Logs | Logs cleared | ☐ |

---

## 13. 2FA Tests

### 13.1 User 2FA Setup
| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| 2FA-001 | Setup 2FA | 1. Click profile<br>2. Setup 2FA<br>3. Scan QR | Secret and QR displayed | ☐ |
| 2FA-002 | Enable 2FA | 1. Enter TOTP code | 2FA enabled, backup codes shown | ☐ |
| 2FA-003 | Login with 2FA | 1. Login<br>2. Enter TOTP code | Successfully authenticated | ☐ |
| 2FA-004 | Wrong TOTP rejected | 1. Enter wrong code | Error: Invalid token | ☐ |
| 2FA-005 | Disable 2FA | 1. Profile > Disable 2FA<br>2. Enter password | 2FA disabled | ☐ |

### 13.2 Admin 2FA Management
| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| 2FA-006 | Reset user 2FA | 1. Edit user<br>2. Click Reset 2FA | User 2FA cleared | ☐ |
| 2FA-007 | Reset 2FA logged | 1. Check email logs | No email for 2FA reset | ☐ |
| 2FA-008 | User can re-setup 2FA | 1. After reset, user sets up again | 2FA re-enabled | ☐ |

---

## 14. Password Management Tests

### 14.1 User Password Change
| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PWD-001 | Change own password | 1. Profile > Change Password<br>2. Enter current + new | Password changed | ☐ |
| PWD-002 | Wrong current password | 1. Enter wrong current | Error: Incorrect password | ☐ |
| PWD-003 | Login with new password | 1. Logout<br>2. Login with new | Successfully authenticated | ☐ |

### 14.2 Admin Password Reset
| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PWD-004 | Generate new password | 1. Edit user<br>2. Click Generate New | New password shown | ☐ |
| PWD-005 | Password emailed | 1. Generate new for user with email | Email sent with password | ☐ |
| PWD-006 | Password copied | 1. Click Copy button | Password in clipboard | ☐ |
| PWD-007 | Send reset link | 1. Click Send Reset Email | Reset email sent | ☐ |
| PWD-008 | Reset link works | 1. Click link in email<br>2. Set new password | Password reset successful | ☐ |

### 14.3 Forgot Password Flow
| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| PWD-009 | Forgot password request | 1. Click Forgot Password<br>2. Enter email | Email sent (if exists) | ☐ |
| PWD-010 | Reset with valid token | 1. Use reset link<br>2. Enter new password | Password reset | ☐ |
| PWD-011 | Expired token rejected | 1. Wait 1+ hour<br>2. Try reset link | Error: Expired token | ☐ |
| PWD-012 | Invalid token rejected | 1. Modify token<br>2. Try reset | Error: Invalid token | ☐ |

---

## 15. Manual Migration Tests (Auto-Balance Disabled)

### 15.1 Pre-Test Setup
| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| MIG-000 | Disable auto-balance | 1. Config > Disable auto-balance<br>2. Save<br>3. Verify dashboard shows "Manual" | Auto-balance disabled | ☐ |

### 15.2 Dry Run Tests
| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| MIG-001 | Dry run with balanced cluster | 1. Click Dry Run | "No migrations needed" or minimal | ☐ |
| MIG-002 | Dry run with imbalanced cluster | 1. Create imbalance<br>2. Dry run | Proposed migrations shown | ☐ |
| MIG-003 | Dry run shows source/target | 1. View dry run results | VM, source node, target node visible | ☐ |
| MIG-004 | Dry run shows resource impact | 1. View results | Memory/CPU changes shown | ☐ |
| MIG-005 | Dry run downloadable | 1. Click Download CSV | CSV file downloaded | ☐ |

### 15.3 Manual Trigger Balance Tests
| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| MIG-006 | Trigger manual balance | 1. Click Trigger Rebalance | Migrations executed | ☐ |
| MIG-007 | Live progress shown | 1. During migration | Progress/status updates | ☐ |
| MIG-008 | Migrations logged | 1. Check Logs after | Migration entries visible | ☐ |
| MIG-009 | Proxmox confirms migration | 1. Check Proxmox Tasks | Migration tasks completed | ☐ |
| MIG-010 | VM accessible after migration | 1. Access migrated VM | VM functional on new node | ☐ |

### 15.4 Best Node Selection
| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| MIG-011 | Get best node | 1. Click Get Best Node | Node with most resources shown | ☐ |
| MIG-012 | Best node excludes maintenance | 1. Put node in maintenance<br>2. Get best node | Maintenance node not suggested | ☐ |
| MIG-013 | Best node considers method | 1. Set memory method<br>2. Get best node | Node with most free memory | ☐ |

### 15.5 Edge Cases
| ID | Test Case | Steps | Expected Result | Status |
|----|-----------|-------|-----------------|--------|
| MIG-014 | Single node cluster | 1. Only 1 node online<br>2. Dry run | No migrations possible | ☐ |
| MIG-015 | All nodes in maintenance | 1. All nodes maintenance<br>2. Balance | Error: No targets available | ☐ |
| MIG-016 | HA VM migration | 1. Migrate HA-managed VM | HA handles migration | ☐ |
| MIG-017 | Running VM migration | 1. Migrate running VM | Live migration succeeds | ☐ |
| MIG-018 | Stopped VM migration | 1. Migrate stopped VM | Offline migration succeeds | ☐ |

---

## Test Execution Summary

| Section | Total Tests | Passed | Failed | Blocked | Not Run |
|---------|-------------|--------|--------|---------|---------|
| Authentication | 11 | | | | |
| Authorization/RBAC | 15 | | | | |
| Dashboard | 10 | | | | |
| Nodes | 8 | | | | |
| Guests | 8 | | | | |
| Balancing | 11 | | | | |
| Maintenance Mode | 8 | | | | |
| Logs | 6 | | | | |
| Configuration | 5 | | | | |
| User Management | 8 | | | | |
| SMTP/Email | 9 | | | | |
| 2FA | 8 | | | | |
| Password Management | 12 | | | | |
| Manual Migration | 19 | | | | |
| **TOTAL** | **128** | | | | |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tester | | | |
| Developer | | | |
| Project Manager | | | |

---

*Proxmox LoadBalancer - Powered by Dialogue Dynamics*
