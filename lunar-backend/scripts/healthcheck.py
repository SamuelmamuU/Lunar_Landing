"""Script multiplataforma de verificación de salud para `/api/v1/health`."""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any

import httpx

DEFAULT_HEALTHCHECK_URL = "http://127.0.0.1:8000/api/v1/health"


def check_health(
    url: str,
    *,
    timeout_s: float = 5.0,
    transport: httpx.BaseTransport | None = None,
) -> tuple[bool, str]:
    """Consulta el endpoint `/api/v1/health` y valida HTTP 200 con `status == 'ok'`."""
    try:
        with httpx.Client(timeout=timeout_s, transport=transport) as client:
            response = client.get(url)
    except httpx.HTTPError as exc:
        return False, f"Error de conexión con {url}: {exc}"

    if response.status_code != 200:
        return False, f"Estado HTTP inesperado {response.status_code} desde {url}: {response.text}"

    try:
        payload: Any = response.json()
    except ValueError as exc:
        return False, f"Respuesta JSON inválida desde {url}: {exc}"

    if not isinstance(payload, dict) or payload.get("status") != "ok":
        return False, f"Respuesta de salud inesperada desde {url}: {payload!r}"

    return True, f"OK ({response.status_code}) — version={payload.get('version', 'unknown')}"


def main(argv: list[str] | None = None) -> int:
    """Punto de entrada CLI para el healthcheck nativo."""
    parser = argparse.ArgumentParser(description="Verifica salud de lunar-backend.")
    parser.add_argument(
        "--url",
        default=os.environ.get("HEALTHCHECK_URL", DEFAULT_HEALTHCHECK_URL),
        help="URL del endpoint /api/v1/health",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=5.0,
        help="Tiempo máximo de espera en segundos",
    )
    args = parser.parse_args(argv)

    ok, message = check_health(args.url, timeout_s=args.timeout)
    stream = sys.stdout if ok else sys.stderr
    print(message, file=stream)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
