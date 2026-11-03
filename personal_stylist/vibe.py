"""
ALTIER · personal-stylist/vibe.py
----------------------------------
Aesthetic fit: does this product match her taste vector and confirmed vibe?

READS FROM PROFILE
    taste_vector (SigLIP mean embedding of her saved pins — images she saved,
                  not clothes she likes; no correctness claim)
    vibe (her confirmed phrase + descriptors — interpretation, editable,
          overrides nothing)

WHAT IT RETURNS
    vibe_score (0..1), vibe_notes, risk_signals

EPISTEMICS
    The taste vector represents images she saved — it carries the model, the
    pose, the lighting and the background, not just "clothes she likes". The
    vibe phrase is her own words or an engine proposal she edited. Both are
    INTERPRETATION, not measurement. A low vibe score is a soft nudge, not a
    reason to skip.
"""

import math


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two vectors. Returns 0.0 if either is empty."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def vibe_score(taste_vector: list[float] | None,
               garment_embedding: list[float] | None) -> float:
    """0..1 alignment between her taste vector and a garment embedding.

    Returns 0.5 (neutral) when either is missing — no data is not a negative
    signal, and must not count as a risk.
    """
    if taste_vector is None or garment_embedding is None:
        return 0.5
    sim = cosine_similarity(taste_vector, garment_embedding)
    # Map [-1, 1] -> [0, 1], but clamp so a neutral-ish similarity stays near 0.5
    return max(0.0, min(1.0, (sim + 1.0) / 2.0))


def vibe_signals(profile: dict, garment: dict) -> list[dict]:
    """Run vibe/taste checks against a garment. -> list of risk signals."""
    signals = []
    taste_vector = profile.get("taste_vector")
    garment_embedding = garment.get("embedding")
    vibe = profile.get("vibe") or {}
    vibe_phrase = vibe.get("phrase") if isinstance(vibe, dict) else None
    garment_tags = garment.get("tags") or []
    garment_moods = garment.get("moods") or []

    score = vibe_score(taste_vector, garment_embedding)
    if score < 0.35:
        signals.append({
            "signal": "taste_fit",
            "reason": (
                "This doesn't read close to what you've saved before — could "
                "still be worth trying, but it's outside your usual taste."
            ),
            "severity": "low",
        })

    # Mood/tag mismatch — soft signal only
    vibe_descriptors = vibe.get("descriptors") if isinstance(vibe, dict) else []
    if vibe_descriptors and garment_moods:
        overlap = set(d.lower() for d in vibe_descriptors) & set(m.lower() for m in garment_moods)
        if not overlap:
            signals.append({
                "signal": "mood_fit",
                "reason": (
                    f"Your vibe is {vibe_phrase or 'unset'}; this is tagged "
                    f"{', '.join(garment_moods)} — different register."
                ),
                "severity": "low",
            })

    return signals


HONESTY = {
    "kind": "INTERPRETATION built on interpretation. Taste vector = mean of SigLIP "
            "embeddings of images you saved (represents images you saved, not "
            "clothes you like). Vibe phrase = your words or an edited proposal. "
            "Neither overrides a measured read.",
    "taste_vector_source": "page1/engines/taste_engine.py — google/siglip2-base-"
                           "patch16-224, mean of saved image embeddings.",
    "vibe_source": "page1/engines/vibe_engine.py — zero-shot similarity between "
                   "pins and twenty hand-written adjectives, then edited by you.",
    "no_correctness_claim": "Your taste makes no correctness claim at all. A low "
                            "vibe score is a soft nudge, never a hard skip signal.",
}