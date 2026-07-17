import hashlib
import logging
import re
import time

from django.conf import settings
from django.core.cache import cache
from rest_framework.throttling import BaseThrottle

logger = logging.getLogger("security.rate_limit")
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


class _FixedWindowThrottle(BaseThrottle):
    scope = None
    limit = None
    window = None
    current = None
    reset_at = None

    def get_scope(self, request):
        raise NotImplementedError

    def get_identity(self, request):
        user = getattr(request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            role = "store" if getattr(user, "is_store", False) else "user"
            return f"{role}:{user.pk}"
        return f"ip:{self.get_ident(request)}"

    def allow_request(self, request, view):
        if not getattr(settings, "API_RATE_LIMITING_ENABLED", True):
            return True

        self.scope = self.get_scope(request)
        if not self.scope:
            return True

        config = getattr(settings, "API_RATE_LIMITS", {}).get(self.scope)
        if not config:
            logger.error("Missing API rate-limit configuration for scope=%s", self.scope)
            return False

        self.limit = int(config["limit"])
        self.window = int(config["window"])
        now = int(time.time())
        bucket = now // self.window
        self.reset_at = (bucket + 1) * self.window
        identity = self.get_identity(request)
        raw_key = f"{self.scope}:{identity}:{bucket}"
        digest = hashlib.sha256(raw_key.encode()).hexdigest()
        key = f"rl:v1:{digest}"

        try:
            if cache.add(key, 1, timeout=self.window + 5):
                self.current = 1
            else:
                self.current = cache.incr(key)
        except Exception:
            logger.exception("Rate-limit cache unavailable scope=%s identity=%s", self.scope, identity)
            fail_closed = set(getattr(settings, "API_RATE_LIMIT_FAIL_CLOSED_SCOPES", ()))
            return self.scope not in fail_closed

        rate_limit_info = {
            "scope": self.scope,
            "limit": self.limit,
            "remaining": max(0, self.limit - self.current),
            "reset": self.reset_at,
        }
        request._rate_limit_info = rate_limit_info
        raw_request = getattr(request, "_request", None)
        if raw_request is not None:
            raw_request._rate_limit_info = rate_limit_info
        allowed = self.current <= self.limit
        if not allowed:
            logger.warning(
                "Request throttled scope=%s identity=%s method=%s path=%s count=%s limit=%s",
                self.scope, identity, request.method, request.path, self.current, self.limit,
            )
        return allowed

    def wait(self):
        if not self.reset_at:
            return None
        return max(1, self.reset_at - int(time.time()))


class GlobalProjectRateThrottle(_FixedWindowThrottle):
    """Every DRF API request consumes one global authenticated/anonymous quota."""

    def get_scope(self, request):
        user = getattr(request, "user", None)
        authenticated = user is not None and getattr(user, "is_authenticated", False)
        access = "read" if request.method in SAFE_METHODS else "write"
        return f"global_{'authenticated' if authenticated else 'anonymous'}_{access}"


class EndpointProjectRateThrottle(_FixedWindowThrottle):
    """Sensitive endpoint quotas, configured entirely in settings.API_RATE_LIMIT_RULES."""

    def get_scope(self, request):
        path = request.path
        method = request.method.upper()
        for rule in getattr(settings, "API_RATE_LIMIT_RULES", ()):
            methods = rule.get("methods")
            if methods and method not in methods:
                continue
            if re.search(rule["pattern"], path):
                return rule["scope"]
        return None
