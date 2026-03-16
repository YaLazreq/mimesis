"""Mimesis MCP Server — centralizes all custom tools.

This server exposes tools that the ADK agent can call via the
Model Context Protocol (MCP). Tools are organized by step in the tools/ package.

Logs are written to: backend/mcp_server/tools.log
Monitor them with:  tail -f backend/mcp_server/tools.log

Run standalone for testing:
    python -m mcp_server.server
"""

import logging
import os
import sys

from dotenv import load_dotenv

# Ensure the backend directory is in the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mcp.server.fastmcp import FastMCP

# Load environment variables (mostly for GEMINI_API_KEY)
load_dotenv(".env")
load_dotenv("../.env")

# ========================================
# Logging → file (separate from main server logs)
# ========================================
LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tools.log")

logger = logging.getLogger("mimesis.tools")
logger.setLevel(logging.DEBUG)

_file_handler = logging.FileHandler(LOG_FILE, mode="a", encoding="utf-8")
_file_handler.setLevel(logging.DEBUG)
_file_handler.setFormatter(
    logging.Formatter("%(asctime)s — %(levelname)s — %(message)s")
)
logger.addHandler(_file_handler)
logger.propagate = False

# ========================================
# MCP Server Instance
# ========================================

mcp = FastMCP("mimesis-tools")

# ========================================
# Register all tools from organized modules
# ========================================

from mcp_server.tools import step1_tools, step2_tools, step3_tools, step4_tools, ui_tools

step1_tools.register(mcp)
step2_tools.register(mcp)
step3_tools.register(mcp)
step4_tools.register(mcp)
ui_tools.register(mcp)

# ========================================
# Server Entry Point
# ========================================

if __name__ == "__main__":
    logger.info("🚀 Starting Mimesis MCP Server (stdio)...")
    mcp.run(transport="stdio")
