"""Helpers for loading the existing TruthLens model bundle and making predictions."""
import re
from pathlib import Path

import joblib
import numpy as np

MODEL_PATH = Path(__file__).resolve().parent / "models" / "model.joblib"

_URL = re.compile(r"https?://\S+|www\.\S+", re.I)
_HTML = re.compile(r"<[^>]+>")
_DATELINE = re.compile(r"[A-Z][A-Z .,/'-]{1,40}\(Reuters\)\s*[-–—]?\s*")
_LEAKS = re.compile(r"\b(reuters|featured image|getty images|21st century wire|read more)\b", re.I)
_NON_ALPHA = re.compile(r"[^a-z\s]")
_SPACES = re.compile(r"\s+")


def clean_text(text) -> str:
    """Clean text in the same general way as the training pipeline."""
    text = str(text or "")
    text = _DATELINE.sub(" ", text)
    text = _URL.sub(" ", text)
    text = _HTML.sub(" ", text)
    text = _LEAKS.sub(" ", text)
    text = _NON_ALPHA.sub(" ", text.lower())
    return _SPACES.sub(" ", text).strip()


def load_bundle(path: Path = MODEL_PATH) -> dict:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(
            f"Trained model not found at: {path}. Keep your trained file at models/model.joblib."
        )
    bundle = joblib.load(path)
    if not isinstance(bundle, dict):
        raise TypeError("model.joblib must contain a dictionary with 'vectorizer' and 'model' keys.")
    missing = {"vectorizer", "model"} - set(bundle.keys())
    if missing:
        raise KeyError(f"Model bundle is missing required keys: {', '.join(sorted(missing))}")
    return bundle


def predict_text(text: str, bundle: dict, top_k: int = 8) -> dict:
    """Return REAL probability and feature contributions when supported by the model."""
    vectorizer = bundle["vectorizer"]
    clf = bundle["model"]
    cleaned = clean_text(text)
    X = vectorizer.transform([cleaned]).tocsr()

    if hasattr(clf, "predict_proba"):
        probabilities = clf.predict_proba(X)[0]
        classes = list(getattr(clf, "classes_", [0, 1]))
        real_index = classes.index(1) if 1 in classes else len(probabilities) - 1
        p_real = float(probabilities[real_index])
    elif hasattr(clf, "decision_function"):
        score = float(np.ravel(clf.decision_function(X))[0])
        p_real = float(1 / (1 + np.exp(-score)))
    else:
        predicted = int(np.ravel(clf.predict(X))[0])
        p_real = 1.0 if predicted == 1 else 0.0

    fake_words, real_words = [], []
    try:
        if hasattr(clf, "coef_") and hasattr(vectorizer, "get_feature_names_out"):
            idx, tfidf = X.indices, X.data
            coefficients = np.ravel(clf.coef_)
            contributions = tfidf * coefficients[idx]
            names = vectorizer.get_feature_names_out()
            order = np.argsort(contributions)
            fake_words = [
                [str(names[idx[i]]), float(-contributions[i])]
                for i in order if contributions[i] < 0
            ][:top_k]
            real_words = [
                [str(names[idx[i]]), float(contributions[i])]
                for i in order[::-1] if contributions[i] > 0
            ][:top_k]
    except Exception:
        # Prediction should still work if this model does not support explanations.
        fake_words, real_words = [], []

    return {
        "p_real": p_real,
        "label": "REAL" if p_real >= 0.5 else "FAKE",
        "n_words": len(str(text).split()),
        "fake_words": fake_words,
        "real_words": real_words,
    }
