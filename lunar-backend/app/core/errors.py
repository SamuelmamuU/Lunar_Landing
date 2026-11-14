"""Excepciones de dominio y manejadores RFC 7807 (`application/problem+json`)."""

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import ORJSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.constants import PROBLEM_TYPE_BASE
from app.core.logging import get_logger

logger = get_logger(__name__)

PROBLEM_MEDIA_TYPE = "application/problem+json"


class DomainError(Exception):
    """Excepción base de dominio convertible a RFC 7807."""

    slug: str = "domain-error"
    title: str = "Error de dominio"
    status_code: int = status.HTTP_422_UNPROCESSABLE_CONTENT

    def __init__(
        self,
        detail: str,
        *,
        title: str | None = None,
        status_code: int | None = None,
        slug: str | None = None,
    ) -> None:
        super().__init__(detail)
        self.detail = detail
        if title is not None:
            self.title = title
        if status_code is not None:
            self.status_code = status_code
        if slug is not None:
            self.slug = slug


class ValidationDomainError(DomainError):
    """Error de validación semántica en parámetros de entrada."""

    slug = "validation-error"
    title = "Error de validación"
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT


class OutOfTimeCoverageError(DomainError):
    """Fecha solicitada fuera de la cobertura temporal de los kernels SPICE."""

    slug = "out-of-time-coverage"
    title = "Fecha fuera de la cobertura de efemérides"
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT


class OutOfDemCoverageError(DomainError):
    """Ubicación fuera de la cobertura del DEM cuando se exige terreno real."""

    slug = "out-of-dem-coverage"
    title = "Ubicación fuera de la cobertura del DEM"
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT


class SiteNotFoundError(DomainError):
    """Identificador de sitio no encontrado en el catálogo."""

    slug = "site-not-found"
    title = "Sitio lunar no encontrado"
    status_code = status.HTTP_404_NOT_FOUND


class JobNotFoundError(DomainError):
    """Identificador de trabajo asíncrono inexistente o expirado."""

    slug = "job-not-found"
    title = "Job no encontrado"
    status_code = status.HTTP_404_NOT_FOUND


class TooManySamplesError(DomainError):
    """La petición excede el límite máximo de muestras permitido incluso para jobs."""

    slug = "too-many-samples"
    title = "Demasiadas muestras solicitadas"
    status_code = status.HTTP_413_CONTENT_TOO_LARGE


class PayloadTooLargeError(DomainError):
    """El cuerpo de la petición supera el límite máximo permitido."""

    slug = "payload-too-large"
    title = "Cuerpo de petición demasiado grande"
    status_code = status.HTTP_413_CONTENT_TOO_LARGE


class DataNotReadyError(DomainError):
    """Los datos requeridos (kernels SPICE o DEM) aún no están disponibles."""

    slug = "data-not-ready"
    title = "Datos científicos no disponibles"
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE


def build_problem_payload(
    *,
    slug: str,
    title: str,
    status_code: int,
    detail: str,
    instance: str,
    request_id: str,
) -> dict[str, Any]:
    """Construye el diccionario JSON conforme a RFC 7807."""
    return {
        "type": f"{PROBLEM_TYPE_BASE}{slug}",
        "title": title,
        "status": status_code,
        "detail": detail,
        "instance": instance,
        "request_id": request_id,
    }


def problem_response(
    *,
    request: Request,
    slug: str,
    title: str,
    status_code: int,
    detail: str,
) -> ORJSONResponse:
    """Genera una `ORJSONResponse` con media type `application/problem+json`."""
    request_id = getattr(request.state, "request_id", "unknown")
    payload = build_problem_payload(
        slug=slug,
        title=title,
        status_code=status_code,
        detail=detail,
        instance=request.url.path,
        request_id=request_id,
    )
    return ORJSONResponse(
        content=payload,
        status_code=status_code,
        media_type=PROBLEM_MEDIA_TYPE,
        headers={"X-Request-ID": request_id},
    )


def _format_validation_detail(exc: RequestValidationError) -> str:
    parts: list[str] = []
    for err in exc.errors():
        loc = ".".join(str(segment) for segment in err.get("loc", ()) if segment != "body")
        msg = str(err.get("msg", "Valor inválido"))
        if loc:
            parts.append(f"Campo '{loc}': {msg}")
        else:
            parts.append(msg)
    return "; ".join(parts) if parts else "Error de validación en la petición."


def register_exception_handlers(app: FastAPI) -> None:
    """Registra los manejadores globales de errores RFC 7807 en FastAPI."""

    @app.exception_handler(DomainError)
    async def handle_domain_error(request: Request, exc: DomainError) -> ORJSONResponse:
        return problem_response(
            request=request,
            slug=exc.slug,
            title=exc.title,
            status_code=exc.status_code,
            detail=exc.detail,
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> ORJSONResponse:
        return problem_response(
            request=request,
            slug="validation-error",
            title="Error de validación",
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=_format_validation_detail(exc),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(
        request: Request, exc: StarletteHTTPException
    ) -> ORJSONResponse:
        slug = "http-error" if exc.status_code != 404 else "not-found"
        return problem_response(
            request=request,
            slug=slug,
            title="Error HTTP",
            status_code=exc.status_code,
            detail=str(exc.detail),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> ORJSONResponse:
        request_id = getattr(request.state, "request_id", "unknown")
        logger.exception("unhandled_exception", request_id=request_id, path=request.url.path)
        return problem_response(
            request=request,
            slug="internal",
            title="Error interno del servidor",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ocurrió un error interno inesperado al procesar la solicitud.",
        )
