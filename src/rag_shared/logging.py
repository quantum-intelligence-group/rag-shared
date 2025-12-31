"""
Simple, readable logging for RAG services.

Output format (Milvus-style):
    [2025/12/31 18:42:23.765 +00:00] [INFO] [module:42] ["Message here"] [key=value]

Usage:
    from rag_shared import setup_logging, get_logger, timed

    setup_logging()  # Call once at startup
    logger = get_logger(__name__)

    logger.info("Processing started")
    logger.info("Chunk created", extra={"chunk_id": "abc", "size": 1024})

    with timed("embed_chunks", logger):
        # ... work ...
        pass
    # Output: [timestamp] [INFO] [module:42] ["embed_chunks completed"] [duration_ms=123.4]
"""

import logging
import os
import sys
import time
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any, Dict, Generator, Optional


# Context for request-scoped fields (optional feature)
_log_context: ContextVar[Dict[str, Any]] = ContextVar("log_context", default={})


def _format_value(value: Any) -> str:
    """Format a value for bracket output."""
    if value is None:
        return "null"
    elif isinstance(value, bool):
        return str(value).lower()
    elif isinstance(value, str):
        # Quote strings with spaces or special chars
        if " " in value or '"' in value or not value:
            # Escape quotes and wrap
            return f'"{value}"'
        return value
    elif isinstance(value, (list, tuple)):
        # Format as JSON-like array
        items = ", ".join(_format_value(v) for v in value)
        return f"[{items}]"
    elif isinstance(value, dict):
        # Format as JSON-like object
        items = ", ".join(f"{k}: {_format_value(v)}" for k, v in value.items())
        return f"{{{items}}}"
    elif isinstance(value, float):
        # Round floats for readability
        if value == int(value):
            return str(int(value))
        return f"{value:.2f}"
    else:
        return str(value)


class MilvusFormatter(logging.Formatter):
    """
    Milvus-style log formatter.

    Output: [timestamp] [LEVEL] [module:line] ["message"] [key=value] ...
    """

    # Keys from LogRecord that we handle specially or should skip
    SKIP_KEYS = frozenset({
        "name", "msg", "args", "levelname", "levelno", "pathname",
        "filename", "module", "exc_info", "exc_text", "stack_info",
        "lineno", "funcName", "created", "msecs", "relativeCreated",
        "thread", "threadName", "processName", "process", "taskName",
        "message",
    })

    def format(self, record: logging.LogRecord) -> str:
        # Timestamp: [2025/12/31 18:42:23.765 +00:00]
        ts = datetime.fromtimestamp(record.created, timezone.utc)
        ms = int(ts.microsecond / 1000)
        timestamp = f"[{ts.strftime('%Y/%m/%d %H:%M:%S')}.{ms:03d} +00:00]"

        # Level: [INFO]
        level = f"[{record.levelname}]"

        # Location: [module:line]
        location = f"[{record.module}:{record.lineno}]"

        # Message: ["message text"]
        message = f'["{record.getMessage()}"]'

        # Start building output
        parts = [timestamp, level, location, message]

        # Add context fields (from log_context)
        ctx = _log_context.get({})
        for key, value in ctx.items():
            parts.append(f"[{key}={_format_value(value)}]")

        # Add extra fields from the log call
        for key, value in record.__dict__.items():
            if key not in self.SKIP_KEYS and not key.startswith("_"):
                parts.append(f"[{key}={_format_value(value)}]")

        # Add exception info if present
        if record.exc_info and record.exc_info[0] is not None:
            exc_type = record.exc_info[0].__name__
            exc_msg = str(record.exc_info[1]) if record.exc_info[1] else ""
            parts.append(f"[exception={exc_type}: {exc_msg}]")

        return " ".join(parts)


def setup_logging(level: Optional[str] = None) -> None:
    """
    Configure logging with Milvus-style readable output.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR).
               Defaults to LOG_LEVEL env var or "INFO".

    Example:
        setup_logging()  # Uses INFO or LOG_LEVEL env var
        setup_logging("DEBUG")  # Explicit debug level
    """
    level = level or os.getenv("LOG_LEVEL", "INFO")

    # Clear existing handlers
    root = logging.getLogger()
    root.handlers.clear()

    # Setup handler with Milvus formatter
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(MilvusFormatter())

    root.setLevel(getattr(logging, level.upper(), logging.INFO))
    root.addHandler(handler)

    # Quiet noisy libraries
    for name in ("urllib3", "httpx", "httpcore", "asyncio", "opentelemetry"):
        logging.getLogger(name).setLevel(logging.WARNING)


def get_logger(name: Optional[str] = None) -> logging.Logger:
    """
    Get a logger instance.

    Args:
        name: Logger name, typically __name__

    Returns:
        Logger instance
    """
    return logging.getLogger(name)


@contextmanager
def timed(
    operation: str,
    logger: Optional[logging.Logger] = None,
    **extra: Any,
) -> Generator[Dict[str, Any], None, None]:
    """
    Time an operation and log completion/failure with duration.

    Args:
        operation: Name of the operation (e.g., "embed_chunks", "parse_document")
        logger: Logger to use. If None, uses a logger named after the operation.
        **extra: Additional fields to include in the log.

    Yields:
        Dict that can be updated with additional context during the operation.

    Example:
        with timed("embed_chunks", logger, doc_id="abc"):
            result = embed(chunks)
            # Optionally add more context:
        # Logs: ["embed_chunks completed"] [duration_ms=123.4] [doc_id=abc]

        # Or capture the context dict:
        with timed("process", logger) as ctx:
            ctx["items_processed"] = 42
        # Logs: ["process completed"] [duration_ms=50.2] [items_processed=42]
    """
    log = logger or get_logger(operation)
    ctx: Dict[str, Any] = dict(extra)
    start = time.perf_counter()

    try:
        yield ctx
        duration = (time.perf_counter() - start) * 1000
        log.info(f"{operation} completed", extra={**ctx, "duration_ms": round(duration, 2)})
    except Exception as e:
        duration = (time.perf_counter() - start) * 1000
        log.error(
            f"{operation} failed",
            extra={**ctx, "duration_ms": round(duration, 2), "error": str(e)},
            exc_info=True,
        )
        raise


@contextmanager
def log_context(**fields: Any) -> Generator[None, None, None]:
    """
    Add fields to all logs within this context.

    Useful for adding request_id or other context that should appear
    in all logs during a request/operation without passing it everywhere.

    Args:
        **fields: Fields to add to all logs within this context.

    Example:
        with log_context(request_id="abc-123", user_id="user-456"):
            logger.info("Processing started")  # Includes request_id and user_id
            do_work()  # All logs inside also get these fields
            logger.info("Processing done")  # Also includes them
    """
    existing = _log_context.get({})
    merged = {**existing, **fields}
    token = _log_context.set(merged)
    try:
        yield
    finally:
        _log_context.reset(token)


def clear_log_context() -> None:
    """Clear all fields from the current log context."""
    _log_context.set({})


# =============================================================================
# Backward compatibility aliases
# =============================================================================
# These maintain compatibility with existing code that uses the old API names.
# New code should use the new names: setup_logging, timed, log_context

def configure_logging(
    service_name: Optional[str] = None,
    service_version: Optional[str] = None,
    environment: Optional[str] = None,
    log_level: Optional[str] = None,
    json_output: bool = True,
) -> None:
    """
    DEPRECATED: Use setup_logging() instead.

    This function is kept for backward compatibility.
    The service_name, service_version, environment, and json_output
    parameters are now ignored - all output uses the readable Milvus format.
    """
    setup_logging(level=log_level)


# Alias: stage -> timed
stage = timed

# Alias: RequestContext -> log_context (as a class-like wrapper)
class RequestContext:
    """
    DEPRECATED: Use log_context() instead.

    Kept for backward compatibility.
    """
    def __init__(self, **context: Any):
        self.context = context
        self._cm = None

    def __enter__(self):
        self._cm = log_context(**self.context)
        self._cm.__enter__()
        return self

    def __exit__(self, *args):
        if self._cm:
            self._cm.__exit__(*args)


# Alias: add_context -> simple function that adds to current context
def add_context(**context: Any) -> None:
    """
    DEPRECATED: Use log_context() context manager instead.

    Add fields to the current log context.
    """
    existing = _log_context.get({})
    _log_context.set({**existing, **context})


# Alias: clear_context -> clear_log_context
clear_context = clear_log_context

# Alias: request_context -> _log_context (for direct access if needed)
request_context = _log_context

# Placeholder for old formatter reference
StructuredJSONFormatter = MilvusFormatter


# =============================================================================
# Exports
# =============================================================================
__all__ = [
    # New API (preferred)
    "setup_logging",
    "get_logger",
    "timed",
    "log_context",
    "clear_log_context",
    # Backward compatibility (deprecated but functional)
    "configure_logging",
    "stage",
    "RequestContext",
    "add_context",
    "clear_context",
    "request_context",
    "StructuredJSONFormatter",
    "MilvusFormatter",
]
