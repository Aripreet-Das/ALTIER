"""
ALTIER · personal-stylist/budget.py
------------------------------------
Budget fit: does the price sit inside her stated comfort zone?

READS FROM PROFILE
    budget_max (optional — her self-stated maximum per item, in local currency)
    budget_flex (optional — how far above max she'll stretch, as a fraction)

WHAT IT RETURNS
    budget_score (0..1), budget_notes, risk_signals

EPISTEMICS
    Budget is entirely user-provided. ALTIER never infers it from anything.
    If she hasn't set a budget, budget returns neutral (0.5) with no risk —
    absence of a budget is not a risk signal.
"""


def budget_score(price: float | None, budget_max: float | None,
                 budget_flex: float | None = 0.2) -> float:
    """0..1 budget compatibility.

    1.0 = well under max, 0.5 = at max, 0.0 = well above max+flex.
    Returns 0.5 (neutral) when price or budget_max is missing.
    """
    if price is None or budget_max is None:
        return 0.5
    if price <= budget_max:
        return 1.0
    stretch = budget_max * (1.0 + (budget_flex or 0.2))
    if price <= stretch:
        # Linear decay from 1.0 at max to 0.0 at max+flex
        over = price - budget_max
        flex_room = stretch - budget_max
        return max(0.0, 1.0 - (over / flex_room))
    return 0.0


def budget_signals(profile: dict, product: dict) -> list[dict]:
    """Run budget checks against a product. -> list of risk signals."""
    signals = []
    price = product.get("price_cents")
    if price is not None:
        price = price / 100.0
    budget_max = profile.get("budget_max")
    budget_flex = profile.get("budget_flex", 0.2)

    score = budget_score(price, budget_max, budget_flex)

    if score == 0.5:
        return signals  # no data — no risk

    if score < 0.4:
        signals.append({
            "signal": "budget",
            "reason": (
                f"At {_fmt(price)} this sits above your stated comfort zone "
                f"({_fmt(budget_max) if budget_max else 'unset'})."
            ),
            "severity": "high" if score < 0.2 else "medium",
        })

    return signals


def _fmt(value: float | None) -> str:
    if value is None:
        return "unset"
    return f"{value:.0f}"


HONESTY = {
    "kind": "USER-PROVIDED. ALTIER never infers budget from income, browsing, or "
            "anything else. If it's unset, budget is neutral — never a risk.",
    "no_inference": "No model guesses what she can afford. budget_max and "
                    "budget_flex come only from the user herself.",
}