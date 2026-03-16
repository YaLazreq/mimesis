"""Prompt templates for Step 3 — Production Workshop.

All prompt construction is centralized here for easy iteration.
"""

import json


def build_director_prompt(brand_data: dict, brief_data: dict, master_sequence: list) -> str:
    """Build the prompt for the Worker Director (Gemini 2.5 Pro).

    This prompt asks the model to produce:
    1. A visual style guide (JSON)
    2. Six enriched scene descriptions (JSON)

    Args:
        brand_data: All brand intelligence from Step 1.
        brief_data: All brief variables from Step 2.
        master_sequence: The validated 6-scene master sequence.

    Returns:
        A complete prompt string.
    """
    brand_context = _format_brand_context(brand_data)
    brief_context = _format_brief_context(brief_data)
    sequence_context = _format_sequence(master_sequence)

    return f"""You are a world-class commercial director building the production blueprint for a brand ad.

{brand_context}

{brief_context}

VALIDATED MASTER SEQUENCE:
{sequence_context}

YOUR TASK — produce two JSON objects:

1. "visual_style_guide": The visual DNA of this entire ad.
   {{
     "color_palette": ["#hex1", "#hex2", ...],
     "lighting_style": "description of the lighting approach",
     "camera_style": "description of the camera approach",
     "grain_texture": "description of the film grain/texture feel",
     "art_direction": "1-2 sentence overall art direction summary",
     "format_ratio": "16:9",
     "visual_keywords": ["keyword1", "keyword2", ...]
   }}

2. "enriched_scenes": An array of 6 scene objects, each enriching the original master sequence with visual production detail.
   {{
     "scene_number": 1,
     "beat_name": "from master sequence",
     "emotion": "from master sequence",
     "action_summary": "from master sequence",
     "duration_estimate": "from master sequence",
     "visual_description": "Detailed visual description — what the camera sees, colors, textures, atmosphere",
     "camera_direction": "Camera movement and framing (e.g. 'slow push-in, close-up on hands')",
     "lighting_mood": "Scene-specific lighting (e.g. 'cold blue fill with warm rim light')",
     "setting_description": "Where the scene takes place — be specific and cinematic",
     "product_placement": "How/where the product appears (e.g. 'hero shot on reflective surface', 'held by talent', 'not visible yet')"
   }}

RULES:
- The visual style guide must be COHESIVE — every scene should feel like it belongs to the same ad.
- Use the brand's creative angles (poetry, cinema, music references) as inspiration for the art direction.
- The product ({brief_data.get('product_name', 'the product')}) must appear naturally — not forced.
- Respect the tone: {brief_data.get('ad_tone', 'cinematic')}.
- The visual_description should be rich enough to generate an image from — include colors, materials, light, atmosphere.

Respond ONLY with valid JSON:
{{
  "visual_style_guide": {{ ... }},
  "enriched_scenes": [ {{ ... }}, ... ]
}}"""


def build_anchor_prompt(style_guide: dict, scene_1: dict, brand_name: str) -> str:
    """Build the prompt for anchor image generation (Nano Banana).

    Uses the recommended Nano Banana prompt structure:
    [Style] de [Sujet], [Action/Pose], vu en [Cadrage + Angle],
    dans [Environnement]. Éclairé par [Lumière + Direction + Moment].
    Ambiance [Mood]. Capturé comme avec [Technique].
    Format [Ratio], pour [Usage].

    Args:
        style_guide: The visual style guide JSON.
        scene_1: The enriched scene 1 data.
        brand_name: The brand name.

    Returns:
        A prompt string for Nano Banana image generation.
    """
    keywords = ", ".join(style_guide.get("visual_keywords", []))
    palette = ", ".join(style_guide.get("color_palette", []))

    # Extract structured fields for the template
    art_direction = style_guide.get("art_direction", "cinematic commercial photography")
    camera_style = style_guide.get("camera_style", "medium shot")
    lighting = style_guide.get("lighting_style", "natural cinematic lighting")
    grain = style_guide.get("grain_texture", "subtle film grain")
    ratio = style_guide.get("format_ratio", "16:9")

    visual_desc = scene_1.get("visual_description", scene_1.get("action_summary", ""))
    setting = scene_1.get("setting_description", "modern environment")
    lighting_mood = scene_1.get("lighting_mood", lighting)
    camera_dir = scene_1.get("camera_direction", camera_style)
    product_placement = scene_1.get("product_placement", "")

    # Build the structured prompt
    prompt_parts = [
        f"{art_direction} of a {brand_name} commercial scene",
        f"{visual_desc}",
        f"vu en {camera_dir}",
        f"dans {setting}.",
        f"La scène est éclairée par {lighting_mood}, avec une ambiance {keywords}.",
        f"Capturé comme avec un objectif cinéma, profondeur de champ marquée, palette {palette}, {grain}.",
        f"Format paysage {ratio}, pour publicité haut de gamme.",
    ]

    if product_placement and product_placement.lower() not in ("not visible", "not visible yet"):
        prompt_parts.append(f"Le produit apparaît naturellement: {product_placement}.")

    return " ".join(prompt_parts)


def build_keyframe_prompt(
    style_guide: dict,
    scene: dict,
    position: str,
    brand_name: str,
) -> str:
    """Build a prompt for a single keyframe (start or end of a scene).

    Uses the recommended Nano Banana prompt structure:
    [Style] de [Sujet], [Action/Pose], vu en [Cadrage + Angle],
    dans [Environnement]. Éclairé par [Lumière + Direction + Moment].
    Ambiance [Mood]. Capturé comme avec [Technique].
    Format [Ratio], pour [Usage].

    Args:
        style_guide: The visual style guide JSON.
        scene: The enriched scene data.
        position: Either 'start' or 'end'.
        brand_name: The brand name.

    Returns:
        A prompt string for Nano Banana image generation.
    """
    keywords = ", ".join(style_guide.get("visual_keywords", []))
    palette = ", ".join(style_guide.get("color_palette", []))

    # Extract fields
    art_direction = style_guide.get("art_direction", "cinematic commercial photography")
    lighting = style_guide.get("lighting_style", "natural cinematic lighting")
    grain = style_guide.get("grain_texture", "subtle film grain")
    ratio = style_guide.get("format_ratio", "16:9")

    position_desc = "moment d'ouverture" if position == "start" else "moment de clôture"
    scene_num = scene.get("scene_number", "?")
    beat_name = scene.get("beat_name", "")
    emotion = scene.get("emotion", "")
    visual_desc = scene.get("visual_description", scene.get("action_summary", ""))
    camera_dir = scene.get("camera_direction", "plan moyen")
    setting = scene.get("setting_description", "")
    lighting_mood = scene.get("lighting_mood", lighting)
    product_placement = scene.get("product_placement", "")

    # Build the structured prompt
    prompt_parts = [
        f"{art_direction} de la scène {scene_num} ({beat_name}) d'une publicité {brand_name},",
        f"{position_desc}: {visual_desc},",
        f"vu en {camera_dir},",
        f"dans {setting}.",
        f"La scène est éclairée par {lighting_mood}, avec une ambiance {emotion}.",
        f"Capturé comme avec un objectif cinéma, profondeur de champ marquée, palette {palette}, {grain}.",
        f"Format paysage {ratio}, pour publicité haut de gamme.",
    ]

    if product_placement and product_placement.lower() not in ("not visible", "not visible yet"):
        prompt_parts.append(f"Le produit apparaît naturellement: {product_placement}.")

    prompt_parts.append(
        f"Style visuel identique à l'image d'ancrage fournie: même colorimétrie, même grain, même univers. Mots-clés: {keywords}."
    )

    return " ".join(prompt_parts)


# ── Private helpers ──────────────────────────────────────────────────────────

def _format_brand_context(brand_data: dict) -> str:
    """Format brand data into a readable context block."""
    creative = brand_data.get("brand_creative_angle", {})
    creative_str = ""
    if isinstance(creative, dict):
        creative_str = "\n".join(f"  - {k}: {v}" for k, v in creative.items())
    elif isinstance(creative, list):
        creative_str = "\n".join(
            f"  - {a.get('title', '')}: {a.get('summary', '')}"
            for a in creative if isinstance(a, dict)
        )

    return f"""BRAND INTELLIGENCE:
- Brand: {brand_data.get('brand_name', 'N/A')}
- Slogan: {brand_data.get('brand_slogan', 'N/A')}
- Primary Colors: {brand_data.get('primary_color', 'N/A')}
- Mission: {brand_data.get('brand_mission', 'N/A')}
- Common Enemy: {brand_data.get('brand_common_enemy', 'N/A')}
- Symbols: {json.dumps(brand_data.get('brand_symbols', []), ensure_ascii=False)}
- Strategy: {brand_data.get('brand_strategy', 'N/A')}
- Style Keywords: {brand_data.get('style_keywords', 'N/A')}
- Creative Angles:
{creative_str if creative_str else '  N/A'}"""


def _format_brief_context(brief_data: dict) -> str:
    """Format brief data into a readable context block."""
    return f"""CREATIVE BRIEF:
- Objective: {brief_data.get('ad_objective', 'N/A')} — {brief_data.get('ad_objective_summary', '')}
- Target: {brief_data.get('audience_age_range', 'N/A')}, {brief_data.get('audience_gender', 'N/A')}
- Audience Mindset: {brief_data.get('audience_mindset', 'N/A')}
- Persona: {brief_data.get('audience_persona_name', 'N/A')} — {brief_data.get('audience_persona_summary', '')}
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
- Music Direction: {brief_data.get('ad_music_direction', 'N/A')}"""


def _format_sequence(master_sequence: list) -> str:
    """Format the master sequence into a readable block."""
    lines = []
    for scene in master_sequence:
        lines.append(
            f"  Scene {scene.get('scene_number', '?')}: {scene.get('beat_name', '?')} "
            f"— {scene.get('emotion', '?')} — {scene.get('action_summary', '?')} "
            f"({scene.get('duration_estimate', '?')})"
        )
    return "\n".join(lines)
