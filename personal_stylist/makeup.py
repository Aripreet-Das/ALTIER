"""
ALTIER · personal-stylist/makeup.py
------------------------------------
Makeup routing: shade and undertone fit against her measured colour read.

READS FROM PROFILE
    undertone (warm / cool / neutral — MEASURED from CIELAB hue angle)
    depth (fair / medium / deep — MEASURED from ITA degrees)
    skin_hex (white-balanced from sclera — MEASURED)
    hair_hex, eye_hex (MEASURED)

WHAT IT RETURNS
    shade_score (0..1), shade_notes, risk_signals, route ("makeup" | "clothes" | None)

EPISTEMICS
    Undertone and depth are MEASURED and standards-based (CIE 1976 D65 hue angle,
    ITA degrees per Chardon et al. 1991). But the WARM/COOL and FAIR/MEDIUM/DEEP
    cut points are craft convention. A foundation match at 54.9° vs 55.1° hue is
    the same face getting a different word — the shade score is directional.

    This routes TO makeup (not within it): it says "this product category is
    makeup, check shade against your undertone+depth". It does not replace a
    shade-finder tool like Perfect Corp or ModiFace.
"""

#: Undertone -> flattering metal temperature (the one accessory claim keyed on
#: measured colouring rather than vibe). Colour-analysis practice, not evidence.
UNDERTONE_METALS = {
    "warm": "gold",
    "cool": "silver",
    "neutral": "either",
}

#: Depth -> preferred pigment intensity (craft convention, uncalibrated).
DEPTH_INTENSITY = {
    "fair": "sheer-to-medium",
    "medium": "medium",
    "deep": "saturated",
}


def shade_score(undertone: str | None, depth: str | None,
                product_undertone: str | None, product_depth: str | None) -> float:
    """0..1 shade compatibility between her measured read and a makeup product.

    Returns 0.5 (neutral) when either side is missing — absence of data is not
    a negative signal.
    """
    if not undertone or not product_undertone:
        return 0.5

    score = 0.5
    if undertone == product_undertone:
        score += 0.3
    elif undertone == "neutral" or product_undertone == "neutral":
        score += 0.15

    if depth and product_depth and depth == product_depth:
        score += 0.2

    return max(0.0, min(1.0, score))


def makeup_signals(profile: dict, product: dict) -> list[dict]:
    """Run makeup shade checks against a product. -> list of risk signals."""
    signals = []
    undertone = profile.get("undertone")
    depth = profile.get("depth")
    skin_hex = profile.get("skin_hex")

    product_undertone = product.get("undertone")
    product_depth = product.get("depth")
    product_shade_hex = product.get("shade_hex")

    score = shade_score(undertone, depth, product_undertone, product_depth)

    if score < 0.4:
        signals.append({
            "signal": "shade_fit",
            "reason": (
                f"Your undertone reads {undertone or 'unmeasured'} and this is "
                f"tagged {product_undertone or 'unrated'} — the shade may read "
                f"off against your skin."
            ),
            "severity": "high" if score < 0.3 else "medium",
        })

    # Hex proximity — soft directional check only
    if skin_hex and product_shade_hex:
        try:
            s_r, s_g, s_b = int(skin_hex[1:3], 16), int(skin_hex[3:5], 16), int(skin_hex[5:7], 16)
            p_r, p_g, p_b = int(product_shade_hex[1:3], 16), int(product_shade_hex[3:5], 16), int(product_shade_hex[5:7], 16)
            dist = ((s_r - p_r) ** 2 + (s_g - p_g) ** 2 + (s_b - p_b) ** 2) ** 0.5
            if dist > 120:
                signals.append({
                    "signal": "shade_hex_distance",
                    "reason": (
                        f"The shade hex ({product_shade_hex}) is far from your "
                        f"measured skin hex ({skin_hex}) in RGB space — treat as "
                        f"directional only, swatch before buying."
                    ),
                    "severity": "low",
                })
        except (ValueError, IndexError):
            pass  # malformed hex — ignore rather than inventing a risk

    return signals


HONESTY = {
    "kind": "MEASURED colour read (undertone from CIELAB hue angle, depth from ITA "
            "degrees) + CONVENTION shade cuts. The axes are standards-based; where "
            "to cut between warm/cool and fair/medium/deep is craft convention.",
    "undertone_source": "page1/engines/color_engine.py — CIELAB hue angle, "
                        "lightness-independent.",
    "depth_source": "page1/engines/color_engine.py — ITA degrees (Chardon et al. "
                    "1991), the dermatological standard.",
    "not_a_shade_finder": "This is not a replacement for Perfect Corp or ModiFace. "
                          "It routes makeup and flags shade risk — it does not "
                          "generate a foundation match.",
}