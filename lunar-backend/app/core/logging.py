"""Configuración de logging estructurado JSON con structlog."""

import logging
from typing import Any, cast

import structlog


def configure_logging(level: str = "INFO", *, json_logs: bool = True) -> None:
    """Inicializa `logging` estándar y `structlog` con salida estructurada."""
    numeric_level = getattr(logging, level.upper(), logging.INFO)
    logging.basicConfig(level=numeric_level, format="%(message)s")
    logging.getLogger().setLevel(numeric_level)

    shared_processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
    ]
    renderer: Any = (
        structlog.processors.JSONRenderer() if json_logs else structlog.dev.ConsoleRenderer()
    )

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(numeric_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=False,
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Devuelve un logger estructurado enlazado al nombre del módulo."""
    return cast(structlog.stdlib.BoundLogger, structlog.get_logger(name))
