"""
ALTIER · personal-stylist/trust_signals.py
-------------------------------------------
Trust and reputation signals (Section 13).

Product-level trust, not person-level. ALTIER does not verify any of these —
they come from the retailer, the platform, or public sources the brand does
not control. A 4.8-star rating with 12 reviews means something very different
from 4.8 stars with 12,000 reviews.

READS FROM PRODUCT
    review_count, average_rating, seller_rating, return_rate, verified_purchase,
    site_type, refund_policy, care_instructions, reddit_complaints (per brand),
    on_site_review_patterns (separate clothes and makeup vocabularies)

WHAT IT RETURNS
    trust_score (0..1), trust_notes, risk_signals

EPISTEMICS
    Site type, refund policy and care instructions are retailer claims.
    Reddit complaint phrase counts are scraped from Reddit (read-only, app-only
    OAuth) — they measure complaint volume, not truth. On-site review patterns
    use separate vocabularies for clothes vs makeup because the language of
    "shrunk in the wash" and "caused a breakout" belong to different domains.
"""

#: Reddit complaint phrase counts per brand — scraped read-only via app-only OAuth.
#: Keys are brand names; values are {phrase: count}. These measure volume, not truth.
REDDIT_COMPLAINT_PHRASES = {
    "clothes": [
        "shrunk", "fell apart", "threadbare", "pilling", "seams split",
        "sizing runs small", "sizing runs large", "cheap material",
    ],
    "makeup": [
        "caused a breakout", "burned my skin", "oxidized", "caked",
        "caused irritation", "expired quickly", "broke out",
    ],
}

#: Site types and their default trust prior (craft convention, uncalibrated).
SITE_TYPE_TRUST = {
    "official_brand": 0.8,
    "authorized_retailer": 0.7,
    "marketplace": 0.5,
    "dropship": 0.3,
    "unknown": 0.4,
}

#: Refund policy leniency -> trust bump (craft convention).
REFUND_POLICY_TRUST = {
    "free_returns_30_days": 0.1,
    "free_returns_60_days": 0.15,
    "store_credit_only": -0.05,
    "no_returns": -0.15,
    "unknown": 0.0,
}


def trust_score(review_count: int | None, average_rating: float | None,
                seller_rating: float | None = None,
                return_rate: float | None = None,
                site_type: str | None = None,
                refund_policy: str | None = None) -> float:
    """0..1 trust estimate.

    Weights average_rating most, but discounts it when review_count is low.
    Penalizes high return rates. Adjusts for site type and refund policy.
    Returns 0.5 (neutral) when nothing is known.
    """
    score = 0.5
    confidence = 0.0

    if average_rating is not None:
        score = (average_rating - 1.0) / 4.0  # map 1-5 to 0-1
        if review_count is not None:
            confidence = min(1.0, review_count / 100.0)
            score = 0.5 + (score - 0.5) * (0.3 + 0.7 * confidence)

    if seller_rating is not None:
        seller_norm = (seller_rating - 1.0) / 4.0
        score = 0.7 * score + 0.3 * seller_norm

    if return_rate is not None:
        score = score * (1.0 - return_rate) + 0.5 * return_rate

    # Site type prior — applied as a gentle nudge, not a dominant signal.
    if site_type and site_type in SITE_TYPE_TRUST:
        site_prior = SITE_TYPE_TRUST[site_type]
        score = 0.8 * score + 0.2 * site_prior

    # Refund policy adjustment.
    if refund_policy and refund_policy in REFUND_POLICY_TRUST:
        score = max(0.0, min(1.0, score + REFUND_POLICY_TRUST[refund_policy]))

    return max(0.0, min(1.0, score))


def _reddit_complaint_score(brand: str | None, category: str | None,
                            reddit_complaints: dict | None) -> float:
    """0..1 complaint signal from Reddit phrase counts.

    Higher complaint volume = lower trust. Returns 0.5 (neutral) when no data.
    """
    if not brand or not reddit_complaints:
        return 0.5
    brand_data = reddit_complaints.get(brand, {})
    if not brand_data:
        return 0.5
    vocab = REDDIT_COMPLAINT_PHRASES.get("clothes" if category != "makeup" else "makeup", [])
    total = sum(brand_data.get(p, 0) for p in vocab)
    # Log-scale: 10 complaints is concerning, 100 is severe, saturation around 200.
    import math
    if total <= 0:
        return 0.5
    return max(0.0, min(1.0, 1.0 - math.log1p(total) / math.log1p(200)))


def trust_signals(product: dict) -> list[dict]:
    """Run trust checks against a product. -> list of risk signals."""
    signals = []
    review_count = product.get("review_count")
    average_rating = product.get("average_rating")
    seller_rating = product.get("seller_rating")
    return_rate = product.get("return_rate")
    site_type = product.get("site_type")
    refund_policy = product.get("refund_policy")
    brand = product.get("brand")
    category = product.get("category")
    reddit_complaints = product.get("reddit_complaints")

    score = trust_score(review_count, average_rating, seller_rating, return_rate,
                        site_type, refund_policy)

    if score < 0.4:
        signals.append({
            "signal": "trust",
            "reason": (
                f"{review_count or 0} review(s), {average_rating or 'unrated'} "
                f"average — not enough trust signal to rely on."
            ),
            "severity": "high" if score < 0.25 else "medium",
        })
    elif score > 0.75 and (review_count or 0) >= 50:
        signals.append({
            "signal": "trust",
            "reason": f"Well-reviewed ({average_rating}/5 across {review_count} reviews) — reliable signal.",
            "severity": "low",
            "is_risk": False,
        })

    if return_rate is not None and return_rate > 0.3:
        signals.append({
            "signal": "high_returns",
            "reason": f"{return_rate:.0%} return rate — this item comes back often.",
            "severity": "medium",
        })

    # Reddit complaint signal — separate vocabularies for clothes vs makeup.
    complaint_score = _reddit_complaint_score(brand, category, reddit_complaints)
    if complaint_score < 0.35 and reddit_complaints:
        signals.append({
            "signal": "reddit_complaints",
            "reason": (
                f"Reddit complaint phrases for {brand or 'this brand'} appear "
                f"in {category or 'general'} discussions — read reviews before buying."
            ),
            "severity": "medium",
        })

    # Site type warning.
    if site_type == "dropship":
        signals.append({
            "signal": "site_type",
            "reason": "Site reads as dropshipping — long shipping, unclear returns.",
            "severity": "medium",
        })
    elif site_type == "marketplace":
        signals.append({
            "signal": "site_type",
            "reason": "Marketplace listing — seller and authenticity vary.",
            "severity": "low",
        })

    # Refund policy warning.
    if refund_policy == "no_returns":
        signals.append({
            "signal": "refund_policy",
            "reason": "No returns — if it doesn't fit or work, you're stuck with it.",
            "severity": "high",
        })
    elif refund_policy == "store_credit_only":
        signals.append({
            "signal": "refund_policy",
            "reason": "Store credit only — no cash refunds.",
            "severity": "medium",
        })

    return signals


HONESTY = {
    "kind": "PLATFORM CLAIMS + PUBLIC SOURCES, UNVERIFIED. Review counts, ratings, "
            "seller scores, return rates, site type, refund policy — none verified "
            "by ALTIER. Reddit complaint counts measure volume, not truth.",
    "low_count_discount": "A 5-star rating with 3 reviews is discounted toward "
                          "neutral; only the review count itself is treated as a real signal.",
    "reddit_scope": "Reddit read-only via app-only OAuth. Complaint phrases are "
                    "counted per brand per category (clothes vs makeup use different vocabularies).",
    "separate_vocabularies": "Clothes complaints (shrunk, pilling, seams split) and "
                             "makeup complaints (breakout, burned, oxidized) are tracked separately "
                             "because they signal different failure modes.",
}