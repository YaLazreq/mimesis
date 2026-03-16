"""Worker 8 — Video Generator Pipeline (Step 4).

Full pipeline:
1. Gemini 2.5 Flash generates all Veo prompts (main scenes + inserts) in 1 call.
2. Veo 3.1 generates clips sequentially.
3. ffmpeg stitches all clips into one final video.
4. Final video is uploaded to GCS and the public URL is pushed to the frontend.

Key Veo constraints (discovered in testing):
- image= and reference_images= CANNOT be combined.
- video= and reference_images= CANNOT be combined.
- reference_images= can ONLY be used in text-only mode (no image, no video).

Strategies used:
- Main scenes: keyframe interpolation (image= + config.last_frame).
- Insert shots: video extension (video=) from previous clip.
- Fallback (no keyframes, no previous video): text-only + reference_images.
"""

import logging
import asyncio
import json
import typing

from google.genai import types

from mcp_server.clients import genai_client
from mcp_server.helpers.utils import _parse_json_response
from mcp_server.helpers.image_helpers import (
    download_image_bytes,
    upload_image_bytes,
)
from mcp_server.helpers.gcs_helpers import get_public_url, GCS_BUCKET_NAME, GCS_PREFIX
from mcp_server.helpers.api_helpers import (
    _push_state,
    _push_session_notify,
)
from mcp_server.workers.step4.prompts import build_veo_prompt_director

logger = logging.getLogger("mimesis.tools")

# ── Configuration ────────────────────────────────────────────────────────────
VEO_MODEL = "veo-3.1-generate-preview"
GEMINI_MODEL = "gemini-2.5-flash"
POLL_INTERVAL_SECONDS = 10
MAX_POLL_ATTEMPTS = 60  # 10 minutes max per clip


async def _worker_video_generator(
    session_id: str,
    enriched_scenes: list[dict],
    style_guide: dict,
    master_sequence: list[dict],
    brand_data: dict,
    brief_data: dict,
    state: dict,
) -> None:
    """Orchestrate the end-to-end video generation pipeline.

    Args:
        session_id: Active session ID.
        enriched_scenes: The 6 enriched scenes from Step 3.
        style_guide: Visual style guide dict.
        master_sequence: The original 6-step arc.
        brand_data: Brand info (name, colors, etc.).
        brief_data: Brief info (objective, product, tone, etc.).
        state: Full state object for resolving keyframe URIs.
    """
    brand_name = brand_data.get("brand_name", "Unknown Brand")
    logger.info(f"Worker 8 (Video Generator) started for {brand_name} (session: {session_id})")

    # ──────────────────────────────────────────────────────────
    # PRE-LOAD: Download all reference images from GCS
    # ──────────────────────────────────────────────────────────
    await _push_state(session_id, {
        "video_generation_progress": "Loading reference images from Cloud Storage..."
    })

    anchor_uri = state.get("anchor_image_uri", "")
    anchor_bytes = None
    if anchor_uri:
        try:
            anchor_bytes = download_image_bytes(anchor_uri)
            logger.info(f"📸 Anchor image loaded: {len(anchor_bytes)} bytes")
        except Exception as e:
            logger.warning(f"⚠️ Could not load anchor image: {e}")

    # Pre-load all keyframe images (scene_X_keyframe_start / _end)
    keyframes: dict[str, bytes] = {}
    for i in range(1, 7):
        for pos in ("start", "end"):
            key = f"scene_{i}_keyframe_{pos}"
            uri = state.get(key, "")
            if uri:
                try:
                    keyframes[key] = download_image_bytes(uri)
                    logger.info(f"📸 Loaded {key}: {len(keyframes[key])} bytes")
                except Exception as e:
                    logger.warning(f"⚠️ Could not load {key}: {e}")

    # ──────────────────────────────────────────────────────────
    # PHASE 1: Generate all Veo prompts via Gemini
    # ──────────────────────────────────────────────────────────
    await _push_state(session_id, {
        "video_generation_progress": "AI Director is writing video prompts for each clip..."
    })

    try:
        extended_sequence = await _phase1_generate_prompts(
            enriched_scenes, style_guide, master_sequence, brand_data, brief_data,
        )
        await _push_state(session_id, {"extended_sequence": extended_sequence})
        logger.info(f"✅ Phase 1 complete: {len(extended_sequence)} clips planned.")
    except Exception as e:
        logger.error(f"Worker 8 failed during Phase 1: {e}", exc_info=True)
        await _push_state(session_id, {
            "is_generating_video": False,
            "video_generation_progress": f"Error generating prompts: {e}",
        })
        await _push_session_notify(
            session_id,
            "[WORKER NOTIFICATION] Video generation failed at prompt generation phase. "
            "Ask the team to try again."
        )
        return

    # ──────────────────────────────────────────────────────────
    # PHASE 2: Generate clips sequentially via Veo 3.1
    # ──────────────────────────────────────────────────────────
    total_clips = len(extended_sequence)
    generated_clips: list[dict] = []
    previous_video = None  # Veo video object from previous clip (for extension)

    for index, clip in enumerate(extended_sequence):
        clip_num = index + 1
        clip_type = clip.get("clip_type", "insert_shot")
        beat_name = clip.get("beat_name", clip.get("insert_description", f"Clip {clip_num}"))

        await _push_state(session_id, {
            "video_generation_progress": f"Generating clip {clip_num}/{total_clips}: {beat_name}..."
        })
        logger.info(f"🎥 Generating clip {clip_num}/{total_clips} — {clip_type}: {beat_name}")

        try:
            veo_prompt = clip.get("veo_prompt", "")
            if not veo_prompt:
                logger.warning(f"⚠️ Clip {clip_num} has no veo_prompt, skipping")
                continue

            # Determine which images to use
            scene_num = clip.get("original_scene_number")
            first_frame_bytes = None
            last_frame_bytes = None

            if clip_type == "main_scene" and scene_num:
                # Main scenes use their keyframe start + end for interpolation
                first_frame_bytes = keyframes.get(f"scene_{scene_num}_keyframe_start")
                last_frame_bytes = keyframes.get(f"scene_{scene_num}_keyframe_end")

            # Generate the clip
            video_result = await _generate_veo_clip(
                session_id=session_id,
                prompt=veo_prompt,
                first_frame_bytes=first_frame_bytes,
                last_frame_bytes=last_frame_bytes,
                anchor_bytes=anchor_bytes,
                previous_video=previous_video,
                clip_type=clip_type,
                duration=clip.get("duration", "6s"),
                aspect_ratio=style_guide.get("format_ratio", "9:16"),
            )

            if video_result:
                # Save the video to GCS
                video_bytes, veo_video_obj = video_result
                if video_bytes:
                    filename = f"clip_{clip_num:02d}_{clip_type}.mp4"
                    clip_uri = upload_image_bytes(
                        session_id, filename, video_bytes, content_type="video/mp4"
                    )
                else:
                    clip_uri = veo_video_obj.uri

                clip["output_video_uri"] = clip_uri
                clip["status"] = "success"
                generated_clips.append(clip)

                # Keep the Veo video object for potential extension of the next clip
                previous_video = veo_video_obj

                logger.info(f"✅ Clip {clip_num} generated: {clip_uri}")
            else:
                clip["status"] = "failed"
                logger.error(f"❌ Clip {clip_num} generation failed")
                # Don't break — try remaining clips. Clear previous_video so next
                # clip doesn't try to extend a failed one.
                previous_video = None

        except Exception as e:
            logger.error(f"❌ Clip {clip_num} error: {e}", exc_info=True)
            clip["status"] = "error"
            clip["error"] = str(e)
            previous_video = None

    # Push updated sequence with all clip URIs
    await _push_state(session_id, {"extended_sequence": extended_sequence})

    success_count = sum(1 for c in extended_sequence if c.get("status") == "success")
    logger.info(f"🎬 Phase 2 complete: {success_count}/{total_clips} clips generated.")

    # ──────────────────────────────────────────────────────────
    # PHASE 3: Stitch clips with ffmpeg → single final video
    # ──────────────────────────────────────────────────────────
    await _push_state(session_id, {
        "video_generation_progress": "Assembling final video..."
    })

    # Collect all successful clip URIs in order
    clip_uris = [
        c["output_video_uri"] for c in extended_sequence
        if c.get("status") == "success" and c.get("output_video_uri")
    ]

    final_video_uri = ""
    if clip_uris:
        final_video_uri = await _stitch_clips(session_id, clip_uris)

    # Fallback: use first clip if stitching failed
    if not final_video_uri and clip_uris:
        logger.warning("⚠️ Stitching failed — falling back to first clip")
        final_video_uri = clip_uris[0]

    final_public_url = get_public_url(final_video_uri) if final_video_uri else ""

    # ──────────────────────────────────────────────────────────
    # PHASE 4: Push completion state
    # ──────────────────────────────────────────────────────────
    await _push_state(session_id, {
        "is_generating_video": False,
        "video_generation_progress": f"Done! {success_count}/{total_clips} clips generated.",
        "final_video_uri": final_public_url,
        "clip_uris": clip_uris,
        "current_phase": "video_complete",
    })

    logger.info(f"✅ Worker 8 completed. {success_count}/{total_clips} clips generated.")

    await _push_session_notify(
        session_id,
        f"[WORKER NOTIFICATION — VIDEO COMPLETED]: "
        f"The video generation pipeline for {brand_name} has completed!\n\n"
        f"Successfully generated {success_count}/{total_clips} clips.\n"
        f"All clips are uploaded to Cloud Storage.\n\n"
        f"Present the results to the team and celebrate the final ad. 🎬"
    )


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 1 — Gemini Prompt Generation
# ══════════════════════════════════════════════════════════════════════════════

async def _phase1_generate_prompts(
    enriched_scenes: list[dict],
    style_guide: dict,
    master_sequence: list[dict],
    brand_data: dict,
    brief_data: dict,
) -> list[dict]:
    """Call Gemini to generate all Veo prompts in one shot.

    Returns:
        List of clip dicts, each containing a `veo_prompt` field.
    """
    prompt = build_veo_prompt_director(
        enriched_scenes, style_guide, master_sequence, brand_data, brief_data,
    )

    response = await genai_client.aio.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.7,
            response_mime_type="application/json",
        ),
    )

    data = _parse_json_response(str(response.text))
    if not data or "extended_sequence" not in data:
        raise ValueError(f"Invalid JSON from Gemini: missing 'extended_sequence' key")

    sequence = data["extended_sequence"]
    logger.info(f"📝 Gemini generated {len(sequence)} clip prompts")

    # Validate that all 6 main scenes are present in order
    main_scenes = [c for c in sequence if c.get("clip_type") == "main_scene"]
    scene_numbers = [c.get("original_scene_number") for c in main_scenes]
    if sorted(scene_numbers) != [1, 2, 3, 4, 5, 6]:
        logger.warning(f"⚠️ Main scenes order issue: got {scene_numbers}, expected [1-6]")

    return sequence


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — Veo Video Generation
# ══════════════════════════════════════════════════════════════════════════════

async def _generate_veo_clip(
    session_id: str,
    prompt: str,
    first_frame_bytes: bytes | None,
    last_frame_bytes: bytes | None,
    anchor_bytes: bytes | None,
    previous_video,
    clip_type: str,
    duration: str = "6s",
    aspect_ratio: str = "9:16",
) -> tuple[bytes | None, typing.Any] | None:
    """Generate a single video clip using the Veo API.

    Strategy:
    - Main scenes: Use first_frame (image=) + last_frame (config.last_frame)
      for frame interpolation. No reference_images (Veo constraint).
    - Insert shots: If we have a previous video, extend it (video=).
      No reference_images (Veo constraint).
    - Fallback: text-only prompt + anchor as reference_images.

    Args:
        prompt: The complete Veo text prompt.
        first_frame_bytes: Start keyframe bytes (for main scenes).
        last_frame_bytes: End keyframe bytes (for main scenes).
        anchor_bytes: Anchor image bytes (product reference).
        previous_video: Veo video object from previous clip (for extending).
        clip_type: "main_scene" or "insert_shot".
        duration: Clip duration ("4s", "6s", or "8s").
        aspect_ratio: Video aspect ratio.

    Returns:
        Tuple of (video_bytes, veo_video_object) or None on failure.
    """
    # Parse duration to integer seconds
    duration_seconds = int(duration.replace("s", "").strip())
    # Clamp to valid Veo durations
    if duration_seconds not in (4, 5, 6, 8):
        duration_seconds = 6

    # Build the anchor reference image (for text-only and insert strategies)
    anchor_ref_list = []
    if anchor_bytes:
        anchor_ref_list = [
            types.VideoGenerationReferenceImage(
                image=types.Image(image_bytes=anchor_bytes, mime_type="image/png"),
                reference_type="asset",
            )
        ]

    # ── Build Veo call arguments based on clip type ──
    image_arg = None
    video_arg = None
    config_last_frame = None
    # NOTE: Veo does NOT allow image= and reference_images= at the same time.
    # When using keyframe interpolation (image + last_frame), we skip reference_images.
    # Product consistency is already baked into the keyframes themselves.
    config_ref_images = None

    if clip_type == "main_scene" and first_frame_bytes:
        # Main scene: keyframe interpolation (start + end frame)
        # No reference_images — "Image and reference images cannot be both set"
        image_arg = types.Image(image_bytes=first_frame_bytes, mime_type="image/png")

        if last_frame_bytes:
            config_last_frame = types.Image(image_bytes=last_frame_bytes, mime_type="image/png")

    elif clip_type == "insert_shot" and previous_video:
        # Insert shot: extend from previous video
        # No reference_images — "Video and reference images cannot be both set"
        video_arg = previous_video

    else:
        # Fallback: text-only — use anchor as reference for visual consistency
        # reference_images can ONLY be used in text-only mode
        config_ref_images = anchor_ref_list or None

    # Provide an output GCS URI base, so Veo can handle large videos gracefully
    output_uri_prefix = f"gs://{GCS_BUCKET_NAME}/{GCS_PREFIX}/{session_id}/generated/"

    # Build the config
    config = types.GenerateVideosConfig(
        aspect_ratio=aspect_ratio,
        number_of_videos=1,
        person_generation="allow_all",
        last_frame=config_last_frame,
        reference_images=config_ref_images,
        output_gcs_uri=output_uri_prefix,
    )

    # ── Call Veo API ──
    logger.info(f"🎥 Calling Veo API: type={clip_type}, duration={duration_seconds}s, "
                f"has_image={image_arg is not None}, has_video={video_arg is not None}, "
                f"has_last_frame={config_last_frame is not None}, "
                f"has_ref_images={config_ref_images is not None}")

    # Build the call kwargs dynamically (image and video are mutually exclusive)
    call_kwargs: dict = {
        "model": VEO_MODEL,
        "prompt": prompt,
        "config": config,
    }
    if image_arg is not None:
        call_kwargs["image"] = image_arg
    if video_arg is not None:
        call_kwargs["video"] = video_arg

    operation = await asyncio.to_thread(
        genai_client.models.generate_videos,
        **call_kwargs,
    )

    # ── Poll for completion ──
    attempts = 0
    while not operation.done:
        if attempts >= MAX_POLL_ATTEMPTS:
            logger.error("🎥 Veo polling timed out")
            return None
        logger.info(f"🎥 Waiting for Veo... (attempt {attempts + 1}/{MAX_POLL_ATTEMPTS})")
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
        operation = await asyncio.to_thread(
            genai_client.operations.get,
            operation,
        )
        attempts += 1

    # ── Check for errors first ──
    op_error = getattr(operation, 'error', None)
    if op_error:
        logger.error(f"🎥 Veo operation error: code={op_error.get('code', '?')}, message={op_error.get('message', '?')}")
        return None

    # ── Extract result ──
    if not operation.response:
        logger.error(f"🎥 Veo returned no response. done={operation.done}, name={getattr(operation, 'name', '?')}")
        return None

    if not operation.response.generated_videos:
        logger.error(f"🎥 Veo returned empty generated_videos.")
        return None

    generated_video = operation.response.generated_videos[0]
    veo_video_obj = generated_video.video

    # In Vertex AI, video bytes are directly available on the object
    # or just an output uri if output_gcs_uri was used
    video_bytes = getattr(veo_video_obj, 'video_bytes', None)
    veo_uri = getattr(veo_video_obj, 'uri', None)
    
    if not video_bytes and not veo_uri:
        logger.error(f"🎥 No video_bytes and no uri on video object. Attributes: {[a for a in dir(veo_video_obj) if not a.startswith('_')]}")
        return None

    if video_bytes:
        logger.info(f"🎥 Veo clip generated bytes: {len(video_bytes)} bytes")
    else:
        logger.info(f"🎥 Veo clip generated to URI: {veo_uri}")

    return video_bytes, veo_video_obj


# ═══════════════════════════════════════════════════════════════
# FFMPEG STITCHING
# ═══════════════════════════════════════════════════════════════

async def _stitch_clips(session_id: str, clip_uris: list[str]) -> str:
    """Download all clips from GCS, stitch with ffmpeg, upload final.

    Returns the GCS URI of the final assembled video, or empty string on failure.
    """
    import os
    import tempfile
    import subprocess
    import shutil

    if not clip_uris:
        return ""

    # Only stitch if we have more than 1 clip
    if len(clip_uris) == 1:
        logger.info("🎬 Only 1 clip — skipping stitching")
        return clip_uris[0]

    logger.info(f"🎬 Stitching {len(clip_uris)} clips with ffmpeg...")

    # Check ffmpeg is available
    ffmpeg_path = shutil.which("ffmpeg")
    if not ffmpeg_path:
        logger.error("🎬 ffmpeg not found on PATH")
        return ""

    tmp_dir = tempfile.mkdtemp(prefix="mimesis_stitch_")

    try:
        # 1. Download all clips from GCS to temp files
        clip_paths = []
        for i, uri in enumerate(clip_uris):
            local_path = os.path.join(tmp_dir, f"clip_{i:03d}.mp4")
            clip_bytes = download_image_bytes(uri)
            if not clip_bytes:
                logger.warning(f"🎬 Failed to download clip {i}: {uri}")
                continue
            with open(local_path, "wb") as f:
                f.write(clip_bytes)
            clip_paths.append(local_path)
            logger.info(f"🎬 Downloaded clip {i+1}/{len(clip_uris)}: {len(clip_bytes)} bytes")

        if not clip_paths:
            logger.error("🎬 No clips downloaded for stitching")
            return ""

        # 2. Re-encode each clip to ensure uniform codec/resolution/framerate
        normalized_paths = []
        for i, path in enumerate(clip_paths):
            normalized_path = os.path.join(tmp_dir, f"norm_{i:03d}.mp4")
            normalize_cmd = [
                ffmpeg_path, "-y",
                "-i", path,
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "23",
                "-r", "24",
                "-pix_fmt", "yuv420p",
                "-an",
                "-movflags", "+faststart",
                normalized_path,
            ]
            result = await asyncio.to_thread(
                subprocess.run, normalize_cmd,
                capture_output=True, text=True, timeout=120,
            )
            if result.returncode != 0:
                logger.warning(f"🎬 Normalize failed for clip {i}: {result.stderr[-500:]}")
                normalized_path = path
            normalized_paths.append(normalized_path)

        # 3. Create ffmpeg concat file
        concat_file = os.path.join(tmp_dir, "concat.txt")
        with open(concat_file, "w") as f:
            for path in normalized_paths:
                f.write(f"file '{path}'\n")

        # 4. Run ffmpeg concat
        output_path = os.path.join(tmp_dir, "final_ad.mp4")
        concat_cmd = [
            ffmpeg_path, "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_file,
            "-c", "copy",
            "-movflags", "+faststart",
            output_path,
        ]

        logger.info(f"🎬 Running ffmpeg concat: {len(normalized_paths)} clips")
        result = await asyncio.to_thread(
            subprocess.run, concat_cmd,
            capture_output=True, text=True, timeout=300,
        )

        if result.returncode != 0:
            logger.error(f"🎬 ffmpeg concat failed: {result.stderr[-500:]}")
            return ""

        # 5. Read the output and upload to GCS
        with open(output_path, "rb") as f:
            final_bytes = f.read()

        final_size_mb = len(final_bytes) / (1024 * 1024)
        logger.info(f"🎬 Final video: {final_size_mb:.1f} MB")

        final_gcs_uri = upload_image_bytes(
            session_id,
            "final_commercial.mp4",
            final_bytes,
            content_type="video/mp4",
        )

        logger.info(f"🎬 Final video uploaded: {final_gcs_uri}")
        return final_gcs_uri

    except Exception as e:
        logger.error(f"🎬 Stitching error: {e}", exc_info=True)
        return ""

    finally:
        # 6. Clean up temp directory
        try:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass

