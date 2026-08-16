"""
Mercury scoring logic.

The scoring model is intentionally transparent and easy for the team to
modify. It is not a claim of real-world statistical probability. The result is
a simulation score based on the supplied product information, persona
responses, and market indicators.
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple


def _clamp(value: float, low: float = 0, high: float = 100) -> int:
    return int(round(max(low, min(high, value))))


def _num(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def normalize_simulation_input(data: Dict[str, Any]) -> Dict[str, Any]:
    """Return a stable product object for the frontend response."""
    return {
        "product_name": str(data.get("product_name") or "Unnamed Product"),
        "product_description": str(data.get("product_description") or ""),
        "category": str(data.get("category") or "General"),
        "price": data.get("price"),
        "currency": str(data.get("currency") or "USD"),
        "target_audience": str(data.get("target_audience") or ""),
        "business_stage": str(data.get("business_stage") or ""),
        "regions": list(data.get("regions") or data.get("countries") or []),
        "business_size": str(data.get("business_size") or ""),
        "production_capacity": data.get("production_capacity"),
        "budget": data.get("budget"),
    }


def calculate_scores(
    product: Dict[str, Any],
    personas: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Calculate a region score from the simulated persona response.

    Weighting:
      - Purchase intent: 35%
      - Demand:          25%
      - Price fit:       15%
      - Competition:     10% (inverted)
      - Risk:             15% (inverted)

    This makes a high score mean "more promising", not "guaranteed success".
    """
    results: List[Dict[str, Any]] = []

    for persona in personas:
        purchase_intent = _clamp(_num(persona.get("purchase_intent"), 50))
        demand = _clamp(_num(persona.get("demand"), 50))
        price_fit = _clamp(_num(persona.get("price_fit"), 50))
        competition = _clamp(_num(persona.get("competition"), 50))
        risk = _clamp(_num(persona.get("risk"), 50))

        success_score = _clamp(
            purchase_intent * 0.35
            + demand * 0.25
            + price_fit * 0.15
            + (100 - competition) * 0.10
            + (100 - risk) * 0.15
        )

        # Scalability favors demand and purchase intent, with penalties for
        # high competition and risk.
        scalability_score = _clamp(
            demand * 0.35
            + purchase_intent * 0.30
            + price_fit * 0.15
            + (100 - competition) * 0.10
            + (100 - risk) * 0.10
        )

        market_potential = _clamp(
            demand * 0.45
            + purchase_intent * 0.35
            + price_fit * 0.20
        )

        if success_score >= 80:
            opportunity = "High"
        elif success_score >= 60:
            opportunity = "Medium"
        else:
            opportunity = "Low"

        results.append({
            "region": persona["region"],
            "persona": {
                "name": persona["persona_name"],
                "profile": persona["profile"],
                "reaction": persona["reaction"],
                "feedback": persona["feedback"],
            },
            "scores": {
                "success": success_score,
                "scalability": scalability_score,
                "market_potential": market_potential,
                "purchase_intent": purchase_intent,
                "price_fit": price_fit,
                "demand": demand,
                "competition": competition,
                "risk": risk,
            },
            "opportunity": opportunity,
        })

    results.sort(
        key=lambda item: item["scores"]["success"],
        reverse=True,
    )

    if results:
        top = results[0]
        average_success = _clamp(
            sum(r["scores"]["success"] for r in results) / len(results)
        )
        average_scalability = _clamp(
            sum(r["scores"]["scalability"] for r in results) / len(results)
        )
    else:
        top = None
        average_success = 0
        average_scalability = 0

    summary = {
        "best_region": top["region"] if top else None,
        "best_success_score": top["scores"]["success"] if top else 0,
        "average_success_score": average_success,
        "average_scalability_score": average_scalability,
        "regions_analyzed": len(results),
        "disclaimer": (
            "Scores are AI-assisted simulations, not guaranteed probabilities "
            "or substitutes for real-world market research."
        ),
    }

    return results, summary
