"""Natural-language what-if extraction for Mercury.

The LLM is optional. If GEMINI_API_KEY is unavailable, a deterministic parser
handles the common hackathon demo questions so the feature still works offline.
"""
from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple

from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

COUNTRY_ALIASES = {
    "india": "India", "indian": "India", "us": "United States", "usa": "United States",
    "united states": "United States", "america": "United States", "uk": "United Kingdom",
    "united kingdom": "United Kingdom", "germany": "Germany", "france": "France",
    "japan": "Japan", "china": "China", "canada": "Canada", "brazil": "Brazil",
    "uae": "UAE", "united arab emirates": "UAE", "nigeria": "Nigeria", "australia": "Australia",
}


def _extract_json(text: str) -> Dict[str, Any]:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.I)
    text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, flags=re.S)
        if not match:
            raise ValueError("No JSON object in AI response")
        return json.loads(match.group(0))


def _call_gemini(question: str, current: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        return None
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    prompt = f"""
You are Mercury's what-if change extractor. Convert a product owner's natural-language
question into structured changes. Do NOT calculate simulation results.

CURRENT PRODUCT:
{json.dumps(current, ensure_ascii=False)}

QUESTION:
{question}

Return ONLY JSON:
{{
  "changes": [
    {{"field":"price|target_audience|product_description|category|currency", "operation":"set|multiply|append|remove", "value": "..."}}
  ],
  "label": "short scenario name"
}}

Rules:
- "20% cheaper" => field price, operation multiply, value 0.8
- "increase price by 20%" => multiply, value 1.2
- "price to 799" => set, value 799
- target/audience/college students => target_audience set
- "add a 7-day free trial" => product_description append the feature
- "remove analytics/AI feature" => product_description remove that phrase
- Multiple requested changes must all appear.
- Never invent values that are not supported by the question.
"""
    body = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}}
    request = Request(endpoint, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(request, timeout=20) as response:
            data = json.loads(response.read().decode())
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        return _extract_json(text)
    except (HTTPError, URLError, KeyError, IndexError, ValueError, json.JSONDecodeError):
        return None


def _money(text: str) -> Optional[float]:
    m = re.search(r"(?:₹|rs\.?|inr|\$|usd|€|eur)?\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)", text, re.I)
    if not m:
        return None
    return float(m.group(1).replace(",", ""))


def _country(text: str) -> Optional[str]:
    lower = text.lower()
    for alias, canonical in sorted(COUNTRY_ALIASES.items(), key=lambda x: -len(x[0])):
        if re.search(rf"\b{re.escape(alias)}\b", lower):
            return canonical
    return None


def deterministic_extract(question: str, current: Dict[str, Any]) -> Dict[str, Any]:
    q = question.lower().strip()
    changes: List[Dict[str, Any]] = []

    absolute_price = None
    if re.search(r"(?:price|cost|charge|make it|set it)\D{0,25}(?:₹|rs\.?|inr|\$|usd|€|eur)?\s*[0-9][0-9,]*(?:\.[0-9]+)?", q):
        absolute_price = _money(q)
    if absolute_price is not None and any(word in q for word in ["price", "cost", "charge", "set it", "make it"]):
        changes.append({"field": "price", "operation": "set", "value": absolute_price})
    else:
        pct = re.search(r"(\d+(?:\.\d+)?)\s*%", q)
        if pct and any(w in q for w in ["price", "cheaper", "lower", "reduce", "decrease", "increase", "raise", "higher", "expensive"]):
            amount = float(pct.group(1)) / 100
            multiplier = 1 - amount if any(w in q for w in ["cheaper", "lower", "reduce", "decrease"]) else 1 + amount
            changes.append({"field": "price", "operation": "multiply", "value": multiplier})

    audience_match = re.search(r"(?:target|targeting|audience|customers?)\s+(?:at|on|for)?\s*(?:college students?|students?|working professionals?|professionals?|[a-z][a-z -]{2,40})(?:\s+instead)?", q)
    if audience_match:
        phrase = audience_match.group(0)
        phrase = re.sub(r"^(?:target|targeting|audience|customers?)\s+(?:at|on|for)?\s*", "", phrase, flags=re.I)
        phrase = re.sub(r"\s+instead$", "", phrase, flags=re.I).strip()
        if phrase and phrase not in {"it", "the", "my"}:
            changes.append({"field": "target_audience", "operation": "set", "value": phrase.title()})
    elif "college students" in q or "students" in q:
        changes.append({"field": "target_audience", "operation": "set", "value": "College Students"})
    elif "working professionals" in q:
        changes.append({"field": "target_audience", "operation": "set", "value": "Working Professionals"})

    if "free trial" in q:
        m = re.search(r"(\d+)\s*-?\s*day\s+free trial", q)
        days = m.group(1) if m else "7"
        changes.append({"field": "product_description", "operation": "append", "value": f"{days}-day free trial"})

    for feature in ["analytics", "ai recommendations", "ai feature", "recommendations", "dashboard"]:
        if feature in q and any(w in q for w in ["remove", "without", "drop", "take away", "disable"]):
            changes.append({"field": "product_description", "operation": "remove", "value": feature})

    desc_match = re.search(r"(?:description|positioning|messaging).*?(?:as|on|to focus on)\s+(.+)$", question, re.I)
    if desc_match:
        changes.append({"field": "product_description", "operation": "append", "value": f"Positioning focus: {desc_match.group(1).strip()}"})
    elif "focus on affordability" in q or "affordability" in q:
        changes.append({"field": "product_description", "operation": "append", "value": "Positioning focus: affordability"})

    country = _country(question)
    if country:
        changes.append({"field": "target_audience", "operation": "append", "value": f"Primary geography: {country}"})

    # De-duplicate exact changes.
    unique = []
    seen = set()
    for c in changes:
        key = json.dumps(c, sort_keys=True)
        if key not in seen:
            seen.add(key); unique.append(c)

    if not unique:
        raise ValueError("I couldn't identify a product change. Try a price, audience, feature, trial, description, or country change.")

    return {"changes": unique, "label": _label_from_changes(unique)}


def _label_from_changes(changes: List[Dict[str, Any]]) -> str:
    parts = []
    for c in changes:
        if c["field"] == "price":
            
            if c['operation'] == 'set':
                parts.append(f"Price {c['value']}")
            else:
                parts.append(f"Price ×{float(c['value']):.2f}")
        elif c["field"] == "target_audience":
            parts.append(f"Target: {c['value']}")
        elif c["operation"] == "remove":
            parts.append(f"Remove {c['value']}")
        else:
            parts.append(str(c["value"]))
    return " + ".join(parts)[:90]


def extract_changes(question: str, current: Dict[str, Any]) -> Dict[str, Any]:
    ai = _call_gemini(question, current)
    if ai and isinstance(ai.get("changes"), list) and ai["changes"]:
        return ai
    return deterministic_extract(question, current)


def apply_changes(current: Dict[str, Any], extracted: Dict[str, Any]) -> Tuple[Dict[str, Any], List[Dict[str, str]]]:
    modified = dict(current)
    changes_for_ui = []
    for change in extracted.get("changes", []):
        field = change.get("field")
        op = change.get("operation", "set")
        value = change.get("value")
        if field not in modified:
            continue
        old = modified.get(field)
        if field == "price":
            old_num = float(old or 0)
            if op == "multiply": new = round(old_num * float(value), 2)
            else: new = float(value)
            modified[field] = new
            changes_for_ui.append({"field": field, "label": "Price", "from": f"{old_num:g}", "to": f"{new:g}"})
        elif field == "product_description":
            old_text = str(old or "")
            if op == "remove":
                pattern = re.compile(re.escape(str(value)), re.I)
                new = pattern.sub("", old_text).replace("  ", " ").strip()
            else:
                new = f"{old_text} {value}".strip()
            modified[field] = new
            changes_for_ui.append({"field": field, "label": "Description", "from": "Current", "to": str(value)})
        elif field == "target_audience":
            old_text = str(old or "")
            if op == "append": new = f"{old_text}; {value}".strip('; ')
            else: new = str(value)
            modified[field] = new
            changes_for_ui.append({"field": field, "label": "Target", "from": old_text or "Current", "to": new})
        else:
            old_text = str(old or "")
            modified[field] = value
            changes_for_ui.append({"field": field, "label": field.replace('_', ' ').title(), "from": old_text, "to": str(value)})
    return modified, changes_for_ui
