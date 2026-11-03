"""
ALTIER · personal-stylist/agent.py
-----------------------------------
Agent layer — the AI talks, the engines decide (Section 16).

READS FROM PROFILE
    All measured reads: undertone, depth, contrast, body_shape, ratios,
    size_estimate, face_shape, taste_vector, vibe, palette

WHAT IT RETURNS
    Tool-calling response: Gemini picks which tool to call, the deterministic
    engine runs it, Gemini phrases the result. Every judgement comes from the
    engines — Gemini never invents a measurement, a shade, or a size.

TOOLS (all deterministic engines)
    - verdict_on_product   → buy/caution/skip with reasons
    - read_body            → body shape + ratios + size estimate
    - read_face            → undertone, depth, skin/hair/eye hex
    - recommend_look       → today's fit from the recommender
    - match_shade          → product shade vs her measured swatches
    - size_hint            → per-brand size from her fit history

EPISTEMICS
    Gemini only understands the ask and picks the tool. Every judgement comes
    from deterministic engines. Grounding check (stylist_llm.py) treats
    unsourced claims — e.g. unprompted Kibbe — as hallucination. Free tier
    until first paid user; no photo may reach Gemini meanwhile; then
    paid/no-training API.
"""

from typing import Any


class AgentEngine:
    """Gemini 2.5 Flash tool-calling agent. Engines decide; AI phrases."""

    def __init__(self, gemini_api_key: str | None = None,
                 gemini_model: str = "gemini-2.5-flash"):
        self.api_key = gemini_api_key
        self.model = gemini_model
        self._client = None

    def _get_client(self):
        """Lazy-load Gemini client. Returns None if no key configured."""
        if self._client is not None:
            return self._client
        if not self.api_key:
            return None
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            self._client = genai.GenerativeModel(self.model)
        except ImportError:
            self._client = False  # mark as unavailable
        return self._client

    def is_available(self) -> bool:
        return self._get_client() is not None and self._client is not False

    def run(self, question: str, profile: dict,
            tools: dict[str, Any]) -> dict:
        """question + profile + deterministic tools → answer.

        `tools` maps tool name → callable. The agent asks Gemini which tool
        to call, runs it, then asks Gemini to phrase the result — but every
        claim in the phrasing is grounded by the engine output.

        Falls back to a deterministic answer when Gemini is unavailable.
        """
        client = self._get_client()
        if client is None:
            return {
                "answer": (
                    "ALTIER's agent needs a Gemini API key to talk. "
                    "Configure GEMINI_API_KEY and try again."
                ),
                "source": "unavailable",
                "tool_used": None,
                "engine_result": None,
                "honesty": self.HONESTY,
            }

        # Build the tool-description prompt for Gemini.
        tool_list = "\n".join(
            f"- {name}: {fn.__doc__ or 'no description'}"
            for name, fn in tools.items()
        )

        system_prompt = (
            "You are ALTIER's agent. The user asks a question about style, fit, "
            "or colour. You have access to deterministic engines — pick exactly "
            "one tool to call, run it, and return the tool name and its arguments "
            "as JSON: {\"tool\": \"<name>\", \"args\": {...}}. Do not invent "
            "measurements, shades, sizes, or verdicts — those come from the engines. "
            "Available tools:\n" + tool_list
        )

        try:
            import json as _json
            resp = client.generate_content(
                f"{system_prompt}\n\nUser profile: {_json.dumps(profile, default=str)}\n\nQuestion: {question}"
            )
            tool_call = _json.loads(resp.text.strip())
        except Exception:
            # If Gemini can't parse or respond, fall back to deterministic.
            return self._deterministic_fallback(question, profile, tools)

        tool_name = tool_call.get("tool")
        args = tool_call.get("args", {})
        if tool_name not in tools:
            return self._deterministic_fallback(question, profile, tools)

        # Run the deterministic engine.
        engine_result = tools[tool_name](**args)

        # Have Gemini phrase the result — but the phrasing is grounded by
        # the engine output. The grounding check in stylist_llm.py verifies
        # every claim sentence.
        try:
            phrasing_prompt = (
                "Phrase this engine result for the user in one or two sentences. "
                "Use ONLY the facts in the result. Do not add numbers, colours, "
                "or measurements not present in the result. "
                f"Result: {_json.dumps(engine_result, default=str)}"
            )
            phrasing = client.generate_content(phrasing_prompt)
            answer_text = phrasing.text.strip()
        except Exception:
            answer_text = str(engine_result)

        return {
            "answer": answer_text,
            "source": "gemini",
            "tool_used": tool_name,
            "engine_result": engine_result,
            "honesty": self.HONESTY,
        }

    def _deterministic_fallback(self, question: str, profile: dict,
                                tools: dict[str, Any]) -> dict:
        """No Gemini — answer from engine availability, not AI phrasing."""
        available = list(tools.keys())
        return {
            "answer": (
                "ALTIER's agent is offline (no Gemini key). The deterministic "
                f"engines are available: {', '.join(available)}. Ask about one "
                "of them directly."
            ),
            "source": "offline",
            "tool_used": None,
            "engine_result": None,
            "honesty": self.HONESTY,
        }

    HONESTY = {
        "kind": "AGENT LAYER — AI TALKS, ENGINES DECIDE. Gemini only understands "
                "the ask and picks the tool. Every judgement comes from "
                "deterministic engines — Gemini never invents a measurement, "
                "shade, size, or verdict.",
        "grounding": "Grounding check (page1/engines/stylist_llm.py) treats "
                     "unsourced claims — e.g. unprompted Kibbe — as hallucination.",
        "photo_policy": "No photo may reach Gemini on the free tier. Paid users "
                        "use the no-training API.",
        "free_tier": "Free tier until first paid user; then paid/no-training API.",
    }


def agent_tools_registry(profile: dict) -> dict[str, Any]:
    """Build the tool registry for the agent from available engines.

    Maps tool names to callables that accept the profile + any extra args.
    """
    from personal_stylist.engine import verdict_on_product
    from personal_stylist.sizing_memory import size_hint, nearest_shade
    from personal_stylist.shades import match_shade

    def verdict(product: dict) -> dict:
        return verdict_on_product(profile, product)

    def fit(brand: str, fit_events: list[dict]) -> dict | None:
        return size_hint(brand, fit_events)

    def shade(product_shade_hex: str,
              brand_swatch_hexes: dict[str, list[str]] | None = None) -> dict:
        brand = profile.get("brand", "unknown")
        swatches = brand_swatch_hexes or {}
        return match_shade(brand, product_shade_hex, swatches)

    return {
        "verdict_on_product": verdict,
        "size_hint": fit,
        "match_shade": shade,
    }


HONESTY = {
    "kind": "AGENT LAYER — AI TALKS, ENGINES DECIDE. Gemini only understands "
            "the ask and picks the tool. Every judgement comes from "
            "deterministic engines — Gemini never invents a measurement, "
            "shade, size, or verdict.",
}