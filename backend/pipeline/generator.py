"""
generator.py — GPT Image generation step.

Uses the OpenAI Responses API with the image_generation tool.
For the first iteration in a session (no previous_response_id) a fresh image
is generated.  For subsequent iterations the previous_response_id is passed
so the model can refine the same image contextually.

If an iterative call fails (e.g. the response_id has expired) the function
automatically falls back to a fresh generation and logs a warning.

Response is base64-encoded; we return the raw b64 string, the fully-assembled
prompt, and the new response_id so downstream steps can persist it.
"""

import base64
import io
import logging
from typing import Literal

from openai import AsyncOpenAI, OpenAIError
from PIL import Image

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
    previous_response_id: str | None = None,
) -> dict:
    """
    Generate an interior design image via the OpenAI Responses API.

    For the first iteration in a session pass previous_response_id=None.
    For subsequent iterations pass the response_id returned by the previous
    call — the model will refine the same image rather than starting fresh.

    If the iterative call fails (e.g. expired / purged response_id) the
    function automatically retries without previous_response_id and logs a
    warning so the pipeline degrades gracefully rather than crashing.

    Args:
        prompt:               The designer's text prompt.
        room_type:            One of the four supported room types; controls
                              the prefix prepended to the prompt.
        previous_response_id: OpenAI response ID from the previous iteration
                              in this session, or None for a fresh generation.

    Returns:
        {
            "image_base64": str,  # raw base64 string (no data-URI prefix)
            "full_prompt":  str,  # exactly what was sent to the model
            "response_id":  str,  # new OpenAI response ID — persist this
        }

    Raises:
        RuntimeError: if the API key is missing.
        OpenAIError:  re-raised after logging on unrecoverable API failure.
    """
    prefix = ROOM_PREFIXES.get(room_type, "")
    full_prompt = f"{prefix}{prompt}" if prefix else prompt

    logger.info(
        "Generating image | room_type=%s | prompt_len=%d | iterative=%s",
        room_type, len(full_prompt), previous_response_id is not None,
    )

    client = _get_client()

    # ------------------------------------------------------------------
    # Inner helper — one Responses API call
    # ------------------------------------------------------------------
    async def _call(prev_id: str | None) -> dict:
        kwargs: dict = {
            "model": "gpt-4o",
            "input": full_prompt,
            "tools": [{"type": "image_generation", "size": "1536x1024", "quality": "medium"}],
        }
        if prev_id:
            kwargs["previous_response_id"] = prev_id

        result = await client.responses.create(**kwargs)

        # Extract the generated image from the output list
        image_data = [
            output.result
            for output in result.output
            if output.type == "image_generation_call"
        ]
        image_base64: str = image_data[0] if image_data else ""

        if not image_base64:
            raise RuntimeError(
                "Responses API returned no image_generation_call output"
            )

        logger.info(
            "Image generated | b64_len=%d | response_id=%s",
            len(image_base64), result.id,
        )

        return {
            "image_base64": image_base64,
            "full_prompt":  full_prompt,
            "response_id":  result.id,
        }

    # ------------------------------------------------------------------
    # Try iterative first; fall back to fresh on failure
    # ------------------------------------------------------------------
    try:
        return await _call(previous_response_id)

    except OpenAIError as exc:
        if previous_response_id:
            # The stored response_id may have expired — retry without it
            logger.warning(
                "Iterative generation failed (response_id=%s): %s — retrying fresh",
                previous_response_id, exc,
            )
            try:
                return await _call(None)
            except OpenAIError as exc2:
                logger.error(
                    "Fresh-generation fallback also failed: %s", exc2, exc_info=True
                )
                raise exc2

        logger.error("OpenAI API error during image generation: %s", exc, exc_info=True)
        raise

    except Exception as exc:
        logger.error("Unexpected error during image generation: %s", exc, exc_info=True)
        raise


# ---------------------------------------------------------------------------
# Mask-based region editing (images.edit API)
# ---------------------------------------------------------------------------

async def edit_image(
    prompt: str,
    image_base64: str,
    mask_base64: str,
    room_type: Literal["office", "living_room", "patient_room", "free_flowing"] = "living_room",
) -> dict:
    """
    Edit a masked region of an existing design image using gpt-image-1.

    Mask convention (frontend → backend):
      - Painted pixels  : alpha = 255 (opaque)  — user marked these for replacement
      - Unpainted pixels: alpha = 0   (transparent) — user wants these kept

    We invert the alpha before sending to OpenAI's images.edit API, which
    expects the opposite: alpha = 0 (transparent) = "replace this area".

    The mask is also resized server-side to match the source image's actual
    pixel dimensions (which differ from the displayed canvas dimensions).

    Args:
        prompt:        Descriptive prompt for the edited region.
        image_base64:  Raw base64 PNG of the current design (no data-URI prefix).
        mask_base64:   Raw base64 RGBA PNG of the user's paint strokes.
        room_type:     Controls the prefix prepended to the prompt.

    Returns:
        {"image_base64": str, "full_prompt": str, "response_id": str}

    Raises:
        RuntimeError:  If the API key is missing or the edit returns no image.
        OpenAIError:   Re-raised on unrecoverable API errors.
    """
    prefix      = ROOM_PREFIXES.get(room_type, "")
    full_prompt = f"{prefix}{prompt}" if prefix else prompt

    client = _get_client()

    # ── Decode the source image ───────────────────────────────────────────
    image_bytes = base64.b64decode(image_base64)
    source_img  = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    actual_w, actual_h = source_img.size

    # ── Decode, scale, and invert the mask ───────────────────────────────
    # Scale from canvas (display) dimensions → actual image resolution.
    mask_pil = Image.open(io.BytesIO(base64.b64decode(mask_base64))).convert("RGBA")
    if mask_pil.size != (actual_w, actual_h):
        mask_pil = mask_pil.resize((actual_w, actual_h), Image.LANCZOS)

    # Invert alpha: painted (255) → 0 (transparent = OpenAI edits here)
    #               unpainted (0) → 255 (opaque = OpenAI leaves untouched)
    r, g, b, a = mask_pil.split()
    a_inv        = a.point(lambda x: 255 - x)
    mask_inverted = Image.merge("RGBA", (r, g, b, a_inv))

    mask_buf = io.BytesIO()
    mask_inverted.save(mask_buf, format="PNG")
    mask_buf.seek(0)

    # Re-encode source image as PNG (may have arrived as JPEG) for the API
    img_buf = io.BytesIO()
    source_img.save(img_buf, format="PNG")
    img_buf.seek(0)

    logger.info(
        "Editing image | room_type=%s | prompt_len=%d | image_size=%dx%d",
        room_type, len(full_prompt), actual_w, actual_h,
    )

    # ── Call images.edit ──────────────────────────────────────────────────
    response = await client.images.edit(
        model="gpt-image-1",
        image=("image.png", img_buf, "image/png"),
        mask=("mask.png", mask_buf, "image/png"),
        prompt=full_prompt,
        n=1,
        size="1536x1024",          
    )

    # The API may return b64_json or url depending on response_format default
    result_item = response.data[0]
    result_b64: str = getattr(result_item, "b64_json", None) or ""

    if not result_b64:
        # URL-mode fallback: download the image and encode it ourselves
        url = getattr(result_item, "url", None)
        if url:
            import httpx  # already in requirements
            async with httpx.AsyncClient() as http:
                img_resp = await http.get(url, timeout=60.0)
                result_b64 = base64.b64encode(img_resp.content).decode("ascii")

    if not result_b64:
        raise RuntimeError("images.edit returned no image data")

    logger.info("Edit image generated | b64_len=%d", len(result_b64))

    return {
        "image_base64": result_b64,
        "full_prompt":  full_prompt,
        "response_id":  "",  # images.edit does not return a chained response_id
    }
