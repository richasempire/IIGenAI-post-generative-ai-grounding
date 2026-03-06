"""
generator.py — GPT Image generation step.

Uses the gpt-image-1 model via the OpenAI Images API.
Response is base64-encoded by default (no URL); we return the raw b64 string
plus the fully-assembled prompt so downstream steps can log it.
"""

import logging
from typing import Literal

from openai import AsyncOpenAI, OpenAIError

from config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Room-type prompt prefixes
# "free_flowing" → no prefix; prompt is used verbatim
# ---------------------------------------------------------------------------

ROOM_PREFIXES: dict[str, str] = {
    "office": (
        "Interior architectural design of a professional office space. "
    ),
    "living_room": (
        "Interior architectural design of a residential living room. "
    ),
    "patient_room": (
        "Interior architectural design of a hospital patient room "
        "following healthcare design standards. "
    ),
    "free_flowing": "",
}

# ---------------------------------------------------------------------------
# Lazy singleton — one AsyncOpenAI client for the lifetime of the process
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
# Public interface
# ---------------------------------------------------------------------------

async def generate_image(
    prompt: str,
    room_type: Literal["office", "living_room", "patient_room", "free_flowing"] = "living_room",
) -> dict:
    """
    Generate an interior design image with gpt-image-1.

    Args:
        prompt:    The designer's text prompt.
        room_type: One of the four supported room types; controls the prefix
                   prepended to the prompt before sending to the API.

    Returns:
        {
            "image_base64": str,   # raw base64 string (no data-URI prefix)
            "full_prompt":  str,   # exactly what was sent to the model
        }

    Raises:
        RuntimeError: if the API key is missing.
        OpenAIError:  re-raised after logging on any API-level failure.
    """
    prefix = ROOM_PREFIXES.get(room_type, "")
    full_prompt = f"{prefix}{prompt}" if prefix else prompt

    logger.info("Generating image | room_type=%s | prompt_len=%d", room_type, len(full_prompt))

    try:
        client = _get_client()

        result = await client.images.generate(
            model="gpt-image-1",
            prompt=full_prompt,
            size="1024x1024",
            quality="medium",
        )

        image_base64: str = result.data[0].b64_json  # type: ignore[union-attr]

        logger.info("Image generated successfully | b64_len=%d", len(image_base64))

        return {
            "image_base64": image_base64,
            "full_prompt": full_prompt,
        }

    except OpenAIError as exc:
        logger.error("OpenAI API error during image generation: %s", exc, exc_info=True)
        raise
    except Exception as exc:
        logger.error("Unexpected error during image generation: %s", exc, exc_info=True)
        raise
