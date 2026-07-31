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
  - Unit tests: Vitest (frontend), pytest (backend)
  - E2E tests: Playwright
- **Database Migrations**: Schema migrations are currently implemented in the ORM and executed manually (no automated migration tool like Alembic yet).

