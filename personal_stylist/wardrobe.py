"""
ALTIER · personal-stylist/wardrobe.py
--------------------------------------
Closet data model (Section 14).

A wardrobe is the user's own clothes — what she owns, what she's worn, what
she's retired. ALTIER never scrapes a closet; everything here is user-entered
or imported from her own order history.

READS
    garments: list of {id, name, brand, category, slot, colours, material,
                       price_cents, date_acquired, wear_count, retired,
                       fit_rating, fibre, care_instructions}

WHAT IT RETURNS
    Wardrobe object with helpers: near-duplicates, gaps, cost-per-wear,
    fibre lifespan estimates.

EPISTEMICS
    All garment data is user-provided. Cost-per-wear = price / wear_count —
    simple arithmetic, not a model. Fibre → lifespan is craft convention
    (wool lasts longer than acrylic), not tested by ALTIER.
"""

from datetime import date, timedelta
from typing import Optional


#: Fibre -> estimated lifespan in years (craft convention, uncalibrated).
FIBRE_LIFESPAN_YEARS = {
    "wool": 8, "cashmere": 6, "leather": 10, "denim": 5,
    "canvas": 4, "twill": 4, "cotton": 3, "linen": 2,
    "polyester": 2, "rayon": 1, "viscose": 1, "acrylic": 1,
    "spandex": 1, "elastane": 1, "nylon": 3, "silk": 3,
}

#: Trend-word penalties — trendy pieces have shorter effective lifespan.
TREND_PENALTIES = {
    "micro_trend": 0.5,      # "cottagecore", "barbiecore" etc.
    "seasonal": 0.75,        # this season's print
    "classic": 1.0,          # no penalty
    "timeless": 1.1,         # slight bonus
}


class Garment:
    """One item in her closet."""

    def __init__(self, data: dict):
        self.id = data["id"]
        self.name = data.get("name", self.id)
        self.brand = data.get("brand")
        self.category = data.get("category")  # clothes | makeup
        self.slot = data.get("slot")  # top, bottom, dress, shoes, accessory, layer
        self.colours = data.get("colours") or []
        self.material = data.get("material")
        self.price_cents = data.get("price_cents")
        self.date_acquired = data.get("date_acquired")
        self.wear_count = data.get("wear_count", 0)
        self.retired = data.get("retired", False)
        self.fit_rating = data.get("fit_rating")  # 1-5, user-rated
        self.fibre = data.get("fibre")
        self.care_instructions = data.get("care_instructions")

    def cost_per_wear(self) -> float | None:
        """price / wear_count. None if never worn or no price."""
        if not self.price_cents or not self.wear_count:
            return None
        return self.price_cents / 100.0 / self.wear_count

    def lifespan_years(self, trend_word: str | None = None) -> float | None:
        """Estimated years of wearable life, from fibre + trend penalty."""
        if not self.fibre:
            return None
        base = FIBRE_LIFESPAN_YEARS.get(self.fibre.lower(), 2.0)
        multiplier = TREND_PENALTIES.get(trend_word or "classic", 1.0)
        return base * multiplier

    def is_active(self) -> bool:
        return not self.retired


class Wardrobe:
    """Her closet — all garments plus helpers."""

    def __init__(self, garments: list[dict]):
        self.garments = [Garment(g) for g in garments]
        self.active = [g for g in self.garments if g.is_active()]

    def near_duplicates(self, threshold_colour_overlap: float = 0.7) -> list[dict]:
        """Find garments that are near-duplicates: same slot, similar colours."""
        dupes = []
        for i, g1 in enumerate(self.active):
            for g2 in self.active[i + 1:]:
                if g1.slot != g2.slot:
                    continue
                overlap = set(c.lower() for c in g1.colours) & set(c.lower() for c in g2.colours)
                if overlap and len(overlap) / max(len(g1.colours), len(g2.colours)) >= threshold_colour_overlap:
                    dupes.append({
                        "garment_a": g1.id, "garment_b": g2.id,
                        "slot": g1.slot, "shared_colours": sorted(overlap),
                        "reason": f"Same slot ({g1.slot}) with overlapping colours — near-duplicate.",
                    })
        return dupes

    def gaps(self, desired_slots: list[str] | None = None) -> list[dict]:
        """Slots she has nothing in — gaps in the wardrobe."""
        desired = desired_slots or ["top", "bottom", "shoes", "layer"]
        have_slots = {g.slot for g in self.active if g.slot}
        return [{"slot": s, "reason": f"No active {s} in wardrobe."} for s in desired if s not in have_slots]

    def cost_per_wear_report(self) -> list[dict]:
        """Cost-per-wear for every worn, priced garment — worst first."""
        report = []
        for g in self.active:
            cpw = g.cost_per_wear()
            if cpw is not None:
                report.append({
                    "garment_id": g.id, "name": g.name, "price_cents": g.price_cents,
                    "wear_count": g.wear_count, "cost_per_wear": round(cpw, 2),
                })
        report.sort(key=lambda x: x["cost_per_wear"], reverse=True)
        return report

    def fibre_lifespan_report(self) -> list[dict]:
        """Estimated lifespan per garment from fibre + care."""
        report = []
        for g in self.active:
            years = g.lifespan_years()
            if years is not None:
                report.append({
                    "garment_id": g.id, "name": g.name, "fibre": g.fibre,
                    "lifespan_years": round(years, 1),
                })
        report.sort(key=lambda x: x["lifespan_years"])
        return report


HONESTY = {
    "kind": "USER-PROVIDED CLOSET DATA. ALTIER never scrapes a closet — every "
            "garment is entered by the user or imported from her own order history.",
    "cost_per_wear": "Simple arithmetic: price / wear_count. Not a model, not "
                     "a prediction — just what she's actually worn vs paid.",
    "fibre_lifespan": "Craft convention — wool lasts longer than acrylic. Not "
                      "tested by ALTIER, and wear depends on care, not just fibre.",
}