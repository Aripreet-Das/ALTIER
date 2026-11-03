"""
ALTIER · personal-stylist/prompt_builder.py
--------------------------------------------
Try-on prompt builder (Section 17).

Try-on redefined as prompt-rendered fit: her body profile + what the product
says about itself → one edit prompt → image of her wearing it as it would sit.

Image is an illustration of the verdict, never evidence. Deferred until a
no-training vendor (photo leaves the machine).

READS
    profile: body_shape, ratios, size_estimate, undertone, depth, skin_hex
    product: name, colours, materials, silhouette, fit, slot, description

WHAT IT RETURNS
    {prompt, unverified, note} — the text she pastes into a try-on tool
"""

from .look import Look


def build_try_on_prompt(profile: dict, look: Look) -> dict:
    """Build a prompt-rendered fit prompt from profile + look.

    -> {prompt, unverified, note}

    The prompt describes her body profile (shape, proportions) + the garment
    (colour, silhouette, fit, material) so a try-on model can render her
    wearing it as it would sit. No identity info leaves the machine.
    """
    body_shape = profile.get("body_shape")
    ratios = profile.get("ratios") or {}
    undertone = profile.get("undertone")
    depth = profile.get("depth")

    garment_desc = look.title
    garment_colours = ", ".join(look.colours) if look.colours else "unspecified"
    garment_slot = look.slot
    garment_material = ", ".join(look.materials) if look.materials else "unspecified"

    unverified = []
    if look.as_searched:
        unverified.extend(look.as_searched.get("terms", []))

    prompt_parts = [
        f"A full-body photograph of a person with a {body_shape or 'unspecified'} body shape",
        f"wearing a {garment_slot}: {garment_desc}.",
        f"Garment colour: {garment_colours}.",
        f"Garment material: {garment_material}.",
        f"Fit: regular, true to the garment's own cut.",
        "The image should show the garment as it would sit on this body type — "
        "proportions, drape and silhouette consistent with the body shape described.",
        "Photorealistic, front-on view, neutral lighting, plain background.",
        "No face, no identifying features — body shape and proportions only.",
    ]

    prompt = " ".join(prompt_parts)

    note = (
        "This is a try-on illustration, not evidence. The image shows what the "
        "model renders from the prompt — it does not prove the garment fits, "
        "the colour is right, or the material behaves as described. Deferred "
        "until a no-training vendor (photo leaves the machine)."
    )

    return {
        "prompt": prompt,
        "unverified": unverified,
        "note": note,
    }


HONESTY = {
    "kind": "ILLUSTRATION, NOT EVIDENCE. Try-on is prompt-rendered fit — her "
            "body profile + the product's own claims → one edit prompt → image. "
            "The image is an illustration of the verdict, never evidence of fit.",
    "no_identity": "No face, no identifying features — body shape and proportions only. "
                   "Photo leaves the machine only with a no-training vendor.",
    "deferred": "Deferred until a no-training vendor is available — ALTIER does not "
                "send photos to training models.",
}