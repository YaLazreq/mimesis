"""Step 3 — Production Workshop Tools."""

import asyncio
import json
import logging

from mcp_server.helpers.api_helpers import _push_state, _push_ui_layout_add, _fetch_state, _resolve_session_id
from mcp_server.helpers.image_helpers import download_image_bytes
from mcp_server.workers.step3.director import _worker_director
from mcp_server.workers.step3.scene_worker import _worker_scene

logger = logging.getLogger("mimesis.tools")


def _get_product_image_uri(state: dict) -> str:
    """Extract the product image GCS URI from state.

    The product image is stored in uploaded_images[0].gcs_uri (set during Step 1).
    The field 'product_image_ref' is a *text description*, not a GCS URI.
    """
    uploaded_images = state.get("uploaded_images", [])
    if uploaded_images and isinstance(uploaded_images, list):
        first = uploaded_images[0]
        if isinstance(first, dict):
            return first.get("gcs_uri", "")
    return ""

# ── Brand key set (shared between tools) ─────────────────────────────────────
BRAND_KEYS = frozenset({
    "brand_name", "brand_slogan", "primary_color", "secondary_color",
    "font_family", "logo_description", "brand_mission", "brand_common_enemy",
    "style_keywords", "brand_last_news", "brand_viral_campaign",
    "brand_strategy", "brand_symbols", "brand_creative_angle",
    "uploaded_images",
})


def register(mcp):
    """Register Step 3 tools on the MCP server."""

    # Anti-duplicate guard — prevents the Live model from calling tools twice concurrently
    _active_tasks: set[str] = set()

    @mcp.tool()
    async def launch_production_workshop(session_id: str) -> dict:
        """Launch the Production Workshop — generates visual style guide, enriched scenes, and anchor image.

        Call this tool ONLY after the master sequence has been validated
        (save_sequence_feedback with validated=true).

        This launches a background worker that:
        1. Uses Gemini 2.5 Pro to create a visual style guide and enrich all 6 scenes
        2. Uses Nano Banana 2 to generate an anchor image that defines the ad's visual DNA
        3. Pushes the anchor image to the frontend for validation

        You will be notified when the anchor image is ready.

        Args:
            session_id: The current session ID.

        Returns:
            Confirmation that the production workshop has started.
        """
        logger.info(f"🏭 Production workshop launch requested (session {session_id})")

        # Resolve real session ID (agent may pass a placeholder)
        session_id = await _resolve_session_id(session_id)

        task_key = f"production_{session_id}"
        if task_key in _active_tasks:
            logger.info(f"⚠️ Production already running for {session_id} — skipping duplicate call")
            return {
                "status": "already_running",
                "message": "Production workshop is already in progress. Wait for the anchor image notification.",
            }
        _active_tasks.add(task_key)

        state = await _fetch_state(session_id)
        if not state:
            _active_tasks.discard(task_key)
            return {"status": "error", "message": "No state found. Complete Steps 1 and 2 first."}

        # ── Anti-duplicate guard ──
        if state.get("current_phase") == "production" and state.get("visual_style_guide"):
            _active_tasks.discard(task_key)
            return {
                "status": "already_running",
                "message": "Production workshop is already in progress. Wait for the anchor image notification.",
            }

        # Verify sequence is validated
        if not state.get("master_sequence_validated"):
            _active_tasks.discard(task_key)
            return {
                "status": "error",
                "message": "Master sequence not validated yet. Call save_sequence_feedback(validated=true) first.",
            }

        master_sequence = state.get("master_sequence", [])
        if not master_sequence:
            _active_tasks.discard(task_key)
            return {"status": "error", "message": "No master sequence found in state."}

        brand_data = {k: v for k, v in state.items() if k in BRAND_KEYS}
        brief_keys = {
            "ad_objective", "ad_objective_summary",
            "audience_age_range", "audience_gender", "audience_mindset",
            "audience_relationship_to_brand", "audience_persona_name", "audience_persona_summary",
            "product_name", "product_category", "product_key_feature",
            "product_visual_anchor",
            "ad_emotion_primary", "ad_emotion_secondary", "ad_tone", "ad_tone_references",
            "ad_duration", "ad_platform", "ad_mandatories", "ad_music_direction",
        }
        brief_data = {k: v for k, v in state.items() if k in brief_keys}
        product_image_uri = _get_product_image_uri(state)

        # Update phase
        await _push_state(session_id, {"current_phase": "production"})

        # Launch Worker Director
        task = asyncio.create_task(
            _worker_director(
                session_id=session_id,
                brand_data=brand_data,
                brief_data=brief_data,
                master_sequence=master_sequence,
                product_image_uri=product_image_uri,
            )
        )
        task.add_done_callback(lambda _: _active_tasks.discard(task_key))

        return {
            "status": "success",
            "message": "Production workshop started. The Director is building the visual blueprint. You'll be notified when the anchor image is ready.",
        }

    @mcp.tool()
    async def validate_anchor_image(
        session_id: str,
        approved: bool,
        feedback: str = "",
    ) -> dict:
        """Validate or reject the anchor image generated by the Director.

        If approved=true, this launches 6 parallel Scene Workers to generate
        keyframes for all scenes.
        If approved=false, provide feedback and the Director will regenerate
        a new anchor image.

        Args:
            session_id: The current session ID.
            approved: Whether the team approves the anchor image direction.
            feedback: Feedback for regeneration (only when approved=false).

        Returns:
            Confirmation and next steps.
        """
        logger.info(f"🖼️ Anchor validation: approved={approved}, feedback='{feedback}'")

        session_id = await _resolve_session_id(session_id)
        
        task_key = f"validate_anchor_{session_id}"
        if task_key in _active_tasks:
            return {"status": "already_running", "message": "Validation or regeneration is already in progress."}
        _active_tasks.add(task_key)

        state = await _fetch_state(session_id)
        if not state:
            _active_tasks.discard(task_key)
            return {"status": "error", "message": "No state found."}

        if approved:
            # Lock anchor and launch 6 scene workers
            await _push_state(session_id, {"anchor_validated": True})

            res = await _launch_scene_workers(session_id, state)
            _active_tasks.discard(task_key)
            return res
        else:
            # Regenerate anchor with feedback
            brand_data = {k: v for k, v in state.items() if k in BRAND_KEYS}
            brief_keys = {
                "ad_objective", "ad_objective_summary",
                "product_name", "product_category", "product_key_feature",
                "product_visual_anchor",
                "ad_emotion_primary", "ad_emotion_secondary", "ad_tone", "ad_tone_references",
                "ad_duration", "ad_platform", "ad_mandatories", "ad_music_direction",
            }
            brief_data = {k: v for k, v in state.items() if k in brief_keys}
            product_image_uri = _get_product_image_uri(state)
            master_sequence = state.get("master_sequence", [])

            task = asyncio.create_task(
                _worker_director(
                    session_id=session_id,
                    brand_data=brand_data,
                    brief_data=brief_data,
                    master_sequence=master_sequence,
                    product_image_uri=product_image_uri,
                    anchor_feedback=feedback,
                )
            )
            task.add_done_callback(lambda _: _active_tasks.discard(task_key))

            return {
                "status": "success",
                "message": f"Feedback noted: '{feedback}'. Regenerating anchor image. You'll be notified when ready.",
            }

    @mcp.tool()
    async def regenerate_scene(
        session_id: str,
        scene_number: int,
        feedback: str,
    ) -> dict:
        """Regenerate keyframes for a specific scene based on user feedback.

        Only the targeted scene is regenerated — the other scenes remain unchanged.

        Args:
            session_id: The current session ID.
            scene_number: Which scene to regenerate (1-6).
            feedback: What to change (e.g. "make it darker", "more energy", "change the framing").

        Returns:
            Confirmation that the scene is being regenerated.
        """
        logger.info(f"🔄 Scene {scene_number} regeneration requested: '{feedback}'")

        if scene_number < 1 or scene_number > 6:
            return {"status": "error", "message": "scene_number must be between 1 and 6."}

        session_id = await _resolve_session_id(session_id)

        task_key = f"regenerate_scene_{scene_number}_{session_id}"
        if task_key in _active_tasks:
            return {"status": "already_running", "message": f"Scene {scene_number} is already being regenerated."}
        _active_tasks.add(task_key)

        state = await _fetch_state(session_id)
        if not state:
            _active_tasks.discard(task_key)
            return {"status": "error", "message": "No state found."}

        enriched_scenes = state.get("enriched_scenes", [])
        style_guide = state.get("visual_style_guide", {})
        anchor_uri = state.get("anchor_image_uri", "")
        product_uri = _get_product_image_uri(state)
        brand_name = state.get("brand_name", "Unknown Brand")

        # Find the target scene
        target_scene = None
        for scene in enriched_scenes:
            if scene.get("scene_number") == scene_number:
                target_scene = scene
                break

        if not target_scene:
            _active_tasks.discard(task_key)
            return {"status": "error", "message": f"Scene {scene_number} not found in enriched scenes."}

        # Load reference images as bytes
        try:
            anchor_bytes = download_image_bytes(anchor_uri) if anchor_uri else None
        except Exception:
            anchor_bytes = None

        try:
            product_bytes = download_image_bytes(product_uri) if product_uri else None
        except Exception:
            product_bytes = None

        # Launch single scene worker
        task = asyncio.create_task(
            _worker_scene_with_notify(
                session_id=session_id,
                scene=target_scene,
                style_guide=style_guide,
                anchor_image_bytes=anchor_bytes,
                product_image_bytes=product_bytes,
                brand_name=brand_name,
                feedback=feedback,
            )
        )
        task.add_done_callback(lambda _: _active_tasks.discard(task_key))

        return {
            "status": "success",
            "message": f"Scene {scene_number} is being regenerated with feedback: '{feedback}'. You'll be notified when ready.",
        }

    @mcp.tool()
    async def validate_all_scenes(session_id: str) -> dict:
        """Lock all 6 scenes and complete the Production Workshop.

        Call this when the user has approved all scenes. This sets all scenes
        to locked and transitions to the production_complete phase.

        Args:
            session_id: The current session ID.

        Returns:
            Confirmation that all scenes are locked.
        """
        logger.info(f"🔒 All scenes validation requested (session {session_id})")

        session_id = await _resolve_session_id(session_id)

        task_key = f"validate_all_{session_id}"
        if task_key in _active_tasks:
            return {"status": "already_running", "message": "All scenes validation is already in progress."}
        _active_tasks.add(task_key)

        state = await _fetch_state(session_id)
        if not state:
            _active_tasks.discard(task_key)
            return {"status": "error", "message": "No state found."}

        # Verify all 6 scenes have keyframes
        missing_scenes = []
        for i in range(1, 7):
            if not state.get(f"scene_{i}_keyframe_start") or not state.get(f"scene_{i}_keyframe_end"):
                missing_scenes.append(i)

        if missing_scenes:
            _active_tasks.discard(task_key)
            return {
                "status": "error",
                "message": f"Scenes {missing_scenes} are missing keyframes. Generate them first.",
            }

        # Lock all scenes
        lock_data: dict = {f"scene_{i}_locked": True for i in range(1, 7)}
        lock_data["current_phase"] = "production_complete"
        lock_data["all_scenes_validated"] = True

        await _push_state(session_id, lock_data)

        _active_tasks.discard(task_key)
        logger.info("🔒 All 6 scenes locked — Production Workshop complete ✅")

        return {
            "status": "success",
            "message": "All 6 scenes are locked. Production Workshop is complete. Ready for video generation.",
        }


# ── Private helpers ──────────────────────────────────────────────────────────

async def _launch_scene_workers(session_id: str, state: dict) -> dict:
    """Launch 6 parallel scene workers after anchor validation."""
    from mcp_server.helpers.api_helpers import _push_session_notify

    enriched_scenes = state.get("enriched_scenes", [])
    style_guide = state.get("visual_style_guide", {})
    anchor_uri = state.get("anchor_image_uri", "")
    product_uri = _get_product_image_uri(state)
    brand_name = state.get("brand_name", "Unknown Brand")

    if not enriched_scenes or len(enriched_scenes) < 6:

        return {"status": "error", "message": "Not enough enriched scenes found (need 6)."}

    # Load reference images as bytes once (shared by all workers)
    try:
        anchor_bytes = download_image_bytes(anchor_uri) if anchor_uri else None
    except Exception as e:
        logger.warning(f"⚠️ Could not load anchor image: {e}")
        anchor_bytes = None

    try:
        product_bytes = download_image_bytes(product_uri) if product_uri else None
    except Exception as e:
        logger.warning(f"⚠️ Could not load product image: {e}")
        product_bytes = None

    # Launch all 6 scene workers in parallel
    all_done = asyncio.Event()

    async def _run_all_scenes():
        tasks = [
            _worker_scene(
                session_id=session_id,
                scene=scene,
                style_guide=style_guide,
                anchor_image_bytes=anchor_bytes,
                product_image_bytes=product_bytes,
                brand_name=brand_name,
            )
            for scene in enriched_scenes[:6]
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        success_count = sum(1 for r in results if r is True)
        logger.info(f"🎬 All scene workers done: {success_count}/6 succeeded")

        # Notify agent
        await _push_session_notify(
            session_id,
            f"[WORKER NOTIFICATION — ALL SCENES READY]: "
            f"{success_count}/6 scene keyframes have been generated for {brand_name}.\n"
            f"Each scene now has a start and end keyframe visible on the production workshop.\n\n"
            f"Present the scenario scene by scene with the images. Go through each beat: "
            f"what happens, the emotion, the visual. Keep it cinematic. "
            f"Ask the team for feedback on any scenes they want to adjust.",
        )
        all_done.set()

    asyncio.create_task(_run_all_scenes())

    return {
        "status": "success",
        "message": "Anchor image validated! 6 Scene Workers are now generating keyframes in parallel. You'll be notified when all are ready.",
    }


async def _worker_scene_with_notify(
    session_id: str,
    scene: dict,
    style_guide: dict,
    anchor_image_bytes: bytes | None,
    product_image_bytes: bytes | None,
    brand_name: str,
    feedback: str,
) -> None:
    """Run a single scene worker and notify the agent when done."""
    from mcp_server.helpers.api_helpers import _push_session_notify

    scene_num = scene.get("scene_number", 0)

    success = await _worker_scene(
        session_id=session_id,
        scene=scene,
        style_guide=style_guide,
        anchor_image_bytes=anchor_image_bytes,
        product_image_bytes=product_image_bytes,
        brand_name=brand_name,
        feedback=feedback,
    )

    if success:
        await _push_session_notify(
            session_id,
            f"[WORKER NOTIFICATION — SCENE {scene_num} UPDATED]: "
            f"Scene {scene_num} ({scene.get('beat_name', '?')}) has been regenerated with the feedback. "
            f"Tell the team to check the updated keyframes.",
        )
    else:
        await _push_session_notify(
            session_id,
            f"[WORKER NOTIFICATION]: Scene {scene_num} regeneration failed. "
            f"Ask the team if they'd like to try again.",
        )
