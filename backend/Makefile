.PHONY: run logs

run:
	SSL_CERT_FILE=$$(python -m certifi) uvicorn main:app --host 0.0.0.0 --port 8000 --reload

logs:
	tail -f /Users/yan/Development/mimesis/backend/mcp_server/tools.log
