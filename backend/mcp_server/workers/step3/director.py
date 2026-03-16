"""Worker Director — Step 3 Phase A.

Generates the visual style guide + enriched scenes (Gemini 2.5 Pro),
then generates the anchor image (Nano Banana).
"""

import logging

from google.genai import types

from mcp_server.clients import genai_client
from mcp_server.helpers.utils import _parse_json_response
from mcp_server.helpers.image_helpers import (
    download_image_bytes,
    upload_image_bytes,
    extract_image_bytes,
    build_image_part,
)
from mcp_server.helpers.api_helpers import (
    _push_state,
    _push_ui_layout_add,
    _push_session_notify,
    _resolve_session_id,
)
from mcp_server.helpers.gcs_helpers import get_public_url
from mcp_server.workers.step3.prompts import (
    build_director_prompt,
    build_anchor_prompt,
)

logger = logging.getLogger("mimesis.tools")

# Model names
DIRECTOR_MODEL = "gemini-2.5-pro"
IMAGE_MODEL = "gemini-2.5-flash-image"


async def _worker_director(
    session_id: str,
    brand_data: dict,
    brief_data: dict,
    master_sequence: list,
    product_image_uri: str = "",
    anchor_feedback: str = "",
) -> None:
    """Generate visual style guide, enriched scenes, and anchor image.

    Args:
        session_id: Active session ID.
        brand_data: Brand intelligence from Step 1.
        brief_data: Brief variables from Step 2.
        master_sequence: The validated 6-scene master sequence.
        product_image_uri: GCS URI of the uploaded product image (optional).
        anchor_feedback: If regenerating anchor, user feedback to incorporate.
    """
    # Resolve session_id to the real active session (agent often passes "session_id" literally)
    session_id = await _resolve_session_id(session_id)

    brand_name = brand_data.get("brand_name", "Unknown Brand")
    logger.info(f"🎬 Worker Director started for {brand_name} (resolved session: {session_id})")

    try:
        # ── Step 1: Generate style guide + enriched scenes (Gemini 2.5 Pro) ──
        style_guide, enriched_scenes = await _generate_style_and_scenes(
            brand_data, brief_data, master_sequence
        )

        if not style_guide or not enriched_scenes:
            await _notify_failure(session_id, brand_name, "style guide and enriched scenes")
            return

        # Push style guide + enriched scenes to state
        await _push_state(session_id, {
            "visual_style_guide": style_guide,
            "enriched_scenes": enriched_scenes,
        })

        logger.info(f"🎬 Style guide + {len(enriched_scenes)} enriched scenes generated")

        # ── Step 2: Generate anchor image (Nano Banana) ──────────────────────
        anchor_uri = await _generate_anchor_image(
            session_id, style_guide, enriched_scenes[0],
            brand_name, product_image_uri, anchor_feedback,
        )

        if not anchor_uri:
            await _notify_failure(session_id, brand_name, "anchor image")
            return

        # Push anchor image URI to state
        await _push_state(session_id, {"anchor_image_uri": anchor_uri})
        await _push_ui_layout_add(session_id, ["anchor_image"])

        # Notify the live agent
        anchor_public_url = get_public_url(anchor_uri)
        await _push_session_notify(
            session_id,
            f"[WORKER NOTIFICATION — ANCHOR IMAGE READY]: "
            f"The visual direction for {brand_name} is set.\n"
            f"Anchor image: {anchor_public_url}\n"
            f"Style guide summary: {style_guide.get('art_direction', 'N/A')}\n"
            f"Visual keywords: {', '.join(style_guide.get('visual_keywords', []))}\n\n"
            f"Present the anchor image to the team. Explain the visual direction: "
            f"lighting ({style_guide.get('lighting_style', '')}), "
            f"camera ({style_guide.get('camera_style', '')}), "
            f"and overall mood. "
            f"Ask if they validate this direction or want adjustments.",
        )

        logger.info("🎬 Worker Director completed ✅")

    except Exception as e:
        logger.error(f"🎬 Worker Director failed: {e}", exc_info=True)
        await _notify_failure(session_id, brand_name, "production")


async def _generate_style_and_scenes(
    brand_data: dict,
    brief_data: dict,
    master_sequence: list,
) -> tuple[dict, list]:
    """Call Gemini 2.5 Pro to generate style guide + enriched scenes."""
    prompt = build_director_prompt(brand_data, brief_data, master_sequence)

    response = await genai_client.aio.models.generate_content(
        model=DIRECTOR_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.7,
            response_mime_type="application/json",
        ),
    )

    logger.info(f"🎬 Director raw output length: {len(response.text or '')} chars")
    data = _parse_json_response(str(response.text))

    style_guide = data.get("visual_style_guide", {})
    enriched_scenes = data.get("enriched_scenes", [])

    return style_guide, enriched_scenes


async def _generate_anchor_image(
    session_id: str,
    style_guide: dict,
    scene_1: dict,
    brand_name: str,
    product_image_uri: str = "",
    feedback: str = "",
) -> str | None:
    """Generate the anchor image using Nano Banana.

    Returns:
        GCS URI of the anchor image, or None on failure.
    """
    prompt = build_anchor_prompt(style_guide, scene_1, brand_name)

    if feedback:
        prompt += f"\n\nUSER FEEDBACK ON PREVIOUS ANCHOR: {feedback}. Incorporate this feedback."

    # Build contents list: prompt + optional product image reference
    contents: list = [prompt]

    if product_image_uri:
        try:
            product_bytes = download_image_bytes(product_image_uri)
            contents.append(build_image_part(product_bytes))
            logger.info("📸 Product image loaded as reference for anchor generation")
        except Exception as e:
            logger.warning(f"⚠️ Could not load product image: {e}")

    response = await genai_client.aio.models.generate_content(
        model=IMAGE_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            response_modalities=["TEXT", "IMAGE"],
            image_config=types.ImageConfig(
                aspect_ratio=style_guide.get("format_ratio", "16:9"),
            ),
        ),
    )

    image_bytes = extract_image_bytes(response)
    if not image_bytes:
        logger.error("🎬 No image returned from Nano Banana for anchor")
        return None

    # Save to GCS
    anchor_uri = upload_image_bytes(session_id, "anchor_image.png", image_bytes)
    return anchor_uri


async def _notify_failure(session_id: str, brand_name: str, step: str) -> None:
    """Send a failure notification to the live agent."""
    await _push_session_notify(
        session_id,
        f"[WORKER NOTIFICATION]: {step.title()} generation failed for {brand_name}. "
        f"Ask the user if they'd like to try again.",
    )
