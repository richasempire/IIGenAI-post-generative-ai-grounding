import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, computed_field


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------

class GenerateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    prompt: str = Field(..., min_length=1, description="Designer's text prompt")
    username: str = Field(..., min_length=1, description="Display name from login")
    session_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Session identifier; auto-generated UUID if omitted",
    )
    room_type: Literal["office", "living_room", "patient_room", "free_flowing"] = Field(
        default="living_room",
        description="Type of room being designed",
    )


# ---------------------------------------------------------------------------
# Edit request — mask-based region editing
# ---------------------------------------------------------------------------

class EditRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    prompt: str = Field(..., min_length=1, description="Describe what to place in the painted region")
    image_base64: str = Field(..., description="Raw base64 PNG of the current design iteration")
    mask_base64: str = Field(
        ...,
        description=(
            "RGBA PNG mask (base64). "
            "Painted pixels = alpha 255 (opaque) → server inverts to transparent = replace. "
            "Unpainted pixels = alpha 0 (transparent) → server inverts to opaque = keep."
        ),
    )
    session_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Session identifier; reuse the existing session_id to chain iterations",
    )
    username: str = Field(..., min_length=1, description="Display name from login")
    room_type: Literal["office", "living_room", "patient_room", "free_flowing"] = Field(
        default="living_room",
        description="Type of room being designed (supplies prompt prefix)",
    )


# ---------------------------------------------------------------------------
# Material identification (vision model output)
# ---------------------------------------------------------------------------

class MaterialIdentification(BaseModel):
    """A single material spotted by the vision model."""

    name: str = Field(..., description='Material name, e.g. "Rammed Earth"')
    description: str = Field(..., description="One-line material characteristic")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model confidence 0–1")

    @computed_field  # type: ignore[prop-decorator]
    @property
    def flag(self) -> Literal["green", "yellow", "red"]:
        """
        green  → confidence ≥ 0.6  (3+/5 passes agree — ready to use)
        yellow → confidence ≥ 0.4  (2/5 passes — moderate, surface for review)
        red    → confidence < 0.4  (1/5 passes — low confidence, needs human review)
        """
        if self.confidence >= 0.6:
            return "green"
        if self.confidence >= 0.4:
            return "yellow"
        return "red"


# ---------------------------------------------------------------------------
# Grounded material (MCP / Material2050 enriched)
# ---------------------------------------------------------------------------

class GroundedMaterial(MaterialIdentification):
    """MaterialIdentification enriched with real-world CO₂e data."""

    co2e_value: Optional[float] = Field(
        default=None, description="kg CO₂e per unit; None if not yet retrieved"
    )
    co2e_unit: Optional[str] = Field(
        default=None, description='Unit string, e.g. "per m³" or "per kg"'
    )
    database_match: Optional[str] = Field(
        default=None, description="Matched Material2050 entry name"
    )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def requires_human_review(self) -> bool:
        """True when the vision model's confidence was too low to trust."""
        return self.flag == "red"


# ---------------------------------------------------------------------------
# Iteration (one generate → identify → ground cycle)
# ---------------------------------------------------------------------------

class Iteration(BaseModel):
    """A single pass through the full pipeline."""

    iteration_number: int = Field(..., ge=1)
    prompt: str = Field(..., description="Prompt used for this iteration")
    image_url: str = Field(..., description="URL of the DALL-E generated image")
    materials: list[GroundedMaterial] = Field(default_factory=list)
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC timestamp of pipeline completion",
    )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def total_co2e(self) -> Optional[float]:
        """
        Sum of all non-None co2e_values across materials.
        Returns None when no material has CO₂e data yet.
        """
        values = [m.co2e_value for m in self.materials if m.co2e_value is not None]
        return round(sum(values), 4) if values else None


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------

class GenerateResponse(BaseModel):
    """Top-level API response returned after each generate call."""

    session_id: str
    current_iteration: Iteration
    history: list[Iteration] = Field(
        default_factory=list,
        description="All previous iterations in this session, oldest first",
    )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def human_review_needed(self) -> bool:
        """True if any material in the current iteration has a red flag."""
        return any(m.flag == "red" for m in self.current_iteration.materials)
