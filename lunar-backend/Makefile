.PHONY: setup data data-dev precompute run test test-all lint typecheck

setup:
	uv sync && uv run pre-commit install

data:
	uv run python -m pipeline all --dem-mode full

data-dev:
	uv run python -m pipeline all --dem-mode window --radius-km 150

precompute:
	uv run python -m pipeline precompute-horizons

run:
	uv run uvicorn app.main:app --reload --port 8000

test:
	uv run pytest

test-all:
	uv run pytest -m "" --cov-fail-under=0

lint:
	uv run ruff check . && uv run ruff format --check .

typecheck:
	uv run mypy app pipeline
