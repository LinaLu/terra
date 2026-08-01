.DEFAULT_GOAL := help

.PHONY: help test test-backend test-frontend test-e2e test-e2e-down up down logs

help:
	@echo "Available targets:"
	@echo "  help           - Show this help message"
	@echo "  up             - Bring up the containers"
	@echo "  down           - Shut down the containers"
	@echo "  logs           - Stream container logs"
	@echo "  test           - Run all tests (backend and frontend)"
	@echo "  test-backend   - Run backend tests"
	@echo "  test-frontend  - Run frontend tests"
	@echo "  test-e2e       - Run end-to-end tests"
	@echo "  test-e2e-down  - Shut down containers after e2e tests"

up:
	podman-compose up -d

down:
	podman-compose down

logs:
	podman-compose logs -f

test: test-backend test-frontend

test-backend:
	cd server && source .venv/bin/activate && pytest

test-frontend:
	cd client && bun run test --run

test-e2e:
	podman-compose up -d
	cd client && bun run test:e2e

test-e2e-down:
	podman-compose down
