"""
ALTIER · personal-stylist — verdict engine (Sections 12-17 of spec).

buy / caution / skip on every product, with risk count over named signals,
match % as a weighted blend of product quality, body fit and colouring fit,
and a `reasons` + `honesty` block on every response. Routes clothes vs makeup.

Sections:
  12. Verdict engine — buy/caution/skip
  13. Trust and reputation signals
  14. Closet, worth, longevity
  15. Personal memory — sizing + shades + rule confidence
  16. Agent layer — the AI talks, the engines decide
  17. Try-on and glow-up rendering (prompt + composite spec)

EVERYTHING HERE IS CRAFT CONVENTION, UNCALIBRATED. The risk cuts (1 and 4),
the weights, and every signal threshold are editorial guesses. First 5–10
testers start the calibration. None of this is evidence.
"""

from .engine import VerdictEngine, verdict_on_product
from .trust_signals import trust_score, trust_signals
from .reputation import reputation_score, reputation_signals
from .wardrobe import Wardrobe, Garment
from .outfit import build_outfits
from .look import Look, look_from_product
from .sizing_memory import size_hint, nearest_shade, delta_e_cie76, rule_confidence_delta
from .shades import match_shade, shade_distance
from .agent import AgentEngine, agent_tools_registry
from .prompt_builder import build_try_on_prompt
from .composite import identity_mask_spec, composite_ready

__all__ = [
    "VerdictEngine", "verdict_on_product",
    "trust_score", "trust_signals",
    "reputation_score", "reputation_signals",
    "Wardrobe", "Garment", "build_outfits",
    "Look", "look_from_product",
    "size_hint", "nearest_shade", "delta_e_cie76", "rule_confidence_delta",
    "match_shade", "shade_distance",
    "AgentEngine", "agent_tools_registry",
    "build_try_on_prompt",
    "identity_mask_spec", "composite_ready",
]
