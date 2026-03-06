"""
orchestrator.py — Master pipeline coordinator for IIGenAI.

Wires together all pipeline steps into a single async function:

  run_pipeline(GenerateRequest) → GenerateResponse

Pipeline steps
──────────────
  1  generate_image          gpt-image-1   → base64 image
  2  identify_materials      gpt-4.1-mini  → material dicts with confidence
  3  CoT retry               gpt-4.1-mini  → re-assess yellow-flag materials
  4  ground_materials        ICE / M2050   → GroundedMaterial objects with CO₂e
  5  build & store           sessions.py   → Iteration + GenerateResponse

Error philosophy
────────────────
Each step is wrapped independently.  If a step fails the pipeline degrades
gracefully rather than crashing:
  - Step 1 failure → returns empty Iteration (no image, no materials)
  - Step 2 failure → returns Iteration with image_url but no materials
  - Step 3 failure → continues with original confidences from step 2
  - Step 4 failure → returns Iteration with materials but no CO₂e data
"""

import json
import logging
import re
from typing import Any

from openai import AsyncOpenAI

from api.schemas import GenerateRequest, GenerateResponse, GroundedMaterial, Iteration
from config import settings
from pipeline.generator import generate_image
from pipeline.grounder import ground_materials
from pipeline.identifier import identify_materials_with_consistency
from store.sessions import add_iteration, get_history, get_next_iteration_number

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Yellow-flag confidence band
#   green  ≥ 0.6  — accepted as-is
#   yellow  0.4 ≤ conf < 0.6  — CoT retry attempted
#   red    < 0.4  — no retry (low signal; flag for human review)
# ---------------------------------------------------------------------------

_YELLOW_LOW  = 0.40
_YELLOW_HIGH = 0.60   # exclusive (0.60 is already green)


# ---------------------------------------------------------------------------
# Lazy OpenAI client for CoT retries (separate from identifier's singleton
# so this module has no import-time side-effects on the other modules)
# ---------------------------------------------------------------------------

_oa_client: AsyncOpenAI | None = None


def _get_openai_client() -> AsyncOpenAI:
    global _oa_client
    if _oa_client is None:
        if not settings.openai_api_key:
            raise RuntimeError(
                "OPENAI_API_KEY is not set. Add it to your .env file and restart."
            )
        _oa_client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _oa_client


# ---------------------------------------------------------------------------
# CoT retry helpers
# ---------------------------------------------------------------------------

def _extract_json_from_cot(text: str) -> dict[str, Any] | None:
    """
    Pull the last JSON object out of a response that may contain
    free-form reasoning text before the structured answer.

    Tries progressively: last {...} block → any {...} block → None.
    """
    # Find all top-level {...} blocks (non-nested for simplicity)
    candidates = re.findall(r'\{[^{}]*\}', text, re.DOTALL)
    for raw in reversed(candidates):      # last block is most likely the answer
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            continue
    return None


async def _retry_material_cot(
    client: AsyncOpenAI,
    image_base64: str,
    material_name: str,
    current_confidence: float,
) -> float:
    """
    Run a single targeted chain-of-thought verification for one material.

    The model is asked to reason step-by-step about whether *material_name*
    is genuinely present in the image, then emit a structured verdict.

    Returns the updated confidence (may be higher than *current_confidence*
    if confirmed, or unchanged if unconfirmed / on any error).
    We never lower confidence from a retry — a CoT pass is an opportunity
    to surface more evidence, not to penalise uncertain materials further.
    """
    cot_prompt = (
        f"Look at this specific area of the image. Step by step, analyze the "
        f"texture, color, and surface quality. Is this material '{material_name}' "
        f"present? Provide your reasoning.\n\n"
        f"After your reasoning, output ONLY this JSON on the final line "
        f"(no markdown, no extra text):\n"
        f'{{"confirmed": true, "confidence": 0.85}}'
        f"\nor\n"
        f'{{"confirmed": false, "confidence": 0.25}}'
    )

    try:
        response = await client.responses.create(
            model="gpt-4.1-mini",
            input=[{
                "role": "user",
                "content": [
                    {"type": "input_text",  "text": cot_prompt},
                    {"type": "input_image", "image_url": f"data:image/png;base64,{image_base64}"},
                ],
            }],
            temperature=0.3,    # lower temp for decisive verdicts
        )

        parsed = _extract_json_from_cot(response.output_text.strip())
        if parsed is None:
            logger.warning("CoT retry for '%s': could not parse JSON from response", material_name)
            return current_confidence

        confirmed    = bool(parsed.get("confirmed", False))
        new_conf     = float(parsed.get("confidence", current_confidence))
        new_conf     = max(0.0, min(new_conf, 1.0))   # clamp to [0, 1]

        if confirmed and new_conf > current_confidence:
            logger.info(
                "CoT retry confirmed '%s': %.2f → %.2f",
                material_name, current_confidence, new_conf,
            )
            return new_conf

        return current_confidence

    except Exception as exc:
        logger.warning("CoT retry failed for '%s': %s", material_name, exc)
        return current_confidence


async def _apply_cot_retries(
    image_base64: str,
    identified: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    For each yellow-flag material, run a targeted CoT re-assessment.
    Returns a new list with updated confidence values.

    Yellow materials are processed sequentially (not concurrently) to
    avoid hitting rate limits during an already-expensive pipeline run.
    """
    client  = _get_openai_client()
    updated = []
    retried = 0

    for material in identified:
        conf = float(material.get("confidence", 0.0))

        if _YELLOW_LOW <= conf < _YELLOW_HIGH:
            new_conf = await _retry_material_cot(
                client, image_base64, material["name"], conf
            )
            updated.append({**material, "confidence": new_conf})
            retried += 1
        else:
            updated.append(material)

    if retried:
        logger.info("CoT retries applied to %d yellow-flag material(s)", retried)

    return updated


# ---------------------------------------------------------------------------
# Main pipeline entry point
# ---------------------------------------------------------------------------

async def run_pipeline(request: GenerateRequest) -> GenerateResponse:
    """
    Execute the full IIGenAI pipeline for one design generation request.

    Steps:
      1. Generate interior design image  (gpt-image-1)
      2. Identify materials              (gpt-4.1-mini, 5-pass self-consistency)
      3. CoT retry yellow-flag materials (gpt-4.1-mini, targeted reasoning)
      4. Ground materials with CO₂e data (ICE DB + Material2050 fallback)
      5. Build Iteration, persist to session store, return GenerateResponse

    Args:
        request: Validated GenerateRequest from the API layer.

    Returns:
        GenerateResponse with the current Iteration and full session history.
        Never raises — degrades gracefully on partial failures.
    """
    session_id       = request.session_id
    history          = get_history(session_id)          # snapshot BEFORE this run
    iteration_number = get_next_iteration_number(session_id)

    # Working state — built up as each step succeeds
    image_base64:  str                   = ""
    full_prompt:   str                   = request.prompt
    identified:    list[dict[str, Any]]  = []
    grounded:      list[GroundedMaterial] = []

    logger.info(
        "Pipeline start | session=%s | iteration=%d | room=%s",
        session_id, iteration_number, request.room_type,
    )

    # ── Step 1: Generate image ────────────────────────────────────────────
    try:
        gen = await generate_image(request.prompt, request.room_type)
        image_base64 = gen["image_base64"]
        full_prompt  = gen["full_prompt"]
        logger.info("Step 1 ✓ image generated (%d chars b64)", len(image_base64))
    except Exception as exc:
        logger.error("Step 1 ✗ image generation failed: %s", exc)
        # Cannot recover — return a minimal response with no image or materials
        empty_iteration = Iteration(
            iteration_number=iteration_number,
            prompt=full_prompt,
            image_url="",
            materials=[],
        )
        add_iteration(session_id, empty_iteration, image_base64="")
        return GenerateResponse(
            session_id=session_id,
            current_iteration=empty_iteration,
            history=history,
        )

    # ── Step 2: Identify materials (5-pass self-consistency) ──────────────
    if image_base64:
        try:
            identified = await identify_materials_with_consistency(image_base64)
            logger.info("Step 2 ✓ %d material(s) identified", len(identified))
        except Exception as exc:
            logger.error("Step 2 ✗ material identification failed: %s", exc)
            # Proceed with no materials — image is still valid

    # ── Step 3: CoT retry for yellow-flag materials ───────────────────────
    if image_base64 and identified:
        yellow_count = sum(
            1 for m in identified
            if _YELLOW_LOW <= float(m.get("confidence", 0)) < _YELLOW_HIGH
        )
        if yellow_count:
            logger.info("Step 3: %d yellow material(s) queued for CoT retry", yellow_count)
            try:
                identified = await _apply_cot_retries(image_base64, identified)
                logger.info("Step 3 ✓ CoT retries complete")
            except Exception as exc:
                logger.warning("Step 3 ✗ CoT retries failed (non-fatal): %s", exc)
                # Non-fatal — continue with original confidences
        else:
            logger.info("Step 3 — no yellow materials, skipping CoT retries")

    # ── Step 4: Ground materials with CO₂e data ───────────────────────────
    if identified:
        try:
            grounded = await ground_materials(identified)
            logger.info(
                "Step 4 ✓ %d grounded, %d with CO₂e, %d need review",
                len(grounded),
                sum(1 for m in grounded if m.co2e_value is not None),
                sum(1 for m in grounded if m.requires_human_review),
            )
        except Exception as exc:
            logger.error("Step 4 ✗ grounding failed (non-fatal): %s", exc)
            # Degrade: return materials without CO₂e enrichment
            grounded = [
                GroundedMaterial(
                    name=m.get("name", ""),
                    description=m.get("description", ""),
                    confidence=float(m.get("confidence", 0.0)),
                )
                for m in identified
            ]

    # ── Step 5: Build Iteration, persist, return ──────────────────────────
    image_url = (
        f"/api/image/{session_id}/{iteration_number}"
        if image_base64 else ""
    )

    iteration = Iteration(
        iteration_number=iteration_number,
        prompt=full_prompt,
        image_url=image_url,
        materials=grounded,
    )

    add_iteration(session_id, iteration, image_base64)

    logger.info(
        "Pipeline complete | session=%s | iteration=%d | total_co2e=%s | human_review=%s",
        session_id,
        iteration_number,
        iteration.total_co2e,
        any(m.requires_human_review for m in grounded),
    )

    return GenerateResponse(
        session_id=session_id,
        current_iteration=iteration,
        history=history,          # iterations BEFORE this one, oldest first
    )
