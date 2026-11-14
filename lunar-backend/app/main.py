"""Punto de entrada de la aplicación FastAPI, middlewares y lifespan."""

import time
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse
from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.api.deps import build_default_data_status
from app.api.v1 import api_v1_router
from app.core.config import Settings, get_settings
from app.core.errors import (
    PROBLEM_MEDIA_TYPE,
    build_problem_payload,
    register_exception_handlers,
)
from app.core.logging import configure_logging, get_logger

logger = get_logger(__name__)


class _BodyTooLargeError(Exception):
    """Error interno cuando el cuerpo HTTP supera el máximo permitido."""


class RequestContextMiddleware:
    """Middleware ASGI para `X-Request-ID`, `Server-Timing` y límite de tamaño de cuerpo."""

    def __init__(self, app: ASGIApp, *, max_body_bytes: int = 65_536) -> None:
        self.app = app
        self.max_body_bytes = max_body_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start = time.perf_counter()
        headers = Headers(scope=scope)
        incoming_id = headers.get("x-request-id", "").strip()
        request_id = incoming_id if incoming_id else uuid.uuid4().hex
        scope.setdefault("state", {})["request_id"] = request_id

        content_length_raw = headers.get("content-length")
        if content_length_raw is not None:
            try:
                content_length = int(content_length_raw)
            except ValueError:
                content_length = 0
            if content_length > self.max_body_bytes:
                await self._send_payload_too_large(scope, send, request_id, start)
                return

        received_bytes = 0
        response_started = False

        async def limited_receive() -> Message:
            nonlocal received_bytes
            message = await receive()
            if message["type"] == "http.request":
                body = message.get("body", b"")
                received_bytes += len(body)
                if received_bytes > self.max_body_bytes:
                    raise _BodyTooLargeError()
            return message

        async def wrapped_send(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
                elapsed_ms = max(0, round((time.perf_counter() - start) * 1000))
                resp_headers = MutableHeaders(scope=message)
                resp_headers["X-Request-ID"] = request_id
                resp_headers["Server-Timing"] = f"compute;dur={elapsed_ms}"
            await send(message)

        try:
            await self.app(scope, limited_receive, wrapped_send)
        except _BodyTooLargeError:
            if not response_started:
                await self._send_payload_too_large(scope, send, request_id, start)
            else:
                raise

    async def _send_payload_too_large(
        self, scope: Scope, send: Send, request_id: str, start: float
    ) -> None:
        elapsed_ms = max(0, round((time.perf_counter() - start) * 1000))
        payload = build_problem_payload(
            slug="payload-too-large",
            title="Cuerpo de petición demasiado grande",
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=(
                f"El cuerpo de la petición supera el límite máximo de {self.max_body_bytes} bytes."
            ),
            instance=str(scope.get("path", "/")),
            request_id=request_id,
        )
        response = ORJSONResponse(
            content=payload,
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            media_type=PROBLEM_MEDIA_TYPE,
            headers={
                "X-Request-ID": request_id,
                "Server-Timing": f"compute;dur={elapsed_ms}",
            },
        )
        await response(scope, _noop_receive, send)


async def _noop_receive() -> Message:  # pragma: no cover
    return {"type": "http.disconnect"}


def create_app(settings: Settings | None = None) -> FastAPI:
    """Construye y configura la instancia principal de FastAPI."""
    cfg = settings or get_settings()

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        configure_logging(level=cfg.log_level, json_logs=cfg.app_env != "dev")
        application.state.settings = cfg
        application.state.data_status = build_default_data_status(cfg)
        logger.info("startup_complete", app_env=cfg.app_env, version=cfg.app_version)
        yield
        logger.info("shutdown_complete")

    application = FastAPI(
        title="Lunar Illumination & Earth Visibility API",
        version=cfg.app_version,
        description=(
            "API científica para el cálculo de iluminación solar y visibilidad directa de la "
            "Tierra en sitios de aterrizaje lunar (marco MOON_ME, DEM LOLA)."
        ),
        default_response_class=ORJSONResponse,
        lifespan=lifespan,
    )

    application.add_middleware(GZipMiddleware, minimum_size=1000)
    application.add_middleware(
        RequestContextMiddleware,
        max_body_bytes=cfg.max_request_body_bytes,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "Server-Timing", "ETag"],
    )

    register_exception_handlers(application)
    application.include_router(api_v1_router)
    return application


app = create_app()
