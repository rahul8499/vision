"""
ASGI config for aarx project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.0/howto/deployment/asgi/
"""

import os
import warnings
warnings.filterwarnings("ignore", category=Warning, message="StreamingHttpResponse must consume synchronous iterators in order to serve them asynchronously.*")

import os

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aarx.settings')

django_asgi_app = get_asgi_application()

from prescription.middleware import TokenAuthMiddleware
import aarx.routing

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": TokenAuthMiddleware(
        URLRouter(
            aarx.routing.websocket_urlpatterns
        )
    ),
})
