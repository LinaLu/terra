.PHONY: test test-backend test-frontend test-e2e test-e2e-down

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
