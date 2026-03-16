import logging
import asyncio
from typing import Optional
from google.genai import types

from mcp_server.clients import genai_client
from mcp_server.helpers.utils import _parse_json_response
from mcp_server.helpers.api_helpers import _push_state, _push_ui_layout_add, _push_session_notify

logger = logging.getLogger("mimesis.tools")

async def _worker_culture(session_id: str, brand_name: str, await_event: Optional[asyncio.Event] = None, set_event: Optional[asyncio.Event] = None):
    logger.info(f"Worker 4 (Culture) started for {brand_name}")
    try:
        response = await genai_client.aio.models.generate_content(
            model='gemini-2.5-flash',
            contents=f"""
            Find the cultural strategy for brand: {brand_name}. 
            - *What is their strategic direction* (break it down into 3-4 distinct strategic pillars),
            - *What are their main visual symbols / representations / icons* (e.g., a signature crown, a certain fruit, a specific character or shape — give 3-5 symbols),
            - *Creative angles in poetry, painting, music, metaphor, and cinema* (develop each angle in depth in the summary, but keep the title to 3-5 words max).

            IMPORTANT FORMATTING RULES:
            - Every "title" field must be SHORT: 3-5 words maximum, like a headline.
            - Every "summary" field should be a rich, detailed explanation (1-3 sentences).
            - Return lists of objects, NOT single strings.

            Respond ONLY with a valid JSON format matching exactly this schema:
            {{
                "brand_strategy": [{{"title": "string (3-5 words)", "summary": "string (detailed explanation)"}}],
                "brand_symbols": [{{"title": "string (3-5 words)", "summary": "string (what it represents)"}}],
                "brand_creative_angle": [{{"title": "string (3-5 words, e.g. Poetry, Cinema)", "summary": "string (detailed creative interpretation)"}}]
            }}
            """,
            config=types.GenerateContentConfig(
                tools=[{"google_search": {}}],
                temperature=0.5
            ),
        )
        logger.info(f"Worker 4 raw output: {response.text}")
        data = _parse_json_response(str(response.text))
        
        if await_event:
            await await_event.wait()
            await asyncio.sleep(1.5)
        
        if data:
            await _push_state(session_id, data)
            await _push_ui_layout_add(session_id, list(data.keys()))

        # Mark all research as done
        await _push_state(session_id, {"all_research_complete": True})

        # Signal notification — data is already in session.state, do NOT re-send it
        await _push_session_notify(
            session_id,
            f"[WORKER NOTIFICATION]: All research is now complete for {brand_name}. "
            f"The dashboard now includes: identity, visual identity, philosophy (slogan, mission, enemy), news, campaigns, strategy, symbols, and creative angles. "
            f"Use get_brand_memory to recall any specific data you need. "
            f"Deliver your global creative pitch — connect the dots across ALL the data. "
            f"IMPORTANT: Do NOT repeat anything you have already said. Focus only on NEW insights."
        )

        logger.info("Worker 4 (Culture) completed ✅")
        
        if set_event:
            set_event.set()
    except Exception as e:
        logger.error(f"Worker 4 failed: {e}")
        await _push_state(session_id, {"all_research_complete": True})
        await _push_session_notify(
            session_id,
            f"[WORKER NOTIFICATION]: All research is complete for {brand_name}. "
            f"Note: Culture worker had issues, but the rest of the dashboard is populated. "
            f"Deliver your global creative pitch with what we have."
        )
        if set_event:
            set_event.set()
