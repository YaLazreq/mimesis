"""Step 1 — Brand Research Tools."""

import asyncio
import logging

from mcp_server.helpers.api_helpers import _fetch_state
from mcp_server.workers.identity import _worker_identity
from mcp_server.workers.visual_identity import _worker_visual_identity
from mcp_server.workers.philosophy import _worker_philosophy
from mcp_server.workers.news import _worker_news
from mcp_server.workers.culture import _worker_culture

logger = logging.getLogger("mimesis.tools")

# ── Topic → state key mapping ────────────────────────────────────────────────
TOPIC_KEY_MAP = {
    "all": None,  # Special: returns everything
    # Step 1 — Brand Research
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
    "images": "uploaded_images",
    # Step 2 — Discovery Brief
    "objective": ["ad_objective", "ad_objective_summary"],
    "audience": [
        "audience_age_range", "audience_gender", "audience_mindset",
        "audience_relationship_to_brand", "audience_persona_name", "audience_persona_summary",
    ],
    "product": [
        "product_name", "product_category", "product_key_feature",
        "product_visual_anchor", "product_image_ref",
    ],
    "emotion": ["ad_emotion_primary", "ad_emotion_secondary", "ad_tone", "ad_tone_references"],
    "format": ["ad_duration", "ad_platform", "ad_mandatories", "ad_music_direction"],
    "sequence": "master_sequence",
    "brief": [
        "ad_objective", "ad_objective_summary",
        "audience_age_range", "audience_gender", "audience_mindset",
        "audience_relationship_to_brand", "audience_persona_name", "audience_persona_summary",
        "product_name", "product_category", "product_key_feature",
        "product_visual_anchor", "product_image_ref",
        "ad_emotion_primary", "ad_emotion_secondary", "ad_tone", "ad_tone_references",
        "ad_duration", "ad_platform", "ad_mandatories", "ad_music_direction",
    ],
    # Step 3 — Production Workshop
    "style_guide": "visual_style_guide",
    "anchor": "anchor_image_uri",
    "scenes": "scene_keyframes",
}


def register(mcp):
    """Register Step 1 tools on the MCP server."""

    # Anti-duplicate guard — prevents the Live model from calling tools twice
    _active_sprints: set[str] = set()

    @mcp.tool()
    async def launch_brand_research_sprint(session_id: str, brand_name: str) -> dict:
        """Launch a set of 5 parallel background workers to research a brand's identity, visual details, philosophy, news, and strategy.

        This function returns immediately. The background workers will silently research
        and push the UI updates, and notify you as they finish via [WORKER NOTIFICATION] system messages.

        Args:
            session_id: The current session ID (required for state routing).
            brand_name: Name of the brand to research.
        """
        # Anti-duplicate guard
        guard_key = f"sprint_{brand_name.lower().strip()}"
        if guard_key in _active_sprints:
            logger.info(f"⚠️ Sprint already running for {brand_name} — skipping duplicate call")
            return {"status": "already_running", "message": f"Research sprint for {brand_name} is already in progress. Wait for notifications."}
        _active_sprints.add(guard_key)

        logger.info(f"🚀 Launching sprint for {brand_name} (session {session_id})")

        # ── Phase gates ─────────────────────────────────────────────────────
        identity_done = asyncio.Event()
        philosophy_done = asyncio.Event()
        news_done = asyncio.Event()
        phase2_done = asyncio.Event()

        async def _phase2_barrier():
            await philosophy_done.wait()
            await news_done.wait()
            phase2_done.set()

        # Phase 1: Identity first
        asyncio.create_task(_worker_identity(session_id, brand_name, set_event=identity_done))

        # Phase 2: Visual Identity, Philosophy, News — all after Identity
        asyncio.create_task(_worker_visual_identity(session_id, brand_name, await_event=identity_done, set_event=None))
        asyncio.create_task(_worker_philosophy(session_id, brand_name, await_event=identity_done, set_event=philosophy_done))
        asyncio.create_task(_worker_news(session_id, brand_name, await_event=identity_done, set_event=news_done))

        # Barrier: wait for Philosophy + News before Culture
        asyncio.create_task(_phase2_barrier())

        # Phase 3: Culture — after Philosophy + News
        asyncio.create_task(_worker_culture(session_id, brand_name, await_event=phase2_done, set_event=None))

        return {
            "status": "success",
            "message": f"Brand research sprint launched. Workers are hunting for {brand_name}. You may briefly acknowledge this to the user.",
        }

    # Dedup cache — prevent the Live model from getting the same data twice in quick succession
    import time as _time
    _memory_last_call: dict[str, float] = {}
    _MEMORY_DEDUP_WINDOW = 5.0  # seconds

    @mcp.tool()
    async def get_brand_memory(session_id: str, topic: str = "all") -> dict:
        """Retrieve brand data.
        
        CRITICAL RULE: DO NOT use this tool if you already received the data via a [WORKER NOTIFICATION]. 
        Your memory (context) already contains all recent notifications.
        ONLY use this tool if you have completely forgotten the details and truly have no other way to answer.

        Available topics:
            all, news, campaigns, mission, enemy, strategy, symbols, creative, identity, colors, name, slogan, images, style_guide, anchor, scenes.

        Args:
            session_id: The current session ID.
            topic: One of the available topics (default: "all").
        """
        # Dedup guard — same topic within 5s returns short response
        cache_key = f"{session_id}_{topic}"
        now = _time.time()
        last = _memory_last_call.get(cache_key, 0)
        if now - last < _MEMORY_DEDUP_WINDOW:
            logger.info(f"⚠️ Dedup: get_brand_memory('{topic}') called again within {_MEMORY_DEDUP_WINDOW}s — returning short response")
            return {"status": "already_provided", "message": f"You already have the {topic} data. Use it now — do not call this tool again."}
        _memory_last_call[cache_key] = now

        logger.info(f"🧠 Memory lookup requested: topic='{topic}' (session {session_id})")

        state = await _fetch_state(session_id)

        if not state:
            logger.warning(f"🧠 Memory lookup EMPTY STATE for session '{session_id}'")
            return {
                "status": "no_data",
                "message": "No brand data has been collected yet. Launch a research sprint first.",
            }

        logger.info(f"🧠 State fetched OK — keys present: {list(state.keys())}")

        topic_lower = topic.strip().lower()
        keys = TOPIC_KEY_MAP.get(topic_lower)

        # "all" → return everything
        if keys is None:
            internal_keys = {"visible_components", "all_research_complete"}
            filtered = {k: v for k, v in state.items() if k not in internal_keys}
            logger.info(f"🧠 Returning ALL data — {len(filtered)} keys")
            return {"status": "ok", "topic": "all", "data": filtered}

        # Single key
        if isinstance(keys, str):
            value = state.get(keys)
            if value is None:
                logger.warning(f"🧠 Key '{keys}' not found in state for topic '{topic}'")
                return {
                    "status": "not_available",
                    "message": f"Data for '{topic}' has not been collected yet. Workers may still be in progress.",
                }
            logger.info(f"🧠 Returning topic='{topic}' — data found")
            return {"status": "ok", "topic": topic, "key": keys, "data": value}

        # Multiple keys
        multi_result = {}
        for k in keys:
            v = state.get(k)
            if v is not None:
                multi_result[k] = v

        if not multi_result:
            logger.warning(f"🧠 No keys found for topic '{topic}'")
            return {
                "status": "not_available",
                "message": f"Data for '{topic}' has not been collected yet. Workers may still be in progress.",
            }
        logger.info(f"🧠 Returning topic='{topic}' — {len(multi_result)} keys")
        return {"status": "ok", "topic": topic, "data": multi_result}
