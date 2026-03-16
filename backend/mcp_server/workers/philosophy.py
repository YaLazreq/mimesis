import logging
import asyncio
from typing import Optional
from google.genai import types

from mcp_server.clients import genai_client
from mcp_server.helpers.utils import _parse_json_response
from mcp_server.helpers.api_helpers import _push_state, _push_ui_layout_add

logger = logging.getLogger("mimesis.tools")

async def _worker_philosophy(session_id: str, brand_name: str, await_event: Optional[asyncio.Event] = None, set_event: Optional[asyncio.Event] = None):
    logger.info(f"Worker 2 (Philosophy) started for {brand_name}")
    try:
        response = await genai_client.aio.models.generate_content(
            model='gemini-2.5-flash',
            contents=f"""
            Find the core philosophy for brand: {brand_name}. 
            - *mission statements* (MAXIMUM 4 statements. Each phrase MUST be 6-7 words maximum — short, punchy, billboard-ready), 
            - *what common enemy they fight against* (MAXIMUM 4 statements. Each enemy MUST be 3-4 words maximum — short, punchy, billboard-ready. ONE ENEMY BY LINE), 
            - *5-6 style keywords defining their vibe*.

            Respond ONLY with a valid JSON format matching exactly this schema:
            {{
                "brand_slogan": "string",
                "brand_mission": ["string (6-7 words max each)"],
                "brand_common_enemy": ["string (3-4 words max each)"],
                "style_keywords": ["string"]
            }}
            """,
            config=types.GenerateContentConfig(
                tools=[{"google_search": {}}],
                temperature=0.2,
            ),
        )
        logger.info(f"Worker 2 raw output: {response.text}")
        data = _parse_json_response(str(response.text))
        
        if await_event:
            await await_event.wait()
            await asyncio.sleep(1.5)

        if data:
            await _push_state(session_id, data)
            await _push_ui_layout_add(session_id, list(data.keys()))
        
        logger.info("Worker 2 (Philosophy) completed ✅")
        
        if set_event:
            set_event.set()
    except Exception as e:
        logger.error(f"Worker 2 failed: {e}")
        if set_event:
            set_event.set()
