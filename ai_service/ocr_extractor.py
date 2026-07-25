import logging
import os
import re
from typing import Any

logger = logging.getLogger(__name__)

_engine = None

_NON_MEDICINE_PREFIXES = (
    "patient", "name", "age", "sex", "gender", "address", "date", "doctor",
    "dr ", "hospital", "clinic", "registration", "reg no", "diagnosis", "bp ",
    "pulse", "weight", "follow up", "signature", "mobile", "mob", "phone",
    "timing", "temp", "m.b.b.s", "sample", "medicine name", "dosage", "duration",
    "advice", "charts", "blood pressure", "closed", "am ", "pm ", "id:",
)
_DOSAGE_ONLY = re.compile(
    r"^(?:take\s+)?(?:one|two|three|half|once|twice|thrice|daily|morning|night|"
    r"before food|after food|sos|od|bd|tds|qid|hs|stat|\d+[-–]\d+[-–]\d+)(?:\s+.*)?$",
    re.IGNORECASE,
)
_MEDICINE_SIGNAL = re.compile(
    r"\b(?:tab(?:let)?|cap(?:sule)?|syp|syrup|inj(?:ection)?|cream|ointment|gel|"
    r"drops?|susp(?:ension)?|powder|solution|spray|lotion|mg|mcg|gm|ml|iu)\b",
    re.IGNORECASE,
)
_LEADING_MARKER = re.compile(
    r"^\s*(?:rx\s*)?(?:\d+[.)-]?\s*)?(?:tab(?:let)?|cap(?:sule)?|syp|syrup|"
    r"inj(?:ection)?|cream|ointment|gel|drops?|susp(?:ension)?|powder|solution|"
    r"spray|lotion)\.?\s*",
    re.IGNORECASE,
)
_TRAILING_INSTRUCTIONS = re.compile(
    r"\s+(?:take|apply|use|one|two|half|once|twice|thrice|daily|morning|night|"
    r"before food|after food|sos|od|bd|tds|qid|hs|stat|\d+[-–]\d+[-–]\d+)\b.*$",
    re.IGNORECASE,
)
_EXPLICIT_MEDICINE_PREFIX = re.compile(
    r"^\s*(?:rx\s*)?(?:\d+[.)-]?\s*)?(?:tab(?:let)?|cap(?:sule)?|syp|syrup|"
    r"inj(?:ection)?|cream|ointment|gel|drops?|susp(?:ension)?|powder|solution|"
    r"spray|lotion)\b",
    re.IGNORECASE,
)
_STRENGTH_SIGNAL = re.compile(r"\b\d+(?:\.\d+)?\s*(?:mg|mcg|gm|g|ml|iu)\b", re.IGNORECASE)
_NON_MEDICINE_CONTENT = re.compile(
    r"\b(?:tot(?:al)?|morning|moming|moring|night|aft(?:er)?|eve(?:ning)?|"
    r"before\s+food|after\s+food|days?|reg\.?\s*no|mob\.?\s*no|timing|"
    r"blood\s*pressure|mmhg|follow\s*up)\b",
    re.IGNORECASE,
)


def _get_engine():
    global _engine
    if _engine is None:
        from rapidocr import RapidOCR

        _engine = RapidOCR()
    return _engine


def _clean_candidate(text: str) -> str:
    value = re.sub(r"\s+", " ", text or "").strip(" \t:;,.|-–")
    value = _LEADING_MARKER.sub("", value)
    value = _TRAILING_INSTRUCTIONS.sub("", value)
    return value.strip(" \t:;,.|-–")


def _is_candidate(text: str) -> bool:
    lowered = text.lower().strip()
    if len(text) < 3 or len(text) > 120:
        return False
    explicit_form = bool(_EXPLICIT_MEDICINE_PREFIX.search(text))
    if lowered.startswith(_NON_MEDICINE_PREFIXES) or _DOSAGE_ONLY.match(lowered):
        return False
    if not explicit_form and _NON_MEDICINE_CONTENT.search(text):
        return False
    if not re.search(r"[a-zA-Z]", text):
        return False
    return explicit_form or bool(_STRENGTH_SIGNAL.search(text))


def _image_variants(image_path: str) -> list[tuple[str, Any]]:
    """Create complementary inputs for faint and uneven prescriptions."""
    variants: list[tuple[str, Any]] = [("original", image_path)]
    if not os.path.isfile(image_path):
        return variants

    try:
        from PIL import Image, ImageEnhance, ImageFilter, ImageOps

        with Image.open(image_path) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
            longest_side = max(image.size)
            if longest_side < 1800:
                scale = min(2.0, 1800 / max(1, longest_side))
                image = image.resize(
                    (round(image.width * scale), round(image.height * scale)),
                    Image.Resampling.LANCZOS,
                )
            gray = ImageOps.grayscale(image)
            enhanced = ImageOps.autocontrast(gray, cutoff=1)
            enhanced = ImageEnhance.Contrast(enhanced).enhance(1.35)
            enhanced = enhanced.filter(ImageFilter.SHARPEN)
            variants.append(("enhanced", enhanced))
            variants.append(("threshold", enhanced.point(lambda pixel: 255 if pixel > 178 else 0)))
    except Exception:
        logger.exception("Could not prepare OCR image variants; using original")
    return variants


def _read_variant(engine: Any, image: Any) -> tuple[list[str], list[float]]:
    result = engine(image, text_score=0.32)
    return (
        list(getattr(result, "txts", None) or []),
        list(getattr(result, "scores", None) or []),
    )


def extract_prescription_text(image_path: str) -> dict[str, Any]:
    """Return OCR text and conservative medicine-line suggestions.

    Suggestions are advisory only. The function deliberately returns an empty
    list instead of guessing when OCR is unavailable or a line is ambiguous.
    """
    try:
        engine = _get_engine()
        readings: list[tuple[str, float]] = []
        for variant_name, image in _image_variants(image_path):
            try:
                variant_texts, variant_scores = _read_variant(engine, image)
            except Exception:
                logger.exception("RapidOCR %s pass failed", variant_name)
                continue
            for index, text in enumerate(variant_texts):
                try:
                    score = max(0.0, min(1.0, float(variant_scores[index])))
                except (IndexError, TypeError, ValueError):
                    score = 0.0
                readings.append((str(text or "").strip(), score))
    except (ImportError, ModuleNotFoundError) as exc:
        logger.warning("RapidOCR is unavailable: %s", exc)
        return {"ocr_text": "", "extracted_medicines": [], "ocr_engine": "unavailable"}
    except Exception:
        logger.exception("RapidOCR extraction failed")
        return {"ocr_text": "", "extracted_medicines": [], "ocr_engine": "failed"}

    best_readings: dict[str, tuple[str, float]] = {}
    for text, score in readings:
        key = re.sub(r"[^a-z0-9]", "", text.lower())
        if key and (key not in best_readings or score > best_readings[key][1]):
            best_readings[key] = (text, score)
    merged_readings = list(best_readings.values())
    texts = [item[0] for item in merged_readings]
    scores = [item[1] for item in merged_readings]
    suggestions = []
    seen = set()

    for index, raw_text in enumerate(texts):
        raw_text = str(raw_text or "").strip()
        if not _is_candidate(raw_text):
            continue
        candidate = _clean_candidate(raw_text)
        key = re.sub(r"[^a-z0-9]", "", candidate.lower())
        if len(candidate) < 3 or not key or key in seen:
            continue
        seen.add(key)
        try:
            confidence = max(0.0, min(1.0, float(scores[index])))
        except (IndexError, TypeError, ValueError):
            confidence = 0.0
        suggestions.append({
            "raw_text": raw_text,
            "suggested_name": candidate,
            "confidence": round(confidence, 3),
            "needs_verification": True,
        })
        if len(suggestions) >= 20:
            break

    return {
        "ocr_text": "\n".join(texts),
        "extracted_medicines": suggestions,
        "ocr_engine": "rapidocr",
    }
