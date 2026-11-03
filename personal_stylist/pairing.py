"""
ALTIER · personal-stylist/pairing.py
-------------------------------------
Product pairing: what goes with this item, given her palette and body shape.

READS FROM PROFILE
    palette (generated CIELAB palette — {best, care, params, provenance})
    body_shape, ratios
    undertone, depth, contrast

WHAT IT RETURNS
    pairings (list of {slot, name, colours, reason}), pairing_notes

EPISTEMICS
    Pairing uses her MEASURED palette hexes and the convention rules from
    rules_engine.py. A pairing suggestion is craft convention — "navy near your
    face lifts your contrast" — not a fact about what will look good on her.
"""

#: Complementary slot pairs — what a garment is typically worn WITH.
SLOT_PAIRS = {
    "top": ["bottom", "shoes", "accessory"],
    "bottom": ["top", "shoes", "accessory"],
    "dress": ["shoes", "accessory", "layer"],
    "layer": ["top", "bottom", "shoes"],
    "shoes": ["top", "bottom", "accessory"],
    "accessory": ["top", "bottom", "dress", "layer"],
}

#: Convention pairings: body_shape -> {slot: [recommended attributes]}. Uncalibrated.
BODY_PAIRINGS = {
    "pear": {
        "top": ["bright_colour", "detail_neckline"],
        "bottom": ["dark_colour", "straight_leg"],
    },
    "apple": {
        "top": ["v_neck", "flowy"],
        "bottom": ["mid_rise", "straight_leg"],
    },
    "hourglass": {
        "top": ["fitted", "waist_emphasis"],
        "bottom": ["high_rise", "fitted"],
    },
    "rectangle": {
        "top": ["peplum", "belted"],
        "bottom": ["high_rise"],
    },
    "inverted-triangle": {
        "top": ["v_neck", "soft_shoulder"],
        "bottom": ["a_line", "detail_hem"],
    },
}


def pairings_for(profile: dict, garment_slot: str,
                 candidate_looks: list[dict]) -> list[dict]:
    """Suggest pairing pieces from the candidate pool for a garment slot.

    -> list of {slot, name, colours, reason, as_searched}
    Filtered to slots that pair with garment_slot, ranked by palette colour
    overlap with her measured best swatches.
    """
    body_shape = profile.get("body_shape")
    palette = profile.get("palette") or {}
    best_hexes = [s["hex"] for s in (palette.get("best") or [])]

    suggested_slots = SLOT_PAIRS.get(garment_slot, [])
    pairings = []
    for look in candidate_looks:
        look_slot = look.get("slot")
        if look_slot not in suggested_slots:
            continue
        look_colours = look.get("colors") or []
        overlap = [c for c in look_colours if c in best_hexes]
        reason = []
        if overlap:
            reason.append(f"shares {', '.join(overlap)} with your palette")
        if body_shape:
            rec_attrs = BODY_PAIRINGS.get(body_shape, {}).get(look_slot, [])
            if rec_attrs:
                reason.append(f"{' + '.join(rec_attrs)} suits your {body_shape} shape")
        pairings.append({
            "slot": look_slot,
            "name": look.get("title", look_slot),
            "colours": look_colours,
            "reason": "; ".join(reason) if reason else "compatible slot",
            "as_searched": look.get("as_searched"),
        })

    # Rank: looks with palette overlap first
    pairings.sort(key=lambda p: len([c for c in p["colours"] if c in best_hexes]), reverse=True)
    return pairings[:4]


HONESTY = {
    "kind": "CRAFT CONVENTION. Pairing rules are styling practice — supported by "
            "no controlled study. Your measured palette hexes are real; which "
            "colours go together is convention.",
    "palette_source": "page1/engines/palette_engine.py — CIELAB LCh sweep, "
                      "gamut-checked, over an uncalibrated region.",
    "body_pairings": "BODY_PAIRINGS is editorial convention — which garment "
                     "attributes suit which body shape. Uncalibrated.",
}