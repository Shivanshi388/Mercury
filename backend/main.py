"""Mercury FastAPI backend."""

from __future__ import annotations

from dotenv import load_dotenv
load_dotenv()

import json

import os
import re
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from scoring import calculate_scores, normalize_simulation_input
from scenario import apply_changes, extract_changes


app = FastAPI(
    title="Mercury Simulation API",
    description="AI-assisted market simulation and natural-language what-if scenarios.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# MODELS
# ============================================================

class SimulationRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    product_name: str = "Unnamed Product"
    product_description: str = ""
    category: str = "General"
    price: Optional[float] = Field(default=None, ge=0)
    currency: str = "INR"
    target_audience: str = ""
    business_stage: str = ""
    regions: List[str] = Field(default_factory=list)
    countries: List[str] = Field(default_factory=list)
    business_size: str = ""
    production_capacity: Optional[float] = Field(default=None, ge=0)
    budget: Optional[float] = Field(default=None, ge=0)
    personas: List[Dict[str, Any]] = Field(default_factory=list)
    market_data: Dict[str, Any] = Field(default_factory=dict)
    market_prices: List[Dict[str, Any]] = Field(default_factory=list)


class WhatIfRequest(BaseModel):
    question: str = Field(min_length=2)
    current_product: Dict[str, Any]
    regions: List[str] = Field(default_factory=list)


# ============================================================
# MARKET DATA
# ============================================================

DEFAULT_REGIONS = [
    "India",
    "United Arab Emirates",
    "United States",
    "Germany",
]

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
    "united kingdom": {
        "income": 86,
        "demand": 78,
        "competition": 78,
        "price_sensitivity": 52,
        "digital_adoption": 90,
    },
    "canada": {
        "income": 84,
        "demand": 77,
        "competition": 72,
        "price_sensitivity": 50,
        "digital_adoption": 89,
    },
    "japan": {
        "income": 82,
        "demand": 73,
        "competition": 78,
        "price_sensitivity": 56,
        "digital_adoption": 86,
    },
    "brazil": {
        "income": 55,
        "demand": 72,
        "competition": 65,
        "price_sensitivity": 76,
        "digital_adoption": 78,
    },
    "nigeria": {
        "income": 42,
        "demand": 68,
        "competition": 54,
        "price_sensitivity": 86,
        "digital_adoption": 70,
    },
    "australia": {
        "income": 88,
        "demand": 80,
        "competition": 74,
        "price_sensitivity": 48,
        "digital_adoption": 92,
    },
    "south africa": {
        "income": 48,
        "demand": 70,
        "competition": 58,
        "price_sensitivity": 72,
        "digital_adoption": 75,
    },
}


# ============================================================
# HELPERS
# ============================================================

def _clean_region(value: Any) -> str:
    value = str(value or "").strip()
    return value or "Unknown Region"


def _selected_regions(payload: SimulationRequest) -> List[str]:
    raw = payload.regions or payload.countries or DEFAULT_REGIONS

    result = []
    seen = set()

    for item in raw:
        region = _clean_region(item)

        if region.lower() not in seen:
            seen.add(region.lower())
            result.append(region)

    return result[:20]


# ============================================================
# FALLBACK PERSONA
# ============================================================

def _fallback_persona(
    region: str,
    payload: SimulationRequest,
) -> Dict[str, Any]:

    profile = REGION_PROFILES.get(
        region.lower(),
        {
            "income": 70,
            "demand": 70,
            "competition": 65,
            "price_sensitivity": 55,
            "digital_adoption": 75,
        },
    )

    description = payload.product_description.lower()
    target = payload.target_audience.lower()
    category = payload.category.lower()

    # Use local converted price if supplied.
    price = float(payload.price or 0)

    for market in payload.market_prices:
        if str(market.get("region", "")).lower() == region.lower():
            try:
                price = float(market.get("price", price))
            except (TypeError, ValueError):
                pass
            break

    reference_prices_usd = {
        "consumer electronics": 120,
        "software / saas": 50,
        "health & wellness": 60,
        "beauty & personal care": 35,
        "food & beverage": 25,
        "apparel & fashion": 55,
        "home & living": 70,
    }

    reference_prices_inr = {
        "consumer electronics": 4999,
        "software / saas": 999,
        "health & wellness": 1499,
        "beauty & personal care": 799,
        "food & beverage": 499,
        "apparel & fashion": 1499,
        "home & living": 1999,
    }

    if str(payload.currency).upper() == "INR":
        refs = reference_prices_inr
    else:
        refs = reference_prices_usd

    ref = refs.get(
        category,
        999 if str(payload.currency).upper() == "INR" else 60,
    )

    price_ratio = price / max(ref, 1)

    # Price fit uses a smooth logarithmic response instead of a
    # hard linear penalty. This prevents both the current and
    # what-if prices from getting stuck at the minimum score.
    #
    # A lower price improves price fit.
    # A higher price reduces price fit.
    # The logarithmic curve keeps meaningful differences even
    # when the product is several times above the reference price.

    price_difference = abs(__import__("math").log(max(price_ratio, 0.01)))

    price_fit = 86 - (
        price_difference
        * 20
        * (profile["price_sensitivity"] / 55)
    )

    # If the price is below the reference price, give it a
    # small additional affordability advantage.
    if price_ratio < 1:
        price_fit += (1 - price_ratio) * 8

    price_fit = max(
        15,
        min(98, price_fit),
    )

    demand = profile["demand"]

    if any(
        k in description
        for k in [
            "ai",
            "analytics",
            "automation",
            "personalized",
            "recommendation",
        ]
    ):
        demand += 4 if profile["digital_adoption"] >= 80 else 2

    if "free trial" in description:
        demand += 5

    if any(
        k in target
        for k in ["student", "college", "early career"]
    ):
        if profile["price_sensitivity"] >= 65:
            demand += 4
        else:
            demand += 1

    if (
        "working professional" in target
        and profile["digital_adoption"] >= 80
    ):
        demand += 3

    if "affordability" in description or "affordable" in description:
        demand += 3

    demand = max(0, min(100, demand))

    purchase_intent = round(
        0.45 * demand
        + 0.38 * price_fit
        + 0.17 * profile["digital_adoption"]
    )

    if "free trial" in description:
        purchase_intent += 4

    risk = max(
        8,
        min(
            95,
            100
            - purchase_intent
            + profile["competition"] * 0.08,
        ),
    )

    return {
        "region": region,
        "persona_name": f"{region} Market Persona",
        "profile": (
            f"Representative customer profile for {region}, "
            "shaped by purchasing power, demand, digital adoption "
            "and price sensitivity."
        ),
        "reaction": (
            f"The simulated customer sees {purchase_intent}% "
            f"purchase intent for {payload.product_name}. "
            "The strongest lever is perceived value versus price."
        ),
        "purchase_intent": int(max(0, min(100, purchase_intent))),
        "price_fit": int(round(price_fit)),
        "demand": int(demand),
        "competition": int(profile["competition"]),
        "risk": int(risk),
        "feedback": (
            f"Test pricing and positioning with customers in {region}; "
            f"the simulation suggests price fit is {round(price_fit)}%."
        ),
    }


# ============================================================
# GEMINI
# ============================================================

def _extract_json(text: str) -> Any:
    text = text.strip()

    if text.startswith("```"):
        text = re.sub(
            r"^```(?:json)?\s*",
            "",
            text,
            flags=re.I,
        )
        text = re.sub(
            r"\s*```$",
            "",
            text,
        )

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(
            r"(\[.*\]|\{.*\})",
            text,
            flags=re.S,
        )

        if not match:
            raise ValueError(
                "AI response did not contain valid JSON"
            )

        return json.loads(match.group(1))


def _call_gemini(
    prompt: str,
) -> Optional[List[Dict[str, Any]]]:

    api_key = os.getenv("GEMINI_API_KEY", "").strip()

    if not api_key:
        return None

    model = os.getenv(
        "GEMINI_MODEL",
        "gemini-2.5-flash",
    )

    endpoint = (
        "https://generativelanguage.googleapis.com/"
        f"v1beta/models/{model}:generateContent"
        f"?key={api_key}"
    )

    body = {
        "contents": [
            {
                "parts": [
                    {
                        "text": prompt
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.4,
            "responseMimeType": "application/json",
        },
    }

    from urllib.request import Request, urlopen
    from urllib.error import HTTPError, URLError

    req = Request(
        endpoint,
        data=json.dumps(body).encode(),
        headers={
            "Content-Type": "application/json"
        },
        method="POST",
    )

    try:
        with urlopen(req, timeout=30) as response:
            data = json.loads(
                response.read().decode()
            )

        parsed = _extract_json(
            data["candidates"][0]["content"]["parts"][0]["text"]
        )

        if isinstance(parsed, dict):
            return parsed.get("personas", [])

        return parsed

    except (
        HTTPError,
        URLError,
        KeyError,
        IndexError,
        ValueError,
        json.JSONDecodeError,
    ):
        return None


def _generate_ai_personas(
    payload: SimulationRequest,
    regions: List[str],
) -> Optional[List[Dict[str, Any]]]:

    product = {
        "name": payload.product_name,
        "description": payload.product_description,
        "category": payload.category,
        "price": payload.price,
        "currency": payload.currency,
        "target_audience": payload.target_audience,
        "market_prices": payload.market_prices,
    }

    prompt = f"""
Simulate one representative customer persona for every requested
region for Mercury.

These are simulations, not real surveys.
Return ONLY JSON with a personas array.

PRODUCT:
{json.dumps(product, ensure_ascii=False)}

REGIONS:
{json.dumps(regions, ensure_ascii=False)}

Each persona must contain:
region,
persona_name,
profile,
reaction,
purchase_intent,
price_fit,
demand,
competition,
risk,
feedback.

All scores are integers 0-100.

Price fit must respond to the stated local market price.

When market_prices are provided, use the price and currency
corresponding to each region.

Purchase intent and demand must respond to product description,
target audience, feature set, and local price.

Do not invent survey data.
"""

    return _call_gemini(prompt)


def _merge_personas(
    regions: List[str],
    ai_personas: Optional[List[Dict[str, Any]]],
    payload: SimulationRequest,
):

    by_region = {
        str(x.get("region", "")).lower(): x
        for x in (ai_personas or [])
        if isinstance(x, dict)
    }

    personas = []
    all_ai = bool(ai_personas)

    for region in regions:

        item = by_region.get(region.lower())

        # ---------------------------------------------------------
        # IMPORTANT:
        # Always calculate the NUMERIC scores using Mercury's
        # deterministic scoring logic.
        #
        # Gemini is still used for:
        # - persona name
        # - profile
        # - reaction
        # - feedback
        #
        # This guarantees that What-if price changes actually
        # affect the simulation.
        # ---------------------------------------------------------

        fallback = _fallback_persona(region, payload)

        if not item:
            personas.append(fallback)
            all_ai = False
            continue

        personas.append(
            {
                "region": region,

                # Gemini-generated persona information
                "persona_name": str(
                    item.get(
                        "persona_name",
                        fallback["persona_name"],
                    )
                ),

                "profile": str(
                    item.get(
                        "profile",
                        fallback["profile"],
                    )
                ),

                "reaction": str(
                    item.get(
                        "reaction",
                        fallback["reaction"],
                    )
                ),

                "feedback": str(
                    item.get(
                        "feedback",
                        fallback["feedback"],
                    )
                ),

                # -------------------------------------------------
                # IMPORTANT:
                # These values MUST come from fallback.
                # They are calculated from the actual current price.
                # -------------------------------------------------
                "purchase_intent": fallback["purchase_intent"],
                "price_fit": fallback["price_fit"],
                "demand": fallback["demand"],
                "competition": fallback["competition"],
                "risk": fallback["risk"],
            }
        )

    return personas, all_ai


# ============================================================
# SIMULATION ENGINE
# ============================================================

def run_engine(
    payload: SimulationRequest,
) -> Dict[str, Any]:

    regions = _selected_regions(payload)

    normalized = normalize_simulation_input(
        payload.model_dump()
    )

    # Gemini creates the qualitative persona information.
    ai_personas = _generate_ai_personas(
        payload,
        regions,
    )

    # Mercury calculates the numeric scores deterministically.
    # This makes price, audience, features, etc. actually affect
    # the simulation.
    personas, ai_used = _merge_personas(
        regions,
        ai_personas,
        payload,
    )

    results, summary = calculate_scores(
        normalized,
        personas,
    )

    return {
        "success": True,
        "product": normalized,
        "results": results,
        "summary": summary,
        "ai_used": ai_used,
    }

def _to_payload(
    data: Dict[str, Any],
    regions: List[str],
) -> SimulationRequest:

    mapped = {
        "product_name": data.get(
            "product_name",
            data.get("name", "Unnamed Product"),
        ),
        "product_description": data.get(
            "product_description",
            data.get("description", ""),
        ),
        "category": data.get(
            "category",
            "General",
        ),
        "price": data.get("price"),
        "currency": data.get(
            "currency",
            "INR",
        ),
        "target_audience": data.get(
            "target_audience",
            data.get("targetCustomer", ""),
        ),
        "regions": (
            regions
            or data.get("regions")
            or data.get("countries")
            or DEFAULT_REGIONS
        ),
        "business_stage": data.get(
            "business_stage",
            "",
        ),
        "business_size": data.get(
            "business_size",
            "",
        ),
        "production_capacity": data.get(
            "production_capacity"
        ),
        "budget": data.get("budget"),
        "market_prices": data.get(
            "market_prices",
            [],
        ),
    }

    return SimulationRequest(**mapped)


# ============================================================
# BASIC ENDPOINTS
# ============================================================

@app.get("/")
def root():
    return {
        "name": "Mercury Simulation API",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "ok"}


# ============================================================
# CURRENCY CONVERSION
# ============================================================

@app.get("/convert-currency")
def convert_currency(
    amount: float,
    from_currency: str,
    to_currency: str,
):
    """
    Convert currency using the Frankfurter API.

    Example:
    /convert-currency?amount=100&from_currency=ZAR&to_currency=INR
    """

    from_currency = from_currency.upper().strip()
    to_currency = to_currency.upper().strip()

    if amount < 0:
        raise HTTPException(
            status_code=400,
            detail="Amount cannot be negative.",
        )

    if from_currency == to_currency:
        return {
            "amount": amount,
            "from_currency": from_currency,
            "to_currency": to_currency,
            "converted_amount": amount,
        }

    params = urllib.parse.urlencode(
        {
            "amount": amount,
            "from": from_currency,
            "to": to_currency,
        }
    )

    url = (
        "https://api.frankfurter.app/latest?"
        + params
    )

    try:
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mercury/2.0",
                "Accept": "application/json",
            },
        )

        with urllib.request.urlopen(
            request,
            timeout=10,
        ) as response:

            data = json.loads(
                response.read().decode()
            )

        rates = data.get("rates", {})

        converted_amount = rates.get(
            to_currency
        )

        if converted_amount is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Currency {to_currency} is not "
                    "supported by the exchange-rate service."
                ),
            )

        return {
            "amount": amount,
            "from_currency": from_currency,
            "to_currency": to_currency,
            "converted_amount": converted_amount,
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Unable to fetch exchange rate: {exc}",
        ) from exc


# ============================================================
# SIMULATE
# ============================================================

@app.post("/simulate")
def simulate(
    payload: SimulationRequest,
):

    try:
        return run_engine(payload)

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Simulation failed: {exc}",
        ) from exc


# ============================================================
# WHAT-IF
# ============================================================

@app.post("/what-if")
def what_if(
    request: WhatIfRequest,
):

    try:

        current = dict(
            request.current_product
        )

        current["regions"] = (
            request.regions
            or current.get("regions")
            or DEFAULT_REGIONS
        )

        current_payload = _to_payload(
            current,
            current["regions"],
        )

        comparative = (
            len(
                re.findall(
                    r"(?:₹|rs\.?|inr|\$|usd|€|eur)?\s*[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?",
                    request.question,
                    re.I,
                )
            )
            >= 2
            and any(
                word in request.question.lower()
                for word in [
                    "which",
                    "better",
                    "perform",
                ]
            )
        )

        if comparative:

            extracted = {
                "changes": [],
                "label": "Price alternatives",
            }

            modified_dict = dict(current)
            ui_changes = []

        else:

            extracted = extract_changes(
                request.question,
                current,
            )

            modified_dict, ui_changes = apply_changes(
                current,
                extracted,
            )

        modified_dict["regions"] = current["regions"]

        modified_payload = _to_payload(
            modified_dict,
            current["regions"],
        )

        original = run_engine(
            current_payload
        )

        modified = run_engine(
            modified_payload
        )

        # ----------------------------------------------------
        # PRICE ALTERNATIVES
        # ----------------------------------------------------

        alternatives = []

        money_values = re.findall(
            r"(?:₹|rs\.?|inr|\$|usd|€|eur)?\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)",
            request.question,
            re.I,
        )

        numeric_prices = []

        for raw in money_values:

            try:

                value = float(
                    raw.replace(",", "")
                )

                if value not in numeric_prices:
                    numeric_prices.append(value)

            except ValueError:
                pass

        if (
            len(numeric_prices) >= 2
            and any(
                word in request.question.lower()
                for word in [
                    "which",
                    "better",
                    "perform",
                ]
            )
        ):

            for price in numeric_prices[:3]:

                alt = dict(current)
                alt["price"] = price

                alt_result = run_engine(
                    _to_payload(
                        alt,
                        current["regions"],
                    )
                )

                alternatives.append(
                    {
                        "price": price,
                        "result": alt_result,
                    }
                )

            winner = max(
                alternatives,
                key=lambda x: x["result"]["summary"].get(
                    "average_success_score",
                    0,
                ),
            )

            modified = winner["result"]

            modified_dict["price"] = (
                winner["price"]
            )

            ui_changes = [
                {
                    "field": "price",
                    "label": "Winning price",
                    "from": str(
                        current.get("price")
                    ),
                    "to": str(
                        winner["price"]
                    ),
                }
            ]

        # ----------------------------------------------------
        # DELTAS
        # ----------------------------------------------------

        metric_deltas = {}

        for key in [
            "average_success_score",
            "average_scalability_score",
        ]:

            metric_deltas[key] = (
                modified["summary"].get(
                    key,
                    0,
                )
                - original["summary"].get(
                    key,
                    0,
                )
            )

        explanation = build_explanation(
            ui_changes,
            original,
            modified,
        )

        return {
            "success": True,
            "changes": ui_changes,
            "scenario": {
                "label": extracted.get(
                    "label",
                    "What-if scenario",
                )
            },
            "original": original,
            "modified": modified,
            "metric_deltas": metric_deltas,
            "alternatives": alternatives,
            "explanation": explanation,
        }

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=f"What-if simulation failed: {exc}",
        ) from exc


# ============================================================
# EXPLANATION
# ============================================================

def build_explanation(
    changes,
    original,
    modified,
) -> str:

    old = original["summary"].get(
        "average_success_score",
        0,
    )

    new = modified["summary"].get(
        "average_success_score",
        0,
    )

    delta = new - old

    direction = (
        "improves"
        if delta > 0
        else "reduces"
        if delta < 0
        else "does not materially change"
    )

    change_text = "; ".join(
        f"{c['label']} {c['from']} → {c['to']}"
        for c in changes
    )

    top = (
        modified["summary"].get(
            "best_region"
        )
        or "the tested markets"
    )

    return (
        f"Mercury simulated the requested changes "
        f"({change_text}) using the same engine as "
        f"the current scenario. "
        f"The average market success score changes "
        f"from {old} to {new} ({delta:+d}), so the "
        f"scenario {direction} overall fit. "
        f"The strongest modified market is {top}. "
        f"These are simulated decision-support scores, "
        f"not guaranteed outcomes."
    )


# ============================================================
# AI PRODUCT IMAGE GENERATION
# ============================================================

class ImageGenerationRequest(BaseModel):
    product_name: str = ""
    product_description: str = ""
    category: str = "General"


@app.post("/generate-product-image")
def generate_product_image(payload: ImageGenerationRequest):

    api_key = os.getenv("GEMINI_API_KEY", "").strip()

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is not configured."
        )

    model = "gemini-2.5-flash-image"

    endpoint = (
        "https://generativelanguage.googleapis.com/"
        f"v1beta/models/{model}:generateContent"
        f"?key={api_key}"
    )

    prompt = f"""
Create a professional product photograph for a market simulation
platform.

PRODUCT NAME:
{payload.product_name}

DESCRIPTION:
{payload.product_description}

CATEGORY:
{payload.category}

Create a clean, realistic commercial product visual.
Show only the product and a simple premium background.
Do not include advertisements, logos, fake statistics,
or additional products.
"""

    body = {
        "contents": [
            {
                "parts": [
                    {
                        "text": prompt
                    }
                ]
            }
        ],
        "generationConfig": {
            "responseModalities": ["IMAGE", "TEXT"]
        }
    }

    from urllib.request import Request, urlopen
    from urllib.error import HTTPError, URLError
    import base64

    req = Request(
        endpoint,
        data=json.dumps(body).encode(),
        headers={
            "Content-Type": "application/json"
        },
        method="POST",
    )

    try:
        with urlopen(req, timeout=60) as response:
            data = json.loads(response.read().decode())

        parts = (
            data
            .get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [])
        )

        for part in parts:
            inline_data = part.get("inlineData")

            if inline_data:
                mime_type = inline_data.get(
                    "mimeType",
                    "image/png"
                )

                image_data = inline_data.get("data")

                return {
                    "image": (
                        f"data:{mime_type};base64,{image_data}"
                    )
                }

        raise HTTPException(
            status_code=500,
            detail="Gemini did not return an image."
        )

    except HTTPError as e:
        error_body = e.read().decode(
            errors="ignore"
        )

        raise HTTPException(
            status_code=e.code,
            detail=f"Gemini error: {error_body}"
        )

    except (URLError, KeyError, IndexError, ValueError) as e:
        raise HTTPException(
            status_code=500,
            detail=f"Image generation failed: {str(e)}"
        )