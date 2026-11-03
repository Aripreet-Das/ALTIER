"""
ALTIER · personal-stylist/longevity.py
---------------------------------------
Longevity: how long is this product likely to last, based on trust signals?

READS FROM PRODUCT (not profile — longevity is about the item, not the person)
    material (fabric composition)
    construction (seams, lining, reinforcement)
    brand_tier (seed / known / unknown)
    care_instructions

WHAT IT RETURNS
    longevity_score (0..1), longevity_notes, risk_signals

EPISTEMICS
    All longevity signals are craft convention or manufacturer claims — none
    are tested by ALTIER. "100% cotton" is a material claim, not a durability
    promise. Treat every signal as directional.
"""

#: Material -> durability prior (craft convention, uncalibrated).
MATERIAL_DURABILITY = {
    "wool": 0.8, "denim": 0.8, "leather": 0.8,
    "canvas": 0.7, "twill": 0.7,
    "cotton": 0.6, "linen": 0.5,
    "polyester": 0.5, "rayon": 0.4, "viscose": 0.4,
    "acrylic": 0.3, "spandex": 0.3, "elastane": 0.3,
}

#: Construction feature -> durability bump (craft convention).
CONSTRUCTION_BUMPS = {
    "lined": 0.1, "french_seams": 0.1, "reinforced_hem": 0.1,
    "double_stitched": 0.1, "fully_fashioned": 0.1,
}


def longevity_score(material: str | None, construction: list[str] | None,
                    brand_tier: str | None = None) -> float:
    """0..1 durability estimate.

    Starts from material prior, adds construction bumps, caps at 1.0.
    Returns 0.5 (neutral) when nothing is known.
    """
    score = 0.5
    if material:
        score = MATERIAL_DURABILITY.get(material.lower(), 0.5)
    if construction:
        bumps = sum(CONSTRUCTION_BUMPS.get(c, 0.0) for c in construction)
        score = min(1.0, score + bumps)
    if brand_tier == "known":
        score = min(1.0, score + 0.1)
    elif brand_tier == "unknown":
        score = max(0.0, score - 0.1)
    return score


def longevity_signals(product: dict) -> list[dict]:
    """Run longevity checks against a product. -> list of risk signals."""
    signals = []
    material = product.get("material")
    construction = product.get("construction") or []
    brand_tier = product.get("brand_tier")

    score = longevity_score(material, construction, brand_tier)

    if score < 0.4:
        signals.append({
            "signal": "longevity",
            "reason": (
                f"{material or 'Unlisted material'} with {len(construction)} "
                f"construction reinforcement(s) — this reads as a short-life item."
            ),
            "severity": "medium",
        })
    elif score > 0.75 and material:
        signals.append({
            "signal": "longevity",
            "reason": f"{material.title()} reads as a durable material — likely to wear well.",
            "severity": "low",
            "is_risk": False,
        })

    return signals


HONESTY = {
    "kind": "CRAFT CONVENTION + MANUFACTURER CLAIMS. Material durability priors "
            "are editorial — 100% cotton is not a durability promise. None of "
            "this is tested by ALTIER.",
    "no_testing": "ALTIER does not wash-test, wear-test, or stress-test anything. "
                  "Longevity is directional only.",
}