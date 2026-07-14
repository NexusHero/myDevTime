# myDevTime — local dev loop.
# One command to run the app exactly as CI and production do: the same Docker
# images, the same compose stack, the same acceptance tests. See CONTRIBUTING.md
# ("Running the whole thing locally") and ADR-0052/0053.
#
# Quick start:
#   make up        # build + start the full stack (Postgres · Redis · api · web)
#   open http://localhost:8080
#   make e2e       # run the browser acceptance tests against it
#   make down      # stop everything (and wipe volumes)

COMPOSE      := docker compose
E2E_COMPOSE  := $(COMPOSE) -f docker-compose.yml -f docker-compose.e2e.yml
BASE_URL     := http://localhost:8080

.DEFAULT_GOAL := help
.PHONY: help gate up up-e2e down logs ps smoke e2e e2e-install acceptance wait-web

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

gate: ## Run the full local gate (== CI): build, lint, types, tests+coverage, docs, req-coverage
	./test.sh

up: ## Build + start the production-like stack (web on :8080)
	$(COMPOSE) up -d --build
	@echo "▶ web:  $(BASE_URL)"
	@echo "▶ logs: make logs   ·   stop: make down"

up-e2e: ## Start the stack with the E2E overlay (email verification off, in dev only)
	$(E2E_COMPOSE) up -d --build

down: ## Stop the stack and remove its volumes
	$(COMPOSE) -f docker-compose.yml -f docker-compose.e2e.yml down -v

logs: ## Tail the stack logs
	$(COMPOSE) logs -f

ps: ## Show stack status
	$(COMPOSE) ps

wait-web: ## Block until the web app answers 200 on :8080
	@echo "Waiting for $(BASE_URL) ..."
	@for _ in $$(seq 1 60); do \
		if [ "$$(curl -s -o /dev/null -w '%{http_code}' $(BASE_URL)/)" = "200" ]; then \
			echo "web is up"; exit 0; \
		fi; \
		sleep 2; \
	done; \
	echo "web did not come up in time" >&2; exit 1

smoke: ## Black-box HTTP smoke the running stack (ADR-0052)
	./scripts/container-smoke.sh

e2e-install: ## Install the Playwright deps + Chromium (once)
	cd e2e && pnpm install --ignore-workspace && pnpm exec playwright install --with-deps chromium

e2e: ## Run the browser acceptance tests against an already-running stack
	cd e2e && E2E_BASE_URL=$(BASE_URL) pnpm test

acceptance: up-e2e wait-web e2e-install e2e ## Full loop: bring up the E2E stack, then run acceptance tests
	@echo "✓ acceptance run complete — 'make down' to stop the stack"
