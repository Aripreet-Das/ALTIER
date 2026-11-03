"""
ALTIER · personal-stylist/shades.py
------------------------------------
Shade matching endpoints — /shades and /shades/match (Section 15).

READS
    brand swatch hexes (her measured reads per brand)
    product shade hexes

WHAT IT RETURNS
    nearest shade match by ΔE, with match quality interpretation

EPISTEMICS
    Brand swatch hexes come from her own color_engine reads (CIELAB hue angle,
    white-balanced from sclera). ΔE matching is CIE76 — good enough for shade
    comparison, not a replacement for Sephora Color IQ or Pantone.
"""

from .sizing_memory import nearest_shade, delta_e_cie76, HONESTY as MEMORY_HONESTY


def match_shade(brand: str, product_shade_hex: str,
                brand_swatch_hexes: dict[str, list[str]]) -> dict:
    """Match a product shade to her nearest measured swatch for that brand.

    -> {nearest_swatch_hex, delta_e, match_quality, recommendation}
    """
    result = nearest_shade(brand, product_shade_hex, brand_swatch_hexes)
    if not result:
        return {
            "brand": brand,
            "product_shade_hex": product_shade_hex,
            "match": None,
            "recommendation": "No measured swatches for this brand — swatch first.",
            "honesty": MEMORY_HONESTY,
        }

    de = result["delta_e"]
    if de < 1.0:
        recommendation = "Near-identical to your measured swatch — safe match."
    elif de < 2.0:
        recommendation = "Very close — likely a good match."
    elif de < 10.0:
        recommendation = "Noticeable difference — swatch before buying."
    else:
        recommendation = "Different shade — unlikely to match your measured swatch."

    return {
        **result,
        "product_shade_hex": product_shade_hex,
        "recommendation": recommendation,
        "honesty": MEMORY_HONESTY,
    }


def shade_distance(hex1: str, hex2: str) -> dict:
    """Raw ΔE between two hex colours."""
    de = delta_e_cie76(hex1, hex2)
    if de is None:
        return {"error": "invalid hex colour(s)"}
    return {
        "hex1": hex1, "hex2": hex2,
        "delta_e": round(de, 2),
        "interpretation": (
            "near_identical" if de < 1.0 else
            "very_close" if de < 2.0 else
            "noticeable" if de < 10.0 else
            "different"
        ),
    }


HONESTY = {
    "kind": "HER MEASURED SWATCHES ONLY. Brand swatch hexes come from her own "
            "color_engine reads — not inferred, not looked up. ΔE (CIE76) is a "
            "colour-distance formula, not a shade-finding tool like Sephora Color IQ.",
    "not_a_shade_finder": "This does not generate a foundation match. It compares "
                          "a product shade to her own measured swatches.",
}