"""
sessions.py — File-based session store for pipeline iterations and images.

Directory layout
────────────────
  backend/data/sessions/{username}/{session_id}.json
      JSON array of serialised Iteration objects (oldest first).

  backend/data/sessions/{username}/images/{session_id}_{iteration_number}.png
      Raw PNG files decoded from the base64 payload.

Atomic writes
─────────────
All writes go to a sibling .tmp file first, then os.replace() renames it
into place.  os.replace() is atomic on POSIX and best-effort on Windows.

Public API (signatures match the old in-memory module, plus `username`):
  get_history(session_id, username)            → list[Iteration]
  get_next_iteration_number(session_id, username) → int
  add_iteration(session_id, iteration, image_base64, username) → None
  get_image(session_id, iteration_number, username) → str | None
  session_exists(session_id, username)         → bool
  get_all_sessions(username)                   → dict[str, list[Iteration]]
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
import tempfile
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from api.schemas import Iteration

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

# Root of all persisted session data
_SESSIONS_ROOT = Path(__file__).parent.parent / "data" / "sessions"
_SESSIONS_ROOT.mkdir(parents=True, exist_ok=True)


def _safe(username: str) -> str:
    """Sanitise *username* to a filesystem-safe directory name."""
    safe = re.sub(r"[^\w\-]", "_", username.strip())
    return safe[:64] or "anonymous"


def _user_dir(username: str) -> Path:
    return _SESSIONS_ROOT / _safe(username)


def _session_file(session_id: str, username: str) -> Path:
    return _user_dir(username) / f"{session_id}.json"


def _image_file(session_id: str, iteration_number: int, username: str) -> Path:
    return _user_dir(username) / "images" / f"{session_id}_{iteration_number}.png"


# ---------------------------------------------------------------------------
# Atomic I/O helpers
# ---------------------------------------------------------------------------

def _atomic_write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text)
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def _atomic_write_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


# ---------------------------------------------------------------------------
# Session JSON helpers
# ---------------------------------------------------------------------------

def _load_session(path: Path) -> list["Iteration"]:
    """Read and deserialise a session JSON file.  Returns [] on any error."""
    from api.schemas import Iteration  # local import to avoid circular deps

    if not path.exists():
        return []
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        return [Iteration.model_validate(d) for d in raw]
    except Exception as exc:
        logger.warning("Could not load session file %s: %s", path, exc)
        return []


def _save_session(path: Path, iterations: list["Iteration"]) -> None:
    data = [it.model_dump(mode="json") for it in iterations]
    _atomic_write_text(path, json.dumps(data, ensure_ascii=False, indent=2))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_history(session_id: str, username: str) -> list["Iteration"]:
    """Return all iterations for *session_id*, oldest first."""
    return _load_session(_session_file(session_id, username))


def get_next_iteration_number(session_id: str, username: str) -> int:
    """Return 1-based index for the next iteration in this session."""
    return len(get_history(session_id, username)) + 1


def add_iteration(
    session_id: str,
    iteration: "Iteration",
    image_base64: str,
    username: str,
) -> None:
    """
    Append *iteration* to the on-disk session history and save the PNG image.

    Args:
        session_id:    The session this iteration belongs to.
        iteration:     Fully-built Iteration object (from orchestrator).
        image_base64:  Raw base64 string from gpt-image-1 (no data-URI prefix).
        username:      Display name used to locate the user's directory.
    """
    sf = _session_file(session_id, username)

    # Load existing history, append, save atomically
    existing = _load_session(sf)
    existing.append(iteration)
    _save_session(sf, existing)

    logger.debug(
        "Saved iteration %d for session %s / user %s  (total=%d)",
        iteration.iteration_number,
        session_id,
        _safe(username),
        len(existing),
    )

    # Persist the PNG image (if we have one)
    if image_base64:
        img_path = _image_file(session_id, iteration.iteration_number, username)
        try:
            _atomic_write_bytes(img_path, base64.b64decode(image_base64))
        except Exception as exc:
            logger.warning("Could not save image for %s/%d: %s", session_id, iteration.iteration_number, exc)


def get_image(session_id: str, iteration_number: int, username: str) -> str | None:
    """
    Retrieve the base64-encoded PNG for a specific iteration.
    Returns None if the file is not found.
    """
    img_path = _image_file(session_id, iteration_number, username)
    if not img_path.exists():
        return None
    try:
        return base64.b64encode(img_path.read_bytes()).decode("ascii")
    except Exception as exc:
        logger.warning("Could not read image %s: %s", img_path, exc)
        return None


def session_exists(session_id: str, username: str) -> bool:
    return _session_file(session_id, username).exists()


def get_all_sessions(username: str) -> dict[str, list["Iteration"]]:
    """
    Return all sessions for *username* as a dict mapping
    session_id → list[Iteration] (oldest iteration first).
    """
    user_dir = _user_dir(username)
    if not user_dir.exists():
        return {}

    result: dict[str, list["Iteration"]] = {}
    for json_file in sorted(user_dir.glob("*.json")):
        session_id = json_file.stem
        iterations = _load_session(json_file)
        if iterations:
            result[session_id] = iterations

    return result
