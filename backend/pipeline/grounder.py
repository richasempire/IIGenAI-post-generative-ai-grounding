"""
grounder.py — Material grounding pipeline step.

Takes the raw identified-material dicts from identifier.py and enriches each
one with real-world CO₂e data, producing GroundedMaterial objects ready for
the API response.

Lookup strategy (per material):
  1. ICE local database  (fast, offline, always tried first)
  2. Material2050 API    (live, only if ICE confidence < threshold AND key set)
"""

import logging
from typing import Any

from api.schemas import GroundedMaterial
from config import settings
from mcp_server.material_server import _call_material2050, _lookup_ice

logger = logging.getLogger(__name__)

# If the ICE fuzzy-match score is below this threshold we consider it
# unreliable and attempt the live Material2050 API as a fallback.
ICE_CONFIDENCE_THRESHOLD = 0.50


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

async def ground_materials(
    identified_materials: list[dict[str, Any]],
    use_material2050_fallback: bool = True,
) -> list[GroundedMaterial]:
    """
    Enrich a list of identified materials with CO₂e data.

    Args:
        identified_materials:
            Output from identifier.identify_materials_with_consistency().
            Each dict has keys: "name", "description", "confidence".
        use_material2050_fallback:
            When True and MATERIAL2050_API_KEY is set, query the live API
            for materials whose ICE match confidence is below the threshold.

    Returns:
        List of GroundedMaterial objects, one per input material, in the
        same order.  Materials with no CO₂e match still appear in the list
        with co2e_value=None and requires_human_review=True.
    """
    results: list[GroundedMaterial] = []

    for item in identified_materials:
        name: str        = item.get("name", "")
        description: str = item.get("description", "")
        confidence: float = float(item.get("confidence", 0.0))

        co2e_value:    float | None = None
        co2e_unit:     str | None   = None
        database_match: str | None  = None

        # ── Step 1: ICE local lookup ──────────────────────────────────────
        ice = _lookup_ice(name)
        ice_conf = ice.get("match_confidence", 0.0)
        ice_found = ice.get("found", False)

        logger.info(
            "ICE lookup '%s' → found=%s  match='%s'  conf=%.2f",
            name,
            ice_found,
            ice.get("material", "—") if ice_found else "—",
            ice_conf,
        )

        if ice_found and ice_conf >= ICE_CONFIDENCE_THRESHOLD:
            co2e_value     = ice["co2e_per_kg"]
            co2e_unit      = ice["unit"]          # "kgCO2e/kg"
            database_match = ice["material"]
            logger.info(
                "  ✓ ICE accepted  '%s' → '%s'  co2e=%.4f %s",
                name, database_match, co2e_value, co2e_unit,
            )

        # ── Step 2: Material2050 fallback ─────────────────────────────────
        elif use_material2050_fallback:
            if not settings.material2050_api_key:
                logger.info(
                    "  ⚠ ICE conf %.2f < %.2f for '%s' — M2050 skipped (no API key in .env)",
                    ice_conf, ICE_CONFIDENCE_THRESHOLD, name,
                )
            else:
                logger.info(
                    "  → ICE conf %.2f < %.2f for '%s' — trying Material2050 API …",
                    ice_conf, ICE_CONFIDENCE_THRESHOLD, name,
                )
                m2050 = await _call_material2050(name)

                if m2050.get("found"):
                    co2e_value     = m2050.get("co2e_value")
                    co2e_unit      = m2050.get("unit")
                    database_match = m2050.get("name")
                    logger.info(
                        "  ✓ M2050 match  '%s' → '%s'  co2e=%s %s",
                        name, database_match, co2e_value, co2e_unit,
                    )
                else:
                    logger.info(
                        "  ✗ M2050 no match for '%s' (reason: %s)",
                        name, m2050.get("reason") or m2050.get("error") or "unknown",
                    )
        else:
            logger.info(
                "  ⚠ M2050 fallback disabled for '%s'", name
            )

        # ── Build GroundedMaterial ────────────────────────────────────────
        grounded = GroundedMaterial(
            name=name,
            description=description,
            confidence=confidence,
            co2e_value=co2e_value,
            co2e_unit=co2e_unit,
            database_match=database_match,
        )
        results.append(grounded)

    logger.info(
        "Grounding complete: %d materials, %d with CO₂e data, %d needing review",
        len(results),
        sum(1 for m in results if m.co2e_value is not None),
        sum(1 for m in results if m.requires_human_review),
    )

    return results
