"""
ALTIER · personal-stylist/reputation.py
----------------------------------------
Brand reputation signals (Section 13) — includes sustainability ratings
(Good On You model) alongside trust signals.

READS FROM PRODUCT
    brand (name), brand_tier (seed / known / unknown), brand_country,
    years_in_business, sustainability_claims, ethics_claims,
    sustainability_rating (0..5, Good On You style), ethics_rating (0..5),
    reddit_complaints (per brand, read-only via app-only OAuth)

WHAT IT RETURNS
    reputation_score (0..1), reputation_notes, risk_signals

EPISTEMICS
    Brand reputation is seeded convention — "known brand" is not the same as
    "good brand". ALTIER makes no correctness claim about any brand's ethics,
    sustainability, or quality. Sustainability and ethics ratings are either
    user-provided or third-party claims (e.g. Good On You) — unverified by ALTIER.
"""

#: Brand tier -> reputation prior (craft convention, uncalibrated).
BRAND_TIER_SCORE = {
    "known": 0.7,
    "seed": 0.5,
    "unknown": 0.4,
}

#: Sustainability rating -> reputation adjustment (Good On You style, 0..5).
#: 5 = leader, 4 = good, 3 = average, 2 = not good enough, 1 = avoid.
SUSTAINABILITY_ADJUSTMENT = {
    5: 0.15, 4: 0.10, 3: 0.0, 2: -0.10, 1: -0.20,
}

#: Ethics rating -> reputation adjustment (0..5).
ETHICS_ADJUSTMENT = {
    5: 0.10, 4: 0.07, 3: 0.0, 2: -0.08, 1: -0.15,
}


def reputation_score(brand_tier: str | None,
                     years_in_business: int | None = None,
                     sustainability_claims: bool = False,
                     ethics_claims: bool = False,
                     sustainability_rating: int | None = None,
                     ethics_rating: int | None = None) -> float:
    """0..1 brand reputation estimate.

    Starts from brand tier, adds small bumps for longevity and claims,
    and larger adjustments for sustainability/ethics ratings (0..5 scale).
    Returns 0.5 (neutral) when brand_tier is unknown/missing.
    """
    score = BRAND_TIER_SCORE.get(brand_tier or "unknown", 0.5)
    if years_in_business is not None and years_in_business >= 10:
        score = min(1.0, score + 0.1)
    if sustainability_claims:
        score = min(1.0, score + 0.05)
    if ethics_claims:
        score = min(1.0, score + 0.05)
    if sustainability_rating is not None:
        score = min(1.0, max(0.0, score + SUSTAINABILITY_ADJUSTMENT.get(sustainability_rating, 0.0)))
    if ethics_rating is not None:
        score = min(1.0, max(0.0, score + ETHICS_ADJUSTMENT.get(ethics_rating, 0.0)))
    return max(0.0, min(1.0, score))


def reputation_signals(product: dict) -> list[dict]:
    """Run reputation checks against a product. -> list of risk signals."""
    signals = []
    brand = product.get("brand")
    brand_tier = product.get("brand_tier")
    years = product.get("years_in_business")
    sust_rating = product.get("sustainability_rating")
    ethics_rating = product.get("ethics_rating")

    score = reputation_score(brand_tier, years,
                             product.get("sustainability_claims", False),
                             product.get("ethics_claims", False),
                             sust_rating, ethics_rating)

    if brand_tier == "unknown":
        signals.append({
            "signal": "brand_unknown",
            "reason": (
                f"{brand or 'This brand'} has no established reputation in "
                f"ALTIER's data — treat all claims as unverified."
            ),
            "severity": "low",
        })
    elif brand_tier == "known" and score >= 0.7:
        signals.append({
            "signal": "brand_known",
            "reason": f"{brand or 'This brand'} is an established name — track record exists.",
            "severity": "low",
            "is_risk": False,
        })

    # Sustainability rating signal (Good On You style)
    if sust_rating is not None:
        if sust_rating <= 2:
            signals.append({
                "signal": "sustainability_low",
                "reason": (
                    f"Sustainability rating {sust_rating}/5 — below average. "
                    f"Consider alternatives with better environmental scores."
                ),
                "severity": "medium" if sust_rating == 1 else "low",
            })
        elif sust_rating >= 4:
            signals.append({
                "signal": "sustainability_high",
                "reason": f"Sustainability rating {sust_rating}/5 — strong environmental track record.",
                "severity": "low",
                "is_risk": False,
            })

    # Ethics rating signal
    if ethics_rating is not None:
        if ethics_rating <= 2:
            signals.append({
                "signal": "ethics_low",
                "reason": (
                    f"Ethics rating {ethics_rating}/5 — below average. "
                    f"Labour and supply-chain practices may be a concern."
                ),
                "severity": "medium" if ethics_rating == 1 else "low",
            })
        elif ethics_rating >= 4:
            signals.append({
                "signal": "ethics_high",
                "reason": f"Ethics rating {ethics_rating}/5 — strong labour and supply-chain record.",
                "severity": "low",
                "is_risk": False,
            })

    return signals


HONESTY = {
    "kind": "SEDED CONVENTION, UNVERIFIED. Brand tier is assigned by the platform "
            "or seed data — ALTIER does not investigate brands. Sustainability and "
            "ethics ratings (0..5, Good On You style) are third-party or user-provided "
            "claims — unverified by ALTIER.",
    "no_brand_judgment": "A low reputation score is not a judgment that a brand "
                         "is bad — only that ALTIER has no verified data about it.",
    "sustainability_source": "Good On You style brand sustainability ratings "
                             "(0..5 scale). Not tested or verified by ALTIER.",
    "ethics_source": "Brand ethics/labour ratings (0..5 scale). "
                     "Self-reported or third-party — unverified by ALTIER.",
}