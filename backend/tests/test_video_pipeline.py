#!/usr/bin/env python3
"""Test script for the Step 4 Video Generation pipeline.

Bypasses Steps 1-3 entirely by providing mock brand/brief data
and using real keyframe images already uploaded to GCS from a
previous demo session.

Usage:
    cd backend
    python -m tests.test_video_pipeline

    # Or to test ONLY Phase 1 (prompt generation, no Veo calls):
    python -m tests.test_video_pipeline --prompts-only
"""

import asyncio
import json
import sys
import logging

# ── Logging setup ────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s — %(message)s",
)
logger = logging.getLogger("test_video_pipeline")


# ══════════════════════════════════════════════════════════════════════════════
# MOCK DATA — Simulates what Steps 1-3 would have produced
# ══════════════════════════════════════════════════════════════════════════════

# Use the existing demo session that has real keyframes on GCS
TEST_SESSION_ID = "test_video_pipeline"
SOURCE_SESSION_ID = "demo_session_jr97r"
GCS_BASE = f"gs://gemini-live-hack/mimesis/sessions/{SOURCE_SESSION_ID}"

MOCK_BRAND_DATA = {
    "brand_name": "Google",
    "brand_slogan": "Pixel. The best of Google.",
    "primary_color": ["#4285F4", "#EA4335", "#FBBC04", "#34A853"],
    "secondary_color": ["#1A1A2E", "#F5F5F5"],
    "brand_mission": "Make technology helpful for everyone.",
    "brand_strategy": "Premium smartphone that leverages AI to deliver the best photos and assistant experience.",
    "brand_common_enemy": "Complicated, unintuitive technology that gets in the way.",
    "brand_symbols": ["G logo", "Material You design", "Camera bar"],
    "brand_creative_angle": {
        "cinematic": "Everyday moments transformed into cinema by AI photography",
        "emotional": "Connection between people, amplified by technology",
        "design": "Clean minimalism with bold color accents",
    },
    "style_keywords": "clean, minimal, warm, human, authentic, premium",
}

MOCK_BRIEF_DATA = {
    "ad_objective": "Launch",
    "ad_objective_summary": "Launch the Google Pixel 10 Pro as the ultimate AI-powered smartphone for creative people.",
    "product_name": "Google Pixel 10 Pro",
    "product_category": "Smartphone",
    "product_key_feature": "AI-powered camera with Magic Editor and Best Take",
    "product_visual_anchor": "The distinctive camera bar and premium ceramic back",
    "ad_emotion_primary": "Wonder",
    "ad_emotion_secondary": "Warmth",
    "ad_tone": "Cinematic, intimate, premium",
    "ad_tone_references": ["Apple 'Shot on iPhone' series", "Samsung Galaxy 'Epic' campaigns", "Wes Anderson color palettes"],
    "ad_duration": "30 seconds",
    "ad_platform": "YouTube, Instagram Reels",
    "ad_mandatories": ["Show the phone's camera bar clearly", "Include the Google 'G' logo", "End with product hero shot"],
    "ad_music_direction": "Minimal piano opening, building to warm orchestral swell, ending with single piano note.",
}

MOCK_STYLE_GUIDE = {
    "color_palette": ["#1A1A2E", "#4285F4", "#F5E6D3", "#EA4335", "#34A853", "#FBBC04"],
    "lighting_style": "Natural golden-hour cinematography with soft shadows and warm rim lighting",
    "camera_style": "Anamorphic lens feel with subtle depth of field and slow, deliberate movements",
    "grain_texture": "Fine 35mm film grain, subtle and organic",
    "art_direction": "Premium minimalist aesthetic — clean compositions with warm tones and precise geometric framing, inspired by Nicolas Ghesquière lookbooks",
    "format_ratio": "9:16",
    "visual_keywords": ["warm", "golden", "intimate", "premium", "clean", "cinematic", "authentic"],
}

MOCK_MASTER_SEQUENCE = [
    {
        "scene_number": 1,
        "beat_name": "Hook — L'Éveil",
        "emotion": "Curiosity",
        "action_summary": "Close-up of hands reaching for the Pixel on a sunlit table. Morning light catches the ceramic back.",
        "duration_estimate": "4s",
    },
    {
        "scene_number": 2,
        "beat_name": "Tension — Le Regard",
        "emotion": "Anticipation",
        "action_summary": "Person lifts the phone, camera activates. We see the world through the viewfinder — a bustling street scene.",
        "duration_estimate": "5s",
    },
    {
        "scene_number": 3,
        "beat_name": "Révélation — La Magie",
        "emotion": "Wonder",
        "action_summary": "AI Magic Editor transforms the photo — the crowd fades, leaving only the beautiful architecture.",
        "duration_estimate": "6s",
    },
    {
        "scene_number": 4,
        "beat_name": "Émotion — Le Lien",
        "emotion": "Warmth",
        "action_summary": "Person shows the photo to a friend. Genuine smiles, connection. Best Take captures the perfect moment.",
        "duration_estimate": "5s",
    },
    {
        "scene_number": 5,
        "beat_name": "Climax — L'Impact",
        "emotion": "Awe",
        "action_summary": "Montage of stunning AI-enhanced photos appearing as large prints in a gallery. The camera is the artist.",
        "duration_estimate": "6s",
    },
    {
        "scene_number": 6,
        "beat_name": "Résolution — L'Empreinte",
        "emotion": "Pride",
        "action_summary": "Hero shot of the Pixel 10 Pro against a warm gradient. The Google 'G' logo appears. PIXEL. THE BEST OF GOOGLE.",
        "duration_estimate": "4s",
    },
]

MOCK_ENRICHED_SCENES = [
    {
        "scene_number": 1,
        "beat_name": "Hook — L'Éveil",
        "emotion": "Curiosity",
        "action_summary": "Close-up of hands reaching for the Pixel on a sunlit table.",
        "duration_estimate": "4s",
        "visual_description": "Extreme close-up of two hands reaching for a matte-white Pixel 10 Pro resting on a raw wood table. Morning sunlight streams through linen curtains, casting long warm shadows. The ceramic back catches a prismatic glint.",
        "camera_direction": "Slow dolly-in from medium to extreme close-up, shallow depth of field, anamorphic bokeh",
        "lighting_mood": "Soft diffused morning sun, warm amber fill, cool blue shadow contrast",
        "setting_description": "Minimalist apartment with raw wood surfaces, white linen, and a single coffee cup — clean Scandinavian aesthetic",
        "product_placement": "Hero center frame — the Pixel's camera bar is clearly visible, ceramic texture highlighted by side light",
    },
    {
        "scene_number": 2,
        "beat_name": "Tension — Le Regard",
        "emotion": "Anticipation",
        "action_summary": "Person lifts the phone, camera activates. Through the viewfinder: a bustling street.",
        "duration_estimate": "5s",
        "visual_description": "A person lifts the Pixel to eye level. The camera UI animates on screen. Cut to POV through the camera: a vibrant European street with golden light, market stalls, and moving people.",
        "camera_direction": "Over-shoulder tracking shot transitioning to POV, steady glide, slight rack focus",
        "lighting_mood": "Late morning Mediterranean light — warm whites, deep terracotta shadows, dappled through awnings",
        "setting_description": "European city market street — cobblestones, colorful awnings, stone buildings with weathered facades",
        "product_placement": "Held in hand — screen visible showing camera interface, camera bar profile visible",
    },
    {
        "scene_number": 3,
        "beat_name": "Révélation — La Magie",
        "emotion": "Wonder",
        "action_summary": "AI Magic Editor transforms — crowd fades, architecture revealed in golden perfection.",
        "duration_estimate": "6s",
        "visual_description": "Split-frame transition: the bustling street photo ripples like water, people softly dissolve, leaving pristine architecture bathed in perfect golden light. The Magic Editor UI subtly visible on the phone screen.",
        "camera_direction": "Slow push-in on the phone screen, then widen to reveal the real architecture matching the edit",
        "lighting_mood": "Golden hour perfection — warm omnidirectional glow, no harsh shadows, everything lit like a painting",
        "setting_description": "The same European street, now empty and serene — pure architectural beauty in golden light",
        "product_placement": "Phone screen shows the AI transformation in progress — the before/after is the star",
    },
    {
        "scene_number": 4,
        "beat_name": "Émotion — Le Lien",
        "emotion": "Warmth",
        "action_summary": "Showing the photo to a friend. Genuine smiles. Best Take captures the perfect moment.",
        "duration_estimate": "5s",
        "visual_description": "Two friends sit at a café table. One shows the Pixel screen to the other. Genuine laughter and surprise. The AI suggests Best Take — cycling through expressions to find the perfect combined photo.",
        "camera_direction": "Handheld two-shot, intimate and slightly loose, natural drift and human imperfection",
        "lighting_mood": "Afternoon cafe light — dappled shade from a tree, warm backlight through hair, soft ambient fill",
        "setting_description": "Outdoor café terrace with iron bistro chairs, espresso cups, cobblestone floor, flowering vine overhead",
        "product_placement": "Shared between two people — screen visible but focus is on human connection and reactions",
    },
    {
        "scene_number": 5,
        "beat_name": "Climax — L'Impact",
        "emotion": "Awe",
        "action_summary": "AI-enhanced photos appear as large prints in a gallery. The camera is the artist.",
        "duration_estimate": "6s",
        "visual_description": "Slow reveal: the photos from earlier scenes now hang as huge, luminous prints in a modern white gallery. A visitor walks slowly past them, dwarfed by the scale. Each print glows with internal light.",
        "camera_direction": "Slow lateral tracking shot along the gallery wall, wide angle showing scale, subtle parallax",
        "lighting_mood": "Museum lighting — precise spotlights on prints, dramatic contrast, cool ambient with warm focal points",
        "setting_description": "Minimalist white gallery with polished concrete floors, high ceilings, strategic architectural lighting",
        "product_placement": "Not directly visible — the product's output (the photos) IS the art. A small Pixel logo on the exhibition card.",
    },
    {
        "scene_number": 6,
        "beat_name": "Résolution — L'Empreinte",
        "emotion": "Pride",
        "action_summary": "Hero shot of Pixel 10 Pro against warm gradient. Google 'G' logo. PIXEL. THE BEST OF GOOGLE.",
        "duration_estimate": "4s",
        "visual_description": "The Pixel 10 Pro slowly rotates on a reflective dark surface. Warm gradient background transitions from deep navy to soft gold. The Google colors (blue, red, yellow, green) appear as subtle light refractions on the ceramic surface.",
        "camera_direction": "Slow orbit around the product, macro detail then pull back to full beauty shot",
        "lighting_mood": "Studio hero lighting — precise key light, warm rim, cool fill, gradient background",
        "setting_description": "Dark reflective studio surface, abstract warm gradient background, clean infinite space",
        "product_placement": "Full hero shot — product is the sole subject. Camera bar detail, ceramic texture, logo visible.",
    },
]


def _build_mock_state() -> dict:
    """Build a complete mock state dict with real GCS URIs."""
    state = {
        # Step 1 brand data
        **MOCK_BRAND_DATA,
        # Step 2 brief data
        **MOCK_BRIEF_DATA,
        # Step 3 production data
        "visual_style_guide": MOCK_STYLE_GUIDE,
        "master_sequence": MOCK_MASTER_SEQUENCE,
        "enriched_scenes": MOCK_ENRICHED_SCENES,
        "all_scenes_validated": True,
        # Real GCS URIs
        "anchor_image_uri": f"{GCS_BASE}/generated/anchor_image.png",
    }

    # Add keyframe URIs
    for i in range(1, 7):
        for pos in ("start", "end"):
            state[f"scene_{i}_keyframe_{pos}"] = f"{GCS_BASE}/generated/scene_{i}_keyframe_{pos}.png"

    return state


async def test_prompts_only():
    """Test Phase 1 only — generate the Veo prompts without calling the Veo API."""
    from mcp_server.workers.step4.prompts import build_veo_prompt_director

    logger.info("=" * 60)
    logger.info("TEST: Phase 1 — Generating Veo prompts via Gemini")
    logger.info("=" * 60)

    prompt = build_veo_prompt_director(
        enriched_scenes=MOCK_ENRICHED_SCENES,
        style_guide=MOCK_STYLE_GUIDE,
        master_sequence=MOCK_MASTER_SEQUENCE,
        brand_data=MOCK_BRAND_DATA,
        brief_data=MOCK_BRIEF_DATA,
    )

    logger.info(f"📝 Gemini prompt length: {len(prompt)} chars")

    # Call Gemini
    from mcp_server.clients import genai_client
    from google.genai import types
    from mcp_server.helpers.utils import _parse_json_response

    logger.info("🤖 Calling Gemini 2.5 Flash...")
    response = await genai_client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.7,
            response_mime_type="application/json",
        ),
    )

    # Parse the JSON
    data = _parse_json_response(str(response.text))
    if not data or "extended_sequence" not in data:
        logger.error(f"❌ Invalid response from Gemini")
        logger.error(f"Raw response: {response.text[:2000]}")
        return

    sequence = data["extended_sequence"]
    logger.info(f"✅ Generated {len(sequence)} clip prompts")

    # Print each clip
    for clip in sequence:
        clip_num = clip.get("clip_number", "?")
        clip_type = clip.get("clip_type", "?")
        beat = clip.get("beat_name", clip.get("insert_description", "?"))
        duration = clip.get("duration", "?")
        prompt_preview = clip.get("veo_prompt", "")[:150]

        logger.info(f"\n{'─' * 60}")
        logger.info(f"Clip {clip_num} | {clip_type} | {beat} | {duration}")
        logger.info(f"Prompt: {prompt_preview}...")

    # Save results to file
    output_path = "/tmp/test_veo_prompts.json"
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    logger.info(f"\n📄 Full results saved to {output_path}")

    # Summary
    main_count = sum(1 for c in sequence if c.get("clip_type") == "main_scene")
    insert_count = sum(1 for c in sequence if c.get("clip_type") == "insert_shot")
    total_duration = sum(int(c.get("duration", "0s").replace("s", "")) for c in sequence)
    logger.info(f"\n📊 Summary: {main_count} main scenes + {insert_count} inserts = {len(sequence)} clips ({total_duration}s total)")


async def test_full_pipeline():
    """Test the complete pipeline — Phase 1 (Gemini) + Phase 2 (Veo)."""
    logger.info("=" * 60)
    logger.info("TEST: Full Pipeline — Gemini + Veo 3.1")
    logger.info("=" * 60)
    logger.info("⚠️  This will make REAL Veo API calls and may take 10+ minutes!")
    logger.info("⚠️  Each clip takes ~1-2 minutes to generate.")
    logger.info("")

    # We can't use the real worker directly because it calls _push_state
    # which requires the API server. So we mock those calls.
    import mcp_server.helpers.api_helpers as api_helpers

    # Mock _push_state and _push_session_notify
    original_push_state = api_helpers._push_state
    original_push_notify = api_helpers._push_session_notify

    async def mock_push_state(session_id, data):
        progress = data.get("video_generation_progress", "")
        if progress:
            logger.info(f"📡 State: {progress}")

    async def mock_push_notify(session_id, message):
        logger.info(f"📢 Notification: {message[:200]}")

    api_helpers._push_state = mock_push_state
    api_helpers._push_session_notify = mock_push_notify

    try:
        from mcp_server.workers.step4.video_generator_worker import _worker_video_generator

        state = _build_mock_state()

        await _worker_video_generator(
            session_id=TEST_SESSION_ID,
            enriched_scenes=MOCK_ENRICHED_SCENES,
            style_guide=MOCK_STYLE_GUIDE,
            master_sequence=MOCK_MASTER_SEQUENCE,
            brand_data=MOCK_BRAND_DATA,
            brief_data=MOCK_BRIEF_DATA,
            state=state,
        )

    finally:
        # Restore original functions
        api_helpers._push_state = original_push_state
        api_helpers._push_session_notify = original_push_notify


# ── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    prompts_only = "--prompts-only" in sys.argv

    if prompts_only:
        asyncio.run(test_prompts_only())
    else:
        asyncio.run(test_full_pipeline())
