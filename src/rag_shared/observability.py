"""
OpenTelemetry Observability for RAG Orchestration Services

Provides complete observability setup with a single function call:
- Distributed tracing via OpenTelemetry with OTLP export
- Structured JSON logging with trace correlation
- Auto-instrumentation for FastAPI, Flask, and HTTP clients

This module integrates with the logging module to provide trace IDs in logs.

Usage:
    from rag_shared.observability import setup_observability

    # FastAPI
    app = FastAPI()
    logger = setup_observability("my-service", app)

    # Or without an app
    logger = setup_observability("my-service")

Environment Variables:
    SERVICE_NAME: Service identifier (required or passed as argument)
    SERVICE_VERSION: Service version (default: "1.0.0")
    ENVIRONMENT: Deployment environment (default: "development")
    OTLP_ENDPOINT: OpenTelemetry collector endpoint (default: "http://localhost:4317")
    TRACING_ENABLED: Enable/disable tracing (default: "true")
    STRUCTURED_LOGGING_ENABLED: Enable/disable structured logging (default: "true")
    LOG_LEVEL: Logging level (default: "INFO")
"""

import json
import logging
import os
import sys
from typing import Any, Optional

# Conditional OpenTelemetry imports with graceful fallbacks
_OTEL_AVAILABLE = False
try:
    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.semconv.resource import ResourceAttributes

    _OTEL_AVAILABLE = True
except ImportError:
    trace = None
    TracerProvider = None

# Auto-instrumentation imports (all optional)
try:
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
except ImportError:
    FastAPIInstrumentor = None

try:
    from opentelemetry.instrumentation.flask import FlaskInstrumentor
except ImportError:
    FlaskInstrumentor = None

try:
    from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
except ImportError:
    HTTPXClientInstrumentor = None

try:
    from opentelemetry.instrumentation.requests import RequestsInstrumentor
except ImportError:
    RequestsInstrumentor = None

try:
    from opentelemetry.instrumentation.logging import LoggingInstrumentor
except ImportError:
    LoggingInstrumentor = None

# Import our logging module
from .logging import setup_logging, get_logger


class RagObservability:
    """
    Combined tracing and structured logging for RAG services.

    Singleton pattern ensures only one initialization per process.
    """

    _instance: Optional["RagObservability"] = None
    _initialized: bool = False

    def __new__(cls) -> "RagObservability":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if RagObservability._initialized:
            return

        # Configuration from environment
        self.service_name = os.getenv("SERVICE_NAME", "unknown-service")
        self.service_version = os.getenv("SERVICE_VERSION", "1.0.0")
        self.environment = os.getenv("ENVIRONMENT", "development")

        # Observability settings
        self.otlp_endpoint = os.getenv("OTLP_ENDPOINT", "http://localhost:4317")
        self.tracing_enabled = os.getenv("TRACING_ENABLED", "true").lower() == "true"
        self.structured_logging_enabled = (
            os.getenv("STRUCTURED_LOGGING_ENABLED", "true").lower() == "true"
        )
        self.log_level = os.getenv("LOG_LEVEL", "INFO").upper()

        RagObservability._initialized = True

    def setup_tracing(self, service_name: str) -> Optional[Any]:
        """
        Initialize OpenTelemetry tracing.

        Args:
            service_name: Name of the service for trace attribution.

        Returns:
            TracerProvider if successful, None otherwise.
        """
        if not self.tracing_enabled:
            return None

        if not _OTEL_AVAILABLE:
            print("Warning: OpenTelemetry not installed. Install with: pip install rag-shared[observability]")
            return None

        # Create resource with service information
        resource = Resource.create(
            {
                ResourceAttributes.SERVICE_NAME: service_name,
                ResourceAttributes.SERVICE_VERSION: self.service_version,
                ResourceAttributes.DEPLOYMENT_ENVIRONMENT: self.environment,
                "service.namespace": "rag-orchestration",
                "telemetry.sdk.name": "opentelemetry",
                "telemetry.sdk.language": "python",
            }
        )

        # Configure tracer provider
        provider = TracerProvider(resource=resource)
        trace.set_tracer_provider(provider)

        # Configure OTLP exporter
        try:
            otlp_exporter = OTLPSpanExporter(
                endpoint=self.otlp_endpoint,
                insecure=True,
            )
            span_processor = BatchSpanProcessor(otlp_exporter)
            provider.add_span_processor(span_processor)

            print(f"Tracing initialized for {service_name} -> {self.otlp_endpoint}")
        except Exception as e:
            print(f"Warning: Failed to setup OTLP exporter: {e}")

        return provider

    def init_logging(self, service_name: str) -> None:
        """
        Initialize logging with Milvus-style format.

        Args:
            service_name: Name of the service (for log messages).
        """
        if not self.structured_logging_enabled:
            return

        # Use the logging module
        setup_logging(level=self.log_level)

        # Instrument logging to add trace correlation automatically
        if self.tracing_enabled and LoggingInstrumentor is not None:
            try:
                LoggingInstrumentor().instrument(set_logging_format=False)
            except Exception as e:
                print(f"Warning: Failed to instrument logging: {e}")

        print(f"Logging initialized for {service_name} (level: {self.log_level})")

    def instrument_fastapi(self, app: Any) -> None:
        """
        Auto-instrument FastAPI application.

        Args:
            app: FastAPI application instance.
        """
        if not self.tracing_enabled or FastAPIInstrumentor is None:
            return

        try:
            FastAPIInstrumentor.instrument_app(
                app,
                excluded_urls="/health,/healthz,/ready,/metrics,/docs,/openapi.json",
                tracer_provider=trace.get_tracer_provider() if trace else None,
            )
            print("FastAPI auto-instrumentation enabled")
        except Exception as e:
            print(f"Warning: Failed to instrument FastAPI: {e}")

    def instrument_flask(self, app: Any) -> None:
        """
        Auto-instrument Flask application.

        Args:
            app: Flask application instance.
        """
        if not self.tracing_enabled or FlaskInstrumentor is None:
            return

        try:
            FlaskInstrumentor().instrument_app(
                app,
                excluded_urls="/health,/healthz,/ready,/metrics",
                tracer_provider=trace.get_tracer_provider() if trace else None,
            )
            print("Flask auto-instrumentation enabled")
        except Exception as e:
            print(f"Warning: Failed to instrument Flask: {e}")

    def instrument_http_clients(self) -> None:
        """Auto-instrument HTTP clients (requests, httpx)."""
        if not self.tracing_enabled:
            return

        # Instrument requests library
        if RequestsInstrumentor is not None:
            try:
                RequestsInstrumentor().instrument(
                    tracer_provider=trace.get_tracer_provider() if trace else None
                )
            except Exception:
                pass  # Already instrumented or not available

        # Instrument httpx library
        if HTTPXClientInstrumentor is not None:
            try:
                HTTPXClientInstrumentor().instrument(
                    tracer_provider=trace.get_tracer_provider() if trace else None
                )
            except Exception:
                pass  # Already instrumented or not available

        print("HTTP client auto-instrumentation enabled")

    def get_tracer(self, name: str) -> Any:
        """
        Get a tracer for manual instrumentation.

        Args:
            name: Tracer name (typically module __name__).

        Returns:
            OpenTelemetry tracer instance.
        """
        if trace is None:
            return None
        return trace.get_tracer(name)

    def get_logger(self, name: str) -> logging.Logger:
        """
        Get a logger for the service.

        Args:
            name: Logger name (typically module __name__).

        Returns:
            Configured logger instance.
        """
        return get_logger(name)


# Global singleton instance
rag_observability = RagObservability()


# ──────────────────────────────────────────────────────────────────────────
# Operational event emitter (relay-compatible JSON)
#
# The relay parses each stdout line as JSON to extract `event`; the readable
# MilvusFormatter logs are bracket-format and are dropped by the relay. These
# helpers emit single-line JSON operational events so handler lifecycle /
# dependency checks / heartbeat reach QIG Loki — the Python equivalent of the
# Rust services' observability floor. They are intentionally separate from the
# human-readable logger.
# ──────────────────────────────────────────────────────────────────────────

def emit_event(event: str, level: str = "info", **fields: Any) -> None:
    """Write one relay-forwardable JSON operational event to stdout.

    `event` must be an allow-listed name (handler_*, service_*, dependency_*,
    stage_*, job_*, heartbeat). Never pass content fields — counts/ids only.
    """
    record = {
        "event": event,
        "level": level,
        "service": os.getenv("SERVICE_NAME", rag_observability.service_name),
    }
    for key, value in fields.items():
        if value is not None:
            record[key] = value
    try:
        sys.stdout.write(json.dumps(record) + "\n")
        sys.stdout.flush()
    except Exception:
        # Telemetry must never break the request path.
        pass


async def _heartbeat_loop(service_name: str, interval_secs: int = 60) -> None:
    import asyncio

    # BL-212 — stamp the deployed image tag on every heartbeat, matching the Rust
    # services. SERVICE_VERSION is set to ${IMAGE_TAG} by the compose observability
    # anchor, so this is the tag the running image was pulled with — no separate
    # version to maintain. Default "unknown" (not a fake "1.0.0") when unset; env
    # is fixed for the process lifetime, so read once.
    service_version = os.getenv("SERVICE_VERSION") or "unknown"
    while True:
        await asyncio.sleep(interval_secs)
        emit_event("heartbeat", service=service_name, service_version=service_version)


def _wire_fastapi_floor(app: Any, service_name: str) -> None:
    """Add the observability floor to a FastAPI/Starlette app: handler-lifecycle
    logging middleware, service_ready/service_shutdown lifecycle events, and a
    60s liveness heartbeat. All emitted as JSON via emit_event."""
    import asyncio
    import time as _time

    skip_paths = {
        "/health", "/health/live", "/health/ready", "/ready", "/readyz",
        "/livez", "/metrics", "/docs", "/openapi.json",
    }

    @app.middleware("http")
    async def _handler_lifecycle(request, call_next):
        path = request.url.path
        method = request.method
        request_id = request.headers.get("x-request-id", "")
        logged = path not in skip_paths
        start = _time.perf_counter()
        if logged:
            emit_event("handler_entry", method=method, path=path, request_id=request_id)
        response = await call_next(request)
        if logged:
            duration_ms = round((_time.perf_counter() - start) * 1000)
            sc = response.status_code
            if sc >= 500:
                ev, lvl = "handler_error", "error"
            elif sc == 404:
                ev, lvl = "handler_not_found", "warn"
            elif sc == 409:
                ev, lvl = "handler_conflict", "warn"
            elif sc >= 400:
                ev, lvl = "handler_validation_error", "warn"
            else:
                ev, lvl = "handler_success", "info"
            emit_event(ev, level=lvl, method=method, path=path,
                       status_code=sc, duration_ms=duration_ms, request_id=request_id)
        return response

    # Wrap the app's existing lifespan rather than using add_event_handler:
    # Starlette ignores on_startup/on_shutdown handlers when an explicit
    # `lifespan=` is provided (as several services use), so wrapping is the only
    # approach that fires for both lifespan- and event-style apps.
    import contextlib

    _prev_lifespan = app.router.lifespan_context

    @contextlib.asynccontextmanager
    async def _floor_lifespan(app_ref):
        emit_event("service_ready", service=service_name)
        heartbeat = asyncio.create_task(_heartbeat_loop(service_name))
        try:
            async with _prev_lifespan(app_ref):
                yield
        finally:
            heartbeat.cancel()
            emit_event("service_shutdown", service=service_name, graceful=True)

    app.router.lifespan_context = _floor_lifespan


def setup_observability(
    service_name: str,
    app: Optional[Any] = None,
    instrument_http: bool = True,
) -> logging.Logger:
    """
    One-function setup for complete observability (tracing + logging).

    This is the main entry point for setting up observability in a service.

    Args:
        service_name: Name of the service (e.g., "chunking-service")
        app: FastAPI or Flask app instance (optional, for auto-instrumentation)
        instrument_http: Whether to auto-instrument HTTP clients (default: True)

    Returns:
        Configured logger instance for immediate use.

    Usage:
        # FastAPI
        from fastapi import FastAPI
        from rag_shared.observability import setup_observability

        app = FastAPI()
        logger = setup_observability("my-service", app)

        # Flask
        from flask import Flask
        from rag_shared.observability import setup_observability

        app = Flask(__name__)
        logger = setup_observability("my-service", app)

        # No framework (scripts, workers, etc.)
        from rag_shared.observability import setup_observability
        logger = setup_observability("my-worker")
    """
    # Set environment variable for other modules that might check it
    os.environ.setdefault("SERVICE_NAME", service_name)

    # Initialize tracing
    rag_observability.setup_tracing(service_name)

    # Initialize logging
    rag_observability.init_logging(service_name)

    # Auto-instrument HTTP clients
    if instrument_http:
        rag_observability.instrument_http_clients()

    # Auto-instrument app if provided
    if app is not None:
        app_type = type(app).__name__
        if "FastAPI" in app_type or "Starlette" in app_type:
            rag_observability.instrument_fastapi(app)
            _wire_fastapi_floor(app, service_name)
        elif "Flask" in app_type:
            rag_observability.instrument_flask(app)
        else:
            print(f"Warning: Unknown app type: {app_type}, skipping instrumentation")

    # Get logger for immediate use
    logger = rag_observability.get_logger(service_name)
    logger.info(
        f"{service_name} observability initialized",
        extra={
            "tracing_enabled": rag_observability.tracing_enabled,
            "structured_logging_enabled": rag_observability.structured_logging_enabled,
            "otlp_endpoint": rag_observability.otlp_endpoint,
        },
    )

    # Relay-forwardable service_start (JSON; emitted for every service, framework or not).
    emit_event(
        "service_start",
        service_version=rag_observability.service_version,
        environment=rag_observability.environment,
    )

    return logger


# Convenience exports
__all__ = [
    "setup_observability",
    "emit_event",
    "rag_observability",
    "RagObservability",
]
