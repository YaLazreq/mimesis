"""Scene Worker — Step 3 Phase B.

Generates 2 keyframes (start + end) for a single scene using Nano Banana.
Multiple scene workers run in parallel — one per scene.
"""

import logging

from google.genai import types

from mcp_server.clients import genai_client
from mcp_server.helpers.image_helpers import (
    upload_image_bytes,
    extract_image_bytes,
    build_image_part,
)
from mcp_server.helpers.api_helpers import (
    _push_state,
    _push_ui_layout_add,
    _resolve_session_id,
)
from mcp_server.workers.step3.prompts import build_keyframe_prompt

logger = logging.getLogger("mimesis.tools")

IMAGE_MODEL = "gemini-2.5-flash-image"


async def _worker_scene(
    session_id: str,
    scene: dict,
    style_guide: dict,
    anchor_image_bytes: bytes | None,
    product_image_bytes: bytes | None,
    brand_name: str,
    feedback: str = "",
) -> bool:
    """Generate 2 keyframes for a single scene.

    Args:
        session_id: Active session ID.
        scene: The enriched scene data (from director).
        style_guide: The visual style guide.
        anchor_image_bytes: Raw bytes of the validated anchor (for style consistency).
        product_image_bytes: Raw bytes of the uploaded product (optional).
        brand_name: Brand name for context.
        feedback: Optional user feedback for regeneration.

    Returns:
        True if both keyframes were generated successfully.
    """
    # Resolve session_id to the real active session
    session_id = await _resolve_session_id(session_id)

    scene_num = scene.get("scene_number", 0)
    logger.info(f"🎬 Scene Worker {scene_num} started — {scene.get('beat_name', '?')} (session: {session_id})")

    try:
        # Generate start keyframe
        start_uri = await _generate_keyframe(
            session_id, scene, style_guide, anchor_image_bytes,
            product_image_bytes, brand_name, "start", feedback,
        )

        # Generate end keyframe
        end_uri = await _generate_keyframe(
            session_id, scene, style_guide, anchor_image_bytes,
            product_image_bytes, brand_name, "end", feedback,
        )

        if not start_uri or not end_uri:
            logger.error(f"🎬 Scene Worker {scene_num}: keyframe generation failed")
            return False

        # Push keyframes to state
        await _push_state(session_id, {
            f"scene_{scene_num}_keyframe_start": start_uri,
            f"scene_{scene_num}_keyframe_end": end_uri,
        })

        # Add scene to visible components
        await _push_ui_layout_add(session_id, [f"scene_{scene_num}"])

        logger.info(f"🎬 Scene Worker {scene_num} completed ✅")
        return True

    except Exception as e:
        logger.error(f"🎬 Scene Worker {scene_num} failed: {e}", exc_info=True)
        return False


async def _generate_keyframe(
    session_id: str,
    scene: dict,
    style_guide: dict,
    anchor_image_bytes: bytes | None,
    product_image_bytes: bytes | None,
    brand_name: str,
    position: str,
    feedback: str = "",
) -> str | None:
    """Generate a single keyframe image.

    Args:
        position: 'start' or 'end'.

    Returns:
        GCS URI of the generated image, or None on failure.
    """
    scene_num = scene.get("scene_number", 0)
    prompt = build_keyframe_prompt(style_guide, scene, position, brand_name)

    if feedback:
        prompt += f"\n\nUSER FEEDBACK: {feedback}. Incorporate this feedback into the image."

    # Build contents: prompt + anchor image (style ref) + product image (optional)
    contents: list = [prompt]
    if anchor_image_bytes:
        contents.append(build_image_part(anchor_image_bytes))
    if product_image_bytes:
        contents.append(build_image_part(product_image_bytes))

    try:
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
            logger.error(f"🎬 No image returned for scene {scene_num} {position}")
            return None

        filename = f"scene_{scene_num}_keyframe_{position}.png"
        uri = upload_image_bytes(session_id, filename, image_bytes)

        logger.info(f"📸 Scene {scene_num} {position} keyframe generated: {uri}")
        return uri

    except Exception as e:
        logger.error(f"🎬 Keyframe generation failed (scene {scene_num} {position}): {e}")
        return None
