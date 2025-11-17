from __future__ import annotations

import json
import os
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, no_type_check

import nbformat
from flask import Flask, jsonify, render_template, request
from nbclient import NotebookClient

BASE_DIR = Path(__file__).resolve().parent
NOTEBOOK_PATH = BASE_DIR / "Finance_data_web.ipynb"
PREDICTOR_FEATURES = [
    "Income",
    "Age",
    "Dependents",
    "Occupation_encoded",
    "City_Tier_encoded",
    "Total_Expenses",
    "Desired_Savings_Percentage",
    "Disposable_Income",
]

DEFAULT_SAMPLE = {
    "Income": 60000.0,
    "Age": 30.0,
    "Dependents": 1.0,
    "Occupation_encoded": 1.0,
    "City_Tier_encoded": 1.0,
    "Total_Expenses": 25000.0,
    "Desired_Savings_Percentage": 15.0,
    "Disposable_Income": 35000.0,
}
DEFAULT_SAMPLE_LABELS = {
    "Occupation": "Salaried",
    "City_Tier": "Tier 2",
}


def _sample_profile() -> Dict[str, Any]:
    return {
        **DEFAULT_SAMPLE,
        **DEFAULT_SAMPLE_LABELS,
        "source": "step_7_notebook",
    }


SAMPLE_SCATTER: Dict[str, List[Any]] = {
    "income": [45000, 52000, 60000, 72000, 81000, 67000, 55000, 41000, 38000, 30000],
    "totalExpenses": [20000, 23000, 25000, 30000, 33000, 28000, 24000, 18000, 17000, 14000],
    "cityTier": [
        "Tier 1",
        "Tier 2",
        "Tier 2",
        "Tier 1",
        "Tier 3",
        "Tier 2",
        "Tier 1",
        "Tier 3",
        "Tier 2",
        "Tier 1",
    ],
    "savingsPct": [12, 14, 15, 16, 18, 15, 13, 11, 10, 9],
}

SAMPLE_PIE: Dict[str, List[Any]] = {
    "labels": [
        "Rent",
        "Loan_Repayment",
        "Insurance",
        "Groceries",
        "Transport",
        "Eating_Out",
        "Entertainment",
        "Utilities",
        "Healthcare",
        "Education",
        "Miscellaneous",
    ],
    "values": [9000, 2500, 1500, 5200, 2200, 1400, 1300, 2300, 1600, 2200, 800],
}

SAMPLE_BAR: Dict[str, List[Any]] = {
    "labels": ["Professional", "Self_Employed", "Student", "Retired"],
    "values": [31000, 29500, 22000, 18000],
}

SAMPLE_PROJECTION: Dict[str, List[Any]] = {
    "months": list(range(1, 13)),
    "values": [round(35000 * 0.15 * m * 1.005, 2) for m in range(1, 13)],
}

SAMPLE_HEATMAP: Dict[str, Any] = {
    "labels": [
        "Income",
        "Total_Expenses",
        "Desired_Savings_Percentage",
        "Disposable_Income",
        "Dependents",
    ],
    "matrix": [
        [1.0, 0.82, 0.65, 0.91, -0.12],
        [0.82, 1.0, 0.58, 0.42, -0.05],
        [0.65, 0.58, 1.0, 0.71, 0.02],
        [0.91, 0.42, 0.71, 1.0, -0.18],
        [-0.12, -0.05, 0.02, -0.18, 1.0],
    ],
}

SAMPLE_INSIGHTS = [
    "Sample household allocates 42% of income to rent and necessities.",
    "Savings rate fixed at 15%.",
    "Disposable income of ₹35,000 keeps overspend risk low.",
    "Upgrade the inputs to see personalized notebook predictions.",
]

SAMPLE_OPTIONS = {
    "occupations": ["Salaried", "Professional", "Student", "Self_Employed"],
    "city_tiers": ["Tier 1", "Tier 2", "Tier 3"],
}

SAMPLE_META = {"records": 1}

app = Flask(__name__, template_folder="templates", static_folder="static")
NOTEBOOK_LOCK = threading.Lock()


@no_type_check
def build_dashboard_snapshot() -> Dict[str, Any]:
    return {
        "charts": {
            "scatter": SAMPLE_SCATTER,
            "pie": SAMPLE_PIE,
            "bar": SAMPLE_BAR,
            "projection": SAMPLE_PROJECTION,
            "heatmap": SAMPLE_HEATMAP,
        },
        "insights": SAMPLE_INSIGHTS,
        "options": SAMPLE_OPTIONS,
        "meta": SAMPLE_META,
        "sample_profile": _sample_profile(),
    }


@no_type_check
def execute_notebook(payload: Dict[str, Any]) -> Dict[str, Any]:
    start = time.time()
    with NOTEBOOK_LOCK:
        prev_value = os.environ.get("USER_INPUT_PAYLOAD")
        # Convert payload to JSON string and log it
        payload_json = json.dumps(payload)
        print(f"Setting USER_INPUT_PAYLOAD: {payload_json}")
        os.environ["USER_INPUT_PAYLOAD"] = payload_json
        try:
            print(f"Reading notebook from {NOTEBOOK_PATH}")
            nb = nbformat.read(NOTEBOOK_PATH.open("r", encoding="utf-8"), as_version=4)
            print(f"Notebook loaded with {len(nb.cells)} cells")
            client = NotebookClient(
                nb,
                timeout=120,  # Reduced to 2 minutes
                kernel_name="python3",
                resources={"metadata": {"path": str(BASE_DIR)}},
            )
            print("Starting notebook execution...")
            client.execute()
            print("Notebook execution completed")
        except Exception as e:
            print(f"Error during notebook execution: {e}")
            raise
        finally:
            if prev_value is None:
                os.environ.pop("USER_INPUT_PAYLOAD", None)
            else:
                os.environ["USER_INPUT_PAYLOAD"] = prev_value
    result_path = BASE_DIR / "user_prediction.json"
    result: dict
    if result_path.exists():
        result = json.loads(result_path.read_text(encoding="utf-8"))
        print(f"Result loaded: {result}")
    else:
        result = {"error": "user_prediction.json not produced"}
        print("Warning: user_prediction.json not found")
    result["elapsed_ms"] = round((time.time() - start) * 1000, 2)
    return result


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/input")
def input_page():
    return render_template("input.html")


@app.get("/api/sample-dashboard")
def sample_dashboard():
    # Clear user_prediction.json when refreshing dashboard
    result_path = BASE_DIR / "user_prediction.json"
    if result_path.exists():
        try:
            result_path.unlink()
            app.logger.info("Deleted user_prediction.json on dashboard refresh")
        except Exception as e:
            app.logger.warning(f"Could not delete prediction file: {e}")
    
    try:
        snapshot: Dict[str, Any] = build_dashboard_snapshot()
        return jsonify(snapshot)
    except Exception as exc:  # pragma: no cover - easier troubleshooting
        app.logger.exception("Sample dashboard failed")
        return jsonify({"error": str(exc)}), 500


@app.post("/api/run-notebook")
def run_notebook_endpoint():
    payload: Dict[str, Any] = request.get_json() or {}
    app.logger.info(f"Received prediction request with payload: {payload}")
    missing = [f for f in PREDICTOR_FEATURES if f not in payload]
    if missing:
        # allow categorical fallbacks; front-end will send Occupation/City_Tier as well
        pass
    
    # Clear previous prediction file before running new prediction
    result_path = BASE_DIR / "user_prediction.json"
    try:
        # Delete the file completely to ensure fresh start
        if result_path.exists():
            result_path.unlink()
        app.logger.info("Deleted previous user_prediction.json")
    except Exception as e:
        app.logger.warning(f"Could not delete old prediction file: {e}")
    
    try:
        app.logger.info("Starting notebook execution...")
        result: Dict[str, Any] = execute_notebook(payload)
        app.logger.info(f"Notebook execution completed: {result}")
        return jsonify(result)
    except Exception as exc:  # pragma: no cover - log friendly
        app.logger.exception("Notebook execution failed")
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    import logging
    import asyncio
    import sys
    
    # Fix for Windows asyncio event loop issue with Jupyter
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    logging.basicConfig(level=logging.INFO)
    app.run(host="0.0.0.0", port=8000, debug=True, use_reloader=False, threaded=True)
