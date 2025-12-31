"""Tests for the logging module."""

import json
import logging
from io import StringIO

import pytest

from rag_shared.logging import (
    configure_logging,
    get_logger,
    stage,
    RequestContext,
    add_context,
    clear_context,
    StructuredJSONFormatter,
)


class TestStructuredJSONFormatter:
    """Tests for StructuredJSONFormatter."""

    def test_basic_format(self):
        """Test basic JSON log formatting."""
        formatter = StructuredJSONFormatter(
            service_name="test-service",
            service_version="1.0.0",
            environment="test",
        )

        record = logging.LogRecord(
            name="test.logger",
            level=logging.INFO,
            pathname="test.py",
            lineno=42,
            msg="Test message",
            args=(),
            exc_info=None,
        )

        output = formatter.format(record)
        data = json.loads(output)

        assert data["service"] == "test-service"
        assert data["version"] == "1.0.0"
        assert data["environment"] == "test"
        assert data["level"] == "INFO"
        assert data["message"] == "Test message"
        assert data["line"] == 42
        assert "timestamp" in data

    def test_extra_fields(self):
        """Test that extra fields are included."""
        formatter = StructuredJSONFormatter()

        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="Test",
            args=(),
            exc_info=None,
        )
        record.custom_field = "custom_value"

        output = formatter.format(record)
        data = json.loads(output)

        assert data["custom_field"] == "custom_value"


class TestConfigureLogging:
    """Tests for configure_logging."""

    def test_configure_logging_sets_level(self):
        """Test that log level is properly set."""
        configure_logging(
            service_name="test",
            log_level="DEBUG",
            json_output=False,
        )

        logger = get_logger("test_level")
        assert logger.getEffectiveLevel() == logging.DEBUG


class TestStageContextManager:
    """Tests for the stage() context manager."""

    def test_stage_logs_start_and_completion(self, caplog):
        """Test that stage logs start and completion."""
        configure_logging(service_name="test", json_output=False)

        with caplog.at_level(logging.INFO):
            with stage("test_operation"):
                pass

        messages = [r.message for r in caplog.records]
        assert any("test_operation_started" in m for m in messages)
        assert any("test_operation_completed" in m for m in messages)

    def test_stage_logs_failure(self, caplog):
        """Test that stage logs failure on exception."""
        configure_logging(service_name="test", json_output=False)

        with caplog.at_level(logging.INFO):
            with pytest.raises(ValueError):
                with stage("failing_operation"):
                    raise ValueError("Test error")

        messages = [r.message for r in caplog.records]
        assert any("failing_operation_failed" in m for m in messages)

    def test_stage_includes_context(self, caplog):
        """Test that stage includes extra context."""
        configure_logging(service_name="test", json_output=False)

        with caplog.at_level(logging.INFO):
            with stage("contextual_op", doc_id="123"):
                pass

        # Check that doc_id was in the log record's extra
        assert any(
            hasattr(r, "doc_id") and r.doc_id == "123"
            for r in caplog.records
        )


class TestRequestContext:
    """Tests for RequestContext."""

    def test_request_context_adds_context(self):
        """Test that RequestContext adds fields to context."""
        clear_context()

        with RequestContext(request_id="req-123"):
            from rag_shared.logging import request_context
            ctx = request_context.get({})
            assert ctx.get("request_id") == "req-123"

    def test_request_context_clears_on_exit(self):
        """Test that context is cleared after exiting."""
        clear_context()

        with RequestContext(request_id="req-123"):
            pass

        from rag_shared.logging import request_context
        ctx = request_context.get({})
        assert "request_id" not in ctx

    def test_nested_contexts_merge(self):
        """Test that nested contexts merge properly."""
        clear_context()

        with RequestContext(outer="value1"):
            with RequestContext(inner="value2"):
                from rag_shared.logging import request_context
                ctx = request_context.get({})
                assert ctx.get("outer") == "value1"
                assert ctx.get("inner") == "value2"


class TestAddContext:
    """Tests for add_context helper."""

    def test_add_context(self):
        """Test adding context via helper function."""
        clear_context()
        add_context(key1="value1", key2="value2")

        from rag_shared.logging import request_context
        ctx = request_context.get({})
        assert ctx["key1"] == "value1"
        assert ctx["key2"] == "value2"

        clear_context()
