from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from django.conf import settings
from django.core.cache import cache
import hashlib
import time
from urllib.parse import parse_qs
from .models import Store, User

@database_sync_to_async
def websocket_attempt_allowed(client_ip):
    config = settings.WEBSOCKET_RATE_LIMITS
    limit = int(config["connection_attempts_per_minute"])
    bucket = int(time.time()) // 60
    digest = hashlib.sha256(f"{client_ip}:{bucket}".encode()).hexdigest()
    key = f"ws:attempt:v1:{digest}"
    try:
        if cache.add(key, 1, timeout=65):
            return True
        return cache.incr(key) <= limit
    except Exception:
        return False



@database_sync_to_async
def get_user_or_store(token_key):
    try:
        user = User.objects.get(token=token_key)
        return user
    except User.DoesNotExist:
        pass
        
    try:
        store = Store.objects.get(token=token_key)
        return store
    except Store.DoesNotExist:
        return AnonymousUser()

class TokenAuthMiddleware:
    """
    Custom Middleware for WebSockets that extracts token from query string
    ws://domain/ws/chat/1/?token=xxxx
    """
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        client = scope.get("client") or ("unknown", 0)
        if not await websocket_attempt_allowed(client[0]):
            await send({"type": "websocket.close", "code": 4029})
            return

        query_string = scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]

        if token:
            scope['user'] = await get_user_or_store(token)
        else:
            scope['user'] = AnonymousUser()

        return await self.inner(scope, receive, send)
