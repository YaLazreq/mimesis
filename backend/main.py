import logging
import os
import base64
import json
import warnings
import asyncio

from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
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
    # Use resolve_session_id since MCP server might not have the correct WebSocket session ID
    resolved_session_id = state_store.resolve_session_id(payload.session_id)
    target_session_id = resolved_session_id or payload.session_id
    
    logger.info(f"📨 Notification for {target_session_id}: {payload.message}")
    
    live_queue = active_queues.get(target_session_id)
    if not live_queue:
        logger.warning(f"⚠️ Cannot notify session {target_session_id} - no active LiveRequestQueue found.")
        return {"status": "ignored", "reason": "no active queue"}
    
    # Inject message directly into the queue so the ADK runner sends it to the Gemini Live agent
    notification_content = types.Content(
        parts=[types.Part(text=payload.message)],
        role="user" 
    )
    live_queue.send_content(notification_content)
    
    return {"status": "ok", "delivered_to": target_session_id}


@app.get("/api/state/{session_id}")
async def get_state(session_id: str):
    """Debug endpoint — inspect the current state for a session."""
    return state_store.get_state(session_id)


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

                    # Handle image data
                    elif json_message.get("type") == "image":
                        logger.debug("Received image data")

                        # Decode base64 image data
                        image_data = base64.b64decode(json_message["data"])
                        mime_type = json_message.get("mimeType", "image/jpeg")

                        logger.debug(
                            f"Sending image: {len(image_data)} bytes, " f"type: {mime_type}"
                        )

                        # Send image as blob
                        image_blob = types.Blob(mime_type=mime_type, data=image_data)
                        live_request_queue.send_realtime(image_blob)
        except (WebSocketDisconnect, RuntimeError):
            logger.debug("Client disconnected (upstream)")

    async def downstream_task() -> None:
        """Receives Events from run_live() and sends to WebSocket."""
        logger.debug("downstream_task started, calling runner.run_live()")
        logger.debug(
            f"Starting run_live with user_id={user_id}, " f"session_id={session_id}"
        )
        try:
            async for event in runner.run_live(
                user_id=user_id,
                session_id=session_id,
                live_request_queue=live_request_queue,
                run_config=run_config,
            ):
                event_json = event.model_dump_json(exclude_none=True, by_alias=True)
                logger.debug(f"[SERVER] Event: {event_json}")
                await websocket.send_text(event_json)
            logger.debug("run_live() generator completed")
        except (WebSocketDisconnect, RuntimeError):
            logger.debug("Client disconnected (downstream)")

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
