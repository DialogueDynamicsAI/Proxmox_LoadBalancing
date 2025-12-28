"""
TOTP 2FA Service for Proxmox LoadBalancer
Powered by Dialogue Dynamics
"""

import pyotp
import base64
import secrets
from typing import Optional


def generate_totp_secret() -> str:
    """Generate a new TOTP secret"""
    return pyotp.random_base32()


def get_totp_uri(secret: str, username: str, issuer: str = "Proxmox LoadBalancer") -> str:
    """Generate TOTP provisioning URI for QR code"""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=username, issuer_name=issuer)


def verify_totp(secret: str, token: str) -> bool:
    """Verify a TOTP token"""
    try:
        totp = pyotp.TOTP(secret)
        return totp.verify(token, valid_window=1)  # Allow 1 period before/after
    except Exception:
        return False


def generate_backup_codes(count: int = 8) -> list:
    """Generate backup codes for 2FA recovery"""
    return [secrets.token_hex(4).upper() for _ in range(count)]
