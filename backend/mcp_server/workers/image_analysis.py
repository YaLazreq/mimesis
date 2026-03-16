"""Worker 6 — Image Analysis.

Analyzes a user-uploaded product image using Gemini Vision,
then pushes the analysis into the agent state and notifies the live agent.
"""

import logging
import asyncio
from typing import Optional
from google.genai import types

from mcp_server.clients import genai_client
from mcp_server.helpers.utils import _parse_json_response
from mcp_server.helpers.api_helpers import (
    _push_state,
    _push_ui_layout_add,
    _push_session_notify,
)

logger = logging.getLogger("mimesis.tools")


async def _worker_image_analysis(
    session_id: str,
    brand_name: str,
    image_bytes: bytes,
    image_mime_type: str,
    gcs_uri: str,
    user_context: str = "",
) -> None:
    """Analyze an uploaded product image and push results to the agent.

    Args:
        session_id: Active session ID.
        brand_name: The brand currently being analyzed (from state).
        image_bytes: Raw image file bytes.
        image_mime_type: MIME type (e.g., "image/jpeg").
        gcs_uri: GCS URI where the image was stored.
        user_context: Optional context from the user (e.g., "new product for a forest ad").
    """
    logger.info(f"Worker 6 (Image Analysis) started for {brand_name} — {gcs_uri}")

    context_prompt = ""
    if user_context:
        context_prompt = f"\nThe user said about this image: \"{user_context}\"\nIncorporate this context into your analysis."

    try:
        image_part = types.Part.from_bytes(data=image_bytes, mime_type=image_mime_type)

        response = await genai_client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        image_part,
                        types.Part.from_text(text=f"""
You are a senior creative director analyzing a product image for brand: {brand_name}.
{context_prompt}

Analyze this image thoroughly and provide:
1. **Product description**: What is the product? Describe it visually in detail (shape, color, materials, packaging, textures).
2. **Visual mood**: What feeling/atmosphere does this image convey? (e.g., premium, playful, natural, tech-forward)
3. **Color palette**: Extract the dominant colors from the image as HEX codes.
4. **Creative potential**: How could this product be featured in a commercial or campaign? Give 2-3 creative directions.
5. **Brand alignment**: How well does this product image align with {brand_name}'s existing brand identity?

Respond ONLY with a valid JSON format matching this schema:
{{
    "product_description": "string (detailed visual description)",
    "visual_mood": "string (atmosphere/feeling keywords)",
    "image_colors": ["string (HEX codes)"],
    "creative_directions": [
        {{"title": "string (3-5 words)", "description": "string (detailed creative idea)"}}
    ],
    "brand_alignment": "string (how it fits the brand)"
}}
"""),
                    ]
                )
            ],
            config=types.GenerateContentConfig(
                temperature=0.5,
                response_mime_type="application/json",
            ),
        )

        logger.info(f"Worker 6 raw output: {response.text}")
        data = _parse_json_response(str(response.text))

        if not data:
            logger.error("Worker 6: empty data after parsing")
            await _push_session_notify(
                session_id,
                f"[WORKER NOTIFICATION]: Image analysis failed for {brand_name}. "
                f"The image could not be processed. Ask the user to try again."
            )
            return

        # Build the image entry for state
        image_entry = {
            "gcs_uri": gcs_uri,
            "analysis": data,
            "user_context": user_context,
        }

        # Push analysis data to state (but do NOT add uploaded_images
        # to the UI layout — the upload zone should stay hidden.
        # The agent controls visibility via set_ui_layout.)
        await _push_state(session_id, {"uploaded_images": [image_entry]})

        # DO NOT notify the agent — it already sees the image via WebSocket
        # and is reacting in real-time. The structured analysis is stored
        # silently in state for later retrieval via get_brand_memory(topic='images').

        logger.info("Worker 6 (Image Analysis) completed ✅ — data stored silently in state")

    except Exception as e:
        logger.error(f"Worker 6 failed: {e}", exc_info=True)

