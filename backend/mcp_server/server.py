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

from mcp_server.helpers.api_helpers import _push_ui_layout, _fetch_state
from mcp_server.workers.identity import _worker_identity
from mcp_server.workers.visual_identity import _worker_visual_identity
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

# ── Topic → state key mapping for get_brand_memory ───────────────────────────
TOPIC_KEY_MAP = {
    "all": None,  # Special: returns everything
    "news": "brand_last_news",
    "campaigns": "brand_viral_campaign",
    "mission": "brand_mission",
    "enemy": "brand_common_enemy",
    "strategy": "brand_strategy",
    "symbols": "brand_symbols",
    "creative": "brand_creative_angle",
    "identity": ["brand_name", "brand_slogan", "primary_color", "secondary_color", "style_keywords"],
    "colors": ["primary_color", "secondary_color"],
    "name": "brand_name",
    "slogan": "brand_slogan",
}

# ========================================
# Tools — add all your custom tools below
# ========================================

@mcp.tool()
async def launch_brand_research_sprint(session_id: str, brand_name: str) -> dict:
    """Launch a set of 5 parallel background workers to research a brand's identity, visual details, philosophy, news, and strategy.
    
    This function returns immediately. The background workers will silently research
    and push the UI updates, and notify you as they finish via [WORKER NOTIFICATION] system messages.

    Args:
        session_id: The current session ID (required for state routing).
        brand_name: Name of the brand to research.
    """
    logger.info(f"🚀 Launching sprint for {brand_name} (session {session_id})")
    
    # ── Phase gates ─────────────────────────────────────────────────────────
    identity_done = asyncio.Event()    # Phase 1 → Phase 2
    philosophy_done = asyncio.Event()  # Worker 2 done
    news_done = asyncio.Event()        # Worker 3 done
    phase2_done = asyncio.Event()      # Phase 2 → Phase 3 (both 2+3 done)

    async def _phase2_barrier():
        """Wait for Workers 2 AND 3 before unlocking Worker 4."""
        await philosophy_done.wait()
        await news_done.wait()
        phase2_done.set()

    # ── Phase 1: Identity (must complete first for brand name + colors) ─────
    asyncio.create_task(_worker_identity(session_id, brand_name, set_event=identity_done))

    # ── Phase 2: Visual Identity, Philosophy, News — all start after Identity
    # They run their Gemini calls immediately but wait for identity_done before pushing UI
    asyncio.create_task(_worker_visual_identity(session_id, brand_name, await_event=identity_done, set_event=None))
    asyncio.create_task(_worker_philosophy(session_id, brand_name, await_event=identity_done, set_event=philosophy_done))
    asyncio.create_task(_worker_news(session_id, brand_name, await_event=identity_done, set_event=news_done))

    # ── Barrier: wait for both Philosophy + News before Culture ─────────────
    asyncio.create_task(_phase2_barrier())

    # ── Phase 3: Culture — runs after Philosophy + News are displayed ───────
    asyncio.create_task(_worker_culture(session_id, brand_name, await_event=phase2_done, set_event=None))
    
    return {
        "status": "success",
        "message": f"Brand research sprint launched. Workers are now hunting for {brand_name}."
    }

# ── Debounce cache for get_brand_memory (Live API sends duplicate calls) ──────
import time
_memory_cache: dict[str, tuple[float, dict]] = {}  # key → (timestamp, result)
_DEBOUNCE_SECONDS = 2.0


@mcp.tool()
async def get_brand_memory(session_id: str, topic: str = "all") -> dict:
    """Retrieve brand data that your research team has already collected.

    Use this tool whenever you need to recall or reference brand information —
    for example when the user asks a question about the brand's news, strategy,
    colors, mission, campaigns, etc.

    Available topics:
        all       — Returns ALL collected data at once
        news      — Latest news articles
        campaigns — Viral / iconic campaigns
        mission   — Brand mission statement
        enemy     — What the brand fights against
        strategy  — Strategic direction
        symbols   — Brand symbols and icons
        creative  — Creative angles (art, cinema, music references)
        identity  — Brand name, slogan, colors, style keywords
        colors    — Primary and secondary brand colors
        name      — Official brand name
        slogan    — Brand tagline

    Args:
        session_id: The current session ID.
        topic: One of the available topics above (default: "all").

    Returns:
        The requested brand data, or an explanation if data is not yet available.
    """
    logger.info(f"🧠 Memory lookup requested: topic='{topic}' (session {session_id})")

    # ── Debounce: skip duplicate calls within 2s ─────────────────────────
    cache_key = f"{session_id}:{topic.strip().lower()}"
    now = time.monotonic()
    if cache_key in _memory_cache:
        last_time, last_result = _memory_cache[cache_key]
        if now - last_time < _DEBOUNCE_SECONDS:
            logger.info(f"🧠 Debounce: duplicate call for '{topic}' ignored (within {_DEBOUNCE_SECONDS}s)")
            return {"status": "already_returned", "message": "You already have this data from the previous call. No need to repeat your analysis."}

    state = await _fetch_state(session_id)

    if not state:
        return {
            "status": "no_data",
            "message": "No brand data has been collected yet. Launch a research sprint first."
        }

    topic_lower = topic.strip().lower()
    keys = TOPIC_KEY_MAP.get(topic_lower)

    # "all" → return everything (excluding internal keys like visible_components)
    if keys is None:
        internal_keys = {"visible_components"}
        filtered = {k: v for k, v in state.items() if k not in internal_keys}
        result = {"status": "ok", "topic": "all", "data": filtered}
        _memory_cache[cache_key] = (now, result)
        return result

    # Single key
    if isinstance(keys, str):
        value = state.get(keys)
        if value is None:
            return {"status": "not_available", "message": f"Data for '{topic}' has not been collected yet. Workers may still be in progress."}
        result = {"status": "ok", "topic": topic, "key": keys, "data": value}
        _memory_cache[cache_key] = (now, result)
        return result

    # Multiple keys (e.g. identity, colors)
    multi_result = {}
    for k in keys:
        v = state.get(k)
        if v is not None:
            multi_result[k] = v

    if not multi_result:
        return {"status": "not_available", "message": f"Data for '{topic}' has not been collected yet. Workers may still be in progress."}
    result = {"status": "ok", "topic": topic, "data": multi_result}
    _memory_cache[cache_key] = (now, result)
    return result


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
