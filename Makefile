.PHONY: test-e2e test-e2e-down

test-e2e:
	podman-compose up -d
	cd client && bun run test:e2e

test-e2e-down:
	podman-compose down
