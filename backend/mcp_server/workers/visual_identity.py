import logging
import asyncio
import json
from typing import Optional
from google.genai import types

from mcp_server.clients import genai_client
from mcp_server.helpers.utils import _parse_json_response
from mcp_server.helpers.api_helpers import _push_state, _push_ui_layout_add, _push_session_notify

logger = logging.getLogger("mimesis.tools")

async def _worker_visual_identity(session_id: str, brand_name: str, await_event: Optional[asyncio.Event] = None, set_event: Optional[asyncio.Event] = None):
    logger.info(f"Worker 5 (Visual Identity) started for {brand_name}")
    try:
        response = await genai_client.aio.models.generate_content(
            model='gemini-2.5-flash',
            contents=f"""
            Find the detailed visual identity for brand: {brand_name}. 
            Strictly determine their:
            - *secondary colors* (Must be ONLY raw HEX codes, e.g. "#000000"),
            - *typography / font families used*,
            - *logo description* (a short textual description of the logo).

            CRITICAL: For colors, return ONLY the raw string hexadecimal value. Do NOT include text descriptions like "Red" or "Pantone".

            Respond ONLY with a valid JSON format matching exactly this schema:
            {{
                "secondary_color": ["string"],
                "font_family": ["string"],
                "logo_description": "string"
            }}
            """,
            config=types.GenerateContentConfig(
                tools=[{"google_search": {}}],
                temperature=0.2,
            ),
        )
        logger.info(f"Worker 5 raw output: {response.text}")
        data = _parse_json_response(str(response.text))

        if not data:
            logger.error("Worker 5: empty data after parsing")
            if set_event:
                set_event.set()
            return

        # Wait for identity to be displayed first, then push visual details
        if await_event:
            await await_event.wait()
            await asyncio.sleep(1.5)

        # Unified push: frontend AgentState + ADK session.state
        await _push_state(session_id, data)
        await _push_ui_layout_add(session_id, list(data.keys()))

        # Build a concise summary of the data for the notification
        data_summary = json.dumps(data, ensure_ascii=False, indent=None)
        
        # Brief delay to let the model finish processing previous notifications
        await asyncio.sleep(2.0)
        
        await _push_session_notify(
            session_id,
            f"[WORKER NOTIFICATION — VISUAL IDENTITY]: Visual identity details are now available for {brand_name}. "
            f"Here is the data:\n{data_summary}\n\n"
            f"DO NOT repeat any analysis you have already given about the brand identity."
        )

        if set_event:
            set_event.set()
    except Exception as e:
        logger.error(f"Worker 5 failed: {e}")
        if set_event:
            set_event.set()
