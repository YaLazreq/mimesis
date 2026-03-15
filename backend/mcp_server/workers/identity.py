import logging
import asyncio
from typing import Optional
from google.genai import types

from mcp_server.clients import genai_client
from mcp_server.helpers.utils import _parse_json_response
from mcp_server.helpers.api_helpers import _push_state_update, _push_ui_layout, _push_session_notify

logger = logging.getLogger("mimesis.tools")

async def _worker_identity(session_id: str, brand_name: str, set_event: Optional[asyncio.Event] = None):
    logger.info(f"Worker 1 (Identity) started for {brand_name}")
    try:
        response = await genai_client.aio.models.generate_content(
            model='gemini-2.5-flash',
            contents=f"""
            Find the visual identity details for brand: {brand_name}. 
            Strictly determine their 
            - *primary colors* (Must be ONLY raw HEX codes, e.g. "#FF0000"), 
            - *secondary colors* (Must be ONLY raw HEX codes, e.g. "#000000"), 
            - *typography*, 
            - *logo*. 
            This is for a creative director dashboard.

            CRITICAL: For colors, return ONLY the raw string hexadecimal value. Do NOT include text descriptions like "Red" or "Pantone".
            Example of correct primary_color: ["#C70039", "#FFFFFF"]

            Respond ONLY with a valid JSON format matching exactly this schema:
            {{
                "brand_name": "string",
                "primary_color": ["string"],
                "secondary_color": ["string"],
                "font_family": ["string"],
                "logo_description": "string"
            }}
            """,
            config=types.GenerateContentConfig(
                tools=[{"google_search": {}}],
                temperature=0.2
            ),
        )
        logger.info(f"Worker 1 raw output: {{response.text}}")
        data = _parse_json_response(str(response.text))
        await _push_state_update(session_id, data)
        await _push_ui_layout(session_id, list(data.keys()))
        await _push_session_notify(session_id, f"[WORKER NOTIFICATION]: Worker 1 (Visual Identity) has finished recovering the visual identity for {brand_name}. I have sent the colors and font. They are now avaialble")
        if set_event:
            set_event.set()
    except Exception as e:
        logger.error(f"Worker 1 failed: {e}")
        if set_event:
            set_event.set()
