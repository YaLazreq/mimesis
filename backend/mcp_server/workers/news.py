import logging
import asyncio
from typing import Optional
from google.genai import types

from mcp_server.clients import genai_client
from mcp_server.helpers.utils import _parse_json_response
from mcp_server.helpers.api_helpers import _push_state, _push_ui_layout_add

logger = logging.getLogger("mimesis.tools")

async def _worker_news(session_id: str, brand_name: str, await_event: Optional[asyncio.Event] = None, set_event: Optional[asyncio.Event] = None):
    logger.info(f"Worker 3 (News) started for {brand_name}")
    try:
        response = await genai_client.aio.models.generate_content(
            model='gemini-2.5-flash',
            contents=f"""
            Find the latest news and most viral campaigns for brand: {brand_name}. 
            - *Compress news titles to 4-5 words max*. 
            - *Get 3 recent news items*.
            - *Get 3 best campaigns* (Return ONLY a short punchy title of 4-5 words max, NOT a summary or description).

            Respond ONLY with a valid JSON format matching exactly this schema. Be careful to escape any quotes inside your strings:
            {{
                "brand_last_news": [{{"title": "string", "summary": "string"}}],
                "brand_viral_campaign": ["string (4-5 words max, title only)"]
            }}
            """,
            config=types.GenerateContentConfig(
                tools=[{"google_search": {}}],
                temperature=0.2,
            ),
        )
        logger.info(f"Worker 3 raw output: {response.text}")
        data = _parse_json_response(str(response.text))
        
        if await_event:
            await await_event.wait()
            await asyncio.sleep(1.5)

        if data:
            await _push_state(session_id, data)
            await _push_ui_layout_add(session_id, list(data.keys()))
        
        logger.info("Worker 3 (News) completed ✅")
        
        if set_event:
            set_event.set()
    except Exception as e:
        logger.error(f"Worker 3 failed: {e}")
        if set_event:
            set_event.set()
