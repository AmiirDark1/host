"""Unit tests for security utilities."""
import pytest
from datetime import datetime, timedelta, timezone

from hosting_control.shared.security.hashing import hash_password, verify_password
from hosting_control.shared.security.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from hosting_control.shared.security.encryption import (
    encrypt_value,
    decrypt_value,
    generate_secure_token,
    generate_api_key,
)
from hosting_control.shared.config import Settings


class TestPasswordHashing:
    """Unit tests for password hashing utilities."""

    def test_hash_password_returns_string(self):
        """Test that hash_password returns a non-empty string."""
        password = "secure_password123!"
        hashed = hash_password(password)
        assert isinstance(hashed, str)
        assert len(hashed) > 0
        assert hashed != password

    def test_hash_password_different_for_same_password(self):
        """Test that the same password produces different hashes each time (salt)."""
        password = "secure_password123!"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        assert hash1 != hash2

    def test_verify_password_correct(self):
        """Test that verify_password returns True for correct password."""
        password = "secure_password123!"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        """Test that verify_password returns False for incorrect password."""
        password = "secure_password123!"
        wrong_password = "wrong_password!"
        hashed = hash_password(password)
        assert verify_password(wrong_password, hashed) is False

    def test_verify_password_empty(self):
        """Test that verify_password handles empty strings."""
        hashed = hash_password("password")
        assert verify_password("", hashed) is False

    def test_hash_password_empty(self):
        """Test that hash_password can hash empty string."""
        hashed = hash_password("")
        assert isinstance(hashed, str)
        assert len(hashed) > 0

    def test_hash_password_unicode(self):
        """Test that hash_password handles unicode characters."""
        password = "pässwörd 🔐"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_hash_password_very_long(self):
        """Test that hash_password handles very long passwords."""
        password = "a" * 1000
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True


class TestJWTToken:
    """Unit tests for JWT token creation and validation."""

    user_id = "550e8400-e29b-41d4-a716-446655440000"
    email = "test@example.com"
    role = "admin"

    def test_create_access_token_valid(self):
        """Test that create_access_token returns a valid JWT string."""
        token = create_access_token(
            user_id=self.user_id,
            email=self.email,
            role=self.role,
        )
        assert isinstance(token, str)
        assert len(token.split(".")) == 3  # JWT has 3 parts

    def test_create_access_token_with_expiry(self):
        """Test that access token contains correct expiry."""
        token = create_access_token(
            user_id=self.user_id,
            email=self.email,
            role=self.role,
            expires_delta=timedelta(hours=1),
        )
        payload = decode_token(token)
        assert payload.sub == self.user_id
        assert payload.email == self.email
        assert payload.role == self.role
        assert payload.type == "access"

    def test_create_refresh_token_valid(self):
        """Test that create_refresh_token returns a valid JWT string."""
        token = create_refresh_token(
            user_id=self.user_id,
            email=self.email,
            role=self.role,
        )
        assert isinstance(token, str)
        assert len(token.split(".")) == 3

    def test_create_refresh_token_type(self):
        """Test that refresh token has correct type claim."""
        token = create_refresh_token(
            user_id=self.user_id,
            email=self.email,
            role=self.role,
        )
        payload = decode_token(token)
        assert payload.type == "refresh"
        assert payload.sub == self.user_id

    def test_decode_valid_token(self):
        """Test that decode_token returns correct payload for valid token."""
        token = create_access_token(
            user_id=self.user_id,
            email=self.email,
            role=self.role,
        )
        payload = decode_token(token)
        assert payload.sub == self.user_id
        assert payload.email == self.email
        assert payload.role == self.role
        assert payload.type == "access"

    def test_decode_expired_token(self):
        """Test that decode_token raises ValueError for expired token."""
        token = create_access_token(
            user_id=self.user_id,
            email=self.email,
            role=self.role,
            expires_delta=timedelta(seconds=-1),  # Expired
        )
        with pytest.raises(ValueError, match="Token has expired"):
            decode_token(token)

    def test_decode_malformed_token(self):
        """Test that decode_token raises ValueError for malformed token."""
        with pytest.raises(ValueError, match="Invalid token"):
            decode_token("invalid.token.here")

    def test_decode_empty_token(self):
        """Test that decode_token raises ValueError for empty token."""
        with pytest.raises(ValueError):
            decode_token("")

    def test_access_token_expiry_duration(self):
        """Test that access token has short expiry (default 30 min)."""
        token = create_access_token(
            user_id=self.user_id,
            email=self.email,
            role=self.role,
        )
        payload = decode_token(token)
        exp = datetime.fromtimestamp(payload.exp.timestamp(), tz=timezone.utc)
        now = datetime.now(timezone.utc)
        # Should expire within 60 minutes
        assert exp - now < timedelta(minutes=60)

    def test_refresh_token_long_expiry(self):
        """Test that refresh token has longer expiry (default 7 days)."""
        token = create_refresh_token(
            user_id=self.user_id,
            email=self.email,
            role=self.role,
        )
        payload = decode_token(token)
        exp = datetime.fromtimestamp(payload.exp.timestamp(), tz=timezone.utc)
        now = datetime.now(timezone.utc)
        # Should expire within 8 days but more than 1 hour
        assert timedelta(hours=1) < exp - now < timedelta(days=8)


class TestEncryption:
    """Unit tests for secret encryption/decryption."""

    secret = "my-super-secret-password-123!"

    def test_encrypt_decrypt_roundtrip(self):
        """Test that decrypted value matches original encrypted value."""
        encrypted = encrypt_value(self.secret)
        decrypted = decrypt_value(encrypted)
        assert decrypted == self.secret

    def test_encrypted_value_differs(self):
        """Test that encrypted value differs from original."""
        encrypted = encrypt_value(self.secret)
        assert encrypted != self.secret
        assert isinstance(encrypted, str)

    def test_encrypt_different_ciphertexts(self):
        """Test that same value produces different ciphertexts each time (IV/nonce)."""
        encrypted1 = encrypt_value(self.secret)
        encrypted2 = encrypt_value(self.secret)
        assert encrypted1 != encrypted2

    def test_encrypt_empty_string(self):
        """Test that encrypting empty string works."""
        encrypted = encrypt_value("")
        decrypted = decrypt_value(encrypted)
        assert decrypted == ""

    def test_encrypt_unicode(self):
        """Test encryption with unicode characters."""
        secret = "🔐 secret data with unicode: üñîçødé"
        encrypted = encrypt_value(secret)
        decrypted = decrypt_value(encrypted)
        assert decrypted == secret

    def test_encrypt_long_secret(self):
        """Test encryption of very long secret."""
        secret = "x" * 10000
        encrypted = encrypt_value(secret)
        decrypted = decrypt_value(encrypted)
        assert decrypted == secret

    def test_encrypt_special_chars(self):
        """Test encryption of special characters."""
        secret = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~"
        encrypted = encrypt_value(secret)
        decrypted = decrypt_value(encrypted)
        assert decrypted == secret


class TestTokenGeneration:
    """Unit tests for token generation utilities."""

    def test_generate_secure_token_length(self):
        """Test that generate_secure_token returns correct length string."""
        token = generate_secure_token(32)
        assert isinstance(token, str)
        assert len(token) > 0

    def test_generate_secure_token_unique(self):
        """Test that generate_secure_token produces unique values."""
        token1 = generate_secure_token(32)
        token2 = generate_secure_token(32)
        assert token1 != token2

    def test_generate_api_key_format(self):
        """Test that generate_api_key returns correct format."""
        api_key = generate_api_key()
        assert api_key.startswith("hcp_")
        assert len(api_key) > 4

    def test_generate_api_key_unique(self):
        """Test that generate_api_key produces unique values."""
        key1 = generate_api_key()
        key2 = generate_api_key()
        assert key1 != key2


class TestSettings:
    """Unit tests for application settings."""

    def test_settings_default_values(self):
        """Test that settings have expected default values."""
        settings = Settings()
        assert settings.APP_NAME == "Hosting Control Panel"
        assert settings.API_PREFIX == "/api/v1"
        assert "http://localhost:3000" in settings.CORS_ORIGINS

    def test_settings_database_default_url(self):
        """Test database URL default."""
        settings = Settings()
        assert "postgresql+asyncpg" in settings.DATABASE_URL

    def test_settings_redis_default_url(self):
        """Test Redis URL default."""
        settings = Settings()
        assert "redis://localhost:6379" in settings.REDIS_URL

    def test_settings_jwt_defaults(self):
        """Test JWT configuration defaults."""
        settings = Settings()
        assert settings.JWT_ALGORITHM == "HS256"
        assert settings.ACCESS_TOKEN_EXPIRE_MINUTES == 30
        assert settings.REFRESH_TOKEN_EXPIRE_DAYS == 7

    def test_settings_get_settings_cached(self):
        """Test that get_settings returns cached instance."""
        from hosting_control.shared.config import get_settings
        s1 = get_settings()
        s2 = get_settings()
        assert s1 is s2