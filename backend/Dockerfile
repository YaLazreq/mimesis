# ── Stage 1: Install dependencies with uv ────────────────────────────────────
FROM python:3.14-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM python:3.14-slim

WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder /app/.venv /app/.venv

# Copy application code
COPY . .

# Activate venv
ENV PATH="/app/.venv/bin:$PATH"

# Cloud Run convention
ENV PORT=8080

# Vertex AI configuration (required by genai.Client in MCP subprocess)
# The .env file is excluded from Docker builds via .dockerignore,
# so these MUST be set here or via Cloud Run env vars.
ENV GOOGLE_CLOUD_PROJECT=gemini-live-488903
ENV GOOGLE_CLOUD_LOCATION=us-central1
ENV GOOGLE_GENAI_USE_VERTEXAI=TRUE
ENV DEMO_AGENT_MODEL=gemini-live-2.5-flash-native-audio

EXPOSE 8080

# SSL_CERT_FILE is required for Vertex AI TLS calls
CMD ["sh", "-c", "SSL_CERT_FILE=$(python -m certifi) uvicorn main:app --host 0.0.0.0 --port 8080"]
