"""
Authentication API routes for Proxmox LoadBalancer
Powered by Dialogue Dynamics
"""

from fastapi import APIRouter, Depends, HTTPException, status, Response, Request, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_db
from auth.models import User, UserRole
from auth.jwt_handler import create_access_token
from auth.dependencies import require_auth, require_role, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
users_router = APIRouter(prefix="/api/users", tags=["User Management"])


# ============== Pydantic Models ==============

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: str = "level1"


class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


# ============== Auth Routes ==============

@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    """Authenticate user and return JWT token"""
    # Find user
    user = db.query(User).filter(User.username == request.username).first()
    
    if not user or not user.verify_password(request.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is disabled"
        )
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Create token
    token = create_access_token(data={
        "sub": user.username,
        "role": user.role,
        "user_id": user.id
    })
    
    # Set cookie for browser sessions
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        max_age=86400,  # 24 hours
        samesite="lax"
    )
    
    return LoginResponse(
        access_token=token,
        user=user.to_dict()
    )


@router.post("/logout")
async def logout(response: Response):
    """Logout and clear session"""
    response.delete_cookie("access_token")
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_me(user: User = Depends(require_auth)):
    """Get current user info"""
    return user.to_dict()


@router.post("/change-password")
async def change_password(
    request: PasswordChange,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Change current user's password"""
    if not user.verify_password(request.current_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    user.hashed_password = User.hash_password(request.new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}


@router.get("/check")
async def check_auth(user: Optional[User] = Depends(get_current_user)):
    """Check if user is authenticated"""
    if user:
        return {"authenticated": True, "user": user.to_dict()}
    return {"authenticated": False}


# ============== User Management Routes (Admin Only) ==============

@users_router.get("")
async def list_users(
    user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    """List all users (Admin only)"""
    users = db.query(User).all()
    return {"users": [u.to_dict() for u in users]}


@users_router.post("")
async def create_user(
    request: UserCreate,
    user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    """Create a new user (Admin only)"""
    # Check if username exists
    existing = db.query(User).filter(User.username == request.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # Validate role
    valid_roles = [r.value for r in UserRole]
    if request.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}"
        )
    
    # Create user
    new_user = User(
        username=request.username,
        hashed_password=User.hash_password(request.password),
        email=request.email,
        full_name=request.full_name,
        role=request.role
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {"message": "User created successfully", "user": new_user.to_dict()}


@users_router.get("/{user_id}")
async def get_user(
    user_id: int,
    user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    """Get user by ID (Admin only)"""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return target_user.to_dict()


@users_router.put("/{user_id}")
async def update_user(
    user_id: int,
    request: UserUpdate,
    user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    """Update user (Admin only)"""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update fields
    if request.email is not None:
        target_user.email = request.email
    if request.full_name is not None:
        target_user.full_name = request.full_name
    if request.role is not None:
        valid_roles = [r.value for r in UserRole]
        if request.role not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}"
            )
        target_user.role = request.role
    if request.is_active is not None:
        target_user.is_active = request.is_active
    if request.password is not None:
        target_user.hashed_password = User.hash_password(request.password)
    
    db.commit()
    db.refresh(target_user)
    
    return {"message": "User updated successfully", "user": target_user.to_dict()}


@users_router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db)
):
    """Delete user (Admin only)"""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent deleting yourself
    if target_user.id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    db.delete(target_user)
    db.commit()
    
    return {"message": "User deleted successfully"}


# ============== SMTP Configuration Routes (Admin Only) ==============

smtp_router = APIRouter(prefix="/api/smtp", tags=["SMTP Configuration"])

class SMTPConfig(BaseModel):
    host: str
    port: int = 587
    username: Optional[str] = None
    password: Optional[str] = None
    from_email: str
    use_tls: bool = True
    use_ssl: bool = False


@smtp_router.get("")
async def get_smtp_config(user: User = Depends(require_role(["admin"]))):
    """Get SMTP configuration (passwords masked)"""
    from auth.email_service import load_smtp_config
    config = load_smtp_config()
    if config:
        # Mask password
        if config.get('password'):
            config['password'] = '********'
        return {"configured": True, "config": config}
    return {"configured": False, "config": None}


@smtp_router.post("")
async def save_smtp_settings(
    config: SMTPConfig,
    user: User = Depends(require_role(["admin"]))
):
    """Save SMTP configuration"""
    from auth.email_service import save_smtp_config, load_smtp_config
    
    # If password is masked, keep the existing one
    existing = load_smtp_config()
    config_dict = config.dict()
    if config_dict.get('password') == '********' and existing:
        config_dict['password'] = existing.get('password')
    
    if save_smtp_config(config_dict):
        return {"success": True, "message": "SMTP configuration saved"}
    raise HTTPException(status_code=500, detail="Failed to save SMTP configuration")


@smtp_router.post("/test")
async def test_smtp(
    config: SMTPConfig,
    user: User = Depends(require_role(["admin"]))
):
    """Test SMTP connection"""
    from auth.email_service import test_smtp_connection, load_smtp_config
    
    config_dict = config.dict()
    # If password is masked, use existing
    if config_dict.get('password') == '********':
        existing = load_smtp_config()
        if existing:
            config_dict['password'] = existing.get('password')
    
    result = test_smtp_connection(config_dict)
    if result["success"]:
        return result
    raise HTTPException(status_code=400, detail=result["message"])


class SendTestEmailRequest(BaseModel):
    to_email: str


@smtp_router.post("/send-test")
async def send_test_email(
    request: SendTestEmailRequest,
    user: User = Depends(require_role(["admin"]))
):
    """Send a test email"""
    from auth.email_service import send_email
    
    result = send_email(
        to_email=request.to_email,
        subject="Proxmox LoadBalancer - Test Email",
        body_html="""
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #06b6d4;">Proxmox LoadBalancer</h2>
            <p>This is a test email from your Proxmox LoadBalancer installation.</p>
            <p>If you received this email, your SMTP settings are configured correctly.</p>
            <hr style="border: none; border-top: 1px solid #374151; margin: 20px 0;">
            <p style="color: #9ca3af; font-size: 12px;">Powered by Dialogue Dynamics</p>
        </div>
        """,
        body_text="This is a test email from Proxmox LoadBalancer. SMTP is configured correctly."
    )
    
    if result["success"]:
        return result
    raise HTTPException(status_code=400, detail=result["message"])


# ============== Password Reset Routes ==============

class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """Request a password reset email"""
    from auth.email_service import send_email, generate_password_reset_token, load_smtp_config
    
    # Always return success to prevent email enumeration
    user = db.query(User).filter(User.email == request.email).first()
    
    if user and load_smtp_config():
        token = generate_password_reset_token(user.id, user.email)
        
        # Send reset email
        reset_url = f"/reset-password?token={token}"
        send_email(
            to_email=user.email,
            subject="Proxmox LoadBalancer - Password Reset",
            body_html=f"""
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #06b6d4;">Password Reset Request</h2>
                <p>Hello {user.full_name or user.username},</p>
                <p>We received a request to reset your password for Proxmox LoadBalancer.</p>
                <p>Click the button below to reset your password:</p>
                <p style="text-align: center; margin: 30px 0;">
                    <a href="{reset_url}" style="background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        Reset Password
                    </a>
                </p>
                <p style="color: #9ca3af; font-size: 14px;">This link expires in 1 hour.</p>
                <p style="color: #9ca3af; font-size: 14px;">If you didn't request this, please ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #374151; margin: 20px 0;">
                <p style="color: #9ca3af; font-size: 12px;">Powered by Dialogue Dynamics</p>
            </div>
            """
        )
    
    return {"message": "If an account with that email exists, a password reset link has been sent."}


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """Reset password using a token"""
    from auth.email_service import verify_password_reset_token, invalidate_password_reset_token
    
    token_data = verify_password_reset_token(request.token)
    if not token_data:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    user = db.query(User).filter(User.id == token_data["user_id"]).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    
    user.hashed_password = User.hash_password(request.new_password)
    db.commit()
    
    invalidate_password_reset_token(request.token)
    
    return {"message": "Password reset successfully"}


# ============== 2FA Routes ==============

class Enable2FARequest(BaseModel):
    token: str  # TOTP token to verify setup


class Verify2FARequest(BaseModel):
    token: str


@router.post("/2fa/setup")
async def setup_2fa(
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Generate 2FA secret and QR code URI"""
    from auth.totp_service import generate_totp_secret, get_totp_uri
    
    if user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA is already enabled")
    
    secret = generate_totp_secret()
    
    # Temporarily store secret (not enabled yet)
    user.totp_secret = secret
    db.commit()
    
    uri = get_totp_uri(secret, user.username)
    
    return {
        "secret": secret,
        "qr_uri": uri,
        "message": "Scan the QR code with your authenticator app, then verify with a token"
    }


@router.post("/2fa/enable")
async def enable_2fa(
    request: Enable2FARequest,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Enable 2FA after verifying setup token"""
    from auth.totp_service import verify_totp, generate_backup_codes
    import json
    
    if not user.totp_secret:
        raise HTTPException(status_code=400, detail="Please setup 2FA first")
    
    if not verify_totp(user.totp_secret, request.token):
        raise HTTPException(status_code=400, detail="Invalid token")
    
    # Generate backup codes
    backup_codes = generate_backup_codes()
    
    user.totp_enabled = True
    user.backup_codes = json.dumps([User.hash_password(code) for code in backup_codes])
    db.commit()
    
    return {
        "message": "2FA enabled successfully",
        "backup_codes": backup_codes,
        "warning": "Save these backup codes securely. They cannot be shown again."
    }


@router.post("/2fa/disable")
async def disable_2fa(
    request: PasswordChange,  # Requires current password
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Disable 2FA (requires password verification)"""
    if not user.verify_password(request.current_password):
        raise HTTPException(status_code=400, detail="Invalid password")
    
    user.totp_enabled = False
    user.totp_secret = None
    user.backup_codes = None
    db.commit()
    
    return {"message": "2FA disabled successfully"}


@router.post("/2fa/verify")
async def verify_2fa(
    request: Verify2FARequest,
    user: User = Depends(require_auth)
):
    """Verify a 2FA token"""
    from auth.totp_service import verify_totp
    
    if not user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA is not enabled")
    
    if verify_totp(user.totp_secret, request.token):
        return {"valid": True}
    
    raise HTTPException(status_code=400, detail="Invalid token")


# ============== Profile Routes ==============

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None


@router.put("/profile")
async def update_profile(
    request: ProfileUpdate,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Update current user's profile"""
    if request.full_name is not None:
        user.full_name = request.full_name
    if request.email is not None:
        # Check if email is already in use
        if request.email:
            existing = db.query(User).filter(
                User.email == request.email,
                User.id != user.id
            ).first()
            if existing:
                raise HTTPException(status_code=400, detail="Email already in use")
        user.email = request.email
    
    db.commit()
    db.refresh(user)
    
    return {"message": "Profile updated", "user": user.to_dict()}
