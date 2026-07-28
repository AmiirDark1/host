"""Redis client wrapper for caching, pub/sub, and rate limiting."""

from __future__ import annotations

import json
from typing import Any, Optional

import redis.asyncio as aioredis

from hosting_control.shared.config import get_settings

settings = get_settings()


class RedisClient:
    """Async Redis client for caching and pub/sub operations."""

    def __init__(self) -> None:
        self._redis: Optional[aioredis.Redis] = None
        self._pubsub: Optional[aioredis.client.PubSub] = None

    async def initialize(self) -> None:
        """Initialize Redis connection."""
        self._redis = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
            health_check_interval=30,
        )
        self._pubsub = self._redis.pubsub()
        await self._redis.ping()

    async def close(self) -> None:
        """Close Redis connection."""
        if self._pubsub:
            await self._pubsub.close()
        if self._redis:
            await self._redis.close()

    @property
    def client(self) -> aioredis.Redis:
        """Get the underlying Redis client."""
        if self._redis is None:
            raise RuntimeError("Redis client not initialized")
        return self._redis

    # Cache operations
    async def cache_get(self, key: str) -> Optional[str]:
        """Get a cached value."""
        return await self.client.get(key)

    async def cache_set(
        self,
        key: str,
        value: str,
        expire_seconds: int = 300,
    ) -> None:
        """Set a cached value with expiration."""
        await self.client.setex(key, expire_seconds, value)

    async def cache_delete(self, key: str) -> None:
        """Delete a cached value."""
        await self.client.delete(key)

    async def cache_get_json(self, key: str) -> Optional[Any]:
        """Get a cached JSON value."""
        value = await self.cache_get(key)
        if value:
            return json.loads(value)
        return None

    async def cache_set_json(
        self,
        key: str,
        value: Any,
        expire_seconds: int = 300,
    ) -> None:
        """Set a cached JSON value with expiration."""
        await self.cache_set(key, json.dumps(value), expire_seconds)

    # Rate limiting
    async def check_rate_limit(
        self,
        key: str,
        max_requests: int = 100,
        window_seconds: int = 60,
    ) -> tuple[bool, int]:
        """Check rate limit using sliding window counter.
        
        Returns:
            Tuple of (is_allowed, remaining_requests)
        """
        current = await self.client.incr(key)
        if current == 1:
            await self.client.expire(key, window_seconds)
        
        if current > max_requests:
            return False, 0
        
        remaining = max_requests - current
        return True, remaining

    # Pub/Sub operations
    async def publish(self, channel: str, message: Any) -> None:
        """Publish a message to a channel."""
        payload = json.dumps(message) if not isinstance(message, str) else message
        await self.client.publish(channel, payload)

    async def subscribe(self, channel: str) -> None:
        """Subscribe to a channel."""
        if self._pubsub:
            await self._pubsub.subscribe(channel)

    async def unsubscribe(self, channel: str) -> None:
        """Unsubscribe from a channel."""
        if self._pubsub:
            await self._pubsub.unsubscribe(channel)

    async def get_message(self) -> Optional[dict[str, Any]]:
        """Get a message from subscribed channels."""
        if self._pubsub:
            return await self._pubsub.get_message(ignore_subscribe_messages=True)
        return None

    # Session management
    async def create_session(
        self,
        session_id: str,
        data: dict[str, Any],
        expire_seconds: int = 3600,
    ) -> None:
        """Create a session with data."""
        await self.cache_set_json(f"session:{session_id}", data, expire_seconds)

    async def get_session(self, session_id: str) -> Optional[dict[str, Any]]:
        """Get session data."""
        return await self.cache_get_json(f"session:{session_id}")

    async def delete_session(self, session_id: str) -> None:
        """Delete a session."""
        await self.cache_delete(f"session:{session_id}")

    # Lock operations for distributed locking
    async def acquire_lock(
        self,
        lock_key: str,
        lock_value: str,
        expire_seconds: int = 30,
    ) -> bool:
        """Acquire a distributed lock."""
        return await self.client.setnx(
            f"lock:{lock_key}",
            lock_value,
        ) and await self.client.expire(f"lock:{lock_key}", expire_seconds)

    async def release_lock(self, lock_key: str, lock_value: str) -> None:
        """Release a distributed lock if we hold it."""
        # Lua script for atomic release
        release_script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        await self.client.eval(release_script, 1, f"lock:{lock_key}", lock_value)