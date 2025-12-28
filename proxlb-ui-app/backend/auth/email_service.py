"""
Email Service for Proxmox LoadBalancer
Powered by Dialogue Dynamics
"""

import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import os
import json
import secrets
from datetime import datetime, timedelta

# SMTP settings file path
SMTP_CONFIG_PATH = "/data/smtp_config.json"


def load_smtp_config() -> Optional[dict]:
    """Load SMTP configuration from file"""
    try:
        if os.path.exists(SMTP_CONFIG_PATH):
            with open(SMTP_CONFIG_PATH, 'r') as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading SMTP config: {e}")
    return None


def save_smtp_config(config: dict) -> bool:
    """Save SMTP configuration to file"""
    try:
        os.makedirs(os.path.dirname(SMTP_CONFIG_PATH), exist_ok=True)
        with open(SMTP_CONFIG_PATH, 'w') as f:
            json.dump(config, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving SMTP config: {e}")
        return False


def test_smtp_connection(config: dict) -> dict:
    """Test SMTP connection with given config"""
    try:
        if config.get('use_ssl', False):
            context = ssl.create_default_context()
            server = smtplib.SMTP_SSL(config['host'], config.get('port', 465), context=context)
        else:
            server = smtplib.SMTP(config['host'], config.get('port', 587))
            if config.get('use_tls', True):
                server.starttls()
        
        if config.get('username') and config.get('password'):
            server.login(config['username'], config['password'])
        
        server.quit()
        return {"success": True, "message": "SMTP connection successful"}
    except Exception as e:
        return {"success": False, "message": str(e)}


def send_email(to_email: str, subject: str, body_html: str, body_text: str = None) -> dict:
    """Send an email using configured SMTP settings"""
    config = load_smtp_config()
    if not config:
        return {"success": False, "message": "SMTP not configured"}
    
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = config.get('from_email', config.get('username'))
        msg["To"] = to_email
        
        if body_text:
            msg.attach(MIMEText(body_text, "plain"))
        msg.attach(MIMEText(body_html, "html"))
        
        if config.get('use_ssl', False):
            context = ssl.create_default_context()
            server = smtplib.SMTP_SSL(config['host'], config.get('port', 465), context=context)
        else:
            server = smtplib.SMTP(config['host'], config.get('port', 587))
            if config.get('use_tls', True):
                server.starttls()
        
        if config.get('username') and config.get('password'):
            server.login(config['username'], config['password'])
        
        server.sendmail(msg["From"], to_email, msg.as_string())
        server.quit()
        
        return {"success": True, "message": "Email sent successfully"}
    except Exception as e:
        return {"success": False, "message": str(e)}


# Password reset tokens (in-memory for simplicity, could use database)
password_reset_tokens = {}


def generate_password_reset_token(user_id: int, email: str) -> str:
    """Generate a password reset token"""
    token = secrets.token_urlsafe(32)
    password_reset_tokens[token] = {
        "user_id": user_id,
        "email": email,
        "expires": datetime.utcnow() + timedelta(hours=1)
    }
    return token


def verify_password_reset_token(token: str) -> Optional[dict]:
    """Verify a password reset token and return user info if valid"""
    token_data = password_reset_tokens.get(token)
    if not token_data:
        return None
    
    if datetime.utcnow() > token_data["expires"]:
        del password_reset_tokens[token]
        return None
    
    return token_data


def invalidate_password_reset_token(token: str):
    """Invalidate a used token"""
    if token in password_reset_tokens:
        del password_reset_tokens[token]
