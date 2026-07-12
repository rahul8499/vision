import logging
from django.core.cache import cache

logger = logging.getLogger(__name__)


def _record_fallback(path):
    key = f"capability_metric:safe_get_fallback:{path}"
    try:
        cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=None)
    except Exception:
        logger.debug("safe_get metric failed for %s", path, exc_info=True)


def safe_get(obj, path: str, default=""):
    if obj is None:
        _record_fallback(path)
        return default

    current = obj
    for attr in path.split('.'):
        if current is None:
            _record_fallback(path)
            return default
        try:
            current = getattr(current, attr)
        except Exception:
            _record_fallback(path)
            return default

    if current is None:
        _record_fallback(path)
        return default
    return current
