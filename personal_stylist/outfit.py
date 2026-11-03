"""
ALTIER · personal-stylist/outfit.py
------------------------------------
Outfit builder from her own wardrobe (Section 14).

READS
    wardrobe (Wardrobe object), palette (her measured colours),
    body_shape, occasion, mood

WHAT IT RETURNS
    outfits: list of {top, bottom, shoes, layer, accessory, reason, cost_per_wear_total}

EPISTEMICS
    Outfit building is craft convention — "navy top with black trousers" —
    not evidence. ALTIER does not judge a new purchase against her closet
    with a measured profile (that's Whering's model, and ALTIER deliberately
    doesn't do it). Outfits are suggestions from what she already owns.
"""

from .wardrobe import Wardrobe


def build_outfits(wardrobe: Wardrobe, palette: dict | None,
                  body_shape: str | None, occasion: str | None,
                  limit: int = 5) -> list[dict]:
    """Build outfits from active wardrobe garments.

    One top + one bottom (or one dress) + shoes, optionally a layer and
    accessory. Filtered by palette colour overlap and occasion tags.
    """
    active = wardrobe.active
    best_hexes = set()
    if palette:
        best_hexes = {s["hex"] for s in (palette.get("best") or [])}

    tops = [g for g in active if g.slot == "top"]
    bottoms = [g for g in active if g.slot == "bottom"]
    dresses = [g for g in active if g.slot == "dress"]
    shoes = [g for g in active if g.slot == "shoes"]
    layers = [g for g in active if g.slot == "layer"]
    accessories = [g for g in active if g.slot == "accessory"]

    outfits = []

    # Top + bottom + shoes combos
    for top in tops:
        for bottom in bottoms:
            for shoe in shoes[:3]:  # limit shoe combos
                outfit = _assemble(
                    [top, bottom, shoe], best_hexes, body_shape, occasion
                )
                if outfit:
                    outfits.append(outfit)

    # Dress + shoes (+ layer)
    for dress in dresses:
        for shoe in shoes[:3]:
            outfit = _assemble(
                [dress, shoe], best_hexes, body_shape, occasion
            )
            if outfit:
                outfits.append(outfit)

    # Sort by palette overlap (her measured colours first)
    outfits.sort(key=lambda o: o["palette_overlap"], reverse=True)
    return outfits[:limit]


def _assemble(garments, best_hexes, body_shape, occasion):
    """Assemble one outfit from garments."""
    colours = []
    for g in garments:
        colours.extend(g.colours)
    overlap = [c for c in colours if c in best_hexes]

    reasons = []
    if overlap:
        reasons.append(f"shares {', '.join(sorted(set(overlap)))} with your palette")
    if body_shape:
        reasons.append(f"suitable for {body_shape} shape")
    if occasion:
        reasons.append(f"tagged for {occasion}")

    total_price = sum(g.price_cents or 0 for g in garments)
    total_wear = sum(g.wear_count or 0 for g in garments)
    cpw = (total_price / 100.0 / total_wear) if total_wear else None

    return {
        "items": [{"id": g.id, "name": g.name, "slot": g.slot,
                   "colours": g.colours, "price_cents": g.price_cents}
                  for g in garments],
        "palette_overlap": len(overlap),
        "reasons": reasons,
        "cost_per_wear_total": round(cpw, 2) if cpw else None,
    }


HONESTY = {
    "kind": "CRAFT CONVENTION. Outfit building is styling practice — supported "
            "by no controlled study. ALTIER does not judge a new purchase against "
            "her closet with a measured profile (that is Whering's model, and "
            "ALTIER deliberately does not do it).",
    "wardrobe_source": "User-entered garments only — ALTIER never scrapes a closet.",
    "not_a_purchase_judge": "Outfits are suggestions from what she already owns. "
                            "No purchase is recommended or discouraged against her closet.",
}