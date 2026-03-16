.PHONY: run-backend logs-backend docker-up docker-down docker-build

# ── Local (no Docker) ────────────────────────────────────────────────────────
run-backend:
	@echo "Starting the Mimesis backend..."
	cd backend && SSL_CERT_FILE=$$(python -m certifi) uvicorn main:app --host 0.0.0.0 --port 8000 --reload

logs-backend:
	@echo "Tailing backend logs..."
	tail -f ./backend/mcp_server/tools.log

# ── Docker (backend + frontend in one shot) ──────────────────────────────────
docker-up:
	@echo "🚀 Launching Mimesis (backend + frontend) via Docker..."
	docker compose up --build

docker-down:
	@echo "🛑 Stopping Mimesis..."
	docker compose down

docker-build:
	@echo "🔨 Building Mimesis containers..."
	docker compose build
