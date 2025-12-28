"""
Authentication API routes for Proxmox LoadBalancer
Powered by Dialogue Dynamics
"""

from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
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
