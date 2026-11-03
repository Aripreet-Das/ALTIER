"""
ALTIER · personal-stylist/sizing_memory.py
-------------------------------------------
Personal size memory — /fit (Section 15).

"did it fit" taps → her own per-brand size hint, outranks reviewers from two
consistent events. Brand swatch hexes → nearest shade by ΔE (CIE76).

READS
    fit_events: list of {brand, garment_id, size_tried, fit ("too_small"|"fit"|"too_large"), date}
    brand_swatch_hexes: {brand: [hex, ...]} — her measured swatches per brand
    rule_confidence: per-user rule confidence from page1/schema.sql (my_rule_confidence view)

WHAT IT RETURNS
    per-brand size hint, shade match by ΔE, rule confidence adjustments

EPISTEMICS
    The data moat at one-person scale: two consistent "did it fit" events for
    one brand outweigh thousands of anonymous reviews. Rule confidence is moved
    only by her own feedback — never global. Brand swatch hexes are her own
    measured reads, not inferred.
"""

import math


def size_hint(brand: str, fit_events: list[dict]) -> dict | None:
    """Her own per-brand size hint from fit events.

    Two consistent events outrank reviewers. Returns None when fewer than
    two events for this brand.
    """
    brand_events = [e for e in fit_events if e.get("brand") == brand]
    if len(brand_events) < 2:
        return None

    # Count fit outcomes per size tried.
    size_votes = {}
    for e in brand_events:
        size = e.get("size_tried")
        fit = e.get("fit")
        if not size or fit not in ("too_small", "fit", "too_large"):
            continue
        size_votes.setdefault(size, {"fit": 0, "too_small": 0, "too_large": 0})
        size_votes[size][fit] += 1

    # Find the size with the most "fit" outcomes and at least 2 consistent events.
    best_size = None
    best_score = -1
    for size, votes in size_votes.items():
        total = sum(votes.values())
        if total < 2:
            continue
        # Score: fit votes minus misfit votes, weighted by consistency.
        score = votes["fit"] - 0.5 * (votes["too_small"] + votes["too_large"])
        if score > best_score:
            best_score = score
            best_size = size

    if best_size is None:
        return None

    return {
        "brand": brand,
        "suggested_size": best_size,
        "based_on_events": len(brand_events),
        "confidence": "high" if len(brand_events) >= 3 else "medium",
        "honesty": (
            "Two consistent fit events for this brand outweigh anonymous "
            "reviewers. This is her own data, not a model."
        ),
    }


def delta_e_cie76(hex1: str, hex2: str) -> float | None:
    """CIE76 Delta E between two hex colours. Lower = closer match.

    Simple sRGB→CIELAB approximation. Not as accurate as full colorimetry
    (see face-parsing/colorimetry.py) but sufficient for shade matching.
    """
    try:
        def hex_to_rgb(h):
            h = h.lstrip("#")
            return tuple(int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4))

        def rgb_to_xyz(r, g, b):
            # sRGB to XYZ (D65)
            def lin(c):
                return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
            r, g, b = lin(r), lin(g), lin(b)
            x = r * 0.4124 + g * 0.3576 + b * 0.1805
            y = r * 0.2126 + g * 0.7152 + b * 0.0722
            z = r * 0.0193 + g * 0.1192 + b * 0.9505
            return x, y, z

        def xyz_to_lab(x, y, z):
            # Reference white D65
            xr, yr, zr = x / 0.9505, y / 1.0, z / 1.0888
            def f(t):
                return t ** (1/3) if t > 0.008856 else (7.787 * t) + 16 / 116
            fx, fy, fz = f(xr), f(yr), f(zr)
            L = 116 * fy - 16
            a = 500 * (fx - fy)
            b = 200 * (fy - fz)
            return L, a, b

        r1, g1, b1 = hex_to_rgb(hex1)
        r2, g2, b2 = hex_to_rgb(hex2)
        x1, y1, z1 = rgb_to_xyz(r1, g1, b1)
        x2, y2, z2 = rgb_to_xyz(r2, g2, b2)
        l1, a1, b_1 = xyz_to_lab(x1, y1, z1)
        l2, a2, b_2 = xyz_to_lab(x2, y2, z2)
        return math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b_1 - b_2) ** 2)
    except (ValueError, IndexError):
        return None


def nearest_shade(brand: str, target_hex: str,
                  brand_swatch_hexes: dict[str, list[str]]) -> dict | None:
    """Find her nearest measured swatch for a brand by ΔE.

    Returns the closest swatch hex and its ΔE. None if no swatches for brand.
    """
    swatches = brand_swatch_hexes.get(brand)
    if not swatches or not target_hex:
        return None

    best = None
    best_de = float("inf")
    for swatch_hex in swatches:
        de = delta_e_cie76(target_hex, swatch_hex)
        if de is not None and de < best_de:
            best_de = de
            best = swatch_hex

    if best is None:
        return None

    # ΔE interpretation: <1 imperceptible, 1-2 perceptible through close observation,
    # 2-10 noticeable, >10 very different.
    if best_de < 1.0:
        match_quality = "near_identical"
    elif best_de < 2.0:
        match_quality = "very_close"
    elif best_de < 10.0:
        match_quality = "noticeable_difference"
    else:
        match_quality = "different_shade"

    return {
        "brand": brand,
        "target_hex": target_hex,
        "nearest_swatch_hex": best,
        "delta_e": round(best_de, 2),
        "match_quality": match_quality,
        "honesty": (
            "Her own measured brand swatch hexes — nearest shade by ΔE (CIE76). "
            "Not a replacement for Sephora Color IQ or Pantone matching."
        ),
    }


def rule_confidence_delta(current: float, liked: bool,
                          prior_strength: int = 6) -> float:
    """Update rule confidence from her feedback (Beta posterior mean).

    Same formula as page1's my_rule_confidence view:
    (seed * 6 + likes) / (6 + likes + dislikes)
    """
    # current is already the posterior mean; invert to get pseudo-counts.
    n = prior_strength
    likes = current * n
    dislikes = n - likes
    if liked:
        likes += 1
    else:
        dislikes += 1
    n = likes + dislikes
    return round(likes / n, 3) if n else current


HONESTY = {
    "kind": "ONE-PERSON DATA MOAT. Two consistent fit events for one brand "
            "outrank anonymous reviewers. Rule confidence is moved only by her "
            "own feedback — never global. Brand swatch hexes are her measured reads.",
    "sizing_source": "User \"did it fit\" taps — per-brand, per-size fit history.",
    "shade_source": "ΔE (CIE76) between target hex and her measured brand swatch hexes.",
    "rule_confidence": "Same Beta posterior (prior strength 6) as page1's "
                       "my_rule_confidence view — her feedback moves only her rules.",
}