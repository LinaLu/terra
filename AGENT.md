# AGENT.md

This file provides guidance to AI agents when working with code in this repository.

## Project

**terra** is a team retrospective board application.

## Architecture & Tech Stack

The application is structured as a frontend/backend split with a relational database.

- **Frontend**: React + TypeScript + Vite, using Axios and bun.
- **Backend**: Python 3 with FastAPI and SQLAlchemy.
- **Database**: PostgreSQL.
- **Linting**: ESLint for frontend, Ruff for backend.
- **Testing**: 
  - Unit tests: Vitest (frontend), pytest (backend). Run `make test` from the root directory to execute the full unit test sweep across backend and frontend.
  - E2E tests: Playwright. Run `make test-e2e` to start services and execute E2E tests (`make test-e2e-down` to clean up).
- **Database Migrations**: Schema migrations are currently implemented in the ORM and executed manually (no automated migration tool like Alembic yet).

## GitHub Operations

- All `gh` operations MUST be prefixed with `GH_CONFIG_DIR=../.config/gh_auth` and with parameter `--repo LinaLu/terra` (e.g. `GH_CONFIG_DIR=../.config/gh_auth gh pr create --repo LinaLu/terra`).
- Pull Requests should be created using `gh` with a lean, concise description.
