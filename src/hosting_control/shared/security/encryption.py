"""Encryption utilities for sensitive data using AES-256-GCM."""

from __future__ import annotations

import base64
import os

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from hosting_control.shared.config import get_settings


def _get_fernet() -> Fernet:
    """Get a Fernet instance using the configured encryption key."""
    settings = get_settings()
    # Derive a 32-byte key from the configured encryption key using PBKDF2
    key_material = settings.ENCRYPTION_KEY.encode()
    salt = b"hosting_control_salt"  # Fixed salt for reproducibility
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100_000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(key_material))
    return Fernet(key)


def encrypt_value(value: str) -> str:
    """Encrypt a string value using AES-256-GCM via Fernet.

    Returns base64-encoded encrypted string.
    """
    fernet = _get_fernet()
    return fernet.encrypt(value.encode()).decode()


def decrypt_value(encrypted_value: str) -> str:
    """Decrypt a previously encrypted string value."""
    fernet = _get_fernet()
    return fernet.decrypt(encrypted_value.encode()).decode()


def generate_secure_token(length: int = 32) -> str:
    """Generate a cryptographically secure random token."""
    return base64.urlsafe_b64encode(os.urandom(length)).decode()


def generate_api_key() -> str:
    """Generate a formatted API key (e.g., hcp_xxxxx)."""
    token = base64.urlsafe_b64encode(os.urandom(32)).decode().rstrip("=")
    return f"hcp_{token}"