from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from urllib.parse import parse_qs
from .models import Store, User

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
        query_string = scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]

        if token:
            scope['user'] = await get_user_or_store(token)
        else:
            scope['user'] = AnonymousUser()

        return await self.inner(scope, receive, send)
