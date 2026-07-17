import json
import re
from pathlib import Path

from django.conf import settings

_CATALOG_PATH = Path(settings.BASE_DIR) / 'locale' / 'api_messages.json'
try:
    _API_MESSAGES = json.loads(_CATALOG_PATH.read_text(encoding='utf-8'))
except (OSError, ValueError):
    _API_MESSAGES = {'en': {}, 'hi': {}, 'mr': {}}

_MACHINE_CODE = re.compile(r'^[a-z0-9_]+$')


def _translate_value(value, messages):
    if isinstance(value, str):
        if _MACHINE_CODE.fullmatch(value):
            return value
        return messages.get(value, value)
    if isinstance(value, list):
        return [_translate_value(item, messages) for item in value]
    if isinstance(value, tuple):
        return tuple(_translate_value(item, messages) for item in value)
    if isinstance(value, dict):
        return {key: _translate_value(item, messages) for key, item in value.items()}
    return value


class ApiResponseTranslationMiddleware:
    """Translate only exact, audited static strings in DRF response data."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_template_response(self, request, response):
        if not request.path.startswith('/api/') or not hasattr(response, 'data'):
            return response
        language = getattr(request, 'LANGUAGE_CODE', 'en')
        language = language if language in ('en', 'hi', 'mr') else 'en'
        if language != 'en':
            response.data = _translate_value(response.data, _API_MESSAGES.get(language, {}))
        response['Content-Language'] = language
        return response
