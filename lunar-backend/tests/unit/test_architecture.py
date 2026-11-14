"""Pruebas de arquitectura y reglas transversales (UT-ARCH-*)."""

import ast
import importlib
import pkgutil
import re
from pathlib import Path
from typing import get_args, get_origin

from pydantic import BaseModel

import app.schemas

ROOT_DIR = Path(__file__).resolve().parents[2]
APP_DIR = ROOT_DIR / "app"
API_DIR = APP_DIR / "api"

FORBIDDEN_API_MODULES = {"spiceypy", "rasterio", "numba"}
ABS_PATH_PATTERNS = [
    re.compile(r"/home/"),
    re.compile(r"/Users/"),
    re.compile(r"(?<![A-Za-z])[A-Za-z]:[/\\]"),
]

ALLOWED_FLOAT_SUFFIXES = ("_deg", "_m", "_km", "_s", "_pct", "_w", "_wh")
WHITELIST_FLOAT_FIELDS = {"fraction", "score", "progress"}


def _contains_float(annotation: object) -> bool:
    if annotation is float:
        return True
    origin = get_origin(annotation)
    if origin is None:
        return False
    return any(_contains_float(arg) for arg in get_args(annotation))


def test_UT_ARCH_01_no_forbidden_imports_in_api() -> None:
    """RNF-MAN-03: `app/api/` no importa `spiceypy`, `rasterio` ni `numba` directamente."""
    offenders: list[str] = []
    for py_file in API_DIR.rglob("*.py"):
        tree = ast.parse(py_file.read_text(encoding="utf-8"), filename=str(py_file))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    top_pkg = alias.name.split(".")[0]
                    if top_pkg in FORBIDDEN_API_MODULES:
                        offenders.append(f"{py_file}: import {alias.name}")
            elif isinstance(node, ast.ImportFrom) and node.module:
                top_pkg = node.module.split(".")[0]
                if top_pkg in FORBIDDEN_API_MODULES:
                    offenders.append(f"{py_file}: from {node.module} import ...")

    assert not offenders, f"Imports prohibidos en app/api/: {offenders}"


def test_UT_ARCH_02_no_hardcoded_absolute_paths() -> None:
    """RNF-MAN-04: No existen rutas absolutas de desarrollador codificadas en `app/`."""
    offenders: list[str] = []
    for py_file in APP_DIR.rglob("*.py"):
        content = py_file.read_text(encoding="utf-8")
        for line_no, line in enumerate(content.splitlines(), start=1):
            for pattern in ABS_PATH_PATTERNS:
                if pattern.search(line):
                    offenders.append(f"{py_file}:{line_no}: {line.strip()}")

    assert not offenders, f"Rutas absolutas encontradas en app/: {offenders}"


def test_UT_ARCH_03_response_float_field_units() -> None:
    """RNF-UX-01: Los campos float de respuesta declaran unidades o están en lista blanca."""
    violations: list[str] = []

    for mod_info in pkgutil.walk_packages(app.schemas.__path__, prefix="app.schemas."):
        module = importlib.import_module(mod_info.name)
        for obj_name in dir(module):
            obj = getattr(module, obj_name)
            if not (isinstance(obj, type) and issubclass(obj, BaseModel)):
                continue
            if obj is BaseModel or obj_name in {"StrictModel"}:
                continue
            if obj_name.endswith(("In", "Request", "Options", "Scenario")):
                continue
            for field_name, field_info in obj.model_fields.items():
                if _contains_float(field_info.annotation):
                    valid_suffix = field_name.endswith(ALLOWED_FLOAT_SUFFIXES)
                    whitelisted = field_name in WHITELIST_FLOAT_FIELDS
                    if not (valid_suffix or whitelisted):
                        violations.append(f"{obj_name}.{field_name}")

    assert not violations, f"Campos float sin unidad explícita: {violations}"
