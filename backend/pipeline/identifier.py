"""
identifier.py — VLM material identification step.

Uses gpt-4.1-mini via the OpenAI Responses API with self-consistency sampling:
run n_passes independent inference calls concurrently, then aggregate results
by counting how many passes each material appeared in to derive a confidence score.
"""

import asyncio
import json
import logging
from typing import Any

from openai import AsyncOpenAI, OpenAIError

from config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

_IDENTIFICATION_PROMPT = """You are an architectural material expert. Analyze this interior design image and identify up to 10 primary ARCHITECTURAL material finishes .
Focus ONLY on: walls, floors, ceilings, structural elements, windows, doors, and fixed architectural features.
EXCLUDE completely: furniture, upholstery, fabric, curtains, cushions, decorative items, plants, and any movable objects.
For each material provide:
- 'material': the common construction material name
- 'description': one line describing visual characteristics
Return ONLY a valid JSON array, no markdown, no explanation."""

# ---------------------------------------------------------------------------
# Lazy singleton client
# ---------------------------------------------------------------------------

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        if not settings.openai_api_key:
            raise RuntimeError(
                "OPENAI_API_KEY is not set. "
                "Add it to your .env file and restart the server."
            )
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


# ---------------------------------------------------------------------------
# Single-pass identification
# ---------------------------------------------------------------------------

async def identify_materials_single_pass(image_base64: str) -> list[dict[str, Any]]:
    """
    Send one image to gpt-4.1-mini via the Responses API and return the
    parsed list of material dicts (keys: 'material', 'description').

    Returns an empty list on any JSON parse failure so the caller can
    continue aggregating results from the other passes.
    """
    client = _get_client()

    try:
        response = await client.responses.create(
            model="gpt-4.1-mini",
            input=[{
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": _IDENTIFICATION_PROMPT,
                    },
                    {
                        "type": "input_image",
                        "image_url": f"data:image/png;base64,{image_base64}",
                    },
                ],
            }],
            temperature=0.7,
        )

        raw_text: str = response.output_text.strip()

        # Strip accidental markdown code fences if the model adds them
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
            raw_text = raw_text.strip()

        return json.loads(raw_text)

    except OpenAIError as exc:
        logger.error("Responses API error in single pass: %s", exc, exc_info=True)
        return []
    except json.JSONDecodeError as exc:
        logger.warning("JSON parse failed in single pass: %s", exc)
        return []
    except Exception as exc:
        logger.error("Unexpected error in single pass: %s", exc, exc_info=True)
        return []


# ---------------------------------------------------------------------------
# Self-consistency aggregation
# ---------------------------------------------------------------------------

async def identify_materials_with_consistency(
    image_base64: str,
    n_passes: int = 5,
) -> list[dict[str, Any]]:
    """
    Run n_passes independent identification calls concurrently, then aggregate
    by counting co-occurrence frequency across passes to derive confidence.

    Algorithm:
      1. Fire all passes simultaneously with asyncio.gather.
      2. For each unique material name (normalised to lowercase):
           confidence = passes_it_appeared_in / n_passes
           description = taken from the first pass it was seen in
      3. Sort descending by confidence, return top 10.

    Returns a list of dicts:
        {"name": str, "description": str, "confidence": float}
    """
    logger.info("Starting self-consistency sampling | n_passes=%d", n_passes)

    all_passes: list[list[dict]] = await asyncio.gather(
        *[identify_materials_single_pass(image_base64) for _ in range(n_passes)]
    )

    # norm_key -> {"name": original_name, "description": str, "count": int}
    aggregated: dict[str, dict[str, Any]] = {}

    for pass_index, pass_results in enumerate(all_passes):
        seen_this_pass: set[str] = set()

        for item in pass_results:
            raw_name: str = item.get("material", "").strip()
            norm: str = raw_name.lower().strip()

            if not norm or norm in seen_this_pass:
                # Skip empty names and de-duplicate within a single pass
                continue

            seen_this_pass.add(norm)

            if norm not in aggregated:
                aggregated[norm] = {
                    "name": raw_name,
                    "description": item.get("description", ""),
                    "count": 1,
                }
            else:
                aggregated[norm]["count"] += 1

        logger.debug(
            "Pass %d/%d returned %d materials", pass_index + 1, n_passes, len(pass_results)
        )

    # Build output list with confidence scores
    results: list[dict[str, Any]] = [
        {
            "name": data["name"],
            "description": data["description"],
            "confidence": round(data["count"] / n_passes, 2),
        }
        for data in aggregated.values()
    ]

    results.sort(key=lambda x: x["confidence"], reverse=True)
    top10 = results[:10]

    logger.info(
        "Consistency aggregation complete | unique_materials=%d | returning=%d",
        len(results),
        len(top10),
    )

    return top10
