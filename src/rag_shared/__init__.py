"""
RAG Shared Utilities

Shared utilities for RAG orchestration services including:
- Structured JSON logging with trace correlation
- OpenTelemetry observability (tracing + instrumentation)
- Dragonfly/Redis cache client

Quick Start:
    # Full observability (tracing + logging)
    from rag_shared import setup_observability
    logger = setup_observability("my-service", app)

    # Just logging (no OpenTelemetry dependency)
    from rag_shared import configure_logging, get_logger, stage
    configure_logging(service_name="my-service")
    logger = get_logger(__name__)

    with stage("process_document", doc_id="123"):
        # ... your code here ...
        pass

    # Cache client
    from rag_shared import get_dragonfly_client
    cache = get_dragonfly_client()
    cache.store("key", {"data": "value"})
"""

__version__ = "1.0.0"

# Logging utilities (no external deps required)
from .logging import (
    configure_logging,
    get_logger,
    stage,
    RequestContext,
    add_context,
    clear_context,
    request_context,
    StructuredJSONFormatter,
)

# Dragonfly/Redis cache client
from .dragonfly import (
    DragonflyClient,
    get_dragonfly_client,
)

# Observability (requires opentelemetry - install with rag-shared[observability])
# These imports will work but some features require the optional dependencies
from .observability import (
    setup_observability,
    rag_observability,
    RagObservability,
)


__all__ = [
    # Version
    "__version__",
    # Logging
    "configure_logging",
    "get_logger",
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
