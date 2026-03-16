"""AgentStateStore — singleton in-memory state for agent-discovered brand data.

Stores brand data **per session** and notifies WebSocket subscribers in
real-time when a tool pushes an update.

The store manages three kinds of state:
    1. **Data state**: brand_name, brand_slogan, brand_last_news, etc.
    2. **UI state**: visible_components — an array of component IDs that the
       agent wants the frontend to render.
    3. **Phase state**: current_phase — which step the session is in
       ("brand_research", "brief", "sequence", "validated")

Step 1 component IDs (brand research):
    - "brand_name"            (brand name display)
    - "brand_slogan"          (tagline / catchphrase)
    - "brand_symbols"         ([{title, summary}] — visual symbols with explanations)
    - "brand_mission"         (["string"] — short punchy mission phrases, 6-7 words max)
    - "brand_common_enemy"    (what the brand fights against)
    - "brand_strategy"        ([{title, summary}] — strategic pillars with details)
    - "brand_last_news"       ([{title, summary}] — news feed)
    - "brand_viral_campaign"  (["string"] — short campaign titles)
    - "brand_creative_angle"  ([{title, summary}] — creative angles with interpretations)
    - "primary_color"         (animated background)
    - "secondary_color"       (secondary color)
    - "style_keywords"        (key stylistic words)

Step 2 component IDs (discovery brief):
    - "ad_objective"          (objective + summary card)
    - "ad_audience"           (audience details + persona card)
    - "ad_product"            (product focus card)
    - "ad_emotion"            (emotion & tone card)
    - "ad_format"             (format & constraints card)
    - "master_sequence"       (6-scene timeline)

Shortcuts:
    - "all"                   (show everything)
"""

import asyncio
import logging
from collections import defaultdict
from typing import Any

logger = logging.getLogger("mimesis.state")

# ─── All valid component IDs ─────────────────────────────────────────────────

ALL_COMPONENT_IDS = frozenset(
    {
        # Step 1 — Brand Research
        "brand_name",
        "brand_slogan",
        "brand_symbols",
        "brand_mission",
        "brand_common_enemy",
        "brand_strategy",
        "brand_last_news",
        "brand_viral_campaign",
        "brand_creative_angle",
        "primary_color",
        "secondary_color",
        "style_keywords",
        "uploaded_images",
        # Step 2 — Discovery Brief
        "ad_objective",
        "ad_audience",
        "ad_product",
        "ad_emotion",
        "ad_format",
        "master_sequence",
    }
)


class AgentStateStore:
    """In-memory state store with pub/sub for WebSocket push.

    Thread-safe singleton — instantiate with ``AgentStateStore()`` and the
    same instance is always returned.

    The store tracks an **active session** — the most recent frontend
    WebSocket subscriber. When MCP tools push state updates without knowing
    the real frontend session_id, the store routes data to whichever session
    is currently active.
    """

    _instance = None

    def __new__(cls) -> "AgentStateStore":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        # Guard: only initialize once (singleton)
        if hasattr(self, "_initialized"):
            return
        self._initialized = True
        self._state: dict[str, dict[str, Any]] = {}
        self._subscribers: dict[str, list[asyncio.Queue]] = defaultdict(list)
        self._active_session_id: str | None = None

    # ── Active session tracking ──────────────────────────────────────────

    @property
    def active_session_id(self) -> str | None:
        """The session_id of the most recently connected frontend."""
        return self._active_session_id

    def set_active_session(self, session_id: str) -> None:
        """Mark a session as the active one (called on WS connect)."""
        self._active_session_id = session_id
        logger.info(f"🎯 Active session set to: {session_id}")

    def resolve_session_id(self, session_id: str) -> str | None:
        """Resolve a session_id, falling back to the active session.

        MCP tools don't know the real frontend session_id, so they may pass
        an empty or incorrect value.  This method routes to the active
        session as a fallback.
        """
        if session_id and session_id in self._subscribers:
            return session_id
        if self._active_session_id:
            logger.debug(
                f"🔄 Resolved '{session_id}' → active session "
                f"'{self._active_session_id}'"
            )
            return self._active_session_id
        logger.warning("⚠️  No active session to resolve to")
        return None

    # ── Read ─────────────────────────────────────────────────────────────────

    def get_state(self, session_id: str) -> dict[str, Any]:
        """Return the full state dict for *session_id* (empty dict if new)."""
        return self._state.get(session_id, {})

    # ── Write (data) ─────────────────────────────────────────────────────────

    async def update_state(
        self, session_id: str, partial_update: dict[str, Any]
    ) -> dict[str, Any]:
        """Merge *partial_update* into the session state and notify subscribers.

        If *session_id* doesn't match a known subscriber, falls back to
        the active session.
        """
        resolved = self.resolve_session_id(session_id)
        if not resolved:
            logger.warning(f"❌ Cannot update state — no session to target")
            return {}

        if resolved not in self._state:
            self._state[resolved] = {}

        current = self._state[resolved]

        # Shallow-merge only non-empty values
        # Special: uploaded_images is an APPEND-only list
        APPEND_KEYS = {"uploaded_images"}
        clean_patch: dict[str, Any] = {}
        for key, value in partial_update.items():
            if value is not None and value != "" and value != []:
                if key in APPEND_KEYS and isinstance(value, list):
                    # Append to existing list instead of replacing
                    existing = current.get(key, [])
                    current[key] = existing + value
                else:
                    current[key] = value
                clean_patch[key] = current[key]

        if clean_patch:
            await self._broadcast(
                resolved,
                {
                    "type": "state_update",
                    "patch": clean_patch,
                    "state": current,
                },
            )
            logger.info(
                f"📝 State updated for {resolved}: {list(clean_patch.keys())}"
            )

        return current

    # ── Write (UI visibility) ────────────────────────────────────────────────

    async def set_visible_components(
        self, session_id: str, components: list[str]
    ) -> dict[str, Any]:
        """Set which UI components the agent wants the frontend to display.

        Falls back to active session if *session_id* is unknown.
        """
        resolved = self.resolve_session_id(session_id)
        if not resolved:
            logger.warning(f"❌ Cannot set layout — no session to target")
            return {}

        if resolved not in self._state:
            self._state[resolved] = {}

        # Resolve "all" shortcut — uploaded_images is NEVER included in "all"
        # (it must always be explicitly requested by the agent)
        EXCLUDED_FROM_ALL = {"uploaded_images"}
        if "all" in components:
            resolved_components = [c for c in ALL_COMPONENT_IDS if c not in EXCLUDED_FROM_ALL]
        else:
            resolved_components = [c for c in components if c in ALL_COMPONENT_IDS]

        self._state[resolved]["visible_components"] = resolved_components

        await self._broadcast(
            resolved,
            {
                "type": "ui_layout",
                "visible_components": resolved_components,
                "state": self._state[resolved],
            },
        )
        logger.info(f"🖼️  UI layout set for {resolved}: {resolved_components}")

        return self._state[resolved]

    async def add_visible_components(
        self, session_id: str, components: list[str]
    ) -> dict[str, Any]:
        """Add UI components the agent wants the frontend to display, without hiding existing ones."""
        resolved = self.resolve_session_id(session_id)
        if not resolved:
            logger.warning(f"❌ Cannot set layout — no session to target")
            return {}

        if resolved not in self._state:
            self._state[resolved] = {}
            
        current = self._state[resolved].get("visible_components", [])

        # Resolve "all" shortcut — uploaded_images is NEVER included in "all"
        EXCLUDED_FROM_ALL = {"uploaded_images"}
        if "all" in components:
            resolved_components = [c for c in ALL_COMPONENT_IDS if c not in EXCLUDED_FROM_ALL]
        else:
            resolved_components = [c for c in components if c in ALL_COMPONENT_IDS and c not in current]

        new_components = current + resolved_components
        self._state[resolved]["visible_components"] = new_components

        await self._broadcast(
            resolved,
            {
                "type": "ui_layout",
                "visible_components": new_components,
                "state": self._state[resolved],
            },
        )
        logger.info(f"🖼️  UI layout appended for {resolved}: {resolved_components} (Total: {len(new_components)})")

        return self._state[resolved]

    # ── Pub/Sub ──────────────────────────────────────────────────────────────

    def subscribe(self, session_id: str) -> asyncio.Queue:
        """Create and return a new subscriber queue for *session_id*."""
        queue: asyncio.Queue = asyncio.Queue()
        self._subscribers[session_id].append(queue)
        # Auto-set as active session when a subscriber connects
        self.set_active_session(session_id)
        logger.debug(
            f"➕ Subscriber added for {session_id} "
            f"(total: {len(self._subscribers[session_id])})"
        )
        return queue

    def unsubscribe(self, session_id: str, queue: asyncio.Queue) -> None:
        """Remove a subscriber queue (called on WebSocket disconnect)."""
        if session_id in self._subscribers:
            self._subscribers[session_id] = [
                q for q in self._subscribers[session_id] if q is not queue
            ]
            logger.debug(
                f"➖ Subscriber removed for {session_id} "
                f"(remaining: {len(self._subscribers[session_id])})"
            )
            if len(self._subscribers[session_id]) == 0:
                self.clear_session(session_id)

    async def _broadcast(self, session_id: str, event: dict) -> None:
        """Push *event* to every subscriber queue for *session_id*."""
        queues = self._subscribers.get(session_id, [])
        if not queues:
            logger.warning(
                f"📢 Broadcast to {session_id} but no subscribers "
                f"(known sessions: {list(self._subscribers.keys())})"
            )
        for queue in queues:
            await queue.put(event)

    # ── Cleanup ──────────────────────────────────────────────────────────────

    def clear_session(self, session_id: str) -> None:
        """Wipe state and subscribers for a finished session."""
        self._state.pop(session_id, None)
        self._subscribers.pop(session_id, None)
        if self._active_session_id == session_id:
            self._active_session_id = None
        logger.info(f"🗑️  Session {session_id} cleared")


# ─── Global singleton ────────────────────────────────────────────────────────

state_store = AgentStateStore()
