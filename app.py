from flask import Flask, render_template, request, jsonify
from pathlib import Path
import traceback

from utils import load_bundle, predict_text, MODEL_PATH

app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False

_bundle = None
_model_error = None


def get_bundle():
    global _bundle, _model_error
    if _bundle is None:
        try:
            _bundle = load_bundle(MODEL_PATH)
            _model_error = None
        except Exception as exc:
            _model_error = str(exc)
            raise
    return _bundle


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/status")
def api_status():
    try:
        bundle = get_bundle()
        model = bundle.get("model")
        deployed = bundle.get("deployed", getattr(model, "__class__", type("x", (), {})).__name__)
        metrics = bundle.get("metrics", {})
        return jsonify({
            "status": "ok",
            "model": str(deployed),
            "articles_trained": bundle.get("n_articles"),
            "cv_f1_mean": bundle.get("cv_f1_mean"),
            "metrics": metrics,
            "model_path": str(MODEL_PATH)
        })
    except Exception as exc:
        return jsonify({
            "status": "error",
            "message": "Trained model could not be loaded.",
            "details": str(exc),
            "expected_model_path": str(MODEL_PATH)
        }), 503


@app.post("/api/analyze")
def api_analyze():
    try:
        payload = request.get_json(silent=True) or {}
        title = str(payload.get("title", "")).strip()
        text = str(payload.get("text", "")).strip()
        article = f"{title}. {text}".strip(". ").strip()

        if not text:
            return jsonify({"error": "Please provide article text."}), 400
        if len(text.split()) < 3:
            return jsonify({"error": "Please enter at least a few words to analyze."}), 400

        bundle = get_bundle()
        result = predict_text(article, bundle)
        p_real = float(result["p_real"])
        return jsonify({
            **result,
            "confidence": round(max(p_real, 1 - p_real) * 100, 2),
            "label": "REAL" if p_real >= 0.5 else "FAKE"
        })
    except FileNotFoundError as exc:
        return jsonify({
            "error": "Trained model file is missing.",
            "details": str(exc),
            "expected_model_path": str(MODEL_PATH)
        }), 503
    except Exception as exc:
        app.logger.exception("Article analysis failed")
        return jsonify({
            "error": "The article could not be analyzed.",
            "details": str(exc)
        }), 500


if __name__ == "__main__":
    print("TruthLens AI starting...")
    print(f"Expected trained model: {MODEL_PATH}")
    app.run(host="127.0.0.1", port=5000, debug=True)
