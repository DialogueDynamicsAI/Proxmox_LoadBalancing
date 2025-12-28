"""
Database configuration for Proxmox LoadBalancer
Powered by Dialogue Dynamics
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Database path - stored in /data volume for persistence
DATABASE_DIR = os.getenv("DATABASE_DIR", "/data")
DATABASE_URL = f"sqlite:///{DATABASE_DIR}/proxlb.db"

# Create directory if it doesn't exist
os.makedirs(DATABASE_DIR, exist_ok=True)

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False}  # Required for SQLite
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables"""
    from auth.models import User  # Import here to avoid circular imports
    Base.metadata.create_all(bind=engine)
