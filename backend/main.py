import logging
import os
import base64
import json
import warnings
import asyncio

from google.genai import errors as genai_errors

from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from pydantic import BaseModel

load_dotenv(".env")

# Import agent after loading environment variables
# pylint: disable=wrong-import-position
from agents.mimesis_senior_creative_director_agent import agent  # noqa: E402

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Suppress Pydantic serialization warnings
warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")

# Application name constant
APP_NAME = "mimesis"

app = FastAPI()

# Allow cross-origin requests from the Next.js frontend
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001"
    ).split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    """Health check endpoint for Cloud Run."""
    return {"status": "ok"}

# Define your session service
session_service = InMemorySessionService()

# Define your runner
runner = Runner(app_name=APP_NAME, agent=agent, session_service=session_service)

# ========================================
# Agent State Store — import singleton
# ========================================
from state.agent_state_store import state_store


# ========================================
# Pydantic models for state API
# ========================================

# Global dictionary to map a session to its active LiveRequestQueue
active_queues: dict[str, LiveRequestQueue] = {}

# Track the active ADK voice session credentials
# (the voice WebSocket session_id ≠ the frontend state session_id)
active_adk_session: dict[str, str] = {}


class SessionNotifyPayload(BaseModel):
    session_id: str
    message: str


class StateUpdatePayload(BaseModel):
    session_id: str
    data: dict


class LayoutUpdatePayload(BaseModel):
    session_id: str
    visible_components: list[str]


# ========================================
# State API Endpoints (called by MCP tools via HTTP)
# ========================================


@app.post("/api/state/update")
async def receive_state_update(payload: StateUpdatePayload):
    """Receive a partial state update from an MCP tool and broadcast it."""
    updated = await state_store.update_state(payload.session_id, payload.data)
    return {"status": "ok", "keys_updated": list(payload.data.keys())}


@app.post("/api/state/layout")
async def receive_layout_update(payload: LayoutUpdatePayload):
    """Receive a UI layout change from the set_ui_layout MCP tool."""
    updated = await state_store.set_visible_components(
        payload.session_id, payload.visible_components
    )
    return {
        "status": "ok",
        "visible_components": updated.get("visible_components", []),
    }

@app.post("/api/state/layout/add")
async def receive_layout_add(payload: LayoutUpdatePayload):
    """Receive a UI layout addition from an MCP tool."""
    updated = await state_store.add_visible_components(
        payload.session_id, payload.visible_components
    )
    return {
        "status": "ok",
        "visible_components": updated.get("visible_components", []),
    }


@app.post("/api/session/notify")
async def receive_session_notification(payload: SessionNotifyPayload):
    """Endpoint to inject a system event notification into an active session's LiveRequestQueue."""
    logger.info(
        f"📨 Notification request: payload.session_id='{payload.session_id}', "
        f"active_queues={list(active_queues.keys())}, "
        f"active_adk_session={active_adk_session}"
    )

    # Try multiple resolution strategies to find the right LiveRequestQueue
    live_queue = None
    target_session_id = None

    # Strategy 1: Direct lookup
    if payload.session_id in active_queues:
        target_session_id = payload.session_id
        live_queue = active_queues[target_session_id]

    # Strategy 2: Resolve via state_store (maps to active subscriber session)
    if not live_queue:
        resolved = state_store.resolve_session_id(payload.session_id)
        if resolved and resolved in active_queues:
            target_session_id = resolved
            live_queue = active_queues[target_session_id]

    # Strategy 3: Use the tracked ADK voice session
    if not live_queue:
        adk_sid = active_adk_session.get("session_id")
        if adk_sid and adk_sid in active_queues:
            target_session_id = adk_sid
            live_queue = active_queues[target_session_id]
            logger.info(f"📨 Resolved via active_adk_session fallback → {target_session_id}")

    # Strategy 4: Last resort — if there's only one queue, use it
    if not live_queue and len(active_queues) == 1:
        target_session_id = next(iter(active_queues))
        live_queue = active_queues[target_session_id]
        logger.info(f"📨 Resolved via single-queue fallback → {target_session_id}")

    if not live_queue:
        logger.warning(
            f"⚠️ Cannot notify session '{payload.session_id}' - no active LiveRequestQueue found. "
            f"active_queues={list(active_queues.keys())}"
        )
        return {"status": "ignored", "reason": "no active queue"}

    logger.info(f"📨 Delivering notification to {target_session_id}: {payload.message[:120]}...")

    # Inject message directly into the queue so the ADK runner sends it to the Gemini Live agent
    notification_content = types.Content(
        parts=[types.Part(text=payload.message)],
        role="user" 
    )
    live_queue.send_content(notification_content)
    
    return {"status": "ok", "delivered_to": target_session_id}


class AdkStatePayload(BaseModel):
    session_id: str
    user_id: str = "user"
    data: dict


@app.post("/api/session/adk-state")
async def receive_adk_state_update(payload: AdkStatePayload):
    """Write data into the ADK session.state so the model can see it.

    This is the bridge between background MCP workers and the model's context.
    The model can access these values via {key} templating in its instructions.
    """
    # Use the tracked ADK voice session credentials (not the frontend state session)
    adk_user_id = active_adk_session.get("user_id")
    adk_session_id = active_adk_session.get("session_id")

    if not adk_user_id or not adk_session_id:
        logger.warning("⚠️ No active ADK session tracked — cannot write to session.state")
        return {"status": "error", "reason": "no active ADK session"}

    session = await session_service.get_session(
        app_name=APP_NAME,
        user_id=adk_user_id,
        session_id=adk_session_id,
    )

    if not session:
        logger.warning(f"⚠️ ADK session not found: user={adk_user_id}, session={adk_session_id}")
        return {"status": "error", "reason": "session not found"}

    # Write each key-value pair into session.state
    for key, value in payload.data.items():
        session.state[key] = value

    logger.info(
        f"🧠 ADK state updated for {adk_session_id}: {list(payload.data.keys())}"
    )
    return {"status": "ok", "keys_updated": list(payload.data.keys())}


# ========================================
# Image Upload Endpoint
# ========================================

@app.post("/api/session/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    session_id: str = Form("default"),
    user_context: str = Form(""),
):
    """Upload a product image, store in GCS, and launch analysis worker.

    The image is stored in gs://{bucket}/mimesis/sessions/{session_id}/
    and a background worker analyzes it with Gemini Vision.
    """
    from mcp_server.helpers.gcs_helpers import upload_image as gcs_upload
    from mcp_server.workers.image_analysis import _worker_image_analysis

    # Use the same logger as tools.log so everything is in one place
    tools_logger = logging.getLogger("mimesis.tools")

    # Read file bytes
    file_bytes = await file.read()
    content_type = file.content_type or "image/jpeg"
    filename = file.filename or "upload.jpg"

    tools_logger.info(f"📸 Image upload received: {filename} ({len(file_bytes)} bytes) for session {session_id}")

    # Upload to GCS (sync call — run in executor to avoid blocking)
    gcs_uri = ""
    try:
        loop = asyncio.get_event_loop()
        gcs_uri = await loop.run_in_executor(
            None, lambda: gcs_upload(session_id, filename, file_bytes, content_type)
        )
        tools_logger.info(f"📸 GCS upload OK: {gcs_uri}")
    except Exception as e:
        tools_logger.error(f"❌ GCS upload failed (will continue with analysis anyway): {e}")
        gcs_uri = f"local://{filename}"  # Fallback — analysis still works without GCS

    # Determine current brand name from state
    brand_name = state_store.get_state(
        state_store.resolve_session_id(session_id) or session_id
    ).get("brand_name", "Unknown Brand")

    tools_logger.info(f"📸 Launching Worker 6 for brand={brand_name}, gcs_uri={gcs_uri}")

    # Launch image analysis worker in background
    asyncio.create_task(
        _worker_image_analysis(
            session_id=session_id,
            brand_name=brand_name,
            image_bytes=file_bytes,
            image_mime_type=content_type,
            gcs_uri=gcs_uri,
            user_context=user_context,
        )
    )

    return {
        "status": "ok",
        "gcs_uri": gcs_uri,
        "filename": filename,
        "message": f"Image uploaded and analysis started for {brand_name}.",
    }


# ========================================
# GCS Image Proxy — serves private GCS images to the frontend
# ========================================

from fastapi.responses import Response

@app.get("/api/gcs-proxy")
async def gcs_proxy(uri: str):
    """Stream a GCS object to the frontend.

    The bucket has uniform bucket-level access, so public URLs don't work.
    This endpoint uses the backend's service account to download and proxy the image.

    Usage: GET /api/gcs-proxy?uri=gs://bucket/path/to/image.png
    """
    if not uri.startswith("gs://"):
        return Response(content="Invalid GCS URI", status_code=400)

    try:
        from mcp_server.helpers.gcs_helpers import _get_client
        parts = uri[5:].split("/", 1)
        bucket_name = parts[0]
        blob_path = parts[1]

        client = _get_client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_path)

        image_bytes = blob.download_as_bytes()
        content_type = blob.content_type or "image/png"

        return Response(
            content=image_bytes,
            media_type=content_type,
            headers={
                "Cache-Control": "public, max-age=3600",
                "Access-Control-Allow-Origin": "*",
            },
        )
    except Exception as e:
        logger.error(f"❌ GCS proxy error for {uri}: {e}")
        return Response(content=f"Error: {e}", status_code=404)


@app.get("/api/state/_active_id")
async def get_active_session_id():
    """Return the real active session ID — used by MCP tools to resolve placeholder IDs."""
    active_id = state_store.active_session_id
    return {"session_id": active_id or ""}


@app.get("/api/state/_active")
async def get_active_state():
    """Return state for the currently active session — no session_id needed.

    This endpoint is the reliable fallback for MCP tools that don't know
    (or receive an empty) session_id from the model.
    """
    active_id = state_store.active_session_id
    if not active_id:
        return {}
    return state_store.get_state(active_id)


@app.get("/api/state/{session_id}")
async def get_state(session_id: str):
    """Inspect the current state for a session.
    
    Falls back to the active session if the given session_id is unknown.
    """
    resolved = state_store.resolve_session_id(session_id)
    target = resolved or session_id
    state = state_store.get_state(target)
    # If direct lookup failed, try active session as last resort
    if not state:
        active_id = state_store.active_session_id
        if active_id:
            state = state_store.get_state(active_id)
    return state


# ========================================
# State WebSocket — pushes real-time updates to the frontend
# ========================================


@app.websocket("/ws/state/{session_id}")
async def state_websocket(websocket: WebSocket, session_id: str) -> None:
    """Dedicated WebSocket for pushing state updates to the frontend.

    On connect: sends the full current state as a snapshot.
    Then: streams every state_update and ui_layout event in real-time.
    """
    await websocket.accept()
    logger.info(f"🟢 State WS connected: {session_id}")

    # Send current state immediately on connect
    current_state = state_store.get_state(session_id)
    if current_state:
        await websocket.send_json(
            {
                "type": "state_snapshot",
                "state": current_state,
            }
        )

    # Subscribe to future updates
    queue = state_store.subscribe(session_id)

    try:
        while True:
            event = await queue.get()
            await websocket.send_json(event)
    except WebSocketDisconnect:
        logger.info(f"🔴 State WS disconnected: {session_id}")
    except Exception as e:
        logger.error(f"State WS error: {e}", exc_info=True)
    finally:
        state_store.unsubscribe(session_id, queue)


# @app.websocket("/ws")
# async def websocket_endpoint(websocket: WebSocket):
#     await websocket.accept()
#     print("Connexion établie avec le frontend ! ✅")
#     try:
#         while True:
#             # On attend de recevoir des données de Next.js
#             data = await websocket.receive_bytes()
#             # C'est ici que nous insérerons l'ADK plus tard
#             print(f"Reçu : {len(data)} octets")
#     except Exception as e:
#         print(f"Connexion fermée : {e}")

# if __name__ == "__main__":
#     host = os.getenv("BACKEND_HOST", "0.0.0.0")
#     port = int(os.getenv("BACKEND_PORT", "8000"))
#     uvicorn.run(app, host=host, port=port)

# ========================================
# WebSocket Endpoint
# ========================================


@app.websocket("/ws/{user_id}/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    session_id: str,
    proactivity: bool = False,
    affective_dialog: bool = False,
) -> None:
    """WebSocket endpoint for bidirectional streaming with ADK.

    Args:
        websocket: The WebSocket connection
        user_id: User identifier
        session_id: Session identifier
        proactivity: Enable proactive audio (native audio models only)
        affective_dialog: Enable affective dialog (native audio models only)
    """
    logger.debug(
        f"WebSocket connection request: user_id={user_id}, session_id={session_id}, "
        f"proactivity={proactivity}, affective_dialog={affective_dialog}"
    )
    await websocket.accept()
    logger.debug("WebSocket connection accepted")

    # ========================================
    # Phase 2: Session Initialization (once per streaming session)
    # ========================================

    # Read model name directly from env var — str(agent.model) may return
    # a BaseLlm object repr instead of the actual model name string.
    model_name = os.getenv("DEMO_AGENT_MODEL", str(agent.model))
    logger.info(f"🔍 Model name resolved to: '{model_name}'")
    is_native_audio = "native-audio" in model_name.lower()

    if is_native_audio:
        # Native audio models require AUDIO response modality
        # with audio transcription
        response_modalities = ["AUDIO"]

        # Build RunConfig with optional proactivity and affective dialog
        # These features are only supported on native audio models
        run_config = RunConfig(
            streaming_mode=StreamingMode.BIDI,
            response_modalities=response_modalities,
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
            session_resumption=types.SessionResumptionConfig(),
            speech_config=types.SpeechConfig(
                language_code="fr-FR",
            ),
            proactivity=(
                types.ProactivityConfig(proactive_audio=True) if proactivity else None
            ),
            enable_affective_dialog=affective_dialog if affective_dialog else None,
        )
        logger.debug(
            f"Native audio model detected: {model_name}, "
            f"using AUDIO response modality, "
            f"proactivity={proactivity}, affective_dialog={affective_dialog}"
        )
    else:
        # Half-cascade models support TEXT response modality
        # for faster performance
        response_modalities = ["TEXT"]
        run_config = RunConfig(
            streaming_mode=StreamingMode.BIDI,
            response_modalities=response_modalities,
            input_audio_transcription=None,
            output_audio_transcription=None,
            session_resumption=types.SessionResumptionConfig(),
        )
        logger.debug(
            f"Half-cascade model detected: {model_name}, "
            "using TEXT response modality"
        )
        # Warn if user tried to enable native-audio-only features
        if proactivity or affective_dialog:
            logger.warning(
                f"Proactivity and affective dialog are only supported on native "
                f"audio models. Current model: {model_name}. "
                f"These settings will be ignored."
            )
    logger.debug(f"RunConfig created: {run_config}")

    # Get or create session (handles both new sessions and reconnections)
    session = await session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )
    if not session:
        await session_service.create_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id
        )

    live_request_queue = LiveRequestQueue()
    
    # Register the queue globally so other endpoints (e.g. MCP Workers) can inject messages into this voice session
    active_queues[session_id] = live_request_queue

    # Track the ADK session credentials so /api/session/adk-state can find it
    active_adk_session["user_id"] = user_id
    active_adk_session["session_id"] = session_id
    logger.info(f"🎯 Active ADK session: user_id={user_id}, session_id={session_id}")

    # ========================================
    # Phase 3: Active Session (concurrent bidirectional communication)
    # ========================================

    async def upstream_task() -> None:
        """Receives messages from WebSocket and sends to LiveRequestQueue."""
        logger.debug("upstream_task started")
        try:
            while True:
                # Receive message from WebSocket (text or binary)
                message = await websocket.receive()

                # Handle binary frames (audio data)
                if "bytes" in message:
                    audio_data = message["bytes"]
                    logger.debug(f"Received binary audio chunk: {len(audio_data)} bytes")

                    audio_blob = types.Blob(
                        mime_type="audio/pcm;rate=16000", data=audio_data
                    )
                    live_request_queue.send_realtime(audio_blob)

                # Handle text frames (JSON messages)
                elif "text" in message:
                    text_data = message["text"]
                    logger.debug(f"Received text message: {text_data[:100]}...")

                    json_message = json.loads(text_data)

                    # Extract text from JSON and send to LiveRequestQueue
                    if json_message.get("type") == "text":
                        logger.debug(f"Sending text content: {json_message['text']}")
                        content = types.Content(
                            parts=[types.Part(text=json_message["text"])]
                        )
                        live_request_queue.send_content(content)

                    # Handle image data — send to Live model via realtime input
                    # The Live API accepts JPEG/PNG frames via send_realtime_input
                    # (max 1 fps). Frontend converts all images to JPEG first.
                    elif json_message.get("type") == "image":
                        image_data = base64.b64decode(json_message["data"])
                        mime_type = json_message.get("mimeType", "image/jpeg")

                        logger.info(
                            f"📸 Image received via WebSocket: "
                            f"{len(image_data)} bytes, type: {mime_type}"
                        )

                        # 1. Send image as a realtime frame so the Live
                        #    model can actually SEE the image
                        image_blob = types.Blob(
                            mime_type=mime_type, data=image_data
                        )
                        live_request_queue.send_realtime(image_blob)

                        # 2. Send a text prompt to trigger the model
                        #    to react to what it sees in the image
                        react_prompt = types.Content(
                            parts=[types.Part.from_text(
                                text=(
                                    "[USER ACTION]: The user just dropped a product "
                                    "image into the studio. You can see the image "
                                    "now via the visual feed. React to what you see "
                                    "— describe the product, the colors, the mood. "
                                    "Then give your creative direction."
                                )
                            )],
                            role="user",
                        )
                        live_request_queue.send_content(react_prompt)
        except (WebSocketDisconnect, RuntimeError):
            logger.debug("Client disconnected (upstream)")

    async def downstream_task() -> None:
        """Receives Events from run_live() and sends to WebSocket.
        
        Includes retry logic for transient Gemini API errors (e.g. 1011
        server-side cancellations).
        """
        max_retries = 3
        retry_delay = 1.0  # seconds, doubles each retry

        for attempt in range(1, max_retries + 1):
            logger.debug(
                f"downstream_task attempt {attempt}/{max_retries}, calling runner.run_live()"
            )
            logger.debug(
                f"Starting run_live with user_id={user_id}, session_id={session_id}"
            )
            try:
                async for event in runner.run_live(
                    user_id=user_id,
                    session_id=session_id,
                    live_request_queue=live_request_queue,
                    run_config=run_config,
                ):
                    event_json = event.model_dump_json(exclude_none=True, by_alias=True)
                    
                    # ── Structured Agent Execution Trace ──
                    content = getattr(event, 'content', None)
                    if content and hasattr(content, 'parts') and content.parts:
                        for part in content.parts:
                            if hasattr(part, 'function_call') and part.function_call:
                                fc = part.function_call
                                logger.info(f"🔧 TOOL CALL: {fc.name}({fc.args})")
                            elif hasattr(part, 'function_response') and part.function_response:
                                fr = part.function_response
                                response_str = str(fr.response)[:200]
                                logger.info(f"📦 TOOL RESPONSE [{fr.name}]: {response_str}")
                            elif hasattr(part, 'text') and part.text:
                                text_preview = part.text[:150]
                                role = getattr(content, 'role', None) or 'model'
                                logger.info(f"💬 [{role.upper()}]: {text_preview}")
                            elif hasattr(part, 'inline_data') and part.inline_data:
                                mime = part.inline_data.mime_type if part.inline_data else 'unknown'
                                logger.debug(f"🔊 AUDIO [{mime}]: chunk received")
                    
                    await websocket.send_text(event_json)
                logger.debug("run_live() generator completed")
                return  # Clean exit — no need to retry

            except (WebSocketDisconnect, RuntimeError):
                logger.debug("Client disconnected (downstream)")
                return  # Client gone — no point retrying

            except genai_errors.APIError as e:
                status_code = getattr(e, 'status_code', None) or getattr(e, 'code', None)
                is_transient = status_code in (1000, 1011, 500, 503)

                if is_transient and attempt < max_retries:
                    wait = retry_delay * (2 ** (attempt - 1))
                    logger.warning(
                        f"⚡ Transient Gemini API error (code={status_code}), "
                        f"retrying in {wait:.1f}s (attempt {attempt}/{max_retries}): {e}"
                    )
                    # Notify the frontend that we're reconnecting
                    try:
                        await websocket.send_json({
                            "type": "connection_status",
                            "status": "reconnecting",
                            "attempt": attempt,
                            "max_retries": max_retries,
                        })
                    except Exception:
                        pass  # Frontend may already be disconnected
                    await asyncio.sleep(wait)
                    continue  # Retry
                else:
                    logger.error(
                        f"❌ Gemini API error (code={status_code}), "
                        f"{'non-transient' if not is_transient else 'max retries exceeded'}: {e}",
                        exc_info=True,
                    )
                    try:
                        await websocket.send_json({
                            "type": "connection_status",
                            "status": "error",
                            "message": f"Gemini API error: {status_code}",
                        })
                    except Exception:
                        pass
                    return

    # Run both tasks concurrently
    # Exceptions from either task will propagate and cancel the other task
    try:
        logger.debug("Starting asyncio.gather for upstream and downstream tasks")
        await asyncio.gather(upstream_task(), downstream_task())
        logger.debug("asyncio.gather completed normally")
    except WebSocketDisconnect:
        logger.debug("Client disconnected normally")
    except Exception as e:
        logger.error(f"Unexpected error in streaming tasks: {e}", exc_info=True)
    finally:
        # ========================================
        # Phase 4: Session Termination
        # ========================================

        # Always close the queue, even if exceptions occurred
        logger.debug("Closing live_request_queue")
        live_request_queue.close()

        # Clean up global references to prevent stale entries
        active_queues.pop(session_id, None)
        if active_adk_session.get("session_id") == session_id:
            active_adk_session.clear()
        logger.debug(f"Session {session_id} cleaned up")
