"""Utilidades de parseo, validación y formateo ISO-8601 UTC."""

import math
from datetime import UTC, datetime, timedelta

from app.core.errors import OutOfTimeCoverageError, ValidationDomainError


def parse_utc(value: str | datetime) -> datetime:
    """Parsea un timestamp ISO-8601 exigiendo zona horaria y lo normaliza a UTC."""
    if isinstance(value, str):
        parsed = datetime.fromisoformat(value)
    elif isinstance(value, datetime):
        parsed = value
    else:
        raise TypeError("Se esperaba str o datetime para parse_utc")

    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError("La fecha debe incluir zona horaria explícita (por ejemplo 'Z')")
    return parsed.astimezone(UTC)


def format_utc_z(dt: datetime) -> str:
    """Formatea un `datetime` con zona horaria en ISO-8601 UTC con sufijo `Z`."""
    if dt.tzinfo is None or dt.utcoffset() is None:
        raise ValueError("No se puede formatear un datetime naive sin zona horaria")
    utc_dt = dt.astimezone(UTC)
    if utc_dt.microsecond == 0:
        return utc_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    return utc_dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def validate_time_window(
    landing_utc: datetime,
    departure_utc: datetime,
    *,
    coverage_min_utc: datetime,
    coverage_max_utc: datetime,
    max_duration_days: int,
) -> None:
    """Valida orden temporal, cobertura de efemérides y duración máxima de ventana."""
    landing = parse_utc(landing_utc)
    departure = parse_utc(departure_utc)
    cov_min = parse_utc(coverage_min_utc)
    cov_max = parse_utc(coverage_max_utc)

    if departure <= landing:
        raise ValidationDomainError(
            "Campo 'departure_utc' debe ser estrictamente posterior a 'landing_utc'."
        )

    if landing < cov_min or landing > cov_max:
        raise OutOfTimeCoverageError(
            f"landing_utc {format_utc_z(landing)} está fuera de la cobertura "
            f"[{format_utc_z(cov_min)}, {format_utc_z(cov_max)}]."
        )

    if departure < cov_min or departure > cov_max:
        raise OutOfTimeCoverageError(
            f"departure_utc {format_utc_z(departure)} está fuera de la cobertura "
            f"[{format_utc_z(cov_min)}, {format_utc_z(cov_max)}]."
        )

    max_delta = timedelta(days=max_duration_days)
    if departure - landing > max_delta:
        raise ValidationDomainError(
            f"La duración entre landing_utc y departure_utc supera el máximo de "
            f"{max_duration_days} días."
        )


def count_samples(landing_utc: datetime, departure_utc: datetime, step_minutes: int) -> int:
    """Calcula el número de muestras inclusivas en [landing, departure] para un paso dado."""
    if step_minutes <= 0:
        raise ValidationDomainError("Campo 'step_minutes' debe ser positivo.")
    landing = parse_utc(landing_utc)
    departure = parse_utc(departure_utc)
    if departure <= landing:
        raise ValidationDomainError(
            "Campo 'departure_utc' debe ser estrictamente posterior a 'landing_utc'."
        )
    total_seconds = (departure - landing).total_seconds()
    step_seconds = step_minutes * 60.0
    return math.floor(total_seconds / step_seconds + 1e-9) + 1


def build_time_grid(
    landing_utc: datetime,
    departure_utc: datetime,
    step_minutes: int,
) -> list[datetime]:
    """Genera la lista de instantes UTC equiespaciados en `[landing_utc, departure_utc]`."""
    n = count_samples(landing_utc, departure_utc, step_minutes)
    landing = parse_utc(landing_utc)
    step = timedelta(minutes=step_minutes)
    return [landing + i * step for i in range(n)]
