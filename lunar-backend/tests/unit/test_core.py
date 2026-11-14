"""Pruebas unitarias de los módulos del núcleo (`app/core/`)."""

import logging
from datetime import UTC, datetime, timedelta

import pytest

from app.core import constants
from app.core.config import Settings, get_settings
from app.core.errors import (
    DataNotReadyError,
    DomainError,
    JobNotFoundError,
    OutOfDemCoverageError,
    OutOfTimeCoverageError,
    PayloadTooLargeError,
    SiteNotFoundError,
    TooManySamplesError,
    ValidationDomainError,
    build_problem_payload,
)
from app.core.logging import configure_logging, get_logger
from app.core.timeutils import (
    build_time_grid,
    count_samples,
    format_utc_z,
    parse_utc,
    validate_time_window,
)


def test_constants_lunar_reference_values() -> None:
    assert constants.R_MOON_M == 1_737_400.0
    assert constants.MOON_FRAME == "MOON_ME"
    assert "MOON_ME" not in {"IAU_MOON"}
    assert constants.SOLAR_CONSTANT_W_M2 == 1_361.0
    assert "+R=1737400" in constants.MOON_SP_STERE_PROJ


def test_config_cors_and_empty_hires_parsing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5173, https://example.com")
    monkeypatch.setenv("DEM_HIRES_PATH", "   ")
    cfg = Settings()
    assert cfg.cors_origins == ["http://localhost:5173", "https://example.com"]
    assert cfg.dem_hires_path is None

    monkeypatch.setenv("CORS_ORIGINS", '["https://a.test", "https://b.test"]')
    cfg_json = Settings()
    assert cfg_json.cors_origins == ["https://a.test", "https://b.test"]

    monkeypatch.setenv("CORS_ORIGINS", "")
    cfg_empty = Settings()
    assert cfg_empty.cors_origins == []

    with pytest.raises(ValueError, match="cors_origins"):
        Settings(cors_origins=123)  # type: ignore[arg-type]

    get_settings.cache_clear()
    cached = get_settings()
    assert isinstance(cached, Settings)


def test_domain_errors_and_problem_payload() -> None:
    err = ValidationDomainError("Campo inválido", title="Título propio", status_code=400, slug="x")
    assert err.status_code == 400
    assert err.slug == "x"
    assert err.title == "Título propio"

    assert OutOfTimeCoverageError("t").status_code == 422
    assert OutOfDemCoverageError("d").status_code == 422
    assert SiteNotFoundError("s").status_code == 404
    assert JobNotFoundError("j").status_code == 404
    assert TooManySamplesError("m").status_code == 413
    assert PayloadTooLargeError("p").status_code == 413
    assert DataNotReadyError("r").status_code == 503
    assert DomainError("base").slug == "domain-error"

    payload = build_problem_payload(
        slug="out-of-time-coverage",
        title="Fecha fuera de cobertura",
        status_code=422,
        detail="Detalle de prueba",
        instance="/api/v1/analysis",
        request_id="req-123",
    )
    assert payload == {
        "type": "https://lunar-sim/errors/out-of-time-coverage",
        "title": "Fecha fuera de cobertura",
        "status": 422,
        "detail": "Detalle de prueba",
        "instance": "/api/v1/analysis",
        "request_id": "req-123",
    }


def test_timeutils_parse_format_and_window_validation() -> None:
    dt_z = parse_utc("2027-01-10T06:00:00Z")
    assert dt_z == datetime(2027, 1, 10, 6, 0, 0, tzinfo=UTC)
    assert format_utc_z(dt_z) == "2027-01-10T06:00:00Z"

    dt_offset = parse_utc("2027-01-10T08:00:00+02:00")
    assert dt_offset == dt_z

    dt_ms = datetime(2027, 1, 10, 6, 0, 0, 250_000, tzinfo=UTC)
    assert format_utc_z(dt_ms) == "2027-01-10T06:00:00.250Z"

    with pytest.raises(ValueError, match="zona horaria"):
        parse_utc("2027-01-10T06:00:00")

    with pytest.raises(ValueError, match="naive"):
        format_utc_z(datetime(2027, 1, 10, 6, 0, 0))

    with pytest.raises(TypeError):
        parse_utc(12345)  # type: ignore[arg-type]

    cov_min = datetime(2000, 1, 1, tzinfo=UTC)
    cov_max = datetime(2100, 1, 1, tzinfo=UTC)
    landing = datetime(2027, 1, 10, 6, 0, 0, tzinfo=UTC)
    departure = landing + timedelta(days=14)

    validate_time_window(
        landing,
        departure,
        coverage_min_utc=cov_min,
        coverage_max_utc=cov_max,
        max_duration_days=60,
    )
    assert count_samples(landing, departure, 10) == 2017
    grid = build_time_grid(landing, landing + timedelta(minutes=20), 10)
    assert len(grid) == 3
    assert grid[-1] == landing + timedelta(minutes=20)

    with pytest.raises(ValidationDomainError, match="departure_utc"):
        validate_time_window(
            landing,
            landing,
            coverage_min_utc=cov_min,
            coverage_max_utc=cov_max,
            max_duration_days=60,
        )

    with pytest.raises(OutOfTimeCoverageError):
        validate_time_window(
            datetime(1999, 1, 1, tzinfo=UTC),
            landing,
            coverage_min_utc=cov_min,
            coverage_max_utc=cov_max,
            max_duration_days=60,
        )

    with pytest.raises(OutOfTimeCoverageError):
        validate_time_window(
            landing,
            datetime(2150, 1, 1, tzinfo=UTC),
            coverage_min_utc=cov_min,
            coverage_max_utc=cov_max,
            max_duration_days=60,
        )

    with pytest.raises(ValidationDomainError, match="60 días"):
        validate_time_window(
            landing,
            landing + timedelta(days=61),
            coverage_min_utc=cov_min,
            coverage_max_utc=cov_max,
            max_duration_days=60,
        )

    with pytest.raises(ValidationDomainError, match="step_minutes"):
        count_samples(landing, departure, 0)

    with pytest.raises(ValidationDomainError, match="departure_utc"):
        count_samples(landing, landing, 10)


def test_logging_configuration(capsys: pytest.CaptureFixture[str]) -> None:
    configure_logging(level="INFO", json_logs=True)
    log = get_logger("test_core")
    log.info("hello_json", value=42)
    captured = capsys.readouterr()
    assert '"event": "hello_json"' in captured.out
    assert logging.getLogger().level == logging.INFO

    configure_logging(level="DEBUG", json_logs=False)
    log.debug("hello_console")
    captured_console = capsys.readouterr()
    assert "hello_console" in captured_console.out
