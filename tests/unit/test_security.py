import pytest
import pytest_asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, Mock, patch

from hosting_control.shared.security.hashing import hash_password, verify_password
from hosting_control.shared.security.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
    JWTError,
)
from hosting_control.shared.security.encryption import (
    encrypt_secret,
    decrypt_secret,
    EncryptionError,
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

    def setup_method(self):
        self.user_id = "550e8400-e29b-41d4-a716-446655440000"
        self.secret_key = "test-secret-key-for-testing"
        self.algorithm = "HS256"

    def test_create_access_token_valid(self):
        """Test that create_access_token returns a valid JWT string."""
        token = create_access_token(
            user_id=self.user_id,
            secret_key=self.secret_key,
            algorithm=self.algorithm,
        )
        assert isinstance(token, str)
        assert len(token.split(".")) == 3  # JWT has 3 parts

    def test_create_access_token_with_expiry(self):
        """Test that access token contains correct expiry."""
        token = create_access_token(
            user_id=self.user_id,
            secret_key=self.secret_key,
            algorithm=self.algorithm,
            expires_delta=timedelta(hours=1),
        )
        payload = decode_token(token, self.secret_key, self.algorithm)
        assert "exp" in payload
        assert "sub" in payload
        assert payload["sub"] == self.user_id
        assert payload["type"] == "access"

    def test_create_refresh_token_valid(self):
        """Test that create_refresh_token returns a valid JWT string."""
        token = create_refresh_token(
            user_id=self.user_id,
            secret_key=self.secret_key,
            algorithm=self.algorithm,
        )
        assert isinstance(token, str)
        assert len(token.split(".")) == 3

    def test_create_refresh_token_type(self):
        """Test that refresh token has correct type claim."""
        token = create_refresh_token(
            user_id=self.user_id,
            secret_key=self.secret_key,
            algorithm=self.algorithm,
        )
        payload = decode_token(token, self.secret_key, self.algorithm)
        assert payload["type"] == "refresh"
        assert payload["sub"] == self.user_id

    def test_decode_valid_token(self):
        """Test that decode_token returns correct payload for valid token."""
        token = create_access_token(
            user_id=self.user_id,
            secret_key=self.secret_key,
            algorithm=self.algorithm,
        )
        payload = decode_token(token, self.secret_key, self.algorithm)
        assert payload["sub"] == self.user_id
        assert payload["type"] == "access"

    def test_decode_expired_token(self):
        """Test that decode_token raises JWTError for expired token."""
        token = create_access_token(
            user_id=self.user_id,
            secret_key=self.secret_key,
            algorithm=self.algorithm,
            expires_delta=timedelta(seconds=-1),  # Expired
        )
        with pytest.raises(JWTError):
            decode_token(token, self.secret_key, self.algorithm)

    def test_decode_invalid_signature(self):
        """Test that decode_token raises JWTError for invalid signature."""
        token = create_access_token(
            user_id=self.user_id,
            secret_key=self.secret_key,
            algorithm=self.algorithm,
        )
        with pytest.raises(JWTError):
            decode_token(token, "wrong-secret-key", self.algorithm)

    def test_decode_malformed_token(self):
        """Test that decode_token raises JWTError for malformed token."""
        with pytest.raises(JWTError):
            decode_token("invalid.token.here", self.secret_key, self.algorithm)

    def test_decode_empty_token(self):
        """Test that decode_token raises JWTError for empty token."""
        with pytest.raises(JWTError):
            decode_token("", self.secret_key, self.algorithm)

    def test_access_token_expiry_duration(self):
        """Test that access token has short expiry (default 30 min)."""
        token = create_access_token(
            user_id=self.user_id,
            secret_key=self.secret_key,
            algorithm=self.algorithm,
        )
        payload = decode_token(token, self.secret_key, self.algorithm)
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        now = datetime.now(timezone.utc)
        # Should expire within 60 minutes
        assert exp - now < timedelta(minutes=60)

    def test_refresh_token_long_expiry(self):
        """Test that refresh token has longer expiry (default 7 days)."""
        token = create_refresh_token(
            user_id=self.user_id,
            secret_key=self.secret_key,
            algorithm=self.algorithm,
        )
        payload = decode_token(token, self.secret_key, self.algorithm)
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        now = datetime.now(timezone.utc)
        # Should expire within 8 days but more than 1 hour
        assert timedelta(hours=1) < exp - now < timedelta(days=8)


class TestEncryption:
    """Unit tests for secret encryption/decryption."""

    def setup_method(self):
        self.key = "test-encryption-key-32bytes!!"  # 32 bytes for AES-256
        self.secret = "my-super-secret-password-123!"

    def test_encrypt_decrypt_roundtrip(self):
        """Test that decrypted value matches original encrypted value."""
        encrypted = encrypt_secret(self.secret, self.key)
        decrypted = decrypt_secret(encrypted, self.key)
        assert decrypted == self.secret

    def test_encrypted_value_differs(self):
        """Test that encrypted value differs from original."""
        encrypted = encrypt_secret(self.secret, self.key)
        assert encrypted != self.secret
        assert isinstance(encrypted, str)

    def test_encrypt_different_ciphertexts(self):
        """Test that same value produces different ciphertexts each time (IV/nonce)."""
        encrypted1 = encrypt_secret(self.secret, self.key)
        encrypted2 = encrypt_secret(self.secret, self.key)
        assert encrypted1 != encrypted2

    def test_decrypt_wrong_key(self):
        """Test that decrypting with wrong key raises EncryptionError."""
        encrypted = encrypt_secret(self.secret, self.key)
        wrong_key = "wrong-key-that-is-32-bytes-lo!"  # 32 bytes
        with pytest.raises(EncryptionError):
            decrypt_secret(encrypted, wrong_key)

    def test_decrypt_invalid_data(self):
        """Test that decrypting invalid data raises EncryptionError."""
        with pytest.raises(EncryptionError):
            decrypt_secret("invalid-base64-data", self.key)

    def test_encrypt_empty_string(self):
        """Test that encrypting empty string works."""
        encrypted = encrypt_secret("", self.key)
        decrypted = decrypt_secret(encrypted, self.key)
        assert decrypted == ""

    def test_encrypt_unicode(self):
        """Test encryption with unicode characters."""
        secret = "🔐 secret data with unicode: üñîçødé"
        encrypted = encrypt_secret(secret, self.key)
        decrypted = decrypt_secret(encrypted, self.key)
        assert decrypted == secret

    def test_encrypt_long_secret(self):
        """Test encryption of very long secret."""
        secret = "x" * 10000
        encrypted = encrypt_secret(secret, self.key)
        decrypted = decrypt_secret(encrypted, self.key)
        assert decrypted == secret

    def test_encrypt_special_chars(self):
        """Test encryption of special characters."""
        secret = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~"
        encrypted = encrypt_secret(secret, self.key)
        decrypted = decrypt_secret(encrypted, self.key)
        assert decrypted == secret


class TestSettings:
    """Unit tests for application settings."""

    def test_settings_default_values(self):
        """Test that settings have expected default values."""
        settings = Settings()
        assert settings.app_name == "Hosting Control Panel"
        assert settings.api_v1_prefix == "/api/v1"
        assert settings.cors_origins == ["*"]

    def test_settings_database_url(self):
        """Test database URL construction."""
        settings = Settings(
            database_host="test_host",
            database_port=5432,
            database_name="test_db",
            database_user="test_user",
            database_password="test_pass",
        )
        assert "test_host" in settings.database_url
        assert "test_db" in settings.database_url
        assert "test_user" in settings.database_url

    def test_settings_redis_url(self):
        """Test Redis URL construction."""
        settings = Settings(
            redis_host="test_redis",
            redis_port=6379,
            redis_db=0,
        )
        assert "test_redis" in settings.redis_url
        assert "6379" in settings.redis_url