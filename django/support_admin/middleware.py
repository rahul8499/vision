from __future__ import annotations

import logging
import time

from django.conf import settings

from .services.logging_service import log_production_event, redact_payload

logger = logging.getLogger(__name__)


class ProductionRequestLoggingMiddleware:
    """Capture slow and failed API requests without changing responses."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        started_at = time.perf_counter()
        response = None
        try:
            response = self.get_response(request)
            return response
        finally:
            elapsed_ms = round((time.perf_counter() - started_at) * 1000, 2)
            path = getattr(request, "path", "")
            method = getattr(request, "method", "")
            status_code = getattr(response, "status_code", 500 if request else 0)

            if path.startswith("/api/") and status_code >= 500:
                payload = {
                    "method": method,
                    "path": path,
                    "status_code": status_code,
                    "duration_ms": elapsed_ms,
                    "query_params": redact_payload(dict(getattr(request, "GET", {}))),
                }
                logger.error("Production API failure", extra=payload)
                log_production_event(
                    "production_log",
                    "api_failure",
                    f"{method} {path} failed",
                    details=payload,
                )
            elif path.startswith("/api/") and elapsed_ms >= getattr(settings, "PRODUCTION_SLOW_API_THRESHOLD_MS", 1500):
                payload = {
                    "method": method,
                    "path": path,
                    "status_code": status_code,
                    "duration_ms": elapsed_ms,
                }
                logger.warning("Slow API request", extra=payload)
                log_production_event(
                    "production_log",
                    "slow_api",
                    f"{method} {path} was slow",
                    details=payload,
                )
