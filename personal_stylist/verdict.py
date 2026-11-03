"""
ALTIER · personal-stylist/verdict.py
-------------------------------------
buy / caution / skip from a risk count over named signals.

RISK COUNTS OVER NAMED SIGNALS (cuts at 1 and 4)
    Each signal that fails its threshold contributes one risk:
        0 risks   → buy
        1-3 risks → caution
        4+ risks  → skip

    The cuts are UNCALIBRATED. 1 and 4 are editorial guesses, not findings.
    Calibrate them with the first 5–10 testers against what they actually
    bought and returned.

WHAT IS NOT HERE
    No machine learning. No trained model. No global shopper data.
    This is one person's signals, one product at a time, weighed by hand.
"""

# ------------------------------------------------------------------ risk cuts
#: Below this many risks: buy. UNCALIBRATED.
_BUY_MAX_RISKS = 0
#: Below this many risks: caution (between buy_max and skip_min).
_CAUTION_MAX_RISKS = 3
#: At or above this many risks: skip. UNCALIBRATED.
_SKIP_MIN_RISKS = 4


def classify(risk_count: int) -> str:
    """risk count (int) -> 'buy' | 'caution' | 'skip'"""
    if risk_count <= _BUY_MAX_RISKS:
        return "buy"
    if risk_count <= _CAUTION_MAX_RISKS:
        return "caution"
    return "skip"


def risk_label(risk_count: int) -> str:
    """Human-readable label for a risk count."""
    verdict = classify(risk_count)
    return {
        "buy": "Buy — no red flags on the signals we can see.",
        "caution": "Caution — a few signals are off. Check the reasons before buying.",
        "skip": "Skip — too many signals are off for this to be a good bet.",
    }[verdict]


HONESTY = {
    "kind": "CRAFT CONVENTION, UNCALIBRATED. Risk cuts at 1 and 4 are editorial "
            "guesses, not findings. Calibrate with the first 5–10 testers.",
    "no_model": "No ML, no trained model, no global shopper data. One person's "
                "signals, one product at a time.",
    "what_it_is_not": "Not a size recommendation (True Fit does that), not a shade "
                      "match (Perfect Corp does that). This combines colouring + body "
                      "+ closet + longevity into one verdict, which none of them do.",
}