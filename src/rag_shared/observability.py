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

import logging
import os
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

    return logger


# Convenience exports
__all__ = [
    "setup_observability",
    "rag_observability",
    "RagObservability",
]
