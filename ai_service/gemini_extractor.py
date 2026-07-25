import base64
import logging
import mimetypes
import os
import re
from io import BytesIO
from typing import Any

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

_PROMPT = """You are extracting a prescription for a pharmacist to VERIFY.
Read printed and handwritten text directly from the image. Return only medicines or
medically administered products explicitly prescribed in the image. Do not return
patient/doctor details, diagnoses, symptoms, vitals, dates, totals, headings, food or
fluid advice. Never invent, autocorrect, or complete an unreadable medicine name.
Preserve the visible spelling. If a field is unreadable, use an empty string. Confidence
must reflect legibility, not medical plausibility. Each medicine must have a non-empty
medicine_name. Include ORS/dextrose/injections only when explicitly ordered as treatment.
"""

_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "prescription_readable": {"type": "boolean"},
        "review_reason": {"type": "string"},
        "medicines": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "medicine_name": {"type": "string"},
                    "strength": {"type": "string"},
                    "dosage": {"type": "string"},
                    "frequency": {"type": "string"},
                    "duration": {"type": "string"},
                    "raw_text": {"type": "string"},
                    "confidence": {"type": "number"},
                },
                "required": [
                    "medicine_name", "strength", "dosage", "frequency",
                    "duration", "raw_text", "confidence",
                ],
            },
        },
    },
    "required": ["prescription_readable", "review_reason", "medicines"],
}


def _clean(value: Any, limit: int = 160) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]


def _encode_image_bytes(image_bytes: bytes) -> str:
    return base64.b64encode(image_bytes).decode("ascii")


def _prepare_gemini_variants(image_path: str) -> list[tuple[str, str]]:
    """Create a small set of OCR-friendly Gemini inputs."""
    variants: list[tuple[str, str]] = []
    if not os.path.isfile(image_path):
        return variants

    try:
        from PIL import Image, ImageEnhance, ImageFilter, ImageOps

        with Image.open(image_path) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")

            if max(image.size) < 1800:
                scale = min(2.0, 1800 / max(1, max(image.size)))
                image = image.resize(
                    (round(image.width * scale), round(image.height * scale)),
                    Image.Resampling.LANCZOS,
                )

            def add_variant(name: str, candidate: Image.Image) -> None:
                buffer = BytesIO()
                candidate.save(buffer, format="JPEG", quality=88, optimize=True)
                variants.append((name, _encode_image_bytes(buffer.getvalue())))

            add_variant("original", image)

            enhanced = ImageEnhance.Contrast(image).enhance(1.25)
            enhanced = ImageEnhance.Sharpness(enhanced).enhance(1.35)
            enhanced = enhanced.filter(ImageFilter.SHARPEN)
            add_variant("sharpened_contrast", enhanced)
    except Exception:
        logger.exception("Could not prepare Gemini image variants; using original image")
        try:
            with open(image_path, "rb") as image_file:
                variants.append(("original", _encode_image_bytes(image_file.read())))
        except Exception:
            logger.exception("Could not read original image for Gemini")

    return variants or []


def _normalize(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Gemini response is not an object")
    source = payload.get("medicines")
    if not isinstance(source, list):
        raise ValueError("Gemini medicines is not a list")

    prescription_readable = bool(payload.get("prescription_readable"))
    review_reason = _clean(payload.get("review_reason"), 300)
    readability_text = f"{review_reason} {str(payload.get('ocr_text', ''))}".lower()
    if not prescription_readable or any(
        term in readability_text for term in ("unclear", "unreadable", "verify original", "not readable")
    ):
        return {
            "ocr_text": "",
            "extracted_medicines": [],
            "ocr_engine": "gemini",
            "prescription_readable": False,
            "ocr_review_reason": review_reason or "Prescription image is unclear; verify the original image.",
        }

    medicines = []
    seen = set()
    for item in source[:30]:
        if not isinstance(item, dict):
            continue
        name = _clean(item.get("medicine_name"), 100)
        strength = _clean(item.get("strength"), 40)
        key = re.sub(r"[^a-z0-9]", "", f"{name}{strength}".lower())
        if len(name) < 2 or not key or key in seen:
            continue
        seen.add(key)
        try:
            confidence = max(0.0, min(1.0, float(item.get("confidence", 0))))
        except (TypeError, ValueError):
            confidence = 0.0
        normalized_name = re.sub(r"\s+", "", name.lower())
        normalized_strength = re.sub(r"\s+", "", strength.lower())
        suggested_name = name if normalized_strength and normalized_strength in normalized_name else " ".join(
            part for part in (name, strength) if part
        )
        medicines.append({
            "raw_text": _clean(item.get("raw_text"), 180),
            "suggested_name": suggested_name,
            "medicine_name": name,
            "strength": strength,
            "dosage": _clean(item.get("dosage"), 80),
            "frequency": _clean(item.get("frequency"), 80),
            "duration": _clean(item.get("duration"), 80),
            "confidence": round(confidence, 3),
            "needs_verification": True,
        })

    return {
        "ocr_text": "\n".join(item["raw_text"] for item in medicines if item["raw_text"]),
        "extracted_medicines": medicines,
        "ocr_engine": "gemini",
        "prescription_readable": prescription_readable,
        "ocr_review_reason": review_reason,
    }


def extract_with_gemini(image_path: str) -> dict[str, Any] | None:
    """Return structured suggestions, or None so the caller can use local OCR."""
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key or os.environ.get("GEMINI_ENABLED", "true").lower() not in {"1", "true", "yes"}:
        return None

    model = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite").strip()
    timeout = max(5, min(55, int(os.environ.get("GEMINI_TIMEOUT_SECONDS", "25"))))
    mime_type = mimetypes.guess_type(image_path)[0] or "image/jpeg"
    if mime_type not in {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}:
        mime_type = "image/jpeg"

    image_variants = _prepare_gemini_variants(image_path)
    if not image_variants:
        with open(image_path, "rb") as image_file:
            image_variants = [("original", _encode_image_bytes(image_file.read()))]

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    parts = [{"text": _PROMPT + "\n\nAnalyze all provided image variants and return the best unified extraction."}]
    for variant_name, encoded_image in image_variants[:5]:
        parts.append({"text": f"Variant: {variant_name}"})
        parts.append({"inline_data": {"mime_type": mime_type, "data": encoded_image}})
    body = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "temperature": 0,
            "responseMimeType": "application/json",
            "responseJsonSchema": _RESPONSE_SCHEMA,
        },
    }
    try:
        session = requests.Session()
        retry = Retry(
            total=2,
            connect=2,
            read=2,
            status=2,
            backoff_factor=0.75,
            status_forcelist=(408, 429, 500, 502, 503, 504),
            allowed_methods=frozenset({'POST'}),
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry)
        session.mount('http://', adapter)
        session.mount('https://', adapter)
        response = session.post(
            url,
            headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
            json=body,
            timeout=(10, timeout),
        )
        response.raise_for_status()
        envelope = response.json()
        text = envelope["candidates"][0]["content"]["parts"][0]["text"]
        import json
        return _normalize(json.loads(text))
    except (requests.RequestException, KeyError, IndexError, TypeError, ValueError):
        logger.exception("Gemini extraction failed; using local OCR fallback")
        return None
