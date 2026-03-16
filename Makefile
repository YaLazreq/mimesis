.PHONY: run-backend logs-backend

run-backend:
	@echo "Starting the Mimesis backend..."
	cd backend && SSL_CERT_FILE=$$(python -m certifi) uvicorn main:app --host 0.0.0.0 --port 8000 --reload

logs-backend:
	@echo "Tailing backend logs..."
	tail -f ./backend/mcp_server/tools.log
