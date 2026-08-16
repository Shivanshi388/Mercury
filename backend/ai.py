"""
ai.py
-----
The AI/Persona Engine. This is the only file Member 3's backend (main.py /
scoring.py) needs to import from.

Public interface:
    simulate(product, region_ids=None) -> list[dict]

Each dict in the returned list always matches this fixed shape, regardless of
which persona produced it:

    {
        "region_id":           "india",
        "region":               "India",
        "city":                 "Bangalore",
        "persona_name":         "Priya Sharma",
        "reaction":             str,
        "top_concern":          str,
        "price_sensitivity":    int,   # 1-10
        "purchase_probability": int,   # 0-100
        "feedback":             str,
    }

That fixed structure is the contract with Member 3 and Member 4 — don't change
key names without telling them, since MarketMap.jsx / Charts.jsx / scoring.py
will all read these fields directly.

Setup:
    pip install anthropic
    export ANTHROPIC_API_KEY=sk-ant-...
"""

import os
import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

import anthropic

from prompts import PERSONAS, PERSONAS_BY_ID, build_user_message

logger = logging.getLogger("ai_engine")

MODEL = "claude-sonnet-5"
MAX_TOKENS = 1000
MAX_RETRIES = 2  # retries per persona if the model returns unparsable JSON

_client = None


def get_client() -> anthropic.Anthropic:
    """Lazily creates the Anthropic client so importing this module doesn't
    fail just because the API key isn't set yet (useful for tests/imports)."""
    global _client
    if _client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY is not set. Run `export ANTHROPIC_API_KEY=sk-ant-...` "
                "before starting the backend."
            )
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


def _clean_json_text(raw: str) -> str:
    """Strips markdown code fences in case the model wraps its JSON anyway."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    return cleaned.strip()


REQUIRED_FIELDS = {
    "reaction": str,
    "top_concern": str,
    "price_sensitivity": int,
    "purchase_probability": int,
    "feedback": str,
}


def _validate(parsed: dict) -> dict:
    """Validates and coerces a parsed persona response into the fixed schema.
    Raises ValueError if a required field is missing or the wrong type."""
    result = {}
    for field, expected_type in REQUIRED_FIELDS.items():
        if field not in parsed:
            raise ValueError(f"missing field '{field}'")
        value = parsed[field]
        if expected_type is int:
            value = int(value)
            if field == "price_sensitivity":
                value = max(1, min(10, value))
            if field == "purchase_probability":
                value = max(0, min(100, value))
        else:
            value = str(value)
        result[field] = value
    return result


def _call_persona(persona: dict, user_message: str) -> dict:
    """Calls the model once for a single persona and returns the validated
    result dict (fixed schema, see module docstring). Retries on malformed
    JSON up to MAX_RETRIES times before falling back to a neutral response."""
    client = get_client()
    last_error = None

    for attempt in range(MAX_RETRIES + 1):
        try:
            response = client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=persona["system"],
                messages=[{"role": "user", "content": user_message}],
            )
            raw_text = "".join(
                block.text for block in response.content if block.type == "text"
            )
            cleaned = _clean_json_text(raw_text)
            parsed = json.loads(cleaned)
            validated = _validate(parsed)
            break
        except Exception as e:  # malformed JSON, missing field, network error, etc.
            last_error = e
            logger.warning(
                "persona=%s attempt=%s failed: %s", persona["id"], attempt, e
            )
            validated = None

    if validated is None:
        logger.error(
            "persona=%s failed after %s attempts, returning fallback. last_error=%s",
            persona["id"], MAX_RETRIES + 1, last_error,
        )
        validated = {
            "reaction": "No response could be generated for this persona.",
            "top_concern": "N/A",
            "price_sensitivity": 5,
            "purchase_probability": 0,
            "feedback": "N/A",
        }

    return {
        "region_id": persona["id"],
        "region": persona["country"],
        "city": persona["city"],
        "persona_name": persona["name"],
        **validated,
    }


def simulate(product: dict, region_ids: list = None) -> list:
    """
    Main entry point for Member 3's backend.

    Args:
        product: dict with keys name, category, price, target_customer, description
                 (this is exactly what POST /simulate should receive from React).
        region_ids: optional list of persona ids to run, e.g. ["india", "usa"].
                     If None, runs all personas in PERSONAS.

    Returns:
        list[dict], one entry per persona, in the fixed schema described in
        the module docstring. Order matches the order personas were requested in.
    """
    if region_ids:
        unknown = [r for r in region_ids if r not in PERSONAS_BY_ID]
        if unknown:
            raise ValueError(f"unknown region_ids: {unknown}")
        personas = [PERSONAS_BY_ID[r] for r in region_ids]
    else:
        personas = PERSONAS

    user_message = build_user_message(product)

    results = {}
    with ThreadPoolExecutor(max_workers=len(personas)) as pool:
        future_to_id = {
            pool.submit(_call_persona, persona, user_message): persona["id"]
            for persona in personas
        }
        for future in as_completed(future_to_id):
            region_id = future_to_id[future]
            results[region_id] = future.result()

    # return in the same order personas were requested
    return [results[p["id"]] for p in personas]
