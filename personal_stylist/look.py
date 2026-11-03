"""
ALTIER · personal-stylist/look.py
----------------------------------
Look representation (Section 14).

A look is one assembled outfit — either from the seed pool, a live search
result, or her own wardrobe. Looks carry price, cost-per-wear potential, and
the honesty block about what their attributes mean.

READS FROM PRODUCT / GARMENT
    id, title, image_url, slot, colours, price_cents, materials, care_instructions,
    as_searched (terms from live search — not verified)
"""

from dataclasses import dataclass, field


@dataclass
class Look:
    id: str
    title: str
    slot: str
    colours: list[str] = field(default_factory=list)
    price_cents: int | None = None
    materials: list[str] = field(default_factory=list)
    care_instructions: str | None = None
    as_searched: dict | None = None
    source: str = "seed"  # seed | pin | wardrobe | live_search
    image_url: str | None = None

    def cost_per_wear(self, wear_count: int) -> float | None:
        """price / wear_count — simple arithmetic."""
        if not self.price_cents or not wear_count:
            return None
        return self.price_cents / 100.0 / wear_count

    def to_dict(self) -> dict:
        return {
            "id": self.id, "title": self.title, "slot": self.slot,
            "colours": self.colours, "price_cents": self.price_cents,
            "materials": self.materials, "care_instructions": self.care_instructions,
            "as_searched": self.as_searched, "source": self.source,
            "image_url": self.image_url,
        }


def look_from_product(product: dict, source: str = "live_search") -> Look:
    """Build a Look from a product dict (live search or seed)."""
    return Look(
        id=product.get("id", ""),
        title=product.get("title", product.get("id", "")),
        slot=product.get("slot", "top"),
        colours=product.get("colors") or product.get("colours") or [],
        price_cents=product.get("price_cents"),
        materials=product.get("materials") or [],
        care_instructions=product.get("care_instructions"),
        as_searched=product.get("as_searched"),
        source=source,
        image_url=product.get("image_url"),
    )


HONESTY = {
    "kind": "REPRESENTATION ONLY. A Look is a data structure — it carries no "
            "correctness claim about the garment it describes.",
    "as_searched": "Where attributes came from a live search, they are \"as "
                   "searched, not verified\" — the query asked for a square neck "
                   "and a retailer's title matched. Nobody checked the garment.",
}