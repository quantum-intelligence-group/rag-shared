"""Tests for the logging module."""

import logging
import re

import pytest

from rag_shared.logging import (
    setup_logging,
    get_logger,
    timed,
    log_context,
    clear_log_context,
    MilvusFormatter,
    # Backward compat
    configure_logging,
    stage,
    RequestContext,
    add_context,
    clear_context,
)


class TestMilvusFormatter:
    """Tests for MilvusFormatter."""

    def test_basic_format(self):
        """Test basic log formatting."""
        formatter = MilvusFormatter()

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

        # Check format: [timestamp] [LEVEL] [module:line] ["message"]
        assert "[INFO]" in output
        assert "[test:42]" in output
        assert '["Test message"]' in output
        # Timestamp pattern
        assert re.search(r"\[\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}\.\d{3} \+00:00\]", output)

    def test_extra_fields(self):
        """Test that extra fields are included as [key=value]."""
        formatter = MilvusFormatter()

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
        record.count = 42

        output = formatter.format(record)

        assert "[custom_field=custom_value]" in output
        assert "[count=42]" in output

    def test_float_formatting(self):
        """Test that floats are formatted nicely."""
        formatter = MilvusFormatter()

        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="Test",
            args=(),
            exc_info=None,
        )
        record.duration_ms = 123.456789

        output = formatter.format(record)

        # Should be rounded to 2 decimal places
        assert "[duration_ms=123.46]" in output


class TestSetupLogging:
    """Tests for setup_logging."""

    def test_setup_logging_sets_level(self):
        """Test that log level is properly set."""
        setup_logging(level="DEBUG")

        logger = get_logger("test_level")
        assert logger.getEffectiveLevel() == logging.DEBUG

    def test_setup_logging_default_info(self):
        """Test default log level is INFO."""
        setup_logging()

        logger = get_logger("test_default")
        assert logger.getEffectiveLevel() == logging.INFO


class TestTimed:
    """Tests for the timed() context manager."""

    def test_timed_logs_completion(self, caplog):
        """Test that timed logs completion."""
        setup_logging()

        with caplog.at_level(logging.INFO):
            with timed("test_operation"):
                pass

        messages = [r.message for r in caplog.records]
        assert any("test_operation completed" in m for m in messages)

    def test_timed_logs_failure(self, caplog):
        """Test that timed logs failure on exception."""
        setup_logging()

        with caplog.at_level(logging.INFO):
            with pytest.raises(ValueError):
                with timed("failing_operation"):
                    raise ValueError("Test error")

        messages = [r.message for r in caplog.records]
        assert any("failing_operation failed" in m for m in messages)

    def test_timed_includes_duration(self, caplog):
        """Test that timed includes duration_ms."""
        setup_logging()

        with caplog.at_level(logging.INFO):
            with timed("timed_op"):
                pass

        # Check that duration_ms was logged
        assert any(
            hasattr(r, "duration_ms") and r.duration_ms >= 0
            for r in caplog.records
        )

    def test_timed_includes_extra_context(self, caplog):
        """Test that timed includes extra kwargs."""
        setup_logging()

        with caplog.at_level(logging.INFO):
            with timed("contextual_op", doc_id="123"):
                pass

        assert any(
            hasattr(r, "doc_id") and r.doc_id == "123"
            for r in caplog.records
        )


class TestLogContext:
    """Tests for log_context."""

    def test_log_context_adds_fields(self, caplog):
        """Test that log_context adds fields to logs."""
        setup_logging()
        clear_log_context()

        with caplog.at_level(logging.INFO):
            with log_context(request_id="req-123"):
                logger = get_logger("test")
                logger.info("Test message")

        # The formatter should have included request_id
        # Check the formatted output contains it
        assert any("request_id" in r.getMessage() or hasattr(r, "request_id") for r in caplog.records) or \
               any("req-123" in caplog.text for _ in [1])

    def test_log_context_clears_on_exit(self):
        """Test that context is cleared after exiting."""
        clear_log_context()

        with log_context(request_id="req-123"):
            pass

        from rag_shared.logging import _log_context
        ctx = _log_context.get({})
        assert "request_id" not in ctx

    def test_nested_contexts_merge(self):
        """Test that nested contexts merge properly."""
        clear_log_context()

        with log_context(outer="value1"):
            with log_context(inner="value2"):
                from rag_shared.logging import _log_context
                ctx = _log_context.get({})
                assert ctx.get("outer") == "value1"
                assert ctx.get("inner") == "value2"


class TestBackwardCompatibility:
    """Tests for backward compatibility with old API."""

    def test_configure_logging_works(self):
        """Test that configure_logging still works."""
        configure_logging(
            service_name="test",
            log_level="DEBUG",
            json_output=False,
        )

        logger = get_logger("test_compat")
        assert logger.getEffectiveLevel() == logging.DEBUG

    def test_stage_alias_works(self, caplog):
        """Test that stage() still works as alias for timed()."""
        setup_logging()

        with caplog.at_level(logging.INFO):
            with stage("stage_operation"):
                pass

        messages = [r.message for r in caplog.records]
        assert any("stage_operation completed" in m for m in messages)

    def test_request_context_works(self):
        """Test that RequestContext still works."""
        clear_context()

        with RequestContext(request_id="req-123"):
            from rag_shared.logging import _log_context
            ctx = _log_context.get({})
            assert ctx.get("request_id") == "req-123"

    def test_add_context_works(self):
        """Test that add_context still works."""
        clear_context()
        add_context(key1="value1", key2="value2")

        from rag_shared.logging import _log_context
        ctx = _log_context.get({})
        assert ctx["key1"] == "value1"
        assert ctx["key2"] == "value2"

        clear_context()
