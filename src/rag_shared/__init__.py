"""
RAG Shared Utilities

Shared utilities for RAG orchestration services:
- Simple, readable logging (Milvus-style format)
- OpenTelemetry observability (optional)
- Dragonfly/Redis cache client

Quick Start:
    from rag_shared import setup_logging, get_logger, timed

    setup_logging()
    logger = get_logger(__name__)

    logger.info("Processing started")

    with timed("embed_chunks", logger):
        # ... your code here ...
        pass

Output:
    [2025/12/31 18:42:23.765 +00:00] [INFO] [main:12] ["Processing started"]
    [2025/12/31 18:42:24.100 +00:00] [INFO] [main:15] ["embed_chunks completed"] [duration_ms=315.2]
"""

__version__ = "2.0.0"

# =============================================================================
# Logging (no external deps required)
# =============================================================================
from .logging import (
    # New API (preferred)
    setup_logging,
    get_logger,
    timed,
    log_context,
    clear_log_context,
    MilvusFormatter,
    # Backward compatibility
    configure_logging,
    stage,
    RequestContext,
    add_context,
    clear_context,
    request_context,
    StructuredJSONFormatter,
)

# =============================================================================
# Dragonfly/Redis cache client
# =============================================================================
from .dragonfly import (
    DragonflyClient,
    get_dragonfly_client,
)

# =============================================================================
# Observability (requires opentelemetry - install with rag-shared[observability])
# =============================================================================
from .observability import (
    setup_observability,
    rag_observability,
    RagObservability,
)


__all__ = [
    # Version
    "__version__",
    # Logging - New API
    "setup_logging",
    "get_logger",
    "timed",
    "log_context",
    "clear_log_context",
    "MilvusFormatter",
    # Logging - Backward compatibility
    "configure_logging",
    "stage",
    "RequestContext",
    "add_context",
    "clear_context",
    "request_context",
    "StructuredJSONFormatter",
    # Dragonfly
    "DragonflyClient",
    "get_dragonfly_client",
    # Observability
    "setup_observability",
    "rag_observability",
    "RagObservability",
]
