"""
sessions.py — In-memory session store for pipeline iterations and raw images.

Intentionally simple for the demo: a plain dict keyed by session_id.
No persistence, no TTL — data lives for the lifetime of the server process.

Two stores:
  _sessions : session_id  → ordered list of Iteration objects
  _images   : "{session_id}/{iteration_number}" → raw base64 image string

The image is stored separately so that Iteration objects (which live inside
GenerateResponse) don't carry megabytes of base64 in every API response.
The /api/image/{session_id}/{iteration_number} endpoint serves them on demand.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from api.schemas import Iteration

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory stores (module-level singletons)
# ---------------------------------------------------------------------------

_sessions: dict[str, list["Iteration"]] = {}
_images:   dict[str, str] = {}          # key: "{session_id}/{iteration_number}"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_history(session_id: str) -> list["Iteration"]:
    """
    Return all iterations for *session_id*, oldest first.
    Returns an empty list for unknown session IDs.
    """
    return list(_sessions.get(session_id, []))


def get_next_iteration_number(session_id: str) -> int:
    """Return 1-based index for the next iteration in this session."""
    return len(_sessions.get(session_id, [])) + 1


def add_iteration(
    session_id: str,
    iteration: "Iteration",
    image_base64: str,
) -> None:
    """
    Append *iteration* to the session history and cache the raw image.

    Args:
        session_id:    The session this iteration belongs to.
        iteration:     Fully-built Iteration object (from orchestrator).
        image_base64:  Raw base64 string from gpt-image-1 (no data-URI prefix).
    """
    if session_id not in _sessions:
        _sessions[session_id] = []
        logger.info("New session created: %s", session_id)

    _sessions[session_id].append(iteration)

    image_key = f"{session_id}/{iteration.iteration_number}"
    _images[image_key] = image_base64

    logger.debug(
        "Stored iteration %d for session %s  (total=%d)",
        iteration.iteration_number,
        session_id,
        len(_sessions[session_id]),
    )


def get_image(session_id: str, iteration_number: int) -> str | None:
    """
    Retrieve the raw base64 image for a specific iteration.
    Returns None if not found.
    """
    return _images.get(f"{session_id}/{iteration_number}")


def session_exists(session_id: str) -> bool:
    return session_id in _sessions
