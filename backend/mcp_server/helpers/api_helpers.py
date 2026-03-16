import os
import httpx
import logging

logger = logging.getLogger("mimesis.tools")

STATE_API_URL = os.getenv("STATE_API_URL", f"http://localhost:{os.getenv('PORT', '8000')}")


# ========================================
# Unified state push — always call this one
# ========================================

async def _push_state(session_id: str, data: dict) -> bool:
    """Push data to BOTH the custom AgentState (frontend/DB) and the ADK session.state (model context).

    This is the single entry point for all state updates from workers.
    It guarantees both stores stay in sync.

    - AgentState: powers the frontend via WebSocket, will be persisted to DB later.
    - ADK state: visible to the Gemini model via {key} templating and tool context.
    """
    agent_ok = await _push_agent_state(session_id, data)
    adk_ok = await _push_adk_state(session_id, data)

    if agent_ok and adk_ok:
        logger.info(f"✅ State synced (agent + ADK): {list(data.keys())}")
    elif agent_ok:
        logger.warning(f"⚠️ State partial — agent OK, ADK failed: {list(data.keys())}")
    elif adk_ok:
        logger.warning(f"⚠️ State partial — ADK OK, agent failed: {list(data.keys())}")
    else:
        logger.error(f"❌ State sync failed entirely: {list(data.keys())}")

    return agent_ok and adk_ok


# ========================================
# Internal helpers — not called directly by workers
# ========================================

async def _push_agent_state(session_id: str, data: dict) -> bool:
    """POST a partial state update to the custom AgentState store (frontend/DB)."""
    url = f"{STATE_API_URL}/api/state/update"
    payload = {"session_id": session_id, "data": data}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, timeout=5.0)
            resp.raise_for_status()
            return True
    except Exception as e:
        logger.warning(f"❌ Failed to push agent state: {e}")
        return False


async def _push_adk_state(session_id: str, data: dict) -> bool:
    """POST data into the ADK session.state (model context)."""
    url = f"{STATE_API_URL}/api/session/adk-state"
    payload = {"session_id": session_id, "data": data}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, timeout=5.0)
            resp.raise_for_status()
            return True
    except Exception as e:
        logger.warning(f"❌ Failed to push ADK state: {e}")
        return False


# ========================================
# UI layout helpers
# ========================================

async def _push_ui_layout(session_id: str, components: list[str]) -> bool:
    """POST a UI layout change (replace) to the FastAPI server."""
    url = f"{STATE_API_URL}/api/state/layout"
    payload = {"session_id": session_id, "visible_components": components}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, timeout=5.0)
            resp.raise_for_status()
            logger.info(f"✅ Layout pushed: {components} → {resp.status_code}")
            return True
    except Exception as e:
        logger.warning(f"❌ Failed to push layout update: {e}")
        return False


async def _push_ui_layout_add(session_id: str, components: list[str]) -> bool:
    """POST a UI layout append to the FastAPI server."""
    url = f"{STATE_API_URL}/api/state/layout/add"
    payload = {"session_id": session_id, "visible_components": components}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, timeout=5.0)
            resp.raise_for_status()
            logger.info(f"✅ Layout appended: {components} → {resp.status_code}")
            return True
    except Exception as e:
        logger.warning(f"❌ Failed to append layout: {e}")
        return False


# ========================================
# Notification helper
# ========================================

async def _push_session_notify(session_id: str, message: str) -> bool:
    """POST a notification to inject a message into the agent's LiveRequestQueue."""
    url = f"{STATE_API_URL}/api/session/notify"
    payload = {"session_id": session_id, "message": message}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, timeout=5.0)
            resp.raise_for_status()
            logger.info(f"✅ Notification pushed for session {session_id}")
            return True
    except Exception as e:
        logger.warning(f"❌ Failed to push notification: {e}")
        return False


# ========================================
# State read helper
# ========================================

async def _fetch_state(session_id: str) -> dict:
    """GET the full current state for a session from the AgentStateStore.

    Falls back to the /_active endpoint when session_id is empty or the
    direct lookup returns nothing — this handles the common case where the
    model doesn't know (or passes an empty) session_id to MCP tools.
    """
    # Strategy 1: direct lookup (if we actually have a session_id)
    if session_id:
        url = f"{STATE_API_URL}/api/state/{session_id}"
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, timeout=5.0)
                resp.raise_for_status()
                data = resp.json()
                if data:
                    return data
        except Exception as e:
            logger.warning(f"⚠️ Direct state fetch failed for '{session_id}': {e}")

    # Strategy 2: fallback to the active session (always works)
    url_active = f"{STATE_API_URL}/api/state/_active"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url_active, timeout=5.0)
            resp.raise_for_status()
            data = resp.json()
            if data:
                logger.info(f"✅ State fetched via _active fallback ({len(data)} keys)")
                return data
    except Exception as e:
        logger.warning(f"❌ Active state fetch also failed: {e}")

    return {}

