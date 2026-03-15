import logging
import asyncio
from typing import Optional
from google.genai import types

from mcp_server.clients import genai_client
from mcp_server.helpers.utils import _parse_json_response
from mcp_server.helpers.api_helpers import _push_state_update, _push_ui_layout_add, _push_session_notify

logger = logging.getLogger("mimesis.tools")

async def _worker_philosophy(session_id: str, brand_name: str, await_event: Optional[asyncio.Event] = None, set_event: Optional[asyncio.Event] = None):
    logger.info(f"Worker 2 (Philosophy) started for {brand_name}")
    try:
        response = await genai_client.aio.models.generate_content(
            model='gemini-2.5-flash',
            contents=f"""
            Find the core philosophy for brand: {brand_name}. 
            Discover their official 
            - *slogan/catchphrase*, 
            - *mission statement*, 
            - *what common enemy they fight against* (),
            - *5-6 style keywords defining their vibe*.

            Respond ONLY with a valid JSON format matching exactly this schema:
            {{
                "brand_slogan": "string",
                "brand_mission": "string",
                "brand_common_enemy": ["string"],
                "style_keywords": ["string"]
            }}
            """,
            config=types.GenerateContentConfig(
                tools=[{"google_search": {}}],
                temperature=0.2
            ),
        )
        logger.info(f"Worker 2 raw output: {{response.text}}")
        data = _parse_json_response(str(response.text))
        
        if await_event:
            await await_event.wait()
            await asyncio.sleep(1.5)
            
        await _push_state_update(session_id, data)
        await _push_ui_layout_add(session_id, list(data.keys()))
        # NOTE: Silent worker - no session notification pushed to avoid queuing
        
        if set_event:
            set_event.set()
    except Exception as e:
        logger.error(f"Worker 2 failed: {e}")
        if set_event:
            set_event.set()
