from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

PRODUCT = {
    "product_name": "Mercury Demo",
    "product_description": "AI recommendations + analytics",
    "category": "Software / SaaS",
    "price": 999,
    "currency": "INR",
    "target_audience": "Working Professionals",
    "regions": ["India", "United States"],
}


def test_price_what_if_uses_same_engine():
    response = client.post("/what-if", json={
        "question": "What if I reduce the price to ₹799?",
        "current_product": PRODUCT,
        "regions": PRODUCT["regions"],
    })
    assert response.status_code == 200
    data = response.json()
    assert data["changes"][0]["to"] == "799"
    assert data["original"]["summary"]["average_success_score"] != data["modified"]["summary"]["average_success_score"]


def test_multiple_changes():
    response = client.post("/what-if", json={
        "question": "What if I reduce the price to ₹799, remove analytics and target college students?",
        "current_product": PRODUCT,
        "regions": PRODUCT["regions"],
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data["changes"]) == 3
    assert data["modified"]["product"]["price"] == 799
    assert data["modified"]["product"]["target_audience"] == "College Students"


def test_price_alternatives():
    response = client.post("/what-if", json={
        "question": "Which would perform better: ₹799 or ₹999?",
        "current_product": PRODUCT,
        "regions": PRODUCT["regions"],
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data["alternatives"]) == 2
    assert data["modified"]["product"]["price"] == 799
