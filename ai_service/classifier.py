import logging
import json
import numpy as np
from pathlib import Path
from PIL import Image

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
_BASE     = Path(__file__).parent
_ONNX     = _BASE / "model.onnx"
_META     = _BASE / "model_meta.json"

# Normalisation constants (ImageNet)
_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)

# ── Model loading (lazy, singleton) ──────────────────────────────────────────
_session = None
_classes  = None
_img_size = 224


def _load_model():
    global _session, _classes, _img_size
    if _session is not None:
        return True

    if not _ONNX.exists():
        logger.warning("model.onnx not found — run  python3 train.py  to generate it.")
        return False

    try:
        import onnxruntime as ort
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 2
        opts.inter_op_num_threads = 2
        _session = ort.InferenceSession(str(_ONNX), sess_options=opts,
                                        providers=["CPUExecutionProvider"])

        if _META.exists():
            meta = json.loads(_META.read_text())
            _classes  = meta["classes"]
            _img_size = meta.get("img_size", 224)
        else:
            _classes = ["medicine", "other", "prescription"]

        logger.info("MobileNetV3 ONNX model loaded. Classes: %s", _classes)
        return True

    except Exception as e:
        logger.error("Failed to load ONNX model: %s", e)
        return False


# ── Preprocessing ─────────────────────────────────────────────────────────────

def _preprocess(image_path: str) -> np.ndarray:
    img = Image.open(image_path).convert("RGB")
    img = img.resize((_img_size, _img_size), Image.BILINEAR)
    arr = np.array(img, dtype=np.float32) / 255.0          # H×W×3
    arr = (arr - _MEAN) / _STD                              # normalise
    arr = arr.transpose(2, 0, 1)                            # → C×H×W
    arr = np.expand_dims(arr, 0)                            # → 1×C×H×W
    return arr.astype(np.float32)


# ── Softmax ───────────────────────────────────────────────────────────────────

def _softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - x.max())
    return e / e.sum()


# ── Result helpers ─────────────────────────────────────────────────────────────

def _ok(classification: str, score: float, reason: str):
    return {"classification": classification, "score": round(float(score), 2),
            "reason": reason, "ocr_text": ""}

def _unknown(reason: str, score: float = 0.0):
    return {"classification": "unknown", "score": round(score, 2),
            "reason": reason, "ocr_text": ""}


# ── Main classify function ────────────────────────────────────────────────────

def classify_image(image_path: str, user_upload_type: str = "prescription"):
    """
    Classify a prescription image using MobileNetV3-Small (ONNX).

    user_upload_type: 'prescription' | 'medicine'
        → used to detect mismatches between what the user *said* and what
          the model *sees*.
    """
    # ── 1. Load model ──────────────────────────────────────────────────────────
    if not _load_model():
        return _unknown(
            "AI model not trained yet. Run 'python3 train.py' inside ai_service/ to train the model.",
            score=0.0
        )

    # ── 2. Preprocess ──────────────────────────────────────────────────────────
    try:
        inp = _preprocess(image_path)
    except Exception as e:
        logger.exception("Preprocessing failed")
        return _unknown(f"Could not read image: {e}")

    # ── 3. Inference ───────────────────────────────────────────────────────────
    try:
        input_name = _session.get_inputs()[0].name
        logits     = _session.run(None, {input_name: inp})[0][0]   # shape (num_classes,)
        probs      = _softmax(logits)
        pred_idx   = int(np.argmax(probs))
        pred_class = _classes[pred_idx]
        confidence = float(probs[pred_idx])
    except Exception as e:
        logger.exception("ONNX inference failed")
        return _unknown(f"Inference error: {e}")

    logger.debug("Predicted: %s (%.2f) | user said: %s", pred_class, confidence, user_upload_type)

    # ── 4. Low-confidence → unknown ───────────────────────────────────────────
    LOW_CONF_THRESHOLD = 0.45
    if confidence < LOW_CONF_THRESHOLD:
        return _unknown(
            f"Model is not confident enough (max probability: {confidence:.0%}). "
            "Please upload a clearer image.",
            score=confidence,
        )

    # ── 5. Mismatch detection ─────────────────────────────────────────────────
    # 'other' class = neither prescription nor medicine box
    if pred_class == "other":
        return _unknown(
            "Image does not appear to be a prescription or medicine box. "
            "Please upload the correct type of photo.",
            score=confidence,
        )

    MISMATCH_THRESHOLD = 0.60
    if user_upload_type == "prescription" and pred_class == "medicine":
        if confidence >= MISMATCH_THRESHOLD:
            return _ok(
                "medicine", confidence,
                f"You selected 'Prescription' but the image looks like a medicine box "
                f"({confidence:.0%} confidence). Please upload the correct photo."
            )

    if user_upload_type == "medicine" and pred_class == "prescription":
        if confidence >= MISMATCH_THRESHOLD:
            return _ok(
                "prescription", confidence,
                f"You selected 'Medicine' but the image looks like a prescription document "
                f"({confidence:.0%} confidence). Please upload the correct photo."
            )

    # ── 6. Correct match ──────────────────────────────────────────────────────
    label_map = {"prescription": "Prescription", "medicine": "Medicine Box"}
    return _ok(
        pred_class,
        confidence,
        f"MobileNetV3: Detected as {label_map.get(pred_class, pred_class)} "
        f"with {confidence:.0%} confidence."
    )
