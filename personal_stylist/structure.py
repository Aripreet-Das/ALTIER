"""
ALTIER · personal-stylist/structure.py
---------------------------------------
Body fit: does this product's shape work with her measured body shape and ratios?

READS FROM PROFILE
    body_shape (pear / apple / hourglass / rectangle / inverted-triangle)
    ratios (shoulder_to_hip, waist_to_hip, shoulder_to_waist — from body_engine)
    size_estimate (bust, upper_waist, lower_waist, hip — noisy estimate, flagged)

WHAT IT RETURNS
    fit_score (0..1), fit_notes, risk_signals (list of {signal, reason, severity})

EPISTEMICS
    The ratios are MEASURED (scale-free silhouette widths at MediaPipe landmark
    heights). The shape WORD is convention (uncalibrated thresholds). The size
    estimate is a NOISY ESTIMATE (never a bare cm). Everything below inherits
    those honesty boundaries — structure can say "this silhouette reads wide on
    your hip line" but cannot say "this will be a size 10".
"""

#: Garment silhouettes the recommender can tag a product with. Mirrors the
#: body shape vocabulary so structure can compare them directly.
SILHOUETTES = ("fitted", "straight", "a-line", "oversized", "peplum", "wrap")

#: Which body shapes each silhouette tends to balance. Convention, not evidence.
#: Each entry: {silhouette: {body_shape: compatibility (0..1)}}
SILHOUETTE_BODY_FIT = {
    "fitted": {
        "hourglass": 0.9, "rectangle": 0.7, "pear": 0.4,
        "apple": 0.3, "inverted-triangle": 0.6,
    },
    "straight": {
        "rectangle": 0.9, "inverted-triangle": 0.7, "apple": 0.6,
        "pear": 0.5, "hourglass": 0.4,
    },
    "a-line": {
        "pear": 0.9, "apple": 0.7, "hourglass": 0.6,
        "rectangle": 0.5, "inverted-triangle": 0.4,
    },
    "oversized": {
        "apple": 0.8, "rectangle": 0.8, "pear": 0.7,
        "inverted-triangle": 0.6, "hourglass": 0.5,
    },
    "peplum": {
        "rectangle": 0.9, "apple": 0.8, "hourglass": 0.7,
        "pear": 0.6, "inverted-triangle": 0.5,
    },
    "wrap": {
        "hourglass": 0.9, "pear": 0.8, "apple": 0.7,
        "rectangle": 0.6, "inverted-triangle": 0.5,
    },
}


def body_fit_score(body_shape: str | None, silhouette: str | None) -> float:
    """0..1 compatibility between her body shape and a garment silhouette.

    Returns 0.5 (neutral) when either is missing — absence of data is not a
    signal either way, and must not be punished as a risk.
    """
    if not body_shape or not silhouette:
        return 0.5
    return SILHOUETTE_BODY_FIT.get(silhouette, {}).get(body_shape, 0.5)


def structure_signals(profile: dict, garment: dict) -> list[dict]:
    """Run body-fit checks against a garment. -> list of risk signals.

    Each signal: {signal, reason, severity} where severity is "low" | "medium" | "high".
    """
    signals = []
    body_shape = profile.get("body_shape")
    ratios = profile.get("ratios") or {}
    size_estimate = profile.get("size_estimate") or {}
    garment_silhouette = garment.get("silhouette")
    garment_fit = garment.get("fit")  # e.g. "slim", "regular", "relaxed"

    score = body_fit_score(body_shape, garment_silhouette)
    if score < 0.4:
        signals.append({
            "signal": "body_fit",
            "reason": (
                f"The {garment_silhouette or 'cut'} silhouette runs against your "
                f"{body_shape or 'unread'} body shape — likely to emphasize the "
                f"part you may want to play down."
            ),
            "severity": "high" if score < 0.3 else "medium",
        })

    # Waist emphasis vs measured waist-to-hip ratio
    waist_hip = ratios.get("waist_to_hip")
    if waist_hip is not None and garment_fit == "slim":
        if waist_hip >= 0.95:  # undefined waist
            signals.append({
                "signal": "waist_fit",
                "reason": "A slim fit traces a waist your silhouette doesn't strongly define.",
                "severity": "medium",
            })
        elif waist_hip <= 0.80:  # defined waist
            signals.append({
                "signal": "waist_fit",
                "reason": "A slim fit would show your defined waist — a strength of your shape.",
                "severity": "low",
            })

    # Size estimate band — flagged as noisy, used only as a soft check
    hip_est = (size_estimate.get("cm") or {}).get("hip")
    garment_bust = garment.get("measurements", {}).get("bust_cm")
    if hip_est and garment_bust:
        diff = abs(garment_bust - hip_est)
        if diff > 8:
            signals.append({
                "signal": "size_band",
                "reason": (
                    f"Garment bust ({garment_bust} cm) sits {diff} cm from your "
                    f"rough hip estimate ({hip_est} cm) — treat the estimate as "
                    f"directional only."
                ),
                "severity": "low",
            })

    return signals


HONESTY = {
    "kind": "MEASURED ratios + CONVENTION shape + NOISY ESTIMATE size. The ratios "
            "are scale-free and reliable; the shape word and size cm are not.",
    "ratios_source": "MEASURED from the silhouette at MediaPipe landmark heights "
                     "(body_engine.py — reused from cv-service/body_geometry.py).",
    "shape_source": "CONVENTION over measured ratios. Thresholds are ours and "
                    "uncalibrated; the five-shape system is sourced to FFIT (2004) "
                    "and The Concept Wardrobe.",
    "size_source": "NOISY ESTIMATE from photos — never a measurement, never used "
                   "as a hard gate, only as a soft directional flag.",
    "silhouette_fit": "SILHOUETTE_BODY_FIT is craft convention — which cut reads "
                      "balanced on which shape. Supported by no controlled study.",
}