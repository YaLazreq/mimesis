"""Prompt templates for Step 4 — Video Generation.

Centralizes:
1. The Gemini prompt that generates Veo prompt descriptions per clip.
2. A structural template to ensure every Veo prompt is consistent.
"""

import json


def build_veo_prompt_director(
    enriched_scenes: list[dict],
    style_guide: dict,
    master_sequence: list[dict],
    brand_data: dict,
    brief_data: dict,
) -> str:
    """Build the Gemini 2.5 Pro prompt that generates all Veo prompts.

    This prompt asks Gemini to:
    - Interleave the 6 main scenes with 4-8 insert shots (B-roll)
    - Write a COMPLETE Veo text prompt for each clip
    - Maintain arc coherence (lighting, music, emotion progression)

    Returns:
        Prompt string for Gemini.
    """
    style_str = json.dumps(style_guide, ensure_ascii=False, indent=2)
    scenes_str = json.dumps(enriched_scenes, ensure_ascii=False, indent=2)
    sequence_str = json.dumps(master_sequence, ensure_ascii=False, indent=2)

    brand_name = brand_data.get("brand_name", "Unknown Brand")
    product_name = brief_data.get("product_name", "the product")
    ad_duration = brief_data.get("ad_duration", "30 seconds")
    ad_tone = brief_data.get("ad_tone", "cinematic")
    music_direction = brief_data.get("ad_music_direction", "cinematic score")
    tone_refs = brief_data.get("ad_tone_references", [])
    mandatories = brief_data.get("ad_mandatories", [])
    product_key_feature = brief_data.get("product_key_feature", "")
    product_visual_anchor = brief_data.get("product_visual_anchor", "")
    primary_colors = brand_data.get("primary_color", [])
    palette = ", ".join(style_guide.get("color_palette", []))

    return f"""You are an elite commercial video director and Veo prompt engineer.

You are creating the COMPLETE set of Veo video generation prompts for a {ad_duration} ad for {brand_name} — {product_name}.

═══════════════════════════════════════════════════════
BRAND & BRIEF CONTEXT
═══════════════════════════════════════════════════════
Brand: {brand_name}
Product: {product_name}
Key Feature: {product_key_feature}
Visual Anchor: {product_visual_anchor}
Tone: {ad_tone}
Tone References: {json.dumps(tone_refs, ensure_ascii=False)}
Music Direction: {music_direction}
Mandatories: {json.dumps(mandatories, ensure_ascii=False)}
Primary Colors: {json.dumps(primary_colors, ensure_ascii=False)}

═══════════════════════════════════════════════════════
VISUAL STYLE GUIDE (apply to EVERY clip)
═══════════════════════════════════════════════════════
{style_str}

═══════════════════════════════════════════════════════
MASTER SEQUENCE (6-beat emotional arc)
═══════════════════════════════════════════════════════
{sequence_str}

═══════════════════════════════════════════════════════
ENRICHED SCENES (full production detail)
═══════════════════════════════════════════════════════
{scenes_str}

═══════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════

Generate a sequence of 10-14 clips that interleaves the 6 main scenes with 4-8 insert shots.
For EACH clip, write a complete Veo prompt following the structure below.

CLIP TYPES:
- "main_scene": One of the 6 structural scenes. Its visual content comes from the enriched scene data.
- "insert_shot": A B-roll interstitial (2-4s). Close-ups, texture details, environment sweeps, product details.
  Inserts bridge adjacent main scenes and maintain visual/emotional flow.

═══════════════════════════════════════════════════════
VEO PROMPT STRUCTURE (follow this for EVERY clip)
═══════════════════════════════════════════════════════

Each `veo_prompt` must be a SINGLE continuous text block containing ALL of these elements in order:

1. CINEMATOGRAPHY: Camera type, movement, framing, lens. Always end with the aspect ratio.
2. SUBJECT & ACTION: What the viewer sees. What happens. Be specific and cinematic.
3. PRODUCT CONSISTENCY: Always include the line about maintaining product appearance from the reference image.
4. SETTING: Where the scene takes place. Materials, textures, atmosphere.
5. LIGHTING: Light quality, color temperature, direction, mood. Be very specific.
6. STYLE: Art direction, color palette ({palette}), grain/texture ({style_guide.get('grain_texture', '')}), references, visual keywords.
7. AUDIO: Music progression for THIS clip, SFX (specific sounds), ambient sounds, emotional target.
   The music must PROGRESS across the entire sequence: intimate opening → building → crescendo → resolution.
8. CONSTRAINTS: "No voiceover. No text overlay. No jump cuts. No artificial lighting. Photorealistic. {style_guide.get('format_ratio', '9:16')}."

═══════════════════════════════════════════════════════
CRITICAL COHERENCE RULES
═══════════════════════════════════════════════════════

1. ARC COHERENCE: You receive ALL 6 scenes. Music, lighting, and emotion must form a SINGLE coherent arc.
2. TIME OF DAY: Dawn → Morning → Midday → Afternoon → Golden Hour → Dusk. Each clip's lighting must match.
3. MUSIC PROGRESSION: The music evolves across the entire sequence:
   - Opening clips: intimate, sparse, single instrument
   - Middle clips: building, adding layers
   - Climax clip: full swell, emotional peak
   - Resolution: single held note, fade to silence
4. SFX SPECIFICITY: No generic sounds. Every SFX must be tied to the actual objects in the scene.
5. INSERT RELEVANCE: Each insert must complement its adjacent main scenes (e.g., between scene 2 and 3, show a texture detail that bridges the two locations).
6. PRODUCT LINE: Every clip that shows the product must include: "Maintain visual consistency with provided product reference: leather grain texture, sand-beige tone, embossed logo. Same color grading throughout."
7. The 6 main scenes MUST appear in order (1→6).
8. Each clip's duration must be "4s", "6s", or "8s" (valid Veo durations). The total should approximate {ad_duration}.

═══════════════════════════════════════════════════════
OUTPUT FORMAT (valid JSON only)
═══════════════════════════════════════════════════════

{{
  "extended_sequence": [
    {{
      "clip_number": 1,
      "clip_type": "main_scene",
      "original_scene_number": 1,
      "beat_name": "Hook — L'Éveil",
      "duration": "4s",
      "veo_prompt": "... complete Veo prompt text following the structure above ..."
    }},
    {{
      "clip_number": 2,
      "clip_type": "insert_shot",
      "insert_description": "Texture transition — leather grain macro",
      "duration": "4s",
      "veo_prompt": "... complete Veo prompt text ..."
    }},
    ...
  ]
}}

Respond ONLY with valid JSON. No markdown, no comments."""
