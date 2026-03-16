"""UI & Phase Control Tools."""

import logging

from mcp_server.helpers.api_helpers import _push_ui_layout, _push_state

logger = logging.getLogger("mimesis.tools")


def register(mcp):
    """Register UI control tools on the MCP server."""

    import time as _time
    _layout_last_call: dict[str, tuple[float, str]] = {}
    _LAYOUT_DEDUP_WINDOW = 2.0  # seconds

    @mcp.tool()
    async def set_ui_layout(
        session_id: str = "",
        visible_components: str = "all",
    ) -> dict:
        """Control which UI components are displayed on the frontend.

        Use this tool to show or hide sections of the interface based on
        what the user wants to see. The frontend will only render the
        components listed in visible_components.

        Each component ID maps directly to a data field — one field, one toggle.

        Available component IDs:
            brand_name, brand_slogan, style_keywords, brand_symbols,
            brand_mission, brand_common_enemy, brand_strategy, brand_last_news,
            brand_viral_campaign, brand_creative_angle, primary_color, secondary_color, uploaded_images,
            ad_objective, ad_audience, ad_product, ad_emotion, ad_format, master_sequence,
            anchor_image, scene_1, scene_2, scene_3, scene_4, scene_5, scene_6,
            production_workshop

        Pass component IDs as a comma-separated string.

        Args:
            session_id: The current session ID (required).
            visible_components: Comma-separated component IDs to display.

        Returns:
            Confirmation of the layout change.
        """
        components = [c.strip() for c in visible_components.split(",") if c.strip()] or ["all"]
        comp_str = ",".join(sorted(components))
        
        # Dedup guard to prevent Gemini parallel function call glitch
        now = _time.time()
        last_time, last_comp = _layout_last_call.get(session_id, (0.0, ""))
        if last_comp == comp_str and (now - last_time) < _LAYOUT_DEDUP_WINDOW:
            logger.info(f"⚠️ Dedup: set_ui_layout({components}) skipped (duplicate call in {_LAYOUT_DEDUP_WINDOW}s)")
            return {
        "status": "success",
        "message": f"UI layout already updated. Silent Dedup logic completed.",
    }
        _layout_last_call[session_id] = (now, comp_str)

        logger.info(f"🖼️  UI Layout change requested: {components}")

        pushed = await _push_ui_layout(session_id, components)

        return {
            "status": "success",
            "pushed_to_frontend": pushed,
            "visible_components": components,
            "message": f"UI layout updated: showing {components}." if pushed else "Layout stored (push failed)",
        }

    _phase_last_call: dict[str, tuple[float, str]] = {}
    _PHASE_DEDUP_WINDOW = 2.0  # seconds

    @mcp.tool()
    async def set_phase(session_id: str, phase: str) -> dict:
        """Explicitly set the current session phase.

        Use this to transition the UI between major steps.

        Available phases:
            brand_research — Step 1 (default, brand DNA exploration)
            brief          — Step 2 Phase A (creative brief Q&A)
            sequence       — Step 2 Phase B (master sequence generation)
            validated      — Step 2 Phase C (sequence confirmed)
            production     — Step 3 (production workshop — image generation)
            production_complete — Step 3 done (all scenes locked)

        Args:
            session_id: The current session ID.
            phase: One of the valid phases.

        Returns:
            Confirmation of the phase change.
        """
        valid_phases = {
            "brand_research", "brief", "sequence", "validated",
            "production", "production_complete",
        }
        phase_clean = phase.strip().lower()

        if phase_clean not in valid_phases:
            return {"status": "error", "message": f"Invalid phase '{phase}'. Must be one of: {sorted(valid_phases)}"}
            
        now = _time.time()
        last_time, last_phase = _phase_last_call.get(session_id, (0.0, ""))
        if last_phase == phase_clean and (now - last_time) < _PHASE_DEDUP_WINDOW:
            logger.info(f"⚠️ Dedup: set_phase('{phase_clean}') skipped (duplicate call in {_PHASE_DEDUP_WINDOW}s)")
            return {
                "status": "success",
                "message": f"Session phase already changed to '{phase_clean}'. Silent Dedup logic completed.",
            }
        _phase_last_call[session_id] = (now, phase_clean)

        await _push_state(session_id, {"current_phase": phase_clean})

        logger.info(f"🔄 Phase set to '{phase_clean}' for session {session_id}")

        return {
            "status": "success",
            "phase": phase_clean,
            "message": f"Session phase changed to '{phase_clean}'.",
        }
