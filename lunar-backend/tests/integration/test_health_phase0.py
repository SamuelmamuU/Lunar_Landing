"""Pruebas de integración de la Fase 0 (`/api/v1/health`, OpenAPI, RFC 7807, middlewares)."""

import json
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from fastapi import HTTPException, Request
from httpx import ASGITransport, AsyncClient

from app.api.deps import DataStatus, build_default_data_status, get_data_status
from app.core.config import Settings
from app.core.errors import ValidationDomainError
from app.main import create_app
from app.schemas.common import HealthResponse


async def test_health_ok_and_openapi(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    parsed = HealthResponse.model_validate(response.json())
    assert parsed.status == "ok"
    assert parsed.data.time_coverage.min_utc.endswith("Z")
    assert parsed.data.time_coverage.max_utc.endswith("Z")
    assert "x-request-id" in response.headers
    assert response.headers["server-timing"].startswith("compute;dur=")

    openapi = await client.get("/openapi.json")
    assert openapi.status_code == 200
    spec = openapi.json()
    assert "/api/v1/health" in spec["paths"]

    docs = await client.get("/docs")
    assert docs.status_code == 200


async def test_health_503_data_not_ready() -> None:
    app = create_app()
    app.dependency_overrides[get_data_status] = lambda: DataStatus(
        ready=False,
        reason="Kernels SPICE faltantes en el volumen de datos.",
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as ac:
        response = await ac.get("/api/v1/health")
    assert response.status_code == 503
    assert response.headers["content-type"].startswith("application/problem+json")
    body = response.json()
    assert body["type"].endswith("/data-not-ready")
    assert body["status"] == 503
    assert body["request_id"]


def test_build_default_data_status_with_manifest_and_missing_data(tmp_path: Path) -> None:
    manifest = tmp_path / "manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "kernels": [{"file": "naif0012.tls"}],
                "dem": {
                    "file": "LDEM_80S_20MPP_ADJ.TIF",
                    "pixel_m": 20.0,
                    "sha256": "a1b2c3d4e5f60000",
                    "mode": "window",
                },
            }
        ),
        encoding="utf-8",
    )
    cfg = Settings(
        manifest_path=manifest,
        meta_kernel=tmp_path / "missing.tm",
        dem_path=tmp_path / "missing.tif",
        data_required=True,
    )
    status_obj = build_default_data_status(cfg)
    assert status_obj.ready is False
    assert status_obj.kernels == ["naif0012.tls"]
    assert status_obj.dem is not None
    assert status_obj.dem.sha256_prefix == "a1b2c3d4e5f6"


async def test_headers_cors_and_rfc7807_error_handlers() -> None:
    cfg = Settings(max_request_body_bytes=1024, cors_origins=["http://localhost:5173"])
    app = create_app(cfg)

    @app.get("/_test/domain-error")
    async def _raise_domain() -> None:
        raise ValidationDomainError("Campo 'step_minutes' fuera de rango.")

    @app.get("/_test/http-error")
    async def _raise_http() -> None:
        raise HTTPException(status_code=400, detail="Mala petición")

    @app.get("/_test/boom")
    async def _raise_boom() -> None:
        raise RuntimeError("Fallo inesperado")

    @app.post("/_test/echo")
    async def _echo(payload: dict[str, str]) -> dict[str, str]:
        return payload

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as ac:
        r_req_id = await ac.get("/api/v1/health", headers={"X-Request-ID": "abc-123"})
        assert r_req_id.headers["x-request-id"] == "abc-123"

        r_not_found = await ac.get("/api/v1/nope")
        assert r_not_found.status_code == 404
        assert r_not_found.headers["content-type"].startswith("application/problem+json")
        assert r_not_found.json()["type"].endswith("/not-found")

        r_domain = await ac.get("/_test/domain-error")
        assert r_domain.status_code == 422
        assert "step_minutes" in r_domain.json()["detail"]

        r_http = await ac.get("/_test/http-error")
        assert r_http.status_code == 400
        assert r_http.json()["type"].endswith("/http-error")

        r_val = await ac.post("/_test/echo", json={"x": 123})
        assert r_val.status_code == 422
        assert r_val.json()["type"].endswith("/validation-error")

        r_cors_ok = await ac.options(
            "/api/v1/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert r_cors_ok.headers.get("access-control-allow-origin") == "http://localhost:5173"

        r_cors_bad = await ac.options(
            "/api/v1/health",
            headers={
                "Origin": "https://evil.example",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert "access-control-allow-origin" not in r_cors_bad.headers

        oversized = b'{"data":"' + b"a" * 2048 + b'"}'
        r_large = await ac.post(
            "/_test/echo",
            content=oversized,
            headers={"Content-Type": "application/json"},
        )
        assert r_large.status_code == 413
        assert r_large.headers["content-type"].startswith("application/problem+json")
        assert r_large.json()["type"].endswith("/payload-too-large")

    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://testserver",
    ) as ac_no_raise:
        r_boom = await ac_no_raise.get("/_test/boom")
        assert r_boom.status_code == 500
        assert r_boom.headers["content-type"].startswith("application/problem+json")
        assert r_boom.json()["type"].endswith("/internal")


@pytest.mark.asyncio
async def test_health_streaming_body_limit() -> None:
    cfg = Settings(max_request_body_bytes=1024)
    app = create_app(cfg)

    @app.post("/_test/stream")
    async def _stream_target(request: Request) -> dict[str, int]:
        raw = await request.body()
        return {"bytes": len(raw)}

    async def chunk_gen() -> AsyncIterator[bytes]:
        yield b"x" * 700
        yield b"y" * 700

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as ac:
        r_stream = await ac.post("/_test/stream", content=chunk_gen())
    assert r_stream.status_code == 413
    assert r_stream.json()["type"].endswith("/payload-too-large")
