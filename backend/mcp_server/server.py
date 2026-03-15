"""Mimesis MCP Server — centralizes all custom tools.

This server exposes tools that the ADK agent can call via the
Model Context Protocol (MCP). Add all your custom tools here.

Logs are written to: backend/mcp_server/tools.log
Monitor them with:  tail -f backend/mcp_server/tools.log

Run standalone for testing:
    python -m mcp_server.server
"""

import asyncio
import logging
import os
import sys
from dotenv import load_dotenv

# Ensure the backend directory is in the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mcp.server.fastmcp import FastMCP

from mcp_server.helpers.api_helpers import _push_ui_layout
from mcp_server.workers.identity import _worker_identity
from mcp_server.workers.philosophy import _worker_philosophy
from mcp_server.workers.news import _worker_news
from mcp_server.workers.culture import _worker_culture

# Load environment variables (mostly for GEMINI_API_KEY)
load_dotenv(".env")
load_dotenv("../.env") # Just in case it runs from the MCP server folder

# ========================================
# Logging → file (separate from main server logs)
# ========================================
LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tools.log")

logger = logging.getLogger("mimesis.tools")
logger.setLevel(logging.DEBUG)

# File handler — all tool activity goes here
_file_handler = logging.FileHandler(LOG_FILE, mode="a", encoding="utf-8")
_file_handler.setLevel(logging.DEBUG)
_file_handler.setFormatter(
    logging.Formatter("%(asctime)s — %(levelname)s — %(message)s")
)
logger.addHandler(_file_handler)

# Prevent logs from propagating to root logger (which would go to stdout/stderr)
logger.propagate = False

# ========================================
# MCP Server Instance
# ========================================

mcp = FastMCP("mimesis-tools")


# ========================================
# Tools — add all your custom tools below
# ========================================

@mcp.tool()
async def launch_brand_research_sprint(session_id: str, brand_name: str) -> dict:
    """Launch a set of 4 parallel background workers to research a brand's visual identity, philosophy, news, and strategy.
    
    This function returns immediately. The background workers will silently research
    and push the UI updates, and notify you as they finish via [WORKER NOTIFICATION] system messages.

    Args:
        session_id: The current session ID (required for state routing).
        brand_name: Name of the brand to research.
    """
    logger.info(f"🚀 Launching sprint for {brand_name} (session {session_id})")
    
    # Use cascaded events to ensure UI updates append one by one safely
    identity_done = asyncio.Event()
    philosophy_done = asyncio.Event()
    news_done = asyncio.Event()

    # Fire and forget tasks
    asyncio.create_task(_worker_identity(session_id, brand_name, set_event=identity_done))
    asyncio.create_task(_worker_philosophy(session_id, brand_name, await_event=identity_done, set_event=philosophy_done))
    asyncio.create_task(_worker_news(session_id, brand_name, await_event=philosophy_done, set_event=news_done))
    asyncio.create_task(_worker_culture(session_id, brand_name, await_event=news_done, set_event=None))
    
    return {
        "status": "success",
        "message": f"Brand research sprint launched. Workers are now hunting for {brand_name}."
    }


@mcp.tool()
async def set_ui_layout(
    session_id: str = "",
    visible_components: str = "all",
) -> dict:
    """Control which UI components are displayed on the frontend.

    Use this tool to show or hide sections of the interface based on
    what the user wants to see. The frontend will only render the
    components listed in visible_components.

    Each component ID maps directly to a data field — one field, one toggle.

    Available component IDs:
        brand_name, brand_slogan, brand_symbols, brand_mission,
        brand_common_enemy, brand_strategy, brand_last_news,
        brand_viral_campaign, brand_creative_angle, primary_color,
        secondary_color

    Pass component IDs as a comma-separated string.

    Examples:
        - User says "Show me just the news" → visible_components="brand_last_news"
        - User says "Show me everything" → visible_components="all"
        - User says "Show the slogan and strategy" → visible_components="brand_slogan,brand_strategy"
        - User says "Show me the slogan, the news, and the mission" → visible_components="brand_slogan,brand_last_news,brand_mission"

    Args:
        session_id: The current session ID (required).
        visible_components: Comma-separated component IDs to display (e.g. "brand_slogan,brand_strategy").

    Returns:
        Confirmation of the layout change.
    """
    # Parse comma-separated string into a list
    components = [c.strip() for c in visible_components.split(",") if c.strip()] or ["all"]

    logger.info(f"🖼️  UI Layout change requested: {components}")

    pushed = await _push_ui_layout(session_id, components)

    return {
        "status": "success",
        "pushed_to_frontend": pushed,
        "visible_components": components,
        "message": f"UI layout updated: showing {components}" if pushed else "Layout stored (push failed)",
    }


# ========================================
# Server Entry Point
# ========================================

if __name__ == "__main__":
    logger.info("🚀 Starting Mimesis MCP Server (stdio)...")
    mcp.run(transport="stdio")
