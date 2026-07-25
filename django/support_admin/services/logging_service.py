from __future__ import annotations

from typing import Any

from prescription.services.activity_log import log_activity

SENSITIVE_KEYS = {
    "password",
    "token",
    "refresh",
    "access",
    "otp",
    "otp_code",
    "pin",
    "card",
    "cvv",
    "secret",
    "authorization",
}


def _redact_value(key: str, value: Any) -> Any:
    if any(part in key.lower() for part in SENSITIVE_KEYS):
        return "[redacted]"
    return value


def redact_payload(data: Any) -> Any:
    if isinstance(data, dict):
        return {key: redact_payload(_redact_value(key, value)) for key, value in data.items()}
    if isinstance(data, list):
        return [redact_payload(item) for item in data]
    return data


def log_production_event(category: str, action: str, title: str, *, actor=None, subject=None, details=None):
    return log_activity(
        category=category,
        action=action,
        title=title,
        actor=actor,
        subject=subject,
        details=redact_payload(details or {}),
    )

