"""
ALTIER · personal-stylist/api.py
---------------------------------
FastAPI service on port 8090 — the personal-stylist engines.

Endpoints:
    POST /verdict        buy / caution / skip on one product (Section 12)
    POST /wardrobe       manage the user's closet (Section 14)
    POST /outfit         build outfits from wardrobe (Section 14)
    POST /shade-match    match a product shade to her measured swatches (Section 15)
    POST /size-hint      per-brand size hint from "did it fit" taps (Section 15)
    POST /try-on-prompt  build a try-on rendering prompt (Section 17)
    GET  /health         what is wired up

This service owns Sections 12–17 of the spec. page1/api.py (port 8000) owns
Sections 10–11 (colour, body, rules, RAG, recommender). The two services run
side by side on the same Mac; the phone reaches both over wifi or Tailscale.

DATA STILL LOCAL — nothing here touches the internet except optional Gemini
(for the agent layer) and optional live search (for /pool/ingest on page1).
Face/body processing never leaves this machine.
"""

import os
from typing import Any, Dict, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from personal_stylist.engine import verdict_on_product
from personal_stylist.wardrobe import Wardrobe
from personal_stylist.outfit import build_outfits
from personal_stylist.look import look_from_product
from personal_stylist.prompt_builder import build_try_on_prompt
from personal_stylist.sizing_memory import size_hint
from personal_stylist.shades import match_shade

# Load .env so Supabase keys are available
try:
    from dotenv import load_dotenv
    import os as _os
    _load_dotenv = load_dotenv
    _load_dotenv(os.path.join(_os.path.dirname(__file__), "..", "page1", ".env"))
except Exception:
    pass

app = FastAPI(title="ALTIER · Personal Stylist", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALTIER_ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------- auth (stub)
# Firebase Auth is wired on the web frontend; this service trusts the
# Authorization header and extracts the user id from a verified token when
# Supabase is configured. Without Supabase it falls back to a local dev id.
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")


def _client(token=None):
    if not SUPABASE_URL:
        return None
    try:
        from supabase import create_client
    except ImportError:
        return None
    if not SUPABASE_ANON_KEY:
        return None
    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    if token:
        client.postgrest.auth(token)
    return client


async def current_user(authorization: str = Header(default="")):
    token = authorization[7:].strip() if authorization.lower().startswith("bearer ") else ""
    if not SUPABASE_URL:
        return {"id": "local-dev-user", "token": None, "local": True}
    if not token:
        raise HTTPException(401, "missing bearer token")
    client = _client(token)
    if client is None:
        raise HTTPException(503, "supabase is configured but its client is unavailable")
    try:
        user = client.auth.get_user(token)
    except Exception:
        raise HTTPException(401, "invalid or expired token")
    if not user or not getattr(user, "user", None):
        raise HTTPException(401, "invalid or expired token")
    return {"id": user.user.id, "token": token, "local": False}


def _load_profile(user):
    client = _client(user.get("token"))
    if client is None:
        return None
    try:
        rows = client.table("profiles").select("*").eq("user_id", user["id"]).limit(1).execute()
        return (rows.data or [None])[0]
    except Exception:
        return None


# ---------------------------------------------------------------- request models
class VerdictRequest(BaseModel):
    product: dict
    candidate_looks: Optional[list] = None


class WardrobeRequest(BaseModel):
    garments: Optional[list] = None
    garment: Optional[dict] = None


class OutfitRequest(BaseModel):
    occasion: Optional[str] = None
    limit: int = 5


class ShadeMatchRequest(BaseModel):
    brand: str
    product_shade_hex: str


class SizeHintRequest(BaseModel):
    brand: str
    fit_events: Optional[list] = None


class TryOnPromptRequest(BaseModel):
    look: dict


# ---------------------------------------------------------------- POST /verdict
@app.post("/verdict")
async def verdict(req: VerdictRequest, user=Depends(current_user)):
    """buy / caution / skip on one product, with reasons and honesty block."""
    stored = _load_profile(user) or {}
    profile = {
        "body_shape": stored.get("body_shape"),
        "ratios": stored.get("ratios"),
        "size_estimate": stored.get("size_estimate"),
        "undertone": stored.get("undertone"),
        "depth": stored.get("depth"),
        "skin_hex": stored.get("skin_hex"),
        "taste_vector": stored.get("taste_vector"),
        "vibe": stored.get("vibe"),
        "budget_max": stored.get("budget_max"),
        "budget_flex": stored.get("budget_flex"),
        "palette": stored.get("palette"),
    }
    out = verdict_on_product(profile, req.product, req.candidate_looks)
    out["profile_used"] = {
        "body_shape": profile["body_shape"],
        "undertone": profile["undertone"],
        "depth": profile["depth"],
        "has_taste_vector": profile["taste_vector"] is not None,
        "has_vibe": profile["vibe"] is not None,
    }
    return out


# ---------------------------------------------------------------- POST /wardrobe
@app.post("/wardrobe")
async def wardrobe(req: WardrobeRequest, user=Depends(current_user)):
    """Get or update the user's wardrobe. All garment data is user-provided."""
    stored = _load_profile(user) or {}
    wardrobe_data = stored.get("wardrobe") or {"garments": []}

    if req.garment is not None:
        wardrobe_data["garments"].append(req.garment)
    elif req.garments is not None:
        wardrobe_data["garments"] = req.garments

    w = Wardrobe(wardrobe_data["garments"])

    persisted, persist_error = False, None
    profile_update = dict(stored)
    profile_update["wardrobe"] = wardrobe_data
    client = _client(user.get("token"))
    if client is not None:
        try:
            client.table("profiles").upsert(profile_update, on_conflict="user_id").execute()
            persisted = True
        except Exception as e:
            persist_error = f"{type(e).__name__}"

    return {
        "garments": [g.__dict__ for g in w.garments],
        "active_count": len(w.active),
        "near_duplicates": w.near_duplicates(),
        "gaps": w.gaps(),
        "cost_per_wear_report": w.cost_per_wear_report(),
        "fibre_lifespan_report": w.fibre_lifespan_report(),
        "persisted": persisted,
        "persist_error": persist_error,
        "honesty": {
            "kind": "USER-PROVIDED CLOSET DATA. ALTIER never scrapes a closet.",
        },
    }


# ---------------------------------------------------------------- POST /outfit
@app.post("/outfit")
async def outfit(req: OutfitRequest, user=Depends(current_user)):
    """Build outfits from the user's wardrobe — craft convention, not a purchase judge."""
    stored = _load_profile(user) or {}
    wardrobe_data = stored.get("wardrobe") or {"garments": []}
    w = Wardrobe(wardrobe_data["garments"])

    outfits = build_outfits(
        w, stored.get("palette"), stored.get("body_shape"),
        req.occasion, limit=req.limit,
    )
    return {
        "outfits": outfits,
        "wardrobe_size": len(w.active),
        "honesty": {
            "kind": "CRAFT CONVENTION. Outfit building from what she already owns. "
                    "ALTIER does not judge a new purchase against her closet.",
        },
    }


# ---------------------------------------------------------------- POST /shade-match
@app.post("/shade-match")
async def shade_match(req: ShadeMatchRequest, user=Depends(current_user)):
    """Match a product shade to her nearest measured swatch for that brand."""
    stored = _load_profile(user) or {}
    brand_swatch_hexes = stored.get("brand_swatch_hexes") or {}
    return match_shade(req.brand, req.product_shade_hex, brand_swatch_hexes)


# ---------------------------------------------------------------- POST /size-hint
@app.post("/size-hint")
async def size_hint_endpoint(req: SizeHintRequest, user=Depends(current_user)):
    """Her own per-brand size hint from "did it fit" events."""
    stored = _load_profile(user) or {}
    fit_events = req.fit_events or stored.get("fit_events") or []
    hint = size_hint(req.brand, fit_events)
    if hint is None:
        return {
            "brand": req.brand,
            "suggested_size": None,
            "note": "Not enough fit events for this brand — need at least two.",
            "honesty": {"kind": "ONE-PERSON DATA — her own fit history, not anonymous reviews."},
        }
    return hint


# ---------------------------------------------------------------- POST /try-on-prompt
@app.post("/try-on-prompt")
async def try_on_prompt(req: TryOnPromptRequest, user=Depends(current_user)):
    """Build a prompt-rendered fit prompt for try-on rendering."""
    stored = _load_profile(user) or {}
    profile = {
        "body_shape": stored.get("body_shape"),
        "ratios": stored.get("ratios"),
        "undertone": stored.get("undertone"),
        "depth": stored.get("depth"),
    }
    look = look_from_product(req.look)
    return build_try_on_prompt(profile, look)


# ---------------------------------------------------------------- GET /health
@app.get("/health")
async def health():
    """What is wired up on this service."""
    return {
        "ok": True,
        "service": "personal-stylist",
        "port": 8090,
        "sections": {
            "12_verdict": True,
            "13_trust_reputation": True,
            "14_wardrobe": True,
            "15_sizing_shades": True,
            "16_agent": True,
            "17_try_on": True,
        },
        "supabase": bool(SUPABASE_URL and SUPABASE_ANON_KEY),
        "honesty": {
            "kind": "DATA STILL LOCAL. Face/body processing never leaves this Mac. "
                    "Gemini is optional and only used for phrasing, never for judgements.",
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8090)
