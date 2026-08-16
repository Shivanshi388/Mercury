"""
test_ai.py
----------
Quick standalone test for the AI/Persona Engine. Run this directly to sanity
check ai.py + prompts.py without needing main.py or the frontend running.

Usage:
    export ANTHROPIC_API_KEY=sk-ant-...
    python test_ai.py
"""

import json
from ai import simulate

SAMPLE_PRODUCT = {
    "name": "Fold",
    "category": "Consumer hardware",
    "price": "$149 one-time",
    "target_customer": "Renters in small apartments, 25-40",
    "description": (
        "A compact countertop robot that folds laundry automatically. "
        "You drop damp or dry clothes into the tray, and Fold sorts and "
        "folds them into neat stacks within a few minutes per load. "
        "No app pairing needed; one button on the device."
    ),
}


def run_full_test():
    print("Running all personas...\n")
    results = simulate(SAMPLE_PRODUCT)
    print(json.dumps(results, indent=2, ensure_ascii=False))
    return results


def run_subset_test():
    print("\nRunning a subset (india, usa) to test region_ids filtering...\n")
    results = simulate(SAMPLE_PRODUCT, region_ids=["india", "usa"])
    print(json.dumps(results, indent=2, ensure_ascii=False))
    return results


def check_schema(results):
    required_keys = {
        "region_id", "region", "city", "persona_name",
        "reaction", "top_concern", "price_sensitivity",
        "purchase_probability", "feedback",
    }
    for r in results:
        missing = required_keys - r.keys()
        assert not missing, f"Result missing keys: {missing} -> {r}"
        assert 1 <= r["price_sensitivity"] <= 10, "price_sensitivity out of range"
        assert 0 <= r["purchase_probability"] <= 100, "purchase_probability out of range"
    print("\nSchema check passed: all results match the fixed contract.")


if __name__ == "__main__":
    full_results = run_full_test()
    check_schema(full_results)
    run_subset_test()
