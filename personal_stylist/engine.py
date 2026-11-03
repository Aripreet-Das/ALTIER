"""
ALTIER · personal-stylist/engine.py
------------------------------------
Verdict engine: buy / caution / skip on every product.

ORCHESTRATES
    structure    — body fit (her measured shape + garment silhouette)
    vibe         — taste fit (her taste vector + garment embedding)
    makeup       — shade fit (her measured undertone+depth + product shade)
    pairing      — what goes with it (her palette + body shape)
    budget       — price vs her stated comfort zone
    longevity    — material + construction durability
    trust_signals — reviews, ratings, returns
    reputation   — brand track record

ROUTES CLOTHES vs MAKEUP
    Products tagged category="makeup" go through makeup.py; everything else
    goes through structure.py. All products go through vibe, budget,
    longevity, trust_signals and reputation.

VERDICT LOGIC
    Each signal that fails its threshold contributes one risk:
        0 risks   → buy
        1-3 risks → caution
        4+ risks  → skip

    match % = weighted blend of product quality, body fit, colouring fit.
    Every response carries a `reasons` list and an `honesty` block.

EPISTEMICS — READ THIS BEFORE USING
    The verdict is CRAFT CONVENTION, UNCALIBRATED. The risk cuts (1 and 4),
    the weights, and every signal threshold are editorial guesses. First
    5–10 testers start the calibration. None of this is evidence, and none of
    it is a trained model.

    The match % is NOT "the probability she'll like this". It's a weighted
    blend of three uncalibrated subscores. Say so in the UI.
"""

from .verdict import classify, risk_label, _BUY_MAX_RISKS, _CAUTION_MAX_RISKS
from .structure import structure_signals
from .vibe import vibe_signals
from .makeup import makeup_signals
from .pairing import pairings_for
from .budget import budget_signals
from .longevity import longevity_signals
from .trust_signals import trust_signals
from .reputation import reputation_signals

# ------------------------------------------------------------------ weights
#: Match % weights — sum must be 1.0. UNCALIBRATED.
#: Taste is the largest single term, conventions together outweigh it.
MATCH_WEIGHTS = {
    "vibe": 0.35,      # her taste vector alignment
    "structure": 0.25,  # body shape + silhouette fit
    "makeup": 0.20,    # shade fit (0.0 for non-makeup products)
    "trust": 0.10,     # review/rating trust
    "longevity": 0.05, # durability signals
    "reputation": 0.05,# brand track record
}
assert abs(sum(MATCH_WEIGHTS.values()) - 1.0) < 1e-9, "weights must sum to 1.0"

#: Signal thresholds — below this score, the signal contributes a risk.
_RISK_THRESHOLDS = {
    "structure": 0.4,
    "vibe": 0.35,
    "makeup": 0.4,
    "trust": 0.4,
    "longevity": 0.4,
    "reputation": 0.4,
    "budget": 0.4,
}


def _subscore_from_signals(signals: list[dict], default: float = 0.5) -> float:
    """Derive a 0..1 subscore from risk signals: each high risk subtracts."""
    if not signals:
        return default
    penalty = sum(0.25 if s["severity"] == "high" else 0.125 for s in signals)
    return max(0.0, min(1.0, default - penalty))


class VerdictEngine:
    """Run the full verdict pipeline on one product for one profile."""

    def __init__(self, profile: dict):
        self.profile = profile

    def verdict_on_product(self, product: dict,
                           candidate_looks: list[dict] | None = None) -> dict:
        """product dict -> {verdict, match_pct, risks, reasons, honesty, pairings, route}

        route is "makeup" | "clothes" | None.
        """
        category = (product.get("category") or "clothes").lower()
        route = "makeup" if category == "makeup" else "clothes"

        # --- run every signal engine
        structure_sigs = structure_signals(self.profile, product)
        vibe_sigs = vibe_signals(self.profile, product)
        makeup_sigs = makeup_signals(self.profile, product) if route == "makeup" else []
        budget_sigs = budget_signals(self.profile, product)
        longevity_sigs = longevity_signals(product)
        trust_sigs = trust_signals(product)
        reputation_sigs = reputation_signals(product)

        all_signals = (structure_sigs + vibe_sigs + makeup_sigs +
                       budget_sigs + longevity_sigs + trust_sigs +
                       reputation_sigs)

        # --- risk count -> verdict (only count actual risks, not positive notes)
        risk_signals = [s for s in all_signals if s.get("is_risk", True)]
        risk_count = len(risk_signals)
        verdict = classify(risk_count)

        # --- match % as weighted blend
        subscores = {
            "structure": _subscore_from_signals(structure_sigs, 0.5),
            "vibe": _subscore_from_signals(vibe_sigs, 0.5),
            "makeup": _subscore_from_signals(makeup_sigs, 0.5),
            "trust": _subscore_from_signals(trust_sigs, 0.5),
            "longevity": _subscore_from_signals(longevity_sigs, 0.5),
            "reputation": _subscore_from_signals(reputation_sigs, 0.5),
        }
        match_pct = round(
            100.0 * sum(MATCH_WEIGHTS[k] * v for k, v in subscores.items()), 1
        )

        # --- reasons (human-readable, one per signal + verdict summary)
        reasons = []
        for s in all_signals:
            reasons.append({"signal": s["signal"], "reason": s["reason"],
                            "severity": s["severity"]})
        reasons.insert(0, {
            "signal": "verdict_summary",
            "reason": f"{risk_label(risk_count)} ({risk_count} risk signal(s) out of {len(all_signals)} checked).",
            "severity": "info",
        })

        # --- pairings (clothes only)
        pairings = []
        if route == "clothes" and candidate_looks:
            garment_slot = product.get("slot", "top")
            pairings = pairings_for(self.profile, garment_slot, candidate_looks)

        return {
            "product_id": product.get("id"),
            "route": route,
            "verdict": verdict,
            "match_pct": match_pct,
            "risk_count": risk_count,
            "risk_label": risk_label(risk_count),
            "reasons": reasons,
            "subscores": subscores,
            "pairings": pairings,
            "honesty": self._honesty_block(),
        }

    def _honesty_block(self) -> dict:
        return {
            "kind": "CRAFT CONVENTION, UNCALIBRATED. The verdict (buy/caution/skip), "
                    "the risk cuts at 1 and 4, the match % weights, and every signal "
                    "threshold are editorial guesses — not evidence, not a trained "
                    "model. First 5–10 testers start the calibration.",
            "match_pct_note": (
                "match % is a weighted blend of uncalibrated subscores (vibe, body "
                "fit, shade fit, trust, longevity, reputation). It is NOT the "
                "probability she will like or keep this item."
            ),
            "signal_honesty": {
                "structure": "MEASURED ratios + CONVENTION shape + NOISY ESTIMATE size.",
                "vibe": "INTERPRETATION — taste vector = mean of saved image embeddings.",
                "makeup": "MEASURED undertone+depth + CONVENTION shade cuts.",
                "trust": "PLATFORM CLAIMS, UNVERIFIED — ALTIER does not verify reviews.",
                "longevity": "CRAFT CONVENTION + MANUFACTURER CLAIMS, untested.",
                "reputation": "SEDED CONVENTION, UNVERIFIED — no brand judgment made.",
                "budget": "USER-PROVIDED only — ALTIER never infers budget.",
            },
            "routes": "Makeup products route through makeup.py (shade fit); everything "
                      "else routes through structure.py (body fit). All products pass "
                      "through vibe, budget, longevity, trust and reputation.",
            "not_true_fit": "Not a size recommendation — True Fit does that at scale.",
            "not_perfect_corp": "Not a shade matcher — Perfect Corp and ModiFace do that.",
        }


def verdict_on_product(profile: dict, product: dict,
                       candidate_looks: list[dict] | None = None) -> dict:
    """Convenience function: profile + product -> verdict dict.

    Creates a VerdictEngine and runs one product through it.
    """
    engine = VerdictEngine(profile)
    return engine.verdict_on_product(product, candidate_looks)


# ------------------------------------------------------------------ CLI
if __name__ == "__main__":
    import argparse
    import json

    ap = argparse.ArgumentParser(description="ALTIER verdict engine (Section 12)")
    ap.add_argument("--product", required=True, help="product JSON file or inline JSON")
    ap.add_argument("--profile", default="{}", help="profile JSON file or inline JSON")
    ap.add_argument("--looks", default=None, help="candidate looks JSON file for pairings")
    args = ap.parse_args()

    def _load(path_or_json):
        import os
        if os.path.isfile(path_or_json):
            with open(path_or_json) as f:
                return json.load(f)
        return json.loads(path_or_json)

    profile = _load(args.profile)
    product = _load(args.product)
    looks = _load(args.looks) if args.looks else None

    out = verdict_on_product(profile, product, looks)
    print(json.dumps(out, indent=2))
