"""Step 4 — Video Generation Tools."""

import asyncio
import logging

from mcp_server.helpers.api_helpers import _push_state, _fetch_state, _resolve_session_id
from mcp_server.workers.step4.video_generator_worker import _worker_video_generator

logger = logging.getLogger("mimesis.tools")

def register(mcp):
    """Register Step 4 tools on the MCP server."""

    # Anti-duplicate guard
    _active_tasks: set[str] = set()

    @mcp.tool()
    async def generate_final_video(session_id: str) -> dict:
        """Launch the fully automated Step 4 Video Generation pipeline.
        
        This tool replaces the manual sequence validation step. It:
        1. Uses Gemini 2.5 Pro to expand the 6 scenes into a 10-14 clip sequence with inserts.
        2. Calls the Veo API sequentially to generate all clips (using the extend feature for perfect continuity).
        3. Stitches them together via ffmpeg into a final 25-35s video.
        4. Uploads all clips and the final video to Google Cloud Storage.
        
        Call this tool ONLY AFTER Step 3 (Production Workshop) is completely locked.
        
        Args:
            session_id: The current session ID.
            
        Returns:
            Confirmation that video generation has started.
        """
        logger.info(f"🎥 Final video generation requested (session {session_id})")

        session_id = await _resolve_session_id(session_id)

        task_key = f"video_gen_{session_id}"
        if task_key in _active_tasks:
            return {"status": "already_running", "message": "Video generation is already in progress. Wait for the final notification."}
        _active_tasks.add(task_key)

        state = await _fetch_state(session_id)
        if not state:
            _active_tasks.discard(task_key)
            return {"status": "error", "message": "No state found."}

        if not state.get("all_scenes_validated"):
            _active_tasks.discard(task_key)
            return {"status": "error", "message": "Production workshop is not complete. Validate all 6 scenes first."}

        # Validate that we have all essential data
        enriched_scenes = state.get("enriched_scenes", [])
        if not enriched_scenes:
            _active_tasks.discard(task_key)
            return {"status": "error", "message": "No enriched scenes found in state."}

        style_guide = state.get("visual_style_guide", {})
        master_sequence = state.get("master_sequence", [])
        
        brand_keys = [
            "brand_name", "brand_slogan", "primary_color", "secondary_color",
            "brand_mission", "brand_strategy", "brand_common_enemy",
            "brand_symbols", "brand_creative_angle", "style_keywords",
        ]
        brand_data = {k: state.get(k) for k in brand_keys if state.get(k)}
        
        brief_keys = [
            "ad_objective", "ad_objective_summary",
            "product_name", "product_category", "product_key_feature",
            "product_visual_anchor",
            "ad_emotion_primary", "ad_emotion_secondary",
            "ad_tone", "ad_tone_references",
            "ad_duration", "ad_platform", "ad_mandatories", "ad_music_direction",
        ]
        brief_data = {k: state.get(k) for k in brief_keys if state.get(k)}

        # Update phase to trigger UI loading state
        await _push_state(session_id, {
            "current_phase": "video_generation",
            "is_generating_video": True,
            "video_generation_progress": "Starting video generation engine...",
        })

        # Launch the orchestrator worker
        task = asyncio.create_task(
            _worker_video_generator(
                session_id=session_id,
                enriched_scenes=enriched_scenes,
                style_guide=style_guide,
                master_sequence=master_sequence,
                brand_data=brand_data,
                brief_data=brief_data,
                state=state
            )
        )
        task.add_done_callback(lambda _: _active_tasks.discard(task_key))

        return {
            "status": "success",
            "message": "Step 4 Video Generation Pipeline started. This will take a few minutes. You will be notified when the final video is ready.",
        }
