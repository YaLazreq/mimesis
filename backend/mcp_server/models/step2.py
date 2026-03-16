"""Step 2 — Discovery Brief Models."""

from pydantic import BaseModel, Field


class MasterSequenceScene(BaseModel):
    scene_number: int = Field(description="Scene number (1-6)")
    beat_name: str = Field(
        description="Name of the emotional beat (e.g. 'The Hook', 'Climax')"
    )
    emotion: str = Field(
        description="Emotion(s) for this scene (e.g. 'intrigue, tension')"
    )
    action_summary: str = Field(
        description="1 sentence — what happens emotionally in this scene"
    )
    duration_estimate: str = Field(
        description="Estimated timecode range (e.g. '0:00–0:05')"
    )
