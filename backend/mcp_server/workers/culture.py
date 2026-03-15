import logging
import asyncio
from typing import Optional
from google.genai import types

from mcp_server.clients import genai_client
from mcp_server.helpers.utils import _parse_json_response
from mcp_server.helpers.api_helpers import _push_state_update, _push_ui_layout_add

logger = logging.getLogger("mimesis.tools")

async def _worker_culture(session_id: str, brand_name: str, await_event: Optional[asyncio.Event] = None, set_event: Optional[asyncio.Event] = None):
    logger.info(f"Worker 4 (Culture) started for {brand_name}")
    try:
        response = await genai_client.aio.models.generate_content(
            model='gemini-2.5-flash',
            contents=f"""
            Find the cultural strategy for brand: {brand_name}. 
            - *What is their strategic direction*, 
            - *what are their main visual symbols / representations / icons (e.g., a signature crown, a certain fruit, a specific character or shape)*, 
            - *creative angles in poetry, painting, music, metaphor, and cinema*

            Respond ONLY with a valid JSON format matching exactly this schema:
            {{
                "brand_strategy": "string",
                "brand_symbols": ["string"],
                "brand_creative_angle": {{
                    "poetry": "string",
                    "painting": "string",
                    "music": "string",
                    "metaphor": "string",
                    "cinema": "string"
                }}
            }}
            """,
            config=types.GenerateContentConfig(
                tools=[{"google_search": {}}],
                temperature=0.5
            ),
        )
        logger.info(f"Worker 4 raw output: {{response.text}}")
        data = _parse_json_response(str(response.text))
        
        if await_event:
            await await_event.wait()
            await asyncio.sleep(1.5)
        
        if data:
            await _push_state_update(session_id, data)
            await _push_ui_layout_add(session_id, list(data.keys()))
        
        # Mark this worker as done in the state
        await _push_state_update(session_id, {"worker_culture_done": True})
        logger.info("Worker 4 (Culture) completed ✅")
        
        if set_event:
            set_event.set()
    except Exception as e:
        logger.error(f"Worker 4 failed: {e}")
        # Still mark as done (with error) so the pipeline isn't stuck
        await _push_state_update(session_id, {"worker_culture_done": True})
        if set_event:
            set_event.set()

