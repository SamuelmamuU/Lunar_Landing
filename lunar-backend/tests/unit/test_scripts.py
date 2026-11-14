"""Pruebas unitarias de los scripts operativos en `scripts/`."""

import httpx
import pytest

from scripts.healthcheck import check_health, main


def test_healthcheck_ok_and_failures() -> None:
    ok_transport = httpx.MockTransport(
        lambda req: httpx.Response(200, json={"status": "ok", "version": "1.0.0"})
    )
    ok, msg = check_health("http://127.0.0.1:8000/api/v1/health", transport=ok_transport)
    assert ok is True
    assert "1.0.0" in msg

    err_503 = httpx.MockTransport(
        lambda req: httpx.Response(503, json={"title": "Datos no disponibles"})
    )
    ok_503, msg_503 = check_health("http://127.0.0.1:8000/api/v1/health", transport=err_503)
    assert ok_503 is False
    assert "503" in msg_503

    bad_json = httpx.MockTransport(lambda req: httpx.Response(200, text="not-json"))
    ok_bad_json, msg_bad_json = check_health(
        "http://127.0.0.1:8000/api/v1/health", transport=bad_json
    )
    assert ok_bad_json is False
    assert "JSON" in msg_bad_json

    bad_status = httpx.MockTransport(lambda req: httpx.Response(200, json={"status": "degraded"}))
    ok_bad_status, _ = check_health("http://127.0.0.1:8000/api/v1/health", transport=bad_status)
    assert ok_bad_status is False

    def raise_conn(_req: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    conn_err = httpx.MockTransport(raise_conn)
    ok_conn, msg_conn = check_health("http://127.0.0.1:8000/api/v1/health", transport=conn_err)
    assert ok_conn is False
    assert "Error de conexión" in msg_conn


def test_healthcheck_cli_main(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr("scripts.healthcheck.check_health", lambda url, timeout_s=5.0: (True, "OK"))
    assert main(["--url", "http://127.0.0.1:8000/api/v1/health"]) == 0
    assert "OK" in capsys.readouterr().out

    monkeypatch.setattr(
        "scripts.healthcheck.check_health",
        lambda url, timeout_s=5.0: (False, "FAIL"),
    )
    assert main(["--url", "http://127.0.0.1:8000/api/v1/health"]) == 1
    assert "FAIL" in capsys.readouterr().err
