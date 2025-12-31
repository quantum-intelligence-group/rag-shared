# rag-shared

Shared utilities for RAG orchestration services.

## Features

- **Readable Logging** - Milvus-style format that's easy to read in terminals and Grafana
- **OpenTelemetry Observability** - Distributed tracing with OTLP export (optional)
- **Dragonfly/Redis Client** - Cache client for inter-service data sharing

## Installation

```bash
# Basic (logging + dragonfly client)
pip install git+https://github.com/quantum-intelligence-group/rag-shared.git

# With OpenTelemetry observability
pip install "rag-shared[observability] @ git+https://github.com/quantum-intelligence-group/rag-shared.git"
```

## Quick Start

### Logging

```python
from rag_shared import setup_logging, get_logger, timed

# Setup once at startup
setup_logging()

# Get logger
logger = get_logger(__name__)

# Log messages
logger.info("Processing started")
logger.info("Chunk created", extra={"chunk_id": "abc", "size": 1024})

# Time operations
with timed("embed_chunks", logger, doc_id="doc-123"):
    # ... work ...
    pass
```

**Output:**
```
[2025/12/31 18:42:23.765 +00:00] [INFO] [main:12] ["Processing started"]
[2025/12/31 18:42:23.780 +00:00] [INFO] [main:15] ["Chunk created"] [chunk_id=abc] [size=1024]
[2025/12/31 18:42:24.100 +00:00] [INFO] [main:18] ["embed_chunks completed"] [duration_ms=315.2] [doc_id=doc-123]
```

### With OpenTelemetry Tracing

```python
from fastapi import FastAPI
from rag_shared import setup_observability

app = FastAPI()
logger = setup_observability("my-service", app)

@app.get("/")
async def root():
    logger.info("Processing request")
    return {"status": "ok"}
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

## API Reference

### Logging

| Function | Description |
|----------|-------------|
| `setup_logging(level="INFO")` | Configure logging (call once at startup) |
| `get_logger(name)` | Get a logger instance |
| `timed(operation, logger, **extra)` | Context manager that logs completion with duration |
| `log_context(**fields)` | Add fields to all logs within a context |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `INFO` | Log level (DEBUG, INFO, WARNING, ERROR) |
| `DRAGONFLY_HOST` | `dragonfly` | Cache host |
| `DRAGONFLY_PORT` | `6379` | Cache port |
| `DRAGONFLY_TTL` | `3600` | Default TTL in seconds |
| `OTLP_ENDPOINT` | `http://localhost:4317` | OpenTelemetry collector (when using observability) |
| `TRACING_ENABLED` | `true` | Enable/disable tracing |

## Log Format

Logs use a Milvus-style bracket format that's easy to read:

```
[timestamp] [LEVEL] [module:line] ["message"] [key=value] ...
```

Example:
```
[2025/12/31 18:42:23.765 +00:00] [INFO] [chunking:42] ["Processing document"] [doc_id=abc-123]
[2025/12/31 18:42:24.100 +00:00] [INFO] [chunking:50] ["embed_chunks completed"] [duration_ms=315.2]
[2025/12/31 18:42:24.200 +00:00] [ERROR] [chunking:55] ["Failed to process"] [error=Connection timeout]
```

## Request Context

Add fields to all logs within a request without passing them everywhere:

```python
from rag_shared import log_context, get_logger

logger = get_logger(__name__)

with log_context(request_id="req-123", user_id="user-456"):
    logger.info("Step 1")  # Includes request_id and user_id
    do_work()              # All logs inside also get these fields
    logger.info("Step 2")  # Also includes them
```

## Migration from v1.x

The API is backward compatible. Old code will continue to work:

```python
# Old API (still works)
from rag_shared import configure_logging, stage
configure_logging(service_name="my-service")
with stage("operation"):
    pass

# New API (preferred)
from rag_shared import setup_logging, timed
setup_logging()
with timed("operation"):
    pass
```

The main change is the log format: JSON is replaced with readable Milvus-style brackets.
