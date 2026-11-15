"""Ayudante de pruebas: /api/mission recibe aterrizaje y salida, no duración."""
from datetime import timedelta

from lunar.evaluate import parse_utc


def salida(landing: str, dias: float) -> str:
    """Fecha y hora de salida de la Luna = aterrizaje + `dias` (acepta los mismos formatos que la API)."""
    from datetime import datetime

    t = datetime.fromisoformat(parse_utc(landing).replace("Z", "+00:00")) + timedelta(days=dias)
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")
