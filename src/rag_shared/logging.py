"""
Unified Structured Logging for RAG Orchestration Services

Consolidates logging patterns from across all services into a single module.
Provides JSON-formatted logs with request context and operation tracking.

Features:
- JSON structured logging for easy parsing by Loki/Grafana
- Request-scoped context via ContextVars (async-safe)
- Operation tracking with duration metrics via `stage()` context manager
- Optional OpenTelemetry trace correlation (when observability module is used)

Usage:
    from rag_shared.logging import configure_logging, get_logger, stage

    # Configure once at startup
    configure_logging(service_name="my-service", log_level="INFO")

    # Get logger
    logger = get_logger(__name__)
    logger.info("Something happened", extra={"user_id": "123"})

    # Track operations with timing
    with stage("process_document", document_id="doc-123"):
        # ... do work ...
        pass  # Automatically logs start, completion/failure, and duration
"""

import json
import logging
import logging.config
import os
import sys
import time
import traceback
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any, Dict, Generator, Optional

# Context variable for request-scoped data (async-safe)
request_context: ContextVar[Dict[str, Any]] = ContextVar("request_context", default={})


class StructuredJSONFormatter(logging.Formatter):
    """
    JSON formatter that produces structured logs for Loki/Grafana.

    Includes:
    - Service metadata (name, version, environment)
    - Request context from ContextVar
    - OpenTelemetry trace correlation (if available)
    - Exception details with traceback
    """

    def __init__(
        self,
        service_name: str = "unknown-service",
        service_version: str = "1.0.0",
        environment: str = "development",
    ):
        super().__init__()
        self.service_name = service_name
        self.service_version = service_version
        self.environment = environment

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON with all context."""

        # Base log structure
        log_entry: Dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
            "service": self.service_name,
            "version": self.service_version,
            "environment": self.environment,
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add request context from ContextVar
        context = request_context.get({})
        if context:
            log_entry["context"] = context

        # Add OpenTelemetry trace correlation if available
        try:
            from opentelemetry import trace

            current_span = trace.get_current_span()
            if current_span and current_span.is_recording():
                span_context = current_span.get_span_context()
                log_entry["trace_id"] = format(span_context.trace_id, "032x")
                log_entry["span_id"] = format(span_context.span_id, "016x")
                log_entry["trace_flags"] = span_context.trace_flags
        except ImportError:
            pass  # OpenTelemetry not installed

        # Add exception information if present
        if record.exc_info and record.exc_info[0] is not None:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": traceback.format_exception(*record.exc_info),
            }

        # Add extra fields from record (user-provided extras)
        skip_keys = {
            "name", "msg", "args", "levelname", "levelno", "pathname",
            "filename", "module", "exc_info", "exc_text", "stack_info",
            "lineno", "funcName", "created", "msecs", "relativeCreated",
            "thread", "threadName", "processName", "process", "getMessage",
            "message", "taskName",
        }
        for key, value in record.__dict__.items():
            if key not in skip_keys and not key.startswith("_"):
                log_entry[key] = value

        return json.dumps(log_entry, ensure_ascii=False, separators=(",", ":"), default=str)


def configure_logging(
    service_name: Optional[str] = None,
    service_version: Optional[str] = None,
    environment: Optional[str] = None,
    log_level: Optional[str] = None,
    json_output: bool = True,
) -> None:
    """
    Configure structured logging for the service.

    Args:
        service_name: Name of the service (default: SERVICE_NAME env var or "unknown-service")
        service_version: Version string (default: SERVICE_VERSION env var or "1.0.0")
        environment: Environment name (default: ENVIRONMENT env var or "development")
        log_level: Log level (default: LOG_LEVEL env var or "INFO")
        json_output: If True, use JSON formatting; if False, use standard format
    """
    # Resolve from environment variables with fallbacks
    service_name = service_name or os.getenv("SERVICE_NAME", "unknown-service")
    service_version = service_version or os.getenv("SERVICE_VERSION", "1.0.0")
    environment = environment or os.getenv("ENVIRONMENT", "development")
    log_level = log_level or os.getenv("LOG_LEVEL", "INFO")

    # Remove existing handlers from root logger
    root_logger = logging.getLogger()
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Create handler with appropriate formatter
    handler = logging.StreamHandler(sys.stdout)

    if json_output:
        formatter = StructuredJSONFormatter(
            service_name=service_name,
            service_version=service_version,
            environment=environment,
        )
    else:
        formatter = logging.Formatter(
            fmt="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
        )

    handler.setFormatter(formatter)

    # Configure root logger
    root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    root_logger.addHandler(handler)

    # Quiet noisy loggers
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


def get_logger(name: Optional[str] = None) -> logging.Logger:
    """
    Get a logger instance.

    Args:
        name: Logger name (typically __name__). If None, returns root logger.

    Returns:
        Configured logger instance.
    """
    return logging.getLogger(name)


class RequestContext:
    """
    Context manager for request-scoped logging context.

    Any logs emitted within this context will include the provided fields.
    Async-safe via ContextVar.

    Usage:
        with RequestContext(request_id="abc-123", user_id="user-456"):
            logger.info("Processing request")  # Includes request_id and user_id
    """

    def __init__(self, **context: Any):
        self.context = context
        self._token = None

    def __enter__(self) -> "RequestContext":
        # Merge with existing context
        existing = request_context.get({})
        merged = {**existing, **self.context}
        self._token = request_context.set(merged)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        if self._token is not None:
            request_context.reset(self._token)


@contextmanager
def stage(
    operation: str,
    logger: Optional[logging.Logger] = None,
    log_start: bool = True,
    **context: Any,
) -> Generator[Dict[str, Any], None, None]:
    """
    Context manager for tracking operation stages with timing.

    Automatically logs operation start (optional), completion, and failure
    with duration metrics. Perfect for tracing pipeline stages.

    Args:
        operation: Name of the operation/stage (e.g., "parse_document", "embed_chunks")
        logger: Logger to use. If None, creates one named "stage.{operation}"
        log_start: Whether to log when the stage starts (default: True)
        **context: Additional context fields to include in logs

    Yields:
        Dict that can be updated with additional context during the operation.

    Usage:
        with stage("process_document", document_id="doc-123") as ctx:
            # ... do work ...
            ctx["chunks_created"] = 42  # Add more context
        # Automatically logs completion with duration_ms

    Example output:
        {"message": "process_document_started", "operation": "process_document", "document_id": "doc-123"}
        {"message": "process_document_completed", "operation": "process_document", "document_id": "doc-123", "duration_ms": 1234.5}
    """
    if logger is None:
        logger = get_logger(f"stage.{operation}")

    start_time = time.perf_counter()
    stage_context: Dict[str, Any] = {"operation": operation, **context}

    if log_start:
        logger.info(f"{operation}_started", extra=stage_context)

    try:
        yield stage_context
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.info(
            f"{operation}_completed",
            extra={**stage_context, "duration_ms": round(duration_ms, 2)},
        )
    except Exception as e:
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.error(
            f"{operation}_failed",
            extra={
                **stage_context,
                "duration_ms": round(duration_ms, 2),
                "error": str(e),
                "error_type": type(e).__name__,
            },
        )
        raise


def add_context(**context: Any) -> None:
    """
    Add fields to the current request context.

    Useful for adding context mid-request without a context manager.

    Args:
        **context: Fields to add to the current context.
    """
    existing = request_context.get({})
    merged = {**existing, **context}
    request_context.set(merged)


def clear_context() -> None:
    """Clear the current request context."""
    request_context.set({})


# Convenience exports
__all__ = [
    "configure_logging",
    "get_logger",
    "stage",
    "RequestContext",
    "add_context",
    "clear_context",
    "request_context",
    "StructuredJSONFormatter",
]
