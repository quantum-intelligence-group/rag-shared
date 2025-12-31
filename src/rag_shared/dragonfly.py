"""
Dragonfly/Redis Cache Client for RAG Orchestration Services

Provides a simple interface to interact with Dragonfly (Redis-compatible) cache
for storing and retrieving data payloads between workflow stages.

Features:
- Lazy connection initialization
- Automatic pickle serialization for Python objects
- TTL support for cache expiration
- Connection health checks
- Configurable via environment variables

Usage:
    from rag_shared.dragonfly import DragonflyClient, get_dragonfly_client

    # Option 1: Create client directly
    client = DragonflyClient(host="localhost", port=6379)

    # Option 2: Use factory with environment variables
    client = get_dragonfly_client()  # Uses DRAGONFLY_HOST, DRAGONFLY_PORT, DRAGONFLY_TTL

    # Store and retrieve data
    client.store("my-key", {"data": [1, 2, 3]}, ttl=3600)
    data = client.retrieve("my-key")
"""

import logging
import os
import pickle
from typing import Any, Optional

from redis import Redis
from redis.exceptions import ConnectionError, RedisError

logger = logging.getLogger(__name__)


class DragonflyClient:
    """
    Client for interacting with Dragonfly/Redis cache.

    Uses pickle serialization, so any Python object can be stored.
    Connection is lazy-initialized on first use.
    """

    def __init__(
        self,
        host: str = "localhost",
        port: int = 6379,
        default_ttl: int = 3600,
        socket_timeout: float = 5.0,
        socket_connect_timeout: float = 5.0,
        retry_on_timeout: bool = True,
        db: int = 0,
    ):
        """
        Initialize Dragonfly client.

        Args:
            host: Dragonfly/Redis host address
            port: Dragonfly/Redis port
            default_ttl: Default time-to-live in seconds (default: 1 hour)
            socket_timeout: Socket timeout in seconds
            socket_connect_timeout: Connection timeout in seconds
            retry_on_timeout: Whether to retry on timeout
            db: Database number to use
        """
        self.host = host
        self.port = port
        self.default_ttl = default_ttl
        self.socket_timeout = socket_timeout
        self.socket_connect_timeout = socket_connect_timeout
        self.retry_on_timeout = retry_on_timeout
        self.db = db
        self._client: Optional[Redis] = None

        logger.info(f"Initialized DragonflyClient: {host}:{port} (db={db})")

    @property
    def client(self) -> Redis:
        """Lazy connection to Dragonfly/Redis."""
        if self._client is None:
            self._client = Redis(
                host=self.host,
                port=self.port,
                db=self.db,
                decode_responses=False,  # We handle binary data with pickle
                socket_connect_timeout=self.socket_connect_timeout,
                socket_timeout=self.socket_timeout,
                retry_on_timeout=self.retry_on_timeout,
            )
        return self._client

    def ping(self) -> bool:
        """
        Test connection to Dragonfly/Redis.

        Returns:
            True if connection successful, False otherwise.
        """
        try:
            return self.client.ping()
        except (RedisError, ConnectionError) as e:
            logger.error(f"Dragonfly ping failed: {e}")
            return False

    def store(self, key: str, data: Any, ttl: Optional[int] = None) -> bool:
        """
        Store data in cache with optional TTL.

        Args:
            key: Cache key
            data: Python object to store (will be pickled)
            ttl: Time-to-live in seconds (uses default_ttl if not provided)

        Returns:
            True if successful, False otherwise.
        """
        try:
            ttl = ttl if ttl is not None else self.default_ttl
            serialized_data = pickle.dumps(data)

            result = self.client.setex(name=key, time=ttl, value=serialized_data)

            logger.debug(
                f"Stored data: key={key}, size={len(serialized_data)} bytes, ttl={ttl}s"
            )
            return bool(result)

        except Exception as e:
            logger.error(f"Failed to store data: key={key}, error={e}")
            return False

    def retrieve(self, key: str) -> Optional[Any]:
        """
        Retrieve data from cache.

        Args:
            key: Cache key

        Returns:
            Deserialized Python object, or None if key doesn't exist or error occurs.
        """
        try:
            serialized_data = self.client.get(key)

            if serialized_data is None:
                logger.debug(f"Key not found: {key}")
                return None

            data = pickle.loads(serialized_data)
            logger.debug(f"Retrieved data: key={key}, size={len(serialized_data)} bytes")
            return data

        except Exception as e:
            logger.error(f"Failed to retrieve data: key={key}, error={e}")
            return None

    def delete(self, key: str) -> bool:
        """
        Delete data from cache.

        Args:
            key: Cache key

        Returns:
            True if key was deleted, False otherwise.
        """
        try:
            result = self.client.delete(key)
            logger.debug(f"Deleted key: {key}, existed={bool(result)}")
            return bool(result)

        except Exception as e:
            logger.error(f"Failed to delete key: key={key}, error={e}")
            return False

    def exists(self, key: str) -> bool:
        """
        Check if key exists in cache.

        Args:
            key: Cache key

        Returns:
            True if key exists, False otherwise.
        """
        try:
            return bool(self.client.exists(key))
        except Exception as e:
            logger.error(f"Failed to check key existence: key={key}, error={e}")
            return False

    def get_ttl(self, key: str) -> Optional[int]:
        """
        Get remaining TTL for a key.

        Args:
            key: Cache key

        Returns:
            TTL in seconds, -1 if key has no expiry, -2 if key doesn't exist, None on error.
        """
        try:
            return self.client.ttl(key)
        except Exception as e:
            logger.error(f"Failed to get TTL: key={key}, error={e}")
            return None

    def set_ttl(self, key: str, ttl: int) -> bool:
        """
        Set or update TTL for an existing key.

        Args:
            key: Cache key
            ttl: New TTL in seconds

        Returns:
            True if TTL was set, False otherwise.
        """
        try:
            return bool(self.client.expire(key, ttl))
        except Exception as e:
            logger.error(f"Failed to set TTL: key={key}, error={e}")
            return False

    def keys(self, pattern: str = "*") -> list[str]:
        """
        Find keys matching pattern.

        Args:
            pattern: Glob-style pattern (default: "*" for all keys)

        Returns:
            List of matching key names.
        """
        try:
            keys = self.client.keys(pattern)
            return [k.decode() if isinstance(k, bytes) else k for k in keys]
        except Exception as e:
            logger.error(f"Failed to list keys: pattern={pattern}, error={e}")
            return []

    def close(self) -> None:
        """Close the connection to Dragonfly/Redis."""
        if self._client is not None:
            try:
                self._client.close()
                logger.info("Dragonfly connection closed")
            except Exception as e:
                logger.error(f"Error closing Dragonfly connection: {e}")
            finally:
                self._client = None

    def __enter__(self) -> "DragonflyClient":
        """Support context manager protocol."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Close connection on context exit."""
        self.close()


# Module-level singleton for convenience
_default_client: Optional[DragonflyClient] = None


def get_dragonfly_client(
    host: Optional[str] = None,
    port: Optional[int] = None,
    default_ttl: Optional[int] = None,
    singleton: bool = True,
) -> DragonflyClient:
    """
    Factory function to get a DragonflyClient instance.

    Uses environment variables for configuration with sensible defaults.

    Environment Variables:
        DRAGONFLY_HOST: Host address (default: "dragonfly" for Docker, "localhost" otherwise)
        DRAGONFLY_PORT: Port number (default: 6379)
        DRAGONFLY_TTL: Default TTL in seconds (default: 3600)

    Args:
        host: Override host (default: from env)
        port: Override port (default: from env)
        default_ttl: Override TTL (default: from env)
        singleton: If True, return a shared instance; if False, create new instance

    Returns:
        Configured DragonflyClient instance.
    """
    global _default_client

    # Resolve configuration from environment
    host = host or os.getenv("DRAGONFLY_HOST", "dragonfly")
    port = port or int(os.getenv("DRAGONFLY_PORT", "6379"))
    default_ttl = default_ttl or int(os.getenv("DRAGONFLY_TTL", "3600"))

    if singleton:
        if _default_client is None:
            _default_client = DragonflyClient(
                host=host,
                port=port,
                default_ttl=default_ttl,
            )
        return _default_client

    return DragonflyClient(host=host, port=port, default_ttl=default_ttl)


# Convenience exports
__all__ = [
    "DragonflyClient",
    "get_dragonfly_client",
]
