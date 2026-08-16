"""
Mercury - Member 3 Backend/API

FastAPI service that connects the React frontend to the AI simulation
and scoring layer.

Run:
    uvicorn main:app --reload --port 8000

API:
    GET  /health
    POST /simulate
    GET  /docs
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict

from scoring import calculate_scores, normalize_simulation_input


# ---------------------------------------------------------------------------
# App configuration
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Mercury Simulation API",
    description="Backend API connecting the Mercury React frontend to AI personas and scoring.",
    version="1.0.0",
)

# During local development, allow the React dev server to call the API.
# For production, replace "*" with the exact frontend origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class SimulationRequest(BaseModel):
    """
    Flexible request model so this backend can be combined with an existing
    React frontend without forcing one exact form shape.
    """

    model_config = ConfigDict(extra="allow")

    product_name: str = Field(default="Unnamed Product")
    product_description: str = Field(default="")
    category: str = Field(default="General")
    price: Optional[float] = Field(default=None, ge=0)
    currency: str = Field(default="USD")
    target_audience: str = Field(default="")
    business_stage: str = Field(default="")
    regions: List[str] = Field(default_factory=list)
    countries: List[str] = Field(default_factory=list)
    business_size: str = Field(default="")
    production_capacity: Optional[float] = Field(default=None, ge=0)
    budget: Optional[float] = Field(default=None, ge=0)

    # Accept a frontend-provided list of persona objects if available.
    personas: List[Dict[str, Any]] = Field(default_factory=list)

    # Optional generic market data supplied by the frontend.
    market_data: Dict[str, Any] = Field(default_factory=dict)


class PersonaResponse(BaseModel):
    region: str
    persona_name: str
    profile: str
    reaction: str
    purchase_intent: int = Field(ge=0, le=100)
    price_fit: int = Field(ge=0, le=100)
    demand: int = Field(ge=0, le=100)
    competition: int = Field(ge=0, le=100)
    risk: int = Field(ge=0, le=100)
    feedback: str


class SimulationResponse(BaseModel):
    success: bool
    product: Dict[str, Any]
    results: List[Dict[str, Any]]
    summary: Dict[str, Any]
    ai_used: bool


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

DEFAULT_REGIONS = ["India", "United Arab Emirates", "United States", "Germany"]

REGION_PROFILES: Dict[str, Dict[str, Any]] = {
    "india": {
        "income": 55,
        "demand": 75,
        "competition": 65,
        "price_sensitivity": 78,
        "digital_adoption": 72,
    },
    "united arab emirates": {
        "income": 88,
        "demand": 78,
        "competition": 70,
        "price_sensitivity": 42,
        "digital_adoption": 90,
    },
    "uae": {
        "income": 88,
        "demand": 78,
        "competition": 70,
        "price_sensitivity": 42,
        "digital_adoption": 90,
    },
    "united states": {
        "income": 92,
        "demand": 84,
        "competition": 82,
        "price_sensitivity": 45,
        "digital_adoption": 93,
    },
    "usa": {
        "income": 92,
        "demand": 84,
        "competition": 82,
        "price_sensitivity": 45,
        "digital_adoption": 93,
    },
    "germany": {
        "income": 89,
        "demand": 76,
        "competition": 76,
        "price_sensitivity": 50,
        "digital_adoption": 88,
    },
}

def _clean_region(value: Any) -> str:
    region = str(value).strip()
    return region if region else "Unknown Region"


def _selected_regions(payload: SimulationRequest) -> List[str]:
    raw = payload.regions or payload.countries
    if not raw:
        raw = DEFAULT_REGIONS

    # Keep order while removing duplicates.
    result: List[str] = []
    seen = set()
    for item in raw:
        region = _clean_region(item)
        key = region.lower()
        if key not in seen:
            seen.add(key)
            result.append(region)
    return result[:20]


def _env_number(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _fallback_persona(region: str, payload: SimulationRequest) -> Dict[str, Any]:
    """
    Deterministic fallback when no AI API key is configured or an AI request
    fails. This keeps the demo usable offline.
    """
    profile = REGION_PROFILES.get(region.lower(), {
        "income": 70,
        "demand": 70,
        "competition": 65,
        "price_sensitivity": 55,
        "digital_adoption": 75,
    })

    base_demand = profile["demand"]
    if payload.category:
        category_bonus = 4 if len(payload.category.strip()) >= 3 else 0
        base_demand = min(100, base_demand + category_bonus)

    price_fit = 70
    if payload.price is not None:
        # A simple demo heuristic: lower prices generally fit more
        # price-sensitive markets, while higher-income markets tolerate them.
        relative = profile["income"] - profile["price_sensitivity"]
        price_fit = max(35, min(95, 65 + relative // 2))

    purchase_intent = round(
        0.45 * base_demand
        + 0.35 * price_fit
        + 0.20 * profile["digital_adoption"]
    )

    feedback = (
        f"Potential customers in {region} show {purchase_intent}% estimated "
        f"purchase intent. Consider localizing pricing, positioning, and messaging "
        f"before launch."
    )

    return {
        "region": region,
        "persona_name": f"{region} Market Persona",
        "profile": (
            f"Representative customer profile for {region}, considering local "
            f"purchasing power, demand, digital adoption, and price sensitivity."
        ),
        "reaction": (
            f"The persona is moderately interested in {payload.product_name}. "
            f"Interest increases when the product's value is clearly communicated."
        ),
        "purchase_intent": int(purchase_intent),
        "price_fit": int(price_fit),
        "demand": int(base_demand),
        "competition": int(profile["competition"]),
        "risk": int(max(10, 100 - purchase_intent)),
        "feedback": feedback,
    }


def _extract_json(text: str) -> Any:
    """Extract JSON from plain JSON or a markdown code block."""
    text = text.strip()

    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"(\[.*\]|\{.*\})", text, flags=re.DOTALL)
        if not match:
            raise ValueError("AI response did not contain valid JSON.")
        return json.loads(match.group(1))


def _call_gemini(prompt: str) -> Optional[List[Dict[str, Any]]]:
    """
    Calls Gemini using the REST API only when GEMINI_API_KEY is configured.

    This avoids making the API key visible to the React frontend.
    If the key is missing or the request fails, the caller uses the
    deterministic fallback personas.
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None

    # Keep the model configurable so the team can change it without editing code.
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    endpoint = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )

    request_body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.4,
            "responseMimeType": "application/json",
        },
    }

    # Standard library HTTP keeps installation simple.
    from urllib.request import Request, urlopen
    from urllib.error import HTTPError, URLError

    request = Request(
        endpoint,
        data=json.dumps(request_body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=30) as response:
            raw = response.read().decode("utf-8")
        data = json.loads(raw)
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = _extract_json(text)
        if isinstance(parsed, dict):
            parsed = parsed.get("personas", [])
        if not isinstance(parsed, list):
            raise ValueError("Expected a JSON list of personas.")
        return parsed
    except (HTTPError, URLError, KeyError, IndexError, ValueError, json.JSONDecodeError):
        return None


def _generate_ai_personas(
    payload: SimulationRequest,
    regions: List[str],
) -> Optional[List[Dict[str, Any]]]:
    """Generate all regional personas in one AI request."""
    product = {
        "name": payload.product_name,
        "description": payload.product_description,
        "category": payload.category,
        "price": payload.price,
        "currency": payload.currency,
        "target_audience": payload.target_audience,
        "business_stage": payload.business_stage,
    }

    prompt = f"""
You are the regional customer simulation engine for Mercury, an AI-powered
market expansion simulator.

Simulate one representative customer persona for each requested region.
These are simulated personas, NOT real people and NOT actual survey results.

PRODUCT:
{json.dumps(product, ensure_ascii=False)}

REGIONS:
{json.dumps(regions, ensure_ascii=False)}

Return ONLY valid JSON in this exact shape:
{{
  "personas": [
    {{
      "region": "string",
      "persona_name": "string",
      "profile": "short string",
      "reaction": "short customer-style reaction",
      "purchase_intent": 0,
      "price_fit": 0,
      "demand": 0,
      "competition": 0,
      "risk": 0,
      "feedback": "short actionable feedback"
    }}
  ]
}}

Rules:
- Every score must be an integer from 0 to 100.
- purchase_intent and demand are higher when the product appears more attractive.
- price_fit is higher when the stated price seems appropriate for the region.
- competition is higher when competition is likely to be stronger.
- risk is higher when entry appears harder or less certain.
- Keep feedback concise and practical.
- Do not claim the simulated responses are real customer research.
"""

    return _call_gemini(prompt)


def _merge_and_validate_personas(
    regions: List[str],
    ai_personas: Optional[List[Dict[str, Any]]],
    payload: SimulationRequest,
) -> tuple[List[Dict[str, Any]], bool]:
    by_region: Dict[str, Dict[str, Any]] = {}

    if ai_personas:
        for item in ai_personas:
            if not isinstance(item, dict):
                continue
            region = _clean_region(item.get("region"))
            by_region[region.lower()] = item

    personas: List[Dict[str, Any]] = []
    ai_used = bool(ai_personas)
    used_fallback = False

    for region in regions:
        item = by_region.get(region.lower())
        if not item:
            personas.append(_fallback_persona(region, payload))
            used_fallback = True
            continue

        # Sanitize AI-generated numeric fields.
        def score(name: str, default: int = 50) -> int:
            try:
                return max(0, min(100, int(float(item.get(name, default)))))
            except (TypeError, ValueError):
                return default

        personas.append({
            "region": region,
            "persona_name": str(item.get("persona_name", f"{region} Market Persona")),
            "profile": str(item.get("profile", "")),
            "reaction": str(item.get("reaction", "")),
            "purchase_intent": score("purchase_intent"),
            "price_fit": score("price_fit"),
            "demand": score("demand"),
            "competition": score("competition"),
            "risk": score("risk"),
            "feedback": str(item.get("feedback", "")),
        })

    # Report true only when every requested region was generated by AI.
    if used_fallback:
        ai_used = False

    return personas, ai_used


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
def root() -> Dict[str, str]:
    return {
        "name": "Mercury Simulation API",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/simulate", response_model=SimulationResponse)
def simulate(payload: SimulationRequest) -> SimulationResponse:
    """
    Main endpoint used by React.

    Flow:
        React -> POST /simulate -> AI personas -> scoring -> JSON -> React
    """
    try:
        regions = _selected_regions(payload)
        normalized_input = normalize_simulation_input(payload.model_dump())

        ai_personas = _generate_ai_personas(payload, regions)
        personas, ai_used = _merge_and_validate_personas(
            regions, ai_personas, payload
        )

        results, summary = calculate_scores(
            normalized_input,
            personas,
        )

        return SimulationResponse(
            success=True,
            product=normalized_input,
            results=results,
            summary=summary,
            ai_used=ai_used,
        )
    except Exception as exc:
        # Return a clean API error instead of exposing a traceback to React.
        raise HTTPException(
            status_code=500,
            detail=f"Simulation failed: {str(exc)}",
        ) from exc
