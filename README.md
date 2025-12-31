# rag-shared

Shared utilities for RAG orchestration services.

## Features

- **Structured JSON Logging** - Consistent log format for Loki/Grafana with request context and operation tracking
- **OpenTelemetry Observability** - Distributed tracing with OTLP export and auto-instrumentation
- **Dragonfly/Redis Client** - Simple cache client for inter-service data sharing

## Installation

```bash
# Basic (logging + dragonfly client)
pip install git+https://github.com/yourorg/rag-shared.git

# With OpenTelemetry observability
pip install "rag-shared[observability] @ git+https://github.com/yourorg/rag-shared.git"

# All extras
pip install "rag-shared[all] @ git+https://github.com/yourorg/rag-shared.git"

# Pin to a specific version/tag
pip install "rag-shared @ git+https://github.com/yourorg/rag-shared.git@v1.0.0"
```

## Quick Start

### Full Observability (Tracing + Logging)

```python
from fastapi import FastAPI
from rag_shared import setup_observability

app = FastAPI()
logger = setup_observability("my-service", app)

@app.get("/")
async def root():
    logger.info("Processing request", extra={"endpoint": "/"})
    return {"status": "ok"}
```

### Just Logging (No OpenTelemetry)

```python
from rag_shared import configure_logging, get_logger, stage

# Configure once at startup
configure_logging(service_name="my-service")

# Get a logger
logger = get_logger(__name__)
logger.info("Service started")

# Track operations with timing
with stage("process_document", document_id="doc-123"):
    # ... do work ...
    pass  # Logs start, completion, and duration automatically
```

### Cache Client

```python
from rag_shared import get_dragonfly_client

# Uses DRAGONFLY_HOST, DRAGONFLY_PORT, DRAGONFLY_TTL env vars
cache = get_dragonfly_client()

# Store any Python object
cache.store("my-key", {"data": [1, 2, 3]}, ttl=3600)

# Retrieve it later
data = cache.retrieve("my-key")
```

## Environment Variables

### Logging & Observability

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVICE_NAME` | `unknown-service` | Service identifier |
| `SERVICE_VERSION` | `1.0.0` | Service version |
| `ENVIRONMENT` | `development` | Deployment environment |
| `LOG_LEVEL` | `INFO` | Log level (DEBUG, INFO, WARNING, ERROR) |
| `TRACING_ENABLED` | `true` | Enable OpenTelemetry tracing |
| `STRUCTURED_LOGGING_ENABLED` | `true` | Enable JSON log formatting |
| `OTLP_ENDPOINT` | `http://localhost:4317` | OpenTelemetry collector endpoint |

### Dragonfly/Redis

| Variable | Default | Description |
|----------|---------|-------------|
| `DRAGONFLY_HOST` | `dragonfly` | Cache host |
| `DRAGONFLY_PORT` | `6379` | Cache port |
| `DRAGONFLY_TTL` | `3600` | Default TTL in seconds |

## Log Format

All logs are JSON-formatted for easy parsing:

```json
{
  "timestamp": "2024-01-15T10:30:00.000000+00:00",
  "service": "my-service",
  "version": "1.0.0",
  "environment": "development",
  "level": "INFO",
  "logger": "my_module",
  "message": "Processing request",
  "module": "my_module",
  "function": "my_function",
  "line": 42,
  "trace_id": "abc123...",
  "span_id": "def456..."
}
```

## Operation Tracking with `stage()`

The `stage()` context manager automatically logs operation start, completion (or failure), and duration:

```python
from rag_shared import stage

with stage("embed_chunks", document_id="doc-123", chunk_count=42):
    # ... embedding logic ...
    pass
```

Output:
```json
{"message": "embed_chunks_started", "operation": "embed_chunks", "document_id": "doc-123", "chunk_count": 42}
{"message": "embed_chunks_completed", "operation": "embed_chunks", "document_id": "doc-123", "chunk_count": 42, "duration_ms": 1234.56}
```

## Request Context

Add context that persists across all logs in a request:

```python
from rag_shared import RequestContext, get_logger

logger = get_logger(__name__)

with RequestContext(request_id="req-123", user_id="user-456"):
    logger.info("Step 1")  # Includes request_id and user_id
    logger.info("Step 2")  # Also includes request_id and user_id
```

## Migration from Service-Local Logging

Replace your service's local logging setup:

```python
# Before (service-local)
from app.logging import get_logger, stage
configure_logging()

# After (shared package)
from rag_shared import configure_logging, get_logger, stage
configure_logging(service_name="my-service")
```

## Development

```bash
# Clone and install in development mode
git clone https://github.com/yourorg/rag-shared.git
cd rag-shared
pip install -e ".[dev,all]"

# Run tests
pytest

# Format code
black src/
ruff check src/ --fix
```
