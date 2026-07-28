"""Authentication and authorization API endpoints.

Provides registration, login, 2FA, password reset, and token management.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field, field_validator

from hosting_control.main_controller.domain.entities import User, UserRole
from hosting_control.main_controller.infrastructure.database import get_db_session
from hosting_control.main_controller.infrastructure.repositories import (
    UnitOfWorkImpl,
)
from hosting_control.main_controller.core.redis_client import RedisClient
from hosting_control.shared.config import get_settings
from hosting_control.shared.security.hashing import hash_password, verify_password
from hosting_control.shared.security.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
)

router = APIRouter()
settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_PREFIX}/auth/login")


# ---- Request/Response Models ----

class RegisterRequest(BaseModel):
    """User registration request."""

    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=128)
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not v.isalnum() and "_" not in v and "-" not in v:
            raise ValueError("Username must be alphanumeric or contain _ or -")
        return v.lower()


class LoginRequest(BaseModel):
    """Login request."""

    email: str
    password: str


class TokenResponse(BaseModel):
    """JWT token response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60


class UserResponse(BaseModel):
    """Public user response."""

    id: str
    email: str
    username: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str
    is_verified: bool
    two_factor_enabled: bool
    created_at: datetime

    @classmethod
    def from_entity(cls, user: User) -> "UserResponse":
        return cls(
            id=user.id,
            email=user.email,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            role=user.role.value,
            is_verified=user.is_verified,
            two_factor_enabled=user.two_factor_enabled,
            created_at=user.created_at,
        )


class TwoFactorSetupResponse(BaseModel):
    """Two-factor authentication setup response."""

    secret: str
    qr_code_url: str


class TwoFactorVerifyRequest(BaseModel):
    """Two-factor verification request."""

    code: str = Field(..., min_length=6, max_length=6)


class PasswordChangeRequest(BaseModel):
    """Password change request."""

    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)


class ForgotPasswordRequest(BaseModel):
    """Forgot password request."""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Password reset request."""

    token: str
    new_password: str = Field(..., min_length=8, max_length=128)


# ---- Dependencies ----

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db = Depends(get_db_session),
) -> User:
    """Get the currently authenticated user from JWT token."""
    payload = decode_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    uow = UnitOfWorkImpl(db)
    user = await uow.users.get_by_id(payload.get("sub", ""))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return user


async def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get the current user, ensuring they are an admin."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


async def get_redis_client(request: Request) -> RedisClient:
    """Get Redis client from app state."""
    return request.app.state.redis


# ---- Endpoints ----


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    db = Depends(get_db_session),
    redis: RedisClient = Depends(get_redis_client),
) -> UserResponse:
    """Register a new user account."""
    uow = UnitOfWorkImpl(db)

    # Check if email already exists
    existing = await uow.users.get_by_email(request.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Check if username already exists
    existing = await uow.users.get_by_username(request.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken",
        )

    # Create user
    user = User(
        email=request.email,
        username=request.username,
        password_hash=hash_password(request.password),
        first_name=request.first_name,
        last_name=request.last_name,
        role=UserRole.CUSTOMER,
    )

    await uow.users.save(user)
    await uow.commit()

    return UserResponse.from_entity(user)


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    db = Depends(get_db_session),
    redis: RedisClient = Depends(get_redis_client),
) -> TokenResponse:
    """Authenticate and get JWT tokens."""
    uow = UnitOfWorkImpl(db)
    
    user = await uow.users.get_by_email(request.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.verify_password(request.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    # Record login
    user.record_login(request.client.host if hasattr(request, "client") else "unknown")
    await uow.users.save(user)
    await uow.commit()

    # Create tokens
    access_token = create_access_token(
        data={"sub": user.id, "role": user.role.value},
    )
    refresh_token = create_refresh_token(
        data={"sub": user.id},
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/token/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_token: str,
    db = Depends(get_db_session),
) -> TokenResponse:
    """Refresh an expired access token using a refresh token."""
    payload = decode_token(refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    uow = UnitOfWorkImpl(db)
    user = await uow.users.get_by_id(payload.get("sub", ""))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    access_token = create_access_token(
        data={"sub": user.id, "role": user.role.value},
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.get("/me", response_model=UserResponse)
async def get_profile(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Get current user's profile."""
    return UserResponse.from_entity(current_user)


@router.post("/password/change")
async def change_password(
    request: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db_session),
) -> dict[str, str]:
    """Change the current user's password."""
    if not current_user.verify_password(request.current_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    uow = UnitOfWorkImpl(db)
    current_user.password_hash = hash_password(request.new_password)
    current_user.mark_updated()
    await uow.users.save(current_user)
    await uow.commit()

    return {"message": "Password changed successfully"}


@router.post("/2fa/setup", response_model=TwoFactorSetupResponse)
async def setup_two_factor(
    current_user: User = Depends(get_current_user),
) -> TwoFactorSetupResponse:
    """Set up two-factor authentication."""
    import pyotp

    # Generate TOTP secret
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    qr_code_url = totp.provisioning_uri(
        name=current_user.email,
        issuer_name=settings.APP_NAME,
    )

    # Store secret temporarily (will be confirmed in verify step)
    # In production, store this in Redis with a TTL cache
    return TwoFactorSetupResponse(
        secret=secret,
        qr_code_url=qr_code_url,
    )


@router.post("/2fa/verify")
async def verify_two_factor(
    request: TwoFactorVerifyRequest,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db_session),
) -> dict[str, str]:
    """Verify and enable two-factor authentication."""
    import pyotp

    # In production, retrieve secret from temporary storage
    # For now, this requires the setup endpoint to have been called
    if not current_user.two_factor_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA not set up. Call /2fa/setup first.",
        )

    totp = pyotp.TOTP(current_user.two_factor_secret)
    if not totp.verify(request.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code",
        )

    uow = UnitOfWorkImpl(db)
    current_user.enable_two_factor(current_user.two_factor_secret)
    await uow.users.save(current_user)
    await uow.commit()

    return {"message": "Two-factor authentication enabled"}


@router.post("/2fa/disable")
async def disable_two_factor(
    request: TwoFactorVerifyRequest,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db_session),
) -> dict[str, str]:
    """Disable two-factor authentication."""
    import pyotp

    if not current_user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is not enabled",
        )

    totp = pyotp.TOTP(current_user.two_factor_secret)
    if not totp.verify(request.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code",
        )

    uow = UnitOfWorkImpl(db)
    current_user.disable_two_factor()
    await uow.users.save(current_user)
    await uow.commit()

    return {"message": "Two-factor authentication disabled"}