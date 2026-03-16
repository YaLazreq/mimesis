"""Worker 7 — Master Sequence Generator.

Generates a 6-scene master sequence based on all brand data + creative brief,
then pushes the result to state and notifies the live agent.
"""

import logging
import asyncio
import json
from typing import Optional
from google.genai import types

from mcp_server.clients import genai_client
from mcp_server.helpers.utils import _parse_json_response
from mcp_server.helpers.api_helpers import (
    _push_state,
    _push_ui_layout_add,
    _push_session_notify,
    _resolve_session_id,
)

logger = logging.getLogger("mimesis.tools")

# The 6-beat emotional arc structure
EMOTIONAL_ARC = """
Beat 1 — HOOK: Grab attention, create tension or curiosity.
Beat 2 — CONTEXT: Set the world, introduce the character/situation.
Beat 3 — PRODUCT ENTRY: The product appears or is implied.
Beat 4 — TRANSFORMATION: The shift — the product changes something.
Beat 5 — CLIMAX: Peak emotional moment.
Beat 6 — RESOLUTION: Payoff, CTA, brand signature.
"""


async def _worker_sequence_generator(
    session_id: str,
    brand_data: dict,
    brief_data: dict,
    revision_notes: list[str] | None = None,
    user_scenario_ideas: str = "",
) -> None:
    """Generate a 6-scene master sequence from brand + brief data.

    Args:
        session_id: Active session ID.
        brand_data: All brand intelligence from Step 1.
        brief_data: All brief variables from Step 2 Phase A.
        revision_notes: Optional feedback from user for re-generation.
        user_scenario_ideas: Optional user-provided scenario directions.
    """
    # Resolve session_id to the real active session
    session_id = await _resolve_session_id(session_id)

    brand_name = brand_data.get("brand_name", "Unknown Brand")
    logger.info(f"Worker 7 (Sequence Generator) started for {brand_name} (session: {session_id})")

    # Build the creative context from brand data
    creative_angles = brand_data.get("brand_creative_angle", [])
    creative_context = ""
    if creative_angles:
        creative_context = "\n".join(
            f"- {a.get('title', '')}: {a.get('summary', '')}"
            for a in creative_angles
            if isinstance(a, dict)
        )

    # Build the brand context summary
    brand_context = f"""
BRAND INTELLIGENCE:
- Brand: {brand_data.get('brand_name', 'N/A')}
- Slogan: {brand_data.get('brand_slogan', 'N/A')}
- Primary Colors: {brand_data.get('primary_color', 'N/A')}
- Mission: {brand_data.get('brand_mission', 'N/A')}
- Common Enemy: {brand_data.get('brand_common_enemy', 'N/A')}
- Symbols: {json.dumps(brand_data.get('brand_symbols', []), ensure_ascii=False)}
- Strategy: {json.dumps(brand_data.get('brand_strategy', []), ensure_ascii=False)}
- Style Keywords: {brand_data.get('style_keywords', 'N/A')}
- Creative Angles (USE THESE FOR INSPIRATION):
{creative_context if creative_context else '  N/A'}
"""

    # Build the brief context
    brief_context = f"""
CREATIVE BRIEF:
- Objective: {brief_data.get('ad_objective', 'N/A')} — {brief_data.get('ad_objective_summary', '')}
- Target Audience: {brief_data.get('audience_age_range', 'N/A')}, {brief_data.get('audience_gender', 'N/A')}
- Audience Mindset: {brief_data.get('audience_mindset', 'N/A')}
- Audience Persona: {brief_data.get('audience_persona_name', 'N/A')} — {brief_data.get('audience_persona_summary', '')}
- Product: {brief_data.get('product_name', 'N/A')} ({brief_data.get('product_category', 'N/A')})
- Key Feature: {brief_data.get('product_key_feature', 'N/A')}
- Visual Anchor: {brief_data.get('product_visual_anchor', 'N/A')}
- Primary Emotion: {brief_data.get('ad_emotion_primary', 'N/A')}
- Secondary Emotion: {brief_data.get('ad_emotion_secondary', 'N/A')}
- Tone: {brief_data.get('ad_tone', 'N/A')}
- Tone References: {brief_data.get('ad_tone_references', 'N/A')}
- Duration: {brief_data.get('ad_duration', 'N/A')}
- Platforms: {brief_data.get('ad_platform', 'N/A')}
- Mandatories: {brief_data.get('ad_mandatories', 'N/A')}
- Music Direction: {brief_data.get('ad_music_direction', 'N/A')}
"""

    # Revision notes (if re-generating)
    revision_prompt = ""
    if revision_notes:
        notes_str = "\n".join(f"- {note}" for note in revision_notes)
        revision_prompt = f"""
REVISION INSTRUCTIONS — The user rejected the previous sequence. Address these notes:
{notes_str}

Generate a NEW sequence that incorporates this feedback while keeping the emotional arc intact.
"""

    # User scenario ideas
    scenario_prompt = ""
    if user_scenario_ideas and user_scenario_ideas.lower().strip() not in ("", "none", "no", "aucune"):
        scenario_prompt = f"""
USER SCENARIO DIRECTIONS — The team provided these ideas for the narrative:
{user_scenario_ideas}

Incorporate these directions into the master sequence. Use them as creative inspiration
for the story arc, character situations, and visual concepts. You don't need to use every
idea literally, but the spirit and direction should be reflected in the sequence.
"""

    try:
        response = await genai_client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"""
You are a world-class commercial director crafting a master sequence for a brand ad.

{brand_context}
{brief_context}
{revision_prompt}
{scenario_prompt}

TASK: Generate a 6-scene master sequence following this EXACT emotional arc:
{EMOTIONAL_ARC}

RULES:
- Each scene must have: scene_number (1-6), beat_name, emotion, action_summary, duration_estimate
- action_summary must be cinematic and evocative — 1 sentence describing what happens EMOTIONALLY (not just logistics)
- Duration estimates must add up to approximately {brief_data.get('ad_duration', '30s')}
- Weave in the brand's creative angles (poetry, cinema, music references) where they fit naturally
- The product ({brief_data.get('product_name', 'the product')}) must appear by scene 3
- Respect all mandatories: {brief_data.get('ad_mandatories', 'none')}
- The tone must match: {brief_data.get('ad_tone', 'cinematic')}

Respond ONLY with valid JSON matching this schema:
{{
    "master_sequence": [
        {{
            "scene_number": 1,
            "beat_name": "string",
            "emotion": "string",
            "action_summary": "string (1 cinematic sentence)",
            "duration_estimate": "string (e.g. 0:00–0:05)"
        }}
    ]
}}
""",
            config=types.GenerateContentConfig(
                temperature=0.7,
                response_mime_type="application/json",
            ),
        )

        logger.info(f"Worker 7 raw output: {response.text}")
        data = _parse_json_response(str(response.text))

        if not data or "master_sequence" not in data:
            logger.error("Worker 7: empty or invalid data after parsing")
            await _push_session_notify(
                session_id,
                f"[WORKER NOTIFICATION]: Master sequence generation failed for {brand_name}. "
                f"Ask the user if they'd like to try again.",
            )
            return

        # Push sequence to state
        await _push_state(session_id, {
            "master_sequence": data["master_sequence"],
            "master_sequence_validated": False,
            "current_phase": "sequence",
        })
        await _push_ui_layout_add(session_id, ["master_sequence"])

        # Build summary for agent notification
        sequence_summary = json.dumps(data["master_sequence"], ensure_ascii=False, indent=None)

        await asyncio.sleep(2.0)

        is_revision = "REVISED " if revision_notes else ""
        await _push_session_notify(
            session_id,
            f"[WORKER NOTIFICATION — {is_revision}MASTER SEQUENCE READY]: "
            f"The 6-scene master sequence for {brand_name} is ready.\n"
            f"Here is the sequence:\n{sequence_summary}\n\n"
            f"Present each scene to the team — beat name, emotion, and what happens. "
            f"Keep it cinematic and punchy. Ask if they want to validate or revise.",
        )

        logger.info("Worker 7 (Sequence Generator) completed ✅")

    except Exception as e:
        logger.error(f"Worker 7 failed: {e}", exc_info=True)
        await _push_session_notify(
            session_id,
            f"[WORKER NOTIFICATION]: Master sequence generation encountered an error. "
            f"Ask the user if they'd like to try again.",
        )
