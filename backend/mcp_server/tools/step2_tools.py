"""Step 2 — Discovery Brief Tools."""

import asyncio
import logging

from mcp_server.helpers.api_helpers import (
    _push_state,
    _push_ui_layout_add,
    _fetch_state,
)

logger = logging.getLogger("mimesis.tools")

# ── Valid brief keys & UI group mapping ──────────────────────────────────────

BRIEF_VALID_KEYS = frozenset([
    "ad_objective", "ad_objective_summary",
    "audience_age_range", "audience_gender", "audience_mindset",
    "audience_relationship_to_brand", "audience_persona_name", "audience_persona_summary",
    "product_name", "product_category", "product_key_feature",
    "product_visual_anchor", "product_image_ref",
    "ad_emotion_primary", "ad_emotion_secondary", "ad_tone", "ad_tone_references",
    "ad_duration", "ad_platform", "ad_mandatories", "ad_music_direction",
])

BRIEF_KEY_TO_UI_GROUP = {
    "ad_objective": "ad_objective",
    "ad_objective_summary": "ad_objective",
    "audience_age_range": "ad_audience",
    "audience_gender": "ad_audience",
    "audience_mindset": "ad_audience",
    "audience_relationship_to_brand": "ad_audience",
    "audience_persona_name": "ad_audience",
    "audience_persona_summary": "ad_audience",
    "product_name": "ad_product",
    "product_category": "ad_product",
    "product_key_feature": "ad_product",
    "product_visual_anchor": "ad_product",
    "product_image_ref": "ad_product",
    "ad_emotion_primary": "ad_emotion",
    "ad_emotion_secondary": "ad_emotion",
    "ad_tone": "ad_emotion",
    "ad_tone_references": "ad_emotion",
    "ad_duration": "ad_format",
    "ad_platform": "ad_format",
    "ad_mandatories": "ad_format",
    "ad_music_direction": "ad_format",
}


def register(mcp):
    """Register Step 2 tools on the MCP server."""

    # Anti-duplicate guard — prevents the Live model from calling tools twice
    _active_generators: set[str] = set()

    @mcp.tool()
    async def save_brief_data(session_id: str, data_json: str) -> dict:
        """Save one or more creative brief variables to memory.

        Call this tool after each meaningful exchange with the team to persist
        the brief data. You can save one variable at a time or several at once.
        To EDIT a previously saved variable, simply call again with the same key.

        IMPORTANT: Save data progressively as the conversation flows. Don't wait
        to collect an entire category before saving.

        The data_json argument is a flat JSON object with key-value pairs.

        Valid keys (all optional — write any subset):
            Objective:  ad_objective, ad_objective_summary
            Audience:   audience_age_range, audience_gender, audience_mindset,
                        audience_relationship_to_brand, audience_persona_name, audience_persona_summary
            Product:    product_name, product_category, product_key_feature,
                        product_visual_anchor, product_image_ref
            Emotion:    ad_emotion_primary, ad_emotion_secondary, ad_tone, ad_tone_references
            Format:     ad_duration, ad_platform, ad_mandatories, ad_music_direction

        Args:
            session_id: The current session ID.
            data_json: A JSON string containing key-value pairs to save.

        Returns:
            Which keys were saved, which UI groups were updated, and which keys are still missing.
        """
        import json as _json

        logger.info(f"📝 Brief data save requested (session {session_id})")

        try:
            data = _json.loads(data_json)
        except _json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in save_brief_data: {e}")
            return {"status": "error", "message": f"Invalid JSON: {e}"}

        if not isinstance(data, dict):
            return {"status": "error", "message": "data_json must be a JSON object (dict)"}

        invalid_keys = [k for k in data if k not in BRIEF_VALID_KEYS]
        if invalid_keys:
            return {
                "status": "error",
                "message": f"Invalid brief keys: {invalid_keys}. Valid keys: {sorted(BRIEF_VALID_KEYS)}",
            }

        clean_data = {k: v for k, v in data.items() if v is not None and v != "" and v != []}
        if not clean_data:
            return {"status": "error", "message": "No non-empty values to save."}

        clean_data["current_phase"] = "brief"
        pushed = await _push_state(session_id, clean_data)

        # Auto-append affected UI groups
        affected_groups = list(set(
            BRIEF_KEY_TO_UI_GROUP[k] for k in clean_data if k in BRIEF_KEY_TO_UI_GROUP
        ))
        if affected_groups:
            await _push_ui_layout_add(session_id, affected_groups)

        # Calculate missing keys
        state = await _fetch_state(session_id)
        filled_keys = [k for k in BRIEF_VALID_KEYS if state.get(k) is not None and state.get(k) != "" and state.get(k) != []]
        missing_keys = sorted(BRIEF_VALID_KEYS - set(filled_keys))
        all_filled = len(missing_keys) == 0

        logger.info(
            f"📝 Brief saved: {list(clean_data.keys())} | "
            f"Filled: {len(filled_keys)}/{len(BRIEF_VALID_KEYS)} | "
            f"Missing: {missing_keys}"
        )

        return {
            "status": "success",
            "saved_keys": list(clean_data.keys()),
            "affected_ui_groups": affected_groups,
            "filled_count": len(filled_keys),
            "total_count": len(BRIEF_VALID_KEYS),
            "all_filled": all_filled,
            "missing_keys": missing_keys,
            "message": (
                "All brief variables are filled! You can now call generate_master_sequence."
                if all_filled
                else f"Brief updated. Still missing {len(missing_keys)} keys: {missing_keys}"
            ),
        }

    @mcp.tool()
    async def save_scenario_ideas(session_id: str, ideas: str) -> dict:
        """Save user scenario ideas before generating the master sequence.

        Call this AFTER the brief is complete and the user has provided scenario ideas
        (or said they have none). These ideas will influence the master sequence
        and will be available for later steps.

        Args:
            session_id: The current session ID.
            ideas: The user's scenario ideas as free text. If the user has no ideas,
                   pass an empty string or 'none'.

        Returns:
            Confirmation that the ideas were saved.
        """
        logger.info(f"💡 Scenario ideas save requested (session {session_id})")

        await _push_state(session_id, {"user_scenario_ideas": ideas})

        if ideas and ideas.lower().strip() not in ("", "none", "no", "aucune"):
            logger.info(f"💡 User scenario ideas saved: {ideas[:100]}...")
            return {
                "status": "success",
                "message": "Scenario ideas saved. You can now call generate_master_sequence.",
                "ideas_saved": True,
            }
        else:
            logger.info("💡 No user scenario ideas — will generate from scratch")
            return {
                "status": "success",
                "message": "No scenario ideas provided. The master sequence will be generated from the brief data. Call generate_master_sequence now.",
                "ideas_saved": False,
            }

    @mcp.tool()
    async def generate_master_sequence(session_id: str) -> dict:
        """Generate a 6-scene master sequence based on all collected brand + brief data.

        Call this tool ONLY after all brief variables are filled (save_brief_data
        will tell you when all_filled=true).

        This launches a background worker that:
        1. Reads all brand intelligence + creative brief from memory
        2. Uses the brand's creative angles (poetry, cinema, music) as inspiration
        3. Generates a 6-scene emotional arc (Hook → Context → Product Entry → Transformation → Climax → Resolution)
        4. Pushes the sequence to the frontend and notifies you when ready

        Args:
            session_id: The current session ID.

        Returns:
            Confirmation that the generation has started.
        """
        from mcp_server.workers.sequence_generator import _worker_sequence_generator

        # Anti-duplicate guard
        if "sequence" in _active_generators:
            logger.info("⚠️ Sequence generation already running — skipping duplicate call")
            return {"status": "already_running", "message": "Master sequence is already being generated. Wait for the notification."}
        _active_generators.add("sequence")

        logger.info(f"🎬 Master sequence generation requested (session {session_id})")

        state = await _fetch_state(session_id)
        if not state:
            _active_generators.discard("sequence")
            return {"status": "error", "message": "No state found. Complete brand research and brief first."}

        missing = [k for k in BRIEF_VALID_KEYS if not state.get(k)]
        optional_keys = {"product_image_ref"}
        required_missing = [k for k in missing if k not in optional_keys]
        if required_missing:
            _active_generators.discard("sequence")
            return {
                "status": "error",
                "message": f"Brief is not complete. Missing required keys: {required_missing}. "
                           f"Use save_brief_data to fill them first.",
            }

        brand_keys = {
            "brand_name", "brand_slogan", "primary_color", "secondary_color",
            "font_family", "logo_description", "brand_mission", "brand_common_enemy",
            "style_keywords", "brand_last_news", "brand_viral_campaign",
            "brand_strategy", "brand_symbols", "brand_creative_angle",
            "uploaded_images",
        }
        brand_data = {k: v for k, v in state.items() if k in brand_keys}
        brief_data = {k: v for k, v in state.items() if k in BRIEF_VALID_KEYS}

        user_scenario_ideas = state.get("user_scenario_ideas", "")

        await _push_state(session_id, {"current_phase": "sequence"})

        task = asyncio.create_task(
            _worker_sequence_generator(
                session_id=session_id,
                brand_data=brand_data,
                brief_data=brief_data,
                user_scenario_ideas=user_scenario_ideas,
            )
        )
        task.add_done_callback(lambda _: _active_generators.discard("sequence"))

        return {
            "status": "success",
            "message": "Master sequence generation started. You'll be notified when it's ready.",
        }

    @mcp.tool()
    async def save_sequence_feedback(
        session_id: str,
        validated: bool,
        revision_notes: str = "",
    ) -> dict:
        """Save user feedback on the master sequence.

        If validated=true, the sequence is locked and the session moves to the validated phase.
        If validated=false, provide revision_notes as a comma-separated string. A new sequence
        will be automatically re-generated incorporating the feedback.

        Args:
            session_id: The current session ID.
            validated: Whether the user approves the sequence.
            revision_notes: Comma-separated feedback (only when validated=false).

        Returns:
            Confirmation and next action.
        """
        from mcp_server.workers.sequence_generator import _worker_sequence_generator

        # Anti-duplicate guard
        if "sequence" in _active_generators:
            logger.info("⚠️ Sequence feedback/generation already running — skipping duplicate call")
            return {"status": "already_running", "message": "Sequence generation is already in progress. Wait for the notification."}
        _active_generators.add("sequence")

        logger.info(f"✅ Sequence feedback: validated={validated}, notes='{revision_notes}'")

        if validated:
            await _push_state(session_id, {
                "master_sequence_validated": True,
                "current_phase": "validated",
            })
            _active_generators.discard("sequence")
            return {
                "status": "success",
                "message": "Master sequence validated and locked. Ready for the next step.",
            }

        notes_list = [n.strip() for n in revision_notes.split(",") if n.strip()] if revision_notes else []

        await _push_state(session_id, {
            "master_sequence_revision_notes": notes_list,
            "master_sequence_validated": False,
        })

        state = await _fetch_state(session_id)
        if not state:
            _active_generators.discard("sequence")
            return {"status": "error", "message": "No state found."}

        brand_keys = {
            "brand_name", "brand_slogan", "primary_color", "secondary_color",
            "font_family", "logo_description", "brand_mission", "brand_common_enemy",
            "style_keywords", "brand_last_news", "brand_viral_campaign",
            "brand_strategy", "brand_symbols", "brand_creative_angle",
            "uploaded_images",
        }
        brand_data = {k: v for k, v in state.items() if k in brand_keys}
        brief_data = {k: v for k, v in state.items() if k in BRIEF_VALID_KEYS}

        task = asyncio.create_task(
            _worker_sequence_generator(
                session_id=session_id,
                brand_data=brand_data,
                brief_data=brief_data,
                revision_notes=notes_list,
            )
        )
        task.add_done_callback(lambda _: _active_generators.discard("sequence"))

        return {
            "status": "success",
            "revision_notes": notes_list,
            "message": f"Revision noted. Re-generating sequence with {len(notes_list)} feedback items. You'll be notified when ready.",
        }
