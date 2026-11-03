"""
ALTIER · personal-stylist/composite.py
----------------------------------------
Identity-mask composition (Section 17).

Conceptual module for the composite step in try-on: an identity mask that
keeps her face and body shape consistent across renders without sending
identifying photos to a training model.

This is a placeholder structure — the actual image compositing is handled by
the no-training vendor (fal, FASHN, or similar) once one is integrated.
"""


def identity_mask_spec(body_shape: str | None,
                       proportions: dict | None) -> dict:
    """Specification for an identity mask — what to preserve across renders.

    -> {preserve: [...], vary: [...], note}

    This is sent to the try-on vendor as guidance, not as image data.
    """
    preserve = ["body_shape", "proportions", "height_relative"]
    vary = ["garment", "colour", "pose", "lighting"]

    if body_shape:
        preserve.append(f"body_shape:{body_shape}")
    if proportions:
        for k in proportions:
            preserve.append(f"proportion:{k}")

    return {
        "preserve": preserve,
        "vary": vary,
        "note": (
            "Identity mask specification — guidance for the try-on vendor on "
            "what to keep consistent across renders. Not image data, not sent "
            "to any training model."
        ),
    }


def composite_ready() -> bool:
    """Whether a no-training composite vendor is configured.

    Returns False until fal, FASHN, or similar is integrated. ALTIER does not
    send photos to training models.
    """
    return False


HONESTY = {
    "kind": "CONCEPTUAL PLACEHOLDER. Identity-mask composition is not yet "
            "implemented — the actual compositing waits for a no-training vendor. "
            "ALTIER does not send photos to training models.",
    "no_training": "Photo leaves the machine only with a no-training vendor "
                   "(fal, FASHN, CatVTON, IDM-VTON, OOTDiffusion — non-commercial "
                   "options exist for the deferred path).",
}