from .settings import *  # noqa: F401,F403

import os
from django.core.exceptions import ImproperlyConfigured


def _required_env(name: str) -> str:
    value = os.getenv(name, '').strip()
    if not value:
        raise ImproperlyConfigured(f'{name} must be set for production.')
    return value


DEBUG = False
SECRET_KEY = _required_env('DJANGO_SECRET_KEY')
ALLOWED_HOSTS = [host.strip() for host in _required_env('DJANGO_ALLOWED_HOSTS').split(',') if host.strip()]

if '*' in ALLOWED_HOSTS:
    raise ImproperlyConfigured('DJANGO_ALLOWED_HOSTS cannot contain * in production.')

CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in _required_env('CORS_ALLOWED_ORIGINS').split(',') if origin.strip()]

SECURE_SSL_REDIRECT = os.getenv('DJANGO_SECURE_SSL_REDIRECT', 'true').lower() in ('1', 'true', 'yes', 'on')
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_REFERRER_POLICY = 'same-origin'
SECURE_HSTS_SECONDS = int(os.getenv('DJANGO_SECURE_HSTS_SECONDS', '31536000'))
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

if os.getenv('TRUST_X_FORWARDED_PROTO', 'true').lower() in ('1', 'true', 'yes', 'on'):
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

DATABASES['default'].update({  # noqa: F405
    'NAME': _required_env('DB_NAME'),
    'USER': _required_env('DB_USER'),
    'PASSWORD': _required_env('DB_PASSWORD'),
    'HOST': _required_env('DB_HOST'),
    'PORT': _required_env('DB_PORT'),
})

CELERY_BROKER_URL = _required_env('REDIS_BROKER_URL')
CHANNEL_LAYERS['default']['CONFIG']['hosts'][0]['address'] = os.getenv('REDIS_CHANNEL_URL', CELERY_BROKER_URL)  # noqa: F405
CACHES['default']['LOCATION'] = _required_env('REDIS_CACHE_URL')  # noqa: F405

SUPPORT_ATTACHMENT_MALWARE_SCAN_REQUIRED = True
API_RATE_LIMITING_ENABLED = True
