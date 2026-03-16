import logging
import asyncio
import json
from typing import Optional
from google.genai import types

from mcp_server.clients import genai_client
from mcp_server.helpers.utils import _parse_json_response
from mcp_server.helpers.api_helpers import _push_state, _push_ui_layout, _push_session_notify

logger = logging.getLogger("mimesis.tools")

async def _worker_identity(session_id: str, brand_name: str, set_event: Optional[asyncio.Event] = None):
    logger.info(f"Worker 1 (Identity) started for {brand_name}")
    try:
        response = await genai_client.aio.models.generate_content(
            model='gemini-2.5-flash',
            contents=f"""
            Find the brand identity basics for: {brand_name}. 
            Strictly determine their:
            - *official brand name* (exact casing and spelling),
            - *primary colors* (Must be ONLY raw HEX codes, e.g. "#FF0000").

            CRITICAL: For colors, return ONLY the raw string hexadecimal value. Do NOT include text descriptions like "Red" or "Pantone".
            Example of correct primary_color: ["#C70039", "#FFFFFF"]

            Respond ONLY with a valid JSON format matching exactly this schema:
            {{
                "brand_name": "string",
                "primary_color": ["string"]
            }}
            """,
            config=types.GenerateContentConfig(
                tools=[{"google_search": {}}],
                temperature=0.2,
            ),
        )
        logger.info(f"Worker 1 raw output: {response.text}")
        data = _parse_json_response(str(response.text))

        if not data:
            logger.error("Worker 1: empty data after parsing")
            if set_event:
                set_event.set()
            return

        # Unified push: frontend AgentState + ADK session.state
        await _push_state(session_id, data)
        await _push_ui_layout(session_id, list(data.keys()))

        # Signal phase 2 workers can start pushing UI (before notification delay)
        if set_event:
            set_event.set()

        # Build a concise summary of the data for the notification
        # The Live model can't easily call tools mid-speech, so we include the data directly
        data_summary = json.dumps(data, ensure_ascii=False, indent=None)
        
        # Brief delay to let the model finish its current speech turn
        await asyncio.sleep(2.0)
        
        await _push_session_notify(
            session_id,
            f"[WORKER NOTIFICATION — IDENTITY]: Brand identity research is complete for {brand_name}. "
            f"Here is the data:\n{data_summary}\n\n"
            f"React to the actual colors and brand name you see. Keep it SHORT and punchy. "
            f"DO NOT repeat any analysis you have already given."
        )
    except Exception as e:
        logger.error(f"Worker 1 failed: {e}")
        if set_event:
            set_event.set()
