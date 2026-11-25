"""Tests for the relay-compatible operational event floor.

The QIG log relay forwards only single-line JSON events carrying a non-empty
``schema_version``; these tests pin that every record carries it, and that a
raising handler still produces a ``handler_error`` event without leaking the
exception's message text.
"""

import json

import pytest

from rag_shared.observability import (
    _wire_fastapi_floor,
    emit_event,
    exception_sqlstate,
)


def _events(captured: str) -> list:
    out = []
    for line in captured.splitlines():
        line = line.strip()
        if line.startswith("{"):
            out.append(json.loads(line))
    return out


class TestEmitEventSchemaVersion:
    def test_every_record_carries_schema_version_first(self, capsys):
        emit_event("heartbeat")
        emit_event("handler_success", level="info", path="/x", status_code=200)
        records = _events(capsys.readouterr().out)
        assert len(records) == 2
        for rec in records:
            assert rec["schema_version"] == "1.0"
            assert next(iter(rec)) == "schema_version"

    def test_caller_cannot_override_schema_version(self, capsys):
        emit_event("heartbeat", schema_version="9.9")
        emit_event("heartbeat", schema_version=None)
        emit_event("heartbeat", schema_version="")
        records = _events(capsys.readouterr().out)
        assert [r["schema_version"] for r in records] == ["1.0", "1.0", "1.0"]


class TestExceptionSqlstate:
    def test_asyncpg_style(self):
        exc = Exception("boom")
        exc.sqlstate = "42P01"
        assert exception_sqlstate(exc) == "42P01"

    def test_psycopg_style(self):
        exc = Exception("boom")
        exc.pgcode = "28P01"
        assert exception_sqlstate(exc) == "28P01"

    @pytest.mark.parametrize("value", [None, "", "42p01", "4201", "42P011", 42601, "relation x"])
    def test_rejects_non_codes(self, value):
        exc = Exception("boom")
        exc.sqlstate = value
        assert exception_sqlstate(exc) is None

    def test_plain_exception(self):
        assert exception_sqlstate(RuntimeError("x")) is None


fastapi = pytest.importorskip("fastapi")
from fastapi.testclient import TestClient  # noqa: E402


class _Boom(RuntimeError):
    pass


def _app():
    app = fastapi.FastAPI()
    _wire_fastapi_floor(app, "test-service")

    @app.get("/raise")
    async def _raise():
        raise _Boom("SECRET-xyz relation tenant_config does not exist")

    @app.get("/ok")
    async def _ok():
        return {"ok": True}

    @app.get("/health")
    async def _health():
        raise _Boom("SECRET-health")

    return app


class TestHandlerLifecycleOnRaise:
    def test_raising_route_emits_handler_error_and_propagates(self, capsys):
        client = TestClient(_app(), raise_server_exceptions=True)
        with pytest.raises(_Boom) as info:
            client.get("/raise", headers={"x-request-id": "rid-1"})
        # The original exception propagates unchanged.
        assert "SECRET-xyz" in str(info.value)

        out = capsys.readouterr().out
        print(out, file=__import__("sys").stderr)  # visible with -s for evidence
        assert "SECRET-xyz" not in out
        errors = [e for e in _events(out) if e["event"] == "handler_error"]
        assert len(errors) == 1
        err = errors[0]
        assert err["schema_version"] == "1.0"
        assert err["level"] == "error"
        assert err["status_code"] == 500
        assert err["error_type"] == "_Boom"
        assert err["method"] == "GET"
        assert err["path"] == "/raise"
        assert err["request_id"] == "rid-1"
        assert isinstance(err["duration_ms"], int)

    def test_raising_route_yields_500_to_client(self, capsys):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get("/raise")
        assert resp.status_code == 500
        out = capsys.readouterr().out
        assert "SECRET-xyz" not in out
        assert any(e["event"] == "handler_error" for e in _events(out))

    def test_skip_paths_not_logged_even_on_raise(self, capsys):
        client = TestClient(_app(), raise_server_exceptions=False)
        resp = client.get("/health")
        assert resp.status_code == 500
        out = capsys.readouterr().out
        assert "SECRET-health" not in out
        assert not any(e.get("path") == "/health" for e in _events(out))

    def test_success_path_unchanged(self, capsys):
        client = TestClient(_app())
        assert client.get("/ok").status_code == 200
        events = [e["event"] for e in _events(capsys.readouterr().out)]
        assert events == ["handler_entry", "handler_success"]

    def test_failing_emit_does_not_mask_original_exception(self, monkeypatch):
        import rag_shared.observability as obs

        real = obs.emit_event

        def flaky(event, *a, **kw):
            if event == "handler_error":
                raise ValueError("telemetry broke")
            return real(event, *a, **kw)

        monkeypatch.setattr(obs, "emit_event", flaky)
        client = TestClient(_app(), raise_server_exceptions=True)
        with pytest.raises(_Boom):
            client.get("/raise")
