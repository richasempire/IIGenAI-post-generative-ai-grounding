"""
material_server.py — MCP server exposing ICE database + Material2050 API as tools.

Standalone usage (stdio transport, e.g. for Claude Desktop):
    cd backend/
    python mcp_server/material_server.py

Imported usage (grounder.py):
    from mcp_server.material_server import _lookup_ice, _call_material2050

The module-level functions (_lookup_ice, _search_ice, _call_material2050) are
pure Python — they can be imported freely by other pipeline modules without
starting the MCP server.  FastMCP merely wraps them as tool endpoints.
"""

import json
import logging
import sys
from pathlib import Path
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

# Ensure backend/ is on sys.path when run as a standalone script
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import settings  # noqa: E402

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Load ICE data at import time
# ---------------------------------------------------------------------------

_ICE_JSON = Path(__file__).resolve().parent.parent / "data" / "ice_materials.json"

try:
    with open(_ICE_JSON, encoding="utf-8") as _fh:
        _ICE_DATA: list[dict[str, Any]] = json.load(_fh)
    logger.info("ICE database loaded: %d materials", len(_ICE_DATA))
except FileNotFoundError:
    _ICE_DATA = []
    logger.warning(
        "ice_materials.json not found at %s — run data/convert_ice.py first.", _ICE_JSON
    )


# ---------------------------------------------------------------------------
# Synonym expansion
# Keys are single normalised words that may appear in a VLM material name.
# Values are additional ICE-friendly search terms to try alongside the original.
# ---------------------------------------------------------------------------

_SYNONYMS: dict[str, list[str]] = {
    # Masonry / brick
    "brick":      ["brick", "clay brick"],
    "exposed":    ["brick", "clay brick"],          # "exposed brick" → brick
    # Wood / timber
    "wood":       ["timber", "softwood", "hardwood"],
    "wooden":     ["timber", "softwood", "hardwood"],
    "timber":     ["timber", "softwood", "hardwood"],
    "oak":        ["hardwood", "oak", "timber"],
    "pine":       ["softwood", "pine", "timber"],
    "paneling":   ["timber", "wood panel", "softwood"],
    "panel":      ["timber", "panel", "board"],
    "frame":      ["timber frame", "timber", "steel frame"],
    # Concrete
    "concrete":   ["concrete"],
    "rammed":     ["rammed earth", "earth"],        # "rammed earth"
    "earth":      ["earth", "rammed earth", "adobe"],
    # Glass / glazing
    "glass":      ["glass", "glazing"],
    "glazing":    ["glass", "glazing"],
    "window":     ["glass", "glazing", "aluminium"],
    # Metals
    "steel":      ["steel", "stainless steel"],
    "stainless":  ["stainless steel", "steel"],
    "aluminium":  ["aluminium", "aluminum"],
    "aluminum":   ["aluminium", "aluminum"],
    "metal":      ["steel", "aluminium", "copper"],
    # Plaster / gypsum
    "plaster":    ["plaster", "gypsum"],
    "gypsum":     ["gypsum", "plaster"],
    "drywall":    ["plaster", "gypsum board"],
    "render":     ["plaster", "render"],
    # Stone / aggregates
    "stone":      ["stone", "limestone", "sandstone", "aggregate"],
    "marble":     ["marble", "stone", "limestone"],
    "granite":    ["granite", "stone"],
    "limestone":  ["limestone", "stone"],
    "sandstone":  ["sandstone", "stone"],
    # Ceramic / tile
    "tile":       ["ceramic", "tile", "terracotta"],
    "ceramic":    ["ceramic", "tile"],
    "terracotta": ["terracotta", "ceramic", "clay"],
    # Insulation
    "insulation": ["insulation", "mineral wool", "rockwool"],
    "wool":       ["mineral wool", "rockwool", "insulation"],
}


def _expand_query(query_norm: str) -> list[str]:
    """
    Return the original query plus synonym-expanded alternatives.

    "Exposed Brick"   → ["exposed brick", "brick", "clay brick"]
    "Wood Paneling"   → ["wood paneling", "timber", "softwood", "hardwood", "panel", "board"]
    "Wood Window Frame" → ["wood window frame", "timber", "softwood", "glass", "glazing"]
    """
    queries: list[str] = [query_norm]
    words = query_norm.split()

    for word in words:
        for term in _SYNONYMS.get(word, []):
            if term not in queries:
                queries.append(term)

    # Also try each significant individual word as a standalone fallback
    for word in words:
        if len(word) > 3 and word not in queries:
            queries.append(word)

    return queries


# ---------------------------------------------------------------------------
# Fuzzy match scoring
# ---------------------------------------------------------------------------

def _score(query_norm: str, name_norm: str) -> float:
    """
    Score a query against a material name.  Returns 0.0–1.0.

    Priority:
      1.0   exact match
      0.90  name starts-with query  (or vice versa)
      0.70  query is a substring of name  (or vice versa)
      0–0.5 word-overlap ratio
      0.0   no overlap
    """
    if not query_norm or not name_norm:
        return 0.0
    if query_norm == name_norm:
        return 1.0
    if name_norm.startswith(query_norm) or query_norm.startswith(name_norm):
        return 0.90
    if query_norm in name_norm or name_norm in query_norm:
        return 0.70

    q_words = set(query_norm.split())
    n_words = set(name_norm.split())
    overlap = len(q_words & n_words)
    if overlap:
        return round(0.5 * overlap / max(len(q_words), len(n_words)), 3)

    return 0.0


# ---------------------------------------------------------------------------
# Core lookup functions — importable by grounder.py
# ---------------------------------------------------------------------------

def _lookup_ice(query: str) -> dict[str, Any]:
    """
    Return the single best ICE match for *query*.

    Runs the fuzzy scorer against every synonym-expanded form of the query
    and returns the highest-scoring match across all expansions.
    Always returns a dict; check the 'found' key for success.
    """
    if not _ICE_DATA:
        return {"found": False, "query": query, "reason": "database_not_loaded"}

    queries = _expand_query(query.lower().strip())
    best_score = 0.0
    best_item: dict[str, Any] | None = None
    best_via:  str = query

    for q in queries:
        for item in _ICE_DATA:
            s = _score(q, item["material"].lower())
            if s > best_score:
                best_score = s
                best_item  = item
                best_via   = q

    if best_item is None or best_score == 0.0:
        return {"found": False, "query": query}

    result = {
        "found":            True,
        "query":            query,
        "material":         best_item["material"],
        "category":         best_item["category"],
        "co2e_per_kg":      best_item["co2e_per_kg"],
        "unit":             best_item["unit"],
        "comment":          best_item["comment"],
        "source":           best_item["source"],
        "match_confidence": round(best_score, 3),
    }
    # Include the expansion term only when it differs from the original query
    if best_via != query.lower().strip():
        result["matched_via"] = best_via
    return result


def _search_ice(query: str, limit: int = 5) -> list[dict[str, Any]]:
    """
    Return the top *limit* ICE matches for *query*, sorted by relevance.
    Uses synonym expansion so "wood" surfaces timber entries, etc.
    """
    if not _ICE_DATA:
        return []

    queries = _expand_query(query.lower().strip())

    # Score each ICE item against all expanded queries, keep best score per item
    best_per_item: dict[int, tuple[float, dict]] = {}
    for q in queries:
        for idx, item in enumerate(_ICE_DATA):
            s = _score(q, item["material"].lower())
            if s > best_per_item.get(idx, (0.0, item))[0]:
                best_per_item[idx] = (s, item)

    scored = [(s, item) for s, item in best_per_item.values() if s > 0.0]
    scored.sort(key=lambda x: x[0], reverse=True)

    return [
        {
            "material":         item["material"],
            "category":         item["category"],
            "co2e_per_kg":      item["co2e_per_kg"],
            "unit":             item["unit"],
            "comment":          item["comment"],
            "source":           item["source"],
            "match_confidence": round(score, 3),
        }
        for score, item in scored[:limit]
    ]


async def _call_material2050(query: str) -> dict[str, Any]:
    """
    Query the Material2050 Open API and return the first matching product.
    Always returns a dict; check the 'found' key.
    """
    if not settings.material2050_api_key:
        return {"found": False, "query": query, "reason": "no_api_key"}

    url = "https://app.2050-materials.com/developer/api/get_products_open_api"
    headers = {"Authorization": f"Bearer {settings.material2050_api_key}"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params={"name": query}, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        # Normalise: API may return a bare list or a wrapper dict
        products: list[dict] = []
        if isinstance(data, list):
            products = data
        elif isinstance(data, dict):
            products = (
                data.get("results")
                or data.get("products")
                or data.get("data")
                or []
            )

        if not products:
            return {"found": False, "query": query, "reason": "no_results"}

        product = products[0]

        # Normalise CO₂e field — Material2050 field names may vary
        co2e = (
            product.get("co2e")
            or product.get("gwp")
            or product.get("carbon_footprint")
            or product.get("co2e_per_kg")
        )

        return {
            "found":      True,
            "query":      query,
            "name":       product.get("name") or product.get("product_name") or query,
            "category":   product.get("category") or product.get("material_type") or "",
            "co2e_value": float(co2e) if co2e is not None else None,
            "unit":       product.get("unit") or product.get("declared_unit") or "kgCO2e/kg",
            "source":     "Material2050 Open API",
            "raw":        product,
        }

    except httpx.HTTPStatusError as exc:
        logger.warning(
            "Material2050 HTTP %s for query '%s'", exc.response.status_code, query
        )
        return {"found": False, "query": query, "error": f"HTTP {exc.response.status_code}"}
    except Exception as exc:
        logger.warning("Material2050 error for query '%s': %s", query, exc)
        return {"found": False, "query": query, "error": str(exc)}


# ---------------------------------------------------------------------------
# MCP server — wraps the pure functions above as protocol tools
# ---------------------------------------------------------------------------

mcp = FastMCP(
    "IIGenAI Materials",
    instructions=(
        "Tools for looking up embodied carbon (CO₂e) data for building materials. "
        "Use lookup_material for a single best match, search_materials for multiple "
        "candidates, list_categories to browse available material types, and "
        "search_material_2050 for live data from the Material2050 database."
    ),
)


@mcp.tool()
def lookup_material(query: str) -> dict:
    """
    Find the single best matching material in the local ICE database.

    Args:
        query: Material name to search for (e.g. "Rammed Earth", "Concrete").

    Returns:
        Dict with material name, category, co2e_per_kg, unit, comment, source,
        and match_confidence (0–1).  If no match found, returns {"found": false}.
    """
    return _lookup_ice(query)


@mcp.tool()
def search_materials(query: str, limit: int = 5) -> list[dict]:
    """
    Return the top N matches from the ICE database, sorted by relevance.

    Relevance order: exact match > starts-with > substring > word overlap.

    Args:
        query: Material name or keyword.
        limit: Maximum number of results to return (default 5).
    """
    return _search_ice(query, limit=limit)


@mcp.tool()
def list_categories() -> list[str]:
    """
    Return all unique material categories in the ICE database, sorted alphabetically.
    """
    seen: set[str] = set()
    result: list[str] = []
    for item in _ICE_DATA:
        cat = item.get("category", "")
        if cat and cat not in seen:
            seen.add(cat)
            result.append(cat)
    return sorted(result)


@mcp.tool()
async def search_material_2050(query: str) -> dict:
    """
    Search the Material2050 Open API for live embodied carbon data.

    Falls back gracefully if the API key is missing or the service is unreachable.

    Args:
        query: Material name to search for.

    Returns:
        Dict with name, category, co2e_value, unit, source, or {"found": false}.
    """
    return await _call_material2050(query)


# ---------------------------------------------------------------------------
# Entrypoint — standalone stdio process
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    mcp.run(transport="stdio")
