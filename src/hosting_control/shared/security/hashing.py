"""Password hashing and verification using bcrypt."""

from passlib.context import CryptContext

# Password hashing context
_pwd_context = CryptContext(
    schemes=["bcrypt"],
    bcrypt__rounds=12,
)

def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return _pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return _pwd_context.verify(plain_password, hashed_password)