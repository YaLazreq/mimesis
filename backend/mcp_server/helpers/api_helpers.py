import os
import httpx
import logging

logger = logging.getLogger("mimesis.tools")

STATE_API_URL = os.getenv("STATE_API_URL", "http://localhost:8000")

async def _push_state_update(session_id: str, data: dict) -> bool:
    """POST a partial state update to the FastAPI server's state endpoint.

    Returns True on success, False on failure (non-blocking).
    The backend state store will resolve the session_id to the active
    frontend session if the provided one is empty or unknown.
    """
    url = f"{STATE_API_URL}/api/state/update"
    payload = {"session_id": session_id, "data": data}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, timeout=5.0)
            resp.raise_for_status()
            logger.info(f"✅ State pushed: {list(data.keys())} → {resp.status_code}")
            return True
    except Exception as e:
        logger.warning(f"❌ Failed to push state update: {e}")
        return False


async def _push_ui_layout(session_id: str, components: list[str]) -> bool:
    """POST a UI layout change to the FastAPI server.

    The backend state store will resolve the session_id to the active
    frontend session if the provided one is empty or unknown.
    """
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


async def _push_session_notify(session_id: str, message: str) -> bool:
    """POST a notification payload to the FastAPI server to inject a message to the agent."""
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
